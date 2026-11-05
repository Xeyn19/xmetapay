---
name: filter-controls-ux
description: Analyze and improve XMETA Pay filtering, search, sorting, pagination, tabs, and action controls. Use when designing or changing table toolbars, record lists, filter behavior, bulk actions, button hierarchy, empty states, or related operational workflows. Do not use for general responsive styling without a filtering or control-design decision.
---

# Filter and Control UX

Choose the smallest set of controls that helps the user find records and complete the real task without turning an operational screen into an oversized dashboard.

## Analyze Before Editing

1. Read `AGENTS.md`. Before changing Next.js APIs or conventions, read the relevant guide in `node_modules/next/dist/docs/`.
2. Inspect the target data, user role, expected record volume, common decisions, existing control state, and nearby screens. Confirm which fields are actually searchable or filterable before exposing them.
3. Reuse established project patterns where they fit, especially `DashboardTableControls`, `DashboardTablePagination`, `filterByQuery`, `toFilterOptions`, `AdminButton`, `SegmentedTabs`, and theme tokens from `app/globals.css`.
4. Preserve business rules, server actions, routes, export behavior, and data visibility unless the user requests a functional change.

## Choose Appropriate Controls

- Add search only when users know a name, reference, email, identifier, or other meaningful text to look for. Use a placeholder that names the searchable fields.
- Add a filter only when its values create useful, repeatable subsets. Prefer native selects for ordinary categorical filters; use tabs only for a small set of important, mutually exclusive views.
- Add sorting when order affects the task and the current order is insufficient. Keep the default order stable and understandable.
- Paginate lists that can grow. Reset to page 1 whenever search, filtering, sorting, view, or page size changes, and clamp the page after the result set shrinks.
- Use bulk actions only when selecting multiple records produces a legitimate shared operation. Clearly show selection scope and never imply that hidden pages are selected unless they actually are.
- Keep advanced or uncommon filters secondary. Do not add chips, toggles, date ranges, or collapsible panels merely to make the toolbar look feature-rich.

## State and Feedback

- Give every control an accessible name and visible keyboard focus. Do not rely on placeholder text as the only label when the meaning is ambiguous.
- Use meaningful defaults such as the active operational view or `All`, and make reset behavior restore those defaults consistently.
- Show active criteria in exports, summaries, or nearby context when users need to understand the result set. Do not duplicate every selected value as decorative chips.
- Distinguish an empty dataset from a filtered result with no matches. Filtered empty states should explain that no records match and offer a clear reset when useful.
- Keep result counts, pagination ranges, selected counts, and disabled states accurate after every control change.
- Preserve filter state during safe in-page operations when doing so helps the user continue the same task; reset only when the underlying context changes.

## Buttons and Actions

- Maintain one obvious primary action per decision area. Use secondary or outline treatment for supporting actions and restrained ghost or icon buttons for low-emphasis actions.
- Use destructive styling only for destructive operations. Require confirmation when an action is difficult to reverse or affects multiple records.
- Icon-only buttons require an accessible label and a familiar icon; add visible text when the action could be misunderstood.
- Prevent duplicate submissions, show a clear loading state, retain readable disabled styling, and explain unavailable actions when the reason is not obvious.
- Keep related controls together and order them by task flow. On narrow screens, allow wrapping or stacking without separating labels from their controls.
- Avoid duplicate actions, excessive colors, oversized controls, decorative animation, and a separate button for every minor state.

## Verification

Verify the affected workflow, not just the appearance:

- Search matches the documented fields and normalizes input appropriately.
- Each filter, sort, tab, reset, and pagination change produces the correct records and state.
- Empty, loading, disabled, error, selection, and confirmation states remain understandable.
- Keyboard navigation, accessible names, mobile wrapping, and long labels work without horizontal page overflow.
- Existing export and bulk actions operate on the intended filtered or selected records.

Run the relevant unit checks, `npm run lint`, and `npm run build`. Use `$ui-playwright-qa` only when rendered browser or Playwright verification is explicitly requested.
