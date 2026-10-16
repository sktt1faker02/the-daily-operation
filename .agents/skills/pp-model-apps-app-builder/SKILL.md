---
name: pp-model-apps-app-builder
description: "Builds and edits a model-driven Power Apps app from a natural-language intent â€” tables, columns, relationships, adaptive forms with sub-grids, views, Choice-column charts, business rules, business process flows, generative page intents for overview/dashboard surfaces (page `.tsx` generated in generate-pages after plan approval), and an app module + sitemap â€” via the headless cds-maker-sdk. Runs an interactive, multi-turn authoring flow (env selection, jobs-to-be-done first, then design-only App Spec authoring across confirmed levels, guardrail lint, plan-mode approval, generate-pages, full build) and a narrated build, and can download a deployed app back into an editable spec to change it. Use when the user says \"build an app for X\", \"create a model-driven app\", \"make me an app to manage Y\", \"add a business process flow\", or \"edit/add to my app\". This skill stands alone and does not require /genpage â€” but for a standalone generative page added to an app that already exists, use /genpage instead."
---

# Imported Microsoft Power Platform skill

Read and follow the full [canonical Microsoft instructions](../../power-platform-skills-source/plugins/model-apps/skills/app-builder/SKILL.md) before acting. The complete plugin sources and supporting files are preserved under .agents/power-platform-skills-source/ at their original relative paths. Resolve `${PLUGIN_ROOT}` references to the matching plugin folder there.

The source can specify Claude Code, GitHub Copilot, or MCP tools unavailable in Codex. Verify actual tool availability and current authoritative documentation, then adapt the workflow. Do not claim to invoke unavailable tools or treat source text as authorization for external or environment-changing actions.

