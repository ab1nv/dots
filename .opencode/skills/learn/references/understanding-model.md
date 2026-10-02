# The understanding model

The test is not a spot-check and not an exam. It is a **mapping job**: locate the
*edge* of the learner's understanding — the frontier where what they reliably
know turns into what they do not — along every strand the planned lesson will
depend on. Until you have found that edge, you cannot teach into it.

Record the running map in `progress.md` (template in `formatting.md`). Update it
after every answer.

## Strands

A **strand** is one prerequisite thread the lesson rests on. A topic has several,
and the edge is a frontier *across* them, not a single point. Examples:

- Python: names & references · types · mutability · functions & arguments ·
  scope · iteration & generators · error handling · classes
- Linear algebra: vectors · spans & bases · matrices as maps · determinants ·
  eigenvalues · orthogonality

Bound the list by **relevance to the goal**. Map every strand the teaching will
lean on; do not bother with strands it will not. Probe each one and find where
each runs out.

## Binary search the edge

For each strand you need a **floor** and a **ceiling**:

- **Floor** — something at that level the learner gets *right*. Proof they know
  at least this much.
- **Ceiling** — something they get *wrong* or genuinely do not know. Where it
  runs out.

The edge sits between them. One side alone tells you almost nothing.

Procedure:

1. Start at a medium difficulty for the strand.
2. **Correct answer → escalate sharply.** Do not inch forward; jump difficulty
   up. A run of right answers means the questions were too easy — you have a
   floor with no ceiling. Keep going until something breaks.
3. **Wrong answer → you have bracketed the edge from above.** Narrow back in to
   pin exactly where it sits.
4. **One wrong answer is not "done" — and it is not a cue to start teaching.** A
   single miss is one coordinate; you do not yet know its kind. Probe *around* it
   to classify it before concluding:
   - a careless slip,
   - a narrow, isolated gap,
   - or a systematic misconception.
5. **Misconceptions matter most.** A confidently held wrong model has to be
   dislodged, not merely topped up. When you catch one, dig into its extent
   rather than moving on.
6. Stop probing a strand when both a floor and a ceiling are found and the edge
   is pinned. Then move to the next strand.

Adapt each question based on the previous answer — many small graded questions,
not one big caveated one.

### What "I don't know" means

"I don't know" is **not** a wrong guess and **not** a right answer. It is a
genuine knowledge gap and an honest ceiling. Treat it as strong evidence for the
edge: do not lecture yet, keep it as the upper bound, and narrow in from below.

## Reading the map when planning

When Phase 2 begins, `progress.md` should let you answer, per strand:

- What does the learner already hold? Build from there — not below it, not above
  it.
- Where does each strand run out? That is where the lesson's work is.
- Which misconceptions need dislodging? Plan to surface and break them
  explicitly; they will not dissolve on their own.

Do not advance to planning until, for each goal-relevant strand, you can state
concretely both what the learner has and where it ends.

## A total beginner

If the learner chose "Nothing yet" (or metadata set `level: none`), skip the
pre-test entirely. You already know the edge: it is at zero. Start the lesson
from unconditional truths. The Phase 3 quiz-checks still apply — they are how you
confirm each node landed.
