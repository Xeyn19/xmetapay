---
name: refresh-project-docs
description: Refresh XMETA Pay project documentation and browser visual plans from the current implementation. Use when the user invokes `$refresh-project-docs`, asks to update all files in `docs/`, asks to refresh `public/PROJECT_FLOWCHARTS_VISUAL.html` or `public/DATABASE_SCHEMA_VISUAL_PLAN.html`, or wants the docs, flowcharts, schema plan, checklist, and visual HTML files synchronized with recent project changes. Always use the `feature-branch-context` workflow before editing.
---

# Refresh Project Docs

Update the XMETA Pay documentation set so it reflects the current project state while keeping public documentation safe and useful.

## Required Targets

Run the target checker before editing:

```powershell
node .codex\skills\refresh-project-docs\scripts\check-doc-targets.mjs
```

The current required targets are:

- `docs/ADMIN_ROLES.md`
- `docs/CHECKLIST.md`
- `docs/DATABASE_SCHEMA_EXPLANATION.md`
- `docs/DATABASE_SCHEMA_PLAN.md`
- `docs/PROJECT_FLOWCHARTS.md`
- `public/PROJECT_FLOWCHARTS_VISUAL.html`
- `public/DATABASE_SCHEMA_VISUAL_PLAN.html`

If the checker reports missing or extra direct Markdown files in `docs/`, stop and update this skill's target list or ask the user before refreshing docs.

## Workflow

1. Read `AGENTS.md`.
2. Read `.codex/skills/feature-branch-context/SKILL.md` and follow that workflow before any documentation edits:
   - Check `git status --short --branch`.
   - Create or switch to an appropriate branch unless the user already handled branching.
   - Preserve user changes; do not stash, reset, discard, or overwrite unrelated work.
3. Run the target checker and confirm the exact documentation set.
4. Gather current project facts before writing:
   - Inspect `git status --short` and relevant diffs.
   - Inspect current routes/pages, admin and parent portal flows, shared helpers, server actions, API handlers, and dashboard data reads when they affect docs.
   - Inspect `database/`, especially schema SQL and database README files, before changing schema docs.
   - Inspect existing docs and visual HTML structure before editing.
   - For Next.js APIs, routing, metadata, images, fonts, config, or conventions, read the relevant guide in `node_modules/next/dist/docs/` first.
5. Update all required Markdown docs and both visual HTML files together so they agree with each other.
6. Preserve the existing writing style, headings, and document purpose unless the current implementation makes a section obsolete.
7. Run validation and review the diff before completion.

## Update Rules

- Keep `docs/CHECKLIST.md` as the implementation tracker. Mark items complete only when the project code actually implements them.
- Keep `docs/PROJECT_FLOWCHARTS.md` and `public/PROJECT_FLOWCHARTS_VISUAL.html` aligned on portal flow, status, and testing order.
- Keep `docs/DATABASE_SCHEMA_PLAN.md`, `docs/DATABASE_SCHEMA_EXPLANATION.md`, and `public/DATABASE_SCHEMA_VISUAL_PLAN.html` aligned on tables, relationships, ERD/flowchart content, import order, and implementation status.
- Keep `docs/ADMIN_ROLES.md` aligned with real admin role permissions and route access behavior.
- Use concrete project paths, route names, table names, and status labels only after verifying them in source files.
- Prefer concise updates over broad rewrites. Remove stale statements when they would mislead future work.
- Do not edit unrelated files unless the user explicitly asks.

## Public Safety

Never add secrets, credentials, tokens, cookies, passwords, `.env` values, private URLs, database exports, seed credentials, real user records, real student records, payment records, or personal data.

Do not expose private operational details, fraud/security controls, internal-only infrastructure notes, or business-sensitive data unless the information is already intentionally documented for this repo. When unsure, summarize generically or omit the detail and mention the omission.

## Suggested Verification

Run the checks that fit the change:

```powershell
node .codex\skills\refresh-project-docs\scripts\check-doc-targets.mjs
git diff -- docs public\PROJECT_FLOWCHARTS_VISUAL.html public\DATABASE_SCHEMA_VISUAL_PLAN.html
```

For visual HTML edits, inspect the HTML enough to confirm the Mermaid blocks, links, and visible status text stayed coherent. If a local app server is already part of the task, browser-check the visual pages.

## Completion

Report the branch used, the docs and visual files updated, the key project facts synchronized, any sensitive information intentionally omitted, and the verification commands run.
