using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

namespace A365.Leave.Plugins
{
    public sealed class ConversionValues
    {
        public decimal AvailableVL;
        public decimal Days;
        public decimal Amount;
    }
    public static partial class ConversionCommands
    {
        internal static bool AddMissingEmployee(IOrganizationService caller, int year, Guid employeeId, Guid actor)
        {
            var header = Find(caller, Header, "a365_year", year, HeaderColumns);
            if (header == null || IsPaid(header)) return false;
            var query = Query(Detail, DetailColumns);
            query.Criteria.AddCondition("a365_conversionyear", ConditionOperator.Equal, header.Id);
            query.Criteria.AddCondition("a365_employee", ConditionOperator.Equal, employeeId);
            var existing = All(caller, query);
            if (existing.Count > 1) Rules.Fail("Duplicate conversion rows need review before syncing.");
            if (existing.Count != 0) return false;
            var row = NewRow(Guid.NewGuid(), header, Employee(caller, employeeId), actor);
            var gate = new Entity(Header, header.Id) { RowVersion = header.GetAttributeValue<long>("versionnumber").ToString(CultureInfo.InvariantCulture) };
            gate["a365_name"] = header.GetAttributeValue<string>("a365_name");
            caller.Execute(new UpdateRequest { Target = gate, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
            caller.Create(row);
            return true;
        }
        public static ConversionValues Effective(decimal limitVL, decimal limitDays, decimal rate, decimal recordedVL)
        {
            Validate(limitVL, limitDays);
            if (recordedVL != Decimal.Round(recordedVL, 2) || rate < 0) Rules.Fail("The recorded VL balance or saved daily rate needs review.");
            decimal available = Math.Min(limitVL, Math.Max(0, recordedVL));
            decimal days = Math.Min(limitDays, Math.Min(5m, available));
            return new ConversionValues { AvailableVL = available, Days = days, Amount = Amount(rate, days) };
        }
        private static Dictionary<Guid, decimal> Balances(IOrganizationService caller, int year, IEnumerable<Guid> employeeIds)
        {
            var ids = employeeIds.Distinct().ToArray();
            var totals = ids.ToDictionary(id => id, id => 0m);
            // Bounded employee batches; all pages of the same year/pool are read.
            for (int offset = 0; offset < ids.Length; offset += 100)
            {
                var query = Query("a365_leavecredittransaction", "a365_employee", "a365_year", "a365_creditpool", "a365_days");
                query.Criteria.AddCondition("a365_year", ConditionOperator.Equal, year);
                query.Criteria.AddCondition("a365_creditpool", ConditionOperator.Equal, 749910000);
                query.Criteria.AddCondition("a365_employee", ConditionOperator.In, ids.Skip(offset).Take(100).Cast<object>().ToArray());
                var seen = new HashSet<Guid>();
                foreach (var row in All(caller, query))
                {
                    var employee = row.GetAttributeValue<EntityReference>("a365_employee");
                    decimal days = row.GetAttributeValue<decimal>("a365_days");
                    if (!seen.Add(row.Id) || employee == null || !totals.ContainsKey(employee.Id) || row.GetAttributeValue<int>("a365_year") != year || row.GetAttributeValue<OptionSetValue>("a365_creditpool") == null || row.GetAttributeValue<OptionSetValue>("a365_creditpool").Value != 749910000 || !row.Contains("a365_days") || days != Decimal.Round(days, 2)) Rules.Fail("The complete recorded VL balance could not be verified.");
                    totals[employee.Id] += days;
                }
            }
            return totals;
        }
    }
}
