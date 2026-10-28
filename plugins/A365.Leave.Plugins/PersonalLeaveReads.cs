using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace A365.Leave.Plugins
{
    /// <summary>Read-only personal access. Identity and every query scope are
    /// resolved server-side; no table privileges, sharing or ownership changes.</summary>
    public static class PersonalLeaveReads
    {
        private static readonly string[] LeaveColumns = { "a365_name", "a365_employee", "a365_leavetype", "a365_benefit", "a365_startdate", "a365_enddate", "a365_days", "a365_leavestatus", "a365_issuedon", "a365_paiddays", "a365_unpaiddays", "a365_allocationjson" };
        private static readonly string[] CreditColumns = { "a365_employee", "a365_year", "a365_creditpool", "a365_days" };

        public static object Execute(Request request, Guid user, IOrganizationService system)
        {
            if (user == Guid.Empty) Rules.Fail("Your signed-in account could not be verified.");
            if (request.command != "myLeaves" && request.command != "myLeave" && request.command != "myCredits") Rules.Fail("Unknown personal Leave command.");
            var identity = new QueryExpression("a365_employee") { ColumnSet = new ColumnSet("a365_name"), TopCount = 2 };
            identity.Criteria.AddCondition("a365_systemuser", ConditionOperator.Equal, user);
            var employees = system.RetrieveMultiple(identity).Entities;
            if (employees.Count != 1) Rules.Fail("Your account must be linked to exactly one employee record. Contact your administrator.");
            var employee = employees[0];
            Guid requestedEmployee;
            if (!Guid.TryParse(request.employeeId, out requestedEmployee) || requestedEmployee != employee.Id) Rules.Fail("This employee profile is not available to your account.");

            bool credits = request.command == "myCredits";
            bool detail = request.command == "myLeave";
            var table = credits ? "a365_leavecredittransaction" : "a365_leave";
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(credits ? CreditColumns : LeaveColumns) };
            query.Criteria.AddCondition("a365_employee", ConditionOperator.Equal, employee.Id);
            if (detail)
            {
                Guid id;
                if (!Guid.TryParse(request.operationId, out id)) Rules.Fail("Select a valid leave record.");
                query.Criteria.AddCondition("a365_leaveid", ConditionOperator.Equal, id);
                query.TopCount = 1;
            }
            else
            {
                if (request.year < 1900 || request.year > 9998) Rules.Fail("Select a valid year.");
                if (credits) query.Criteria.AddCondition("a365_year", ConditionOperator.Equal, request.year);
                else
                {
                    query.Criteria.AddCondition("a365_startdate", ConditionOperator.LessThan, new DateTime(request.year + 1, 1, 1));
                    query.Criteria.AddCondition("a365_enddate", ConditionOperator.GreaterEqual, new DateTime(request.year, 1, 1));
                    var search = (request.search ?? "").Trim();
                    if (search.Length > 200) Rules.Fail("Search must be 200 characters or fewer.");
                    if (search.Length > 0) query.Criteria.AddCondition("a365_name", ConditionOperator.Like, "%" + EscapeLike(search) + "%");
                    int status;
                    if (request.status != null && request.status != "all")
                    {
                        if (!Int32.TryParse(request.status, out status) || (status != 749910000 && status != 749910001)) Rules.Fail("Select a valid status.");
                        query.Criteria.AddCondition("a365_leavestatus", ConditionOperator.Equal, status);
                    }
                    Choice(query, "a365_leavetype", request.leaveType, new[] { 749910000, 749910001, 749910002 });
                    Choice(query, "a365_benefit", request.benefit, new[] { 749910000, 749910001, 749910002 });
                }
                int page = 1;
                if (!String.IsNullOrEmpty(request.cursor) && (!Int32.TryParse(request.cursor, out page) || page < 1 || page > (credits ? 100 : 2500))) Rules.Fail("Invalid history page. Refresh to retry.");
                query.PageInfo = new PagingInfo { Count = credits ? 500 : 20, PageNumber = page };
                if (!credits) query.AddOrder("a365_startdate", OrderType.Descending);
                query.AddOrder(table + "id", OrderType.Ascending);
            }
            var result = system.RetrieveMultiple(query);
            if (detail && result.Entities.Count != 1) Rules.Fail("This leave record is not available to your account.");
            // Simple Dataverse paging is bounded at 50,000 rows. Never silently
            // calculate a balance from a truncated ledger.
            if (!detail && result.MoreRecords && query.PageInfo.PageNumber * query.PageInfo.Count >= 50000) Rules.Fail("Complete history could not be read. Contact your administrator.");
            var rows = result.Entities.Select(row => Project(row, employee.Id, credits)).ToArray();
            return new { employeeId = employee.Id.ToString("D"), employeeName = employee.GetAttributeValue<string>("a365_name"), rows = rows,
                next = !detail && result.MoreRecords ? (query.PageInfo.PageNumber + 1).ToString(CultureInfo.InvariantCulture) : null };
        }

        private static void Choice(QueryExpression query, string field, int value, int[] allowed)
        {
            if (value == 0) return;
            if (!allowed.Contains(value)) Rules.Fail("Select a valid leave filter.");
            query.Criteria.AddCondition(field, ConditionOperator.Equal, value);
        }
        private static string EscapeLike(string value) { return value.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]"); }
        private static Dictionary<string, object> Project(Entity row, Guid employee, bool credits)
        {
            var link = row.GetAttributeValue<EntityReference>("a365_employee");
            if (link == null || link.Id != employee) Rules.Fail("The personal leave response could not be verified.");
            var result = new Dictionary<string, object> { { row.LogicalName + "id", row.Id.ToString("D") }, { "_a365_employee_value", employee.ToString("D") } };
            foreach (var field in credits ? CreditColumns : LeaveColumns)
            {
                if (field == "a365_employee") continue;
                object value;
                if (!row.Attributes.TryGetValue(field, out value)) continue;
                var choice = value as OptionSetValue;
                if (choice != null) value = choice.Value;
                if (value is DateTime) value = ((DateTime)value).ToString(field == "a365_issuedon" ? "yyyy-MM-dd'T'HH:mm:ss'Z'" : "yyyy-MM-dd", CultureInfo.InvariantCulture);
                result[field] = value;
            }
            return result;
        }
    }
}
