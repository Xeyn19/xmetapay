# Tuition Assessment Supervisor QA

Date: __________  Supervisor: __________  Tester: __________  Build/commit: __________

## Safe local setup

1. Use a disposable local MySQL database and take a backup.
2. Import `database/migrations/2026-11-03-tuition-assessment-workflow.sql` after all earlier dated migrations.
3. Run `node utilities/qa/seed-tuition-assessment-demo.mjs --admin=<existing-local-school-admin-id>`.
4. Sign in as that school administrator. The seeder contains no credentials and refuses non-local database hosts.

## K–12 walkthrough

1. Open **Tuition → Tuition packages & setup**. Create a K–12 draft for Grade 7: tuition ₱20,000; mandatory fee ₱2,000; 100% term inside the active school year.
2. Approve it. Expected: status changes to approved; another approved schedule for the same grade/year is rejected.
3. Open **Create assessments** and select the Grade 7 package. Confirm the package summary names Grade 7, only Grade 7 candidates appear, students remain unchecked, and students from Grades 2–6 are absent. Search or filter a section, choose two matching students, and apply a ₱5,000 `QA-VOUCHER` credit with a reference.
4. Preview. Expected per student: gross ₱22,000; credit ₱5,000; net ₱17,000. Batch totals for two: gross ₱44,000; credits ₱10,000; net ₱34,000.
5. Post. Expected: exact **Post 2 assessments** confirmation, one batch reference, no partial writes.
6. Submit the same token again. Expected: original batch result, no duplicate charges.
7. Reopen the same package. Expected: posted students appear under **Already assessed** and cannot be selected again.

## College walkthrough

1. Open **School setup**, review **School type**, and use **Change school type** to choose **Higher Education only** or **Both K–12 and College** when needed.
2. Confirm the College track card reports its independent readiness, then open **Manage college academics**.
3. Use the school-year selector. Confirm an upcoming year allows period/section preparation, while a closed year is read-only.
4. Confirm `QA-BSIT`, four year levels, and `QA-First Semester`; only activate the period when its school year is active.
2. Enroll a synthetic college student in the active period using an existing local student record and the program/year setup.
3. Create and approve a college package targeted to that program/year and period.
4. Preview and post. Expected: students from other periods or year levels are excluded; the guardian statement names the period and package.
5. Change the package or selection after preview. Expected: the old review is invalidated and a new preview is required.

## Guardian and payment checks

- Statement shows itemized gross charges, allocated credits, upfront/installment treatment, actual term dates, payments, and remaining balance.
- Paying a term creates one payment and receipt, one assessment-term allocation, proportional underlying fee-line allocations, and updated term/line balances. Final allocation absorbs cent rounding.
- Legacy tuition terms show their own `tuition_payment_terms.due_date`.
- Existing Other fees still use the unchanged ad hoc workflow.

## Failure and permission checks

- [ ] Finance can read existing tuition reports but cannot see or invoke assessment management controls.
- [ ] Registrar and company super admin receive no write access.
- [ ] A credit above its amount/percentage cap is rejected.
- [ ] Term percentages other than 100% or dates outside the year/period are rejected.
- [ ] Closing/changing the period, schedule, students, credit rule, or plan after preview forces a new preview.
- [ ] A database failure leaves no partial batch, assessment, fee, credit, or term rows.

## Accessibility and responsive checks

At widths 320, 375, 768, and 1440 px: no horizontal page overflow; tuition actions and secondary text remain readable in light and dark modes; roster search, group filter, and bulk controls wrap cleanly; all controls are at least 44 px high; keyboard focus is visible; errors use an alert announcement; pending/success use status announcements.

| Width | K–12 wizard | College setup | Guardian statement | Pass/notes |
|---:|---|---|---|---|
| 320 | ___ | ___ | ___ | ___ |
| 375 | ___ | ___ | ___ | ___ |
| 768 | ___ | ___ | ___ | ___ |
| 1440 | ___ | ___ | ___ | ___ |

## Sign-off

Decision: ☐ Approve  ☐ Approve with follow-up  ☐ Reject

Supervisor signature: ____________________  Date: __________

Cleanup (only before posting QA assessments): `node utilities/qa/seed-tuition-assessment-demo.mjs --admin=<id> --cleanup`. The utility refuses cleanup once QA schedules have posted financial history.
