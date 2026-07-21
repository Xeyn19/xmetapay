# XMETA Pay Feature Architecture Checklist

Use only the sections relevant to the requested feature. Confirm each rule against current source and docs because the project continues to evolve.

## 1. Product And Domain Model

- Identify the user and role: company super admin, school administrator, finance officer, registrar, or parent.
- Identify the authoritative record and whether it is school-wide, school-year-specific, parent-owned, or company-wide.
- Define the lifecycle: create, view, update, archive/restore, close, retry, and historical access.
- Separate operational records from view-organization metadata and from derived display values.
- State which actions are MVP and which remain future.

## 2. Stable XMETA Pay Boundaries

- `students` is the reusable student master; `enrollments` owns school-year placement.
- Admin selected-year context controls historical viewing. The active school year controls normal operational writes unless a dedicated setup workflow explicitly prepares a future year.
- Parent access must resolve through `student_guardians.parent_user_id`; never trust a client-supplied student ID by itself.
- School finance writes require the existing finance permission checks. School setup and lifecycle operations remain school-administrator-owned unless current permissions say otherwise.
- Fee payments, wallet top-ups, and store purchases are separate ledger domains. Do not combine them merely because each contains money.
- Archive features should normally use reversible metadata and preserve balances, allocations, receipts, delivery status, and parent history.

## 3. Server And Data Design

- Centralize reusable reads and business rules in a server-only domain module.
- Keep page files and client components free of SQL.
- Keep Server Actions thin and enforce auth, role, permission, school ownership, and year ownership on the server.
- Parameterize SQL values. Allow dynamic SQL fragments only from closed server-owned choices.
- Use one transaction for related writes; lock rows before balance-sensitive updates.
- Avoid N+1 queries. Bulk-load related rows and use bounded batches, normally with an explicit maximum.
- Make duplicate submissions safe through unique keys, same-state detection, or upsert rules.
- Decide deliberately between atomic and partial-success batches, then return clear affected/duplicate/invalid counts.

## 4. Schema And Migration Decisions

- Prefer existing schema when it already represents the required ownership and lifecycle.
- For new fields, decide nullability and display behavior for legacy rows.
- For new tables, define ownership foreign keys, deletion behavior, uniqueness, and query indexes.
- Keep migrations compatible with the project's XAMPP/MySQL version. Use `information_schema` guards where `ADD ... IF NOT EXISTS` is unsupported.
- Update `database/full-schema-v1.sql` and `database/README.md` whenever a migration changes persistent schema.
- Never include production credentials, seed passwords, or private records in committed migrations or docs.

## 5. UI And Workflow Design

- Use real scoped data when it exists; use `Pending`, zero, or an honest empty state when it does not.
- Keep future actions disabled or clearly labeled instead of simulating success.
- For one-or-many workflows, use explicit unchecked selection, selected counts, filtered bulk controls, and per-row overrides.
- Keep search, filters, pagination, and exports consistent. Exports normally include all filtered rows, not only the current page.
- Explain consequences for archive, activation, rollover, payment, and other high-impact actions before submission.
- Preserve the XMETA Pay operational layout, accessible labels/focus states, 44px controls, and contained mobile table scrolling.

## 6. Compatibility And Failure Behavior

- Preserve existing URLs and action contracts unless changing them is part of the requirement.
- Define behavior for missing setup, missing active year, stale IDs, duplicate rows, invalid ownership, concurrent updates, and unavailable infrastructure.
- Keep safe retries possible and prevent repeated clicks from duplicating writes.
- Do not expose raw database, SMTP, or authorization errors to users; log safe diagnostics server-side and return actionable UI feedback.
- Ensure historical selected-year views do not accidentally become write contexts.

## 7. Verification And Documentation

- Add static/unit tests for auth, permissions, SQL scope, transactions, duplicate handling, and the visible workflow.
- Add browser checks for high-value responsive interactions when authentication and local data are available.
- Run focused tests, then `npm run test:unit`, `npm run lint`, and `npm run build`.
- Run docs target checks when behavior, roles, schema, flowcharts, setup, or implementation status changes.
- Run migration/schema checks and a secret scan for schema or infrastructure work.
- Report pre-existing unrelated failures separately; do not hide or silently rewrite them.

## 8. Final Design Questions

Before approving a plan or implementation, answer:

1. What is the single source of truth?
2. Who may read and write it?
3. Which school and school year own it?
4. What happens on duplicate, retry, partial failure, and concurrent use?
5. What remains visible historically?
6. Which rules belong in a shared server module rather than UI or page code?
7. Can the MVP be simpler without blocking the next realistic extension?
8. Do tests and docs describe the same behavior as the code?
