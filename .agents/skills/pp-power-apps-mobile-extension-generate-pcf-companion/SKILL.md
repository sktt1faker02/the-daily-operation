---
name: pp-power-apps-mobile-extension-generate-pcf-companion
description: "Generate the dispatcher PCF for a third-party `.ppmplugin` (wrap-runtime) control. Runs `pac pcf init` in the pcf/ subfolder, rewrites ControlManifest.Input.xml from ARCHITECTURE Â§6, and writes index.ts derived from ARCHITECTURE Â§4 (message contract), Â§8 (PCF surface), Â§9 (error UX) â€” no placeholders. The bridge dispatches the composite key `\u003cname\u003e/\u003creceiver\u003e` to `NativeModules.\u003cnativeModule\u003e.\u003cmethod\u003e` via the host-injected `window.PowerApps.NativeExtension.sendAsync` global (never `cordova.exec` â€” not in the PCF sandbox); also emits a `PowerAppsNativeExtension.d.ts` ambient declaration. Responses are peeled with `extractResponse`. Emits structured JSON debug/error logs. Validated by `npm run build`. **Local only** â€” does not deploy. Needs only `pac` CLI. Run after the native module exists. Uses npm (not pnpm)."
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/generate-pcf-companion/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

