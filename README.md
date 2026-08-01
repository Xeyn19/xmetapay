# XMETA Pay

XMETA Pay is a Next.js school-fintech application for parent payments, student administration, and company-level school account oversight. It provides role-protected Parent, School Admin, and Super Admin portals backed by shared responsive UI and automated tests.

## Features

- Parent flows for account access, linked students, fee and payment history, tuition payments, receipts, allowance wallets, and student profiles.
- School Admin workflows for school setup, enrollment, student and parent records, tuition, collections, other fees, reminders, allowance, store transactions, and financial reports.
- Company Super Admin workflows for registration review, school-admin account management, school population summaries, and branded account exports.
- Role-aware email OTP password recovery using the configured SMTP service.
- Browser-remembered Light and Dark themes across public pages and dashboards, with Dark as the first-visit default and contrast-safe controls in both modes.
- Branded XMETA Pay Excel and PDF exports from authorized filtered data.
- Shared UI components built with React, Tailwind CSS, Base UI, Recharts, and lucide-react icons.
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
- Authentication, permissions, and data access remain role- and school-scoped.
- End-to-end tests live in `e2e/`.
- Codex project skills live in `.codex/skills/`.
- Sensitive values such as environment variables, tokens, credentials, customer data, and private operational details should not be documented in this README.

Last updated: 2026-08-01
