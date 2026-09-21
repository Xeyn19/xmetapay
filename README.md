# XMETA EDU

XMETA EDU is a Next.js school-fintech application for parent payments, student administration, and company-level school account oversight. It provides role-protected Parent, School Admin, and Super Admin portals backed by shared responsive UI and automated tests.

## Features

- Parent flows for school-reviewed registration, one-school account access, same-school linked students, fee and payment history, tuition payments, receipts, allowance wallets, and student profiles.
- School Admin workflows for school setup, enrollment, parent registration approval, student and parent records, tuition, collections, school-owned payment-reminder email templates, other fees, allowance, store transactions, and financial reports.
- Company Super Admin workflows for registration review, school-admin account management, school population summaries, and branded account exports.
- Role-aware email OTP password recovery using the configured SMTP service.
- Browser-remembered Light and Dark themes across public pages and dashboards, with Dark as the first-visit default and contrast-safe controls in both modes.
- Branded XMETA EDU Excel and PDF exports from authorized filtered data.
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

## Database Setup

- Local XAMPP/phpMyAdmin setup follows the canonical import order in `database/README.md`.
- Existing databases must import `database/migrations/2026-09-19-parent-registration-approval.sql` before using the new parent registration flow.
- Before using enrollment parent email connections, import `database/migrations/2026-09-21-enrollment-parent-email-links.sql` after the approval migration. Both remain pending in the production migration checklist until actually imported.
- For a new empty GoDaddy Hosted Database, use its **Import SQL** action with `utilities/database/xmetapay-production-schema.sql`; the same bundle can be imported into an explicitly selected empty cPanel database through phpMyAdmin.
- The production bundle contains schema only and does not create or select the database, insert accounts or application records, or upgrade an existing live database.
- Database runtime configuration prefers GoDaddy Hosted Database's injected `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`; local XAMPP development continues to use the corresponding `MYSQL_*` values from an ignored `.env` file.

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
- New Parent accounts choose one active school. Signup shows a field alert and creates no account unless at least one submitted reference or school-recorded guardian email matches a student there. Matching registrations wait for school administrator approval before sign-in. Existing active parent accounts keep their access, and unresolved legacy accounts remain preserved but blocked from portal operations.
- Student enrollment can record a guardian email. Existing active same-school Parent accounts link immediately; otherwise the school reviews the email match when the Parent registers. A reference is optional only when the school has a pending email assignment. Staff can correct or cancel pending assignments from Enrolled students.
- End-to-end tests live in `e2e/`.
- Codex project skills live in `.codex/skills/`.
- Sensitive values such as environment variables, tokens, credentials, customer data, and private operational details should not be documented in this README.

Last updated: 2026-09-21
