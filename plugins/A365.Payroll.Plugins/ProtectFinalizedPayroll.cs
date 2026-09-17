using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace A365.Payroll.Plugins
{
    /// <summary>
    /// Blocks edits to a payroll entry whose parent period is finalized
    /// (Ready / Paid / Locked). Register on: Update of a365_payrollentry,
    /// PreValidation, synchronous, with a pre-image "PreImage" containing
    /// a365_payrollperiod. This is the data-layer immutability guarantee;
    /// the app's edit-blocking UI is a convenience on top of it.
    /// </summary>
    public sealed class ProtectFinalizedPayroll : IPlugin
    {
        private const int Ready = 749910002;
        private const int Paid = 749910003;
        private const int Locked = 749910004;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.MessageName != "Update" || !context.InputParameters.Contains("Target"))
                return;

            var periodRef = ResolvePeriod((Entity)context.InputParameters["Target"], context);
            if (periodRef == null)
                return;

            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(context.UserId);
            var period = service.Retrieve("a365_payrollperiod", periodRef.Id, new ColumnSet("a365_payrollstatus"));
            var status = period.GetAttributeValue<OptionSetValue>("a365_payrollstatus");
            if (status != null && (status.Value == Ready || status.Value == Paid || status.Value == Locked))
            {
                throw new InvalidPluginExecutionException(
                    "This payroll is finalized and cannot be edited. Unlock the period to make corrections.");
            }
        }

        private static EntityReference ResolvePeriod(Entity target, IPluginExecutionContext context)
        {
            if (target.Contains("a365_payrollperiod"))
                return target.GetAttributeValue<EntityReference>("a365_payrollperiod");
            if (context.PreEntityImages.Contains("PreImage") &&
                context.PreEntityImages["PreImage"].Contains("a365_payrollperiod"))
                return context.PreEntityImages["PreImage"].GetAttributeValue<EntityReference>("a365_payrollperiod");
            return null;
        }
    }
}
