using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace A365.Leave.Plugins
{
    public sealed partial class LeaveCommand
    {
        private object SyncEmployee(Request request, IOrganizationService system, IOrganizationService caller, Guid actor)
        {
            Guid employeeId;
            if (!Guid.TryParse(request.employeeId, out employeeId)) { Rules.Fail("Select an employee."); return null; }
            var today = DateTime.UtcNow.AddHours(8).Date;
            if (request.year != today.Year) Rules.Fail("Leave credits can only be synchronized for the current year.");
            Lock(system, employeeId);
            var employee = caller.Retrieve("a365_employee", employeeId, new ColumnSet("a365_employmentstatus", "a365_datehired", "a365_enddate"));
            if (!employee.Contains("a365_datehired")) Rules.Fail("The employee hire date is required for credit accrual.");
            var hired = employee.GetAttributeValue<DateTime>("a365_datehired").Date;
            bool eligible = (Choice(employee, "a365_employmentstatus") == 749910000 || Choice(employee, "a365_employmentstatus") == 749910002)
                && hired <= today && (!employee.Contains("a365_enddate") || employee.GetAttributeValue<DateTime>("a365_enddate").Date >= today);
            if (!eligible) return new { employeeId = employeeId.ToString("D"), year = today.Year, eligible = false, VL = 0m, SL = 0m, conversionAdded = false };
            var policy = Find(system, "a365_leavepolicy", "a365_name", "active");
            var configured = policy == null ? null : Json.Deserialize<Policy>(policy.GetAttributeValue<string>("a365_policyjson"));
            if (configured == null || configured.version != "2026-10-22.1") Rules.Fail("The Leave policy is missing or unsupported.");
            var period = Rules.Period(today);
            var rows = Read(caller, Ledger, "a365_employee", employeeId);
            if (rows.Any(row => String.IsNullOrEmpty(row.GetAttributeValue<string>("a365_creditperiod")) ||
                (row.GetAttributeValue<int>("a365_year") == today.Year && row.GetAttributeValue<string>("a365_creditperiod") != Rules.Iso(period))))
                Rules.Fail("Existing credit history needs period reconciliation before syncing. No credits were changed.");
            EnsureCredits(caller, rows, employeeId, hired, period, today, true);
            bool added = Choice(employee, "a365_employmentstatus") == 749910000 && ConversionCommands.AddMissingEmployee(caller, today.Year, employeeId, actor);
            var current = rows.Where(row => row.GetAttributeValue<string>("a365_creditperiod") == Rules.Iso(period));
            return new { employeeId = employeeId.ToString("D"), year = today.Year, eligible = true,
                VL = current.Where(row => Choice(row, "a365_creditpool") == 749910000).Sum(row => row.GetAttributeValue<decimal>("a365_days")),
                SL = current.Where(row => Choice(row, "a365_creditpool") == 749910001).Sum(row => row.GetAttributeValue<decimal>("a365_days")), conversionAdded = added };
        }
    }
}
