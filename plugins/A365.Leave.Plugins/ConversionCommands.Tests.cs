using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using A365.Leave.Plugins;

public static class ConversionCommandsTests
{
    private const string Header = "a365_leaveconversionyear", Detail = "a365_leavecashconversion";
    private static readonly Guid Actor = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static int checks;
    private static void Check(bool value, string label) { if (!value) throw new Exception("Conversion regression: " + label); checks++; }
    private static Entity Copy(Entity row) { var result = new Entity(row.LogicalName, row.Id); foreach (var a in row.Attributes) result[a.Key] = a.Value; return result; }
    private sealed class Fake : IOrganizationService, IOrganizationServiceFactory, IServiceProvider
    {
        public readonly Dictionary<Guid, Entity> Store = new Dictionary<Guid, Entity>();
        public readonly List<string> Writes = new List<string>();
        public RemoteExecutionContext Context;
        public bool Admin = true, Conflict, FailDetail;
        private readonly Dictionary<Guid, Entity> Coordination = new Dictionary<Guid, Entity>();
        private long version = 1;
        public object GetService(Type type) { return type == typeof(IPluginExecutionContext) ? (object)Context : type == typeof(IOrganizationServiceFactory) ? this : null; }
        public IOrganizationService CreateOrganizationService(Guid? id) { return this; }
        public Guid Create(Entity row) {
            if (row.LogicalName == "a365_leavecoordination") { Coordination[row.Id] = Copy(row); return row.Id; }
            if (row.LogicalName != Header && row.LogicalName != Detail) throw new Exception("Unexpected financial write: " + row.LogicalName);
            if (FailDetail && row.LogicalName == Detail) throw new InvalidPluginExecutionException("Synthetic database failure");
            var result = Copy(row); if (result.Id == Guid.Empty) result.Id = Guid.NewGuid();
            if (Store.ContainsKey(result.Id)) throw new InvalidPluginExecutionException("Duplicate id");
            if (row.LogicalName == Header && Store.Values.Any(r => r.LogicalName == Header && (int)r["a365_year"] == (int)row["a365_year"])) throw new InvalidPluginExecutionException("Duplicate year");
            result["versionnumber"] = version++; Store[result.Id] = result; Writes.Add("Create:" + row.LogicalName); return result.Id;
        }
        public void Update(Entity row) {
            if (row.LogicalName == "a365_leavecoordination") { foreach (var a in row.Attributes) Coordination[row.Id][a.Key] = a.Value; return; }
            if (row.LogicalName != Header && row.LogicalName != Detail) throw new Exception("Unexpected write");
            var result = Store[row.Id]; foreach (var a in row.Attributes) result[a.Key] = a.Value;
            result["versionnumber"] = version++; Writes.Add("Update:" + row.LogicalName);
        }
        public OrganizationResponse Execute(OrganizationRequest value) {
            var update = value as UpdateRequest;
            Check(update != null && update.ConcurrencyBehavior == ConcurrencyBehavior.IfRowVersionMatches, "optimistic concurrency required");
            if (Conflict || update.Target.RowVersion != Store[update.Target.Id]["versionnumber"].ToString()) throw new InvalidPluginExecutionException("Concurrent transaction changed");
            Update(update.Target); return new UpdateResponse();
        }
        public Entity Retrieve(string table, Guid id, ColumnSet columns) { if (table == "a365_leavecoordination" && Coordination.ContainsKey(id)) return Copy(Coordination[id]); if (!Store.ContainsKey(id) || Store[id].LogicalName != table) throw new InvalidPluginExecutionException("Unavailable"); return Copy(Store[id]); }
        private static object Scalar(object value) { if (value is EntityReference) return ((EntityReference)value).Id; if (value is OptionSetValue) return ((OptionSetValue)value).Value; return value; }
        public EntityCollection RetrieveMultiple(QueryBase input) {
            var query = (QueryExpression)input;
            if (query.EntityName == "role") { var roles = new EntityCollection(); if (Admin) roles.Entities.Add(new Entity("role", Guid.NewGuid())); return roles; }
            IEnumerable<Entity> data = query.EntityName == "a365_leavecoordination" ? Coordination.Values : Store.Values.Where(r => r.LogicalName == query.EntityName);
            foreach (var condition in query.Criteria.Conditions) {
                var field = condition.AttributeName;
                data = data.Where(row => {
                    object value = field == row.LogicalName + "id" ? (object)row.Id : row.Contains(field) ? Scalar(row[field]) : null;
                    if (condition.Operator == ConditionOperator.Equal) return Object.Equals(value, condition.Values[0]);
                    if (condition.Operator == ConditionOperator.In) return condition.Values.Any(v => Object.Equals(value, v));
                    throw new Exception("Unexpected query operator");
                });
            }
            foreach (var order in query.Orders.Reverse()) {
                Func<Entity, object> key = row => order.AttributeName == row.LogicalName + "id" ? (object)row.Id : row.Contains(order.AttributeName) ? row[order.AttributeName] : null;
                data = order.OrderType == OrderType.Ascending ? data.OrderBy(key) : data.OrderByDescending(key);
            }
            if (query.TopCount.HasValue) data = data.Take(query.TopCount.Value);
            var result = new EntityCollection(); var list = data.ToList();
            int page = query.PageInfo == null || query.PageInfo.PageNumber == 0 ? 1 : query.PageInfo.PageNumber;
            int count = query.PageInfo == null || query.PageInfo.Count == 0 ? 5000 : query.PageInfo.Count;
            // Force the Active roster to span several pages.
            if (query.EntityName == "a365_employee" && query.Criteria.Conditions.Any(c => c.AttributeName == "a365_employmentstatus")) count = 2;
            foreach (var row in list.Skip((page - 1) * count).Take(count)) result.Entities.Add(Copy(row));
            result.MoreRecords = list.Count > page * count; result.PagingCookie = result.MoreRecords ? "page-" + page : null;
            return result;
        }
        public void Delete(string table, Guid id) { throw new Exception("Delete prohibited"); }
        public void Associate(string t, Guid id, Relationship r, EntityReferenceCollection e) { throw new Exception("Unexpected association"); }
        public void Disassociate(string t, Guid id, Relationship r, EntityReferenceCollection e) { throw new Exception("Unexpected disassociation"); }
    }
    private static Fake Seed() {
        var fake = new Fake();
        for (int i = 0; i < 4; i++) {
            var employee = new Entity("a365_employee", Guid.NewGuid()); employee["a365_name"] = "Synthetic " + i;
            employee["a365_employeenumber"] = "TEST-" + i; employee["a365_basicmonthlysalary"] = new Money(50000m);
            employee["a365_employmentstatus"] = new OptionSetValue(i == 3 ? 749910001 : 749910000); fake.Store[employee.Id] = employee;
        }
        return fake;
    }
    private static Dictionary<string, object> Run(Fake fake, object request) {
        fake.Context = new RemoteExecutionContext { MessageName = "a365_LeaveCommand", IsInTransaction = true, InitiatingUserId = Actor };
        var json = new JavaScriptSerializer(); fake.Context.InputParameters["Request"] = json.Serialize(request);
        new LeaveCommand().Execute(fake);
        return json.Deserialize<Dictionary<string, object>>((string)fake.Context.OutputParameters["Response"]);
    }
    private static void Reject(Fake fake, object request) { bool rejected = false; try { Run(fake, request); } catch (InvalidPluginExecutionException) { rejected = true; } Check(rejected, "invalid/unauthorized request rejected"); }
    public static int Run() {
        checks = 0;
        Check(ConversionCommands.Rate(50000m) == 2272.73m, "rounded daily rate");
        Check(ConversionCommands.Amount(2272.73m, 5m) == 11363.65m, "rounded payout");
        Check(ConversionCommands.Amount(863.64m, .83m) == 716.82m, "fractional payout");
        var fake = Seed(); int year = DateTime.UtcNow.AddHours(8).Year; var operation = Guid.NewGuid().ToString("D");
        var created = Run(fake, new { command = "conversionCreate", year = year, operationId = operation });
        Check((int)created["year"] == year, "current year when empty");
        var rows = fake.Store.Values.Where(r => r.LogicalName == Detail).ToArray();
        Check(rows.Length == 3, "complete paged Active roster only");
        Check(rows.All(r => (decimal)r["a365_availablevl"] == 10m && (decimal)r["a365_days"] == 5m), "all default days");
        Check(rows.All(r => ((Money)r["a365_amount"]).Value == 11363.65m), "persisted amount snapshot");
        int writes = fake.Writes.Count;
        Run(fake, new { command = "conversionCreate", year = year, operationId = operation }); Check(fake.Writes.Count == writes, "uncertain creation retry is no-op");
        Reject(fake, new { command = "conversionCreate", year = year, operationId = Guid.NewGuid().ToString("D") }); Check(fake.Writes.Count == writes, "duplicate year writes nothing");
        var years = Run(fake, new { command = "conversionYears" }); Check((int)years["nextYear"] == year + 1, "automatic next year");
        var row = rows[0]; var actor = row["a365_convertedby"]; var when = row["a365_convertedon"];
        var employeeId = ((EntityReference)row["a365_employee"]).Id.ToString("D");
        var change = new { id = row.Id.ToString("D"), employeeId = employeeId, availableVL = 4m, days = 3m };
        var saved = Run(fake, new { command = "conversionSave", year = year, operationId = operation, version = created["version"], changes = new[] { change } });
        Check((decimal)row["a365_days"] == 3m && ((Money)row["a365_amount"]).Value == 6818.19m, "saved edit and amount");
        Check(Object.ReferenceEquals(row["a365_convertedby"], actor) && Object.Equals(row["a365_convertedon"], when), "original actor and time preserved");
        fake.Store[((EntityReference)row["a365_employee"]).Id]["a365_basicmonthlysalary"] = new Money(99000m);
        writes = fake.Writes.Count;
        Run(fake, new { command = "conversionSave", year = year, operationId = operation, version = created["version"], changes = new[] { change } }); Check(fake.Writes.Count == writes, "uncertain save retry no duplicate writes");
        var invalid = new { id = row.Id.ToString("D"), employeeId = employeeId, availableVL = 4m, days = 5m };
        Reject(fake, new { command = "conversionSave", year = year, operationId = operation, version = saved["version"], changes = new[] { invalid } }); Check(fake.Writes.Count == writes, "invalid values rejected before writes");
        var zero = new { id = row.Id.ToString("D"), employeeId = employeeId, availableVL = 0m, days = 0m };
        Reject(fake, new { command = "conversionSave", year = year, operationId = operation, version = created["version"], changes = new[] { zero } }); Check(fake.Writes.Count == writes, "stale save does not overwrite");
        fake.Conflict = true;
        Reject(fake, new { command = "conversionSave", year = year, operationId = operation, version = saved["version"], changes = new[] { zero } }); Check(fake.Writes.Count == writes, "race after read does not write details");
        fake.Conflict = false;
        Run(fake, new { command = "conversionSave", year = year, operationId = operation, version = saved["version"], changes = new[] { zero } });
        Check((decimal)row["a365_days"] == 0 && ((Money)row["a365_amount"]).Value == 0, "zero-day save");
        Check(((Money)row["a365_dailyrateused"]).Value == 2272.73m, "salary changes do not recalculate stored rate");
        writes = fake.Writes.Count;
        string currentVersion = fake.Store[Guid.Parse(operation)]["versionnumber"].ToString();
        Reject(fake, new { command = "conversionSave", year = year, operationId = operation, version = currentVersion, changes = new[] { new { id = row.Id.ToString("D"), employeeId = employeeId } } });
        Check(fake.Writes.Count == writes, "omitted numeric values cannot become zero");
        var second = rows[1]; string secondEmployee = ((EntityReference)second["a365_employee"]).Id.ToString("D");
        Reject(fake, new { command = "conversionSave", year = year, operationId = operation, version = currentVersion, changes = new[] { change, new { id = second.Id.ToString("D"), employeeId = secondEmployee, availableVL = 0m, days = 1m } } });
        Check(fake.Writes.Count == writes, "invalid later row cannot partially save earlier valid rows");
        Reject(fake, new { command = "conversionSave", year = year, operationId = operation, version = currentVersion, changes = new[] { change, change } });
        Check(fake.Writes.Count == writes, "duplicate employee changes rejected before writes");
        fake.Store.Remove(second.Id);
        Run(fake, new { command = "conversionSave", year = year, operationId = operation, version = currentVersion, changes = new[] { new { id = second.Id.ToString("D"), employeeId = secondEmployee, availableVL = 2m, days = 1m } } });
        Check(fake.Store.ContainsKey(second.Id) && (decimal)fake.Store[second.Id]["a365_days"] == 1m, "missing row created once with stable identity");
        var missingSalary = Seed(); missingSalary.Store.Values.First().Attributes.Remove("a365_basicmonthlysalary");
        Reject(missingSalary, new { command = "conversionCreate", year = year, operationId = Guid.NewGuid().ToString("D") }); Check(missingSalary.Writes.Count == 0, "missing salary fails before first write");
        var denied = Seed(); denied.Admin = false;
        foreach (string command in new[] { "conversionCreate", "conversionSave", "conversionYears", "conversionRows", "conversionMarkPaid" }) Reject(denied, new { command = command, year = year });
        Check(denied.Writes.Count == 0, "employee cannot write through API");
        Check(fake.Writes.All(w => w.EndsWith(Header) || w.EndsWith(Detail)), "no ledger, Leave or Payroll writes");
        var fault = Seed(); fault.FailDetail = true;
        Reject(fault, new { command = "conversionCreate", year = year, operationId = Guid.NewGuid().ToString("D") });
        Check(fault.Context.OutputParameters.Count == 0, "database failure never returns success; platform rollback requires live test");
        var payment = Seed(); string paymentId = Guid.NewGuid().ToString("D");
        Run(payment, new { command = "conversionCreate", year = year, operationId = paymentId });
        var paymentHeader = payment.Store[Guid.Parse(paymentId)]; string paymentVersion = paymentHeader["versionnumber"].ToString();
        int paymentWrites = payment.Writes.Count;
        Reject(payment, new { command = "conversionMarkPaid", year = year, operationId = paymentId, version = "stale" });
        Check(payment.Writes.Count == paymentWrites, "stale payment cannot lock a changed transaction");
        payment.Conflict = true;
        Reject(payment, new { command = "conversionMarkPaid", year = year, operationId = paymentId, version = paymentVersion });
        Check(payment.Writes.Count == paymentWrites, "competing save/payment fails before writes");
        payment.Conflict = false;
        var paidResult = Run(payment, new { command = "conversionMarkPaid", year = year, operationId = paymentId, version = paymentVersion });
        Check((bool)paidResult["paid"] && ((OptionSetValue)paymentHeader["statecode"]).Value == 1 && ((OptionSetValue)paymentHeader["statuscode"]).Value == 2, "existing inactive state records paid lock");
        Check(payment.Writes.Count == paymentWrites + 4 && payment.Writes.Count(w => w == "Update:" + Detail) == 3, "mark paid freezes three effective employee snapshots and header");
        Run(payment, new { command = "conversionMarkPaid", year = year, operationId = paymentId, version = paymentVersion });
        Check(payment.Writes.Count == paymentWrites + 4, "uncertain payment retry is a no-op");
        Reject(payment, new { command = "conversionSave", year = year, operationId = paymentId, version = paymentHeader["versionnumber"].ToString(), changes = new[] { change } });
        Check(payment.Writes.Count == paymentWrites + 4, "paid year rejects all saves before writes");
        var paidPage = Run(payment, new { command = "conversionRows", year = year });
        Check((bool)((Dictionary<string, object>)paidPage["transaction"])["paid"], "reopening retains paid status");
        return checks;
    }

