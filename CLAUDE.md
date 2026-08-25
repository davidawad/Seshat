# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Beads Issue Tracker

This project uses **br (beads_rust)** for issue tracking — a local-first
SQLite+JSONL tracker, no background daemon (migrated from bd/Dolt,
2026-08-25). Run `br robot-docs guide` to see full workflow context and
commands (br's closest equivalent to bd's `prime`; br has no `prime`
subcommand). Issue ids keep the same `Seshat-` prefix as before the
migration (lowercased to `seshat-` internally — br always lowercases its
issue-id prefix, unlike bd).

### Quick Reference

```bash
br ready              # Find available work
br show <id>          # View issue details
br update <id> --claim  # Claim work
br close <id>         # Complete work
```

### Rules

- Use `br` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `br robot-docs guide` for detailed command reference
- `br` never runs git itself (unlike bd's Dolt-backed auto-push) — `.beads/issues.jsonl`
  stays gitignored here; there is no cross-machine sync mechanism for this
  repo's tracker today.
- **bd's `bd remember` persistent-memory feature has NO br equivalent** — do
  not assume memories work; use MEMORY.md-style files instead if you need
  durable notes.

**Architecture in one line:** issues live in a local SQLite DB (`.beads/beads.db`);
`.beads/issues.jsonl` is br's own JSONL export (kept current on every mutating
command, gitignored here). No git-remote sync mechanism (unlike bd's Dolt
`refs/dolt/data`) and no background daemon (unlike bd's Dolt sql-server) —
that daemon removal is the whole reason this repo switched. See
https://github.com/Dicklesworthstone/beads_rust for details.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `br` for task tracking. Do not run git commits or git pushes unless explicitly asked (`br` itself never runs git). At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `br robot-docs guide`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**

- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.

## Build & Test

_Add your build and test commands here_

```bash
# Example:
# npm install
# npm test
```

## Architecture Overview

_Add a brief overview of your project architecture_

## Conventions & Patterns

_Add your project-specific conventions here_
