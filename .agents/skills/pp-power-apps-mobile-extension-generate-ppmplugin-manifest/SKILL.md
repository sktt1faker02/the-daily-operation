---
name: pp-power-apps-mobile-extension-generate-ppmplugin-manifest
description: "Validate, reconcile to the chosen target(s), and stage the `manifest.json` for a `.ppmplugin` bundle. In the normal flow the committed `./manifest.json` already exists (authored by /generate-native-extension), so this stage reads it, runs the plugin\u0027s upload-compatibility checks locally as a pre-flight gate (name regex, canonical prefix, known incompatible names, method and identifier shapes), reconciles `entrypoints` down to the platform(s) you ship, and writes the gitignored staged copy `ppmplugin/staging/manifest.json` that /assemble-ppmplugin zips. If no committed manifest exists (a hand-authored module) it falls back to deriving every field from the class name and Android module source, writing both the committed file and the staged copy. No toolchain â€” pure read, validate, write. Target-aware. Run after the native module exists, before the build skills.\""
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/generate-ppmplugin-manifest/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

