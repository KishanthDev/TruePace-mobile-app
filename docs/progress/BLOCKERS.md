# TruePace — Active Blockers & Identified Defects

## 1. Active Defects (To Be Resolved in Phase 1)

### DEF-01: Restored Paused Session Loses GPS Stream (High Severity)
- **Status**: Identified during Phase 0 deep audit.
- **Location**: [`src/services/TrackingEngine.ts:838`](file:///c:/KISHAN/SOURCECODE/AI/Run/src/services/TrackingEngine.ts#L838)
- **Description**: `restoreActiveSession()` only restarts foreground watch and background location updates if `data.status === 'tracking'`. If the app was closed while paused, the session restores, but GPS streams are not re-initialized. When the user taps RESUME, `resumeRun()` assumes GPS streams are running, resulting in frozen distance and zero GPS updates.
- **Resolution Plan**: Scheduled as Task **P1-T1**. Ensure `resumeRun()` and `restoreActiveSession()` safely re-initialize GPS subscriptions when resuming a restored session.

### DEF-02: Destructive Actions Lack User Confirmation (Medium Severity)
- **Status**: Identified during UI audit.
- **Location**: [`src/app/index.tsx`](file:///c:/KISHAN/SOURCECODE/AI/Run/src/app/index.tsx) & [`src/components/RunHistoryModal.tsx`](file:///c:/KISHAN/SOURCECODE/AI/Run/src/components/RunHistoryModal.tsx)
- **Description**: Tapping FINISH on a paused workout or Clear History immediately executes without a confirmation prompt. Accidental taps can lose runs or wipe all history.
- **Resolution Plan**: Scheduled as Task **P1-T7**. Add `Alert.alert` confirmation modals before terminating active runs or clearing historical cache.

---

## 2. Infrastructure & Upstream Blockers
- **None at present**: Repository dependencies, TypeScript strict checks, and ESLint configurations are healthy.
