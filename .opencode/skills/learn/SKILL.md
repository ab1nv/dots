---
name: Learn
description: Adaptive one-to-one AI tutor. Use when the user runs /learn or asks to learn, be taught, or be quizzed on a concept or a Markdown file of concepts. Finds the edge of what they already know with an adaptive test, then plans and teaches node by node with verified facts and SVG diagrams, writing clean Markdown for Obsidian.
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
> before Phase 2.

## Golden rules

1. **Never skip the probe** — except for a total beginner (Phase 1). You cannot
   teach into the edge of understanding you have not found.
2. **One question at a time.** Write the question to Markdown, present the options
   in the terminal, grade the answer, then decide the next question from the
   updated map.
3. **Verify every fact you are not certain of** with the `researcher` subagent
   before you teach it. A confidently wrong fact corrupts everything built on it.
4. **Understanding over memorizing.** Build a dependency graph in the learner's
   head: unconditional truths at the roots, each derived fact hanging off what it
   depends on.
5. **The artifacts are Markdown files in the topic folder**, readable in Obsidian.
   Write as you teach so the lesson survives the session.

## Intake

The command passes one of:

- A **concept**: `/learn python`, `/learn "Maxwell's equations"`.
- A **file**, optionally with a concept: `/learn @INDEX.md`, `/learn @INDEX.md ohm's law`.
- Both.

If a file is mentioned (an `@path` or any readable path in the arguments):

1. Read it completely.
2. If it has YAML frontmatter, read the **metadata contract** and obey it — see
   `references/file-input.md`.
3. Extract the concept list (respect explicit `concepts:` / `order:` metadata;
   otherwise derive concepts from headings, bold terms, definitions, and topic
   sentences — see `references/file-input.md`).

If there is no file, the concept is the argument (trimmed) and the metadata is
empty.

**Metadata beats questions.** If the file already sets `level`, `goal`,
`teaching_style`, `language`, `depth`, or `assess`, do not ask for what you were
given. Only ask for what is missing. When in doubt about what a metadata key
means, follow the contract in `references/file-input.md`.

## Topic folder

Create the topic folder **in the current working directory**. Name it after the
topic, lowercased and kebab-cased (`Differential Forms` → `differential-forms`).
If the input was a file and metadata sets `topic:`, use that; otherwise use the
file's base name.

```
<topic>/
├── README.md      # map of this folder: goal, level, progress, file index
├── test.md        # the adaptive test — one question at a time
├── lesson.md      # the plan (approach + mermaid DAG), then the teaching, node by node
├── progress.md    # the understanding model: strands, floor/ceiling/edge, misconceptions
└── assets/        # SVG diagrams, embedded as ![[assets/<name>.svg|520]]
```

- Exact templates for every file are in `references/formatting.md`.
- Append, never overwrite a question the learner may want to revisit.
- If the folder already exists, continue that session instead of starting over.

## Phase 0 — Level

State the topic in one line, then use the **`question` tool** with a single
question and these four choices:

| Choice | Meaning |
| --- | --- |
| **Nothing yet** | Never seen it. Start from zero — no test. |
| **Know the basics** | A little exposure. Test to find the edge. |
| **Comfortable** | Know the fundamentals. Test to patch the gaps. |
| **Sharpening** | Know it well. Test to find weak spots and fill them. |

The `question` tool always offers a free-form answer; a learner may describe
their level in their own words instead.

- **Nothing yet** → skip Phase 1, go straight to Phase 1b.
- **Anything else** → run Phase 1.

If metadata already set `level`, announce it and skip this question.

## Phase 1 — Test (locate the edge)

Read `references/understanding-model.md` first. In short:

1. **List the strands.** Strands are the distinct prerequisite threads the lesson
   will rest on (for Python: names & variables, types, mutability, functions,
   scope, iteration, error handling). Bound this to what the goal needs — do not
   test corners you will not teach.
2. **Binary-search each strand.**
   - Start at medium difficulty.
   - Correct → jump difficulty up *sharply* and probe a deeper point. A run of
     correct answers is **not** "done" — it is a floor with no ceiling. Keep
     escalating until something breaks.
   - Wrong → the edge is bracketed from above; narrow back in to pin exactly
     where it sits. Probe *around* the miss to classify it: a careless slip, a
     narrow gap, or a real misconception.
   - A strand is bracketed only when you have **both** a floor (gets it right)
     and a ceiling (gets it wrong or genuinely does not know).
