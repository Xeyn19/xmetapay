---
name: multi-agent-feature-delivery
description: Coordinate substantial XMETA Pay feature implementation across useful parallel subagents with explicit file ownership and centralized integration. Invoke only when the user explicitly calls `$multi-agent-feature-delivery`; do not use for small fixes or single-area changes.
---

# Multi-Agent Feature Delivery

Deliver substantial XMETA Pay features through balanced parallelism. Use as many subagents as can perform meaningful independent work, not as many roles as can be named. The primary agent remains responsible for scope, sequencing, integration, and the final result.

## Establish Project Context

1. Read `AGENTS.md`, inspect `git status --short --branch`, and preserve unrelated user changes.
2. For implementation work, read and follow `.codex/skills/feature-branch-context/SKILL.md` before editing. The primary agent alone creates or switches the feature branch.
3. Read `.codex/skills/scalable-feature-design/SKILL.md` and apply it to substantial feature or workflow changes.
4. Inspect the relevant implementation, schema, tests, configuration, and local documentation before decomposing the work. Read the applicable guide under `node_modules/next/dist/docs/` before changing Next.js APIs, conventions, routing, or Server/Client Component boundaries.
5. Respect the current work mode. For planning or review requests, delegate only non-mutating investigation and return the requested plan or findings.

## Build The Work Map

Identify the actual workstreams, their dependencies, and the files each one may change. Typical workstreams include:

- frontend and responsive interaction
- backend, domain rules, Server Actions, and MySQL data
- migrations, configuration, operations, or documentation
- tests, security review, regression analysis, and browser QA

Do not create a workstream merely to fill a role. Combine small or tightly coupled areas. Keep cross-cutting files and decisions with the primary agent when splitting them would create coordination overhead.

Use the available agent capacity discovered at runtime. Keep the primary agent active as coordinator and assign the remaining capacity to the highest-value independent workstreams. When useful workstreams exceed capacity, schedule them in dependency-aware waves rather than hardcoding an agent count.

## Assign Subagents Safely

Before spawning an implementation subagent, reserve a disjoint file or directory scope for it. Every assignment must include:

- a concrete objective and success criteria
- allowed files or directories and explicitly excluded shared files
- relevant project rules, existing patterns, and dependencies already discovered
- required checks or evidence
- instructions to preserve unrelated changes and report blockers before expanding scope

Subagents may directly edit only their assigned non-overlapping files. They must not switch or create branches, commit, stash, reset, discard changes, rewrite another agent's files, expand product scope, or spawn further agents unless the primary agent explicitly assigns that responsibility. If a required change falls outside ownership or overlaps another assignment, the subagent must stop that part and report it to the primary agent.

The primary agent owns shared contracts, cross-cutting files, branch state, dependency changes that affect multiple workstreams, and conflict resolution.

## Run In Dependency-Aware Waves

1. Use parallel read-only investigation when specialists can independently clarify architecture, risks, or test coverage.
2. Run independent implementation workstreams together only after their interfaces and file ownership are clear.
3. Wait for prerequisite implementation before starting dependent tests or reviews. Use later capacity for independent verification, security review, and regression analysis.
4. Reassign an available slot only when the next task has a concrete deliverable; do not create redundant review agents that repeat the same checks.

Each subagent must return:

- files changed or inspected
- behavior implemented or findings produced
- checks run and their outcomes
- unresolved risks, assumptions, or ownership handoffs

## Integrate And Verify

The primary agent reviews every result, inspects the combined diff, completes cross-cutting edits, and resolves handoffs. Run focused checks first, then the repository-level tests, lint, build, migration, documentation, secret, and browser checks warranted by the feature.

Do not treat subagent completion as proof of integration. Confirm that shared interfaces agree, permissions and ownership boundaries remain enforced, migrations and legacy records are safe, and test coverage exercises the combined behavior.

Finish with one accurate report covering the branch, implemented behavior, changed areas, verification results, migrations or operator steps, and any incomplete or blocked work. Do not claim a role, test, or deployment was completed unless there is evidence.

