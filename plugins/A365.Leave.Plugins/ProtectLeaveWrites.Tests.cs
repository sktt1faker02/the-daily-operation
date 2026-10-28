using System;
using Microsoft.Xrm.Sdk;
using A365.Leave.Plugins;

public static class ProtectLeaveWritesTests
{
    private sealed class Services : IServiceProvider
    {
        private readonly IPluginExecutionContext context;
        public Services(RemoteExecutionContext value) { context = value; }
        public object GetService(Type type) { return type == typeof(IPluginExecutionContext) ? context : null; }
    }

    private static RemoteExecutionContext Context(string message, bool transaction)
    {
        return new RemoteExecutionContext { MessageName = message, IsInTransaction = transaction };
    }

    private static void Check(RemoteExecutionContext context, bool allowed, string scenario)
    {
        bool accepted = true;
        try { new ProtectLeaveWrites().Execute(new Services(context)); }
        catch (InvalidPluginExecutionException) { accepted = false; }
        if (accepted != allowed) throw new Exception("Write guard regression: " + scenario);
    }

    public static int Run()
    {
        // A nested pipeline receives a parent context snapshot; the live API's
        // SharedVariables mutation need not be present in that snapshot.
        var api = Context("a365_LeaveCommand", true);
        api.InputParameters["Request"] = "{\"command\":\"issue\"}";
        var child = Context("Create", true);
        child.ParentContext = api;
        Check(child, true, "validated API ancestor without shared-variable marker");
        var intermediate = Context("CreateMultiple", true);
        intermediate.ParentContext = api;
        child.ParentContext = intermediate;
        Check(child, true, "validated API through an intermediate pipeline");
        var direct = Context("Create", true);
        direct.SharedVariables["A365.ValidatedLeaveCommand"] = true;
        Check(direct, false, "direct write cannot authorize itself with a marker");
        direct.ParentContext = Context("Update", true);
        direct.ParentContext.SharedVariables["A365.ValidatedLeaveCommand"] = true;
        Check(direct, false, "unrelated ancestor with a marker");
        child.ParentContext = Context("a365_LeaveCommand", false);
        Check(child, false, "nontransactional API ancestor");
        child.ParentContext = api;
        child.IsInTransaction = false;
        Check(child, false, "nontransactional child");
        child.IsInTransaction = true;
        child.PrimaryEntityName = "a365_leavecashconversion";
        Check(child, false, "Leave issuance cannot modify conversions");
        foreach (string command in new[] { "conversionCreate", "conversionSave" }) {
            api.InputParameters["Request"] = "{\"command\":\"" + command + "\"}";
            Check(child, true, "validated conversion mutation");
            child.PrimaryEntityName = "a365_leave"; Check(child, false, "conversion mutation cannot change Leave"); child.PrimaryEntityName = "a365_leavecashconversion";
        }
        foreach (string command in new[] { "conversionRows", "conversionYears", "unknown" }) {
            api.InputParameters["Request"] = "{\"command\":\"" + command + "\"}"; Check(child, false, "read command cannot authorize writes");
        }
        api.InputParameters["Request"] = "{\"command\":\"conversionMarkPaid\"}";
        child.MessageName = "Update"; child.PrimaryEntityName = "a365_leaveconversionyear";
        Check(child, true, "payment can lock the year header");
        child.MessageName = "SetState"; Check(child, true, "payment supports header state transition");
        child.MessageName = "Delete"; Check(child, false, "payment cannot delete the year");
        child.MessageName = "Update"; child.PrimaryEntityName = "a365_leavecashconversion";
        Check(child, false, "payment cannot modify employee conversion values");
        child.PrimaryEntityName = "a365_leave"; Check(child, false, "payment cannot modify Leave");
        api.InputParameters["Request"] = "{\"command\":\"delete\"}";
        child.PrimaryEntityName = "a365_leave"; child.MessageName = "Delete"; Check(child, true, "validated source deletion");
        child.MessageName = "Update"; Check(child, false, "deletion cannot edit source values");
        child.PrimaryEntityName = "a365_leavecredittransaction"; Check(child, true, "deletion can detach original credit movements");
        child.MessageName = "Create"; Check(child, true, "deletion can create restoration receipt");
        child.MessageName = "Delete"; Check(child, false, "deletion cannot erase credit movements");
        child.PrimaryEntityName = "a365_leavecashconversion"; Check(child, false, "deletion cannot erase conversions");
        api.InputParameters["Request"] = "{\"command\":\"deletePreview\"}";
        child.PrimaryEntityName = "a365_leave"; Check(child, false, "deletion preview cannot mutate records");
        api.InputParameters["Request"] = "{\"command\":\"delete\"}";
        foreach (string entity in new[] { "a365_leavecredittransaction", "a365_leavecoordination" }) {
            child.PrimaryEntityName = entity;
            foreach (string message in new[] { "Create", "CreateMultiple", "Update", "UpdateMultiple" }) {
                child.MessageName = message; Check(child, true, "validated merged deletion pipeline " + entity + " " + message);
            }
            foreach (string message in new[] { "CreateMultiple", "UpdateMultiple" }) {
                var bulkDirect = Context(message, true); bulkDirect.PrimaryEntityName = entity;
                Check(bulkDirect, false, "direct bulk writes remain blocked " + entity + " " + message);
            }
        }
        child.PrimaryEntityName = "a365_leave";
        foreach (string message in new[] { "CreateMultiple", "UpdateMultiple" }) {
            child.MessageName = message; Check(child, false, "deletion cannot bulk create/edit sources");
        }
        api.InputParameters["Request"] = "{\"command\":\"deletePreview\"}";
        child.MessageName = "UpdateMultiple";
        foreach (string entity in new[] { "a365_leavecredittransaction", "a365_leavecoordination" }) {
            child.PrimaryEntityName = entity; Check(child, false, "preview cannot authorize bulk writes");
        }
        return 42;
    }

    public static void VerifyLegacyMarkerDependency()
    {
        // Read-only replay against the downloaded PRE-FIX DLL, never deployed.
        var api = Context("a365_LeaveCommand", true);
        var child = Context("Create", true);
        child.ParentContext = api;
        Check(child, false, "legacy DLL rejects valid ancestry without marker");
        api.SharedVariables["A365.ValidatedLeaveCommand"] = true;
        Check(child, true, "legacy DLL requires an extra parent snapshot marker");
    }
}
