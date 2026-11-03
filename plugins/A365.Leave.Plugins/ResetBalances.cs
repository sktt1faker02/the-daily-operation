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
        // Serializes bulk resets; employee locks also serialize against issuance/deletion.
        private static readonly Guid ResetLock = new Guid("4183c1ac-764e-48a2-92c4-46ddfbc004af");
        private sealed class ResetEmployee
        {
            public Entity Employee;
            public List<Entity> Rows;
        }
        private object ResetBalances(Request request, IPluginExecutionContext context, IOrganizationService system, IOrganizationService caller)
        {
            bool apply = request.command == "resetBalances";
            Guid operation = Guid.Empty;
            if (apply && !Guid.TryParse(request.operationId, out operation)) { Rules.Fail("A stable reset operation identity is required."); return null; }
            if (!apply) operation = Guid.Empty;
            if (apply)
            {
                Lock(system, ResetLock);
                var receipt = Find(caller, Ledger, "a365_leavecredittransactionid", operation);
                if (receipt != null)
                {
                    if (receipt.GetAttributeValue<string>("a365_transactionkey") != "RESET-" + operation.ToString("D") + "-COMPLETE") Rules.Fail("The reset operation identity is already in use.");
                    // Return the original result, never reset again after an uncertain response.
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
            var snapshot = new List<ResetEmployee>();
            foreach (var employee in employees)
            {
                if (apply) Lock(system, employee.Id);
                // Recheck after taking the employee lock, rather than trust client selection.
                var current = caller.Retrieve("a365_employee", employee.Id, query.ColumnSet);
                if (Choice(current, "a365_employmentstatus") != 749910000) Rules.Fail("The active employee list changed. Review the reset again.");
                if (!current.Contains("a365_datehired")) Rules.Fail("An active employee is missing their hire date. Complete it before resetting credits.");
                var rows = Read(caller, Ledger, "a365_employee", employee.Id);
                if (rows.Any(row => String.IsNullOrEmpty(row.GetAttributeValue<string>("a365_creditperiod")))) Rules.Fail("Unallocated credit history needs review before resetting. No balances were reset.");
                foreach (var row in rows)
                    if (Choice(row, "a365_creditpool") < 749910000 || Choice(row, "a365_creditpool") > 749910001 || !row.Contains("a365_days") || row.GetAttributeValue<decimal>("a365_days") != Math.Round(row.GetAttributeValue<decimal>("a365_days"), 2)) Rules.Fail("Credit history needs review before resetting. No balances were reset.");
                snapshot.Add(new ResetEmployee { Employee = current, Rows = rows });
            }
            string version;
            using (var sha = SHA256.Create())
                version = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Json.Serialize(new {
                    date = Rules.Iso(today), period = Rules.Iso(period), employees = snapshot.Select(item => new {
                        id = item.Employee.Id, hired = item.Employee.GetAttributeValue<DateTime>("a365_datehired"),
                        rows = item.Rows.OrderBy(row => row.Id).Select(row => new { id = row.Id, days = row.GetAttributeValue<decimal>("a365_days"), pool = Choice(row, "a365_creditpool"), year = row.GetAttributeValue<int>("a365_year"), period = row.GetAttributeValue<string>("a365_creditperiod"), key = row.GetAttributeValue<string>("a365_transactionkey"), type = Choice(row, "a365_transactiontype") }).ToArray()
                    }).ToArray()
                })))).Replace("-", "").ToLowerInvariant();
            if (!apply) return new { resetVersion = 1, year = today.Year, periodStart = Rules.Iso(period), employeeCount = snapshot.Count, VL = 10, SL = 5, version = version };
            if (request.year != today.Year || request.version != version) Rules.Fail("Employee balances changed. Review the reset again before confirming.");
            if (snapshot.Count == 0) Rules.Fail("There are no active employees to reset.");
            foreach (var item in snapshot)
            {
                // Catch up already-due grants, so the next Issue cannot add them twice.
                EnsureCredits(caller, item.Rows, item.Employee.Id, item.Employee.GetAttributeValue<DateTime>("a365_datehired").Date, period, today, true);
                var groups = item.Rows.Where(row => row.GetAttributeValue<int>("a365_year") == today.Year || row.GetAttributeValue<string>("a365_creditperiod") == Rules.Iso(period))
                    .GroupBy(row => new { Year = row.GetAttributeValue<int>("a365_year"), Period = row.GetAttributeValue<string>("a365_creditperiod"), Pool = Choice(row, "a365_creditpool") }).ToList();
                foreach (var group in groups)
                {
                    decimal target = group.Key.Year == today.Year && group.Key.Period == Rules.Iso(period) ? (group.Key.Pool == 749910000 ? 10m : 5m) : 0m;
                    ResetAdjustment(caller, context, operation, item.Employee.Id, Rules.Day(group.Key.Period), group.Key.Year, group.Key.Pool, target - group.Sum(row => row.GetAttributeValue<decimal>("a365_days")), today);
                }
                foreach (int pool in new[] { 749910000, 749910001 })
                    if (!groups.Any(group => group.Key.Year == today.Year && group.Key.Period == Rules.Iso(period) && group.Key.Pool == pool))
                        ResetAdjustment(caller, context, operation, item.Employee.Id, period, today.Year, pool, pool == 749910000 ? 10m : 5m, today);
            }
            var response = new { resetVersion = 1, completed = true, operationId = operation.ToString("D"), year = today.Year, periodStart = Rules.Iso(period), employeeCount = snapshot.Count, VL = 10, SL = 5 };
            var complete = Movement(snapshot[0].Employee.Id, period, today.Year, 749910000, 749910001, 0, "RESET-" + operation.ToString("D") + "-COMPLETE", null);
            complete.Id = operation; complete["a365_note"] = Json.Serialize(response);
            caller.Create(complete);
            return response;
        }
        private static void ResetAdjustment(IOrganizationService caller, IPluginExecutionContext context, Guid operation, Guid employee, DateTime period, int year, int pool, decimal days, DateTime today)
        {
            var key = "RESET-" + operation.ToString("D") + "-" + year.ToString(CultureInfo.InvariantCulture) + "-" + Rules.Iso(period) + "-" + pool.ToString(CultureInfo.InvariantCulture);
            var row = Movement(employee, period, year, pool, days < 0 ? 749910002 : 749910001, days, key, null);
            row["a365_note"] = "Manual reset to 10 VL / 5 SL; operation " + operation.ToString("D") + "; actor " + context.InitiatingUserId.ToString("D") + "; date " + Rules.Iso(today) + ". Existing history retained.";
            caller.Create(row);
        }
    }
}
