---
name: pp-power-pages-audit-permissions
description: "Audits existing table permissions on a Power Pages site by analyzing them against site code and Dataverse metadata, then GRADES the configuration with deterministic 1â€“5 scores across 3 security/usability/correctness categories (9 dimensions). Detection is anchored by a recurring-issue catalog so findings and severities stay consistent run-to-run. Generates an HTML report with an at-a-glance verdict and per-category scores in the Overview plus a single list of **major/minor** issues (each major issue labelled permissions-only or upstream-caused with a short justification), and suggested fixes. Use when the user wants to review, verify, check, score, or grade table permissions for security issues. user-invocable: true argument-hint: \"[optional: specific table or concern]\" allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, Agent model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/audit-permissions/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

