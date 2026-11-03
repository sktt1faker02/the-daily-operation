using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.Remoting.Messaging;
using System.Runtime.Remoting.Proxies;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using A365.Ledger.Plugins;

// Dependency-free contract tests run the real command against an in-memory SDK
// boundary. The harness simulates transaction rollback; live Dataverse rollback,
// lock contention, timeouts and role tests remain mandatory release checks.
sealed class Proxy : RealProxy
{
    readonly Dictionary<string, object> values;
    public Proxy(Type type, Dictionary<string, object> data) : base(type) { values = data; }
    public override IMessage Invoke(IMessage message) { var call = (IMethodCallMessage)message; object value; values.TryGetValue(call.MethodName.Replace("get_", ""), out value); return new ReturnMessage(value, null, 0, call.LogicalCallContext, call); }
}
sealed class Boundary : IOrganizationService, IOrganizationServiceFactory, IServiceProvider
{
    public Dictionary<string, Entity> Rows = new Dictionary<string, Entity>();
    public bool Admin = true, Transaction = true, FailPayment, AuditEnabled = true;
    public int FailWrite, Writes;
    public Guid Actor = Guid.NewGuid();
    public IPluginExecutionContext Context;
    FilterExpression aggregateFilter;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    public static string Key(string table, Guid id) { return table + "/" + id; }
    public static Entity Copy(Entity row) { var copy = new Entity(row.LogicalName, row.Id) { RowVersion = row.RowVersion }; foreach (var field in row.Attributes) copy[field.Key] = field.Value; return copy; }
    public void Put(Entity row) { if (row.RowVersion == null) row.RowVersion = "1"; Rows[Key(row.LogicalName, row.Id)] = Copy(row); }
    public Entity Get(string table, Guid id) { return Copy(Rows[Key(table, id)]); }
    public List<Entity> Ledger { get { return Rows.Values.Where(row => row.LogicalName == LedgerCommand.Table).ToList(); } }
    public object Run(Request request)
    {
        var before = Rows.ToDictionary(pair => pair.Key, pair => Copy(pair.Value));
        var output = new ParameterCollection();
        Context = (IPluginExecutionContext)new Proxy(typeof(IPluginExecutionContext), new Dictionary<string, object> {
            { "MessageName", LedgerCommand.Api }, { "IsInTransaction", Transaction }, { "InitiatingUserId", Actor }, { "UserId", Actor },
            { "InputParameters", new ParameterCollection { { "Request", json.Serialize(request) } } }, { "OutputParameters", output }
        }).GetTransparentProxy();
        try { new LedgerCommand().Execute(this); return json.DeserializeObject((string)output["Response"]); }
        catch { Rows = before; throw; }
    }
    public object GetService(Type type) { if (type == typeof(IPluginExecutionContext)) return Context; if (type == typeof(IOrganizationServiceFactory)) return this; return null; }
    public void Guard(IPlugin guard, string message, object target, bool apiParent, string trustedParent = null)
    {
        var values = new Dictionary<string, object> { { "MessageName", message }, { "IsInTransaction", true }, { "UserId", Actor }, { "InputParameters", new ParameterCollection { { target is EntityCollection ? "Targets" : "Target", target } } } };
        if (apiParent || trustedParent != null) values["ParentContext"] = new Proxy(typeof(IPluginExecutionContext), new Dictionary<string, object> { { "MessageName", trustedParent ?? LedgerCommand.Api }, { "IsInTransaction", true } }).GetTransparentProxy();
        Context = (IPluginExecutionContext)new Proxy(typeof(IPluginExecutionContext), values).GetTransparentProxy(); guard.Execute(this);
    }
    public IOrganizationService CreateOrganizationService(Guid? user) { return this; }
    void Write(Entity row)
    {
        if (row.LogicalName == LedgerCommand.Table && ++Writes == FailWrite) throw new InvalidPluginExecutionException("Injected ledger write failure");
        if (FailPayment && row.LogicalName == "a365_payrollperiod" && row.Contains("a365_paidon")) throw new InvalidPluginExecutionException("Injected payment failure");
    }
    public Guid Create(Entity row)
    {
        Write(row); if (row.Id == Guid.Empty) row.Id = Guid.NewGuid();
        if (Rows.ContainsKey(Key(row.LogicalName, row.Id))) throw new InvalidPluginExecutionException("Duplicate primary key");
        if (row.LogicalName == LedgerCommand.Table && row.Contains("a365_sourcekey") && Ledger.Any(item => item.GetAttributeValue<string>("a365_sourcekey") == row.GetAttributeValue<string>("a365_sourcekey"))) throw new InvalidPluginExecutionException("Duplicate alternate source key");
        Put(row); return row.Id;
    }
    public void Update(Entity update)
    {
        Write(update); var row = Get(update.LogicalName, update.Id);
        foreach (var field in update.Attributes) row[field.Key] = field.Value;
        row.RowVersion = (string.IsNullOrEmpty(row.RowVersion) ? Convert.ToInt64(row["versionnumber"]) + 1 : long.Parse(row.RowVersion) + 1).ToString(); Put(row);
    }
    public void Delete(string table, Guid id) { var row = Get(table, id); Write(row); Rows.Remove(Key(table, id)); }
    public Entity Retrieve(string table, Guid id, ColumnSet columns) { return Get(table, id); }
    public EntityCollection RetrieveMultiple(QueryBase queryBase)
    {
        if (queryBase is FetchExpression) {
            var groups = Ledger.Where(row => Matches(row, aggregateFilter)).GroupBy(row => row.GetAttributeValue<string>("a365_direction"));
            var aggregates = groups.Select(group => { var row = new Entity(LedgerCommand.Table); row["direction"] = new AliasedValue(LedgerCommand.Table, "a365_direction", group.Key); row["amount"] = new AliasedValue(LedgerCommand.Table, "a365_amount", group.Sum(item => item.GetAttributeValue<decimal>("a365_amount"))); row["count"] = new AliasedValue(LedgerCommand.Table, LedgerCommand.Table + "id", group.Count()); return row; }).ToList();
            return new EntityCollection(aggregates);
        }
        var query = (QueryExpression)queryBase;
        if (query.EntityName == "organization") { var organization = new Entity("organization", Guid.NewGuid()); organization["isauditenabled"] = AuditEnabled; return new EntityCollection(new List<Entity> { organization }); }
        if (query.EntityName == "role") return new EntityCollection(Admin ? new List<Entity> { new Entity("role", Guid.NewGuid()) } : new List<Entity>());
        var rows = Rows.Values.Where(row => row.LogicalName == query.EntityName && Matches(row, query.Criteria)).Select(Copy).ToList();
        if (query.PageInfo.Count > 0) {
            if (query.EntityName == LedgerCommand.Table) rows = rows.OrderByDescending(row => row.GetAttributeValue<DateTime>("a365_date")).ThenBy(row => row.Id).ToList();
            var offset = (query.PageInfo.PageNumber - 1) * query.PageInfo.Count;
            return new EntityCollection(rows.Skip(offset).Take(query.PageInfo.Count).ToList()) { MoreRecords = rows.Count > offset + query.PageInfo.Count, PagingCookie = "synthetic-page" };
        }
        return new EntityCollection(rows) { MoreRecords = false };
    }
    static object Value(object value) { var option = value as OptionSetValue; if (option != null) return option.Value; var reference = value as EntityReference; return reference == null ? value : reference.Id; }
    static bool Matches(Entity row, FilterExpression filter)
    {
        var results = new List<bool>();
        foreach (var condition in filter.Conditions)
        {
            object value; row.Attributes.TryGetValue(condition.AttributeName, out value);
            if (condition.AttributeName == row.LogicalName + "id") value = row.Id;
            if (condition.Operator == ConditionOperator.Null) results.Add(value == null);
            else if (condition.Operator == ConditionOperator.Equal) results.Add(object.Equals(Value(value), Value(condition.Values[0])));
            else throw new Exception("Unimplemented test query " + condition.Operator);
        }
        results.AddRange(filter.Filters.Select(child => Matches(row, child)));
        return filter.FilterOperator == LogicalOperator.Or ? results.Any(result => result) : results.All(result => result);
    }
    public OrganizationResponse Execute(OrganizationRequest request)
    {
        if (request.RequestName == "QueryExpressionToFetchXml") { aggregateFilter = ((QueryExpression)request["Query"]).Criteria; var converted = new OrganizationResponse(); converted["FetchXml"] = "<fetch><entity name='a365_ledgertransaction'/></fetch>"; return converted; }
        var update = request as UpdateRequest;
        if (update != null) { if (Get(update.Target.LogicalName, update.Target.Id).RowVersion != update.Target.RowVersion) throw new InvalidPluginExecutionException("Concurrency conflict"); Update(update.Target); return new UpdateResponse(); }
        throw new Exception("Unexpected SDK request " + request.RequestName);
    }
    public void Associate(string a, Guid b, Relationship c, EntityReferenceCollection d) { throw new NotSupportedException(); }
    public void Disassociate(string a, Guid b, Relationship c, EntityReferenceCollection d) { throw new NotSupportedException(); }
}
static class Tests
{
    static int assertions;
    static readonly Guid Period = Guid.NewGuid();
    static readonly DateTime Modified = new DateTime(2026, 11, 3, 1, 0, 0, DateTimeKind.Utc);
    static readonly Dictionary<string, int> Categories = Rules.Labels.Select((label, index) => new { label, index }).ToDictionary(item => item.label, item => 749910000 + item.index);
    static void Check(bool condition, string name) { if (!condition) throw new Exception(name); assertions++; }
    static void Reject(Action action, string name) { try { action(); } catch (Exception) { assertions++; return; } throw new Exception("Expected rejection: " + name); }
    static Boundary Fixture()
    {
        var service = new Boundary(); var json = new JavaScriptSerializer();
        var coordination = new Entity(LedgerCommand.Coordination, LedgerCommand.Company); coordination["a365_revision"] = "first"; coordination["a365_categories"] = json.Serialize(Categories); service.Put(coordination);
        var period = new Entity("a365_payrollperiod", Period); period["a365_name"] = "Test cutoff"; period["a365_payrollstatus"] = new OptionSetValue(Rules.Ready); period["statecode"] = new OptionSetValue(0); period["modifiedon"] = Modified; service.Put(period);
        foreach (decimal amount in new[] { 20000m, 25000m, 0m, -100m }) {
            var entry = new Entity("a365_payrollentry", Guid.NewGuid()); entry["a365_name"] = "Employee " + amount; entry["a365_employee"] = new EntityReference("a365_employee", Guid.NewGuid()); entry["a365_payrollperiod"] = period.ToEntityReference(); entry["a365_netpay"] = new Money(amount); service.Put(entry);
        }
        return service;
    }
    static Request Payment(Guid operation) { return new Request { command = "pay", periodId = Period.ToString(), operationId = operation.ToString(), version = Modified.ToString("o") }; }
    static Request Manual(string amount) { return new Request { command = "save", operationId = Guid.NewGuid().ToString(), date = "2026-11-03", category = Categories["Utilities"].ToString(), direction = "debit", amount = amount, description = "Internet", receipt = "0001", reference = "" }; }
    static void Main()
    {
        Check(Rules.BusinessDate(new DateTime(2026, 11, 2, 16, 1, 0, DateTimeKind.Utc)) == "2026-11-03", "Manila UTC date boundary");
        Check(Rules.Amount("0.10", false) + Rules.Amount("0.20", false) == 0.30m, "Decimal money");
        var canonical = new JavaScriptSerializer();
        Check(Rules.Fingerprint(canonical.Deserialize<Request>("{\"command\":\"save\",\"amount\":\"1\",\"reference\":\"a|b\"}")) == Rules.Fingerprint(canonical.Deserialize<Request>("{\"reference\":\"a|b\",\"amount\":\"1\",\"command\":\"save\"}")), "Fingerprint ignores JSON property order across workers");
        Check(Rules.Fingerprint(new Request { command = "save", receipt = "a|b", reference = "c" }) != Rules.Fingerprint(new Request { command = "save", receipt = "a", reference = "b|c" }), "Fingerprint distinguishes separators between fields");
        Check(Rules.Fingerprint(new Request { command = "save", receipt = null }) != Rules.Fingerprint(new Request { command = "save", receipt = "" }), "Fingerprint distinguishes null and empty fields");
        foreach (var bad in new[] { "0", "-1", "1.001", "NaN", "1e3" }) Reject(() => Rules.Amount(bad, false), "Manual amount");
        var service = Fixture(); var request = Payment(Guid.NewGuid()); service.Run(request);
        Check(service.Ledger.Count == 4, "One row per existing employee including zero and negative");
        Check(service.Ledger.Sum(row => row.GetAttributeValue<decimal>("a365_amount")) == 44900m, "Saved signed net pays");
        Check(service.Ledger.All(row => row.GetAttributeValue<string>("a365_direction") == "debit" && row.GetAttributeValue<OptionSetValue>("a365_category").Value == Categories["Payroll"]), "Payroll category and debit");
        var paid = service.Get("a365_payrollperiod", Period);
        Check(paid.GetAttributeValue<DateTime>("a365_paidon") == paid.GetAttributeValue<DateTime>("a365_lockedon"), "Same payment and locking timestamp");
        Check(paid.GetAttributeValue<EntityReference>("a365_paidby").Id == service.Actor && paid.GetAttributeValue<OptionSetValue>("a365_payrollstatus").Value == Rules.Locked, "Actor and locked status");
        var changed = service.Ledger[0]; changed["a365_amount"] = 12m; changed["a365_reference"] = "Keep admin reference"; service.Put(changed);
        service.Run(request); Check(service.Get(LedgerCommand.Table, changed.Id).GetAttributeValue<decimal>("a365_amount") == 12m, "Replay never overwrites manual edits");
        var collision = Payment(Rules.Id(request.operationId)); collision.version = "2026-11-03T02:00:00Z"; Reject(() => service.Run(collision), "Operation identity binding");
        for (int failure = 1; failure <= 4; failure++) {
            var failing = Fixture(); failing.FailWrite = failure;
            Reject(() => failing.Run(Payment(Guid.NewGuid())), "Injected write failure");
            Check(failing.Ledger.Count == 0 && !failing.Get("a365_payrollperiod", Period).Contains("a365_paidon"), "Simulated transaction rollback");
        }
        var paymentFailure = Fixture(); paymentFailure.FailPayment = true; Reject(() => paymentFailure.Run(Payment(Guid.NewGuid())), "Payment failure"); Check(paymentFailure.Ledger.Count == 0, "No partial ledger after payment failure");
        var denied = Fixture(); denied.Admin = false; Reject(() => denied.Run(Manual("1")), "Server role denial"); Check(denied.Ledger.Count == 0, "No unauthorized write");
        var noTransaction = Fixture(); noTransaction.Transaction = false; Reject(() => noTransaction.Run(Manual("1")), "Missing server transaction");
        var noAudit = Fixture(); noAudit.AuditEnabled = false; Reject(() => noAudit.Run(Manual("1")), "Financial writes require active native auditing"); Check(noAudit.Ledger.Count == 0, "No unaudited financial write");
        foreach (var amount in new[] { "0", "-1", "1.001" }) { var invalid = Fixture(); Reject(() => invalid.Run(Manual(amount)), "Manual command amount validation"); }
        var manual = Fixture(); var save = Manual("100.01"); manual.Run(save); Check(manual.Ledger.Single().GetAttributeValue<string>("a365_receipt") == "0001", "Receipt zeros retained");
        var raw = manual.Ledger.Single(); raw.RowVersion = null; raw["versionnumber"] = 7L;
        var versionedEdit = Manual("101"); versionedEdit.id = raw.Id.ToString(); versionedEdit.version = "7"; manual.Run(versionedEdit);
        Check(manual.Ledger.Single().GetAttributeValue<decimal>("a365_amount") == 101m, "SDK versionnumber fallback allows a verified edit");
        var invalidCategory = Manual("1"); invalidCategory.category = "123"; Reject(() => manual.Run(invalidCategory), "Invalid category");
        var capital = Manual("10000"); capital.category = Categories["Capital Deposits"].ToString(); Reject(() => manual.Run(capital), "Capital direction"); capital.direction = "credit"; manual.Run(capital);
        var duplicate = Fixture(); var entries = duplicate.Rows.Values.Where(row => row.LogicalName == "a365_payrollentry").ToArray(); entries[1]["a365_employee"] = entries[0]["a365_employee"]; Reject(() => duplicate.Run(Payment(Guid.NewGuid())), "Duplicate employees");
        // Reopen preserves amounts until re-payment, then updates/recreates and
        // removes only the source whose payroll entry was deleted.
        var oldRows = service.Ledger.ToArray(); var reopened = service.Get("a365_payrollperiod", Period); reopened["a365_payrollstatus"] = new OptionSetValue(Rules.Ready); reopened["modifiedon"] = Modified; service.Put(reopened);
        service.Rows.Remove(Boundary.Key(LedgerCommand.Table, oldRows[1].Id));
        var removedEmployee = oldRows[2].GetAttributeValue<EntityReference>("a365_sourceemployee").Id;
        var removedEntry = service.Rows.Values.Single(row => row.LogicalName == "a365_payrollentry" && row.GetAttributeValue<EntityReference>("a365_employee").Id == removedEmployee); service.Rows.Remove(Boundary.Key(removedEntry.LogicalName, removedEntry.Id));
        var unrelated = Manual("5"); service.Run(unrelated); service.Run(Payment(Guid.NewGuid()));
        Check(service.Ledger.Count == 4, "Resync recreates one, removes deleted source, keeps manual");
        Check(service.Ledger.All(row => row.GetAttributeValue<EntityReference>("a365_sourceemployee") == null || row.GetAttributeValue<EntityReference>("a365_sourceemployee").Id != removedEmployee), "Deleted source row removed");
        Check(service.Get(LedgerCommand.Table, changed.Id).GetAttributeValue<string>("a365_reference") == "Keep admin reference", "Optional admin reference survives resync");
        // Historical posting uses the exact same server synchronization, skipping
        // an edited existing row and restoring only missing rows.
        var history = Fixture(); var historicalPeriod = history.Get("a365_payrollperiod", Period); historicalPeriod["a365_payrollstatus"] = new OptionSetValue(Rules.Locked); historicalPeriod["a365_paidon"] = new DateTime(2025, 4, 2, 16, 0, 0, DateTimeKind.Utc); history.Put(historicalPeriod);
        var work = new Entity(LedgerCommand.Job, Guid.NewGuid()); var attempt = Guid.NewGuid().ToString(); work["a365_name"] = "Historical"; work["a365_period"] = historicalPeriod.ToEntityReference(); work["a365_status"] = "queued"; work["a365_attempt"] = attempt; history.Put(work);
        var historyRequest = new Request { command = "historyStep", id = work.Id.ToString(), operationId = attempt, version = attempt }; history.Run(historyRequest);
        Check(history.Ledger.Count == 4 && history.Ledger.All(row => Rules.Iso(row.GetAttributeValue<DateTime>("a365_date")) == "2025-04-03"), "History preserves stored actual paid date");
        var edited = history.Ledger.First(); edited["a365_amount"] = 1m; history.Put(edited); history.Run(historyRequest); Check(history.Get(LedgerCommand.Table, edited.Id).GetAttributeValue<decimal>("a365_amount") == 1m, "History replay preserves edit");
        Check(history.Get("a365_payrollperiod", Period).RowVersion == historicalPeriod.RowVersion, "History never updates source payroll");
        var unlinked = Manual("5"); unlinked.category = Categories["Payroll"].ToString(); history.Run(unlinked);
        var nextWork = Boundary.Copy(work); nextWork.Id = Guid.NewGuid(); nextWork["a365_attempt"] = Guid.NewGuid().ToString(); history.Put(nextWork);
        Reject(() => history.Run(new Request { command = "historyStep", id = nextWork.Id.ToString(), operationId = nextWork.GetAttributeValue<string>("a365_attempt"), version = nextWork.GetAttributeValue<string>("a365_attempt") }), "Unreviewed manual payroll blocks history");
        // Real guard implementations, exercised separately from command transport.
        var guards = Fixture(); var target = new Entity(LedgerCommand.Table, Guid.NewGuid());
        Reject(() => guards.Guard(new ProtectLedgerWrites(), "Create", target, false), "Native ledger create is denied");
        guards.Guard(new ProtectLedgerWrites(), "Create", target, true); assertions++;
        var paymentTarget = new Entity("a365_payrollperiod", Period); paymentTarget["a365_payrollstatus"] = new OptionSetValue(Rules.Locked);
        Reject(() => guards.Guard(new ProtectPayrollPayment(), "Update", paymentTarget, false), "Native payment is denied");
        guards.Guard(new ProtectPayrollPayment(), "Update", paymentTarget, true); assertions++;
        paymentTarget["a365_payrollstatus"] = new OptionSetValue(Rules.Ready); guards.Guard(new ProtectPayrollPayment(), "Update", paymentTarget, false); assertions++;
        paymentTarget["a365_payrollstatus"] = new OptionSetValue(749910001); paymentTarget["a365_lockedon"] = null; guards.Guard(new ProtectPayrollPayment(), "Update", paymentTarget, false); assertions++;
        var createEntry = new Entity("a365_payrollentry", Guid.NewGuid()); createEntry["a365_payrollperiod"] = new EntityReference("a365_payrollperiod", Period);
        Reject(() => guards.Guard(new ProtectPayrollEntries(), "Create", createEntry, false), "Cannot add entries to Ready payroll");
        var editablePeriod = guards.Get("a365_payrollperiod", Period); editablePeriod["a365_payrollstatus"] = new OptionSetValue(749910001); guards.Put(editablePeriod);
        guards.Guard(new ProtectPayrollEntries(), "Create", createEntry, false); assertions++;
        editablePeriod["a365_payrollstatus"] = new OptionSetValue(Rules.Locked); guards.Put(editablePeriod);
        var sourceEntry = guards.Rows.Values.First(row => row.LogicalName == "a365_payrollentry");
        Reject(() => guards.Guard(new ProtectPayrollEntries(), "Delete", sourceEntry.ToEntityReference(), false), "Cannot delete locked source entries");
        var otherPeriod = Boundary.Copy(editablePeriod); otherPeriod.Id = Guid.NewGuid(); otherPeriod["a365_payrollstatus"] = new OptionSetValue(749910001); guards.Put(otherPeriod);
        var move = new Entity("a365_payrollentry", sourceEntry.Id); move["a365_payrollperiod"] = otherPeriod.ToEntityReference();
        Reject(() => guards.Guard(new ProtectPayrollEntries(), "Update", move, false), "Cannot move a source out of locked payroll");
        editablePeriod["a365_payrollstatus"] = new OptionSetValue(749910001); editablePeriod["statecode"] = new OptionSetValue(1); guards.Put(editablePeriod);
        Reject(() => guards.Guard(new ProtectPayrollEntries(), "Delete", sourceEntry.ToEntityReference(), false), "Archived entries cannot be deleted directly");
        guards.Guard(new ProtectPayrollEntries(), "Delete", sourceEntry.ToEntityReference(), false, "a365_DeletePayrollPeriod"); assertions++;
        // A reviewed manual match preserves amount/date and becomes a skipped
        // existing source, even when it differs from today's saved payroll.
        var matching = Fixture(); var matchedEntry = matching.Rows.Values.First(row => row.LogicalName == "a365_payrollentry");
        var manualMatch = Manual("123.45"); manualMatch.category = Categories["Payroll"].ToString(); manualMatch.date = "2025-04-01"; matching.Run(manualMatch);
        var matchRow = matching.Ledger.Single(); matching.Run(new Request { command = "link", id = matchRow.Id.ToString(), entryId = matchedEntry.Id.ToString(), version = matchRow.RowVersion, operationId = Guid.NewGuid().ToString() });
        var linkedMatch = matching.Get(LedgerCommand.Table, matchRow.Id);
        Check(linkedMatch.GetAttributeValue<decimal>("a365_amount") == 123.45m && Rules.Iso(linkedMatch.GetAttributeValue<DateTime>("a365_date")) == "2025-04-01", "Link preserves manual financial values");
        var oldPeriod = matching.Get("a365_payrollperiod", Period); oldPeriod["a365_payrollstatus"] = new OptionSetValue(Rules.Paid); oldPeriod["a365_paidon"] = Modified; matching.Put(oldPeriod);
        var matchJob = new Entity(LedgerCommand.Job, Guid.NewGuid()); var matchAttempt = Guid.NewGuid().ToString(); matchJob["a365_name"] = "Match test"; matchJob["a365_period"] = oldPeriod.ToEntityReference(); matchJob["a365_status"] = "queued"; matchJob["a365_attempt"] = matchAttempt; matching.Put(matchJob);
        matching.Run(new Request { command = "historyStep", id = matchJob.Id.ToString(), version = matchAttempt, operationId = matchAttempt });
        Check(matching.Get(LedgerCommand.Table, matchRow.Id).GetAttributeValue<decimal>("a365_amount") == 123.45m && matching.Get(LedgerCommand.Job, matchJob.Id).GetAttributeValue<int>("a365_skippedcount") == 1, "History skips the confirmed manual match");
        var totals = Fixture(); var deposit = Manual("10000"); deposit.category = Categories["Capital Deposits"].ToString(); deposit.direction = "credit"; totals.Run(deposit);
        var clientPayment = Manual("2000"); clientPayment.category = Categories["Client Payments"].ToString(); clientPayment.direction = "credit"; totals.Run(clientPayment);
        var payrollDebit = Manual("3000"); payrollDebit.category = Categories["Payroll"].ToString(); totals.Run(payrollDebit);
        var beforeRead = totals.Get(LedgerCommand.Coordination, LedgerCommand.Company).RowVersion;
        var filtered = (Dictionary<string, object>)totals.Run(new Request { command = "list", category = Categories["Payroll"].ToString() });
        Check(Convert.ToDecimal(filtered["balance"]) == 9000m, "Company balance includes deposits once");
        var filteredTotals = (Dictionary<string, object>)filtered["totals"];
        Check(Convert.ToDecimal(filteredTotals["debit"]) == 3000m && Convert.ToDecimal(filteredTotals["credit"]) == 0m && Convert.ToDecimal(filteredTotals["net"]) == -3000m, "Filtered totals independent of company balance");
        Check(beforeRead == totals.Get(LedgerCommand.Coordination, LedgerCommand.Company).RowVersion, "List/export reads make no coordination or business writes");
        Reject(() => totals.Run(new Request { command = "list", revision = "stale-export" }), "Concurrent revision rejects export");
        var paging = Fixture();
        for (int index = 0; index < 23; index++) paging.Run(Manual("1"));
        var seen = new HashSet<string>(); string cursor = null;
        foreach (var expected in new[] { 10, 10, 3 }) {
            var result = (Dictionary<string, object>)paging.Run(new Request { command = "list", cursor = cursor });
            var pageRows = (object[])result["rows"];
            Check(pageRows.Length == expected, "Ledger pages contain ten rows and a partial final page");
            foreach (Dictionary<string, object> row in pageRows) Check(seen.Add((string)row["id"]), "Paging never repeats a ledger row");
            var pageTotals = (Dictionary<string, object>)result["totals"];
            Check(Convert.ToInt32(pageTotals["count"]) == 23 && Convert.ToDecimal(pageTotals["debit"]) == 23m && Convert.ToDecimal(result["balance"]) == -23m, "Totals and balance cover every row on every page");
            cursor = (string)result["next"];
        }
        Check(cursor == null && seen.Count == 23, "Paging terminates after returning every ledger row");
        Console.WriteLine("Passed " + assertions + " Ledger server contract assertions. Transaction rollback is simulated; live Dataverse checks remain required.");
    }
}
