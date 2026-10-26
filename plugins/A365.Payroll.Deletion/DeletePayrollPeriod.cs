using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

[assembly: System.Reflection.AssemblyVersion("1.0.1.0")]
namespace A365.Payroll.Deletion
{
    public sealed class DeleteRequestBody
    {
        public string periodId { get; set; }
        public string periodName { get; set; }
        public string entryId { get; set; }
        public string employeeId { get; set; }
        public string employeeName { get; set; }
        public string operationId { get; set; }
        public bool preview { get; set; }
    }
    /// <summary>Explicit synchronous APIs; validated elevated writes share the API transaction.</summary>
    public sealed class DeletePayrollPeriod : IPlugin
    {
        private const string Receipt = "a365_payrolldeletionreceipt";
        public void Execute(IServiceProvider services)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            string kind;
            if (context.MessageName == "a365_DeletePayrollPeriod") kind = "period";
            else if (context.MessageName == "a365_DeletePayrollEntry") kind = "entry";
            else if (context.MessageName == "a365_DeleteEmployee") kind = "employee";
            else { Fail("Unknown deletion operation."); return; }
            if (!context.IsInTransaction || context.Stage != 30) Fail("A synchronous deletion transaction is required.");
            var factory = (IOrganizationServiceFactory)services.GetService(typeof(IOrganizationServiceFactory));
            var system = factory.CreateOrganizationService(null);
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            RequireAdmin(system, context.InitiatingUserId);
            var json = new JavaScriptSerializer { MaxJsonLength = 4096 };
            DeleteRequestBody input;
            try { input = json.Deserialize<DeleteRequestBody>((string)context.InputParameters["Request"]); }
            catch { Fail("The deletion request is invalid."); return; }
            if (input == null) { Fail("The deletion request is required."); return; }
            var operationId = Identity(input.operationId);
            var targetId = Identity(kind == "period" ? input.periodId : kind == "entry" ? input.entryId : input.employeeId);
            var targetName = kind == "period" ? input.periodName : input.employeeName;
            if (String.IsNullOrWhiteSpace(targetName) || targetName.Length > 200) Fail("A confirmed record name is required.");
            var priorQuery = new QueryExpression(Receipt) { ColumnSet = new ColumnSet("a365_targettype", "a365_targetid", "a365_targetname", "a365_periodid", "a365_periodname", "a365_deletedbyid"), TopCount = 1 };
            priorQuery.Criteria.AddCondition(Receipt + "id", ConditionOperator.Equal, operationId);
            var prior = system.RetrieveMultiple(priorQuery).Entities;
            int count = 0;
            if (prior.Count > 0)
            {
                if (prior[0].GetAttributeValue<string>("a365_targettype") != kind ||
                    prior[0].GetAttributeValue<string>("a365_targetid") != targetId.ToString("D") ||
                    prior[0].GetAttributeValue<string>("a365_targetname") != targetName ||
                    prior[0].GetAttributeValue<string>("a365_deletedbyid") != context.InitiatingUserId.ToString("D") ||
                    (kind != "employee" && (prior[0].GetAttributeValue<string>("a365_periodid") != Identity(input.periodId).ToString("D") || prior[0].GetAttributeValue<string>("a365_periodname") != input.periodName)))
                    Fail("This operation identity belongs to another deletion.");
            }
            else
            {
                Entity period = null;
                var targets = new List<Entity>();
                if (kind == "employee")
                {
                    var employee = caller.Retrieve("a365_employee", targetId, new ColumnSet("a365_name", "versionnumber"));
                    MatchName(employee, targetName);
                    RequireVersion(employee);
                    CheckEmployeeDependencies(system, targetId);
                    targets.Add(employee);
                }
                else
                {
                    period = caller.Retrieve("a365_payrollperiod", Identity(input.periodId), new ColumnSet("a365_name", "a365_payrollstatus", "versionnumber"));
                    RequireProcessing(period);
                    MatchName(period, input.periodName);
                    RequireVersion(period);
                    if (kind == "period")
                    {
                        var query = new QueryExpression("a365_payrollentry") { ColumnSet = new ColumnSet("versionnumber"), PageInfo = new PagingInfo { Count = 500, PageNumber = 1 } };
                        query.Criteria.AddCondition("a365_payrollperiod", ConditionOperator.Equal, period.Id);
                        query.AddOrder("a365_payrollentryid", OrderType.Ascending);
                        while (true)
                        {
                            var page = system.RetrieveMultiple(query);
                            targets.AddRange(page.Entities);
                            if (targets.Count > 1000) Fail("This payroll exceeds the interactive deletion limit. Contact your administrator.");
                            if (!page.MoreRecords) break;
                            query.PageInfo.PageNumber++;
                            query.PageInfo.PagingCookie = page.PagingCookie;
                        }
                    }
                    else
                    {
                        var entry = caller.Retrieve("a365_payrollentry", targetId, new ColumnSet("a365_payrollperiod", "a365_employee", "versionnumber"));
                        var parent = entry.GetAttributeValue<EntityReference>("a365_payrollperiod");
                        var employeeRef = entry.GetAttributeValue<EntityReference>("a365_employee");
                        if (parent == null || parent.Id != period.Id || employeeRef == null || employeeRef.Id != Identity(input.employeeId)) Fail("The payroll entry changed. Close this confirmation and review it again.");
                        var employee = caller.Retrieve("a365_employee", employeeRef.Id, new ColumnSet("a365_name"));
                        MatchName(employee, input.employeeName);
                        targets.Add(entry);
                    }
                    count = targets.Count;
                }
                foreach (var target in targets) RequireVersion(target);
                if (!input.preview)
                {
                    // Serialize against finalization through the parent row lock and
                    // reject changes after the status read using optimistic concurrency.
                    if (period != null) LockPeriod(system, period);
                    var receipt = new Entity(Receipt, operationId);
                    receipt["a365_name"] = targetName;
                    receipt["a365_targettype"] = kind;
                    receipt["a365_targetid"] = targetId.ToString("D");
                    receipt["a365_targetname"] = targetName;
                    if (period != null) { receipt["a365_periodid"] = period.Id.ToString("D"); receipt["a365_periodname"] = input.periodName; }
                    receipt["a365_deletedentries"] = count;
                    receipt["a365_deletedbyid"] = context.InitiatingUserId.ToString("D");
                    // Unique primary ID also prevents identical concurrent retries committing twice.
                    system.Create(receipt);
                    foreach (var target in targets) DeleteVersion(system, target);
                    // Native Restrict rejects newly created dependents and rolls back all writes.
                    if (kind == "period") {
                        var current = system.Retrieve("a365_payrollperiod", period.Id, new ColumnSet("versionnumber"));
                        RequireVersion(current);
                        DeleteVersion(system, current);
                    }
                }
            }
            context.OutputParameters["Response"] = json.Serialize(new { deleted = !input.preview, preview = input.preview, canDelete = true, kind = kind, targetId = targetId.ToString("D"), periodId = input.periodId, entryId = input.entryId, employeeId = input.employeeId, operationId = input.operationId, entryCount = count });
        }
        private static void CheckEmployeeDependencies(IOrganizationService system, Guid employeeId)
        {
            var metadata = (RetrieveEntityResponse)system.Execute(new RetrieveEntityRequest { LogicalName = "a365_employee", EntityFilters = EntityFilters.Relationships, RetrieveAsIfPublished = false });
            // Inspect every custom business lookup, including templates; leave standard
            // synchronization and access artifacts to existing native cleanup behavior.
            foreach (var link in metadata.EntityMetadata.OneToManyRelationships.Where(r => r.ReferencingEntity.StartsWith("a365_", StringComparison.Ordinal)))
            {
                var query = new QueryExpression(link.ReferencingEntity) { ColumnSet = new ColumnSet(false), TopCount = 1 };
                query.Criteria.AddCondition(link.ReferencingAttribute, ConditionOperator.Equal, employeeId);
                if (system.RetrieveMultiple(query).Entities.Count > 0) Fail("This employee has payroll, leave or template records and cannot be deleted. Set the employee to Inactive instead to preserve history.");
            }
            if (metadata.EntityMetadata.ManyToManyRelationships.Length > 0) Fail("Employee deletion requires review of additional relationships. Set the employee to Inactive instead.");
        }
        private static Guid Identity(string value) {
            Guid id;
            if (!Guid.TryParse(value, out id) || id == Guid.Empty) { Fail("Valid record and operation identities are required."); return Guid.Empty; }
            return id;
        }
        private static void MatchName(Entity entity, string name) { if (entity.GetAttributeValue<string>("a365_name") != name) Fail("The record name changed. Close this confirmation and review it again."); }
        private static void RequireProcessing(Entity period) {
            var status = period.GetAttributeValue<OptionSetValue>("a365_payrollstatus");
            if (status == null || (status.Value != 749910001 && status.Value != 749910000)) Fail("Only Processing payroll periods and their entries can be deleted. Refresh the payroll list.");
        }
        private static void RequireVersion(Entity entity) {
            if (String.IsNullOrEmpty(entity.RowVersion) && entity.Contains("versionnumber")) entity.RowVersion = Convert.ToString(entity["versionnumber"], CultureInfo.InvariantCulture);
            if (String.IsNullOrEmpty(entity.RowVersion)) Fail("Concurrency metadata is unavailable. Nothing was deleted.");
        }
        private static void LockPeriod(IOrganizationService service, Entity period) {
            var update = new Entity(period.LogicalName, period.Id) { RowVersion = period.RowVersion };
            update["a365_name"] = period.GetAttributeValue<string>("a365_name");
            service.Execute(new UpdateRequest { Target = update, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
        }
        private static void DeleteVersion(IOrganizationService service, Entity entity) {
            var target = entity.ToEntityReference(); target.RowVersion = entity.RowVersion;
            service.Execute(new DeleteRequest { Target = target, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
        }
        private static void RequireAdmin(IOrganizationService system, Guid user) {
            var direct = new QueryExpression("role") { ColumnSet = new ColumnSet("roleid"), TopCount = 1 };
            direct.Criteria.AddCondition("name", ConditionOperator.Equal, "A365 - Payroll Admin");
            direct.AddLink("systemuserroles", "roleid", "roleid").LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
            if (system.RetrieveMultiple(direct).Entities.Count > 0) return;
            var team = new QueryExpression("role") { ColumnSet = new ColumnSet("roleid"), TopCount = 1 };
            team.Criteria.AddCondition("name", ConditionOperator.Equal, "A365 - Payroll Admin");
            team.AddLink("teamroles", "roleid", "roleid").AddLink("teammembership", "teamid", "teamid").LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
            if (system.RetrieveMultiple(team).Entities.Count == 0) Fail("Payroll Admin access is required.");
        }
        private static void Fail(string message) { throw new InvalidPluginExecutionException("PAYROLL_DELETE: " + message); }
    }
}
