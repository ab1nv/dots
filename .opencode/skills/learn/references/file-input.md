# File input: metadata and concept extraction

When `/learn` is given a file (`@INDEX.md` or a path), read the whole file before
doing anything else. The file may carry a **metadata contract** in YAML
frontmatter and it may contain several concepts.

## Metadata contract

Frontmatter keys you must honor. Unknown keys: do not guess silently — ask the
learner once what they mean, then record the answer in the topic `README.md`.

| Key | Values | Effect |
| --- | --- | --- |
| `topic` | text | Overrides the topic folder name. |
| `teaching_style` | `socratic` · `expository` · `adaptive` | Forces the style for the whole session. Overrides the per-stretch choice. |
| `language` | a language name, e.g. `english`, `hindi`, `hinglish` | Write all prose and questions in this language. Default `english`. |
| `level` | `none` · `beginner` · `comfortable` · `advanced` | Skips Phase 0. `none` also skips the pre-test. |
| `goal` | text | Skips the Phase 1b goal question. |
| `depth` | `overview` · `solid` · `deep` | How far to go. `overview` stops at a working mental model; `deep` goes to derivations and edge cases. |
| `assess` | `true` · `false` | `false` forces skipping the pre-test regardless of level. `true` forces it even for `none`. |
| `concepts` | list | The explicit concept list, in order. Overrides extraction. |
| `order` | list | Explicit teaching order (a list of concept names; may subset `concepts`). |
| `notes` | text | Free context from the author. Read it; do not display it verbatim unless asked. |

If a key contradicts itself or the arguments, ask which wins. **Metadata wins
over questions** — never ask for what the file already provides.

Example:

```yaml
---
topic: Maxwell's Equations
teaching_style: socratic
language: english
level: comfortable
goal: express Maxwell's equations in differential-form language
depth: deep
assess: true
order:
  - Differential forms
  - Exterior derivative
  - Hodge star
  - Maxwell in two equations
---
```

## Concept extraction

If `concepts:` is present, use it exactly. Otherwise derive concepts from the
document, in this priority order:

1. **Headings** — each `#`, `##`, `###` that names a topic or idea (ignore generic
   headings like "Introduction", "Notes", "References").
2. **Bold/defined terms** — `**term**` or "X is defined as…" / "X called Y".
3. **Topic sentences** — the first sentence of a paragraph often names its idea.
4. **List items** — a list of named items is often a concept list.

Produce a short, deduplicated, ordered list. A concept is a teachable unit, not a
sentence: "Ohm's law", not "the part about voltage and current". If two candidates
are the same idea under two names, merge them and keep the clearest name. Keep the
author's order unless `order:` says otherwise.

Show the extracted list to the learner once, briefly, and confirm before starting.
If the list is long (say more than eight), propose a sensible order and ask where
to begin rather than boiling the ocean.

## No file

With no file, the argument itself is the single concept and there is no metadata.
Everything else proceeds from the questions.
