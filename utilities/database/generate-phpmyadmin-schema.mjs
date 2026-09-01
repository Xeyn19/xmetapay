import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const utilityDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(utilityDirectory, "../..");
const outputPath = path.join(utilityDirectory, "xmetapay-production-schema.sql");

export async function buildProductionSchema() {
  const authSchema = await readFile(path.join(repositoryRoot, "database/auth-schema.sql"), "utf8");
  const fullSchema = await readFile(path.join(repositoryRoot, "database/full-schema-v1.sql"), "utf8");

  return [
    "-- XMETA EDU production schema for a new, empty cPanel/phpMyAdmin database.",
    "-- Generated from database/auth-schema.sql and database/full-schema-v1.sql.",
    "-- Select the target database in phpMyAdmin before importing this file.",
    "-- Schema only: no accounts, schools, students, payments, seeds, or other row data.",
    "",
    "SET NAMES utf8mb4;",
    "",
    "-- Authentication foundation",
    cleanCanonicalSchema(authSchema, { removeCreateDatabase: true }),
    "",
    "-- Application schema",
    cleanCanonicalSchema(fullSchema),
    "",
  ].join("\n");
}

export function cleanCanonicalSchema(source, { removeCreateDatabase = false } = {}) {
  let cleaned = source.replace(/\r\n/g, "\n");

  if (removeCreateDatabase) {
    cleaned = cleaned.replace(
      /^CREATE DATABASE IF NOT EXISTS xmetapay_db\s+CHARACTER SET utf8mb4\s+COLLATE utf8mb4_unicode_ci;\s*/i,
      "",
    );
  }

  return cleaned
    .replace(/^USE xmetapay_db;\s*/gim, "")
    .trim();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeFile(outputPath, await buildProductionSchema(), "utf8");
  console.log(`Generated ${path.relative(repositoryRoot, outputPath)}.`);
}
