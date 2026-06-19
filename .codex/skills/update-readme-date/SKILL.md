---
name: update-readme-date
description: Update the XMETA Pay project README.md with safe public changes from the current project and refresh its last-updated footer. Use when the user invokes `$update-readme-date`, asks to update README.md from recent project changes, refresh the README date, update the README footer date, or ensure README.md documents the current project without exposing private or sensitive information.
---

# Update README Date

## Overview

Update the project root `README.md` so it reflects the current public state of the project, then ensure it ends with exactly one ISO date footer:

```md
Last updated: YYYY-MM-DD
```

Do not include secrets, private implementation details, credentials, internal URLs, personal data, API keys, environment values, business-sensitive information, or anything the user would not reasonably want published.

## Workflow

1. Read `AGENTS.md` first.
2. Inspect safe project context before editing README:
   - Run `git status --short` and inspect relevant changed files.
   - Read public-facing docs, package metadata, route/page names, scripts, and visible feature code when needed.
   - Prefer durable project facts over temporary work-in-progress details.
3. Update `README.md` with meaningful public changes:
   - Add or revise setup, usage, feature, script, route, or testing notes when the project changed.
   - Keep wording concise and user-facing.
   - Preserve existing README structure where practical.
   - Omit secrets, credentials, private customer/user data, internal-only notes, hidden business logic, `.env` values, tokens, keys, and sensitive infrastructure details.
4. Run the date updater from the repository root:

   ```powershell
   node .codex\skills\update-readme-date\scripts\update-readme-date.mjs
   ```

5. Confirm the script reports the README path and date written.
6. Check `git diff -- README.md` to verify the README changes are intentional, public-safe, and end with the refreshed footer.

## Public-Safety Rules

- Never copy secrets, private keys, passwords, tokens, cookies, internal credentials, database URLs, or `.env` values into README.
- Do not document private customer, student, school, staff, transaction, or personal information.
- Avoid exposing internal architecture, admin-only operational details, security controls, fraud rules, or deployment internals unless already public and intentionally documented.
- If a project change is sensitive, summarize it generically or omit it.
- If unsure whether information is private, leave it out and mention that it was omitted for safety.

## Script Behavior

- Target `README.md` in the project root by default.
- Use the machine's local date formatted as `YYYY-MM-DD`.
- Keep the footer as the final non-empty line.
- Replace an existing trailing `Last updated: ...` footer.
- Preserve all other README content unless the skill user asked for README content updates or current project changes make a public documentation update useful.

## Completion

Report the README path updated, the public changes documented, the date written, any sensitive details intentionally omitted, and any validation command that was run.
