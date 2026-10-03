# The understanding model

The test is not a spot-check and not an exam. It is a **mapping job**: locate the
*edge* of the learner's understanding — the frontier where what they reliably
know turns into what they do not — along the units the lesson will cover. Until
you have found that edge, you cannot teach into it.

The map is recorded **only** in the index table of `00. Index.md` (level per
unit). There is no separate progress file.

## Budget

- Aim for **about 8–10 questions in total** across the whole subject.
- That is a target, not a cap. If the answers still do not reveal the edge — the
  learner keeps guessing, or answers contradict each other — ask more.
- Stop early only when every unit has a clear floor and ceiling. Do not pad.

## Strands and units

A **strand** is one prerequisite thread a unit rests on. A topic has several.
Probe the threads the teaching will lean on; skip corners it will not.

- SQL: relational model · SELECT/filtering · joins · aggregation · indexes ·
  transactions · isolation
- Linear algebra: vectors · spans & bases · matrices as maps · determinants ·
  eigenvalues · orthogonality

## Binary search the edge

For each unit you need a **floor** and a **ceiling**:

- **Floor** — something at that level the learner gets *right*.
- **Ceiling** — something they get *wrong* or genuinely do not know.

The edge sits between them. One side alone tells you almost nothing.

Procedure:

1. Start at a medium difficulty for the unit.
2. **Correct → escalate sharply.** Do not inch forward; jump difficulty up. A run
   of right answers means the questions were too easy — you have a floor with no
   ceiling. Keep going until something breaks.
3. **Wrong → you have bracketed the edge from above.** Narrow back in to pin
   exactly where it sits.
4. **One wrong answer is not "done".** Probe *around* it to classify it: a
   careless slip, a narrow gap, or a systematic misconception.
5. **Misconceptions matter most.** A confidently held wrong model has to be
   dislodged, not merely topped up. When you catch one, dig into its extent.
6. Move to the next unit once its edge is pinned.

Adapt each question to the previous answer — many small graded questions, not one
big caveated one.

## "I don't know"

"I don't know" is **not** a wrong guess and **not** a right answer. It is a
genuine knowledge gap and an honest ceiling. Treat it as strong evidence for the
edge: do not lecture yet, keep it as the upper bound, and narrow in from below.

## Recording the result

When probing ends, translate each unit's answers into a short level word for the
index table (`beginner`, `basics`, `comfortable`, `advanced`) and delete
`test.md`. When teaching that unit, build from its floor — not below it, not
above it — and surface any misconception you found.

## A total beginner

If the learner chose "Nothing yet" (or metadata set `level: none`), skip the
pre-test entirely and do not create `test.md`. You already know the edge: it is
at zero. Start the lesson from unconditional truths. The Phase 3 quiz-checks
still apply — they are how you confirm each node landed.
