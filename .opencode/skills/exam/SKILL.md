---
name: Exam
description: Generate and grade an exam. Use when the user runs /exam, or asks for a test, exam, quiz paper, or assessment on a topic or a /learn course folder. Builds MCQs, subjective questions, coding problems, and topic-appropriate extras, then grades the submitted answers.
metadata:
  opencode/autoinvoke: true
---

# Exam

Builds an exam from `/learn` course material or from a topic alone, writes it to
Markdown for Obsidian, then grades the answers the learner submits.

Accuracy matters more here than anywhere: a wrong answer key is worse than no
exam. Verify every fact, formula, and answer with the `researcher` subagent
before it goes in the paper.

## Phase 1: Resolve the source

The command passes a folder, a topic, or nothing.

- **Nothing.** Look at the current working directory:
  - If it is a `/learn` folder (it has `00. Index.md`, or numbered unit files
    like `01. <Unit>.md`), use it.
  - Else if it contains exactly one `/learn` folder, use that.
  - Else if it contains several, ask which one with the `question` tool.
  - Else there is no material. Ask the learner for the topic.
- **An existing directory.** Use it. Read `00. Index.md` for the unit list, then
  read the unit files for content.
- **A topic name with no matching folder.** Topic-only exam: no course material.
  Verify facts with the `researcher` subagent before writing questions.

State the source you found in one line before asking the exam type.

## Phase 2: Exam type

Use the `question` tool with one question and these three choices:

| Choice | Meaning |
| --- | --- |
| **Quick** | 5 to 10 MCQs covering all units. |
| **Full** | 10 to 30 MCQs covering all units. |
| **Mixed** | MCQs plus subjective questions, plus coding problems where the topic has code, plus other formats the topic supports. |

Spread questions across every unit. In a material-based exam, each unit in the
index gets at least one question. In a topic-only exam, cover the topic's main
areas.

For **Mixed**, pick the formats the topic actually supports:

- Programming: code reading, output prediction, debugging, complexity, and
  implementation problems.
- Math: derivations, proofs, and numerical problems.
- Science: numerical problems, diagram labelling, and explanation.
- Language: translation, grammar, and composition.
- History or humanities: essays, chronology, and source analysis.

## Phase 3: Write the exam

Create `exam.md` in the source folder (or in the current directory for a
topic-only exam). If `exam.md` already exists, use `exam-2.md`, `exam-3.md`, and
so on. The exact template is in `references/exam-format.md`.

The paper contains:

1. A header with the topic, type, question count, units covered, total marks, and
   a suggested time.
2. Instructions for answering and submitting.
3. The MCQ section.
4. The subjective section (Mixed).
5. The coding section (Mixed, when it applies).
6. The other section (Mixed, when it applies).
7. An answer key at the end, inside collapsible callouts so the learner can hide
   it while working.

MCQ rules: four options, exactly one correct, distractors taken from real
misconceptions, similar length and wording, no answer given away by formatting.
The full construction procedure is in
`.opencode/skills/learn/references/teaching-philosophy.md`.

Coding rules: give the full problem statement, constraints, and sample input and
output where they apply. Then tell the learner how to submit: tag the file that
holds the solution, or paste the solution in chat. Do not require a file.

Write the paper in the learner's language, and follow the global writing rules:
plain prose, no AI slop, no em dashes.

## Phase 4: Grade

When the learner submits answers, grade them:

- **MCQs**: mark each right or wrong and give the score.
- **Subjective**: grade against the model answer with a short rubric, and allow
  partial credit.
- **Coding**: read the tagged file or the pasted code. Check correctness, edge
  cases, and complexity. If the project has tests, run them.
- **Other**: grade as the format requires.

Then give a total score, a per-unit breakdown, and point at the weakest units
(link their files from the index). Append a short results section to the exam
file with the score and the mistakes to revisit. Do not change the `/learn`
index: that tracks study progress, not exam scores.

## Rules

- Verify facts with `researcher` before writing any answer key.
- One exam file per exam. No other files.
- Obsidian formatting: LaTeX for math, callouts for the answer key.
- If the learner asks to retake or change the exam, do that before grading.
