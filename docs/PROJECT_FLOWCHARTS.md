# XMETA Pay Project Flowcharts

This document explains the whole XMETA Pay project flow from the user side and the database side. It focuses on how the admin/school portal and parent portal interact, starting from registration and continuing through student enrollment, guardian linking, and future payment, wallet, store, and report phases.

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

Next:

- Fees and tuition backend.
- Parent fee summary from MySQL.
- Admin tuition report from MySQL.

Future:

- Payments, allocations, and receipts.
- Wallet, allowance, and store/canteen transactions.
- Notifications and report exports.

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

  L --> N["Future: parent views fees"]
  N --> O["Future: parent pays fees"]
  O --> P["Future: receipt and payment history"]
  L --> Q["Future: wallet top-up and allowance"]
  Q --> R["Future: store/canteen spending"]

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
  A["Parent opens /parent/register"] --> B["Submit guardian details, relationship, student name, student_reference, password"]
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

## Future Fees And Tuition Flow

Future.

This is the next major backend phase after the current student/guardian foundation.

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

## Future Payment And Receipt Flow

Future.

For local MVP testing, payments can be recorded without a real payment gateway first. Real gateway integration can come later.

```mermaid
flowchart TD
  A["Parent selects fee items"] --> B["Create payments row with pending status"]
  B --> C["Local test payment is confirmed"]
  C --> D["Update payment status to paid"]
  D --> E["Create payment_allocations rows"]
  E --> F["Update student_fee_assignments amount_paid"]
  F --> G{"Balance fully paid?"}
  G -->|Yes| H["Mark fee assignment paid"]
  G -->|No| I["Mark fee assignment partial"]
  H --> J["Create receipt"]
  I --> J
  J --> K["Parent sees payment history and receipt"]
  K --> L["Admin sees collections report"]
```

Database touchpoints:

- `payments`
- `payment_allocations`
- `receipts`
- `student_fee_assignments`
- `student_guardians`

## Future Wallet, Allowance, And Store Flow

Future.

Wallets should be separate from tuition payments so allowance and store/canteen spending can be tracked clearly.

```mermaid
flowchart TD
  A["Wallet exists for student"] --> B["Parent chooses top-up amount"]
  B --> C["Create payment for wallet top-up"]
  C --> D["Payment succeeds"]
  D --> E["Increase wallet balance"]
  E --> F["Create wallet_transactions row with type top_up"]
  F --> G["Student spends at canteen or school store"]
  G --> H["Create wallet_transactions row with type purchase"]
  H --> I["Create store_transactions row"]
  I --> J["Parent sees wallet history"]
  I --> K["Admin sees store and allowance reports"]
```

Database touchpoints:

- `wallets`
- `wallet_transactions`
- `store_merchants`
- `store_transactions`
- `payments`

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
