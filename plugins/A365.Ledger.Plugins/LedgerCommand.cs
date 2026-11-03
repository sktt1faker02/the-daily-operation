using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk.Messages;

[assembly: System.Reflection.AssemblyVersion("1.0.0.2")]
namespace A365.Ledger.Plugins
{
    public sealed class Request
    {
        public string command { get; set; } public string operationId { get; set; }
        public string id { get; set; } public string version { get; set; }
        public string periodId { get; set; } public string entryId { get; set; }
        public string date { get; set; } public string receipt { get; set; } public string reference { get; set; }
        public string direction { get; set; } public string amount { get; set; } public string category { get; set; }
        public string description { get; set; } public string start { get; set; } public string end { get; set; }
        public string search { get; set; } public string cursor { get; set; } public string revision { get; set; }
    }
    public static class Rules
    {
        public const int Ready = 749910002, Paid = 749910003, Locked = 749910004;
        public static readonly string[] Labels = { "Utilities", "Payroll", "Government Contributions", "Taxes", "Software and Licenses", "Rent and Coworking", "Capital Deposits", "Capital Withdrawals", "Client Payments" };
        public static void Fail(string message) { throw new InvalidPluginExecutionException("LEDGER: " + message); }
        public static Guid Id(string value) { Guid id; if (!Guid.TryParse(value, out id) || id == Guid.Empty) Fail("Select a valid record."); return id; }
        public static DateTime Day(string value) { DateTime day; if (!DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out day) || day.Year < 1900) Fail("Enter a valid Date."); return day; }
        public static string Iso(DateTime day) { return day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture); }
        public static decimal Amount(string text, bool signed)
        {
            decimal value;
            if (text == null || !System.Text.RegularExpressions.Regex.IsMatch(text, @"^-?\d+(\.\d{1,2})?$") || !decimal.TryParse(text, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out value)) { Fail("Enter an amount with at most two decimal places."); return 0; }
            if (Math.Abs(value) > 1000000000m || (!signed && value <= 0)) Fail("Manual amounts must be positive and within the supported range.");
            return value;
        }
        public static string BusinessDate(DateTime paid) { return Iso(DateTime.SpecifyKind(paid, DateTimeKind.Utc).AddHours(8)); }
        public static string Hash(string value) { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-", "").ToLowerInvariant(); }
        public static string Fingerprint(Request request)
        {
            // Reflection/JSON property ordering is not a cross-worker contract.
            // Explicit order and length prefixes make retries deterministic and
            // distinguish null, blank text and separator characters safely.
            var fields = new[] { request.command, request.operationId, request.id, request.version, request.periodId, request.entryId,
                request.date, request.receipt, request.reference, request.direction, request.amount, request.category, request.description,
                request.start, request.end, request.search, request.cursor, request.revision };
            return Hash(string.Join("|", fields.Select(value => value == null ? "N" : value.Length.ToString(CultureInfo.InvariantCulture) + ":" + value)));
        }
        public static Guid SourceId(Guid period, Guid employee) { return new Guid(Hash(period.ToString("D") + "/" + employee.ToString("D")).Substring(0, 32)); }
    }

    /// <summary>Register as synchronous unbound action a365_LedgerCommand. No
    /// ExecuteMultiple/ExecuteTransaction inside a plug-in: SDK calls enlist in
    /// the parent transaction. Fail closed if the platform did not supply one.</summary>
    public sealed class LedgerCommand : IPlugin
    {
        public const string Api = "a365_LedgerCommand", Table = "a365_ledgertransaction", Receipt = "a365_ledgeroperation", Coordination = "a365_ledgercoordination", Job = "a365_ledgerhistory";
        public static readonly Guid Company = new Guid("25886558-8d32-45f8-8294-f13b220ba37a");
        private static JavaScriptSerializer Json { get { return new JavaScriptSerializer { MaxJsonLength = 4000000 }; } }
        public void Execute(IServiceProvider services)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            if (context.MessageName != Api || !context.IsInTransaction) Rules.Fail("A synchronous server transaction is required.");
            var factory = (IOrganizationServiceFactory)services.GetService(typeof(IOrganizationServiceFactory));
            var system = factory.CreateOrganizationService(null);
            RequireAdmin(system, context.InitiatingUserId);
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            Request request;
            try { request = Json.Deserialize<Request>((string)context.InputParameters["Request"]); }
            catch { Rules.Fail("The request is invalid."); return; }
            if (request == null) Rules.Fail("The request is missing.");
            // Only mutations take a write lock. Read/export commands compare
            // financial revisions around their reads without changing records.
            bool readOnly = new[] { "list", "operation", "historyPreview", "historyJobs", "sources" }.Contains(request.command);
            if (!readOnly) { var gate = new Entity(Coordination, Company); gate["a365_locktoken"] = Guid.NewGuid().ToString("D"); system.Update(gate); }
            var coordination = system.Retrieve(Coordination, Company, new ColumnSet("a365_revision", "a365_categories"));
            var revision = coordination.GetAttributeValue<string>("a365_revision");
            var categories = Json.Deserialize<Dictionary<string, int>>(coordination.GetAttributeValue<string>("a365_categories"));
            if (categories == null || categories.Count != 9 || Rules.Labels.Any(label => !categories.ContainsKey(label)) || categories.Values.Distinct().Count() != 9) Rules.Fail("Ledger category metadata needs verification.");
            object result;
            if (request.command == "operation")
            {
                var prior = Find(caller, Receipt, Rules.Id(request.operationId));
                result = new { completed = prior != null, result = prior == null ? null : Json.DeserializeObject(prior.GetAttributeValue<string>("a365_result")) };
            }
            else if (request.command == "list") result = List(request, caller, categories, revision);
            else if (request.command == "historyPreview") result = Preview(caller, categories, revision);
            else if (request.command == "historyJobs") result = new { jobs = Read(caller, Job, new FilterExpression()).OrderByDescending(row => row.GetAttributeValue<DateTime>("createdon")).Take(50).Select(JobResult).ToArray() };
            else if (request.command == "sources") result = Sources(caller, Rules.Id(request.periodId));
            else
            {
                var auditQuery = new QueryExpression("organization") { ColumnSet = new ColumnSet("isauditenabled"), TopCount = 1 };
                var organization = system.RetrieveMultiple(auditQuery).Entities.SingleOrDefault();
                if (organization == null || !organization.GetAttributeValue<bool>("isauditenabled")) Rules.Fail("Dataverse organization auditing must be enabled before Ledger financial writes. Contact your administrator.");
                var operation = Rules.Id(request.operationId);
                var fingerprint = Rules.Fingerprint(request);
                var prior = Find(caller, Receipt, operation);
                if (prior != null)
                {
                    if (prior.GetAttributeValue<string>("a365_fingerprint") != fingerprint) Rules.Fail("This operation identity belongs to a different request.");
                    context.OutputParameters["Response"] = prior.GetAttributeValue<string>("a365_result"); return;
                }
                if (request.command == "save") result = Save(request, caller, categories);
                else if (request.command == "delete")
                {
                    var row = Required(caller, Table, Rules.Id(request.id)); MatchVersion(row, request.version);
                    caller.Delete(Table, row.Id); result = new { id = row.Id.ToString("D") };
                }
                else if (request.command == "pay") result = Pay(request, context, caller, categories);
                else if (request.command == "link" || request.command == "reviewManual") result = Link(request, caller, categories);
                else if (request.command == "historyStart")
                {
                    if (request.revision != revision) Rules.Fail("The ledger changed. Refresh and confirm the preview again.");
                    var preview = PreviewData(caller, categories);
                    if (preview.Manual.Count != 0) Rules.Fail("Review and link or explicitly retain all unlinked manual Payroll rows first.");
                    if (!preview.Periods.Any(period => period.Error == null && period.Missing > 0)) Rules.Fail("No eligible missing payroll rows remain.");
                    foreach (var period in preview.Periods.Where(period => period.Error == null && period.Missing > 0))
                    {
                        var work = new Entity(Job); work["a365_name"] = period.Name; work["a365_period"] = new EntityReference("a365_payrollperiod", period.Id);
                        work["a365_status"] = "queued"; work["a365_createdcount"] = 0; work["a365_skippedcount"] = 0; work["a365_failedcount"] = 0;
                        work["a365_requestedby"] = new EntityReference("systemuser", context.InitiatingUserId); work["a365_attempt"] = Guid.NewGuid().ToString("D"); caller.Create(work);
                    }
                    result = new { id = operation.ToString("D"), status = "queued", created = 0, skipped = 0, failed = 0, error = "", period = "Background posting queued" };
                }
                else if (request.command == "historyStep") result = HistoryStep(request, context, caller, categories);
                else if (request.command == "historyFail")
                {
                    var work = Required(caller, Job, Rules.Id(request.id));
                    if (work.GetAttributeValue<string>("a365_attempt") != request.version) Rules.Fail("This background attempt has changed.");
                    var update = new Entity(Job, work.Id); update["a365_status"] = "failed"; update["a365_failedcount"] = 1; update["a365_error"] = "Posting failed. No partial period was committed. Review the source and retry."; caller.Update(update);
                    result = JobResult(Required(caller, Job, work.Id));
                }
                else if (request.command == "historyRetry")
                {
                    var work = Required(caller, Job, Rules.Id(request.id));
                    if (work.GetAttributeValue<string>("a365_status") != "failed") Rules.Fail("Only failed posting work can be retried.");
                    var update = new Entity(Job, work.Id); update["a365_status"] = "queued"; update["a365_error"] = ""; update["a365_failedcount"] = 0; update["a365_attempt"] = Guid.NewGuid().ToString("D"); caller.Update(update);
                    result = JobResult(Required(caller, Job, work.Id));
                }
                else { Rules.Fail("Unknown Ledger command."); return; }
                var receipt = new Entity(Receipt, operation); receipt["a365_name"] = request.command;
                receipt["a365_fingerprint"] = fingerprint; receipt["a365_result"] = Json.Serialize(result);
                receipt["a365_actor"] = new EntityReference("systemuser", context.InitiatingUserId); receipt["a365_completedon"] = DateTime.UtcNow; system.Create(receipt);
                var changed = new Entity(Coordination, Company); changed["a365_revision"] = Guid.NewGuid().ToString("D"); system.Update(changed);
            }
            if ((request.command == "list" || request.command == "historyPreview") && system.Retrieve(Coordination, Company, new ColumnSet("a365_revision")).GetAttributeValue<string>("a365_revision") != revision) Rules.Fail("The ledger changed during this read. Refresh and try again.");
            context.OutputParameters["Response"] = Json.Serialize(result);
        }
        public static void RequireAdmin(IOrganizationService system, Guid user)
        {
            var direct = new QueryExpression("role") { ColumnSet = new ColumnSet("roleid"), TopCount = 1 };
            direct.Criteria.AddCondition("name", ConditionOperator.Equal, "A365 - Payroll Admin");
            direct.AddLink("systemuserroles", "roleid", "roleid").LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
            if (system.RetrieveMultiple(direct).Entities.Count > 0) return;
            var team = new QueryExpression("role") { ColumnSet = new ColumnSet("roleid"), TopCount = 1 };
            team.Criteria.AddCondition("name", ConditionOperator.Equal, "A365 - Payroll Admin");
            team.AddLink("teamroles", "roleid", "roleid").AddLink("teammembership", "teamid", "teamid").LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
            if (system.RetrieveMultiple(team).Entities.Count == 0) Rules.Fail("Payroll Admin access is required.");
        }
        internal static Entity Find(IOrganizationService service, string table, Guid id)
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(true), TopCount = 1 };
            query.Criteria.AddCondition(table + "id", ConditionOperator.Equal, id); var row = service.RetrieveMultiple(query).Entities.FirstOrDefault(); if (row != null) Version(row); return row;
        }
        internal static Entity Required(IOrganizationService service, string table, Guid id) { var row = Find(service, table, id); if (row == null) Rules.Fail("The record is no longer available. Refresh and try again."); return row; }
        internal static List<Entity> Read(IOrganizationService service, string table, FilterExpression filter)
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(true), Criteria = filter, PageInfo = new PagingInfo { Count = 500, PageNumber = 1 } };
            query.AddOrder(table + "id", OrderType.Ascending); var rows = new List<Entity>();
            while (true) { var page = service.RetrieveMultiple(query); rows.AddRange(page.Entities); if (!page.MoreRecords) return rows; if (++query.PageInfo.PageNumber > 20) Rules.Fail("This operation exceeds the verified server read limit. Contact your administrator."); query.PageInfo.PagingCookie = page.PagingCookie; }
        }
        internal static FilterExpression Where(string column, object value) { var filter = new FilterExpression(); filter.AddCondition(column, ConditionOperator.Equal, value); return filter; }
        private static string Version(Entity row) { if (string.IsNullOrEmpty(row.RowVersion) && row.Contains("versionnumber")) row.RowVersion = Convert.ToString(row["versionnumber"], CultureInfo.InvariantCulture); return row.RowVersion; }
        private static void MatchVersion(Entity row, string version) { if (string.IsNullOrEmpty(version) || Version(row) != version) Rules.Fail("The record changed. Refresh and review it again."); }
        private static object Save(Request request, IOrganizationService caller, Dictionary<string, int> categories)
        {
            var existing = string.IsNullOrEmpty(request.id) ? null : Required(caller, Table, Rules.Id(request.id));
            if (existing != null) MatchVersion(existing, request.version);
            bool linked = existing != null && existing.Contains("a365_sourceperiod");
            int category;
            if (!int.TryParse(request.category, out category) || !categories.ContainsValue(category)) Rules.Fail("Select a valid Chart of Account.");
            if (request.direction != "debit" && request.direction != "credit") Rules.Fail("Select Money out or Money in.");
            if ((category == categories["Capital Deposits"] && request.direction != "credit") || (category == categories["Capital Withdrawals"] && request.direction != "debit")) Rules.Fail("Capital Deposits uses Credit; Capital Withdrawals uses Debit.");
            var amount = Rules.Amount(request.amount, linked && request.direction == "debit");
            if (string.IsNullOrWhiteSpace(request.description) || request.description.Length > 2000) Rules.Fail("Enter a Description of at most 2,000 characters.");
            if ((request.receipt ?? "").Length > 100 || (request.reference ?? "").Length > 500) Rules.Fail("OR Number allows 100 characters; Reference allows 500.");
            var row = new Entity(Table, existing == null ? Rules.Id(request.operationId) : existing.Id);
            row["a365_name"] = request.description.Trim().Substring(0, Math.Min(200, request.description.Trim().Length));
            row["a365_description"] = request.description.Trim(); row["a365_date"] = Rules.Day(request.date);
            row["a365_receipt"] = request.receipt ?? ""; row["a365_reference"] = request.reference ?? "";
            row["a365_direction"] = request.direction; row["a365_amount"] = amount; row["a365_category"] = new OptionSetValue(category);
            if (existing == null) caller.Create(row); else caller.Update(row);
            return new { id = row.Id.ToString("D") };
        }
        private static object Pay(Request request, IPluginExecutionContext context, IOrganizationService caller, Dictionary<string, int> categories)
        {
            var period = Required(caller, "a365_payrollperiod", Rules.Id(request.periodId));
            if (period.GetAttributeValue<OptionSetValue>("a365_payrollstatus").Value != Rules.Ready || period.GetAttributeValue<OptionSetValue>("statecode").Value != 0) Rules.Fail("Only an active Ready payroll can be marked paid.");
            if (period.GetAttributeValue<DateTime>("modifiedon").ToUniversalTime().ToString("o") != DateTime.Parse(request.version, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind).ToUniversalTime().ToString("o")) Rules.Fail("The payroll changed. Refresh and confirm payment again.");
            // Lock the source period and reject a concurrent unlock/edit between
            // the initial read and payment. Existing payroll guards remain active.
            var sourceLock = new Entity("a365_payrollperiod", period.Id) { RowVersion = period.RowVersion };
            sourceLock["a365_name"] = period.GetAttributeValue<string>("a365_name");
            caller.Execute(new UpdateRequest { Target = sourceLock, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
            var now = DateTime.UtcNow;
            var counts = Synchronize(caller, period, now, categories["Payroll"], context.InitiatingUserId, false);
            var update = new Entity("a365_payrollperiod", period.Id);
            update["a365_payrollstatus"] = new OptionSetValue(Rules.Locked); update["a365_paidon"] = now; update["a365_lockedon"] = now;
            update["a365_paidby"] = new EntityReference("systemuser", context.InitiatingUserId); update["a365_lockedby"] = new EntityReference("systemuser", context.InitiatingUserId);
            caller.Update(update);
            return new { periodId = period.Id.ToString("D"), created = counts[0], updated = counts[1], deleted = counts[2] };
        }
        private static List<Entity> Entries(IOrganizationService caller, Guid period)
        {
            var entries = Read(caller, "a365_payrollentry", Where("a365_payrollperiod", period));
            if (entries.Count > 200) Rules.Fail("This payroll exceeds the verified atomic posting limit of 200 employees. No payment was committed.");
            if (entries.Any(row => row.GetAttributeValue<EntityReference>("a365_employee") == null || row.GetAttributeValue<Money>("a365_netpay") == null || Math.Round(row.GetAttributeValue<Money>("a365_netpay").Value, 2) != row.GetAttributeValue<Money>("a365_netpay").Value || Math.Abs(row.GetAttributeValue<Money>("a365_netpay").Value) > 1000000000m)) Rules.Fail("Review missing employee or saved net-pay sources before posting.");
            if (entries.GroupBy(row => row.GetAttributeValue<EntityReference>("a365_employee").Id).Any(group => group.Count() > 1)) Rules.Fail("Duplicate employee payroll entries require review before posting.");
            return entries;
        }
        private static int[] Synchronize(IOrganizationService caller, Entity period, DateTime paid, int payroll, Guid actor, bool history)
        {
            var entries = Entries(caller, period.Id);
            var linked = Read(caller, Table, Where("a365_sourceperiod", period.Id));
            if (linked.Any(row => row.GetAttributeValue<EntityReference>("a365_sourceemployee") == null) || linked.GroupBy(row => row.GetAttributeValue<EntityReference>("a365_sourceemployee").Id).Any(group => group.Count() > 1)) Rules.Fail("Duplicate or incomplete ledger source links require review.");
            int created = 0, updated = 0, deleted = 0, skipped = 0;
            var employees = new HashSet<Guid>();
            foreach (var entry in entries)
            {
                var employee = entry.GetAttributeValue<EntityReference>("a365_employee"); employees.Add(employee.Id);
                var existing = linked.FirstOrDefault(item => item.GetAttributeValue<EntityReference>("a365_sourceemployee").Id == employee.Id);
                if (history && existing != null) { skipped++; continue; }
                var row = new Entity(Table, existing == null ? Rules.SourceId(period.Id, employee.Id) : existing.Id);
                row["a365_name"] = "Payroll - " + entry.GetAttributeValue<string>("a365_name");
                if (((string)row["a365_name"]).Length > 200) row["a365_name"] = ((string)row["a365_name"]).Substring(0, 200);
                row["a365_description"] = row["a365_name"]; row["a365_date"] = Rules.Day(Rules.BusinessDate(paid));
                row["a365_direction"] = "debit"; row["a365_amount"] = entry.GetAttributeValue<Money>("a365_netpay").Value; row["a365_category"] = new OptionSetValue(payroll);
                row["a365_sourceperiod"] = period.ToEntityReference(); row["a365_sourceemployee"] = employee;
                // Durable GUID text survives source-entry deletion until next re-payment.
                row["a365_sourceentry"] = entry.Id.ToString("D"); row["a365_sourcekey"] = period.Id.ToString("D") + "/" + employee.Id.ToString("D");
                row["a365_postedon"] = DateTime.UtcNow; row["a365_postedby"] = new EntityReference("systemuser", actor); row["a365_paidsnapshot"] = paid;
                if (existing == null) { caller.Create(row); created++; } else { caller.Update(row); updated++; }
            }
            if (!history) foreach (var old in linked.Where(row => !employees.Contains(row.GetAttributeValue<EntityReference>("a365_sourceemployee").Id))) { caller.Delete(Table, old.Id); deleted++; }
            return new[] { created, updated, deleted, skipped };
        }
        private static object Row(Entity row, IOrganizationService caller)
        {
            var periodRef = row.GetAttributeValue<EntityReference>("a365_sourceperiod");
            var period = periodRef == null ? null : Required(caller, "a365_payrollperiod", periodRef.Id);
            return new { id = row.Id.ToString("D"), date = Rules.Iso(row.GetAttributeValue<DateTime>("a365_date")), receipt = row.GetAttributeValue<string>("a365_receipt") ?? "", reference = row.GetAttributeValue<string>("a365_reference") ?? "",
                direction = row.GetAttributeValue<string>("a365_direction"), amount = row.GetAttributeValue<decimal>("a365_amount"), category = row.GetAttributeValue<OptionSetValue>("a365_category").Value, description = row.GetAttributeValue<string>("a365_description"), version = Version(row),
                periodId = periodRef == null ? null : periodRef.Id.ToString("D"), employeeId = row.GetAttributeValue<EntityReference>("a365_sourceemployee") == null ? null : row.GetAttributeValue<EntityReference>("a365_sourceemployee").Id.ToString("D"), entryId = row.GetAttributeValue<string>("a365_sourceentry"),
                periodName = period == null ? null : period.GetAttributeValue<string>("a365_name"), reopened = period != null && period.GetAttributeValue<OptionSetValue>("a365_payrollstatus").Value != Rules.Locked && period.GetAttributeValue<OptionSetValue>("a365_payrollstatus").Value != Rules.Paid,
                postedOn = row.Contains("a365_postedon") ? row.GetAttributeValue<DateTime>("a365_postedon").ToString("o") : null, postedBy = row.GetAttributeValue<EntityReference>("a365_postedby") == null ? null : row.GetAttributeValue<EntityReference>("a365_postedby").Id.ToString("D") };
        }
        private static FilterExpression Filters(Request request, Dictionary<string, int> categories)
        {
            var filter = new FilterExpression();
            if (!string.IsNullOrEmpty(request.start)) filter.AddCondition("a365_date", ConditionOperator.OnOrAfter, Rules.Day(request.start));
            if (!string.IsNullOrEmpty(request.end)) filter.AddCondition("a365_date", ConditionOperator.OnOrBefore, Rules.Day(request.end));
            if (!string.IsNullOrEmpty(request.start) && !string.IsNullOrEmpty(request.end) && Rules.Day(request.start) > Rules.Day(request.end)) Rules.Fail("From must be on or before To.");
            if (!string.IsNullOrEmpty(request.category)) { int category; if (!int.TryParse(request.category, out category) || !categories.ContainsValue(category)) Rules.Fail("Select a valid Chart of Account."); filter.AddCondition("a365_category", ConditionOperator.Equal, category); }
            if (!string.IsNullOrEmpty(request.direction)) { if (request.direction != "debit" && request.direction != "credit") Rules.Fail("Select Money out or Money in."); filter.AddCondition("a365_direction", ConditionOperator.Equal, request.direction); }
            if (!string.IsNullOrEmpty(request.search))
            {
                if (request.search.Length > 200) Rules.Fail("Search allows at most 200 characters.");
                var search = new FilterExpression(LogicalOperator.Or);
                // Escape SQL wildcard syntax so the user's text remains literal.
                var text = request.search.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]");
                foreach (var field in new[] { "a365_description", "a365_receipt", "a365_reference" }) search.AddCondition(field, ConditionOperator.Like, "%" + text + "%"); filter.AddFilter(search);
            }
            return filter;
        }
        private sealed class Cursor { public int page { get; set; } public string cookie { get; set; } public string filter { get; set; } }
        private static object List(Request request, IOrganizationService caller, Dictionary<string, int> categories, string revision)
        {
            if (!string.IsNullOrEmpty(request.revision) && request.revision != revision) Rules.Fail("The ledger changed during export. Export again.");
            var criteria = Filters(request, categories);
            var fingerprint = Rules.Fingerprint(new Request { start = request.start, end = request.end, category = request.category, direction = request.direction, search = request.search });
            var cursor = string.IsNullOrEmpty(request.cursor) ? new Cursor { page = 1, filter = fingerprint } : Json.Deserialize<Cursor>(Encoding.UTF8.GetString(Convert.FromBase64String(request.cursor)));
            if (cursor.page < 1 || cursor.page > 100000 || cursor.filter != fingerprint) Rules.Fail("Refresh the ledger paging controls.");
            var query = new QueryExpression(Table) { ColumnSet = new ColumnSet(true), Criteria = criteria, PageInfo = new PagingInfo { Count = 50, PageNumber = cursor.page, PagingCookie = cursor.cookie } };
            query.AddOrder("a365_date", OrderType.Descending); query.AddOrder(Table + "id", OrderType.Ascending);
            var page = caller.RetrieveMultiple(query);
            var totals = Aggregate(caller, criteria); var company = Aggregate(caller, new FilterExpression());
            return new { rows = page.Entities.Select(row => Row(row, caller)).ToArray(), totals = totals, balance = company.net, revision = revision,
                next = page.MoreRecords ? Convert.ToBase64String(Encoding.UTF8.GetBytes(Json.Serialize(new Cursor { page = cursor.page + 1, cookie = page.PagingCookie, filter = fingerprint }))) : null,
                categories = Rules.Labels.Select(label => new { label = label, value = categories[label] }).ToArray() };
        }
        private sealed class Totals { public decimal debit { get; set; } public decimal credit { get; set; } public decimal net { get { return credit - debit; } } public int count { get; set; } }
        private static Totals Aggregate(IOrganizationService caller, FilterExpression criteria)
        {
            // Convert validated QueryExpression filters using the supported SDK message;
            // FetchXML aggregation covers all pages and fails on platform aggregate limits.
            var convert = new OrganizationRequest("QueryExpressionToFetchXml"); convert["Query"] = new QueryExpression(Table) { ColumnSet = new ColumnSet(false), Criteria = criteria };
            var xml = (string)caller.Execute(convert)["FetchXml"];
            var document = new System.Xml.XmlDocument(); document.LoadXml(xml); document.DocumentElement.SetAttribute("aggregate", "true");
            var entity = document.DocumentElement.SelectSingleNode("entity");
            foreach (System.Xml.XmlNode node in entity.SelectNodes("attribute")) entity.RemoveChild(node);
            foreach (var definition in new[] { new[] { "a365_amount", "amount", "sum" }, new[] { Table + "id", "count", "count" } })
            { var attribute = document.CreateElement("attribute"); attribute.SetAttribute("name", definition[0]); attribute.SetAttribute("alias", definition[1]); attribute.SetAttribute("aggregate", definition[2]); entity.AppendChild(attribute); }
            var direction = document.CreateElement("attribute"); direction.SetAttribute("name", "a365_direction"); direction.SetAttribute("alias", "direction"); direction.SetAttribute("groupby", "true"); entity.AppendChild(direction);
            var totals = new Totals();
            foreach (var row in caller.RetrieveMultiple(new FetchExpression(document.OuterXml)).Entities)
            {
                var value = Convert.ToDecimal(row.GetAttributeValue<AliasedValue>("amount").Value, CultureInfo.InvariantCulture);
                var side = Convert.ToString(row.GetAttributeValue<AliasedValue>("direction").Value, CultureInfo.InvariantCulture);
                if (side == "debit") totals.debit += value; else if (side == "credit") totals.credit += value; else Rules.Fail("A ledger direction requires review.");
                totals.count += Convert.ToInt32(row.GetAttributeValue<AliasedValue>("count").Value, CultureInfo.InvariantCulture);
            }
            return totals;
        }
        private sealed class HistoryPeriod { public Guid Id; public string Name; public int Employees; public int Missing; public decimal Total; public string Error; }
        private sealed class HistoryData { public List<HistoryPeriod> Periods = new List<HistoryPeriod>(); public List<Entity> Manual; }
        private static HistoryData PreviewData(IOrganizationService caller, Dictionary<string, int> categories)
        {
            var data = new HistoryData(); var manualFilter = Where("a365_category", categories["Payroll"]);
            manualFilter.AddCondition("a365_sourceperiod", ConditionOperator.Null);
            var review = new FilterExpression(LogicalOperator.Or); review.AddCondition("a365_historyreviewed", ConditionOperator.Null); review.AddCondition("a365_historyreviewed", ConditionOperator.Equal, false); manualFilter.AddFilter(review);
            data.Manual = Read(caller, Table, manualFilter);
            var paid = new FilterExpression(LogicalOperator.Or); paid.AddCondition("a365_payrollstatus", ConditionOperator.Equal, Rules.Paid); paid.AddCondition("a365_payrollstatus", ConditionOperator.Equal, Rules.Locked);
            var periods = Read(caller, "a365_payrollperiod", paid);
            if (periods.Count > 200) Rules.Fail("History preview exceeds the verified 200-period limit. Contact your administrator for paged staging.");
            foreach (var period in periods)
            {
                var result = new HistoryPeriod { Id = period.Id, Name = period.GetAttributeValue<string>("a365_name") };
                if (!period.Contains("a365_paidon") || period.GetAttributeValue<DateTime>("a365_paidon").Year < 1900) result.Error = "Missing valid Paid On; skipped.";
                else
                {
                    // Validation exceptions are business validation only; never catch an
                    // OrganizationService fault and continue a damaged transaction.
                    var entries = Read(caller, "a365_payrollentry", Where("a365_payrollperiod", period.Id));
                    result.Employees = entries.Count;
                    if (entries.Count > 200 || entries.Any(entry => entry.GetAttributeValue<EntityReference>("a365_employee") == null || entry.GetAttributeValue<Money>("a365_netpay") == null)) result.Error = "Unreliable employee/net-pay source; review required.";
                    else if (entries.GroupBy(entry => entry.GetAttributeValue<EntityReference>("a365_employee").Id).Any(group => group.Count() > 1)) result.Error = "Duplicate source employees; review required.";
                    else
                    {
                        var linked = Read(caller, Table, Where("a365_sourceperiod", period.Id));
                        var missing = entries.Where(entry => !linked.Any(row => row.GetAttributeValue<EntityReference>("a365_sourceemployee") != null && row.GetAttributeValue<EntityReference>("a365_sourceemployee").Id == entry.GetAttributeValue<EntityReference>("a365_employee").Id)).ToList();
                        result.Missing = missing.Count; result.Total = missing.Sum(entry => entry.GetAttributeValue<Money>("a365_netpay").Value);
                    }
                }
                data.Periods.Add(result);
            }
            return data;
        }
        private static object Preview(IOrganizationService caller, Dictionary<string, int> categories, string revision)
        {
            var data = PreviewData(caller, categories);
            return new { revision = revision, missing = data.Periods.Where(period => period.Error == null).Sum(period => period.Missing), manual = data.Manual.Select(row => Row(row, caller)).ToArray(),
                periods = data.Periods.Select(period => new { id = period.Id.ToString("D"), name = period.Name, employees = period.Employees, missing = period.Missing, total = period.Total, error = period.Error }).ToArray() };
        }
        private static object Sources(IOrganizationService caller, Guid period)
        { return new { rows = Entries(caller, period).Select(entry => new { id = entry.Id.ToString("D"), employeeId = entry.GetAttributeValue<EntityReference>("a365_employee").Id.ToString("D"), name = entry.GetAttributeValue<string>("a365_name"), amount = entry.GetAttributeValue<Money>("a365_netpay").Value }).ToArray() }; }
        private static object Link(Request request, IOrganizationService caller, Dictionary<string, int> categories)
        {
            var row = Required(caller, Table, Rules.Id(request.id)); MatchVersion(row, request.version);
            if (row.Contains("a365_sourceperiod") || row.GetAttributeValue<OptionSetValue>("a365_category").Value != categories["Payroll"]) Rules.Fail("Only unlinked manual Payroll rows can be reviewed.");
            var update = new Entity(Table, row.Id);
            if (request.command == "reviewManual") update["a365_historyreviewed"] = true;
            else
            {
                var entry = Required(caller, "a365_payrollentry", Rules.Id(request.entryId));
                var period = entry.GetAttributeValue<EntityReference>("a365_payrollperiod"); var employee = entry.GetAttributeValue<EntityReference>("a365_employee");
                if (period == null || employee == null) Rules.Fail("Review the payroll source before linking.");
                var existing = Read(caller, Table, Where("a365_sourceperiod", period.Id));
                if (existing.Any(item => item.GetAttributeValue<EntityReference>("a365_sourceemployee") != null && item.GetAttributeValue<EntityReference>("a365_sourceemployee").Id == employee.Id)) Rules.Fail("This source already has a linked ledger row.");
                update["a365_sourceperiod"] = period; update["a365_sourceemployee"] = employee; update["a365_sourceentry"] = entry.Id.ToString("D"); update["a365_sourcekey"] = period.Id.ToString("D") + "/" + employee.Id.ToString("D");
            }
            caller.Update(update); return new { id = row.Id.ToString("D") };
        }
        private static object HistoryStep(Request request, IPluginExecutionContext context, IOrganizationService caller, Dictionary<string, int> categories)
        {
            var work = Required(caller, Job, Rules.Id(request.id));
            if (work.GetAttributeValue<string>("a365_attempt") != request.version || work.GetAttributeValue<string>("a365_status") != "queued") Rules.Fail("This background attempt is no longer queued.");
            // Preview and review are rechecked at execution, not just in the browser.
            var filter = Where("a365_category", categories["Payroll"]); filter.AddCondition("a365_sourceperiod", ConditionOperator.Null);
            var review = new FilterExpression(LogicalOperator.Or); review.AddCondition("a365_historyreviewed", ConditionOperator.Null); review.AddCondition("a365_historyreviewed", ConditionOperator.Equal, false); filter.AddFilter(review);
            if (Read(caller, Table, filter).Count != 0) Rules.Fail("Review unlinked manual Payroll rows before historical posting.");
            var period = Required(caller, "a365_payrollperiod", work.GetAttributeValue<EntityReference>("a365_period").Id);
            var status = period.GetAttributeValue<OptionSetValue>("a365_payrollstatus").Value;
            if ((status != Rules.Paid && status != Rules.Locked) || !period.Contains("a365_paidon") || period.GetAttributeValue<DateTime>("a365_paidon").Year < 1900) Rules.Fail("The source is no longer paid with a valid Paid On date. Review it before retrying.");
            var counts = Synchronize(caller, period, period.GetAttributeValue<DateTime>("a365_paidon"), categories["Payroll"], context.InitiatingUserId, true);
            var update = new Entity(Job, work.Id); update["a365_status"] = "completed"; update["a365_createdcount"] = counts[0]; update["a365_skippedcount"] = counts[3]; update["a365_failedcount"] = 0; update["a365_error"] = ""; caller.Update(update);
            return JobResult(Required(caller, Job, work.Id));
        }
        private static object JobResult(Entity row) { return new { id = row.Id.ToString("D"), status = row.GetAttributeValue<string>("a365_status"), created = row.GetAttributeValue<int>("a365_createdcount"), skipped = row.GetAttributeValue<int>("a365_skippedcount"), failed = row.GetAttributeValue<int>("a365_failedcount"), error = row.GetAttributeValue<string>("a365_error") ?? "", period = row.GetAttributeValue<string>("a365_name") }; }
    }
    /// <summary>PreOperation sync on every ledger write path and financial period
    /// metadata update. Guards trust only platform API ancestry, never client flags.</summary>
    public sealed class ProtectLedgerWrites : IPlugin
    {
        public void Execute(IServiceProvider services)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            if (context.IsInTransaction) for (var parent = context.ParentContext; parent != null; parent = parent.ParentContext) if (parent.MessageName == LedgerCommand.Api && parent.IsInTransaction) return;
            Rules.Fail("Use the validated Ledger command for ledger writes and payroll payment.");
        }
    }
    /// <summary>PreOperation period Update (including bulk registration).
    /// Mark Ready and audited Unlock stay with the existing payroll workflow.</summary>
    public sealed class ProtectPayrollPayment : IPlugin
    {
        public void Execute(IServiceProvider services)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            if (context.IsInTransaction) for (var parent = context.ParentContext; parent != null; parent = parent.ParentContext) if (parent.MessageName == LedgerCommand.Api && parent.IsInTransaction) return;
            var targets = new List<Entity>();
            if (context.InputParameters.Contains("Target") && context.InputParameters["Target"] is Entity) targets.Add((Entity)context.InputParameters["Target"]);
            if (context.InputParameters.Contains("Targets") && context.InputParameters["Targets"] is EntityCollection) targets.AddRange(((EntityCollection)context.InputParameters["Targets"]).Entities);
            foreach (var target in targets)
            {
                var status = target.GetAttributeValue<OptionSetValue>("a365_payrollstatus");
                if ((status != null && (status.Value == Rules.Locked || status.Value == Rules.Paid)) || target.Contains("a365_paidon") || target.Contains("a365_paidby") || target.Contains("a365_lockedby") || (target.Contains("a365_lockedon") && target["a365_lockedon"] != null)) Rules.Fail("Use Mark as Paid to atomically pay payroll and post Ledger entries.");
            }
        }
    }
    /// <summary>PreOperation for all payroll-entry writes. Lock the parent so
    /// concurrent entry changes cannot race atomic payment. Inspect BOTH parents
    /// when moving an entry; changing a lookup cannot evade finalized protection.</summary>
    public sealed class ProtectPayrollEntries : IPlugin
    {
        public void Execute(IServiceProvider services)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            if (!context.IsInTransaction) Rules.Fail("Payroll entry validation requires a server transaction.");
            if (context.MessageName == "Upsert" || context.MessageName == "UpsertMultiple") Rules.Fail("Use the validated payroll create or update operation.");
            var factory = (IOrganizationServiceFactory)services.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.UserId);
            bool confirmedDeletion = false;
            if (context.MessageName == "Delete") for (var ancestor = context.ParentContext; ancestor != null; ancestor = ancestor.ParentContext) if (ancestor.IsInTransaction && (ancestor.MessageName == "a365_DeletePayrollPeriod" || ancestor.MessageName == "a365_DeletePayrollEntry")) confirmedDeletion = true;
            var parents = new HashSet<Guid>(); var targets = new List<Entity>();
            if (context.InputParameters.Contains("Targets") && context.InputParameters["Targets"] is EntityCollection) targets.AddRange(((EntityCollection)context.InputParameters["Targets"]).Entities);
            else if (context.InputParameters.Contains("Target"))
            {
                var target = context.InputParameters["Target"] as Entity; var reference = context.InputParameters["Target"] as EntityReference;
                if (target != null) targets.Add(target); else if (reference != null) targets.Add(new Entity(reference.LogicalName, reference.Id));
            }
            if (targets.Count == 0) Rules.Fail("The payroll write target is missing.");
            foreach (var target in targets)
            {
                if (context.MessageName != "Create" && context.MessageName != "CreateMultiple")
                {
                    var current = caller.Retrieve("a365_payrollentry", target.Id, new ColumnSet("a365_payrollperiod"));
                    var original = current.GetAttributeValue<EntityReference>("a365_payrollperiod");
                    if (original == null) Rules.Fail("The source payroll period is missing."); parents.Add(original.Id);
                }
                if (target.Contains("a365_payrollperiod"))
                {
                    var changed = target.GetAttributeValue<EntityReference>("a365_payrollperiod"); if (changed == null) Rules.Fail("Select a payroll period."); parents.Add(changed.Id);
                }
            }
            if (parents.Count == 0) Rules.Fail("Select a payroll period.");
            foreach (var id in parents.OrderBy(value => value))
            {
                var period = caller.Retrieve("a365_payrollperiod", id, new ColumnSet("a365_payrollstatus", "statecode", "a365_name", "versionnumber"));
                var status = period.GetAttributeValue<OptionSetValue>("a365_payrollstatus");
                if (period.GetAttributeValue<OptionSetValue>("statecode") == null || (period.GetAttributeValue<OptionSetValue>("statecode").Value != 0 && !confirmedDeletion) || status == null || (status.Value != 749910001 && status.Value != 749910000)) Rules.Fail("Finalized or archived payroll entries cannot be modified. Use the audited unlock workflow first.");
                if (string.IsNullOrEmpty(period.RowVersion) && period.Contains("versionnumber")) period.RowVersion = Convert.ToString(period["versionnumber"], CultureInfo.InvariantCulture);
                if (string.IsNullOrEmpty(period.RowVersion)) Rules.Fail("Payroll concurrency metadata is unavailable.");
                var update = new Entity("a365_payrollperiod", id) { RowVersion = period.RowVersion }; update["a365_name"] = period.GetAttributeValue<string>("a365_name");
                caller.Execute(new UpdateRequest { Target = update, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
            }
        }
    }
    /// <summary>Register async PostOperation on history Create and Update of
    /// a365_attempt. Each worker calls a synchronous API for one atomic period.
    /// The Dataverse async service retains/retries work independently of a tab.</summary>
    public sealed class HistoryWorker : IPlugin
    {
        public void Execute(IServiceProvider services)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)services.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var work = LedgerCommand.Required(caller, LedgerCommand.Job, context.PrimaryEntityId);
            if (work.GetAttributeValue<string>("a365_status") != "queued") return;
            var json = new JavaScriptSerializer();
            var attempt = work.GetAttributeValue<string>("a365_attempt");
            // Same operation ID across async redelivery. A committed receipt
            // returns its old result without modifying subsequent manual edits.
            try
            {
                var command = new OrganizationRequest(LedgerCommand.Api);
                command["Request"] = json.Serialize(new Request { command = "historyStep", id = work.Id.ToString("D"), operationId = attempt, version = attempt });
                caller.Execute(command);
            }
            catch (Exception error)
            {
                // This async context has no transaction to continue after a fault.
                // First check committed state; a timed-out successful command
                // must never be downgraded to a failure.
                var status = new OrganizationRequest(LedgerCommand.Api); status["Request"] = json.Serialize(new Request { command = "operation", operationId = attempt });
                var response = caller.Execute(status);
                var receipt = json.Deserialize<Dictionary<string, object>>((string)response["Response"]);
                if ((bool)receipt["completed"]) return;
                var fail = new OrganizationRequest(LedgerCommand.Api);
                fail["Request"] = json.Serialize(new Request { command = "historyFail", id = work.Id.ToString("D"), operationId = Rules.SourceId(work.Id, Rules.Id(attempt)).ToString("D"), version = attempt });
                try { caller.Execute(fail); }
                catch { throw new InvalidPluginExecutionException(OperationStatus.Retry, 0, "Ledger history attempt requires retry: " + error.GetType().Name); }
            }
        }
    }
}
