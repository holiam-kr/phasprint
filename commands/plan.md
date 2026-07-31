---
description: "Write a plan and get it approved. Argument: <task description>"
---

Carry out steps 1-2 of ${CLAUDE_PLUGIN_ROOT}/skills/taskcycle/SKILL.md.

- Task: $ARGUMENTS
- Agree on the goal and scope first, then write a 3-6 step plan to `docs/plans/task_NNN.md`.
- Give every step a deliverable and a way to verify it (a runnable command where possible).
- Wait for the user's approval once it is written. Do not start implementing before approval.
