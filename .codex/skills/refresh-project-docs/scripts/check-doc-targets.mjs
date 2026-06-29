import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredDocs = [
  "ADMIN_ROLES.md",
  "CHECKLIST.md",
  "DATABASE_SCHEMA_EXPLANATION.md",
  "DATABASE_SCHEMA_PLAN.md",
  "PROJECT_FLOWCHARTS.md",
];

const requiredPublicFiles = [
  "PROJECT_FLOWCHARTS_VISUAL.html",
  "DATABASE_SCHEMA_VISUAL_PLAN.html",
];

function repoRoot() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "../../../..");
}

function listDirectMarkdownFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function formatList(items) {
  return items.length === 0 ? "none" : items.join(", ");
}

function main() {
  const root = repoRoot();
  const docsDir = path.join(root, "docs");
  const publicDir = path.join(root, "public");
  const errors = [];

  if (!fs.existsSync(docsDir) || !fs.statSync(docsDir).isDirectory()) {
    errors.push(`Missing docs directory: ${docsDir}`);
  }

  if (!fs.existsSync(publicDir) || !fs.statSync(publicDir).isDirectory()) {
    errors.push(`Missing public directory: ${publicDir}`);
  }

  if (errors.length === 0) {
    const actualDocs = listDirectMarkdownFiles(docsDir);
    const expectedDocs = [...requiredDocs].sort((a, b) => a.localeCompare(b));
    const missingDocs = expectedDocs.filter((name) => !actualDocs.includes(name));
    const extraDocs = actualDocs.filter((name) => !expectedDocs.includes(name));

    for (const fileName of missingDocs) {
      errors.push(`Missing required docs file: docs/${fileName}`);
    }

    for (const fileName of extraDocs) {
      errors.push(`Unexpected direct Markdown file in docs/: docs/${fileName}`);
    }

    for (const fileName of requiredPublicFiles) {
      const filePath = path.join(publicDir, fileName);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        errors.push(`Missing required public visual file: public/${fileName}`);
      }
    }

    console.log("Refresh Project Docs target set");
    console.log(`Repo: ${root}`);
    console.log(`Docs: ${expectedDocs.map((name) => `docs/${name}`).join(", ")}`);
    console.log(
      `Visuals: ${requiredPublicFiles.map((name) => `public/${name}`).join(", ")}`,
    );
    console.log(`Extra direct docs detected: ${formatList(extraDocs)}`);
  }

  if (errors.length > 0) {
    console.error("Target check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Target check passed.");
}

main();
