# XMETA Pay Project Flowcharts

This document explains the whole XMETA Pay project flow from the user side and the database side. It focuses on how the admin/school portal and parent portal interact, starting from registration and continuing through student enrollment, guardian linking, fees, payments, receipts, wallet top-ups, store/canteen purchase recording, and future report phases.

Related documents:

- `DATABASE_SCHEMA_PLAN.md` - full database schema plan and ERD.
- `DATABASE_SCHEMA_EXPLANATION.md` - plain-language schema explanation.
- `DATABASE_SCHEMA_VISUAL_PLAN.html` - browser visual for the database schema.
- `CHECKLIST.md` - backend implementation tracker.
- `ADMIN_ROLES.md` - admin/school staff roles and dashboard permissions.
- `PROJECT_FLOWCHARTS_VISUAL.html` - browser visual for this project flow document.

## Status Legend

| Label | Meaning |
| --- | --- |
| Implemented | Already built in the current project flow. |
| Next | Best near-term backend work after the current phase. |
| Future | Planned later after the current backend foundation is stable. |

## Current Working Flow

Implemented:

- Admin/school registration and login.
- Parent registration and login.
- Logout and protected dashboard redirects.
- Local MySQL/XAMPP database connection through environment variables.
- Full schema import through `database/full-schema-v1.sql`.
- Manual school setup by `school_administrator`.
- Admin/school staff role permissions for `school_administrator`, `registrar`, and `finance_officer`.
- Admin student creation and enrollment.
- Admin student profile selector and exact profile route `/admin/students/[studentId]`.
- Parent-to-student linking through `student_reference`.
- Parent dashboard reads linked students through `student_guardians`.
- Parent-side mock enrollment wizard has been removed; the parent portal links existing school-created students only.
- Fees and tuition backend.
- Parent fee summary from MySQL.
- Admin tuition report from MySQL.
- Parent local test payment flow.
- Payment allocation to fee balances.
- Parent receipt and payment history from MySQL.
- Admin collections reads parent-created payment records.
- Parent local wallet top-up flow.
- Wallet balances and wallet transaction history from MySQL.
- Parent dashboard recent wallet/store activity snapshot from MySQL.
- Parent selected student profile recent wallet/store activity from MySQL.
- Admin allowance total balance is calculated from the current `wallets.balance` values, counting each wallet once.
- Store/canteen purchase recording through student wallets.

Next:

- Report query polish for tuition, collections, wallet, and store summaries.

Future:

- Cashier/POS portal, item catalog, real payment gateway integration, refunds, admin manual fee payment recording, notifications, and report exports.

## Whole Project Overview

The important idea is simple: the admin/school side creates and manages the official school records, while the parent side can only see students linked to that parent account.

For the current backend phase, parents do not directly enroll new students from the parent portal. They link to students that the school/admin side already created and enrolled.

```mermaid
flowchart TD
  A["School administrator registers or logs in"] --> B["Admin sets up school records"]
  B --> C["School, school year, grade levels, and sections exist"]
  C --> D["School administrator or registrar creates student"]
  D --> E["Admin creates enrollment"]
  E --> F["Student gets official student_reference"]

  G["Parent registers or logs in"] --> H["Parent submits student_reference"]
  H --> I{"Matching student found?"}
  I -->|Yes| J["Create student_guardians link"]
  I -->|No| K["Parent stays active but has no linked student yet"]
  J --> L["Parent dashboard shows linked student"]
  K --> M["Parent can try link-by-reference later"]

  L --> N["Parent views assigned fees"]
  N --> O["Parent records local test payment"]
  O --> P["Receipt and payment history are created"]
  L --> Q["Parent tops up allowance wallet"]
  Q --> R["Admin or finance records store purchase"]

  P --> S["Admin sees collections and reports"]
  R --> T["Admin sees wallet and store reports"]
```

## Admin Portal Flow

### 0. Admin Staff Role Access

Implemented.

All school staff accounts use `users.role = admin`, but `admin_profiles.staff_role` controls dashboard permissions.

```mermaid
flowchart TD
  A["Admin user signs in"] --> B{"staff_role?"}
  B -->|school_administrator| C["Can access all admin pages and set up school records"]
  B -->|registrar| D["Can access dashboard, students, student profile, and parent contacts"]
  B -->|finance_officer| E["Can access dashboard, tuition, collections, fees, allowance, store, and reports"]
  D --> F["Cannot use school setup or finance pages"]
  E --> G["Cannot set up school records or add/enroll students"]
```

Permission source:

- `admin_profiles.staff_role`
- `ADMIN_ROLES.md`

