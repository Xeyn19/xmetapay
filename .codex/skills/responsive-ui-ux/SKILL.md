---
name: responsive-ui-ux
description: Design, implement, or review responsive XMETA Pay interfaces while preserving the project's established theme. Use for mobile, tablet, or desktop layout work; accessibility and interaction polish; or theme-consistent landing, auth, dashboard, portal, form, navigation, table, dialog, and workflow UI. Use filter-controls-ux instead when the main task is choosing filters, search controls, or button behavior.
---

# Responsive UI/UX

Keep XMETA Pay screens practical, accessible, and visually consistent across mobile, tablet, desktop, light mode, and dark mode.

## Workflow

1. Read `AGENTS.md` first. This project uses Next.js 16, so inspect relevant docs in `node_modules/next/dist/docs/` before changing Next APIs, routing, metadata, images, fonts, or CSS conventions.
2. Inspect the target route, its surrounding layout, and relevant shared components before editing. Treat `app/globals.css` as the source of truth for theme tokens and prefer existing patterns in `app/_components`, `app/admin/_components`, `components/ui`, and current Tailwind utilities.
3. Preserve public interfaces unless the user explicitly asks otherwise: routes, form actions, visible portal choices, core copy, and existing navigation destinations.
4. Make the smallest coherent change that solves the responsive or theme problem. Avoid broad visual rewrites when the existing screen only needs targeted layout or interaction fixes.
5. Inspect the complete state set affected by the change: default, hover, focus, active, disabled, loading, empty, error, and dark mode where applicable.

## XMETA Pay Design Standards

- Use the existing semantic tokens for background, foreground, card, primary orange, secondary blue, muted, border, controls, status colors, and focus rings. Do not introduce a parallel palette when a suitable token already exists.
- Preserve the calm school-fintech character: neutral page backgrounds, clear surfaces, charcoal text, XMETA orange primary actions, and restrained blue accents. Ensure the same hierarchy remains legible in dark mode.
- Prefer shared buttons, controls, cards, table shells, and utility classes over one-off copies. Do not perform an unrelated component-system migration while fixing a screen.
- Keep UI practical and task-focused. Avoid decorative blobs, heavy gradients, fake dashboards, stock imagery, dense bento grids, excessive shadows, attention-seeking animation, and extra sections unless requested.
- Use cards only for individual content units such as portal choices or auth panels. Do not nest cards inside larger decorative cards.
- Keep radius restrained: prefer `rounded-lg` or `rounded-xl`; avoid oversized pill/card radius unless the existing component already requires it.
- Use semantic text hierarchy: concise page heading, readable supporting copy, clear section titles, and labels that remain legible on small screens.
- Keep body copy line lengths controlled with `max-w-*`, `text-pretty`, or layout constraints where useful.
- Use motion only when it communicates a state change, and respect reduced-motion preferences.
- Fix mojibake and encoding issues when found in visible UI text.

## Responsive Rules

- Design mobile-first, then enhance for tablet and desktop.
- Check at least `320px`, `375px`, `768px`, and `1440px` widths for important screens when practical.
- Prevent horizontal overflow. Compare `document.documentElement.scrollWidth` with `clientWidth` during browser QA.
- Use `min-h-[calc(100svh-...)]` or flexible spacing instead of brittle `100vh` assumptions for full-screen shells.
- Stack primary actions on narrow mobile. Switch to side-by-side actions only when there is enough width, such as `min-[420px]:flex-row`.
- Keep tappable controls at least about `44px` high. Inputs and primary buttons should generally be `min-h-11` or larger; compact links still need visible focus and a usable hit area.
- Let long forms scroll naturally. Use one column on mobile and add columns only when grouping and reading order remain clear.
- Keep dialog content inside the viewport, with scrollable bodies and reachable actions. Stack dialog actions on narrow screens when side-by-side controls would become cramped.
- Treat wide tables deliberately: preserve important columns, use the existing horizontal table shell when appropriate, and consider a compact mobile presentation only when it improves comprehension without hiding required data.
- Keep action placement predictable: primary completion actions last or right-aligned on wider screens, and full-width or clearly ordered on narrow screens.

## Accessibility And Interaction

- Add visible keyboard focus to links and buttons with `focus:outline-none` plus `focus-visible:ring-*`.
- Keep labels associated with inputs by wrapping controls in `<label>` or using explicit label associations.
- Preserve native controls for forms unless there is a strong reason to replace them.
- Use clear primary/secondary action hierarchy. Primary actions use XMETA orange; secondary actions use outline/white treatment.
- Do not rely on hover-only affordances. Mobile and keyboard states must remain understandable.
- Avoid hidden or inert controls unless the user explicitly requests prototype-only behavior.

## Verification

Run the checks relevant to the edited code, normally:

```powershell
npm run lint
npm run build
```

When the user explicitly requests rendered browser verification, use `$ui-playwright-qa`. Otherwise report the static checks performed and any browser verification that remains outstanding.
