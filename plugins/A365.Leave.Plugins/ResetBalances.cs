using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace A365.Leave.Plugins
{
    public sealed partial class LeaveCommand
    {
        // Serializes bulk refreshes; employee locks also serialize against issuance/deletion.
        private static readonly Guid RefreshLock = new Guid("4183c1ac-764e-48a2-92c4-46ddfbc004af");
        private sealed class RefreshEmployee
        {
            public Entity Employee;
            public List<Entity> Rows;
            public List<Entity> Sources;
            public List<Entity> Conversions;
            public List<Entity> Headers = new List<Entity>();
            public decimal EarnedVL, UsedVL, UsedSL, ConvertedVL, BeforeVL, BeforeSL;
            public decimal VL { get { return EarnedVL - UsedVL - ConvertedVL; } }
            public decimal SL { get { return 5m - UsedSL; } }
            public object Preview()
            {
                return new { employeeId = Employee.Id.ToString("D"), employeeName = Employee.GetAttributeValue<string>("a365_name") ?? Employee.Id.ToString("D"),
                    beforeVL = BeforeVL, beforeSL = BeforeSL, earnedVL = EarnedVL, usedVL = UsedVL, usedSL = UsedSL, convertedVL = ConvertedVL,
                    VL = VL, SL = SL, issue = VL < 0 || SL < 0 ? "Recorded usage exceeds entitlement. Review this employee's records before refreshing." : null };
            }
        }
        private object RefreshBalances(Request request, IPluginExecutionContext context, IOrganizationService system, IOrganizationService caller)
        {
            bool apply = request.command == "refreshBalances";
            Guid operation = Guid.Empty;
            if (apply && !Guid.TryParse(request.operationId, out operation)) { Rules.Fail("A stable refresh operation identity is required."); return null; }
            if (!apply) operation = Guid.Empty;
            if (apply)
            {
                Lock(system, RefreshLock);
                var receipt = Find(caller, Ledger, "a365_leavecredittransactionid", operation);
                if (receipt != null)
                {
                    if (receipt.GetAttributeValue<string>("a365_transactionkey") != "REFRESH-" + operation.ToString("D") + "-COMPLETE") Rules.Fail("The refresh operation identity is already in use.");
                    // Return the original result, never refresh again after an uncertain response.
                    return Json.DeserializeObject(receipt.GetAttributeValue<string>("a365_note"));
                }
            }
            DateTime today = DateTime.UtcNow.AddHours(8).Date;
            DateTime period = Rules.Period(today);
            var query = new QueryExpression("a365_employee") { ColumnSet = new ColumnSet("a365_name", "a365_employmentstatus", "a365_datehired"), PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 } };
            query.Criteria.AddCondition("a365_employmentstatus", ConditionOperator.Equal, 749910000);
            query.AddOrder("a365_employeeid", OrderType.Ascending);
            var employees = new List<Entity>(); var cookies = new HashSet<string>();
            while (true)
            {
                var page = caller.RetrieveMultiple(query); employees.AddRange(page.Entities);
                if (!page.MoreRecords) break;
                if (String.IsNullOrEmpty(page.PagingCookie) || !cookies.Add(page.PagingCookie) || ++query.PageInfo.PageNumber > 1000) Rules.Fail("The complete active employee list could not be verified.");
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            employees = employees.OrderBy(employee => employee.Id).ToList();
            var snapshot = new List<RefreshEmployee>();
            foreach (var employee in employees)
            {
                if (apply) Lock(system, employee.Id);
                // Recheck after taking the employee lock, rather than trust client selection.
                var current = caller.Retrieve("a365_employee", employee.Id, query.ColumnSet);
                if (Choice(current, "a365_employmentstatus") != 749910000) Rules.Fail("The active employee list changed. Review the refresh again.");
                if (!current.Contains("a365_datehired")) Rules.Fail("An active employee is missing their hire date. Complete it before refreshing credits.");
                var rows = Read(caller, Ledger, "a365_employee", employee.Id);
                if (rows.Any(row => String.IsNullOrEmpty(row.GetAttributeValue<string>("a365_creditperiod")))) Rules.Fail("Unallocated credit history needs review before refreshing. No balances were refreshed.");
                foreach (var row in rows)
                    if (Choice(row, "a365_creditpool") < 749910000 || Choice(row, "a365_creditpool") > 749910001 || !row.Contains("a365_days") || row.GetAttributeValue<decimal>("a365_days") != Math.Round(row.GetAttributeValue<decimal>("a365_days"), 2)) Rules.Fail("Credit history needs review before refreshing. No balances were refreshed.");
                var item = new RefreshEmployee { Employee = current, Rows = rows,
                    Sources = RefreshRecords(caller, Source, employee.Id, period, today.Year),
                    Conversions = RefreshRecords(caller, "a365_leavecashconversion", employee.Id, period, today.Year) };
                var entitlement = new List<Entity>();
                var hired = current.GetAttributeValue<DateTime>("a365_datehired").Date;
                if (hired > today) Rules.Fail("An active employee's hire date is in the future. Review it before refreshing.");
                // Entitlement excludes previous resets, restorations and duplicate grants.
                EnsureCredits(caller, entitlement, employee.Id, hired, period, today, false);
                item.EarnedVL = Math.Min(10m, entitlement.Where(row => Choice(row, "a365_creditpool") == 749910000).Sum(row => row.GetAttributeValue<decimal>("a365_days")));
                foreach (var source in item.Sources)
                {
                    if (!source.Contains("a365_startdate") || !source.Contains("a365_enddate")) Rules.Fail("A leave record is missing dates. Review it before refreshing.");
                    var start = source.GetAttributeValue<DateTime>("a365_startdate").Date;
                    var end = source.GetAttributeValue<DateTime>("a365_enddate").Date;
                    if (end < start) Rules.Fail("A leave record has inconsistent dates.");
                    if (end < period || start > Rules.PeriodEnd(period)) continue;
                    int status = Choice(source, "a365_leavestatus");
                    if (status == 749910001) continue;
                    if (status != 749910000 || start < period || end > Rules.PeriodEnd(period)) Rules.Fail("A leave record needs period/status reconciliation before refreshing.");
                    decimal paid = RefreshPaidDays(source);
                    int type = Choice(source, "a365_leavetype");
                    if (type == 749910001) item.UsedSL += paid;
                    else if (type == 749910000 || type == 749910002) item.UsedVL += paid;
                    else Rules.Fail("A leave record has an unsupported credit pool.");
                }
                foreach (var conversion in item.Conversions.Where(row => row.GetAttributeValue<int>("a365_year") == today.Year))
                {
                    int status = Choice(conversion, "a365_conversionstatus");
                    if (status == 749910001) continue;
                    var reference = conversion.GetAttributeValue<EntityReference>("a365_conversionyear");
                    if (status != 749910000 || reference == null) Rules.Fail("A conversion's payment status needs review before refreshing.");
                    var header = caller.Retrieve("a365_leaveconversionyear", reference.Id, new ColumnSet("a365_year", "statecode", "versionnumber"));
                    item.Headers.Add(header);
                    if (header.GetAttributeValue<int>("a365_year") != today.Year || (Choice(header, "statecode") != 0 && Choice(header, "statecode") != 1)) Rules.Fail("A conversion year needs review before refreshing.");
                    if (Choice(header, "statecode") != 1) continue;
                    decimal days = conversion.GetAttributeValue<decimal>("a365_days");
                    if (!conversion.Contains("a365_days") || days < 0 || days > 5 || days != Math.Round(days, 2)) Rules.Fail("Paid conversion days need review before refreshing.");
                    item.ConvertedVL += days;
                }
                if (item.ConvertedVL > 5) Rules.Fail("Paid conversion days exceed the annual limit. Review them before refreshing.");
                var recorded = rows.Where(row => row.GetAttributeValue<int>("a365_year") == today.Year);
                item.BeforeVL = recorded.Where(row => Choice(row, "a365_creditpool") == 749910000).Sum(row => row.GetAttributeValue<decimal>("a365_days"));
                item.BeforeSL = recorded.Where(row => Choice(row, "a365_creditpool") == 749910001).Sum(row => row.GetAttributeValue<decimal>("a365_days"));
                snapshot.Add(item);
            }
            // Hash one record at a time: retained audit notes can exceed the API
            // response serializer's limit when the whole history is serialized at once.
            var fingerprint = new StringBuilder().Append(Rules.Iso(today)).Append(Rules.Iso(period));
            foreach (var item in snapshot)
                foreach (var group in new[] { new List<Entity> { item.Employee }, item.Rows, item.Sources, item.Conversions, item.Headers })
                {
                    fingerprint.Append('|').Append(group.Count).Append(':');
                    foreach (var row in group.OrderBy(row => row.Id)) fingerprint.Append(row.LogicalName).Append(Json.Serialize(RefreshFingerprint(row)));
                }
            string version;
            using (var sha = SHA256.Create())
                version = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(fingerprint.ToString()))).Replace("-", "").ToLowerInvariant();
            bool canApply = snapshot.Count > 0 && snapshot.All(item => item.VL >= 0 && item.SL >= 0);
            if (!apply) return new { refreshVersion = 1, year = today.Year, periodStart = Rules.Iso(period), employeeCount = snapshot.Count, canApply = canApply, employees = snapshot.Select(item => item.Preview()).ToArray(), version = version };
            if (request.year != today.Year || request.version != version) Rules.Fail("Employee balances changed. Review the refresh again before confirming.");
            if (!canApply) Rules.Fail("There are no active employees to refresh, or recorded usage exceeds entitlement. Review the preview.");
            foreach (var item in snapshot)
            {
                // Catch up already-due grants, so the next Issue cannot add them twice.
                EnsureCredits(caller, item.Rows, item.Employee.Id, item.Employee.GetAttributeValue<DateTime>("a365_datehired").Date, period, today, true);
                var groups = item.Rows.Where(row => row.GetAttributeValue<int>("a365_year") == today.Year || row.GetAttributeValue<string>("a365_creditperiod") == Rules.Iso(period))
                    .GroupBy(row => new { Year = row.GetAttributeValue<int>("a365_year"), Period = row.GetAttributeValue<string>("a365_creditperiod"), Pool = Choice(row, "a365_creditpool") }).ToList();
                foreach (var group in groups)
                {
                    decimal target = group.Key.Year == today.Year && group.Key.Period == Rules.Iso(period) ? (group.Key.Pool == 749910000 ? item.VL : item.SL) : 0m;
                    RefreshAdjustment(caller, context, operation, item.Employee.Id, Rules.Day(group.Key.Period), group.Key.Year, group.Key.Pool, target - group.Sum(row => row.GetAttributeValue<decimal>("a365_days")), today);
                }
                foreach (int pool in new[] { 749910000, 749910001 })
                    if (!groups.Any(group => group.Key.Year == today.Year && group.Key.Period == Rules.Iso(period) && group.Key.Pool == pool))
                        RefreshAdjustment(caller, context, operation, item.Employee.Id, period, today.Year, pool, pool == 749910000 ? item.VL : item.SL, today);
            }
            var response = new { refreshVersion = 1, completed = true, operationId = operation.ToString("D"), year = today.Year, periodStart = Rules.Iso(period), employeeCount = snapshot.Count };
            var complete = Movement(snapshot[0].Employee.Id, period, today.Year, 749910000, 749910001, 0, "REFRESH-" + operation.ToString("D") + "-COMPLETE", null);
            complete.Id = operation; complete["a365_note"] = Json.Serialize(response);
            caller.Create(complete);
            return response;
        }
        private static void RefreshAdjustment(IOrganizationService caller, IPluginExecutionContext context, Guid operation, Guid employee, DateTime period, int year, int pool, decimal days, DateTime today)
        {
            if (days == 0) return;
            var key = "REFRESH-" + operation.ToString("D") + "-" + year.ToString(CultureInfo.InvariantCulture) + "-" + Rules.Iso(period) + "-" + pool.ToString(CultureInfo.InvariantCulture);
            var row = Movement(employee, period, year, pool, days < 0 ? 749910002 : 749910001, days, key, null);
            row["a365_note"] = "Refresh: earned VL / 5 SL minus saved paid leave and paid VL conversions; operation " + operation.ToString("D") + "; actor " + context.InitiatingUserId.ToString("D") + "; date " + Rules.Iso(today) + ". Existing history retained.";
            caller.Create(row);
        }

        private static decimal RefreshPaidDays(Entity source)
        {
            decimal total = source.GetAttributeValue<decimal>("a365_days");
            int benefit = Choice(source, "a365_benefit");
            bool snapshot = source.Contains("a365_paiddays") || source.Contains("a365_unpaiddays") || source.Contains("a365_allocationjson");
            decimal paid = snapshot ? source.GetAttributeValue<decimal>("a365_paiddays") : benefit == 749910000 ? total : 0m;
            decimal unpaid = snapshot ? source.GetAttributeValue<decimal>("a365_unpaiddays") : benefit == 749910001 ? total : 0m;
            if (total <= 0 || total != Math.Round(total, 2) || paid < 0 || unpaid < 0 || paid != Math.Round(paid, 2) || unpaid != Math.Round(unpaid, 2) || paid + unpaid != total ||
                benefit != (paid == 0 ? 749910001 : unpaid == 0 ? 749910000 : 749910002)) Rules.Fail("A saved paid/unpaid leave allocation needs review before refreshing.");
            if (snapshot)
            {
                LeaveAllocation allocation = null;
                try { allocation = Json.Deserialize<LeaveAllocation>(source.GetAttributeValue<string>("a365_allocationjson") ?? ""); } catch { }
                if (!source.Contains("a365_paiddays") || !source.Contains("a365_unpaiddays") || allocation == null || allocation.version != 1 || allocation.days == null || allocation.days.Length == 0 ||
                    allocation.days.Any(day => day == null || day.paidDays < 0 || day.unpaidDays < 0) || allocation.PaidDays != paid || allocation.UnpaidDays != unpaid) Rules.Fail("A saved leave allocation snapshot needs review before refreshing.");
            }
            return paid;
        }
        private static List<Entity> RefreshRecords(IOrganizationService caller, string table, Guid employee, DateTime period, int year)
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(true), PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 } };
            query.Criteria.AddCondition("a365_employee", ConditionOperator.Equal, employee);
            if (table == Source)
            {
                query.Criteria.AddCondition("a365_enddate", ConditionOperator.OnOrAfter, period);
                query.Criteria.AddCondition("a365_startdate", ConditionOperator.OnOrBefore, Rules.PeriodEnd(period));
            }
            else query.Criteria.AddCondition("a365_year", ConditionOperator.Equal, year);
            query.AddOrder(table + "id", OrderType.Ascending);
            var rows = new List<Entity>(); var cookies = new HashSet<string>();
            while (true)
            {
                var page = caller.RetrieveMultiple(query); rows.AddRange(page.Entities);
                if (!page.MoreRecords) return rows;
                if (String.IsNullOrEmpty(page.PagingCookie) || !cookies.Add(page.PagingCookie) || ++query.PageInfo.PageNumber > 1000) Rules.Fail("The complete current-period source records could not be verified.");
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
        }
        private static object RefreshFingerprint(Entity row)
        {
            return new { id = row.Id, fields = row.Attributes.OrderBy(field => field.Key).Select(field => new { key = field.Key, value = RefreshValue(field.Value) }).ToArray() };
        }
        private static string RefreshValue(object value)
        {
            if (value is EntityReference) return ((EntityReference)value).Id.ToString("D");
            if (value is OptionSetValue) return ((OptionSetValue)value).Value.ToString(CultureInfo.InvariantCulture);
            if (value is Money) return ((Money)value).Value.ToString(CultureInfo.InvariantCulture);
            if (value is DateTime) return ((DateTime)value).ToString("o", CultureInfo.InvariantCulture);
            return Convert.ToString(value, CultureInfo.InvariantCulture);
        }
    }
}
