using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;

namespace A365.Leave.Plugins
{
    public sealed partial class LeaveCommand
    {
        private object DeleteLeave(Request request, IPluginExecutionContext context, IOrganizationService system, IOrganizationService caller)
        {
            Guid employee, id;
            if (!Guid.TryParse(request.employeeId, out employee) || !Guid.TryParse(request.operationId, out id)) { Rules.Fail("Select a valid leave record."); return null; }
            bool apply = request.command == "delete";
            if (apply) Lock(system, employee);
            string key = "LEAVE-" + id.ToString("D") + "-DELETE";
            var receipt = Find(caller, Ledger, "a365_transactionkey", key);
            var source = Find(caller, Source, "a365_leaveid", id);
            if (receipt != null)
            {
                if (receipt.GetAttributeValue<EntityReference>("a365_employee").Id != employee || source != null) Rules.Fail("The deletion history needs review.");
                return new { deleted = true, recordId = id.ToString("D"), employeeId = employee.ToString("D"), restoredDays = receipt.GetAttributeValue<decimal>("a365_days") };
            }
            if (source == null) Rules.Fail("This leave is no longer available. Refresh the records.");
            if (source.GetAttributeValue<EntityReference>("a365_employee").Id != employee) Rules.Fail("The employee does not match this leave.");
            if (Choice(source, "a365_leavestatus") != 749910000 && Choice(source, "a365_leavestatus") != 749910001) Rules.Fail("This leave status is unsupported.");
            int benefit = Choice(source, "a365_benefit");
            if (benefit < 749910000 || benefit > 749910002) Rules.Fail("The leave benefit needs review.");
            decimal days = source.GetAttributeValue<decimal>("a365_days");
            decimal paid = source.Contains("a365_paiddays") ? source.GetAttributeValue<decimal>("a365_paiddays") : benefit == 749910000 ? days : 0m;
            decimal unpaid = source.Contains("a365_unpaiddays") ? source.GetAttributeValue<decimal>("a365_unpaiddays") : benefit == 749910001 ? days : 0m;
            if (days <= 0 || paid < 0 || unpaid < 0 || paid + unpaid != days || (paid == 0 ? 749910001 : unpaid == 0 ? 749910000 : 749910002) != benefit) Rules.Fail("The stored paid/unpaid split needs review before deletion.");
            int type = Choice(source, "a365_leavetype");
            if (type < 749910000 || type > 749910002) Rules.Fail("The leave credit pool needs review.");
            int pool = type == 749910001 ? 749910001 : 749910000;
            var movements = Read(caller, Ledger, "a365_leave", id);
            var start = source.GetAttributeValue<DateTime>("a365_startdate").Date;
            if (source.GetAttributeValue<DateTime>("a365_enddate").Date < start) Rules.Fail("The stored leave dates need review before deletion.");
            DateTime period = Rules.Period(start);
            int year = start.Year;
            decimal deducted = 0, restored = 0;
            if (movements.Count > 0)
            {
                if (String.IsNullOrEmpty(movements[0].GetAttributeValue<string>("a365_creditperiod"))) Rules.Fail("The original credit balance period needs review before deletion.");
                period = Rules.Day(movements[0].GetAttributeValue<string>("a365_creditperiod"));
                year = movements[0].GetAttributeValue<int>("a365_year");
            }
            foreach (var movement in movements)
            {
                var owner = movement.GetAttributeValue<EntityReference>("a365_employee");
                decimal amount = movement.GetAttributeValue<decimal>("a365_days");
                int movementType = Choice(movement, "a365_transactiontype");
                if (owner == null || owner.Id != employee || Choice(movement, "a365_creditpool") != pool || movement.GetAttributeValue<int>("a365_year") != year || movement.GetAttributeValue<string>("a365_creditperiod") != Rules.Iso(period) || movement.Contains("a365_cashconversion")) Rules.Fail("The leave credit history is inconsistent. No deletion was made.");
                if (movementType == 749910002 && amount < 0) deducted -= amount;
                else if (movementType == 749910003 && amount >= 0) restored += amount;
                else Rules.Fail("The leave credit movements need review before deletion.");
            }
            if (deducted != paid || restored > deducted) Rules.Fail("The original credit deduction could not be verified. No deletion was made.");
            decimal restore = deducted - restored;
            if (!apply) return new { deleted = false, recordId = id.ToString("D"), employeeId = employee.ToString("D"), restoredDays = restore, pool = pool == 749910000 ? "VL" : "SL", creditPeriod = Rules.Iso(period), year = year };
            if (request.expectedRestoredDays != restore) Rules.Fail("The credits to restore changed. Refresh and review the deletion again.");

