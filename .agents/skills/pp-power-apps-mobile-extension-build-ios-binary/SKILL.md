---
name: pp-power-apps-mobile-extension-build-ios-binary
description: "Compile a PAM control\u0027s iOS Obj-C/Swift module into the FLAT device-slice `.framework` for a `.ppmplugin` bundle (never an `.xcframework` â€” the wrap CI won\u0027t descend into one). Mac-only (Xcode). Builds from a throwaway staged copy so canonical `ios/` and the podspec stay untouched, references React-Core headers only (React is weak-linked and provided by the wrap host at runtime, no CocoaPods), generates the required umbrella header, module map and Info.plist, sets the critical build settings, asserts manifest conformance, then runs a device-only `xcodebuild archive` and copies out the flat framework to `ppmplugin/staging/ios/`. Known limitation â€” the React weak-link flags aren\u0027t yet validated against a live wrap host and the RN pin must match the host\u0027s. Run after /generate-ppmplugin-manifest for an iOS or Both target, before /assemble-ppmplugin.\""
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-apps-mobile-extension/skills/build-ios-binary/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