### 1. Admin Registration And Login

Implemented.

The admin account starts in the shared `users` table with `role = admin`. Admin-specific school information is stored in `admin_profiles`.

```mermaid
flowchart TD
  A["Admin opens /admin/register"] --> B["Submit name, school name, email or phone, staff role, password"]
  B --> C["Validate required fields"]
  C --> D{"Email or phone already used for admin role?"}
  D -->|Yes| E["Show duplicate account error"]
  D -->|No| F["Hash password"]
  F --> G["Insert users row with role admin"]
  G --> H["Insert admin_profiles row"]
  H --> I["Create DB-backed session and HttpOnly cookie"]
  I --> J["Redirect to /admin/dashboard"]

  K["Admin opens /admin/login"] --> L["Find active admin user by email or phone"]
  L --> M{"Password valid?"}
  M -->|No| N["Show invalid login error"]
  M -->|Yes| O["Create DB-backed session and HttpOnly cookie"]
  O --> J
```

Database touchpoints:

- `users`
- `admin_profiles`

### 2. Manual School Setup

Implemented.

After the admin logs in, the staff profile should be linked to a real school record. A school administrator manually confirms the school, active school year, grade levels, and sections. Registrar and finance officer accounts then share that same school context through `admin_profiles.school_id`; if their `school_id` is still empty, the backend falls back to an exact `school_name` match and saves the matched `school_id`.

```mermaid
flowchart TD
  A["Admin dashboard loads"] --> B{"admin_profiles.school_id exists?"}
  B -->|Yes| C["Use linked school context"]
  B -->|No| D{"Exact schools.name matches school_name?"}
  D -->|Yes| E["Save matched school_id to admin_profiles"]
  E --> C
  D -->|No| F{"staff_role is school_administrator?"}
  F -->|No| G["Show ask school administrator message"]
  F -->|Yes| H["Show Set up school records panel"]
  H --> I["Admin opens manual setup screen"]
  I --> J["Require admin session and school_administrator role"]
  J --> K["Admin confirms school name and code"]
  K --> L["Admin enters active school year and dates"]
  L --> M["Admin adds grade levels"]
  M --> N["Admin adds sections per grade"]
  N --> O["Save schools, school_years, grade_levels, sections"]
  O --> P["Update same-school admin_profiles.school_id"]
  P --> Q["Redirect back to dashboard"]
  Q --> C
```

Database touchpoints:

- `admin_profiles`
- `schools`
- `school_years`
- `grade_levels`
- `sections`

### 3. Admin Student Creation And Enrollment

Implemented.

The school/admin side creates the official student record first. That student receives the `student_reference` that parents use for linking.

```mermaid
flowchart TD
  A["Admin opens /admin/students"] --> B{"School setup complete?"}
  B -->|No| C["Show setup required message"]
  B -->|Yes| D["Load active school year, grade levels, and sections"]
  D --> E["Admin submits student form"]
  E --> F["Validate student_reference, first name, last name, grade, and section"]
  F --> G{"student_reference already exists in this school?"}
  G -->|Yes| H["Show duplicate reference error"]
  G -->|No| I["Insert students row"]
  I --> J["Insert enrollments row for active school year"]
  J --> K["Student appears in enrolled students table"]
  K --> L["Admin can open exact profile at /admin/students/studentId"]
  K --> M["Parent can now link using student_reference"]
```

Database touchpoints:

- `students`
- `enrollments`
- `school_years`
- `grade_levels`
- `sections`

### 4. Admin Parent Directory

Implemented foundation.

The admin can see parent accounts that have linked students and parent accounts that are still pending because their student reference has not matched an official student yet.

```mermaid
flowchart TD
  A["Admin opens /admin/parents"] --> B["Load admin school_id"]
  B --> C["Load linked guardians through student_guardians"]
  B --> D["Load parent_profiles with no matching student_guardians link"]
  C --> E["Show linked parent, student, and relationship"]
  D --> F["Show pending parent profile"]
  E --> G["Admin understands who can access student records"]
  F --> H["Admin can create matching student or ask parent to retry reference"]
```

Database touchpoints:

- `users`
- `parent_profiles`
- `student_guardians`
- `students`
- `enrollments`

## Parent Portal Flow

### 1. Parent Registration And Automatic Student Linking

Implemented.

During registration, the parent submits a `student_reference`. If exactly one matching student exists, the system creates a `student_guardians` link immediately.

