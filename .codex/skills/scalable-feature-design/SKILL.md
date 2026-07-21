---
name: scalable-feature-design
description: Design or implement scalable, maintainable XMETA Pay features and workflow redesigns. Use when the user invokes `$scalable-feature-design`, asks for a scalable or maintainable solution, or requests a substantial feature involving domain boundaries, MySQL data, roles, school years, bulk operations, server actions, UI, tests, or documentation. Do not invoke for a tiny copy or styling fix unless the user explicitly asks for architecture guidance.
---

# Scalable Feature Design

Design features that fit XMETA Pay's current architecture, remain safe for existing records, and leave clear extension points without overengineering the MVP.

## Start With Project Truth

1. Read `AGENTS.md` and inspect `git status --short --branch`.
2. Read and follow `.codex/skills/feature-branch-context/SKILL.md` before implementation edits.
3. Inspect the relevant routes, components, server actions, helpers, permissions, schema, tests, and docs. Do not design from the request alone.
4. Read the relevant local Next.js guide in `node_modules/next/dist/docs/` before changing App Router APIs or Server/Client Component boundaries.
5. Read [references/xmetapay-feature-checklist.md](references/xmetapay-feature-checklist.md) for the applicable architecture and delivery checks.

## Match The Requested Work Mode

- For planning or architectural questions, produce a decision-complete plan and do not edit code.
- For implementation requests, design from inspected facts, then implement through verification instead of stopping at a proposal.
- For reviews, lead with concrete risks and file references, then recommend the smallest maintainable correction.
- Discover repository facts before asking questions. Ask only for product choices that materially change behavior or scope.

## Design The Feature

### 1. Establish Ownership And Scope

Define the source of truth, actors, ownership boundary, lifecycle, school scope, school-year scope, parent scope, and read/write rules. State which existing records are reused and which new records, if any, are created.

### 2. Choose Clear Boundaries

- Prefer an existing project pattern over a new abstraction.
- Put reusable business rules and SQL in a focused server-only domain helper.
- Keep Server Actions thin: authenticate, authorize, parse, call the domain helper, revalidate, and return safe feedback.
- Keep UI components responsible for rendering, local interaction, form state, and responsive behavior, not ownership or financial rules.
- Return structured objects across module boundaries instead of positional tuples for growing workflows.

### 3. Protect Data Integrity

- Add schema only when existing tables cannot represent the behavior cleanly.
- Preserve legacy records and provide honest fallback labels for nullable migrated data.
- Use transactions for multi-table writes and row locks where concurrent balance or status changes matter.
- Make retries and repeated clicks idempotent. Use existing unique keys or explicit duplicate checks.
- Bound bulk operations, validate every submitted ID against server-owned school/year context, and define whether partial success is allowed.
- Never copy or delete financial, student, guardian, or audit history merely to simplify a workflow.

### 4. Keep The MVP Honest

Separate implemented behavior from future ideas. Do not add tables, portals, status values, background jobs, or abstractions solely for a hypothetical feature. Label future controls clearly and avoid fake-clickable actions or mock totals where real data exists.

### 5. Make Operations Understandable

Follow current XMETA Pay UI patterns. Make selection explicit, show consequences before destructive-looking actions, provide clear empty/error/success states, preserve accessibility, and keep mobile layouts usable. Use `.codex/skills/responsive-ui-ux/SKILL.md` for substantial UI work.

## Deliver The Result

For a plan, include:

- Goal and current behavior
- Data ownership and business rules
- Interfaces, actions, helper boundaries, and migration needs
- Failure, retry, duplicate, permission, and compatibility behavior
- Tests, documentation impact, and explicit future scope

For implementation:

1. Work on the feature branch created through `feature-branch-context`.
2. Keep edits focused and preserve unrelated user changes.
3. Add tests proportional to the affected behavior and shared contracts.
4. Use `.codex/skills/refresh-project-docs/SKILL.md` when implementation status, flows, schema, roles, or setup instructions change.
5. Use `project-risk-scan` or `auto-e2e-tests` only when the feature's risk or user journey warrants them.
6. Run focused checks first, then the repository's required unit, lint, build, docs, migration, and secret checks.
7. Report completed behavior, migration/import steps, verification, and any unrelated blockers accurately.

## Guardrails

- Do not expose credentials, private records, database exports, or real personal data.
- Do not weaken role, school, school-year, or guardian ownership checks for UI convenience.
- Do not make historical records disappear when a reversible status or metadata record is the correct model.
- Do not let pagination reduce exports unless the product explicitly requests current-page export.
- Do not update docs to claim behavior is implemented before code and tests support it.
