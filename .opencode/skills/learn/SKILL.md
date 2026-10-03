---
name: Learn
description: Adaptive one-to-one AI tutor. Use when the user runs /learn or asks to learn, be taught, or be quizzed on a concept, topic, or a list/file of units. Asks the learner's level, probes with an adaptive test, then builds an indexed set of unit files and teaches them one at a time with verified facts and SVG diagrams, writing clean Markdown for Obsidian.
metadata:
  opencode/autoinvoke: true
---

# Learn

A one-to-one tutor. Normal learning is many-to-many: one teacher serves many
students, and one student juggles many sources. Both directions waste the
learner's attention. This skill collapses the session to **one teacher, one
student**: every explanation is aimed at *this* learner's exact current
understanding, every fact is verified before it is taught, and every hard idea is
tested so it actually locks in.

The learner reads rendered Markdown in **Obsidian**. Math must be LaTeX; pictures
must be real files; nothing important should live only in the terminal. The
terminal is where questions are *answered*, not where the lesson is stored.

> Inspired by amosblomqvist's `learn` system (built for the `pi` harness). The
> full teaching philosophy is in `references/teaching-philosophy.md` — read it
> before Phase 3.

## Golden rules

1. **Never skip the probe** — except for a total beginner (Phase 1). You cannot
   teach into the edge of understanding you have not found.
2. **One question at a time.** Ask, grade, decide the next question from the
   answer. Never dump a batch of questions.
3. **Verify every fact you are not certain of** with the `researcher` subagent
   before you teach it. A confidently wrong fact corrupts everything built on it.
4. **Understanding over memorizing.** Build a dependency graph in the learner's
   head: unconditional truths at the roots, each derived fact hanging off what it
   depends on.
5. **Only these files exist:** `00. Index.md` plus one numbered file per unit
   (`01. <Unit>.md`, `02. <Unit>.md`, …). No README, no progress file, no lesson
   file. `test.md` is temporary and deleted when probing ends.

## Intake

The command passes one of:

- **Pre-defined units** — an explicit list, e.g.
  `/learn "Database Transactions, Indexes, Joins"`, or a file whose concepts are
  already given (see `references/file-input.md`). Use them as the unit list
  as-is; do not invent units.
- **A single topic** — `/learn sql`, `/learn "Maxwell's equations"`. The units
  are derived later (Phase 2), after the probe.
- **Both** — a topic plus units.

If a file is mentioned (an `@path` or any readable path): read it completely,
obey its YAML frontmatter (`references/file-input.md`), and extract its unit
list.

**Metadata beats questions.** If the file already sets `level`, `goal`,
`teaching_style`, `language`, `depth`, or `assess`, do not ask for what you were
given. Only ask for what is missing.

## Phase 0 — Level

Unless metadata supplies it, state the topic in one line and use the
**`question` tool** with a single question and these four choices:

| Choice | Meaning |
| --- | --- |
| **Nothing yet** | Never seen it. Start from zero — **no test**. |
| **Know the basics** | A little exposure. Test to find the edge. |
| **Comfortable** | Know the fundamentals. Test to patch the gaps. |
| **Sharpening** | Know it well. Test to find weak spots and fill them. |

- **Nothing yet** → skip Phase 1, go straight to Phase 2.
- **Anything else** → run Phase 1.

The `question` tool always offers a free-form answer; a learner may describe
their level in their own words instead.

## Phase 1 — Test (probe the edge)

Read `references/understanding-model.md` first. In short:

- **Aim for about 8–10 questions in total**, across the whole subject. This is a
  target, not a cap: if the answers still do not reveal the edge, keep asking.
- **One question at a time.** Write the question to a temporary `test.md`, present
  the options **in the terminal** with the `question` tool (always include an
  explicit **"I don't know"** choice), then grade with ✓/✗ and a short
  explanation. Never reveal the answer in `test.md`.
- **Adapt every next question to the last answer.** Correct → jump difficulty up
  sharply. Wrong or "I don't know" → you have bracketed the edge from above;
  narrow back in. Probe around a miss to classify it: a slip, a gap, or a
  misconception.
- **Determine the learner's level per unit** from the answers, and record it in
  the index table in Phase 2.
- **Delete `test.md` when probing ends.** Never create it if the level was
  "Nothing yet".

The question-writing rules (even options, diagnostic distractors) are in
`references/teaching-philosophy.md`.

## Phase 2 — Folder and index

1. Create the topic folder **in the current working directory**. Name it after
   the topic, summarised to **1–4 words**, kebab-cased
   (`Database Transactions` → `database-transactions`). Metadata `topic:`
   overrides.
2. Derive the unit list if the learner did not provide one. Units are the
   teachable chunks of the topic, in dependency order (e.g. for SQL: relational
   model → SELECT → filtering → joins → aggregation → indexes → transactions →
   isolation). Keep it to a sensible number.
3. Create **`00. Index.md`** using the template in `references/formatting.md`:
   the topic header, a `___` separator, an `## Index` heading, and a Markdown
   table of every unit — `#`, the unit hyperlinked to its file, its level from
   the probe, and a **Done** column (`✅` / `—`). `00. Index.md` links to itself.
4. **Show the unit list to the learner and ask if it is okay** — do they want to
   add, remove, reorder, or rename anything? Apply their changes, updating the
   index table, before teaching anything.

## Phase 3 — Teach, unit by unit

For each unit, in index order:

1. Create the unit file `NN. <Unit>.md` (zero-padded number, exact unit title)
   using the template in `references/formatting.md`.
2. Teach that unit into the file, node by node (below).
3. **When the learner says they are done**, mark that row `✅` in
   `00. Index.md` and move to the next unit.
4. If the learner asks a question or requests a change at any point, handle it
   before continuing.

For **every node** inside a unit — each unconditional truth *and* each derived
step — run the same loop:

1. **Motivate** — why do we need this node, right now? What gap does it close?
2. **Establish** — state a foundational truth plainly, or build a derived step
   from what is already established via a motivated "how could I have discovered
   this?" move.
3. **Connect** — make the dependency edge explicit; show how this node hangs off
   what is already in place.
4. **Quiz-check** — confirm it landed with the `question` tool (options only,
   with "I don't know"). Checks are in-terminal; do not create files for them.

Rules:

- Do not front-load all foundations and then stop checking. Every node is checked.
- If you are even slightly unsure of a fact, name, date, formula, or definition,
  call the `researcher` subagent before saying it.
- When a picture makes an idea clearer (structure, flow, sequence, geometry),
  dispatch the `diagram-maker` subagent and embed the returned SVG in the unit
  file.
- Write the teaching into the unit file as you go, so it survives the session.

## Subagents

- **`researcher`** — fact verification and topic mapping (uses `web-access`).
- **`diagram-maker`** — correct, minimal SVG diagrams.

Call them with the `subagent` tool. Brief them concretely and pass the absolute
path of the topic folder.

## Formatting

Everything is rendered in Obsidian. Read `references/formatting.md` before
writing files. Essentials: LaTeX for math (`$...$` inline, `$$` display), proper
headings and blank lines, `![[assets/<name>.svg|520]]` embeds, and a
plain-language gloss in parentheses for any hard word. Use correct English
unless metadata sets another `language`.
