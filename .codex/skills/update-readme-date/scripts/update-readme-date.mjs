import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const footerPattern = /^Last updated: .+$/;

function formatLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseArgs(argv) {
  const args = {
    readmePath: null,
    date: formatLocalIsoDate(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--date") {
      const value = argv[index + 1];
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error("--date requires a value formatted as YYYY-MM-DD.");
      }
      args.date = value;
      index += 1;
      continue;
    }

    if (arg === "--readme") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--readme requires a file path.");
      }
      args.readmePath = value;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function defaultReadmePath() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "../../../..", "README.md");
}

function updateReadmeFooter(readmePath, date) {
  const absoluteReadmePath = path.resolve(readmePath);
  const original = fs.readFileSync(absoluteReadmePath, "utf8");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const normalized = original.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length > 0 && footerPattern.test(lines[lines.length - 1])) {
    lines.pop();
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  lines.push("", `Last updated: ${date}`);
  fs.writeFileSync(absoluteReadmePath, `${lines.join(newline)}${newline}`, "utf8");

  return absoluteReadmePath;
}

function printHelp() {
  console.log(`Usage: node update-readme-date.mjs [--readme README_PATH] [--date YYYY-MM-DD]

Updates README.md so it ends with exactly one "Last updated: YYYY-MM-DD" footer.`);
}

try {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const readmePath = args.readmePath ?? defaultReadmePath();
  const updatedPath = updateReadmeFooter(readmePath, args.date);
  console.log(`Updated ${updatedPath}`);
  console.log(`Date: ${args.date}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
