---
name: pp-power-pages-migrate-webapi-selectall
description: "Reviews and migrates deprecated wildcard (*) values in Power Pages Web API fields site settings to least-privilege explicit Dataverse columns. Use whenever a user mentions Web API wildcard or select-all remediation, fields settings containing *, data-exposure review, wildcard deprecation readiness, or Web API failures after wildcard retirement. Applies to both traditional sites using HTML, CSS, JavaScript, Liquid, and downloaded YAML, and SPA sites using React, Vue, Angular, Astro, or TypeScript. The agent must inspect every source Web API call and consumer, report exact fixes for every wildcard, report every already-explicit configuration, apply approved edits, and verify no wildcard remains. user-invocable: true argument-hint: Optional Power Pages project path allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion, TaskCreate, TaskUpdate, TaskList model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/migrate-webapi-selectall/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