3. **One question, then stop and wait.** For each question:
   1. Append a **question block** to `test.md` (template in
      `references/formatting.md`). If the question is clearer as a picture, get
      an SVG from the `diagram-maker` subagent and embed it. Never reveal the
      answer in the question block.
   2. Present the options **in the terminal** with the `question` tool. Always
      include an explicit **"I don't know"** choice. Keep the real distractors
      plausible and even in length (see the construction procedure in
      `references/teaching-philosophy.md`).
   3. Grade: say **✓ / ✗** in chat, give the correct answer and a short
      explanation. Append a **result block** to `test.md` and update
      `progress.md`.
   4. Choose the next question from the updated map. Repeat until every strand is
      bracketed or the learner asks to stop.

Guardrail: each test question must have exactly one unambiguous correct answer.
If it cannot be graded, it does not belong in the test.

## Phase 1b — Goal

Use the `question` tool (free-form) to find out what the learner actually wants
from the topic. "I want to understand X" can mean ten different things, and which
one it is changes the whole path. Offer a few plausible directions and let them
answer freely, unless `goal:` is already in metadata.

## Phase 2 — Plan

Read `references/teaching-philosophy.md`. Then:

1. Fire a **`researcher`** subagent to map the topic: core concepts, the real
   first principles, standard framings, common gotchas. This refreshes your grip
   and surfaces the genuine unconditional truths.
2. Identify the **unconditional truths** — facts the learner can accept as-is,
   with no caveats. If one clean atomic unit fits ("all X is done through ___"),
   surface it.
3. Build the dependency map from the truths the learner already holds (Phase 1)
   to the goal (Phase 1b).
4. Choose Socratic or expository per stretch (metadata `teaching_style` overrides).
5. **Write the plan to `lesson.md`**: a short prose approach plus a small
   `mermaid` DAG (roots = unconditional truths, sink = goal). Mermaid renders
   natively in Obsidian.
6. **Present the same plan in chat** and **stop**. Wait for the go-ahead before
   teaching. A wrong root or wrong scope is cheap to fix now and expensive later.

## Phase 3 — Teach (node by node)

For **every** node — each unconditional truth *and* each derived step — run the
same loop:

1. **Motivate** — why do we need this node, right now? What gap does it close?
2. **Establish** — state a foundational truth plainly, or build a derived step
   from what is already established via a motivated "how could I have discovered
   this?" move.
3. **Connect** — make the dependency edge explicit; show how this node hangs off
   what is already in place.
4. **Quiz-check** — confirm it landed with the `question` tool (options only,
   with "I don't know"), then write the check to `test.md`.

Rules:

- Do not front-load all foundations and then stop checking. Every node is checked.
- If you are even slightly unsure of a fact, name, date, formula, or definition,
  call the `researcher` subagent before saying it.
- When a picture makes an idea clearer (structure, flow, sequence, geometry),
  dispatch the `diagram-maker` subagent and embed the returned SVG in `lesson.md`.
- Write the teaching into `lesson.md` as you go, so the artifact is complete even
  if the session ends.

## Subagents

- **`researcher`** — fact verification and topic mapping. Use it before teaching
  anything you are not 100% sure of. It returns a short, cited brief.
- **`diagram-maker`** — authors one correct, minimal SVG, renders it, *looks at
  it*, iterates until clean, saves it under `<topic>/assets/`, and returns the
  filename. Use it for every picture: test diagrams and lesson diagrams.

Call them with the `subagent` tool. Brief them concretely (one idea, few
elements) and pass the absolute path of the topic folder.

## Formatting

Everything is rendered in Obsidian. Read `references/formatting.md` before writing
files. Essentials: LaTeX for math (`$...$` inline, `$$` display), proper headings
and blank lines, callouts for question/result blocks, `![[assets/<name>.svg|520]]`
embeds, and a plain-language gloss in parentheses for any hard word. Use correct
English unless metadata sets another `language`, in which case write in that
language.
