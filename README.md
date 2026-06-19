# XMETA Pay

XMETA Pay is a Next.js school-fintech app for parent payments and school administration workflows. It includes parent portal screens, admin dashboard screens, shared UI components, and automated tests.

## Features

- Parent portal flows for login, registration, dashboard, enrollment, fees, tuition payment, receipts, transaction history, wallet, and student profile views.
- Admin flows for login, registration, dashboard, student and parent management, tuition, other fees, collections, reports, allowance, and store transactions.
- Shared UI components built with React, Tailwind CSS, Base UI, and lucide-react icons.
- Playwright end-to-end coverage and Node test scripts.
- Project-local Codex skills for workflow automation, including `$update-readme-date` to refresh this README from safe public project changes and update the footer date.

## Getting Started

Install dependencies, then run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

```bash
npm run dev          # Start the development server
npm run build        # Build the app
npm run start        # Start the production server
npm run lint         # Run ESLint
npm run test         # Run unit and end-to-end tests
npm run test:unit    # Run Node unit tests
npm run test:e2e     # Run Playwright tests
```

## Project Notes

- The app uses Next.js 16, React 19, TypeScript, and Tailwind CSS.
- End-to-end tests live in `e2e/`.
- Codex project skills live in `.codex/skills/`.
- Sensitive values such as environment variables, tokens, credentials, customer data, and private operational details should not be documented in this README.

Last updated: 2026-06-19