    private static void Credit(Fake fake, Guid employee, int year, decimal days, int pool)
    {
        var row = new Entity("a365_leavecredittransaction", Guid.NewGuid());
        row["a365_employee"] = new EntityReference("a365_employee", employee);
        row["a365_year"] = year; row["a365_creditpool"] = new OptionSetValue(pool); row["a365_days"] = days;
        fake.Store[row.Id] = row;
    }
    public static int RunBalanceSync()
    {
        checks = 0; var fake = Seed(); int year = DateTime.UtcNow.AddHours(8).Year;
        string operation = Guid.NewGuid().ToString("D");
        var created = Run(fake, new { command = "conversionCreate", operationId = operation, year = year });
        var rows = fake.Store.Values.Where(r => r.LogicalName == Detail).ToArray();
        var row = rows[0]; Guid employee = row.GetAttributeValue<EntityReference>("a365_employee").Id;
        Credit(fake, employee, year, 10m, 749910000);
        Credit(fake, employee, year, -1m, 749910000);
        Credit(fake, employee, year, -5m, 749910001);
        Credit(fake, employee, year - 1, 100m, 749910000);
        int writes = fake.Writes.Count;
        var page = Run(fake, new { command = "conversionRows", year = year });
        var values = ((System.Collections.IEnumerable)page["rows"]).Cast<Dictionary<string, object>>().Single(r => (string)r["employeeId"] == employee.ToString("D"));
        Check(Convert.ToDecimal(values["availableVL"]) == 9m && Convert.ToDecimal(values["days"]) == 5m, "9 VL still allows up to 5 conversion days");
        Check(fake.Writes.Count == writes, "Reading live conversion balances is read-only");
        Credit(fake, employee, year, -5m, 749910000);
        page = Run(fake, new { command = "conversionRows", year = year });
        values = ((System.Collections.IEnumerable)page["rows"]).Cast<Dictionary<string, object>>().Single(r => (string)r["employeeId"] == employee.ToString("D"));
        Check(Convert.ToDecimal(values["availableVL"]) == 4m && Convert.ToDecimal(values["days"]) == 4m, "4 VL clamps conversion to 4 and ignores SL/other years");
        Check(Convert.ToDecimal(values["amount"]) == 9090.92m && (decimal)row["a365_days"] == 5m, "Effective amount uses saved rate without overwriting chosen ceiling");
        var manual = new { id = row.Id.ToString("D"), employeeId = employee.ToString("D"), availableVL = 8m, days = 3m };
        var saved = Run(fake, new { command = "conversionSave", operationId = operation, year = year, version = created["version"], changes = new[] { manual } });
        page = Run(fake, new { command = "conversionRows", year = year });
        values = ((System.Collections.IEnumerable)page["rows"]).Cast<Dictionary<string, object>>().Single(r => (string)r["employeeId"] == employee.ToString("D"));
        Check(Convert.ToDecimal(values["days"]) == 3m && Convert.ToDecimal(values["limitDays"]) == 3m, "Manual 3-day ceiling stays fixed at VL 4");
        Credit(fake, employee, year, -2m, 749910000);
        page = Run(fake, new { command = "conversionRows", year = year });
        values = ((System.Collections.IEnumerable)page["rows"]).Cast<Dictionary<string, object>>().Single(r => (string)r["employeeId"] == employee.ToString("D"));
        Check(Convert.ToDecimal(values["days"]) == 2m && Convert.ToDecimal(values["limitDays"]) == 3m, "VL 2 caps payable days without losing manual ceiling");
        Credit(fake, employee, year, 2m, 749910000);
        page = Run(fake, new { command = "conversionRows", year = year });
        values = ((System.Collections.IEnumerable)page["rows"]).Cast<Dictionary<string, object>>().Single(r => (string)r["employeeId"] == employee.ToString("D"));
        Check(Convert.ToDecimal(values["days"]) == 3m, "Restoration recovers capacity up to the chosen limit");
        var paid = Run(fake, new { command = "conversionMarkPaid", operationId = operation, year = year, version = saved["version"] });
        Check(Convert.ToDecimal(row["a365_days"]) == 3m && Convert.ToDecimal(row["a365_availablevl"]) == 4m, "Mark paid freezes effective balances");
        Credit(fake, employee, year, -4m, 749910000);
        page = Run(fake, new { command = "conversionRows", year = year });
        values = ((System.Collections.IEnumerable)page["rows"]).Cast<Dictionary<string, object>>().Single(r => (string)r["employeeId"] == employee.ToString("D"));
        Check(Convert.ToDecimal(values["availableVL"]) == 4m && Convert.ToDecimal(values["days"]) == 3m && values["liveVL"] == null, "Paid snapshot ignores subsequent leave deductions");
        Check((bool)paid["paid"], "Paid lock still applies");
        Check(ConversionCommands.Effective(10m, 5m, 100m, -1m).Days == 0m, "Negative recorded VL cannot produce a negative payout");
        return checks;
    }
}
