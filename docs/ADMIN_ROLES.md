# XMETA Pay Admin Roles

This guide explains the three school/admin staff roles used by XMETA Pay. All three accounts sign in through the admin/school portal, but their dashboard access is different.

## Role Summary

| Staff role | Main purpose | Can do | Cannot do |
| --- | --- | --- | --- |
| `school_administrator` | School owner and setup manager | Set up school records, manage students, view finance pages, view reports | No current admin dashboard restrictions |
| `registrar` | Student and guardian records | View dashboard, add/enroll students, view student profiles, view parent contacts | Set up school records, use finance pages, view reports |
| `finance_officer` | Fees, payments, allowance, and reports | View dashboard, tuition, collections, other fees, allowance, store transactions, reports | Set up school records, add/enroll students, manage parent contacts |

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

## Setup Rule

The first real school account should be a `school_administrator`.

Only a school administrator can complete `Set up school records`. This setup creates or links the school, active school year, grade levels, and sections. If a registrar or finance officer signs in before setup is complete, they should see:

```text
Ask a school administrator to complete school setup first.
```

## Practical Workflow

1. A school administrator registers first.
2. The school administrator completes school setup.
3. A registrar can add and enroll students.
4. Parents link to those students by `student_reference`.
5. A finance officer works on tuition, collections, allowance, store transactions, and reports after fee/payment backend phases are implemented.

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
