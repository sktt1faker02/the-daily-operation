---
name: pp-power-pages-manage-firewall
description: "Inspects and configures the web application firewall (WAF) in front of a Power Pages production site. Lists the current state, recommends enabling protection when it is off, and walks the user through adding, updating, or removing custom rules â€” IP blocks, country blocks, path blocks, and rate limits. Use when the user wants to turn on WAF, block traffic by IP or country, rate-limit login or signup pages, protect pages from brute-force attempts, restrict access to specific paths, review the current firewall configuration, or asks \"is my site protected against bots / common web attacks?\" â€” even if they say \"add rate limit\" or \"protect login page\" without mentioning \"firewall\" or \"WAF\". user-invocable: true argument-hint: \"[optional: --review \u003cout-dir\u003e]\" allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, TaskCreate, TaskUpdate, TaskList model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/manage-firewall/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

