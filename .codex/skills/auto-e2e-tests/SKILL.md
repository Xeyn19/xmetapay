---
name: auto-e2e-tests
description: Generate or update Playwright end-to-end tests for XMETA Pay from new files, new features, or current git changes. Use when the user asks to automatically create test files, add e2e coverage, cover a feature with tests, or inspect git diff/status and write tests under the project `e2e/` folder.
---

# Auto E2E Tests

## Overview

Create focused Playwright coverage for the feature behavior visible in the current workspace changes. Prefer adding or updating `e2e/*.spec.ts` tests, then run the narrowest useful Playwright command to verify the result.

## Workflow

1. Read project instructions first:
   - Open `AGENTS.md`.
   - If editing Next.js application code becomes necessary, read the relevant guide in `node_modules/next/dist/docs/` before writing that app code.

2. Discover what changed:
   - Run `git status --short`.
   - Run `git diff --name-only --cached` and `git diff --name-only`.
   - Inspect changed app, component, lib, route, and existing `e2e` files that are relevant to the requested feature.
   - If there are staged and unstaged changes, consider both unless the user explicitly limits scope.

3. Map changes to browser behavior:
   - Identify the route or page affected by each feature.
   - Identify the user journey, visible copy, form fields, buttons, links, navigation, validation states, and URL changes that prove the feature works.
   - Prefer user-facing assertions with roles, labels, headings, and stable text.

4. Choose where to write tests:
   - Update an existing `e2e/*.spec.ts` when the feature belongs to a current flow.
   - Create a new `e2e/<feature-or-flow>.spec.ts` when the behavior is distinct.
   - Keep tests in the `e2e/` folder because `playwright.config.ts` sets `testDir: "./e2e"`.

5. Write Playwright tests:
   - Import from `@playwright/test`.
   - Use `test.describe` blocks named after the product area or flow.
   - Start from `page.goto("/")` or a specific route path; the configured `baseURL` is `http://localhost:3000`.
   - Use `getByRole`, `getByLabel`, and scoped locators before CSS selectors.
   - Assert important state with `await expect(...)`.
   - Cover the feature's main success path first; add edge cases only when they are clearly part of the changed behavior.
   - Do not add brittle screenshots, arbitrary waits, or assertions on implementation details.

6. Verify:
   - Run the narrow test first, for example `npm run test:e2e -- e2e/<file>.spec.ts`.
   - If the test relies on shared flows, run `npm run test:e2e`.
   - If failures reveal app behavior that contradicts the feature, inspect the app and adjust the test or implementation appropriately.

## XMETA Pay Conventions

- Existing e2e tests use TypeScript files with names like `e2e/xmetapay-flows.spec.ts`.
- Login forms currently submit via query strings and dashboard smoke tests assert `h1` headings.
- Playwright runs one Chromium worker and starts `npm run dev` automatically from `playwright.config.ts`.
- Keep new tests readable and close to real user behavior; avoid helper abstractions until duplication is meaningful.

## Completion

Report:

- The test file added or changed.
- The feature behavior covered.
- The Playwright command run and whether it passed.
- Any remaining gaps if a behavior could not be tested reliably.