```mermaid
flowchart TD
  A["Parent opens /parent/register"] --> B["Submit guardian details, relationship, student first/middle/last name, student_reference, password"]
  B --> C["Validate required fields"]
  C --> D{"Email or phone already used for parent role?"}
  D -->|Yes| E["Show duplicate account error"]
  D -->|No| F["Hash password"]
  F --> G["Insert users row with role parent"]
  G --> H["Insert parent_profiles row"]
  H --> I["Search students by student_reference"]
  I --> J{"Exactly one matching student?"}
  J -->|Yes| K["Insert student_guardians row"]
  J -->|No| L["Keep parent active with no linked student"]
  K --> M["Create DB-backed session and HttpOnly cookie"]
  L --> M
  M --> N["Redirect to /parent/dashboard"]
```

Database touchpoints:

- `users`
- `parent_profiles`
- `students`
- `student_guardians`

### 2. Parent Login And Dashboard Student Read

Implemented.

The parent dashboard must only show students linked to the signed-in parent through `student_guardians`.

```mermaid
flowchart TD
  A["Parent opens /parent/login"] --> B["Find active parent user by email or phone"]
  B --> C{"Password valid?"}
  C -->|No| D["Show invalid login error"]
  C -->|Yes| E["Create DB-backed session and HttpOnly cookie"]
  E --> F["Redirect to /parent/dashboard"]
  F --> G["Require parent session"]
  G --> H["Read student_guardians by parent_user_id"]
  H --> I{"Linked students found?"}
  I -->|Yes| J["Show linked students and enrollment info"]
  I -->|No| K["Show link-by-reference form"]
```

Database touchpoints:

- `users`
- `student_guardians`
- `students`
- `enrollments`
- `grade_levels`
- `sections`

### 3. Parent Manual Link By Reference

Implemented.

If parent registration did not find a student yet, the parent can retry from the parent dashboard after the school/admin creates the student.

```mermaid
flowchart TD
  A["Parent dashboard shows no linked students"] --> B["Parent enters student_reference"]
  B --> C["Require parent session"]
  C --> D["Search students by student_reference"]
  D --> E{"Exactly one matching student?"}
  E -->|No| F["Show friendly not found or ambiguous message"]
  E -->|Yes| G["Create or reuse student_guardians link"]
  G --> H["Reload parent dashboard"]
  H --> I["Linked student appears"]
```

Database touchpoints:

- `students`
- `student_guardians`
- `parent_profiles`

## Cross-Portal Interaction Rule

Implemented.

The parent does not own a student just because they typed a student reference once. The real access rule is the database link in `student_guardians`.

```mermaid
flowchart TD
  A["Admin creates official student"] --> B["students.student_reference exists"]
  B --> C["Parent submits student_reference"]
  C --> D{"Can the system find exactly one matching student?"}
  D -->|No| E["No access link is created"]
  D -->|Yes| F["Create student_guardians row"]
  F --> G["Parent can read that student"]
  G --> H["Parent dashboard filters by parent_user_id"]
  H --> I["Only linked students are returned"]
  E --> J["Parent can retry after admin fixes or creates student"]
```

Access rule:

```text
Parent can view student data only when:
student_guardians.parent_user_id = signed_in_parent_user_id
and student_guardians.student_id = students.id
```

## Session Guard And Logout Flow

Implemented.

Both portals use the same `xmetapay_session` cookie, but the cookie only stores a random session token. The server stores the hashed token in `auth_sessions`, and role checks decide which dashboard is allowed.

```mermaid
flowchart TD
  A["User visits protected page"] --> B["Read xmetapay_session cookie token"]
  B --> C["Hash token and look up auth_sessions"]
  C --> D{"Session exists, active, and not expired?"}
  D -->|No| E["Redirect to matching login page"]
  D -->|Yes| F["Load active user and session role"]
  F --> G{"Required role matches session role?"}
  G -->|No| E
  G -->|Yes| H["Render protected dashboard page"]

  I["User clicks Log out"] --> J["Server action sets auth_sessions.revoked_at"]
  J --> K["Delete xmetapay_session cookie"]
  K --> L{"Portal role?"}
  L -->|Admin| M["Redirect to /admin/login"]
  L -->|Parent| N["Redirect to /parent/login"]
```

Database touchpoints:

- `users`
- `auth_sessions`
- `xmetapay_session` HttpOnly cookie containing only the raw random token

## Fees And Tuition Flow

Implemented.

```mermaid
flowchart TD
  A["Admin opens fees or tuition setup"] --> B["Create fee_types for active school year"]
  B --> C["Select students or grade level"]
  C --> D["Create student_fee_assignments"]
  D --> E["Parent dashboard loads linked students"]
  E --> F["Parent opens fee summary"]
  F --> G["Read open, partial, and paid fee assignments"]
  G --> H["Show balances by student"]
  H --> I["Admin tuition report reads the same balances"]
```

