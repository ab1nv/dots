# Formatting and file templates

Everything is viewed in **Obsidian**. Write clean Markdown, not terminal output.

## Universal rules

- **Language.** Correct English by default. If metadata sets `language`, write in
  that language. Keep sentences short and clear.
- **Hard words.** Gloss a genuinely hard word in parentheses right after, or in a
  footnote. Example: "flux (the amount flowing through a surface per unit time)".
- **Headings.** `#` for the document title, `##` for sections, `###` for
  sub-sections. One `#` per file. Blank line before and after every heading.
- **Breaks.** Blank line between paragraphs, around lists, around code, and
  around callouts. Never let two blocks touch.
- **Emphasis.** `**bold**` for key terms on first use; `*italics*` for a term
  being defined. Do not over-bold.
- **Math (LaTeX).** Inline `$f(x)$`; display fenced on its own lines:

  ```md
  $$
  f(x) = x^2
  $$
  ```

- **Diagrams.** SVG files live in `assets/` and are embedded by filename:
  `![[assets/<name>.svg|520]]`.
- **Callouts.** `> [!abstract]`, `> [!info]`, `> [!question]`, `> [!success]`,
  `> [!failure]`, `> [!warning]`.

## Files that exist

Only two kinds:

```
<topic>/
├── 00. Index.md
├── 01. <Unit>.md
├── 02. <Unit>.md
└── assets/            # only if a diagram is needed
```

Never create a README, a progress file, or a lesson file. `test.md` is
temporary during Phase 1 and is deleted when probing ends.

## `<topic>/00. Index.md`

The topic header, a `___` separator line, an `## Index` heading, then one table.
The table is the index **and** the progress tracker.

```md
# <Topic>

___

## Index

| # | Topic | Level | Done |
| --- | --- | --- | --- |
| 00 | [00. Index](00.%20Index.md) | — | ✅ |
| 01 | [01. Database Transactions](01.%20Database%20Transactions.md) | intermediate | — |
| 02 | [02. Indexes](02.%20Indexes.md) | beginner | — |
```

- `#` is zero-padded and matches the filename.
- **Topic** is a Markdown link to the unit file. Spaces are `%20`; keep the
  relative path so Obsidian resolves it. (Absolute paths are acceptable when the
  learner asks for them.)
- **Level** comes from the probe: `beginner`, `basics`, `comfortable`, or
  `advanced` (use `—` when not tested).
- **Done** is the last column: `—` while pending, `✅` when the learner says the
  unit is done.
- Row `00` is the index itself and is always `✅`.
- Update the table in place as levels are found and units are finished. This is
  the only place progress is stored.

## `<topic>/NN. <Unit>.md`

The unit title, then the teaching, node by node.

```md
# <Unit>

> [!abstract] Goal
> <one or two sentences: what this unit gets the learner>

## <Node 1 name>

**Motivation.** <why we need this node now>

**The idea.** <establish it, motivated: how could the learner have discovered it?>

**Connection.** <how it hangs off what is already in place>

![[assets/<name>.svg|520]]   <!-- only if a picture earns its place -->

## <Node 2 name>

...
```

A picture earns its place only when it shows something words cannot — shape,
structure, direction, geometric relationship. If prose or one equation already
carries it, do not add a diagram.

## Temporary `<topic>/test.md` (Phase 1 only)

One question block, then its result block once answered. Delete the file when
probing ends. Never create it when the level is "Nothing yet".

```md
## Question 1

> [!question] <Unit> · difficulty <n>/5
> <the question, clearly written>

> [!success] Result — correct ✓
> **Your answer:** 2. <option>
> **Correct answer:** 2. <option>
> **Why:** <one or two sentences>.
```

Use `> [!failure]` for a miss and `> [!warning]` for "I don't know". Always
include the correct answer and the "Why" line. The question block never contains
the answer.
