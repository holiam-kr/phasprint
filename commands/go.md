---
description: "Implement an approved plan to completion. Argument: [plan file] (defaults to the active plan) 한국어 - 진행해줘, 구현 시작, 완주."
---

Carry out steps 3-5 of ${CLAUDE_PLUGIN_ROOT}/skills/sprint/SKILL.md.

- Plan: $ARGUMENTS. If empty, pick it up in this order — and remember that invoking `/go` **is**
  the approval, so the first thing to do with a draft is move it:
  1. Something already in `docs/plans/approved/` — resume it. Several: ask which one.
  2. Otherwise a plan in `docs/plans/draft/` — move it to `docs/plans/approved/`, then implement.
     Several drafts: ask which one before moving.
  3. Nothing in either, and a loose `docs/plans/task_*.md` from an older layout — treat it as a
     draft: confirm with the user, then move it to `approved/`.
  4. Nothing anywhere — there is no plan to run. Say so and suggest `/plan <task>`. Do not
     improvise a plan and start building.
- Carry every step of the plan through to completion. **Do not stop between steps to seek approval.**
- Clear the quality gate at the end of each step (unit tests, lint, regression; check a real
  renderer if there is UI).
- If a stop condition from step 4 hits, stop immediately, say which one, and ask.
- Once implementation is done, perform the step 5 adversarial review.
- If `${CLAUDE_PLUGIN_ROOT}` above is not a readable path, it was not expanded: locate the
  phasprint plugin under the installed plugin directory and read the skill from there.
