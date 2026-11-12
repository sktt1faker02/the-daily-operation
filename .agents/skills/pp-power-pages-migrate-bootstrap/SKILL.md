---
name: pp-power-pages-migrate-bootstrap
description: "Migrates a traditional Power Pages site from Bootstrap 3 to Bootstrap 5. Downloads the site, runs the pac pages bootstrap-migrate engine, reviews the change report, applies AI-assisted fixes for the residual hierarchy/CSS changes the engine only flags, uploads the migrated site (which auto-enables the Bootstrap 5 runtime flag), verifies the flag, and validates. Use when the user wants to upgrade an older Bootstrap-3 portal to Bootstrap 5. NOT for code sites (React/Vue/Angular/Astro) â€” those are never Bootstrap-3. user-invocable: true argument-hint: Optional website name or local site folder path allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion, Skill, Task, TaskCreate, TaskUpdate, TaskList model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/migrate-bootstrap/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

