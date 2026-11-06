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
    public static int RunAnnualAllocation()
    {
        checks = 0;
        var ensure = typeof(LeaveCommand).GetMethod("EnsureCredits", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        foreach (var year in new[] { 2027, 2028 })
        {
            var rows = new List<Entity>();
            var employee = Guid.NewGuid();
            var period = new DateTime(year, 1, 1);
            var dates = new[] { period, period.AddMonths(1).AddDays(-1), period.AddMonths(1), period.AddMonths(2), period.AddMonths(6), period.AddMonths(12).AddDays(-1), period.AddMonths(12) };
            var expectedVL = new[] { 0m, 0m, 0.83m, 1.67m, 5m, 9.17m, 10m };
            for (int index = 0; index < dates.Length; index++)
            {
                ensure.Invoke(null, new object[] { null, rows, employee, new DateTime(2020, 1, 1), period, dates[index], false });
                Check(rows.Where(row => row.GetAttributeValue<OptionSetValue>("a365_creditpool").Value == 749910000).Sum(row => row.GetAttributeValue<decimal>("a365_days")) == expectedVL[index], "VL accrues only after completed months with exact annual rounding");
                Check(rows.Where(row => row.GetAttributeValue<OptionSetValue>("a365_creditpool").Value == 749910001).Sum(row => row.GetAttributeValue<decimal>("a365_days")) == 5m, "Annual SL remains five days");
                Check(rows.All(row => row.GetAttributeValue<string>("a365_creditperiod") == year + "-01-01"), "Credits stay in their earned cycle without carryover");
                int count = rows.Count;
                ensure.Invoke(null, new object[] { null, rows, employee, new DateTime(2020, 1, 1), period, dates[index], false });
                Check(rows.Count == count, "Repeated previews cannot duplicate credits");
            }
            var newHire = new List<Entity>();
            ensure.Invoke(null, new object[] { null, newHire, employee, period.AddDays(14), period, period.AddMonths(2), false });
            Check(newHire.Where(row => row.GetAttributeValue<OptionSetValue>("a365_creditpool").Value == 749910000).Sum(row => row.GetAttributeValue<decimal>("a365_days")) == 0.83m, "Mid-January hire earns February credit on March 1 only");
        }
        var legacy = new List<Entity>();
        ensure.Invoke(null, new object[] { null, legacy, Guid.NewGuid(), new DateTime(2020, 1, 1), new DateTime(2026, 4, 1), new DateTime(2026, 12, 31), false });
        Check(legacy.Where(row => row.GetAttributeValue<OptionSetValue>("a365_creditpool").Value == 749910000).Sum(row => row.GetAttributeValue<decimal>("a365_days")) == 6.67m, "2026 monthly VL accrual is preserved");
        return checks;
    }
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    public static int RunEmployeeSync()
    {
        checks = 0;
        var today = DateTime.UtcNow.AddHours(8).Date;
        decimal earned = Decimal.Round(10m * (today.Month - 1) / 12m, 2, MidpointRounding.AwayFromZero);
        var fake = new Fake();
        var employee = fake.Rows.Single(row => row.LogicalName == "a365_employee");
        employee["a365_datehired"] = today.AddYears(-1); employee["a365_basicmonthlysalary"] = new Money(22000m);
        var header = new Entity("a365_leaveconversionyear", Guid.NewGuid());
        header["a365_year"] = today.Year; header["a365_name"] = "Sync test"; header["versionnumber"] = 1L; header["statecode"] = new OptionSetValue(0); fake.Rows.Add(header);
        var request = new Request { command = "syncEmployee", employeeId = fake.Employee.ToString("D"), year = today.Year };
        var result = fake.Send(request);
        Check(Convert.ToDecimal(result["VL"]) == earned, "Backdated hire receives completed current-year months");
        Check(Convert.ToDecimal(result["SL"]) == 5m && (bool)result["conversionAdded"], "Sync initializes SL and conversion row");
        var detail = fake.Rows.Single(row => row.LogicalName == "a365_leavecashconversion");
        Check(detail.GetAttributeValue<Money>("a365_dailyrateused").Value == 1000m, "Conversion snapshots salary-derived rate");
        detail["a365_availablevl"] = 2m; detail["a365_days"] = 1m;
        int count = fake.Rows.Count; result = fake.Send(request);
        Check(fake.Rows.Count == count && !(bool)result["conversionAdded"], "Retry cannot duplicate credits or rows");
        Check(detail.GetAttributeValue<decimal>("a365_days") == 1m, "Sync preserves manual limits");
        var deduction = new Entity("a365_leavecredittransaction", Guid.NewGuid());
        deduction["a365_employee"] = employee.ToEntityReference(); deduction["a365_creditperiod"] = Rules.Iso(Rules.Period(today));
        deduction["a365_year"] = today.Year; deduction["a365_creditpool"] = new OptionSetValue(749910000); deduction["a365_days"] = -0.5m; fake.Rows.Add(deduction);
        result = fake.Send(request);
        Check(Convert.ToDecimal(result["VL"]) == earned - 0.5m, "Sync preserves deductions instead of resetting");
        Check(!fake.Rows.Any(row => row.LogicalName == "a365_leave"), "No dummy leave or email");
        fake.IsAdmin = false; count = fake.Rows.Count; bool rejected = false;
        try { fake.Send(request); } catch { rejected = true; }
        Check(rejected && fake.Rows.Count == count, "Non-admin cannot sync"); fake.IsAdmin = true;
        request.year--; rejected = false; try { fake.Send(request); } catch { rejected = true; }
        Check(rejected, "Historical writes rejected"); request.year++;
        var noHeader = new Fake();
        result = noHeader.Send(new Request { command = "syncEmployee", employeeId = noHeader.Employee.ToString("D"), year = today.Year });
        Check(!(bool)result["conversionAdded"] && !noHeader.Rows.Any(row => row.LogicalName == "a365_leaveconversionyear"), "No unsolicited conversion year");
        var paid = new Fake();
        var paidHeader = new Entity("a365_leaveconversionyear", Guid.NewGuid()); paidHeader["a365_year"] = today.Year; paidHeader["statecode"] = new OptionSetValue(1); paid.Rows.Add(paidHeader);
        result = paid.Send(new Request { command = "syncEmployee", employeeId = paid.Employee.ToString("D"), year = today.Year });
        Check(!(bool)result["conversionAdded"] && !paid.Rows.Any(row => row.LogicalName == "a365_leavecashconversion"), "Paid roster remains frozen");
        var failed = new Fake();
        var failedHeader = new Entity("a365_leaveconversionyear", Guid.NewGuid()); failedHeader["a365_year"] = today.Year; failedHeader["versionnumber"] = 1L; failedHeader["statecode"] = new OptionSetValue(0); failed.Rows.Add(failedHeader);
        // Missing salary fails conversion setup after the grants have been planned/posted.
        count = failed.Rows.Count; rejected = false;
        var failedRequest = new Request { command = "syncEmployee", employeeId = failed.Employee.ToString("D"), year = today.Year };
        try { failed.Send(failedRequest); } catch { rejected = true; }
        Check(rejected && failed.Rows.Count == count, "Conversion failure rolls back credits and locks");
        failed.Rows.Single(row => row.LogicalName == "a365_employee")["a365_basicmonthlysalary"] = new Money(22000m);
        failed.Send(failedRequest);
        Check(failed.Rows.Count(row => row.LogicalName == "a365_leavecashconversion") == 1, "Failed setup is retryable");
        foreach (var mode in new[] { "future", "inactive", "ended", "legacy", "missing-hire" })
        {
            var invalid = new Fake(); var person = invalid.Rows.Single(row => row.LogicalName == "a365_employee");
            if (mode == "future") person["a365_datehired"] = today.AddDays(1);
            if (mode == "inactive") person["a365_employmentstatus"] = new OptionSetValue(749910001);
            if (mode == "ended") person["a365_enddate"] = today.AddDays(-1);
            if (mode == "missing-hire") person.Attributes.Remove("a365_datehired");
            if (mode == "legacy") {
                var old = new Entity("a365_leavecredittransaction", Guid.NewGuid()); old["a365_employee"] = person.ToEntityReference(); old["a365_year"] = today.Year;
                old["a365_creditperiod"] = (today.Year - 1) + "-04-01"; invalid.Rows.Add(old);
            }
            rejected = false;
            try { result = invalid.Send(new Request { command = "syncEmployee", employeeId = invalid.Employee.ToString("D"), year = today.Year }); } catch { rejected = true; }
            Check(mode == "legacy" || mode == "missing-hire" ? rejected : !(bool)result["eligible"], "Eligibility/history: " + mode);
            Check(!invalid.Rows.Any(row => row.LogicalName == "a365_leavecredittransaction" && row.Contains("a365_transactionkey")), "Invalid sync posts no grants: " + mode);
        }
        return checks;
    }
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
        public bool IsAdmin = true, FailDelete, PageEmployees, FailConversion;
        public Guid FailResetEmployee;
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
            if (PageEmployees && query.EntityName == "a365_employee") { var all = rows.OrderBy(row => row.Id).ToList(); int page = query.PageInfo.PageNumber; return new EntityCollection(all.Skip(page - 1).Take(1).ToList()) { MoreRecords = all.Count > page, PagingCookie = "page-" + page }; }
            return new EntityCollection(rows.Take(query.TopCount ?? 5000).ToList());
        }
        public Entity Retrieve(string table, Guid id, ColumnSet columns) { return Rows.Single(row => row.LogicalName == table && row.Id == id); }
        public Guid Create(Entity row) { if (row.LogicalName == "a365_leavecredittransaction" && row.GetAttributeValue<EntityReference>("a365_employee") != null && row.GetAttributeValue<EntityReference>("a365_employee").Id == FailResetEmployee) throw new InvalidPluginExecutionException("Synthetic reset write failure"); GuardMutation("Create", row); if (row.Id == Guid.Empty) row.Id = Guid.NewGuid(); Rows.Add(row); return row.Id; }
        public void Update(Entity row) { GuardMutation("Update", row); if (FailConversion && row.LogicalName == "a365_leavecashconversion") throw new InvalidPluginExecutionException("Synthetic conversion reset failure"); var saved = Retrieve(row.LogicalName, row.Id, null); foreach (var field in row.Attributes) saved[field.Key] = field.Value; if (row.LogicalName == "a365_leaveconversionyear") saved["versionnumber"] = saved.GetAttributeValue<long>("versionnumber") + 1; }
        public void Delete(string table, Guid id)
        {
            if (table != "a365_leave") throw new Exception("Unexpected delete");
            GuardMutation("Delete", new Entity(table, id));
            if (FailDelete) throw new InvalidPluginExecutionException("Synthetic delete failure");
            if (Rows.Any(row => row.LogicalName == "a365_leavecredittransaction" && row.GetAttributeValue<EntityReference>("a365_leave") != null && row.GetAttributeValue<EntityReference>("a365_leave").Id == id)) throw new Exception("Leave relationship still restricts deletion");
            Rows.RemoveAll(row => row.LogicalName == table && row.Id == id);
        }
        public OrganizationResponse Execute(OrganizationRequest request) { var update = request as Microsoft.Xrm.Sdk.Messages.UpdateRequest; if (update == null) throw new Exception("Unexpected action"); var current = Retrieve(update.Target.LogicalName, update.Target.Id, null); if (update.Target.RowVersion != current.GetAttributeValue<long>("versionnumber").ToString()) throw new InvalidPluginExecutionException("Synthetic concurrent header change"); Update(update.Target); return new Microsoft.Xrm.Sdk.Messages.UpdateResponse(); }
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
        foreach (int halfType in new[] { 749910000, 749910001, 749910002 })
        foreach (int halfBenefit in new[] { 749910000, 749910001 })
        foreach (decimal balance in new[] { 4m, 0.25m, 0m })
        {
            int halfPool = halfType == 749910001 ? 749910001 : 749910000;
            var halfFake = new Fake(); var halfRequest = Prepare(halfFake, halfType, halfBenefit);
            var adjustment = new Entity("a365_leavecredittransaction", Guid.NewGuid());
            adjustment["a365_employee"] = new EntityReference("a365_employee", halfFake.Employee);
            adjustment["a365_creditperiod"] = Rules.Iso(Rules.Period(DateTime.UtcNow.AddHours(8).Date));
            adjustment["a365_creditpool"] = new OptionSetValue(halfPool); adjustment["a365_days"] = balance - 4m;
            halfFake.Rows.Add(adjustment);
            halfRequest.command = "preview"; halfRequest.halfDay = true; halfRequest.endDate = halfRequest.startDate;
            var halfPreview = halfFake.Send(halfRequest);
            decimal paid = halfBenefit == 749910000 ? Math.Min(balance, 0.5m) : 0m;
            Check(Convert.ToDecimal(halfPreview["days"]) == 0.5m && Convert.ToDecimal(halfPreview["paidDays"]) == paid, "half-day preview");
            halfRequest.command = "issue"; halfRequest.expectedPaidDays = paid; halfRequest.expectedUnpaidDays = 0.5m - paid;
            halfFake.Send(halfRequest);
            var halfSource = halfFake.Rows.Single(row => row.LogicalName == "a365_leave");
            Check(halfSource.GetAttributeValue<decimal>("a365_days") == 0.5m && halfSource.GetAttributeValue<decimal>("a365_unpaiddays") == 0.5m - paid, "half-day stored snapshot");
            var debits = halfFake.Rows.Where(row => row.LogicalName == "a365_leavecredittransaction" && row.Contains("a365_leave")).ToList();
            Check(paid == 0 ? debits.Count == 0 : debits.Count == 1 && debits[0].GetAttributeValue<decimal>("a365_days") == -paid && debits[0].GetAttributeValue<OptionSetValue>("a365_creditpool").Value == halfPool, "half-day exact deduction from correct pool");
            int count = halfFake.Rows.Count; halfFake.Send(halfRequest); Check(halfFake.Rows.Count == count, "half-day retry is idempotent");
            halfRequest.halfDay = false;
            bool mismatch = false; try { halfFake.Send(halfRequest); } catch (InvalidPluginExecutionException) { mismatch = true; }
            Check(mismatch, "retry cannot change half-day duration");
            halfRequest.halfDay = true; halfRequest.command = "preview";
            halfRequest.endDate = Rules.Iso(Rules.Day(halfRequest.startDate).AddDays(1));
            bool multiple = false; try { halfFake.Send(halfRequest); } catch (InvalidPluginExecutionException) { multiple = true; }
            Check(multiple, "half-day cannot span dates");
        }
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

    private static Entity ResetCredit(Fake fake, Guid employee, int pool, decimal days, DateTime period, int year)
    {
        var row = new Entity("a365_leavecredittransaction", Guid.NewGuid());
        row["a365_employee"] = new EntityReference("a365_employee", employee);
        row["a365_creditpool"] = new OptionSetValue(pool); row["a365_days"] = days;
        row["a365_creditperiod"] = Rules.Iso(period); row["a365_year"] = year;
        row["a365_transactionkey"] = Guid.NewGuid().ToString("D");
        row["a365_transactiontype"] = new OptionSetValue(days < 0 ? 749910002 : 749910001);
        fake.Rows.Add(row); return row;
    }
    private static Request ResetRequest(Fake fake)
    {
        var preview = fake.Send(new Request { command = "resetPreview" });
        return new Request { command = "resetBalances", operationId = Guid.NewGuid().ToString("D"), year = Convert.ToInt32(preview["year"]), version = (string)preview["version"] };
    }
    public static int RunReset()
    {
        checks = 0; var fake = new Fake(); var today = DateTime.UtcNow.AddHours(8).Date; var period = Rules.Period(today);
        var old = ResetCredit(fake, fake.Employee, 749910000, -3m, period, today.Year);
        ResetCredit(fake, fake.Employee, 749910001, -2m, period, today.Year);
        // Earlier portion of this calendar year must not inflate displayed balances.
        if (period.Year == today.Year && period.Month > 1) ResetCredit(fake, fake.Employee, 749910000, 2m, period.AddYears(-1), today.Year);
        var inactive = new Entity("a365_employee", Guid.NewGuid()); inactive["a365_employmentstatus"] = new OptionSetValue(749910001); fake.Rows.Add(inactive);
        var onLeave = new Entity("a365_employee", Guid.NewGuid()); onLeave["a365_employmentstatus"] = new OptionSetValue(749910002); fake.Rows.Add(onLeave);
        var before = fake.Rows.Count; var request = ResetRequest(fake);
        Check(fake.Rows.Count == before, "Reset preview must not write grants, locks or credits");
        var result = fake.Send(request);
        Check(Convert.ToInt32(result["employeeCount"]) == 1, "Reset only Active employment status");
        foreach (int pool in new[] { 749910000, 749910001 }) {
            var rows = fake.Rows.Where(row => row.LogicalName == "a365_leavecredittransaction" && row.GetAttributeValue<EntityReference>("a365_employee").Id == fake.Employee && row.GetAttributeValue<int>("a365_year") == today.Year && row.GetAttributeValue<OptionSetValue>("a365_creditpool").Value == pool);
            Check(rows.Sum(row => row.GetAttributeValue<decimal>("a365_days")) == (pool == 749910000 ? 10m : 5m), "Calendar-year remaining balance must equal target");
        }
        Check(old.GetAttributeValue<decimal>("a365_days") == -3m && fake.Rows.Any(row => row.Id == old.Id), "Reset preserves source ledger deductions");
        var projected = fake.Send(new Request { command = "preview", employeeId = fake.Employee.ToString("D") });
        Check(Convert.ToDecimal(projected["VL"]) == 10m && Convert.ToDecimal(projected["SL"]) == 5m, "Posting preview remains 10/5 after due credits materialized");
        ResetCredit(fake, fake.Employee, 749910000, -1m, period, today.Year);
        before = fake.Rows.Count; fake.Send(request);
        Check(fake.Rows.Count == before, "Same operation retry must not apply again after subsequent leave");
        var next = ResetRequest(fake); fake.Send(next);
        Check(fake.Rows.Count > before, "Fresh confirmation permits intentional later reset");
        var stale = ResetRequest(fake); ResetCredit(fake, fake.Employee, 749910000, -1m, period, today.Year);
        before = fake.Rows.Count; bool rejected = false; try { fake.Send(stale); } catch { rejected = true; }
        Check(rejected && fake.Rows.Count == before, "Changed reviewed balances abort without writes");
        fake.IsAdmin = false; rejected = false; try { fake.Send(new Request { command = "resetPreview" }); } catch { rejected = true; }
        Check(rejected, "Non-admin cannot preview reset");
        rejected = false; try { fake.Send(request); } catch { rejected = true; }
        Check(rejected, "Non-admin cannot retry completed reset");
        var bulk = new Fake(); bulk.PageEmployees = true;
        var second = new Entity("a365_employee", Guid.NewGuid()); second["a365_employmentstatus"] = new OptionSetValue(749910000); second["a365_datehired"] = today.AddYears(-2); bulk.Rows.Add(second);
        var bulkRequest = ResetRequest(bulk); before = bulk.Rows.Count;
        Check(bulk.Rows.Count == before, "Paged preview has no writes");
        bulk.FailResetEmployee = bulk.Rows.Where(row => row.LogicalName == "a365_employee").OrderBy(row => row.Id).Last().Id;
        rejected = false; try { bulk.Send(bulkRequest); } catch { rejected = true; }
        Check(rejected && bulk.Rows.Count == before, "Failure on later employee rolls back earlier reset writes and locks");
        bulk.FailResetEmployee = Guid.Empty; result = bulk.Send(bulkRequest);
        Check(Convert.ToInt32(result["employeeCount"]) == 2, "All employee pages are reset on retry");
        var empty = new Fake(); empty.Rows.RemoveAll(row => row.LogicalName == "a365_employee");
        Check(Convert.ToInt32(empty.Send(new Request { command = "resetPreview" })["employeeCount"]) == 0, "Empty employee scope is explicit");
        return checks;
    }

    public static int RunResetConversion()
    {
        checks = 0; var fake = new Fake(); int year = DateTime.UtcNow.AddHours(8).Year;
        var header = new Entity("a365_leaveconversionyear", Guid.NewGuid()); header["a365_year"] = year; header["a365_name"] = "Synthetic conversion"; header["versionnumber"] = 1L; header["statecode"] = new OptionSetValue(0); fake.Rows.Add(header);
        var row = new Entity("a365_leavecashconversion", Guid.NewGuid()); row["a365_employee"] = new EntityReference("a365_employee", fake.Employee); row["a365_conversionyear"] = header.ToEntityReference(); row["a365_year"] = year;
        row["a365_availablevl"] = 2m; row["a365_days"] = 1m; row["a365_dailyrateused"] = new Money(100m); row["a365_amount"] = new Money(100m); row["a365_conversionstatus"] = new OptionSetValue(749910000); fake.Rows.Add(row);
        var request = ResetRequest(fake); int before = fake.Rows.Count;
        fake.FailConversion = true; bool rejected = false; try { fake.Send(request); } catch { rejected = true; }
        Check(rejected && fake.Rows.Count == before, "Conversion failure rolls back the whole reset and receipt");
        row = fake.Rows.Single(r => r.Id == row.Id && r.LogicalName == row.LogicalName);
        Check(row.GetAttributeValue<decimal>("a365_availablevl") == 2m, "Failed reset preserves original conversion limits");
        fake.FailConversion = false; fake.Send(request);
        row = fake.Rows.Single(r => r.Id == row.Id && r.LogicalName == row.LogicalName);
        Check(row.GetAttributeValue<decimal>("a365_availablevl") == 10m && row.GetAttributeValue<decimal>("a365_days") == 5m && row.GetAttributeValue<Money>("a365_amount").Value == 500m, "Successful reset restores unpaid conversion 10/5 and saved-rate amount");
        Check(row.GetAttributeValue<Money>("a365_dailyrateused").Value == 100m, "Reset preserves daily rate snapshot");
        row["a365_availablevl"] = 3m; row["a365_days"] = 2m; row["a365_amount"] = new Money(200m);
        fake.Send(request);
        Check(row.GetAttributeValue<decimal>("a365_availablevl") == 3m, "Retry completed reset does not replace a later manual edit");
        header = fake.Rows.Single(r => r.LogicalName == "a365_leaveconversionyear"); header["statecode"] = new OptionSetValue(1);
        fake.Send(ResetRequest(fake));
        Check(row.GetAttributeValue<decimal>("a365_availablevl") == 3m && row.GetAttributeValue<decimal>("a365_days") == 2m, "Fresh reset cannot alter paid conversion snapshot");
        return checks;
    }
}
