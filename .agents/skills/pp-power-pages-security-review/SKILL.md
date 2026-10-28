---
name: pp-power-pages-security-review
description: "Runs a guided, end-to-end security review of a Power Pages site and consolidates every finding into one HTML report covering source code and dependencies, the live site, browser headers, firewall, authentication, and role-based permissions. Use when the user wants a full security review, a release-readiness check before publishing, a code-and-config check during development, live site monitoring, or asks open-ended questions like \"review my site security\", \"is my site safe to ship\", \"do a security check\", \"monitor my site\" â€” even if they do not name the individual checks. user-invocable: true argument-hint: \"[optional natural-language hint about the goal]\" allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, Skill, Agent model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/security-review/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

