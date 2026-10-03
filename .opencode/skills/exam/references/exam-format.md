# Exam formatting

One file, `exam.md`, rendered in Obsidian. LaTeX for math. The answer key sits
at the end inside collapsible callouts.

## Whole-paper skeleton

```md
# <Topic> exam

> [!info] Paper
> **Type:** <Quick / Full / Mixed>
> **Questions:** <n>
> **Units:** <unit list>
> **Total marks:** <n>
> **Suggested time:** <n> minutes

## Instructions

Answer every question. MCQs take one letter. Subjective answers take a few
sentences. For coding questions, tag the file with your solution or paste the
code in chat. The answer key is at the end, collapsed.

___

## Part A: Multiple choice

**1.** <question> <n> marks

1. <option>
2. <option>
3. <option>
4. <option>

**2.** ...

___

## Part B: Subjective

**3.** <question> <n> marks

___

## Part C: Coding

**4.** <title> <n> marks

<problem statement>

**Input.** <description>
**Output.** <description>
**Constraints.** <list>

```text
Sample input
-----------
<sample>

Sample output
------------
<sample>
```

Submit by tagging the solution file or pasting the code in chat.

___

## Part D: <Other format>

...

___

## Answer key

> [!success]- 1. <answer>
> <one line of why>

> [!success]- 2. <answer>
> <one line of why>

> [!success]- 3. <model answer>
> <rubric points>

> [!success]- 4. <solution sketch>
> <approach, complexity, edge cases>
```

## Rules

- One `#` title per file.
- Blank line between every block. Never let two blocks touch.
- MCQ options are bare claims, no reasoning inside them. Reasoning goes in the
  answer key.
- Coding samples go in fenced `text` blocks, one for input and one for output.
- The answer key uses `> [!success]-` so it starts collapsed in Obsidian.
- Keep the paper clean. No decorative headings, no emoji, no filler.
