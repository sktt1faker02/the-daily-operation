using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

namespace A365.Leave.Plugins
{
    public sealed class ConversionChange
    {
        public string id { get; set; }
        public string employeeId { get; set; }
        public decimal? availableVL { get; set; }
        public decimal? days { get; set; }
    }
    public static class ConversionCommands
    {
        private const string Header = "a365_leaveconversionyear";
        private const string Detail = "a365_leavecashconversion";
        private static readonly string[] HeaderColumns = { "a365_year", "a365_name", "versionnumber", "statecode" };
        private static readonly string[] DetailColumns = { "a365_employee", "a365_conversionyear", "a365_year", "a365_name", "a365_availablevl", "a365_days", "a365_dailyrateused", "a365_amount", "a365_conversionstatus", "a365_convertedby", "a365_convertedon" };
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        public sealed class Cursor { public int page { get; set; } public string cookie { get; set; } }

        public static object Execute(Request request, IPluginExecutionContext context, IOrganizationService caller)
        {
            // LeaveCommand checks actual direct/team Payroll Admin membership
            // before dispatch. Business reads and writes retain caller privileges.
            if (request.command == "conversionYears") return Years(caller);
            if (request.command == "conversionCreate") return Create(request, context, caller);
            if (request.command == "conversionRows") return Rows(request, caller);
            if (request.command == "conversionSave") return Save(request, context, caller);
            if (request.command == "conversionMarkPaid") return MarkPaid(request, caller);
            Rules.Fail("Unknown conversion command."); return null;
        }
        private static QueryExpression Query(string table, params string[] columns) { return new QueryExpression(table) { ColumnSet = new ColumnSet(columns) }; }
        private static List<Entity> All(IOrganizationService service, QueryExpression query)
        {
            var rows = new List<Entity>(); var cookies = new HashSet<string>();
            query.PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 };
            query.AddOrder(query.EntityName + "id", OrderType.Ascending);
            while (true)
            {
                var page = service.RetrieveMultiple(query); rows.AddRange(page.Entities);
                if (!page.MoreRecords) return rows;
                if (String.IsNullOrEmpty(page.PagingCookie) || !cookies.Add(page.PagingCookie) || ++query.PageInfo.PageNumber > 1000) Rules.Fail("Complete conversion data could not be verified.");
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
        }
        private static int NextYear(IOrganizationService caller, List<Entity> headers)
        {
            int highest = headers.Select(h => h.GetAttributeValue<int>("a365_year")).DefaultIfEmpty(0).Max();
            var query = Query(Detail, "a365_year"); query.TopCount = 1; query.AddOrder("a365_year", OrderType.Descending);
            var legacy = caller.RetrieveMultiple(query).Entities.FirstOrDefault();
            if (legacy != null) highest = Math.Max(highest, legacy.GetAttributeValue<int>("a365_year"));
            return highest == 0 ? DateTime.UtcNow.AddHours(8).Year : highest + 1;
        }
        private static object Years(IOrganizationService caller)
        {
            var headers = All(caller, Query(Header, HeaderColumns));
            int next = NextYear(caller, headers);
            return new { years = headers.OrderByDescending(h => h.GetAttributeValue<int>("a365_year")).Select(Year).ToArray(), nextYear = next > 9998 ? (int?)null : next };
        }
        private static object Year(Entity row)
        {
            return new { id = row.Id.ToString("D"), year = row.GetAttributeValue<int>("a365_year"), version = row.GetAttributeValue<long>("versionnumber").ToString(CultureInfo.InvariantCulture), paid = IsPaid(row) };
        }
        // Annual headers use their existing inactive state as the paid lock.
        private static bool IsPaid(Entity header) { var state = header.GetAttributeValue<OptionSetValue>("statecode"); return state != null && state.Value == 1; }
        private static object MarkPaid(Request request, IOrganizationService caller)
        {
            var header = ForYear(caller, request.year);
            if (header.Id.ToString("D") != request.operationId || String.IsNullOrEmpty(request.version)) Rules.Fail("The conversion transaction could not be verified.");
            if (IsPaid(header)) return Year(header);
            if (header.GetAttributeValue<long>("versionnumber").ToString(CultureInfo.InvariantCulture) != request.version) Rules.Fail("This transaction changed in another session. Reload the year before marking it as paid.");
            var paid = new Entity(Header, header.Id) { RowVersion = request.version };
            paid["statecode"] = new OptionSetValue(1); paid["statuscode"] = new OptionSetValue(2);
            caller.Execute(new UpdateRequest { Target = paid, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
            return Year(caller.Retrieve(Header, header.Id, new ColumnSet(HeaderColumns)));
        }
        private static Entity Find(IOrganizationService caller, string table, string field, object value, string[] columns)
        {
            var query = Query(table, columns); query.TopCount = 2; query.Criteria.AddCondition(field, ConditionOperator.Equal, value);
            var rows = caller.RetrieveMultiple(query).Entities;
            if (rows.Count > 1) Rules.Fail("Duplicate conversion data needs administrator review.");
            return rows.FirstOrDefault();
        }
        private static Entity ForYear(IOrganizationService caller, int year)
        {
            if (year < 1900 || year > 9998) Rules.Fail("Select a valid year.");
            var row = Find(caller, Header, "a365_year", year, HeaderColumns);
            if (row == null) Rules.Fail("This conversion year does not exist. Add a new transaction first.");
            return row;
        }
        public static decimal Rate(decimal salary) { if (salary < 0) Rules.Fail("Monthly basic salary is missing or invalid."); return Decimal.Round(salary / 22m, 2, MidpointRounding.AwayFromZero); }
        public static decimal Amount(decimal rate, decimal days) { return Decimal.Round(rate * days, 2, MidpointRounding.AwayFromZero); }
        public static void Validate(decimal available, decimal days)
        {
            if (available < 0 || available > 1000000000m || days < 0 || days > 5 || days > available || Decimal.Round(available, 2) != available || Decimal.Round(days, 2) != days) Rules.Fail("Enter nonnegative values with two decimals; VL to convert cannot exceed Available VL or 5.00.");
        }
        private static Entity Employee(IOrganizationService caller, Guid id)
        {
            var employee = caller.Retrieve("a365_employee", id, new ColumnSet("a365_name", "a365_employeenumber", "a365_basicmonthlysalary", "a365_employmentstatus"));
            if (employee.GetAttributeValue<OptionSetValue>("a365_employmentstatus") == null || employee.GetAttributeValue<OptionSetValue>("a365_employmentstatus").Value != 749910000) Rules.Fail("Only Active employees can be added to a conversion transaction.");
            if (!employee.Contains("a365_basicmonthlysalary")) Rules.Fail("An Active employee has no monthly basic salary. Update the employee before creating the transaction.");
            return employee;
        }
        private static Entity NewRow(Guid id, Entity header, Entity employee, Guid actor)
        {
            var row = new Entity(Detail, id);
            var salary = employee.GetAttributeValue<Money>("a365_basicmonthlysalary");
            if (salary == null) Rules.Fail("An Active employee has no monthly basic salary.");
            decimal rate = Rate(salary.Value);
            row["a365_employee"] = employee.ToEntityReference(); row["a365_conversionyear"] = header.ToEntityReference();
            row["a365_year"] = header.GetAttributeValue<int>("a365_year"); row["a365_name"] = "VL conversion " + row["a365_year"];
            row["a365_availablevl"] = 10m; row["a365_days"] = 5m;
            row["a365_dailyrateused"] = new Money(rate); row["a365_amount"] = new Money(Amount(rate, 5m));
            row["a365_conversionstatus"] = new OptionSetValue(749910000);
            row["a365_convertedby"] = new EntityReference("systemuser", actor); row["a365_convertedon"] = DateTime.UtcNow;
            return row;
        }
        private static object Create(Request request, IPluginExecutionContext context, IOrganizationService caller)
        {
            Guid id;
            if (!Guid.TryParse(request.operationId, out id)) { Rules.Fail("A stable conversion operation identity is required."); return null; }
            var prior = Find(caller, Header, Header + "id", id, HeaderColumns);
            if (prior != null) { if (prior.GetAttributeValue<int>("a365_year") != request.year) Rules.Fail("The conversion operation identity does not match its year."); return Year(prior); }
            var headers = All(caller, Query(Header, HeaderColumns));
            int year = NextYear(caller, headers);
            if (year != request.year || year > 9998) Rules.Fail("That conversion year already exists or the year list has changed. Reload the year list before creating a transaction.");
            var employees = Query("a365_employee", "a365_name", "a365_employeenumber", "a365_basicmonthlysalary", "a365_employmentstatus");
            employees.Criteria.AddCondition("a365_employmentstatus", ConditionOperator.Equal, 749910000);
            var roster = All(caller, employees);
            var header = new Entity(Header, id); header["a365_year"] = year; header["a365_name"] = "Leave Conversion " + year;
            header["statecode"] = new OptionSetValue(0); header["statuscode"] = new OptionSetValue(1);
            // Validate every salary before the first write. All writes still
            // participate in the surrounding synchronous API transaction.
            var rows = roster.Select(e => NewRow(Guid.NewGuid(), header, e, context.InitiatingUserId)).ToArray();
            try { caller.Create(header); foreach (var row in rows) caller.Create(row); }
            catch { Rules.Fail("The transaction could not be created. Its year may already exist; reload the year list and retry. No partial transaction was saved."); }
            return Year(caller.Retrieve(Header, id, new ColumnSet(HeaderColumns)));
        }
        private static object Rows(Request request, IOrganizationService caller)
        {
            var header = ForYear(caller, request.year);
            var query = Query(Detail, DetailColumns);
            query.Criteria.AddCondition("a365_conversionyear", ConditionOperator.Equal, header.Id);
            query.AddOrder("a365_name", OrderType.Ascending); query.AddOrder(Detail + "id", OrderType.Ascending);
            var cursor = new Cursor { page = 1 };
            if (!String.IsNullOrEmpty(request.cursor))
            {
                try { cursor = Json.Deserialize<Cursor>(request.cursor); } catch { Rules.Fail("Invalid conversion page."); }
                if (cursor == null || cursor.page < 2 || cursor.page > 10000 || String.IsNullOrEmpty(cursor.cookie)) Rules.Fail("Invalid conversion page.");
            }
            query.PageInfo = new PagingInfo { Count = 20, PageNumber = cursor.page, PagingCookie = cursor.cookie };
            var page = caller.RetrieveMultiple(query);
            var employeeIds = page.Entities.Select(r => r.GetAttributeValue<EntityReference>("a365_employee").Id).Distinct().ToArray();
            var employees = new Dictionary<Guid, Entity>();
            if (employeeIds.Length > 0)
            {
                var names = Query("a365_employee", "a365_name", "a365_employeenumber"); names.Criteria.AddCondition("a365_employeeid", ConditionOperator.In, employeeIds.Cast<object>().ToArray());
                employees = caller.RetrieveMultiple(names).Entities.ToDictionary(e => e.Id);
            }
            var rows = page.Entities.Select(r => {
                var employee = r.GetAttributeValue<EntityReference>("a365_employee"); Entity name;
                if (employee == null || !employees.TryGetValue(employee.Id, out name)) { Rules.Fail("The conversion employee could not be verified."); return null; }
                return new { id = r.Id.ToString("D"), employeeId = employee.Id.ToString("D"), employeeName = name.GetAttributeValue<string>("a365_name"), employeeNumber = name.GetAttributeValue<string>("a365_employeenumber") ?? "", dailyRate = r.GetAttributeValue<Money>("a365_dailyrateused").Value, availableVL = r.GetAttributeValue<decimal>("a365_availablevl"), days = r.GetAttributeValue<decimal>("a365_days"), amount = r.GetAttributeValue<Money>("a365_amount").Value };
            }).ToArray();
            var result = new Dictionary<string, object> { { "transaction", Year(header) }, { "rows", rows } };
            if (page.MoreRecords) { if (String.IsNullOrEmpty(page.PagingCookie)) Rules.Fail("The next conversion page could not be verified."); result["next"] = Json.Serialize(new Cursor { page = cursor.page + 1, cookie = page.PagingCookie }); }
            return result;
        }
        private static object Save(Request request, IPluginExecutionContext context, IOrganizationService caller)
        {
            var header = ForYear(caller, request.year);
            if (IsPaid(header)) Rules.Fail("This leave conversion is paid and locked. Its values cannot be changed.");
            if (header.Id.ToString("D") != request.operationId || String.IsNullOrEmpty(request.version)) Rules.Fail("The conversion transaction could not be verified.");
            if (request.changes == null || request.changes.Length == 0 || request.changes.Length > 5000) Rules.Fail("Submit between 1 and 5000 changed conversion rows.");
            var changes = new List<Entity>(); var employees = new HashSet<Guid>(); var ids = new HashSet<Guid>();
            foreach (var change in request.changes)
            {
                if (change == null || !change.availableVL.HasValue || !change.days.HasValue) Rules.Fail("Available VL and VL to convert are required numbers.");
                Guid id, employee;
                if (!Guid.TryParse(change.id, out id) || !Guid.TryParse(change.employeeId, out employee)) { Rules.Fail("Select a valid conversion employee."); return null; }
                if (!employees.Add(employee) || !ids.Add(id)) Rules.Fail("Duplicate conversion employees are not permitted.");
                Validate(change.availableVL.Value, change.days.Value);
                var query = Query(Detail, DetailColumns); query.TopCount = 2;
                query.Criteria.AddCondition("a365_conversionyear", ConditionOperator.Equal, header.Id); query.Criteria.AddCondition("a365_employee", ConditionOperator.Equal, employee);
                var existing = caller.RetrieveMultiple(query).Entities;
                if (existing.Count > 1) Rules.Fail("Duplicate employee records need review.");
                Entity row = existing.FirstOrDefault();
                if (row != null && (row.Id != id || row.GetAttributeValue<int>("a365_year") != request.year || row.GetAttributeValue<OptionSetValue>("a365_conversionstatus").Value != 749910000)) Rules.Fail("The conversion row cannot be modified.");
                var annual = Query(Detail, "a365_days");
                annual.Criteria.AddCondition("a365_employee", ConditionOperator.Equal, employee);
                annual.Criteria.AddCondition("a365_year", ConditionOperator.Equal, request.year);
                annual.Criteria.AddCondition("a365_conversionstatus", ConditionOperator.Equal, 749910000);
                decimal otherDays = All(caller, annual).Where(r => r.Id != id).Sum(r => r.GetAttributeValue<decimal>("a365_days"));
                if (otherDays + change.days.Value > 5m) Rules.Fail("The employee annual conversion total cannot exceed 5.00 days.");
                if (row != null && row.GetAttributeValue<decimal>("a365_availablevl") == change.availableVL && row.GetAttributeValue<decimal>("a365_days") == change.days && row.GetAttributeValue<Money>("a365_amount").Value == Amount(row.GetAttributeValue<Money>("a365_dailyrateused").Value, change.days.Value)) continue;
                bool create = row == null;
                if (create) row = NewRow(id, header, Employee(caller, employee), context.InitiatingUserId);
                decimal rate = row.GetAttributeValue<Money>("a365_dailyrateused").Value;
                var write = create ? row : new Entity(Detail, row.Id);
                write["a365_availablevl"] = change.availableVL.Value; write["a365_days"] = change.days.Value; write["a365_amount"] = new Money(Amount(rate, change.days.Value));
                // EntityState is local planning metadata, never a business column.
                write.EntityState = create ? EntityState.Created : EntityState.Changed;
                changes.Add(write);
            }
            // An uncertain-response retry whose requested values are already
            // stored is a no-op, even if its original row version is now stale.
            if (changes.Count == 0) return Year(header);
            if (header.GetAttributeValue<long>("versionnumber").ToString(CultureInfo.InvariantCulture) != request.version) Rules.Fail("This transaction changed in another session. Keep your edits and reopen the year to review the latest values.");
            var gate = new Entity(Header, header.Id) { RowVersion = request.version }; gate["a365_name"] = header.GetAttributeValue<string>("a365_name");
            caller.Execute(new UpdateRequest { Target = gate, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
            foreach (var row in changes) { bool create = row.EntityState == EntityState.Created; row.EntityState = null; if (create) caller.Create(row); else caller.Update(row); }
            return Year(caller.Retrieve(Header, header.Id, new ColumnSet(HeaderColumns)));
        }
    }
}
