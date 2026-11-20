# TruePace — Autonomous Execution Protocol

## 1. Startup Routine (Every Session)

At the beginning of every autonomous engineering session:

1. Read `CLAUDE.md` and `AGENTS.md`.
2. Read `docs/CURRENT_STATE.md`.
3. Read `docs/ROADMAP.md`.
4. Read `docs/progress/PROGRESS.md`.
5. Read `docs/progress/BLOCKERS.md`.
6. Inspect Git status (`git status`, `git log -n 5`).
7. Determine the currently active Phase and task.
8. Verify that prerequisites for the task are met.
9. Begin execution from the exact verified state.

---

## 2. Task Lifecycle & States

Every engineering task must move sequentially through these formal states:

```
NOT_STARTED ──► SPECIFICATION_REQUIRED ──► READY ──► IN_PROGRESS
                                                          │
COMPLETE ◄── REVIEW_REQUIRED ◄── VALIDATING ◄── IMPLEMENTED
```

- **NOT_STARTED**: Defined in roadmap but pending prerequisite completion.
- **SPECIFICATION_REQUIRED**: Architectural design and 27-section spec must be authored.
- **READY**: Specification approved, acceptance criteria defined, ready for code.
- **IN_PROGRESS**: Implementation actively underway in small increments.
- **IMPLEMENTED**: Code written; awaiting static and dynamic validation.
- **VALIDATING**: Running TypeScript, ESLint, unit tests, and performance checks.
- **REVIEW_REQUIRED**: Independent review against acceptance criteria and regression matrix.
- **COMPLETE**: All quality gates passed, documentation updated, changes committed.
- **BLOCKED**: Blocked by technical dependency or awaiting human decision.
