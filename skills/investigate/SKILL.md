---
name: investigate
description: Use when investigating a bug, a test failure, or unexplained behavior. Triggers on "why is this failing", "what causes this bug", "debug this", "it won't reproduce", "the test broke". Use it before proposing any fix. 한국어 - "왜 실패하지", "이 버그 원인", "디버깅", "재현이 안 됨", "테스트가 깨짐".
---

# Investigation protocol

**Finish this procedure before writing a single line of fix.** Fix what you can see and only
the symptom goes away.

## When to use this

A bug, a failing test, or behaviour nobody can explain — whenever the cause is not already in
front of you.

## When not to use this

Skip the protocol when the cause is visible and the fix is trivial: a typo, an off-by-one in
code you wrote this turn, a missing import the error names outright, a failure whose message
states the remedy. Fix it, verify it, move on. Three hypotheses for a typo is ceremony, and this
skill exists to stop guessing, not to slow down seeing.

If you are unsure whether it qualifies, it does not — run the protocol.

## 1. Reproduce first

- Find and run the command that reproduces the failure, and capture the **actual output**.
  Reproduce before you theorise, and never write a fix for something you have not watched fail.
- When it will not reproduce, that **is** the finding, not the end of the investigation. Say so
  plainly and turn the question around: why does it reproduce elsewhere and not here —
  environment, timing, ordering, or data dependence? Keep investigating; just do not fix blind.
- Write the reproduction command down. You will run it again to verify the fix.

## 2. Three or more competing hypotheses

- Form **at least three** candidate causes. Do not chase the first one that comes to mind.
- Draw them from different layers: input/data, logic, state and lifecycle, environment and
  configuration, dependencies, concurrency.
- For each hypothesis, write down what should be observable if it were true. Without that,
  the hypothesis cannot be tested.

## 3. Evidence per hypothesis

- For each hypothesis, construct an observation that **refutes or confirms** it: logs,
  breakpoints, a minimal reproduction, bisection (`git bisect`), input reduction.
- Evidence must be execution output. Reading the code and concluding "it's probably this"
  is not evidence.
- Captured output travels into the report and `HANDOFF.md`. Authentication failures are among
  the most common things anyone debugs, and their output carries live credentials — mask any
  secret to its first and last four characters before it goes anywhere.
- Keep the hypotheses you rejected and why. They go in the final report.

## 4. The full causal chain

- Using the surviving hypothesis, explain **root cause → intermediate steps → observed
  symptom** with no gaps.
- A gap such as "and then somewhere around here" means you do not know the cause yet.
  Go back to step 2.
- Check why this went unnoticed until now, and whether the same cause exists elsewhere.

## 5. Verify before and after the fix

- Run the reproduction command from step 1 **before** the fix to confirm the failure, and
  **after** the fix to confirm it passes. Capture both outputs.
- Check for regressions: run the full existing test suite.
- Add a test that prevents recurrence, aimed directly at the original symptom.

## 6. Report

- The root cause and the causal chain
- The hypotheses you rejected and the grounds for rejecting them
- Verification output from before and after the fix
- Remaining risks and anything unconfirmed (mark it "unverified")

## Stopping

- If two attempts fail to narrow the cause, stop. Report the hypotheses, the evidence so far,
  and where you are stuck, then ask the user. Do not keep guessing.

## Checklist

- [ ] The failure was reproduced and its actual output captured — or the non-reproduction is
      itself reported as a finding
- [ ] Three or more hypotheses were formed before any one was chased
- [ ] Each hypothesis was met with execution output, not with a reading of the code
- [ ] The causal chain runs end to end with no "and then somewhere around here"
- [ ] The reproduction command was run before and after the fix, both outputs captured
- [ ] The report names the rejected hypotheses and what rejected them
- [ ] No secret appears unmasked in the report or in any file it touched