Database touchpoints:

- `fee_types`
- `student_fee_assignments`
- `students`
- `student_guardians`
- `school_years`

## Payment And Receipt Flow

Implemented for local MVP testing. Payments are recorded as paid immediately without a real payment gateway. Real gateway integration, refunds, and admin manual payment recording can come later.

```mermaid
flowchart TD
  A["Parent opens /parent/pay-tuition"] --> B["Read payable fee assignments through student_guardians"]
  B --> C["Parent selects one student's payable fee items"]
  C --> D["Parent chooses local test payment method"]
  D --> E["Server action requires parent session"]
  E --> F["Lock selected student_fee_assignments"]
  F --> G["Create payments row with paid status"]
  G --> H["Create payment_allocations rows"]
  H --> I["Update student_fee_assignments amount_paid"]
  I --> J{"Balance fully paid?"}
  J -->|Yes| K["Mark fee assignment paid"]
  J -->|No| L["Mark fee assignment partial"]
  K --> M["Create receipts row"]
  L --> M
  M --> N["Parent sees real receipt and payment history"]
  N --> O["Admin dashboard and collections read the same payment records"]
```

Database touchpoints:

- `payments`
- `payment_allocations`
- `receipts`
- `student_fee_assignments`
- `student_guardians`

## Wallet, Allowance, And Store Flow

Wallet top-up is implemented for local MVP testing. Store/canteen purchase recording is implemented for local MVP testing.

Wallets should be separate from tuition payments so allowance and store/canteen spending can be tracked clearly.

```mermaid
flowchart TD
  A["Parent opens wallet page"] --> B["Read linked students through student_guardians"]
  B --> C["Create or reuse wallet for selected student"]
  C --> D["Parent chooses local test channel and top-up amount"]
  D --> E["Create paid payment row"]
  E --> F["Increase wallet balance"]
  F --> G["Create wallet_transactions row with type top_up"]
  G --> H["Create receipt row"]
  H --> I["Parent sees receipt and wallet history"]
  H --> I2["Parent dashboard shows recent wallet activity"]
  H --> I3["Selected student profile shows that student's wallet activity"]
  I --> J["Admin sees allowance ledger update"]
  J --> K["Admin or finance creates store merchant"]
  K --> L["Admin or finance records local test purchase"]
  L --> M{"Wallet has enough balance?"}
  M -->|No| N["Reject purchase with friendly error"]
  M -->|Yes| O["Decrease wallet balance"]
  O --> P["Create wallet_transactions row with type purchase"]
  P --> Q["Create store_transactions row"]
  Q --> R["Parent sees spending in wallet history"]
  Q --> R2["Parent dashboard shows recent store spending"]
  Q --> R3["Selected student profile shows that student's store spending"]
  Q --> S["Admin sees store transaction report"]
  S --> T["Admin allowance total sums each wallet balance once"]
```

Database touchpoints:

- `wallets`
- `wallet_transactions`
- `store_merchants`
- `store_transactions`
- `payments`

Data accuracy rule:

- Admin allowance `Total balance` should sum the current `wallets.balance` once per wallet.
- Wallet transaction rows are used for top-up history, store purchase history, monthly spend, parent dashboard wallet activity, selected student profile wallet activity, and store reports.
- Parent payment history stays payment-only; store purchases appear in wallet history, the dashboard wallet activity snapshot, and the selected student profile wallet activity snapshot.
- Do not calculate total wallet balance by summing joined wallet/transaction rows, because a wallet with multiple transactions would be counted more than once.

Role rule:

- `school_administrator` and `finance_officer` can record store purchases.
- `registrar` cannot record store purchases because store spending is a finance operation.

## Practical Testing Flow

Use this testing order when checking the project manually in XAMPP:

1. Register an admin account.
2. Log in as admin.
3. Set up school records with the real school year, grade levels, and sections.
4. Create a student with a clear `student_reference`.
5. Confirm the student appears in the admin student table.
6. Register a parent account using the same `student_reference`.
7. Confirm the parent dashboard shows the linked student.
8. Log out as parent.
9. Log back in as parent and confirm the linked student is still there.
10. Log out as admin.
11. Log back in as admin and confirm the student and parent link are still visible.

## Safe Data Notes

- Do not commit `.env`.
- Do not commit real database exports.
- Do not commit real parent, student, school, payment, or credential data.
- Keep passwords stored only as `password_hash` in the database.
- Keep this document as a planning and explanation guide, not a seed-data file.
