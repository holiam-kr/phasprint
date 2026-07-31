---
description: "Implement an approved plan to completion. Argument: [plan file] (defaults to the active plan)"
---

Carry out steps 3-5 of ${CLAUDE_PLUGIN_ROOT}/skills/taskcycle/SKILL.md.

- Plan: $ARGUMENTS (if empty, the active plan in `docs/plans/`. If there are several, ask which one.)
- Carry every step of the plan through to completion. **Do not stop between steps to seek approval.**
- Clear the quality gate at the end of each step (unit tests, lint, regression; check a real
  renderer if there is UI).
- If a stop condition from step 4 hits, stop immediately, say which one, and ask.
- Once implementation is done, perform the step 5 adversarial review.
