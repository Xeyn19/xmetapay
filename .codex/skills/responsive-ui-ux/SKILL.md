---
name: responsive-ui-ux
description: Apply XMETA Pay responsive UI and UX standards to Next.js/Tailwind screens. Use when modifying landing, auth, dashboard, portal, form, navigation, card, table, or workflow UI in this project; when the user asks for responsive design, mobile/tablet/desktop polish, best UI/UX practices, accessibility, tap targets, layout cleanup, or visual QA.
---

# Responsive UI/UX

Use this skill to keep XMETA Pay screens polished, usable, and consistent across mobile, tablet, and desktop.

## Workflow

1. Read `AGENTS.md` first. This project uses Next.js 16, so inspect relevant docs in `node_modules/next/dist/docs/` before changing Next APIs, routing, metadata, images, fonts, or CSS conventions.
2. Inspect the target route and shared components before editing. Prefer existing project patterns in `app/_components`, `components/ui`, `app/globals.css`, and current Tailwind utilities.
3. Preserve public interfaces unless the user explicitly asks otherwise: routes, form actions, visible portal choices, core copy, and existing navigation destinations.
4. Make the smallest coherent UI change that solves the responsive/UX problem. Avoid turning operational screens into marketing pages.
5. Verify with lint/build and browser checks at mobile, tablet, and desktop widths whenever the UI is rendered.

## XMETA Pay Design Standards

- Use a calm school-fintech interface: light gray page background, white surfaces, charcoal text, XMETA orange primary actions, subtle blue secondary accents.
- Keep UI practical and task-focused. Avoid decorative blobs, heavy gradients, fake dashboards, stock imagery, dense bento grids, and extra sections unless requested.
- Use cards only for individual content units such as portal choices or auth panels. Do not nest cards inside larger decorative cards.
- Keep radius restrained: prefer `rounded-lg` or `rounded-xl`; avoid oversized pill/card radius unless the existing component already requires it.
- Use semantic text hierarchy: concise page heading, readable supporting copy, clear section titles, and labels that remain legible on small screens.
- Keep body copy line lengths controlled with `max-w-*`, `text-pretty`, or layout constraints where useful.
- Fix mojibake and encoding issues when found in visible UI text.

## Responsive Rules

- Design mobile-first, then enhance for tablet and desktop.
- Check at least `320px`, `375px`, `768px`, and `1440px` widths for important screens when practical.
- Prevent horizontal overflow. Compare `document.documentElement.scrollWidth` with `clientWidth` during browser QA.
- Use `min-h-[calc(100svh-...)]` or flexible spacing instead of brittle `100vh` assumptions for full-screen shells.
- Stack primary actions on narrow mobile. Switch to side-by-side actions only when there is enough width, such as `min-[420px]:flex-row`.
- Keep tappable controls at least about `44px` high. Inputs and submit buttons should generally be `min-h-12`; compact links should still have visible focus and enough click area.
- Let long register forms scroll naturally. Do not force long forms into one viewport.
- For register forms, use one column on mobile and two columns on wider screens when it improves scanning.

## Accessibility And Interaction

- Add visible keyboard focus to links and buttons with `focus:outline-none` plus `focus-visible:ring-*`.
- Keep labels associated with inputs by wrapping controls in `<label>` or using explicit label associations.
- Preserve native controls for forms unless there is a strong reason to replace them.
- Use clear primary/secondary action hierarchy. Primary actions use XMETA orange; secondary actions use outline/white treatment.
- Do not rely on hover-only affordances. Mobile and keyboard states must remain understandable.
- Avoid hidden or inert controls unless the user explicitly requests prototype-only behavior.

## Verification

Run these checks after UI edits:

```powershell
npm run lint
npm run build
```

For rendered QA, start the app with the repo script and inspect the target route in the in-app Browser when available:

- Page identity: correct URL and title.
- Not blank: expected headings, controls, and route-specific content render.
- No framework overlay.
- Console health: no relevant warnings or errors.
- Responsive layout: mobile, tablet, and desktop screenshots or DOM metrics.
- Interaction proof: click or submit one primary visible control when safe.

Report any verification that could not be completed and why.
