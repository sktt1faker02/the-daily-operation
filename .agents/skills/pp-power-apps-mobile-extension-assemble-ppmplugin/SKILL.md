---
name: pp-power-apps-mobile-extension-assemble-ppmplugin
description: "Assemble the final `.ppmplugin` binary bundle for a PAM native extension and verify its contents. First **reconciles** the manifest\u0027s declared `entrypoints` against the binaries actually staged â€” if the manifest declares a platform with no built binary it gates (build it / ship without it / stop) rather than shipping a broken bundle. Then re-runs the plugin\u0027s upload-compatibility checks on the reconciled manifest, zips the manifest plus whichever of `android/\u003cPascalName\u003ePlugin.dex` and `ios/\u003cPascalName\u003ePlugin.framework/` are present into `ppmplugin/\u003cname\u003e.ppmplugin`, and verifies the archive layout with `jar tf` (exactly the manifest + the shipped binaries â€” nothing missing, nothing extra). Output: a statically verified `.ppmplugin` file on disk. Prereqs: `jar` (JDK). Run after /generate-ppmplugin-manifest and the build skill(s).\""
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/assemble-ppmplugin/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

