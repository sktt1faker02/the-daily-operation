---
name: pp-power-pages-import-solution
description: "Imports a Dataverse solution zip into a target environment, with optional staged import for dependency checking before committing. Use when asked to: \"import solution\", \"install solution\", \"deploy solution zip\", \"push solution to environment\", \"deploy to staging\", \"deploy to production\", or \"install site in new environment\". user-invocable: true argument-hint: \"Optional: path to solution zip file\" allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TaskCreate, TaskUpdate, TaskList, AskUserQuestion, mcp__plugin_power-pages_microsoft-learn__microsoft_docs_search, mcp__plugin_power-pages_microsoft-learn__microsoft_docs_fetch model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/import-solution/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

