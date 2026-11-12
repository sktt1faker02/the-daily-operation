---
name: pp-power-pages-scan-site
description: "Runs a security scan on a deployed Power Pages site, fetches the latest scan report, and produces a plain-language summary. Scans the live site\u0027s public surface for vulnerabilities and surfaces issues by severity. Use when the user wants to scan, check, test, audit, or assess a published site, find vulnerabilities on production, view the latest scan report, see previous scan results, run a security audit, or asks \"how safe is my live site?\", \"is my site vulnerable?\", \"audit my production site\" â€” even if they say \"find issues\" or \"check for problems\" without mentioning \"scan\" or \"security\". user-invocable: true argument-hint: \"[optional: --review \u003cout-dir\u003e]\" allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, TaskCreate, TaskUpdate, TaskList model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/scan-site/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

