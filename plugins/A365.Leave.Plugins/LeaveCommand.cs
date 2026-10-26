using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

[assembly: System.Reflection.AssemblyVersion("1.0.3.0")]

namespace A365.Leave.Plugins
{
    public sealed class Request
    {
        public string command { get; set; }
        public string employeeId { get; set; }
        public string operationId { get; set; }
        public int leaveType { get; set; }
        public int benefit { get; set; }
        public string startDate { get; set; }
        public string endDate { get; set; }
        public string note { get; set; }
        public string attempt { get; set; }
        public string outcome { get; set; }
        public bool reviewedUnknown { get; set; }
        public int year { get; set; }
        public string cursor { get; set; }
        public string version { get; set; }
        public ConversionChange[] changes { get; set; }
    }
    public sealed class Holiday { public string date { get; set; } public string name { get; set; } }
    public sealed class Coverage { public int year { get; set; } public bool complete { get; set; } }
    public sealed class Policy
    {
        public string version { get; set; }
        public Holiday[] holidays { get; set; }
        public Coverage[] calendars { get; set; }
    }
    public static class Rules
    {
        public static DateTime Day(string value)
        {
            DateTime date;
            if (!DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date)) Fail("Enter valid start and end dates.");
            return date;
        }
        public static string Iso(DateTime value) { return value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture); }
        public static readonly DateTime JanuaryResetEffective = new DateTime(2027, 1, 5);
        public static DateTime Period(DateTime day)
        {
            // Preserve the existing credit cycle until the owner's effective date.
            if (day < JanuaryResetEffective) return new DateTime(day.Month < 4 ? day.Year - 1 : day.Year, 4, 1);
            var reset = new DateTime(day.Year, 1, 5);
            return day < reset ? reset.AddYears(-1) : reset;
        }
        public static DateTime PeriodEnd(DateTime period)
        {
            var end = period.AddYears(1).AddDays(-1);
            return period < JanuaryResetEffective && end >= JanuaryResetEffective
                ? JanuaryResetEffective.AddDays(-1) : end;
        }
        public static decimal Accrual(int number) { return Math.Round(10m * number / 12m, 2, MidpointRounding.AwayFromZero) - Math.Round(10m * (number - 1) / 12m, 2, MidpointRounding.AwayFromZero); }
        public static decimal Days(DateTime start, DateTime end, Policy policy)
        {
            if (end < start) Fail("End Date cannot precede Start Date.");
            if (Period(start) != Period(end)) Fail("Split leave at the balance-period reset boundary.");
            var holidays = policy.holidays.ToDictionary(h => h.date, h => h.name);
            if (holidays.ContainsKey(Iso(start)) || holidays.ContainsKey(Iso(end))) Fail("Leave cannot start or end on a Philippine holiday.");
            if (Weekend(start) || Weekend(end)) Fail("Start and end dates must be Monday–Friday workdays.");
            decimal total = 0;
            for (var day = start; day <= end; day = day.AddDays(1))
            {
                if (!policy.calendars.Any(c => c.year == day.Year && c.complete)) Fail("The holiday calendar for this year is incomplete; pending Eid declarations must be verified first.");
                if (!Weekend(day) && !holidays.ContainsKey(Iso(day))) total++;
            }
            if (total <= 0) Fail("Select at least one workday.");
            return total;
        }
        private static bool Weekend(DateTime day) { return day.DayOfWeek == DayOfWeek.Saturday || day.DayOfWeek == DayOfWeek.Sunday; }
        public static int Benefit(int requested, decimal balance, decimal days) { return requested == 749910000 && balance >= days ? 749910000 : 749910001; }
        public static void Fail(string message) { throw new InvalidPluginExecutionException("LEAVE: " + message); }
    }

    /// <summary>Unbound synchronous Custom API action. All writes use this
    /// database transaction; never execute ExecuteTransaction here.</summary>
    public sealed class LeaveCommand : IPlugin
    {
        internal const string Api = "a365_LeaveCommand";
        private const string Ledger = "a365_leavecredittransaction";
        private const string Source = "a365_leave";
        private static JavaScriptSerializer Json { get { return new JavaScriptSerializer { MaxJsonLength = 100000 }; } }

        public void Execute(IServiceProvider services)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)services.GetService(typeof(ITracingService));
            if (tracing != null) tracing.Trace("LeaveCommand message={0} stage={1} depth={2} transaction={3}", context.MessageName, context.Stage, context.Depth, context.IsInTransaction);
            if (context.MessageName != Api || !context.IsInTransaction) Rules.Fail("The Leave command requires a synchronous database transaction.");
            var factory = (IOrganizationServiceFactory)services.GetService(typeof(IOrganizationServiceFactory));
            var system = factory.CreateOrganizationService(null);
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            RequireAdmin(system, context.InitiatingUserId);
            Request request;
            try { request = new JavaScriptSerializer { MaxJsonLength = 2000000 }.Deserialize<Request>((string)context.InputParameters["Request"]); }
            catch { Rules.Fail("The Leave request is invalid."); return; }
            if (request == null) Rules.Fail("The Leave request is missing.");
            if (request.command == "conversionYears" || request.command == "conversionRows" || request.command == "conversionCreate" || request.command == "conversionSave" || request.command == "conversionMarkPaid")
            {
                context.OutputParameters["Response"] = Json.Serialize(ConversionCommands.Execute(request, context, caller));
                return;
            }
            object response;
            if (request.command == "diagnostics") response = new { policyVersion = "2026-10-22.1", isInTransaction = context.IsInTransaction, serverValidation = true };
            else if (request.command == "prepareEmail" || request.command == "completeEmail") response = Email(request, system, caller);
            else if (request.command == "preview" || request.command == "issue") response = Post(request, context, system, caller);
            else { Rules.Fail("Unknown Leave command."); return; }
            context.OutputParameters["Response"] = Json.Serialize(response);
        }

        private object Post(Request request, IPluginExecutionContext context, IOrganizationService system, IOrganizationService caller)
        {
            Guid employeeId;
            if (!Guid.TryParse(request.employeeId, out employeeId)) { Rules.Fail("Select an employee."); return null; }
            // Reads under caller privileges, not elevated business access.
            var employee = caller.Retrieve("a365_employee", employeeId, new ColumnSet("a365_name", "a365_employmentstatus", "a365_datehired", "a365_enddate", "a365_workemail"));
            // Preview must not post credits or change records when the admin
            // later cancels the form. Only Issue takes the posting lock.
            if (request.command == "issue") Lock(system, employeeId);
            Guid operationId;
            if (request.command == "issue")
            {
                if (!Guid.TryParse(request.operationId, out operationId)) { Rules.Fail("A stable operation identity is required."); return null; }
                var prior = Find(caller, Source, "a365_leaveid", operationId);
                if (prior != null)
                {
                    Match(prior, request, employeeId);
                    return Result(prior);
                }
            }
            else operationId = Guid.Empty;

            var status = employee.GetAttributeValue<OptionSetValue>("a365_employmentstatus");
            if (status == null || (status.Value != 749910000 && status.Value != 749910002)) Rules.Fail("Only Active or On Leave employees can receive leave.");
            var today = DateTime.UtcNow.AddHours(8).Date;
            var period = Rules.Period(today);
            if (!employee.Contains("a365_datehired")) Rules.Fail("The employee hire date is required for eligibility and credit accrual.");
            var hired = employee.GetAttributeValue<DateTime>("a365_datehired").Date;
            var ended = employee.Contains("a365_enddate") ? employee.GetAttributeValue<DateTime>("a365_enddate").Date : DateTime.MaxValue.Date;
            if (hired > today || ended < today) Rules.Fail("The employee is outside their employment dates.");
            var policyRow = Find(system, "a365_leavepolicy", "a365_name", "active");
            if (policyRow == null) Rules.Fail("Leave policy has not been configured.");
            var policy = Json.Deserialize<Policy>(policyRow.GetAttributeValue<string>("a365_policyjson"));
            if (policy == null || policy.version != "2026-10-22.1") Rules.Fail("The Leave policy version is unsupported.");

            var rows = Read(caller, Ledger, "a365_employee", employeeId);
            if (rows.Any(r => String.IsNullOrEmpty(r.GetAttributeValue<string>("a365_creditperiod")))) Rules.Fail("Existing unallocated credit history needs review before posting; no historical data has been changed.");
            var recorded = rows.Where(r => r.GetAttributeValue<string>("a365_creditperiod") == Rules.Iso(period));
            decimal postedVL = recorded.Where(r => Choice(r, "a365_creditpool") == 749910000).Sum(r => r.GetAttributeValue<decimal>("a365_days"));
            decimal postedSL = recorded.Where(r => Choice(r, "a365_creditpool") == 749910001).Sum(r => r.GetAttributeValue<decimal>("a365_days"));
            EnsureCredits(caller, rows, employeeId, hired, period, today, request.command == "issue");
            var current = rows.Where(r => r.GetAttributeValue<string>("a365_creditperiod") == Rules.Iso(period));
            decimal vl = current.Where(r => Choice(r, "a365_creditpool") == 749910000).Sum(r => r.GetAttributeValue<decimal>("a365_days"));
            decimal sl = current.Where(r => Choice(r, "a365_creditpool") == 749910001).Sum(r => r.GetAttributeValue<decimal>("a365_days"));
            if (String.IsNullOrEmpty(request.startDate) && String.IsNullOrEmpty(request.endDate) && request.command == "preview")
                return new { policyVersion = policy.version, periodStart = Rules.Iso(period), periodEnd = Rules.Iso(Rules.PeriodEnd(period)), VL = vl, SL = sl, pendingVL = vl-postedVL, pendingSL = sl-postedSL, days = (decimal?)null, benefit = (int?)null, pool = (string)null };

            var start = Rules.Day(request.startDate);
            var end = Rules.Day(request.endDate);
            if (Rules.Period(start) != period || Rules.Period(end) != period) Rules.Fail("Leave must be within the current balance period shown in the credit preview.");
            if (start < hired || end > ended) Rules.Fail("Leave dates must fall within the employee's employment dates.");
            var days = Rules.Days(start, end, policy);
            if (request.leaveType < 749910000 || request.leaveType > 749910002 || (request.benefit != 749910000 && request.benefit != 749910001)) Rules.Fail("Select a valid leave type and benefit.");
            if ((request.note ?? "").Length > 2000) Rules.Fail("Note must be 2,000 characters or fewer.");
            var overlap = new QueryExpression(Source) { ColumnSet = new ColumnSet("a365_leaveid"), TopCount = 1 };
            overlap.Criteria.AddCondition("a365_employee", ConditionOperator.Equal, employeeId);
            overlap.Criteria.AddCondition("a365_leavestatus", ConditionOperator.Equal, 749910000);
            overlap.Criteria.AddCondition("a365_startdate", ConditionOperator.OnOrBefore, end);
            overlap.Criteria.AddCondition("a365_enddate", ConditionOperator.OnOrAfter, start);
            if (caller.RetrieveMultiple(overlap).Entities.Count != 0) Rules.Fail("These dates overlap an Issued leave record.");
            int pool = request.leaveType == 749910001 ? 749910001 : 749910000;
            int benefit = Rules.Benefit(request.benefit, pool == 749910000 ? vl : sl, days);
            if (request.command == "preview") return new { policyVersion = policy.version, periodStart = Rules.Iso(period), periodEnd = Rules.Iso(Rules.PeriodEnd(period)), VL = vl, SL = sl, pendingVL = vl-postedVL, pendingSL = sl-postedSL, days = (decimal?)days, benefit = (int?)benefit, pool = pool == 749910000 ? "VL" : "SL" };

            var leave = new Entity(Source, operationId);
            leave["a365_name"] = "Leave " + Rules.Iso(start) + " to " + Rules.Iso(end);
            leave["a365_employee"] = new EntityReference("a365_employee", employeeId);
            leave["a365_leavetype"] = new OptionSetValue(request.leaveType);
            leave["a365_benefit"] = new OptionSetValue(benefit);
            leave["a365_requestedbenefit"] = request.benefit;
            leave["a365_startdate"] = start; leave["a365_enddate"] = end;
            leave["a365_days"] = days; leave["a365_note"] = request.note ?? "";
            leave["a365_issuedby"] = new EntityReference("systemuser", context.InitiatingUserId);
            leave["a365_issuedon"] = DateTime.UtcNow;
            leave["a365_leavestatus"] = new OptionSetValue(749910000);
            leave["a365_notificationstatus"] = new OptionSetValue(749910000);
            caller.Create(leave);
            if (benefit == 749910000)
            {
                var deduction = Movement(employeeId, period, period >= Rules.JanuaryResetEffective ? period.Year : start.Year, pool, 749910002, -days, "LEAVE-" + operationId.ToString("D") + "-DEDUCTION", null);
                deduction["a365_leave"] = leave.ToEntityReference();
                caller.Create(deduction);
            }
            return Result(leave);
        }

        private static void EnsureCredits(IOrganizationService caller, List<Entity> rows, Guid employee, DateTime hired, DateTime period, DateTime today, bool persist)
        {
            if (period >= Rules.JanuaryResetEffective)
            {
                // Full annual allocation; no monthly accrual or previous-period carryover.
                Grant(caller, rows, employee, period, period.Year, 749910000, 749910001, 10m, "VL-" + Rules.Iso(period), persist);
                Grant(caller, rows, employee, period, period.Year, 749910001, 749910001, 5m, "SL-" + Rules.Iso(period), persist);
                return;
            }
            Grant(caller, rows, employee, period, period.Year, 749910001, 749910001, 5m, "SL-" + Rules.Iso(period), persist);
            int earned = 0;
            for (int month = 0; month < 12; month++)
            {
                var first = period.AddMonths(month); var last = first.AddMonths(1).AddDays(-1);
                if (first < hired || last >= today) continue;
                earned++;
                Grant(caller, rows, employee, period, last.Year, 749910000, 749910000, Rules.Accrual(earned), "VL-" + first.ToString("yyyy-MM", CultureInfo.InvariantCulture), persist);
            }
        }
        private static void Grant(IOrganizationService service, List<Entity> rows, Guid employee, DateTime period, int year, int pool, int type, decimal days, string key, bool persist)
        {
            key = "AUTO-" + Rules.Iso(period) + "-" + key;
            var old = rows.FirstOrDefault(r => r.GetAttributeValue<string>("a365_transactionkey") == key);
            if (old != null)
            {
                if (old.GetAttributeValue<decimal>("a365_days") != days || Choice(old, "a365_creditpool") != pool || Choice(old, "a365_transactiontype") != type || old.GetAttributeValue<string>("a365_creditperiod") != Rules.Iso(period)) Rules.Fail("An existing automatic credit conflicts with this policy; review is required.");
                return;
            }
            var row = Movement(employee, period, year, pool, type, days, key, key);
            row["a365_note"] = period >= Rules.JanuaryResetEffective
                ? "Annual January 5 reset effective 2027: 10 VL and 5 SL; no carryover or monthly accrual."
                : "Automatic credit under policy 2026-10-22.1. Monthly VL is earned in arrears; SL is granted for the April period.";
            if (persist) row.Id = service.Create(row);
            rows.Add(row);
        }
        private static Entity Movement(Guid employee, DateTime period, int year, int pool, int type, decimal days, string key, string periodKey)
        {
            var row = new Entity(Ledger);
            row["a365_name"] = key; row["a365_employee"] = new EntityReference("a365_employee", employee);
            row["a365_year"] = year; row["a365_creditperiod"] = Rules.Iso(period);
            row["a365_creditpool"] = new OptionSetValue(pool); row["a365_transactiontype"] = new OptionSetValue(type);
            row["a365_days"] = days; row["a365_transactionkey"] = key;
            if (periodKey != null) row["a365_periodkey"] = periodKey;
            return row;
        }

        private object Email(Request request, IOrganizationService system, IOrganizationService caller)
        {
            Guid id;
            if (!Guid.TryParse(request.operationId, out id)) { Rules.Fail("Select an existing Leave record."); return null; }
            var source = caller.Retrieve(Source, id, new ColumnSet(true));
            var employee = source.GetAttributeValue<EntityReference>("a365_employee");
            if (employee == null || Choice(source, "a365_leavestatus") != 749910000) Rules.Fail("Email requires an existing Issued leave.");
            Lock(system, employee.Id);
            source = caller.Retrieve(Source, id, new ColumnSet(true));
            var change = new Entity(Source, id);
            if (request.command == "completeEmail")
            {
                if (source.GetAttributeValue<string>("a365_emailattempt") != request.attempt || source.GetAttributeValue<string>("a365_emailoutcome") != "sending") Rules.Fail("This email attempt is no longer current. Do not resend automatically.");
                if (request.outcome != "accepted" && request.outcome != "failed" && request.outcome != "unknown") Rules.Fail("Invalid email outcome.");
                change["a365_emailoutcome"] = request.outcome;
                change["a365_notificationstatus"] = new OptionSetValue(request.outcome == "accepted" ? 749910001 : 749910002);
                if (request.outcome == "accepted") change["a365_notifiedon"] = DateTime.UtcNow;
                caller.Update(change);
                return new { outcome = request.outcome };
            }
            if (Choice(source, "a365_notificationstatus") == 749910001) return new { outcome = "accepted", alreadySent = true };
            var previous = source.GetAttributeValue<string>("a365_emailoutcome");
            if (previous == "sending" || previous == "unknown")
            {
                if (!request.reviewedUnknown) Rules.Fail("The previous email outcome is uncertain. Review it before confirming another attempt; duplicate email is possible.");
                if (previous == "sending" && source.GetAttributeValue<DateTime>("a365_emailstartedon") > DateTime.UtcNow.AddMinutes(-5)) Rules.Fail("An email attempt is still in progress. Wait before retrying.");
            }
            var person = caller.Retrieve("a365_employee", employee.Id, new ColumnSet("a365_name", "a365_workemail"));
            var attempt = Guid.NewGuid().ToString("D");
            change["a365_emailattempt"] = attempt; change["a365_emailoutcome"] = "sending"; change["a365_emailstartedon"] = DateTime.UtcNow;
            caller.Update(change);
            return new {
                outcome = "ready", attempt = attempt,
                employee = new { a365_employeeid = employee.Id, a365_name = person.GetAttributeValue<string>("a365_name"), a365_workemail = person.GetAttributeValue<string>("a365_workemail") },
                record = Result(source)
            };
        }
        private static object Result(Entity row)
        {
            return new {
                a365_leaveid = row.Id, a365_name = row.GetAttributeValue<string>("a365_name"),
                _a365_employee_value = row.GetAttributeValue<EntityReference>("a365_employee").Id,
                a365_leavetype = Choice(row, "a365_leavetype"), a365_benefit = Choice(row, "a365_benefit"),
                a365_startdate = Rules.Iso(row.GetAttributeValue<DateTime>("a365_startdate")), a365_enddate = Rules.Iso(row.GetAttributeValue<DateTime>("a365_enddate")),
                a365_days = row.GetAttributeValue<decimal>("a365_days"), a365_leavestatus = Choice(row, "a365_leavestatus"),
                a365_issuedon = row.GetAttributeValue<DateTime>("a365_issuedon").ToUniversalTime().ToString("o"),
                a365_notificationstatus = Choice(row, "a365_notificationstatus")
            };
        }
        private static void Match(Entity source, Request request, Guid employee)
        {
            if (source.GetAttributeValue<EntityReference>("a365_employee").Id != employee || Choice(source, "a365_leavetype") != request.leaveType ||
                source.GetAttributeValue<int>("a365_requestedbenefit") != request.benefit || Rules.Iso(source.GetAttributeValue<DateTime>("a365_startdate")) != request.startDate ||
                Rules.Iso(source.GetAttributeValue<DateTime>("a365_enddate")) != request.endDate || (source.GetAttributeValue<string>("a365_note") ?? "") != (request.note ?? "")) Rules.Fail("This operation identity belongs to a different request. Review the existing leave instead of retrying changed values.");
        }
        private static int Choice(Entity row, string attribute) { var value = row.GetAttributeValue<OptionSetValue>(attribute); return value == null ? -1 : value.Value; }
        private static void Lock(IOrganizationService service, Guid employee)
        {
            var record = Find(service, "a365_leavecoordination", "a365_leavecoordinationid", employee);
            var lockRow = new Entity("a365_leavecoordination", employee);
            lockRow["a365_token"] = Guid.NewGuid().ToString("D");
            if (record == null) { lockRow["a365_name"] = employee.ToString("D"); service.Create(lockRow); }
            else service.Update(lockRow);
            // Dataverse holds this dedicated row's write lock until the parent
            // transaction commits/rolls back. Concurrent first-create collision
            // aborts safely and the client retries using the same operation ID.
        }
        private static Entity Find(IOrganizationService service, string table, string column, object value)
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(true), TopCount = 1 };
            query.Criteria.AddCondition(column, ConditionOperator.Equal, value);
            return service.RetrieveMultiple(query).Entities.FirstOrDefault();
        }
        private static List<Entity> Read(IOrganizationService service, string table, string column, Guid value)
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(true), PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 } };
            query.Criteria.AddCondition(column, ConditionOperator.Equal, value);
            query.AddOrder(table + "id", OrderType.Ascending);
            var rows = new List<Entity>();
            while (true) {
                var page = service.RetrieveMultiple(query); rows.AddRange(page.Entities);
                if (!page.MoreRecords) return rows;
                if (++query.PageInfo.PageNumber > 1000) Rules.Fail("The complete credit history could not be read.");
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
        }
        private static void RequireAdmin(IOrganizationService system, Guid user)
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
    }

    /// <summary>Register synchronously on Create/Update/Delete/Upsert and bulk
    /// variants of Leave and its ledger. No client flag authorizes bypass.</summary>
    public sealed class ProtectLeaveWrites : IPlugin
    {
        public void Execute(IServiceProvider services)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)services.GetService(typeof(ITracingService));
            if (tracing != null)
                for (var item = context; item != null; item = item.ParentContext)
                    tracing.Trace("LeaveGuard message={0} entity={1} stage={2} depth={3} transaction={4}", item.MessageName, item.PrimaryEntityName, item.Stage, item.Depth, item.IsInTransaction);
            // ParentContext is a platform-provided snapshot. Do not require a
            // SharedVariables mutation made later by the Custom API handler to
            // appear in that snapshot. The synchronous API ancestry is the
            // trust boundary: its handler checks the initiating admin before
            // performing any writes, and custom processing steps are disabled.
            // A direct caller cannot manufacture this parent execution chain.
            if (context.IsInTransaction)
                for (var parent = context.ParentContext; parent != null; parent = parent.ParentContext)
                    if (parent.MessageName == LeaveCommand.Api && parent.IsInTransaction)
                    {
                        Request request = null;
                        try { if (parent.InputParameters.Contains("Request")) request = new JavaScriptSerializer().Deserialize<Request>((string)parent.InputParameters["Request"]); } catch { }
                        bool conversion = context.PrimaryEntityName == "a365_leavecashconversion" || context.PrimaryEntityName == "a365_leaveconversionyear";
                        if (request != null && (conversion ? request.command == "conversionCreate" || request.command == "conversionSave" || (request.command == "conversionMarkPaid" && context.PrimaryEntityName == "a365_leaveconversionyear" && (context.MessageName == "Update" || context.MessageName == "SetState")) : request.command == "issue" || request.command == "prepareEmail" || request.command == "completeEmail")) return;
                        Rules.Fail("This Leave command cannot modify these records.");
                    }
            Rules.Fail("Use the validated Leave command. Direct changes to Leave or credit history are not permitted.");
        }
    }
}
