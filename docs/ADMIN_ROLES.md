# XMETA Pay Admin Roles

This guide explains the three school/admin staff roles used by XMETA Pay. All three accounts sign in through the admin/school portal, but their dashboard access is different.

## Role Summary

| Staff role | Main purpose | Can do | Cannot do |
| --- | --- | --- | --- |
| `school_administrator` | School owner and setup manager | Set up school records, manage school years/sections, prepare manual rollover enrollments, manage students, view finance pages, view reports | No current admin dashboard restrictions |
| `registrar` | Student and guardian records | View dashboard, add/enroll students, view student profiles, view parent contacts | Set up school records, use finance pages, view reports |
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

The first real school account should be a `school_administrator`.

Only a school administrator can complete `Set up school records`. After registration, a new school administrator is sent to a setup-only onboarding screen before the real dashboard is shown. The ongoing `School setup` dashboard page shows school details, all school years, the active year, selected-year grade/section editing, and manual rollover preparation. If a registrar or finance officer signs in before setup is complete, they should see:

```text
Ask a school administrator to complete school setup first.
```

School setup is school-wide, not per staff account. After the school administrator saves setup, XMETA Pay links other unlinked `admin_profiles` with the same exact `school_name` to the same `schools.id`. New registrar and finance accounts also try to join the existing school context during registration. That means a registrar should not need to repeat setup when the school administrator already completed it for the same school name.

For the MVP, this matching uses the exact school name from admin registration. A future production improvement should use a school invite code or required school code during staff registration so staff can join the correct school even when two schools have similar names.

## School-Year Viewing Rule

The admin shell has a school-year selector for viewing data from any configured year. The selected year changes admin dashboard labels, student lists, fee/collection views, wallet/store pages, reports, and exports.

Only one school year is still the active/current year. For MVP safety, operational writes such as new enrollments, fee assignments, reminders, tuition terms, wallet/store purchase recording, parent payments, and parent wallet top-ups continue to use the active year only. Upcoming or closed years are view/report contexts, except the School setup page where a school administrator can edit that year's sections and prepare rollover enrollments.

## Practical Workflow

1. A school administrator registers first.
2. The school administrator completes setup-only onboarding.
3. The school administrator reviews and edits all school years from `School setup`.
4. The school administrator can prepare a manual rollover by selecting source-year students and a target-year section.
5. Admin staff use the school-year selector to view the active, upcoming, or closed year data.
6. New operational history rows are stamped with the active school year where supported.
7. Registrar and finance officer accounts with the same school name are linked to the existing school context.
8. A registrar can add and enroll students in the active year.
9. Parents link to those students by `student_reference`.
10. A finance officer works on active-year tuition, collections, allowance, store transactions, queued in-app reminder history, and reports after fee/payment backend phases are implemented.

Payment reminder history is a finance action. School administrators and finance officers can create queued `in_app` reminder log rows for linked parents with open or partial balances. The reminder action is idempotent for the same school, linked parent, and student on the same calendar day, so repeated clicks do not create duplicate same-day reminder rows. Registrars cannot log reminders because they do not have access to finance pages. Real email and SMS notification delivery is still future work.

## Database Source

The staff role is stored in:

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
