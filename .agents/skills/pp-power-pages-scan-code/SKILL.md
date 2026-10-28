---
name: pp-power-pages-scan-code
description: "Scans a Power Pages site project for security issues in source code and dependencies. Runs static analysis and dependency scanning, then surfaces findings by category (code patterns, vulnerable packages, secrets, license issues). Use when the user wants to review code for security problems, check for vulnerable packages, find hard-coded secrets, run a code scan, or asks \"is my code safe?\", \"check my dependencies\", \"find security issues in my source\" â€” even if they say \"audit my code\" without mentioning specific tools. user-invocable: true argument-hint: \"[optional: --review \u003cout-dir\u003e]\" allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, TaskCreate, TaskUpdate, TaskList model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/scan-code/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

