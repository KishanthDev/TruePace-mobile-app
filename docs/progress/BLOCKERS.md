# TruePace — Active Blockers & Identified Defects

## 1. Resolved Defects

### DEF-01: Restored Paused Session Loses GPS Stream (RESOLVED)
- **Status**: **RESOLVED** (Phase 1, Commit pending)
- **Fix**:
  - `resumeRun()` explicitly calls `await this.startBackgroundTracking()` and `await this.startForegroundWatch()` to guarantee active location subscriptions upon unpausing.
  - `restoreActiveSession()` starts foreground watch when restored in `paused` state so satellite lock remains visible.
  - `resetRun()` cleans `lastProcessedTimestamp = null` between workouts.

### DEF-02: Destructive Actions Lack User Confirmation (RESOLVED)
- **Status**: **RESOLVED** (Phase 1, Commit pending)
- **Fix**:
  - Tapping `FINISH` on the paused HUD triggers a native `Alert.alert` with "Keep Running" vs "Finish".
  - Tapping `Clear History Cache` triggers a confirmation alert before wiping history.
  - Deleting an individual run triggers a confirmation alert naming the specific workout.

---

## 2. Active Blockers
- **None**: All static checks, tests, and builds are clean.
