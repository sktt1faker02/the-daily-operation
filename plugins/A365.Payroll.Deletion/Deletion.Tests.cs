using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Script.Serialization;
using A365.Payroll.Deletion;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

public static class DeletionTests
{
    private sealed class GuardServices : IServiceProvider {
        private readonly RemoteExecutionContext context;
        public GuardServices(RemoteExecutionContext value){context=value;}
        public object GetService(Type type){return type==typeof(IPluginExecutionContext)?context:null;}
    }
    private static void GuardCheck(string table,string message,string api,bool accepted,bool transaction=true){
        var child=new RemoteExecutionContext {PrimaryEntityName=table,MessageName=message,IsInTransaction=transaction};
        if(api!=null)child.ParentContext=new RemoteExecutionContext{MessageName=api,Stage=30,IsInTransaction=transaction};
        bool allowed=true;
        try{new ProtectDeletionWrites().Execute(new GuardServices(child));}catch(InvalidPluginExecutionException){allowed=false;}
        Check(allowed==accepted,"guard "+table+" "+message+" "+api);
    }
    private sealed class Store : IOrganizationService, IOrganizationServiceFactory, IServiceProvider
    {
        public readonly Guid PeriodId = Guid.NewGuid(), EmployeeId = Guid.NewGuid(), EntryId = Guid.NewGuid(), UserId = Guid.NewGuid();
        public readonly Dictionary<string, Entity> Rows = new Dictionary<string, Entity>();
        public bool Admin = true, TeamAdmin, Dependent, Conflict;
        public int Creates, Deletes, Updates;
        public RemoteExecutionContext Context;
        public Store() {
            var period=new Entity("a365_payrollperiod",PeriodId){RowVersion="1"};
            period["a365_name"]="Synthetic cutoff"; period["a365_payrollstatus"]=new OptionSetValue(749910001); Put(period);
            var employee=new Entity("a365_employee",EmployeeId){RowVersion="1"}; employee["a365_name"]="Synthetic employee"; Put(employee);
            var entry=new Entity("a365_payrollentry",EntryId){RowVersion="1"};
            entry["a365_payrollperiod"]=new EntityReference("a365_payrollperiod",PeriodId); entry["a365_employee"]=new EntityReference("a365_employee",EmployeeId); Put(entry);
        }
        private static string Key(string table, Guid id) { return table + id.ToString(); }
        private void Put(Entity entity) { Rows[Key(entity.LogicalName, entity.Id)]=entity; }
        public object GetService(Type type) { if (type==typeof(IPluginExecutionContext)) return Context; if(type==typeof(IOrganizationServiceFactory)) return this; return null; }
        public IOrganizationService CreateOrganizationService(Guid? user) { return this; }
        public Entity Retrieve(string table, Guid id, ColumnSet columns) {
            var source=Rows[Key(table,id)]; var copy=new Entity(table,id) { RowVersion=source.RowVersion };
            foreach(var pair in source.Attributes) copy[pair.Key]=pair.Value;
            return copy;
        }
        public EntityCollection RetrieveMultiple(QueryBase basis) {
            var query=(QueryExpression)basis;
            if(query.EntityName=="role") {
                bool team=query.LinkEntities[0].LinkToEntityName=="teamroles";
                return new EntityCollection((team ? TeamAdmin : Admin) ? new List<Entity>{new Entity("role",Guid.NewGuid())} : new List<Entity>());
            }
            if(query.EntityName=="a365_payrolldeletionreceipt") {
                var id=(Guid)query.Criteria.Conditions[0].Values[0]; Entity row;
                return new EntityCollection(Rows.TryGetValue(Key(query.EntityName,id),out row) ? new List<Entity>{row} : new List<Entity>());
            }
            if(query.EntityName=="a365_payrollentry" && query.PageInfo.Count>0) return new EntityCollection(new List<Entity>{Retrieve("a365_payrollentry",EntryId,new ColumnSet())});
            return new EntityCollection(Dependent ? new List<Entity>{new Entity(query.EntityName,Guid.NewGuid())} : new List<Entity>());
        }
        public Guid Create(Entity entity) { Creates++; Put(entity); return entity.Id; }
        public OrganizationResponse Execute(OrganizationRequest request) {
            if(request is RetrieveEntityRequest) {
                var result=new RetrieveEntityResponse();
                var metadata=new EntityMetadata();
                typeof(EntityMetadata).GetProperty("OneToManyRelationships").GetSetMethod(true).Invoke(metadata,new object[]{new[]{new OneToManyRelationshipMetadata { ReferencingEntity="a365_payrollentry", ReferencingAttribute="a365_employee" }}});
                typeof(EntityMetadata).GetProperty("ManyToManyRelationships").GetSetMethod(true).Invoke(metadata,new object[]{new ManyToManyRelationshipMetadata[0]});
                result.Results["EntityMetadata"]=metadata;
                return result;
            }
            if(request is UpdateRequest) {
                var update=(UpdateRequest)request;
                Check(update.ConcurrencyBehavior==ConcurrencyBehavior.IfRowVersionMatches,"parent concurrency required");
                var existing=Rows[Key(update.Target.LogicalName,update.Target.Id)];
                if(Conflict || existing.RowVersion!=update.Target.RowVersion) throw new InvalidPluginExecutionException("simulated concurrency mismatch");
                existing.RowVersion="2"; Updates++; return new UpdateResponse();
            }
            if(request is DeleteRequest) {
                var delete=(DeleteRequest)request;
                Check(delete.ConcurrencyBehavior==ConcurrencyBehavior.IfRowVersionMatches,"delete concurrency required");
                Check(delete.Target.RowVersion==Rows[Key(delete.Target.LogicalName,delete.Target.Id)].RowVersion,"matching delete version");
                Rows.Remove(Key(delete.Target.LogicalName,delete.Target.Id)); Deletes++; return new DeleteResponse();
            }
            throw new NotSupportedException(request.RequestName);
        }
        public void Update(Entity entity) { throw new NotSupportedException(); }
        public void Delete(string table,Guid id) { throw new NotSupportedException(); }
        public void Associate(string table,Guid id,Relationship relationship,EntityReferenceCollection related) { throw new NotSupportedException(); }
        public void Disassociate(string table,Guid id,Relationship relationship,EntityReferenceCollection related) { throw new NotSupportedException(); }
        public DeleteRequestBody Input() { return new DeleteRequestBody { periodId=PeriodId.ToString(),periodName="Synthetic cutoff",employeeId=EmployeeId.ToString(),employeeName="Synthetic employee",entryId=EntryId.ToString(),operationId=Guid.NewGuid().ToString() }; }
        public void Run(string api, DeleteRequestBody input) {
            Context=new RemoteExecutionContext { MessageName=api,IsInTransaction=true,Stage=30,InitiatingUserId=UserId };
            Context.InputParameters["Request"]=new JavaScriptSerializer().Serialize(input);
            new DeletePayrollPeriod().Execute(this);
        }
    }
    private static void Check(bool value,string message) { if(!value) throw new Exception(message); }
    private static void Reject(Store store,string api,DeleteRequestBody input,string message) {
        bool rejected=false; try{store.Run(api,input);}catch(InvalidPluginExecutionException){rejected=true;}
        Check(rejected,message); Check(store.Creates==0 && store.Deletes==0,message+" wrote data");
    }
    public static int Run() {
        int count=0;
        foreach(var api in new[]{"a365_DeletePayrollPeriod","a365_DeletePayrollEntry","a365_DeleteEmployee"}) {
            var denied=new Store {Admin=false}; Reject(denied,api,denied.Input(),"non-admin denied"); count++;
            var preview=new Store(); var input=preview.Input(); input.preview=true; preview.Run(api,input);
            Check(preview.Deletes==0 && preview.Creates==0 && preview.Updates==0,"preview must be read-only"); count++;
        }
        foreach(var api in new[]{"a365_DeletePayrollPeriod","a365_DeletePayrollEntry"}) {
            foreach(var status in new[]{749910002,749910003,749910004,123}) {
                var store=new Store(); store.Rows["a365_payrollperiod"+store.PeriodId]["a365_payrollstatus"]=new OptionSetValue(status);
                Reject(store,api,store.Input(),"finalized/unknown status denied"); count++;
            }
            var conflicted=new Store{Conflict=true}; Reject(conflicted,api,conflicted.Input(),"concurrent status change denied"); count++;
        }
        var period=new Store(); var periodInput=period.Input(); period.Run("a365_DeletePayrollPeriod",periodInput);
        Check(period.Creates==1 && period.Deletes==2 && period.Updates==1,"period and entry removed once");
        period.Run("a365_DeletePayrollPeriod",periodInput); Check(period.Creates==1 && period.Deletes==2,"idempotent period retry"); count++;
        var entry=new Store{Admin=false,TeamAdmin=true}; entry.Run("a365_DeletePayrollEntry",entry.Input());
        Check(entry.Deletes==1 && entry.Rows.ContainsKey("a365_employee"+entry.EmployeeId) && entry.Rows.ContainsKey("a365_payrollperiod"+entry.PeriodId),"team admin removes entry only"); count++;
        var dependent=new Store{Dependent=true}; Reject(dependent,"a365_DeleteEmployee",dependent.Input(),"employee history protected"); count++;
        var employee=new Store(); employee.Run("a365_DeleteEmployee",employee.Input()); Check(employee.Deletes==1 && employee.Creates==1 && employee.Updates==0,"unreferenced employee deleted with receipt"); count++;
        var renamed=new Store(); var renamedInput=renamed.Input(); renamedInput.periodName="another cutoff"; Reject(renamed,"a365_DeletePayrollPeriod",renamedInput,"confirmation name protected"); count++;
        var mismatch=new Store(); var mismatchInput=mismatch.Input(); mismatchInput.employeeId=Guid.NewGuid().ToString(); Reject(mismatch,"a365_DeletePayrollEntry",mismatchInput,"entry employee binding protected"); count++;
        foreach(var table in new[]{"a365_payrollperiod","a365_payrollentry","a365_employee"}){GuardCheck(table,"Delete",null,false);count++;}
        GuardCheck("a365_payrollperiod","Delete","a365_DeletePayrollPeriod",true);count++;
        GuardCheck("a365_payrollentry","Delete","a365_DeletePayrollEntry",true);count++;
        GuardCheck("a365_payrollentry","Delete","a365_DeletePayrollPeriod",true);count++;
        GuardCheck("a365_employee","Delete","a365_DeleteEmployee",true);count++;
        GuardCheck("a365_employee","Delete","a365_DeletePayrollPeriod",false);count++;
        GuardCheck("a365_payrollentry","Delete","a365_DeleteEmployee",false);count++;
        GuardCheck("a365_payrollperiod","Delete","a365_DeletePayrollPeriod",false,false);count++;
        foreach(var api in new[]{"a365_DeletePayrollPeriod","a365_DeletePayrollEntry","a365_DeleteEmployee"}){GuardCheck("a365_payrolldeletionreceipt","Create",api,true);count++;}
        foreach(var message in new[]{"Create","Update","Delete","Upsert","CreateMultiple","UpdateMultiple"}){GuardCheck("a365_payrolldeletionreceipt",message,null,false);count++;}
        return count;
    }
}
