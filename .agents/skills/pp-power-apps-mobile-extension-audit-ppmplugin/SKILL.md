---
name: pp-power-apps-mobile-extension-audit-ppmplugin
description: "Statically audit a built `.ppmplugin` before wrap testing. Checks archive layout, manifest compatibility, bundle consistency, Android DEX integrity and SDK leakage, iOS framework structure, native source-to-receiver alignment, and the PCF composite-key/sendAsync transport contract. Reports CRITICAL, WARNING, and INFO findings with fixes routed to the owning stage; never modifies the archive. Requires `jar`; `dexdump` or `strings` improves DEX inspection. Run after /assemble-ppmplugin or standalone on an existing bundle.\""
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/audit-ppmplugin/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

