import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildProductionSchema } from "../utilities/database/generate-phpmyadmin-schema.mjs";

const bundlePath = "utilities/database/xmetapay-production-schema.sql";

test("production phpMyAdmin schema bundle is current and contains every canonical table", async () => {
  const [bundle, expected, authSchema, fullSchema] = await Promise.all([
    readFile(bundlePath, "utf8"),
    buildProductionSchema(),
    readFile("database/auth-schema.sql", "utf8"),
    readFile("database/full-schema-v1.sql", "utf8"),
  ]);

  assert.equal(bundle, expected);

  const canonicalTables = new Set(
    [
      ...authSchema.matchAll(/CREATE TABLE IF NOT EXISTS\s+`?([a-z0-9_]+)`?/gi),
      ...fullSchema.matchAll(/CREATE TABLE IF NOT EXISTS\s+`?([a-z0-9_]+)`?/gi),
    ].map((match) => match[1]),
  );
  assert.ok(canonicalTables.size > 20);
  for (const tableName of canonicalTables) {
    assert.match(bundle, new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${tableName}\\b`, "i"));
  }
});

test("production phpMyAdmin schema bundle has no database targeting or row data", async () => {
  const bundle = await readFile(bundlePath, "utf8");

  assert.doesNotMatch(bundle, /^\s*CREATE\s+(?:DATABASE|SCHEMA)\b/gim);
  assert.doesNotMatch(bundle, /^\s*USE\s+[`\w]/gim);
  assert.doesNotMatch(bundle, /^\s*(?:INSERT|UPDATE|DELETE|REPLACE|LOAD\s+DATA)\b/gim);
  assert.doesNotMatch(bundle, /^\s*(?:DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE)\b/gim);
  assert.match(bundle, /Schema only: no accounts, schools, students, payments, seeds, or other row data/);
});
