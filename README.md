# AFS AI Process Workbench Demo

An interactive, frontend-only demo for the **Customer Complaints & Quality Handling** process. The product reproduces the approved storyboard as a local web application and uses no external APIs.

## Run locally

Prerequisite: Node.js 20.9 or newer. The same commands work in Windows
PowerShell, Windows Command Prompt, macOS and Linux.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production build and local production server:

```bash
npm run build
npm run start
```

## Demo click path

1. Open case `CC-2026-0088` from **My Workbench**.
2. Review the original call recording or scanned complaint.
3. Click **Start Review**.
4. Click **Request Case Access**, then **Allow Case Access**.
5. Wait for the Agent review to complete.
6. Open **View Records** and **View Previous Cases** to inspect original evidence.
7. Click **Prepare Recommendation** and continue to confirmation.
8. Select **I have reviewed the supporting records**.
9. Click **Confirm & Complete Case**.
10. Return to the workbench and see the case as completed.

## Edit or add mock data

All business content is stored separately from the UI:

- `data/workbench.json` — workbench metrics, process list and pending cases.
- `data/demo-case.json` — complaint, Agent roles, access scope, records, previous cases, recommendation and completion actions.

The JSON files can be edited in any text editor. Keep the existing property names and valid JSON syntax. New table rows can be added by copying an existing object inside the relevant array.

## Project structure

- `app/ProcessApp.tsx` — interactive state and product screens.
- `app/globals.css` — prototype-matched visual system and responsive layout.
- `data/` — editable mock business data.
- `design-system/afs-ai-process-workbench/MASTER.md` — saved UI/UX design decisions.

## Technology choice

- React 19 + TypeScript for typed, reusable interactive components.
- Next.js 16 for cross-platform local startup and production builds.
- Phosphor Icons for a consistent, accessible outline icon system.
- Plain CSS design tokens for easy visual adjustment without a UI framework.
- Static JSON imports for transparent, version-controlled mock data.

No backend, database, authentication or API connection is required.
