---
name: pp-power-apps-mobile-extension-publish-pcf-companion
description: "Deploy the dispatcher PCF for a third-party `.ppmplugin` control to a Power Platform environment via `pac pcf push`. The dispatcher PCF is the Studio-side control that dispatches the composite key `\u003cname\u003e/\u003creceiver\u003e` over the wrap shell\u0027s `SendMessagePlugin` bridge to the control\u0027s native module. Verifies deploy prereqs (Node.js 20+ with npm, .NET SDK, and active `pac auth`), then three confirmation gates â€” publisher prefix (2â€“8 chars; defaults to `pamext` or the last-used value from `.extension-state.md`), version bump (patch / minor / major / no-bump), target environment URL (from `pac org who`). Builds the PCF if needed, then pushes. Decoupled from /generate-pcf-companion so the engineer can scaffold and customize locally, then deploy when ready. Updates `.extension-state.md` with deployment history (timestamp, env URL, version, prefix used)."
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/publish-pcf-companion/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

