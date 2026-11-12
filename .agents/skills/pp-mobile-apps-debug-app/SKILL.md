---
name: pp-mobile-apps-debug-app
description: "Use when the user has finished building a mobile app, started Metro with `npm run dev`, and wants the running app monitored for runtime errors AND silent failures (empty lists, blank screens, swallowed network errors) and fixed autonomously. Accepts a free-text symptom (e.g., `/debug-app \"todos not appearing on home screen\"`) to drive persisted-log diagnostics â€” injects temporary console.log statements at data-path boundaries, reads the sanitized `.powernative/metro-logs/` log, and cleans up logs after the root cause is fixed. Supports port/platform filtering, configurable clean-cycle and timeout limits, and watch-only `--no-fix` mode. Otherwise polls with a durable byte cursor, fixes inline or routes appropriately, verifies each fix from new output, and exits after the configured clean checks (default 3). Foreground loop â€” blocks the conversation while running. Run only after the app is loaded."
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/mobile-apps/skills/debug-app/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

