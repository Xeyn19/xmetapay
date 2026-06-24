---
name: feature-branch-context
description: Start XMETA Pay feature development with the right repository context and a fresh git branch. Use when the user calls `$feature-branch-context`, asks to begin a new feature, wants feature work isolated on a new branch, or wants Codex to prepare project context before implementation. Creates branch names from the feature description without adding a `codex/` prefix unless the user explicitly asks for that prefix.
---

# Feature Branch Context

Use this skill to make the first move on new feature work in XMETA Pay: load the project rules, create an appropriate feature branch, then continue with the requested implementation.

## Workflow

1. Read `AGENTS.md` before code edits.
2. Check `git status --short --branch` and identify whether the current worktree already has uncommitted or untracked user changes.
3. If the user has not provided a branch name, derive one from the feature request:
   - Use lowercase ASCII words separated by hyphens.
   - Prefer `feature/<short-feature-name>` for new features.
   - Use `fix/<short-bug-name>`, `chore/<short-task-name>`, or `docs/<short-doc-name>` only when the request clearly is not a feature.
   - Do not prepend `codex/` unless the user explicitly requests that exact prefix.
   - Keep the branch name concise, usually 3 to 7 words after the slash.
4. Create or switch to the branch before implementation:
   - If the branch does not exist, run `git switch -c <branch-name>`.
   - If it already exists and switching will not disturb local changes, run `git switch <branch-name>`.
   - If local changes could be carried onto the new branch safely, keep them. Do not stash, reset, or discard user work unless the user explicitly asks.
   - If switching would fail because of conflicting local changes, stop and explain the exact blocker.
5. After the branch is ready, gather task-specific context:
   - Inspect relevant existing files and local patterns before editing.
   - For Next.js APIs, routing, metadata, images, fonts, config, or conventions, read the relevant guide in `node_modules/next/dist/docs/` first. This project may use breaking Next.js changes.
   - Prefer existing project helpers, components, and style conventions over new abstractions.
6. Implement the requested feature normally, with focused edits and appropriate verification.

## Branch Name Examples

- "Add parent payment reminders" -> `feature/parent-payment-reminders`
- "Build receipt export for schools" -> `feature/receipt-export`
- "Fix login redirect loop" -> `fix/login-redirect-loop`

## Completion

Report the branch name created or selected, the key files changed, and the verification performed. If a branch was created successfully in Codex Desktop, emit the git branch directive in the final response.