            // Preserve the source's financial snapshot and original signed
            // movements. A zero-day receipt also audits deletion of unpaid or
            // already-restored leave and makes ambiguous retries idempotent.
            int[] offsets = null;
            var rawAllocation = source.GetAttributeValue<string>("a365_allocationjson");
            if (!String.IsNullOrEmpty(rawAllocation))
            {
                LeaveAllocation allocation;
                try { allocation = Json.Deserialize<LeaveAllocation>(rawAllocation); }
                catch { Rules.Fail("The saved leave allocation needs review."); return null; }
                if (allocation == null || allocation.version != 1 || allocation.days == null || allocation.days.Length == 0 || allocation.days.Length > 366 || allocation.PaidDays != paid || allocation.UnpaidDays != unpaid) Rules.Fail("The saved leave allocation needs review.");
                var previous = start.AddDays(-1); bool unpaidStarted = false;
                foreach (var day in allocation.days)
                {
                    var date = Rules.Day(day.date);
                    if (date < start || date > source.GetAttributeValue<DateTime>("a365_enddate").Date || date <= previous || day.paidDays < 0 || day.unpaidDays < 0 || day.paidDays + day.unpaidDays != 1 || (unpaidStarted && day.paidDays > 0)) Rules.Fail("The saved leave allocation needs review.");
                    previous = date; if (day.unpaidDays > 0) unpaidStarted = true;
                }
                offsets = allocation.days.Select(day => (Rules.Day(day.date) - start).Days).ToArray();
            }
            else if (benefit == 749910002) Rules.Fail("The partial leave allocation is missing. No deletion was made.");
            var audit = Json.Serialize(new {
                version = 1, action = "DeleteLeave", recordId = id.ToString("D"), name = source.GetAttributeValue<string>("a365_name"),
                type = type, benefit = benefit, status = Choice(source, "a365_leavestatus"), startDate = Rules.Iso(start), endDate = Rules.Iso(source.GetAttributeValue<DateTime>("a365_enddate")),
                days = days, paidDays = paid, unpaidDays = unpaid,
                workdayGaps = offsets == null ? null : offsets.Select((offset, index) => index == 0 ? offset : offset - offsets[index - 1]).ToArray(),
                issuedBy = source.GetAttributeValue<EntityReference>("a365_issuedby") == null ? null : source.GetAttributeValue<EntityReference>("a365_issuedby").Id.ToString("D"),
                issuedOn = source.GetAttributeValue<DateTime>("a365_issuedon").ToUniversalTime().ToString("o"),
                createdBy = source.GetAttributeValue<EntityReference>("createdby") == null ? null : source.GetAttributeValue<EntityReference>("createdby").Id.ToString("D"),
                createdOn = source.Contains("createdon") ? source.GetAttributeValue<DateTime>("createdon").ToUniversalTime().ToString("o") : null,
                modifiedBy = source.GetAttributeValue<EntityReference>("modifiedby") == null ? null : source.GetAttributeValue<EntityReference>("modifiedby").Id.ToString("D"),
                modifiedOn = source.Contains("modifiedon") ? source.GetAttributeValue<DateTime>("modifiedon").ToUniversalTime().ToString("o") : null,
                cancelledBy = source.GetAttributeValue<EntityReference>("a365_cancelledby") == null ? null : source.GetAttributeValue<EntityReference>("a365_cancelledby").Id.ToString("D"),
                cancelledOn = source.Contains("a365_cancelledon") ? source.GetAttributeValue<DateTime>("a365_cancelledon").ToUniversalTime().ToString("o") : null,
                deletedBy = context.InitiatingUserId.ToString("D"), deletedOn = DateTime.UtcNow.ToString("o")
            });
            if (audit.Length > 2000) Rules.Fail("The deletion audit snapshot exceeds the supported size. No deletion was made.");
            var restoration = Movement(employee, period, year, pool, 749910003, restore, key, null);
            restoration["a365_note"] = audit;
            caller.Create(restoration);
            foreach (var movement in movements)
            {
                var detach = new Entity(Ledger, movement.Id);
                detach["a365_leave"] = null;
                caller.Update(detach);
            }
            // The ordinary admin role intentionally has no direct Delete
            // privilege. Elevate only this final, validated source delete after
            // caller-scoped reads/restoration and the admin gate in Execute.
            system.Delete(Source, id);
            return new { deleted = true, recordId = id.ToString("D"), employeeId = employee.ToString("D"), restoredDays = restore };
        }
    }
}
