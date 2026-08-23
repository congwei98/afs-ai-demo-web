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

1. In the **AFS Process Workbench**, choose **Customer Care** from the left-side process-domain navigation and open AI-created case `CC-2026-0088`.
2. Review the inbound call’s live transcript and AI extraction, then open the Router suggestion.
3. Click **Agree with AI** to hand the case from the Router Agent to the Three Guarantees Vehicle Return Process Agent. You can also type an alternative route to Customer Care, Technical Service or Warranty; the routing action updates directly.
4. Follow the **Route Execution** receipts through Process Agent and Execution Agent until CCO creates the complaint case. Return to the Workbench after the task reaches `WAITING_DEALER_EVIDENCE`.
5. In the Workbench, use **Mock Dealer Submit** to simulate the dealer completing the external CCO task. The case changes to `REVIEW_READY` only after `DealerSubmissionCompleted` is received.
6. Click **Open Review** to re-enter the case and generate the Review Plan.
7. Click **Check Access & Run**, then **Allow & Run** and wait for the Agent review to complete.
8. Open Agent evidence, then click **Create Report**.
9. Review the corrected Three Guarantees reasoning, edit the decision if needed, and select the human-review confirmation.
10. Click **Confirm & Execute** and follow the individual CCO action receipts.
11. Return to the workbench and see the case as completed.

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

No backend, database, authentication or API connection is required. The dealer step is deliberately asynchronous in the UI: after the Execution Agent creates the complaint case, the Route task ends and the case waits in the Workbench. The Process Agent cannot enter Review until the mock external CCO task emits `DealerSubmissionCompleted`. In a real environment, CCO would emit that event after the dealer submits its evidence.
