# XMETA Pay Admin Roles

This guide explains the company super admin role and the three school/admin staff roles used by XMETA Pay.

## Company Role

| Auth role | Main purpose | Can do | Cannot do |
| --- | --- | --- | --- |
| `super_admin` | XMETA Pay company monitoring | Sign in at `/login`, review pending school admin registrations, approve or reject admin access, view schools and school admin accounts, enable or disable school admin access | Manage school records, enroll students, record payments, impersonate schools, or edit operational school data in MVP |

The first company account is seeded through a local-only SQL file after importing the `super_admin` role migration. That seed file lives under `database/local/`, is ignored by Git, and should be deleted after phpMyAdmin import.

The company super admin area uses a sidebar-based XMETA Pay workspace. `/super-admin/dashboard` is for company monitoring and a filterable school-admin registration trend with daily, weekly, monthly, and custom date views, `/super-admin/admin-accounts` is for school admin enable/disable management, and `/super-admin/registrations` is for pending school admin approval.

New school/admin registrations start as `pending`. They cannot sign in or start school setup until a company super admin approves them from `/super-admin/registrations`. Rejecting a registration keeps the account record but changes `users.status` to `disabled`.

## School Staff Role Summary

All school staff accounts sign in through the admin/school portal, but their dashboard access is different.

Finance pages include tuition, collections, other fees, allowance, store transactions, reports. The Collections page is tuition-focused; wallet activity belongs to Allowance ledger and store spending belongs to Store transactions.

| Staff role | Main purpose | Can do | Cannot do |
| --- | --- | --- | --- |
| `school_administrator` | School owner and setup manager | Set up school records, manage school years/sections, review promote/repeat rollover placements, activate the next school year, manage students, view finance pages, view reports | No current admin dashboard restrictions |
| `registrar` | Student and guardian records | View dashboard, use the unified Add students chooser to add new students individually or in a validated batch, or enroll existing pending students, view student profiles, view parent contacts | Set up school records, use finance pages, view reports |
| `finance_officer` | Fees, tuition collections, allowance, reminders, and reports | View dashboard, tuition, collections (tuition-focused), other fees, allowance, store transactions, reports, send payment reminder emails, create store merchants, record wallet purchases | Set up school records, add/enroll students, manage parent contacts |

## Dashboard Access

| Dashboard area | School administrator | Registrar | Finance officer |
| --- | --- | --- | --- |
| Dashboard | Yes | Yes | Yes |
| Set up school records | Yes | No | No |
| Enrolled students | Yes | Yes | No |
| Student profile | Yes | Yes | No |
| Parent contacts | Yes | Yes | No |
| Tuition report | Yes | No | Yes |
| Tuition collections log, archive, and restore | Yes | No | Yes |
| Other fees | Yes | No | Yes |
| Allowance ledger, archive, and restore | Yes | No | Yes |
| Store transactions | Yes | No | Yes |
| Financial reports | Yes | No | Yes |
| View, archive, and restore payment reminder history | Yes | No | Yes |

## Setup Rule

The first real school account should be a `school_administrator`, but it still requires company super admin approval before it can sign in.

Only a school administrator can complete `Set up school records`. After approval, the new school administrator uses a guided, combined setup-only onboarding screen. Ongoing management is split for clarity: `/admin/school-setup` is the overview hub, school details and year metadata use focused modals, `/admin/school-setup/years/[yearId]` manages one year's grade/section structure, and `/admin/school-setup/rollover` handles reviewed student placement. Activation stays on the overview as a separate confirmation. If a registrar or finance officer signs in before setup is complete, they should see:

```text
Ask a school administrator to complete school setup first.
```

School setup is school-wide, not per staff account. After the school administrator saves setup, XMETA Pay links other unlinked `admin_profiles` with the same exact `school_name` to the same `schools.id`. New registrar and finance accounts also try to join the existing school context during registration. That means a registrar should not need to repeat setup when the school administrator already completed it for the same school name.

For the MVP, this matching uses the exact school name from admin registration. A future production improvement should use a school invite code or required school code during staff registration so staff can join the correct school even when two schools have similar names.

## School-Year Viewing Rule

The admin shell has a school-year selector for viewing data from any configured year. The selected year changes admin dashboard labels, student lists, fee/collection views, wallet/store pages, reports, and exports.

Only one school year is still the active/current year. For MVP safety, operational writes such as new enrollments, fee assignments, reminders, tuition terms, wallet/store purchase recording, parent payments, and parent wallet top-ups continue to use the active year only. Upcoming or closed years are view/report contexts, except the dedicated School setup structure and rollover workflows where a school administrator can prepare future records. Activating an upcoming year automatically closes the previous active year.

## Practical Workflow

1. A school administrator registers first.
2. The account stays pending until the company super admin approves it.
3. The approved school administrator signs in and completes setup-only onboarding.
4. The school administrator reviews and edits all school years from `School setup`.
5. The school administrator can prepare a manual rollover by explicitly selecting one or many source-year students, reviewing each target placement, and saving only checked students.
6. When the next year is ready, the school administrator activates it; XMETA Pay closes the previous active year.
7. Admin staff use the school-year selector to view the active, upcoming, or closed year data.
8. New operational history rows are stamped with the active school year where supported.
9. Registrar and finance officer accounts with the same school name are linked to the existing school context.
10. A registrar uses one `Add students` chooser to add one new student, add a batch with shared grade/section/student-type defaults and per-row overrides, or enroll one or many existing pending students. Existing-student enrollment adds only active-year grade, section, and student type; names, birthdates, sex, references, and parent links are preserved. Student age is derived from birthdate and legacy missing values show `Pending`.
11. Parents link to those students by `student_reference`.
12. A finance officer works on active-year tuition, tuition collections, allowance, store transactions, payment reminder email history, and reports. Tuition collections exclude wallet top-ups, which belong to the allowance ledger. School administrators and finance officers can archive or restore one or many tuition collection rows and selected-year Allowance wallet summaries. These archive controls organize admin views only; they never change payment records, wallet status, balances, transactions, reports, or parent history.

Parents can organize their own Fee summary by archiving paid or zero-balance assignments. This visibility is stored per parent account, so it does not hide an outstanding balance, change the school assignment, affect another linked guardian, or alter admin reports and payment history. Restoring returns the settled fee to that parent's Current fees view.

Parents can also organize Payment history through parent-specific Current and Archived views. Paid, failed, voided, and refunded payment rows can be archived or restored; pending payments stay visible until processing finishes. This never changes receipts, allocations, balances, wallet top-ups, admin collections, reports, dashboard totals, or another parent's records.

Payment reminder email delivery is a finance action. School administrators and finance officers can send immediate, itemized email reminders to linked parent addresses for open or partial balances. Each email includes the student reference, matching fee balances, official assignment deadlines, and tuition installment schedules when present; custom text is an introduction and does not replace the statement. New rows use `channel = 'email'`; each delivery is recorded as `queued`, then updated to `sent` with `sent_at` or `failed`. They can archive and restore individual or selected reminder-history rows to organize the table without deleting or changing delivery results. Archived sent rows still block another same-day email for the same school year, school, linked parent, and student, while failed attempts may be retried. Registrars cannot send, archive, or restore reminders. SMS, scheduled delivery, and delivery webhooks remain future work.

## Database Source

The company/school portal role is stored in:

```text
users.role
```

Allowed values:

```text
admin
parent
super_admin
```

School staff permissions are stored in:

```text
admin_profiles.staff_role
```

Allowed values:

```text
school_administrator
registrar
finance_officer
```

No database schema change is needed for role permissions because the role column already exists.
