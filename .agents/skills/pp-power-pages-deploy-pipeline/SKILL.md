---
name: pp-power-pages-deploy-pipeline
description: "Triggers a Power Platform Pipeline deployment run for a Power Pages solution. Selects a target stage, validates the package, optionally configures deployment settings (environment variables, connection references), then deploys and polls for completion. Use when asked to: \"deploy pipeline\", \"run pipeline\", \"trigger deployment\", \"deploy to staging\", \"deploy to production\", \"run power platform pipeline\", \"deploy solution via pipeline\", \"promote solution\", \"push to staging\", \"push to production\". user-invocable: true argument-hint: \"Optional: stage name or environment label (e.g. \u0027staging\u0027, \u0027production\u0027) to skip stage selection\" allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TaskCreate, TaskUpdate, TaskList, AskUserQuestion, mcp__plugin_power-pages_microsoft-learn__microsoft_docs_search, mcp__plugin_power-pages_microsoft-learn__microsoft_docs_fetch model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/deploy-pipeline/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

