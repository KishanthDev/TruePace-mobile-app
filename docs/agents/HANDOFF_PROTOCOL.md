# TruePace — Autonomous Handoff Protocol

## 1. Context Handoff Requirements

When a turn or session concludes, the agent orchestrator must leave the repository in a completely auditable, coherent state so that any subsequent agent or engineer can resume immediately without lost context.

---

## 2. Mandatory Handoff Checklist

Before concluding a turn or marking a task:

1. **Working Tree Cleanliness**: All newly authored or modified files must be saved. Run `git status` to verify modified, added, or untracked files.
2. **Static Quality Check**: Execute `npx tsc --noEmit` and `npx expo lint`. Both must pass with zero errors.
3. **Progress Documentation Update**:
   - Update `docs/progress/PROGRESS.md` with completed tasks, active task, and next task.
   - Update `docs/progress/CHANGELOG.md` with detailed bullet points.
   - Record any newly surfaced issues in `docs/progress/BLOCKERS.md`.
   - Record architectural choices in `docs/progress/DECISIONS.md`.
4. **Handoff Summary**:
   - Current Phase and state.
   - Verification status of the last executed step.
   - Explicit next task to execute.
   - Unresolved architectural questions (if any).
