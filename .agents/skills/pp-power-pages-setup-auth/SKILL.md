---
name: pp-power-pages-setup-auth
description: "Use when the user asks to \"set up authentication\", \"add login\", \"add logout\", \"add sign in\", \"enable auth\", \"add role-based access\", \"add authorization\", \"protect routes\", \"configure identity provider\", \"configure Entra ID\", \"configure Entra External ID\", \"configure OpenID Connect\", \"add OIDC\", \"set up SAML\", \"set up WS-Federation\", \"set up local login\", \"add Facebook login\", \"add Google sign in\", \"add Microsoft Account\", or otherwise wants to set up authentication (login/logout) and role-based authorization for their Power Pages code site using any supported identity provider. Also sets up the IdP app registration for OIDC providers (Okta, Auth0, Entra External ID, and other OIDC) -- reads the provider\u0027s docs first, then either guides the user through the provider\u0027s console or, when the provider supports it, configures it for the user -- and wires the client ID, authority, and claims mapping into Power Pages. user-invocable: true allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion, Task, TaskCreate, TaskUpdate, TaskList, Skill, mcp__plugin_power-pages_microsoft-learn__microsoft_docs_search, mcp__plugin_power-pages_microsoft-learn__microsoft_docs_fetch model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/setup-auth/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

