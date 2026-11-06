---
name: pp-power-pages-plan-alm
description: "Creates an ALM (Application Lifecycle Management) plan for deploying a Power Pages site across environments. Gathers your promotion strategy, target environments, and approval requirements upfront, then generates a visual HTML plan document for your review and approval. **plan-alm does not deploy anything itself** â€” it is a planner. After you approve the plan, run the individual ALM skills (setup-solution, setup-pipeline, deploy-pipeline, or export-solution/import-solution); each detects the approved plan and executes the right step in order, keeping the plan updated as it runs. Use when asked to: \"plan my alm\", \"set up alm\", \"create deployment plan\", \"plan my deployments\", \"help me deploy to multiple environments\", \"set up promotion strategy\", \"create cicd plan\", \"plan site promotion\", \"help me go to production\", \"set up pipeline for my site\". user-invocable: true argument-hint: \"Optional: \u0027pipelines\u0027 or \u0027manual\u0027 to skip strategy selection\" allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TaskCreate, TaskUpdate, TaskList, AskUserQuestion model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/plan-alm/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

