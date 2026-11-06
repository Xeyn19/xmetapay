import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildInstallmentPreset,
  equalInstallmentPercentages,
  validateFinalDeadline,
  validateInstallmentPlan,
} from "../lib/fees/installment-plan-rules.ts";

const bounds = { startsOn: "2028-09-05", endsOn: "2029-11-05" };

test("final deadline uses the selected school-year boundary inclusively", () => {
  assert.equal(validateFinalDeadline("2029-11-05", bounds), null);
  assert.deepEqual(validateFinalDeadline("2029-11-09", bounds), {
    field: "dueDate",
    message: "The final payment deadline must stay inside the selected billing period.",
  });
});

test("guided presets create editable equal-payment plans with final rounding", () => {
  assert.deepEqual(equalInstallmentPercentages(3), [33.33, 33.33, 33.34]);
  assert.deepEqual(equalInstallmentPercentages(6), [16.66, 16.66, 16.66, 16.66, 16.66, 16.7]);
  assert.deepEqual(buildInstallmentPreset("two").terms.map((term) => term.percentage), [50, 50]);
  assert.equal(buildInstallmentPreset("four").terms.length, 4);
  assert.equal(buildInstallmentPreset("monthly", 12).terms.length, 12);
  assert.equal(buildInstallmentPreset("custom").terms.length, 2);
});

test("installment validation requires complete chronological terms before the final deadline", () => {
  const valid = {
    enabled: true,
    planName: "Two-payment plan",
    bounds,
    finalDeadline: "2029-11-05",
    terms: [
      { name: "Upon enrollment", percentage: 50, date: "2028-09-05" },
      { name: "Final payment", percentage: 50, date: "2029-11-05" },
    ],
  };
  assert.equal(validateInstallmentPlan(valid), null);
  assert.equal(validateInstallmentPlan({ ...valid, terms: valid.terms.map((term) => ({ ...term, percentage: 40 })) })?.field, "termPercentages");
  assert.equal(validateInstallmentPlan({ ...valid, terms: [valid.terms[1], valid.terms[0]] })?.message, "Payment dates must be in chronological order.");
  assert.equal(validateInstallmentPlan({ ...valid, finalDeadline: "2029-10-01" })?.field, "termDates");
  assert.equal(validateInstallmentPlan({ ...valid, terms: [valid.terms[0]] })?.field, "installmentPlan");
});

test("tuition setup exposes guided presets, billing bounds, inline errors, and contextual required-fee timing", async () => {
  const forms = await readFile(new URL("../app/admin/tuition-assessments/workflow-forms.tsx", import.meta.url), "utf8");
  assert.match(forms, /Final payment deadline/);
  assert.match(forms, /Valid billing dates/);
  assert.match(forms, /Full payment/);
  assert.match(forms, /2 payments/);
  assert.match(forms, /4 payments/);
  assert.match(forms, /Monthly/);
  assert.match(forms, /Custom/);
  assert.match(forms, /Number of monthly payments/);
  assert.match(forms, /Add payment/);
  assert.match(forms, /Percentage total/);
  assert.match(forms, /min=\{billingBounds\?\.startsOn\}/);
  assert.match(forms, /max=\{billingBounds\?\.endsOn\}/);
  assert.match(forms, /state\.field === "dueDate"/);
  assert.match(forms, /setMandatoryTiming\("upfront"\)/);
});

test("server workflow returns field-specific errors and keeps database validation authoritative", async () => {
  const domain = await readFile(new URL("../lib/fees/assessment-workflow.ts", import.meta.url), "utf8");
  const actions = await readFile(new URL("../app/admin/tuition-assessments/actions.ts", import.meta.url), "utf8");
  assert.match(domain, /validateFinalDeadline\(p\.dueDate,\s*billingWindow\)/);
  assert.match(domain, /validateInstallmentPlan\(/);
  assert.match(domain, /hasPlan\?p\.mandatoryTiming:'upfront'/);
  assert.match(domain, /public readonly field\?/);
  assert.match(actions, /field: error instanceof AssessmentWorkflowError \? error\.field/);
  assert.match(actions, /beginTransaction\(\)/);
  assert.match(actions, /rollback\(\)/);
});
