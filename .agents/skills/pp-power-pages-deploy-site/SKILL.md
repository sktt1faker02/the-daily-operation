---
name: pp-power-pages-deploy-site
description: "Deploys an existing Power Pages code site to a Power Pages environment using PAC CLI. Handles tooling verification, authentication, environment confirmation, building, and uploading. Use when the user wants to deploy, upload, or publish their code site. user-invocable: true allowed-tools: Read, Bash, AskUserQuestion, Glob, Grep, TaskCreate, TaskUpdate, TaskList model: sonnet"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/deploy-site/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

