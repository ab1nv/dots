# Input: units, files, and metadata

When `/learn` is given a file (`@INDEX.md` or a path), read the whole file before
doing anything else. The file may carry a **metadata contract** in YAML
frontmatter and it may contain a pre-defined unit list.

## Pre-defined units

If the learner gives units explicitly — inline (`/learn "A, B, C"`) or via a
file's `concepts:`/`order:` metadata or a clear list in the document — **use them
as the unit list as-is**. Do not invent, merge, or reorder units unless asked.
Then:

- Skip Phase 2's "derive the unit list" step; still create the folder, the index,
  and ask for add/remove/edit confirmation.
- Still run Phase 0 (level) unless metadata sets it, and Phase 1 (test) unless
  the level is "Nothing yet".

## Metadata contract

Frontmatter keys to honor. Unknown keys: ask once what they mean, then follow the
answer.

| Key | Values | Effect |
| --- | --- | --- |
| `topic` | text | Overrides the topic folder name (summarise to 1–4 words). |
| `teaching_style` | `socratic` · `expository` · `adaptive` | Forces the style for the whole session. |
| `language` | a language name, e.g. `english`, `hindi`, `hinglish` | Write all prose and questions in this language. Default `english`. |
| `level` | `none` · `beginner` · `comfortable` · `advanced` | Skips Phase 0. `none` also skips the test. |
| `goal` | text | The learner's target. |
| `depth` | `overview` · `solid` · `deep` | How far to go. |
| `assess` | `true` · `false` | `false` forces skipping the pre-test; `true` forces it even for `none`. |
| `concepts` | list | The explicit unit list, in order. Overrides extraction. |
| `order` | list | Explicit teaching order (may subset `concepts`). |
| `notes` | text | Free context from the author. Read it; do not display it verbatim unless asked. |

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

## Extracting units when none are given

If `concepts:` is present, use it exactly. Otherwise derive units from the
document, in this priority order:

1. **Headings** — each `#`, `##`, `###` that names a topic or idea (ignore generic
   headings like "Introduction", "Notes", "References").
2. **Bold/defined terms** — `**term**` or "X is defined as…".
3. **Topic sentences** — the first sentence of a paragraph often names its idea.
4. **List items** — a list of named items is often a unit list.

Produce a short, deduplicated, ordered list. A unit is a teachable chunk, not a
sentence: "Ohm's law", not "the part about voltage and current". Merge duplicates
under the clearest name. Keep the author's order unless `order:` says otherwise.

## No file

With no file and no explicit unit list, the argument is a single topic. Derive
the unit list in Phase 2, after the probe.
