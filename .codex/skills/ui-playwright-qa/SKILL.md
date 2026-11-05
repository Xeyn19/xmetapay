---
name: ui-playwright-qa
description: Run browser-based responsive, interaction, and Playwright verification for XMETA Pay UI changes. Use only when the user explicitly invokes `$ui-playwright-qa` or explicitly requests rendered browser or Playwright QA. Do not use for ordinary lint, build, unit testing, or authoring substantial new E2E coverage.
---

# UI Playwright QA

Verify the rendered XMETA Pay experience in the browser. This skill runs in the calling agent's current model; do not spawn or delegate work solely to switch models.

## Scope and Setup

1. Read `AGENTS.md`, inspect the changed UI and existing tests, and identify the smallest route and user journey that prove the requested behavior.
2. Use the in-app Browser for rendered inspection when available. Use the repository's Playwright configuration and scripts for automated browser checks.
3. Do not create or substantially rewrite E2E specifications under this skill. When the user requests new or expanded test coverage, invoke `$auto-e2e-tests` for that work, then return here only for rendered QA if requested.
4. Do not change application behavior merely to make a check pass unless the user also asked for the defect to be fixed.

## Responsive and Visual Checks

Check important screens at `320px`, `375px`, `768px`, and `1440px` when the route supports those widths. Reduce the set only when a width is irrelevant or unavailable, and report the omission.

- Confirm the expected URL, heading, controls, and route-specific content render without a framework overlay.
- Check `document.documentElement.scrollWidth` against `clientWidth` for unintended page overflow. Deliberate table-shell scrolling is acceptable when the page itself remains contained.
- Inspect text wrapping, action order, dialogs, forms, tables, navigation, touch targets, focus visibility, and light/dark theme behavior affected by the change.
- Confirm loading, disabled, empty, error, and confirmation states that can be reached safely.
- Capture screenshots or DOM measurements only when they provide useful evidence; do not create brittle screenshot assertions by default.

## Interaction Checks

- Exercise filters, search, sorting, tabs, reset, pagination, and selection when they are part of the changed workflow.
- Use role, label, heading, and visible text locators before CSS selectors.
- Perform at least one safe primary interaction. Do not submit destructive or real external operations without explicit authorization.
- Check keyboard focus and one representative keyboard path when the changed controls are interactive.
- Inspect relevant console errors and warnings. Ignore unrelated development noise only after identifying it as unrelated.

## Playwright Execution

Run the narrowest existing test first:

```powershell
npm run test:e2e -- e2e/<relevant-file>.spec.ts
```

Run `npm run test:e2e` only when the change affects shared flows or the user requests the full suite. The configured Playwright server already starts `npm run dev`, uses `http://localhost:3000`, and runs Chromium with one worker.

Stop retrying after the same failure is reproduced and diagnosed. Report whether the failure belongs to the application, test, environment, authentication/data setup, or an unrelated existing issue.

## Completion

Report the routes, viewports, interactions, and commands checked; the pass or failure result; relevant console or overflow findings; and anything skipped or blocked with the reason.
