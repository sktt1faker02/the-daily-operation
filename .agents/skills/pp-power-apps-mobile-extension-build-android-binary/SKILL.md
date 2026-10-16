---
name: pp-power-apps-mobile-extension-build-android-binary
description: "Compile a PAM control\u0027s Android Kotlin module into the runtime-loadable DEX for a `.ppmplugin`. Creates a staged Gradle build with the pinned wrapper and `react-android` compile dependency, verifies manifest/module/package alignment and runtime-loading constraints, builds the release AAR, then runs `d8 --min-api 24`. Writes `ppmplugin/staging/android/\u003cPascalName\u003ePlugin.dex` and surfaces actionable Gradle or d8 failures. Requires JDK 17+ and Android SDK Build-Tools 35.0.0; `d8` is located from the SDK and system Gradle is optional. Run after /generate-ppmplugin-manifest and before /assemble-ppmplugin.\""
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/build-android-binary/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

