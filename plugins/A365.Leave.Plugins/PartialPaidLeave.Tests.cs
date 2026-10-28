using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using A365.Leave.Plugins;

public static class PartialPaidLeaveTests
{
    private static int checks;
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static void Check(bool condition, string message) { if (!condition) throw new Exception(message); checks++; }
    private sealed class Fake : IOrganizationService, IOrganizationServiceFactory, IServiceProvider
    {
        private sealed class GuardServices : IServiceProvider
        {
            private readonly RemoteExecutionContext context;
            public GuardServices(RemoteExecutionContext value) { context = value; }
            public object GetService(Type type) { return type == typeof(IPluginExecutionContext) ? context : null; }
        }
        private void GuardMutation(string message, Entity row)
        {
            var single = new RemoteExecutionContext { MessageName = message, PrimaryEntityName = row.LogicalName, PrimaryEntityId = row.Id, IsInTransaction = true, ParentContext = Context };
            new ProtectLeaveWrites().Execute(new GuardServices(single));
            // Dataverse merges single and bulk Create/Update pipelines, even
            // when the application calls the single-record SDK operation.
            if (message == "Create" || message == "Update") {
                var bulk = new RemoteExecutionContext { MessageName = message + "Multiple", PrimaryEntityName = row.LogicalName, IsInTransaction = true, ParentContext = single };
                bulk.InputParameters["Targets"] = new EntityCollection(new List<Entity> { row });
                new ProtectLeaveWrites().Execute(new GuardServices(bulk));
            }
        }
        public readonly List<Entity> Rows = new List<Entity>();
        public readonly Guid User = Guid.NewGuid(), Employee = Guid.NewGuid();
        public bool IsAdmin = true, FailDelete;
        public readonly RemoteExecutionContext Context;
        public Fake()
        {
            Context = new RemoteExecutionContext { MessageName = "a365_LeaveCommand", IsInTransaction = true, InitiatingUserId = User };
            var today = DateTime.UtcNow.AddHours(8).Date;
            var employee = new Entity("a365_employee", Employee);
            employee["a365_name"] = "Synthetic employee"; employee["a365_datehired"] = today.AddYears(-2);
            employee["a365_employmentstatus"] = new OptionSetValue(749910000); Rows.Add(employee);
            var policy = new Entity("a365_leavepolicy", Guid.NewGuid()); policy["a365_name"] = "active";
            policy["a365_policyjson"] = Json.Serialize(new Policy { version = "2026-10-22.1", holidays = new Holiday[0],
                calendars = Enumerable.Range(today.Year - 1, 3).Select(year => new Coverage { year = year, complete = true }).ToArray() });
            Rows.Add(policy);
        }
        public object GetService(Type type) { return type == typeof(IPluginExecutionContext) ? (object)Context : type == typeof(IOrganizationServiceFactory) ? this : null; }
        public IOrganizationService CreateOrganizationService(Guid? id) { return this; }
        public EntityCollection RetrieveMultiple(QueryBase input)
        {
            var query = (QueryExpression)input;
            if (query.EntityName == "role") return new EntityCollection(IsAdmin ? new List<Entity> { new Entity("role", Guid.NewGuid()) } : new List<Entity>());
            IEnumerable<Entity> rows = Rows.Where(row => row.LogicalName == query.EntityName);
            foreach (var condition in query.Criteria.Conditions)
                rows = rows.Where(row => {
                    object value = condition.AttributeName == row.LogicalName + "id" ? (object)row.Id : row.Contains(condition.AttributeName) ? row[condition.AttributeName] : null;
                    if (value is EntityReference) value = ((EntityReference)value).Id;
                    if (value is OptionSetValue) value = ((OptionSetValue)value).Value;
                    if (condition.Operator == ConditionOperator.Equal) return Object.Equals(value, condition.Values[0]);
                    if (condition.Operator == ConditionOperator.OnOrBefore) return value != null && (DateTime)value <= (DateTime)condition.Values[0];
                    if (condition.Operator == ConditionOperator.OnOrAfter) return value != null && (DateTime)value >= (DateTime)condition.Values[0];
                    throw new Exception("Unexpected condition");
                });
            return new EntityCollection(rows.Take(query.TopCount ?? 5000).ToList());
        }
        public Entity Retrieve(string table, Guid id, ColumnSet columns) { return Rows.Single(row => row.LogicalName == table && row.Id == id); }
        public Guid Create(Entity row) { GuardMutation("Create", row); if (row.Id == Guid.Empty) row.Id = Guid.NewGuid(); Rows.Add(row); return row.Id; }
        public void Update(Entity row) { GuardMutation("Update", row); var saved = Retrieve(row.LogicalName, row.Id, null); foreach (var field in row.Attributes) saved[field.Key] = field.Value; }
        public void Delete(string table, Guid id)
        {
            if (table != "a365_leave") throw new Exception("Unexpected delete");
            GuardMutation("Delete", new Entity(table, id));
            if (FailDelete) throw new InvalidPluginExecutionException("Synthetic delete failure");
            if (Rows.Any(row => row.LogicalName == "a365_leavecredittransaction" && row.GetAttributeValue<EntityReference>("a365_leave") != null && row.GetAttributeValue<EntityReference>("a365_leave").Id == id)) throw new Exception("Leave relationship still restricts deletion");
            Rows.RemoveAll(row => row.LogicalName == table && row.Id == id);
        }
        public OrganizationResponse Execute(OrganizationRequest request) { throw new Exception("Unexpected action"); }
        public void Associate(string table, Guid id, Relationship r, EntityReferenceCollection e) { throw new Exception("Unexpected associate"); }
        public void Disassociate(string table, Guid id, Relationship r, EntityReferenceCollection e) { throw new Exception("Unexpected disassociate"); }
        public Dictionary<string, object> Send(Request request)
        {
            Context.InputParameters["Request"] = Json.Serialize(request);
            var before = Rows.Select(row => { var copy = new Entity(row.LogicalName, row.Id); foreach (var field in row.Attributes) copy[field.Key] = field.Value; return copy; }).ToList();
            try { new LeaveCommand().Execute(this); }
            catch { Rows.Clear(); Rows.AddRange(before); throw; }
            return Json.Deserialize<Dictionary<string, object>>((string)Context.OutputParameters["Response"]);
        }
    }
    private static Request Prepare(Fake fake, int type, int requested)
    {
        var today = DateTime.UtcNow.AddHours(8).Date;
        // A full Monday-Friday week inside the active credit period, independent
        // of the machine's current weekday. Test policy has no holidays.
        var start = Rules.Period(today);
        while (start.DayOfWeek != DayOfWeek.Monday) start = start.AddDays(1);
        var request = new Request { command = "preview", employeeId = fake.Employee.ToString("D"), operationId = Guid.NewGuid().ToString("D"),
            leaveType = type, benefit = requested, startDate = Rules.Iso(start), endDate = Rules.Iso(start.AddDays(4)), allocationVersion = 1, note = "Synthetic" };
        var preview = fake.Send(request);
        int pool = type == 749910001 ? 749910001 : 749910000;
        decimal balance = Convert.ToDecimal(preview[pool == 749910000 ? "VL" : "SL"]);
        var adjustment = new Entity("a365_leavecredittransaction", Guid.NewGuid());
        adjustment["a365_employee"] = new EntityReference("a365_employee", fake.Employee);
        adjustment["a365_creditperiod"] = Rules.Iso(Rules.Period(today)); adjustment["a365_creditpool"] = new OptionSetValue(pool);
        adjustment["a365_days"] = 4m - balance; fake.Rows.Add(adjustment);
        preview = fake.Send(request);
        Check(Convert.ToDecimal(preview["paidDays"]) == (requested == 749910000 ? 4m : 0m), "preview paid count");
        request.command = "issue"; request.expectedPaidDays = requested == 749910000 ? 4m : 0m; request.expectedUnpaidDays = 5m - request.expectedPaidDays;
        return request;
    }
    public static int Run()
    {
        foreach (int type in new[] { 749910000, 749910001, 749910002 })
        {
            var fake = new Fake(); var request = Prepare(fake, type, 749910000);
            var result = fake.Send(request);
            var source = fake.Rows.Single(row => row.LogicalName == "a365_leave");
            Check(fake.Rows.Count(row => row.LogicalName == "a365_leave") == 1, "one source record");
            Check(source.GetAttributeValue<OptionSetValue>("a365_leavestatus").Value == 749910000, "Issued status unchanged");
            Check(Convert.ToInt32(result["a365_benefit"]) == 749910002, "Partially Paid benefit");
            Check(source.GetAttributeValue<decimal>("a365_paiddays") == 4m && source.GetAttributeValue<decimal>("a365_unpaiddays") == 1m, "stored split counts");
            var allocation = Json.Deserialize<LeaveAllocation>(source.GetAttributeValue<string>("a365_allocationjson"));
            Check(allocation.days.Length == 5 && allocation.days[4].unpaidDays == 1m, "stored dated allocation");
            var debit = fake.Rows.Single(row => row.LogicalName == "a365_leavecredittransaction" && row.Contains("a365_leave"));
            Check(debit.GetAttributeValue<decimal>("a365_days") == -4m, "only paid credits debited");
            Check(debit.GetAttributeValue<OptionSetValue>("a365_creditpool").Value == (type == 749910001 ? 749910001 : 749910000), "correct credit pool");
            var count = fake.Rows.Count;
            fake.Send(request);
            Check(fake.Rows.Count == count, "retry creates no source or credit duplicates");
            request.expectedPaidDays = 0m; request.expectedUnpaidDays = 5m;
            var retry = fake.Send(request);
            Check(Convert.ToDecimal(retry["a365_paiddays"]) == 4m, "retry preserves original snapshot");
        }
        var unpaidFake = new Fake(); var unpaidRequest = Prepare(unpaidFake, 749910000, 749910001); unpaidFake.Send(unpaidRequest);
        Check(!unpaidFake.Rows.Any(row => row.LogicalName == "a365_leavecredittransaction" && row.Contains("a365_leave")), "explicit unpaid creates no debit");
        var changedFake = new Fake(); var changedRequest = Prepare(changedFake, 749910000, 749910000);
        changedRequest.expectedPaidDays = 5m; changedRequest.expectedUnpaidDays = 0m;
        bool rejected = false; try { changedFake.Send(changedRequest); } catch (InvalidPluginExecutionException) { rejected = true; }
        Check(rejected && !changedFake.Rows.Any(row => row.LogicalName == "a365_leave"), "changed preview cannot save leave");
        changedRequest.allocationVersion = 0; rejected = false;
        try { changedFake.Send(changedRequest); } catch (InvalidPluginExecutionException) { rejected = true; }
        Check(rejected, "old client cannot issue an unreviewed allocation");
        return checks;
    }
    public static int RunDeletion()
    {
        foreach (int type in new[] { 749910000, 749910001, 749910002 })
        {
            var fake = new Fake(); var issue = Prepare(fake, type, 749910000); fake.Send(issue);
            var source = fake.Rows.Single(row => row.LogicalName == "a365_leave");
            var debit = fake.Rows.Single(row => row.LogicalName == "a365_leavecredittransaction" && row.GetAttributeValue<EntityReference>("a365_leave") != null);
            var query = new Request { command = "deletePreview", employeeId = issue.employeeId, operationId = issue.operationId };
            int before = fake.Rows.Count;
            Check(Convert.ToDecimal(fake.Send(query)["restoredDays"]) == 4m && fake.Rows.Count == before, "read-only deletion impact");
            query.command = "delete"; query.expectedRestoredDays = 4m;
            var deleted = fake.Send(query);
            Check((bool)deleted["deleted"] && !fake.Rows.Any(row => row.LogicalName == "a365_leave"), "physical leave deletion");
            Check(debit.GetAttributeValue<decimal>("a365_days") == -4m && debit.GetAttributeValue<EntityReference>("a365_leave") == null, "preserve original debit and detach source");
            var receipt = fake.Rows.Single(row => row.GetAttributeValue<string>("a365_transactionkey") == "LEAVE-" + issue.operationId + "-DELETE");
            Check(receipt.GetAttributeValue<decimal>("a365_days") == 4m && receipt.GetAttributeValue<OptionSetValue>("a365_creditpool").Value == (type == 749910001 ? 749910001 : 749910000), "restore paid portion to correct pool");
            Check(receipt.GetAttributeValue<string>("a365_creditperiod") == debit.GetAttributeValue<string>("a365_creditperiod") && receipt.GetAttributeValue<int>("a365_year") == debit.GetAttributeValue<int>("a365_year"), "restore original period/year");
            var audit = Json.Deserialize<Dictionary<string, object>>(receipt.GetAttributeValue<string>("a365_note"));
            Check((string)audit["recordId"] == source.Id.ToString("D") && (string)audit["deletedBy"] == fake.User.ToString("D") && Convert.ToDecimal(audit["paidDays"]) == 4m && Convert.ToDecimal(audit["unpaidDays"]) == 1m, "preserve financial snapshot and actor");
            before = fake.Rows.Count; fake.Send(query);
            Check(fake.Rows.Count == before, "retry does not duplicate restoration/audit");
        }
        foreach (bool legacy in new[] { false, true })
        {
            var fake = new Fake(); var issue = Prepare(fake, 749910000, 749910001); fake.Send(issue);
            var source = fake.Rows.Single(row => row.LogicalName == "a365_leave");
            if (legacy) { source.Attributes.Remove("a365_paiddays"); source.Attributes.Remove("a365_unpaiddays"); source.Attributes.Remove("a365_allocationjson"); }
            var request = new Request { command = "delete", employeeId = issue.employeeId, operationId = issue.operationId, expectedRestoredDays = 0m };
            fake.Send(request);
            Check(!fake.Rows.Any(row => row.LogicalName == "a365_leave"), "unpaid source removed");
            Check(fake.Rows.Where(row => row.GetAttributeValue<string>("a365_transactionkey") == "LEAVE-" + issue.operationId + "-DELETE").Single().GetAttributeValue<decimal>("a365_days") == 0m, "unpaid deletion audits without granting credits");
        }
        foreach (decimal available in new[] { 5m, 2.37m })
        {
            var fake = new Fake(); var issue = Prepare(fake, 749910000, 749910000);
            var adjustment = fake.Rows.Single(row => row.LogicalName == "a365_leavecredittransaction" && !row.Contains("a365_transactionkey"));
            adjustment["a365_days"] = adjustment.GetAttributeValue<decimal>("a365_days") + available - 4m;
            issue.expectedPaidDays = available; issue.expectedUnpaidDays = 5m - available; fake.Send(issue);
            var request = new Request { command = "delete", employeeId = issue.employeeId, operationId = issue.operationId, expectedRestoredDays = available };
            Check(Convert.ToDecimal(fake.Send(request)["restoredDays"]) == available, "full/fractional paid credits restored exactly");
            var receipt = fake.Rows.Single(row => row.GetAttributeValue<string>("a365_transactionkey") == "LEAVE-" + issue.operationId + "-DELETE");
            var audit = Json.Deserialize<Dictionary<string, object>>(receipt.GetAttributeValue<string>("a365_note"));
            Check(Convert.ToDecimal(audit["paidDays"]) == available && audit["workdayGaps"] != null, "fractional financial allocation retained in receipt");
        }
        var restoredFake = new Fake(); var restoredIssue = Prepare(restoredFake, 749910000, 749910000); restoredFake.Send(restoredIssue);
        var originalDebit = restoredFake.Rows.Single(row => row.GetAttributeValue<EntityReference>("a365_leave") != null);
        var priorRestoration = new Entity("a365_leavecredittransaction", Guid.NewGuid());
        foreach (var field in originalDebit.Attributes) priorRestoration[field.Key] = field.Value;
        priorRestoration["a365_days"] = 4m; priorRestoration["a365_transactiontype"] = new OptionSetValue(749910003); priorRestoration["a365_transactionkey"] = "prior-restoration";
        restoredFake.Rows.Add(priorRestoration);
        restoredFake.Rows.Single(row => row.LogicalName == "a365_leave")["a365_leavestatus"] = new OptionSetValue(749910001);
        var restoredRequest = new Request { command = "delete", employeeId = restoredIssue.employeeId, operationId = restoredIssue.operationId, expectedRestoredDays = 0m };
        Check(Convert.ToDecimal(restoredFake.Send(restoredRequest)["restoredDays"]) == 0m, "already-restored cancellation does not restore twice");
        var failureFake = new Fake(); var failureIssue = Prepare(failureFake, 749910000, 749910000); failureFake.Send(failureIssue);
        var failureRequest = new Request { command = "delete", employeeId = failureIssue.employeeId, operationId = failureIssue.operationId, expectedRestoredDays = 4m };
        failureFake.FailDelete = true;
        int oldCount = failureFake.Rows.Count; bool rejected = false;
        try { failureFake.Send(failureRequest); } catch (InvalidPluginExecutionException) { rejected = true; }
        Check(rejected && failureFake.Rows.Count == oldCount && failureFake.Rows.Any(row => row.GetAttributeValue<EntityReference>("a365_leave") != null), "transaction rollback retains source/links and removes restoration on delete failure");
        failureFake.FailDelete = false; failureRequest.expectedRestoredDays = 5m; rejected = false;
        try { failureFake.Send(failureRequest); } catch (InvalidPluginExecutionException) { rejected = true; }
        Check(rejected && failureFake.Rows.Count == oldCount, "changed impact blocks deletion");
        failureFake.IsAdmin = false; failureRequest.expectedRestoredDays = 4m; rejected = false;
        try { failureFake.Send(failureRequest); } catch (InvalidPluginExecutionException) { rejected = true; }
        Check(rejected && failureFake.Rows.Count == oldCount, "employee cannot delete or restore credits");
        failureFake.IsAdmin = true; failureRequest.employeeId = Guid.NewGuid().ToString("D"); rejected = false;
        try { failureFake.Send(failureRequest); } catch (InvalidPluginExecutionException) { rejected = true; }
        Check(rejected && failureFake.Rows.Count == oldCount, "spoofed employee cannot restore another employee's credits");
        failureRequest.employeeId = failureIssue.employeeId;
        var damaged = failureFake.Rows.Single(row => row.GetAttributeValue<EntityReference>("a365_leave") != null);
        damaged["a365_days"] = -3m; rejected = false;
        try { failureFake.Send(failureRequest); } catch (InvalidPluginExecutionException) { rejected = true; }
        Check(rejected && failureFake.Rows.Count == oldCount, "inconsistent deduction blocks deletion rather than inventing credits");
        return checks;
    }
}
