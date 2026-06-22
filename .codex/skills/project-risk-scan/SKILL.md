---
name: project-risk-scan
description: Scan the XMETA Pay project for security and quality risks with priority on newly added, untracked, renamed, copied, and modified git files before the full project. Use when the user asks to audit, review, automatically scan, or produce a risk feedback report for SQL injection, secrets, unsafe web patterns, dependency issues, or broader project security concerns.
---

# Project Risk Scan

## Overview

Produce a report-only security and quality feedback pass for XMETA Pay. Prioritize new git files first, then scan the rest of the project, and do not edit or auto-fix application files unless the user separately asks for fixes.

## Workflow

1. Read `AGENTS.md` before scanning. Respect the Next.js instruction there if any follow-up code changes are requested.
2. Run the bundled scanner from the repository root:

```powershell
python .codex\skills\project-risk-scan\scripts\scan_project_risks.py --repo . --format markdown
```

If `python` is unavailable on Windows, use the bundled Codex Python runtime when known, or another available Python 3 executable.

3. Review the scanner output and inspect relevant source files manually before presenting final conclusions. Treat script matches as signals, not proof.
4. Return a concise report grouped by severity:
   - Critical
   - High
   - Medium
   - Low
   - Info
5. Put priority git-file findings before whole-project findings inside each severity group.

## What To Check

- SQL injection: raw SQL assembled with string concatenation, template interpolation, unsafe fragments, or request input passed into `mysql2` queries.
- Secrets: hardcoded passwords, tokens, API keys, private keys, database URLs, unsafe `.env` contents, and exposure of non-`NEXT_PUBLIC_` environment values.
- Web security: `dangerouslySetInnerHTML`, unsafe redirects, weak cookie/session options, CSRF-sensitive mutations, user-controlled links, and unsafe file/path handling.
- Dependencies and config: summarize `npm audit --audit-level=moderate` results when available, then inspect auth, database, route handlers, server actions, and configuration files that the script flags.

## Reporting Rules

- Include file path, line number when available, risk, evidence, impact, and suggested fix for each finding.
- Redact secret values in evidence. Do not print full tokens, passwords, keys, or private material.
- Distinguish confirmed findings from heuristic warnings. Use wording such as "possible" or "needs review" when a pattern requires human verification.
- Mention clean areas briefly when useful, but do not overstate security. A heuristic scan is not a full penetration test.
- Do not modify project files or run auto-fixes during this skill.

## Script Notes

The scanner excludes generated and vendor folders such as `.git`, `node_modules`, `.next`, `playwright-report`, and `test-results`. It scans priority files first using git status and then scans remaining text files in the project.
