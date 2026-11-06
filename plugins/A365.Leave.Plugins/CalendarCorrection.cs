using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace A365.Leave.Plugins
{
    public sealed partial class LeaveCommand
    {
        // Explicit, reviewed correction only. Ordinary issuance never migrates history.
        private object Correct2026(Request request, IPluginExecutionContext context, IOrganizationService system, IOrganizationService caller)
        {
            Guid employee;
            if (request.year != 2026 || !Guid.TryParse(request.employeeId, out employee)) { Rules.Fail("The correction requires a 2026 employee review."); return null; }
            bool apply = request.command == "correct2026";
            if (apply) Lock(system, employee);
            caller.Retrieve("a365_employee", employee, new ColumnSet("a365_datehired"));
            var rows = Read(caller, Ledger, "a365_employee", employee);
            var affected = rows.Where(row => row.GetAttributeValue<string>("a365_creditperiod") == "2026-04-01").OrderBy(row => row.Id).ToArray();
            if (affected.Length > 200) Rules.Fail("This employee's correction exceeds the interactive limit.");
            var changes = new List<Entity>();
            foreach (var row in affected)
            {
                if (row.GetAttributeValue<int>("a365_year") != 2026 || row.GetAttributeValue<decimal>("a365_days") != Decimal.Round(row.GetAttributeValue<decimal>("a365_days"), 2) ||
                    Choice(row, "a365_creditpool") < 749910000 || Choice(row, "a365_creditpool") > 749910001 || row.Contains("a365_cashconversion"))
                    Rules.Fail("The original credit history needs review; no correction was made.");
                var source = row.GetAttributeValue<EntityReference>("a365_leave");
                if (source != null)
                {
                    var leave = caller.Retrieve(Source, source.Id, new ColumnSet("a365_startdate", "a365_enddate", "a365_employee"));
                    if (leave.GetAttributeValue<DateTime>("a365_startdate").Year != 2026 || leave.GetAttributeValue<DateTime>("a365_enddate").Year != 2026 ||
                        leave.GetAttributeValue<EntityReference>("a365_employee") == null || leave.GetAttributeValue<EntityReference>("a365_employee").Id != employee)
                        Rules.Fail("Cross-year or inconsistent leave needs a separate correction review.");
                }
                string key = row.GetAttributeValue<string>("a365_transactionkey");
                if (String.IsNullOrEmpty(key)) Rules.Fail("A credit is missing its retry identity.");
                var change = new Entity(Ledger, row.Id);
                change["a365_creditperiod"] = "2026-01-01";
                if (key.StartsWith("AUTO-2026-04-01-", StringComparison.Ordinal))
                {
                    string canonical = key.Replace("2026-04-01", "2026-01-01");
                    var matches = rows.Where(item => item.GetAttributeValue<string>("a365_transactionkey") == canonical).ToArray();
                    if (matches.Length > 1) Rules.Fail("Duplicate automatic credit identities need review.");
                    if (matches.Length == 0)
                    {
                        change["a365_transactionkey"] = canonical;
                        change["a365_periodkey"] = canonical;
                    }
                    else if (matches[0].GetAttributeValue<string>("a365_creditperiod") != "2026-01-01" || matches[0].GetAttributeValue<int>("a365_year") != 2026 ||
                        Choice(matches[0], "a365_creditpool") != Choice(row, "a365_creditpool") || Choice(matches[0], "a365_transactiontype") != Choice(row, "a365_transactiontype") ||
                        matches[0].GetAttributeValue<decimal>("a365_days") != row.GetAttributeValue<decimal>("a365_days"))
                        Rules.Fail("Conflicting automatic credits need review.");
                    // Prior reset adjustments already account for posted grants.
                    // Retain both amounts; the January canonical row prevents re-granting.
                }
                if (rows.Any(item => item.GetAttributeValue<string>("a365_transactionkey") == "CALENDAR2026-" + row.Id.ToString("D")))
                    Rules.Fail("An existing correction receipt conflicts with an April-tagged row.");
                changes.Add(change);
            }
            string version;
            using (var sha = SHA256.Create())
                version = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Json.Serialize(rows.OrderBy(row => row.Id).Select(row => new {
                    id = row.Id, period = row.GetAttributeValue<string>("a365_creditperiod"), year = row.GetAttributeValue<int>("a365_year"), days = row.GetAttributeValue<decimal>("a365_days"),
                    pool = Choice(row, "a365_creditpool"), type = Choice(row, "a365_transactiontype"), key = row.GetAttributeValue<string>("a365_transactionkey"),
                    periodKey = row.GetAttributeValue<string>("a365_periodkey"), leave = row.GetAttributeValue<EntityReference>("a365_leave")
                }).ToArray())))).Replace("-", "").ToLowerInvariant();
            if (apply && affected.Length > 0)
            {
                if (request.version != version) Rules.Fail("Credit history changed. Review the correction again.");
                foreach (var change in changes)
                {
                    var original = affected.Single(row => row.Id == change.Id);
                    var audit = Movement(employee, new DateTime(2026, 1, 1), 2026, Choice(original, "a365_creditpool"), 749910001, 0m, "CALENDAR2026-" + original.Id.ToString("D"), null);
                    audit["a365_note"] = Json.Serialize(new {
                        correction = "2026 calendar period", sourceId = original.Id, actor = context.InitiatingUserId, at = DateTime.UtcNow.ToString("o"),
                        from = "2026-04-01", to = "2026-01-01", days = original.GetAttributeValue<decimal>("a365_days"),
                        originalKey = original.GetAttributeValue<string>("a365_transactionkey"), originalPeriodKey = original.GetAttributeValue<string>("a365_periodkey"),
                        correctedKey = change.Contains("a365_transactionkey") ? change["a365_transactionkey"] : original.GetAttributeValue<string>("a365_transactionkey")
                    });
                    caller.Update(change);
                    caller.Create(audit);
                }
            }
            return new { year = 2026, employeeId = employee.ToString("D"), periodStart = "2026-01-01", periodEnd = "2026-12-31", affected = affected.Length, applied = apply, version = version,
                VL = rows.Where(row => row.GetAttributeValue<int>("a365_year") == 2026 && Choice(row, "a365_creditpool") == 749910000).Sum(row => row.GetAttributeValue<decimal>("a365_days")),
                SL = rows.Where(row => row.GetAttributeValue<int>("a365_year") == 2026 && Choice(row, "a365_creditpool") == 749910001).Sum(row => row.GetAttributeValue<decimal>("a365_days")) };
        }
    }
}
