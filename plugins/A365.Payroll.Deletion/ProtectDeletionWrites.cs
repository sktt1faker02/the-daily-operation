using System;
using Microsoft.Xrm.Sdk;

namespace A365.Payroll.Deletion
{
    /// <summary>Reject native Delete even when a role already grants it.
    /// Only transactional children of the matching validated API are accepted.</summary>
    public sealed class ProtectDeletionWrites : IPlugin
    {
        public void Execute(IServiceProvider services)
        {
            var context=(IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            var table=context.PrimaryEntityName;
            // Dataverse merges single and bulk pipelines: system.Create also
            // invokes CreateMultiple with one target. Both creation events must
            // accept the same validated API ancestry; other receipt writes stay blocked.
            bool creatingReceipt=table=="a365_payrolldeletionreceipt" &&
                (context.MessageName=="Create" || context.MessageName=="CreateMultiple");
            if(table=="a365_payrolldeletionreceipt" && !creatingReceipt)
                throw new InvalidPluginExecutionException("Deletion receipts cannot be changed or deleted.");
            if(context.IsInTransaction) {
                for(var parent=context.ParentContext;parent!=null;parent=parent.ParentContext) {
                    if(!parent.IsInTransaction) continue;
                    bool period=parent.MessageName=="a365_DeletePayrollPeriod";
                    bool entry=parent.MessageName=="a365_DeletePayrollEntry";
                    bool employee=parent.MessageName=="a365_DeleteEmployee";
                    if((context.MessageName=="Delete" && ((table=="a365_payrollperiod" && period) || (table=="a365_payrollentry" && (period || entry)) || (table=="a365_employee" && employee))) ||
                        (creatingReceipt && (period || entry || employee))) return;
                }
            }
            throw new InvalidPluginExecutionException("Use the confirmed deletion command. Direct deletion and receipt writes are not permitted.");
        }
    }
}
