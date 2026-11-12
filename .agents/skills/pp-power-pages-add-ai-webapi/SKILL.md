---
name: pp-power-pages-add-ai-webapi
description: "Integrates Power Pages generative-AI summarization APIs (PREVIEW) into a Single Page Application (SPA) site â€” the Search Summary API and the Data Summarization API â€” on any record-detail or list page. Generates per-target service code (CSRF-handled) and AI site settings; delegates Web API settings, table permissions, and web roles to `/integrate-webapi` and `/create-webroles`. Use whenever a user wants AI/Copilot output that condenses Dataverse content on a Power Pages site â€” an AI summary, AI-generated overview or \"key insights\" across a record or list, a search-results summary, a case/incident summary, or recommendation-chip refinement â€” even when phrased as \"AI-generated paragraph\", \"insights\", or \"overview\". Do NOT use for: generative pages in model-driven apps (use the model-apps `genpage` skill), Copilot Studio agents/chatbots, summarizing documents or PDFs, Power BI dashboards, plain keyword search with no AI summary, or plain Dataverse CRUD (use `/integrate-webapi`). user-invocable: true argument-hint: Optional description of which pages/tables need AI capabilities allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion, Skill, Task, TaskCreate, TaskUpdate, TaskList, mcp__plugin_power-pages_microsoft-learn__microsoft_docs_search, mcp__plugin_power-pages_microsoft-learn__microsoft_docs_fetch model: opus"
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/power-pages/skills/add-ai-webapi/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

