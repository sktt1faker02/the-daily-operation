# 02 — Setup and deployment

**Evidence rule.** **[Code]** statements describe files or behavior visible in
this repository. **[Verify in environment]** statements require a current
Power Platform or workstation check. This guide omits connection strings,
credentials, environment IDs, organization URLs, app IDs, and solution GUIDs.

## 1. Prerequisites

**[Verify in environment]** Microsoft lists an IDE, Node.js LTS, npm, Git, and
Power Apps CLI as prerequisites for Power Apps Code Apps. The target Power
Platform environment must also have Code Apps enabled. Confirm these before
setup in the current workspace and admin center. [Microsoft Learn: Code Apps
overview](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview).

**[Code]** This repository has a lockfile and uses npm scripts. Its manifest
declares `@microsoft/power-apps-cli` version `1.0.1` as a development
dependency. The current inspection workstation reported Node `v24.21.0`, npm
`11.19.0`, and local `pa` CLI `1.0.1`; these are capture-time values, not a
version policy (`package.json`, `package-lock.json`; `node --version`,
`npm --version`, and local `pa --version`).

## 2. First-day local checklist

1. **[Verify in environment]** Obtain the repository through the team’s approved
   source-control process. Start in the repository root.
2. **[Verify in environment]** Install a supported Node.js LTS release, npm,
   Git, and the current Power Apps CLI. Sign in and verify the intended account
   with `pa auth login` and `pa auth status` (Microsoft Learn: [Power Apps CLI
   reference](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli)).
3. **[Code]** Install the locked project dependencies with `npm ci` (the repo
   includes `package-lock.json`). If dependency changes are intentionally
   needed, use the team’s package-update procedure; this handover does not
   change dependencies.
4. **[Code]** Check `power.config.json` locally and confirm the configured
   environment is the intended development environment before any publishing
   command. The file contains a configured environment binding; this handover
   does not repeat its value.
5. **[Code]** Run `npm run build` to type-check and create the production web
   build (`package.json` › `scripts.build`).
6. **[Verify in environment]** Run the Power Apps local host with `pa app run`
   and sign in through the host. `npm run dev` starts the Vite development
   server, but does not replace the Power Apps host integration. The CLI
   command is documented in Microsoft’s [Power Apps CLI reference](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli).
7. **[Verify in environment]** Confirm the expected role-gated landing page
   appears and that Dataverse reads succeed for a test account. Do not use real
   payroll data for setup checks.

**[Code]** The available npm scripts are `dev`, `build`, `lint`, `preview`,
`test`, and `test:watch` (`package.json` › `scripts`). The project guidance
also recommends `pa app run`, `npm run build`, `npm run lint`, and
`npm run preview` (`AGENTS.md` › Development Commands).

## 3. How data-source code is maintained

**[Code]** Registered Dataverse table data sources in
`.power/schemas/appschemas/dataSourcesInfo.ts` are: `a365_departments`,
`a365_employees`, `a365_hdmfcontributions`, `a365_payrollentries`,
`a365_payrollperiods`, `a365_payrolltemplatelines`, `a365_payrolltemplates`,
`a365_philhealthcontributions`, `a365_positions`, `a365_ssscontributions`,
`a365_taxbrackets`, `roles`, and `systemusers`. The same registration also
contains the `whoami` Dataverse API operation. Generated models and services
are under `src/generated/models/` and `src/generated/services/`.

**[Code]** Feature services use the shared SDK client in
`src/lib/power/data-client.ts` › `dataClient`. Generated files are output from
the Power Apps CLI and must not be edited by hand (`AGENTS.md` › Dataverse
Rules; generated-file headers).

**[Verify in environment]** To add an existing Dataverse table, confirm its
logical name in the intended environment first, then from the app root run:

```powershell
npx --no-install pa app add data-source --connector dataverse --table <table-logical-name>
```

To refresh generated metadata for a registered source, use:

```powershell
npx --no-install pa app refresh data-source --name <data-source-name>
```

These are current CLI command forms documented by Microsoft. The CLI writes
generated schema/model/service artifacts, so review the diff and rebuild
afterward. [Microsoft Learn: CLI reference](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli) and [Connect a code app to Dataverse](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse).

## 4. Build and publish to Power Apps

**[Code]** For a development publish, the repository deployment runbook shows
building first and then using `pa app push`. It also documents adding the app
to a solution with `--solution-id` (`docs/deployment.md` › Step 1 and Updating
an existing release). The general syntax is:

```powershell
npm run build
npx --no-install pa app push --solution-id <solution-guid>
```

**[Verify in environment]** A push publishes to the active Power Apps
environment/account. Before running it, check the local `power.config.json`,
the active CLI account/environment, intended solution, app sharing, and
release approval. Publishing changes the app in that environment; this
document phase does not run a push. Microsoft documents `pa app push` as the
publish command in its [CLI reference](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli).

## 5. Managed-solution release path

**[Code]** `docs/deployment.md` describes a managed-solution path: publish the
Code App into the solution, export the solution as managed from development,
select the intended target environment, import the solution, then perform
environment-specific configuration and a smoke test. Its sample commands
use `pac solution export`, `pac auth select`, and `pac solution import`.

**[Verify in environment]** Treat that runbook as a starting point, not proof
of the current solution state. It contains a statement that the Code App was
missing from the solution when written. Confirm current solution membership,
version, target environment, connections, table data, role assignments, and
deployment approvals in Power Platform before following it. No environment
identifiers or URLs are reproduced here.

**[Code]** `power.config.json` currently has an `environmentId` binding and an
empty `connectionReferences` object; `appName` and `solutionId` are null in
the inspected file. The environment binding is sensitive operational context.
Read the local file rather than copying an identifier from this guide. No
environment variables are declared in this app’s package scripts
(`power.config.json`, `package.json` › `scripts`).

## 6. Useful commands

| Purpose | Command | Evidence |
| --- | --- | --- |
| Install dependencies | `npm ci` | **[Code]** `package-lock.json` |
| Vite development server | `npm run dev` | **[Code]** `package.json` › `scripts.dev` |
| Power Apps local host | `pa app run` | **[Verify in environment]** Requires working CLI sign-in and target environment; Microsoft Learn CLI reference. |
| TypeScript + production build | `npm run build` | **[Code]** `package.json` › `scripts.build` |
| Lint | `npm run lint` | **[Code]** `package.json` › `scripts.lint` |
| Unit tests | `npm test` | **[Code]** `package.json` › `scripts.test` |
| Preview built files | `npm run preview` | **[Code]** `package.json` › `scripts.preview` |
| Publish Code App | `pa app push` | **[Verify in environment]** Publishes to active Power Apps environment; CLI reference. |

