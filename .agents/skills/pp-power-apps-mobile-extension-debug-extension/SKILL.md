---
name: pp-power-apps-mobile-extension-debug-extension
description: "Diagnose and fix failures in a built third-party `.ppmplugin` control: crashes, silent no-ops, PCF error outputs, or incorrect behavior. Uses the reported symptom, `shared/error-codes.md`, and file-level evidence to trace the manifest, Android/iOS modules, PCF dispatch, and build configuration. Produces a ranked diagnosis, asks for approval, then applies a surgical fix while keeping the committed manifest and affected contracts synchronized. Re-validates manifest changes through /generate-ppmplugin-manifest.\""
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/debug-extension/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

