---
name: Commit
description: Use when the user runs /commit or /commit push, or asks to commit the current changes. Reads the working tree, stages the changes, and commits with a Conventional Commits message. Adds a push only when asked.
metadata:
  opencode/autoinvoke: true
---

# Commit

Commit the current work with a clear, conventional message. Add a push only when
the user asks for one.

## Steps

1. **Check the repo.** Confirm this is a git repository. If not, say so and stop.
   Note the current branch and whether it has an upstream.
2. **Read the change.** Run `git status --short`, `git diff` (unstaged), and
   `git diff --staged` (staged). If there is nothing to commit, say so and stop.
   Read `git log --oneline -10` to match the repo's message style.
3. **Write the message.** Use Conventional Commits:
   `type(scope): summary`. Pick the type from the change: `feat`, `fix`, `docs`,
   `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Scope is
   optional, use it when one area dominates. Imperative mood, lower case, no
   trailing period, one line under about 72 characters. Add a short body with
   `-` bullets only when the change needs the detail. No AI slop.
4. **Stage and commit.** Stage the relevant changed files (default `git add -A`
   unless the user named files). Commit with the message. Do not amend, rebase,
   or rewrite history.
5. **Push only if asked.** If the request is `/commit push` (or the user says
   push), push after the commit. Use `git push`; if the branch has no upstream,
   use `git push -u origin HEAD`. Never force push.

## Rules

- Never commit secrets, credentials, or `.env` files. If one is staged, stop and
  warn the user.
- Do not commit ignored files.
- One commit for the change set unless the user asks for several.
- Report the commit hash and, when pushed, the remote and branch.
