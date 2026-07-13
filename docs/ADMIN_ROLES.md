# XMETA Pay Admin Roles

This guide explains the company super admin role and the three school/admin staff roles used by XMETA Pay.

## Company Role

| Auth role | Main purpose | Can do | Cannot do |
| --- | --- | --- | --- |
| `super_admin` | XMETA Pay company monitoring | Sign in at `/login`, review pending school admin registrations, approve or reject admin access, view schools and school admin accounts, enable or disable school admin access | Manage school records, enroll students, record payments, impersonate schools, or edit operational school data in MVP |

The first company account is seeded through a local-only SQL file after importing the `super_admin` role migration. That seed file lives under `database/local/`, is ignored by Git, and should be deleted after phpMyAdmin import.

The company super admin area uses a sidebar-based XMETA Pay workspace. `/super-admin/dashboard` is for company monitoring, `/super-admin/admin-accounts` is for school admin enable/disable management, and `/super-admin/registrations` is for pending school admin approval.

New school/admin registrations start as `pending`. They cannot sign in or start school setup until a company super admin approves them from `/super-admin/registrations`. Rejecting a registration keeps the account record but changes `users.status` to `disabled`.

## School Staff Role Summary

All school staff accounts sign in through the admin/school portal, but their dashboard access is different.

| Staff role | Main purpose | Can do | Cannot do |
| --- | --- | --- | --- |
| `school_administrator` | School owner and setup manager | Set up school records, manage school years/sections, prepare manual rollover enrollments, activate the next school year, manage students, view finance pages, view reports | No current admin dashboard restrictions |
| `registrar` | Student and guardian records | View dashboard, add/enroll students individually or in a validated multi-student batch, view student profiles, view parent contacts | Set up school records, use finance pages, view reports |
| `finance_officer` | Fees, payments, allowance, reminders, and reports | View dashboard, tuition, collections, other fees, allowance, store transactions, reports, log queued payment reminders, create store merchants, record wallet purchases | Set up school records, add/enroll students, manage parent contacts |

## Dashboard Access

| Dashboard area | School administrator | Registrar | Finance officer |
| --- | --- | --- | --- |
| Dashboard | Yes | Yes | Yes |
| Set up school records | Yes | No | No |
| Enrolled students | Yes | Yes | No |
| Student profile | Yes | Yes | No |
| Parent contacts | Yes | Yes | No |
| Tuition report | Yes | No | Yes |
| Collections log | Yes | No | Yes |
| Other fees | Yes | No | Yes |
| Allowance ledger | Yes | No | Yes |
| Store transactions | Yes | No | Yes |
| Financial reports | Yes | No | Yes |
| Payment reminder history | Yes | No | Yes |

## Setup Rule

The first real school account should be a `school_administrator`, but it still requires company super admin approval before it can sign in.

Only a school administrator can complete `Set up school records`. After the pending account is approved, the new school administrator signs in and is sent to a setup-only onboarding screen before the real dashboard is shown. The ongoing `School setup` dashboard page shows school details, all school years, the active year, selected-year grade/section editing, manual rollover preparation, and activation for upcoming years that are ready. If a registrar or finance officer signs in before setup is complete, they should see:

```text
Ask a school administrator to complete school setup first.
```

School setup is school-wide, not per staff account. After the school administrator saves setup, XMETA Pay links other unlinked `admin_profiles` with the same exact `school_name` to the same `schools.id`. New registrar and finance accounts also try to join the existing school context during registration. That means a registrar should not need to repeat setup when the school administrator already completed it for the same school name.

For the MVP, this matching uses the exact school name from admin registration. A future production improvement should use a school invite code or required school code during staff registration so staff can join the correct school even when two schools have similar names.

## School-Year Viewing Rule

The admin shell has a school-year selector for viewing data from any configured year. The selected year changes admin dashboard labels, student lists, fee/collection views, wallet/store pages, reports, and exports.

Only one school year is still the active/current year. For MVP safety, operational writes such as new enrollments, fee assignments, reminders, tuition terms, wallet/store purchase recording, parent payments, and parent wallet top-ups continue to use the active year only. Upcoming or closed years are view/report contexts, except the School setup page where a school administrator can edit that year's sections, prepare rollover enrollments, and activate an upcoming year. Activating an upcoming year automatically closes the previous active year.

## Practical Workflow

1. A school administrator registers first.
2. The account stays pending until the company super admin approves it.
3. The approved school administrator signs in and completes setup-only onboarding.
4. The school administrator reviews and edits all school years from `School setup`.
5. The school administrator can prepare a manual rollover by selecting source-year students and a target-year section.
6. When the next year is ready, the school administrator activates it; XMETA Pay closes the previous active year.
7. Admin staff use the school-year selector to view the active, upcoming, or closed year data.
8. New operational history rows are stamped with the active school year where supported.
9. Registrar and finance officer accounts with the same school name are linked to the existing school context.
10. A registrar can add and enroll students in the active year.
11. Parents link to those students by `student_reference`.
12. A finance officer works on active-year tuition, collections, allowance, store transactions, queued in-app reminder history, and reports after fee/payment backend phases are implemented.

Payment reminder history is a finance action. School administrators and finance officers can create queued `in_app` reminder log rows for linked parents with open or partial balances. The reminder action is idempotent for the same school, linked parent, and student on the same calendar day, so repeated clicks do not create duplicate same-day reminder rows. Registrars cannot log reminders because they do not have access to finance pages. Real email and SMS notification delivery is still future work.

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
