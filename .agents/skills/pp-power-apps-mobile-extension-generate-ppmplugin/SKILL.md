---
name: pp-power-apps-mobile-extension-generate-ppmplugin
description: "Build and verify a third-party `.ppmplugin` end to end. This recommended entry point detects Android and iOS source, confirms target platforms, then invokes the manifest, platform build, assemble, and audit stages in order. Advanced users can invoke a stage directly for focused reruns or debugging. Produces a native-only bundle (`manifest.json` plus an Android DEX and/or iOS framework) and stops on any failed stage rather than emitting an unverified partial build. Run after the native module exists."
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/generate-ppmplugin/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

