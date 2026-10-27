using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using A365.Leave.Plugins;

public static class PersonalLeaveReadsTests
{
    private static readonly Guid User = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Employee = Guid.Parse("20000000-0000-0000-0000-000000000002");
    private static readonly Guid Foreign = Guid.Parse("30000000-0000-0000-0000-000000000003");
    private static int checks;
    private static void Check(bool value, string label) { if (!value) throw new Exception("Personal leave regression: " + label); checks++; }
    private static void Denied(Action action, string label) { bool denied = false; try { action(); } catch (InvalidPluginExecutionException) { denied = true; } Check(denied, label); }
    private sealed class Fake : IOrganizationService, IOrganizationServiceFactory, IServiceProvider
    {
        public readonly List<Entity> Rows = new List<Entity>();
        public readonly List<QueryExpression> Queries = new List<QueryExpression>();
        public bool MoreRecords, FailLedger;
        public RemoteExecutionContext Context;
        public object GetService(Type t) { return t == typeof(IPluginExecutionContext) ? (object)Context : t == typeof(IOrganizationServiceFactory) ? this : null; }
        public IOrganizationService CreateOrganizationService(Guid? id) { return this; }
        public EntityCollection RetrieveMultiple(QueryBase input)
        {
            var q = (QueryExpression)input; Queries.Add(q);
            if (q.EntityName == "role") return new EntityCollection();
            if (FailLedger && q.EntityName == "a365_leavecredittransaction") throw new InvalidPluginExecutionException("Synthetic read failure");
            IEnumerable<Entity> rows = Rows.Where(r => r.LogicalName == q.EntityName);
            foreach (var c in q.Criteria.Conditions)
                rows = rows.Where(r => {
                    object v = c.AttributeName == r.LogicalName + "id" ? (object)r.Id : r.Contains(c.AttributeName) ? r[c.AttributeName] : null;
                    if (v is EntityReference) v = ((EntityReference)v).Id;
                    if (v is OptionSetValue) v = ((OptionSetValue)v).Value;
                    if (c.Operator == ConditionOperator.Equal) return Object.Equals(v, c.Values[0]);
                    if (c.Operator == ConditionOperator.LessThan) return v != null && ((DateTime)v) < (DateTime)c.Values[0];
                    if (c.Operator == ConditionOperator.GreaterEqual) return v != null && ((DateTime)v) >= (DateTime)c.Values[0];
                    if (c.Operator == ConditionOperator.Like) return true; // Shape asserted separately.
                    throw new Exception("Unexpected condition");
                });
            var result = new EntityCollection { MoreRecords = MoreRecords && q.EntityName != "a365_employee" };
            foreach (var r in rows.Take(q.TopCount ?? 500)) result.Entities.Add(r);
            return result;
        }
        public Guid Create(Entity e) { throw new Exception("Unexpected write"); }
        public void Update(Entity e) { throw new Exception("Unexpected write"); }
        public void Delete(string t, Guid id) { throw new Exception("Unexpected delete"); }
        public Entity Retrieve(string t, Guid id, ColumnSet c) { throw new Exception("Unscoped retrieve"); }
        public OrganizationResponse Execute(OrganizationRequest r) { throw new Exception("Unexpected action"); }
        public void Associate(string t, Guid id, Relationship r, EntityReferenceCollection e) { throw new Exception("Unexpected associate"); }
        public void Disassociate(string t, Guid id, Relationship r, EntityReferenceCollection e) { throw new Exception("Unexpected disassociate"); }
    }
    private static Fake Data()
    {
        var fake = new Fake();
        var employee = new Entity("a365_employee", Employee); employee["a365_systemuser"] = new EntityReference("systemuser", User); employee["a365_name"] = "Own Employee"; fake.Rows.Add(employee);
        foreach (var id in new[] { Employee, Foreign }) {
            var leave = new Entity("a365_leave", Guid.NewGuid()); leave["a365_employee"] = new EntityReference("a365_employee", id);
            leave["a365_name"] = "Leave"; leave["a365_startdate"] = new DateTime(2026, 10, 27); leave["a365_enddate"] = new DateTime(2026, 10, 27);
            leave["a365_leavetype"] = new OptionSetValue(749910000); leave["a365_benefit"] = new OptionSetValue(749910000); leave["a365_leavestatus"] = new OptionSetValue(749910000);
            leave["a365_days"] = 1m; leave["a365_note"] = "Internal text"; leave["a365_emailoutcome"] = "Internal status"; fake.Rows.Add(leave);
            var credit = new Entity("a365_leavecredittransaction", Guid.NewGuid()); credit["a365_employee"] = new EntityReference("a365_employee", id);
            credit["a365_year"] = 2026; credit["a365_days"] = 4m; credit["a365_creditpool"] = new OptionSetValue(749910000); fake.Rows.Add(credit);
        }
        return fake;
    }
    private static Request Request(string command) { return new Request { command = command, employeeId = Employee.ToString(), year = 2026, status = "all" }; }
    private static Dictionary<string, object> Read(Fake f, Request r) {
        return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(new JavaScriptSerializer().Serialize(PersonalLeaveReads.Execute(r, User, f)));
    }
    public static int Run()
    {
        var fake = Data(); var request = Request("myLeaves");
        var result = Read(fake, request); var json = new JavaScriptSerializer().Serialize(result);
        Check(((System.Collections.ICollection)result["rows"]).Count == 1 && !json.Contains(Foreign.ToString()), "own list only");
        Check(!json.Contains("Internal") && !json.Contains("a365_note") && !fake.Queries.Last().ColumnSet.Columns.Contains("a365_note"), "allowlisted fields only");
        Check(fake.Queries.Last().PageInfo.Count == 20 && fake.Queries.Last().Orders[0].AttributeName == "a365_startdate", "stable paged list");
        request.employeeId = Foreign.ToString(); Denied(() => Read(fake, request), "spoofed employee rejected");
        request.employeeId = null; Denied(() => Read(fake, request), "missing employee rejected");
        var detail = Request("myLeave"); detail.operationId = fake.Rows.First(r => r.LogicalName == "a365_leave" && ((EntityReference)r["a365_employee"]).Id == Foreign).Id.ToString();
        Denied(() => Read(fake, detail), "foreign detail rejected");
        detail.operationId = fake.Rows.First(r => r.LogicalName == "a365_leave").Id.ToString(); Check(((System.Collections.ICollection)Read(fake, detail)["rows"]).Count == 1, "own detail accepted");
        request = Request("myLeaves"); request.search = "O'Brien%_["; request.leaveType = 749910000; request.benefit = 749910000; request.status = "749910000"; request.cursor = "2";
        Read(fake, request); var query = fake.Queries.Last();
        Check(query.Criteria.Conditions.Count == 7 && query.PageInfo.PageNumber == 2, "combined filters retain scope");
        Check((string)query.Criteria.Conditions.First(c => c.Operator == ConditionOperator.Like).Values[0] == "%O'Brien[%][_][[]%", "literal search escaping");
        request.status = "123"; Denied(() => Read(fake, request), "unknown status rejected");
        request = Request("myLeaves"); request.leaveType = 12; Denied(() => Read(fake, request), "unknown type rejected");
        request = Request("myLeaves"); request.year = 9999; Denied(() => Read(fake, request), "invalid year rejected");
        request = Request("myCredits"); request.cursor = "0"; Denied(() => Read(fake, request), "invalid cursor rejected");
        request = Request("myCredits"); fake.MoreRecords = true; result = Read(fake, request);
        Check(((System.Collections.ICollection)result["rows"]).Count == 1 && (string)result["next"] == "2", "credits own scope and continuation");
        Check(fake.Queries.Last().PageInfo.Count == 500 && fake.Queries.Last().Criteria.Conditions.Count == 2, "complete ledger excludes record filters");
        request.cursor = "100"; Denied(() => Read(fake, request), "truncated ledger fails closed");
        fake.FailLedger = true; request.cursor = null; Denied(() => Read(fake, request), "ledger errors propagate instead of returning zero");
        fake = Data(); fake.Rows.RemoveAll(r => r.LogicalName == "a365_employee"); Denied(() => Read(fake, Request("myLeaves")), "unlinked user rejected");
        fake = Data(); var duplicate = new Entity("a365_employee", Guid.NewGuid()); duplicate["a365_systemuser"] = new EntityReference("systemuser", User); fake.Rows.Add(duplicate);
        Denied(() => Read(fake, Request("myLeaves")), "ambiguous employee mapping rejected");
        fake = Data(); Denied(() => PersonalLeaveReads.Execute(Request("myLeaves"), Guid.Empty, fake), "anonymous caller rejected");
        fake.Context = new RemoteExecutionContext { MessageName = "a365_LeaveCommand", IsInTransaction = true, InitiatingUserId = User };
        fake.Context.InputParameters["Request"] = new JavaScriptSerializer().Serialize(Request("myLeaves"));
        new LeaveCommand().Execute(fake); Check(fake.Context.OutputParameters.Contains("Response"), "employee read reaches plugin dispatcher");
        fake.Context.InputParameters["Request"] = new JavaScriptSerializer().Serialize(Request("issue"));
        Denied(() => new LeaveCommand().Execute(fake), "employee writes still require admin");
        return checks;
    }
}
