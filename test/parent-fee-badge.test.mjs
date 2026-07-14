import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const records = readFileSync("lib/students/records.ts", "utf8");

test("parent fee badge counts only payable active-year assignments", () => {
  const contextQuery = records.slice(records.indexOf("export async function getParentPortalContext"), records.indexOf("export async function getParentStudentProfileData"));

  assert.match(contextQuery, /JOIN school_years sy_count ON sy_count\.id = sfa_count\.school_year_id AND sy_count\.status = 'active'/);
  assert.match(contextQuery, /sfa_count\.status IN \('open', 'partial'\)/);
  assert.match(contextQuery, /sfa_count\.amount_due > sfa_count\.amount_paid/);
  assert.doesNotMatch(contextQuery, /wallet_transactions/);
});
