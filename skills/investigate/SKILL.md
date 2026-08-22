---
name: investigate
description: Use when investigating a bug, a test failure, or unexplained behavior. Triggers on "why is this failing", "what causes this bug", "debug this", "it won't reproduce", "the test broke". Use it before proposing any fix. 한국어 - "왜 실패하지", "이 버그 원인", "디버깅", "재현이 안 됨", "테스트가 깨짐".
---

# investigate

Read the `## Debugging` section of `rules/cycle.md` in the phasprint plugin directory and follow
its six steps before writing a line of fix. Its absolute path is stated in the core rules
injected at session start.

This file is a pointer, not the rules. On a harness without skills, delete it -- `rules/cycle.md`
stands on its own.
