# SPEC-001: Intelligent Local Running Analytics & Personal Records

1. **Specification ID**: SPEC-001
2. **Feature Name**: Intelligent Local Running Analytics & Personal Records
3. **Status**: APPROVED
4. **Problem Statement**: TruePace currently only records high-level workout summary metrics (distance, active time, avg pace, best pace, and raw km splits) and dumps them into local storage. Runners have no insight into pacing consistency, fatigue degradation across kilometers, personal milestones, or longitudinal volume trends.
5. **User Value**: Runners can immediately see whether they paced evenly or crashed late in a workout, track their all-time personal records (fastest 1K, 5K, 10K, longest distance), and safely manage their workout history with individual run deletion.
6. **Goals**:
   - Compute mathematical Pace Consistency Index (PCI) and split variance locally.
   - Detect and display negative splits vs positive splits.
   - Automatically detect and persist personal records (PRs).
   - Implement individual run deletion (`deleteRun(id)`) with confirmation alerts.
   - Fix the cold-restart GPS stream initialization bug for restored paused sessions.
7. **Non-Goals**:
   - No external cloud analytics or server-side computation.
   - No complex graphical chart plotting that requires heavy libraries.
8. **Functional Requirements**:
   - **FR-01**: Calculate Pace Consistency Index (0–100 score based on normalized standard deviation of kilometer splits).
   - **FR-02**: Identify negative split achievements (second half of run faster than first half).
   - **FR-03**: Detect personal records on run completion and badge new records in the summary screen.
   - **FR-04**: Allow deleting individual runs from the history list modal.
   - **FR-05**: Require explicit user confirmation dialog before finishing a run and before clearing history.
   - **FR-06**: Ensure restored paused sessions restart GPS streams upon resume.
9. **Non-Functional Requirements**:
   - Execution time for all post-run analytics calculations must be $< 10\text{ ms}$.
   - Memory allocation must be $< 100\text{ KB}$.
   - Must run 100% offline.
10. **User Flows**:
    - *Flow A (Run Completion)*: Runner taps Finish -> Confirmation dialog -> Run summary displays distance, time, avg pace, splits, Consistency Grade (e.g. 94/100 Even Pace), and any new PR badges.
    - *Flow B (History Management)*: Runner opens History -> Swipes or taps trash icon on single run -> Confirms deletion -> Run is removed from list and cache without affecting other runs.
11. **UI/UX Requirements**:
    - Consistent OLED black (`#000000`) and emerald (`#22c55e`) palette.
    - Minimalist text badges for PRs and consistency ratings.
    - Standard native `Alert.alert` for confirmation modals.
12. **Technical Architecture**:
    - Add a pure TypeScript utility module `src/utils/analytics.ts` containing pure mathematical functions.
    - Update `src/utils/storage.ts` with `deleteRun(id: string)`, `getPersonalRecords()`, and `savePersonalRecords()`.
13. **Data Model Changes**:
    - Extend `RunSummary` in `src/types/tracking.ts`:
      ```typescript
      consistencyIndex?: number;
      isNegativeSplit?: boolean;
      newRecords?: string[];
      ```
    - Add `PersonalRecords` interface:
      ```typescript
      interface PersonalRecords {
        fastest1kSeconds: number | null;
        fastest5kSeconds: number | null;
        fastest10kSeconds: number | null;
        longestDistanceMeters: number;
        longestDurationSeconds: number;
      }
      ```
14. **API Requirements**: None (100% on-device).
15. **Offline Behavior**: Fully operational offline.
16. **Battery Impact**: Zero impact during active running; $< 0.001\%$ CPU burst post-workout.
17. **Application Size Impact**: $< 15\text{ KB}$ (pure TypeScript, zero new npm dependencies).
18. **Security and Privacy Considerations**: All metrics remain strictly on the local device.
19. **Dependency Analysis**: Zero new packages. Uses existing Expo and React Native APIs.
20. **Testing Requirements**:
    - Unit tests for standard deviation and consistency score formulas.
    - Unit tests for PR detection across sequential runs.
    - Storage deletion and isolation unit tests.
21. **Acceptance Criteria**:
    - All mathematical calculations match validated test fixtures.
    - Deleting run X leaves run Y and Z intact in AsyncStorage.
    - Confirmed finish prevents accidental workout termination.
22. **Failure Scenarios**: Corrupted JSON in AsyncStorage defaults gracefully to empty records without crashing.
23. **Backward Compatibility**: Existing `@truepace_run_history_v1` runs without the new fields render cleanly with optional chaining fallbacks.
24. **Rollback Strategy**: Revert commits; data model additions are purely additive.
25. **Dependencies on Other Specifications**: None (Foundational spec).
26. **Implementation Phases**:
    - Phase 1.1: Fix paused session cold-restart bug.
    - Phase 1.2: Implement `analytics.ts` and automated unit tests.
    - Phase 1.3: Update `storage.ts` with `deleteRun` and PR tracking.
    - Phase 1.4: Update UI summary and history modal with badges and confirmation dialogs.
27. **Definition of Done**:
    - TypeScript and ESLint pass with 0 warnings/errors.
    - Unit tests pass with 100% coverage on new analytics functions.
    - Tested on Android physical/emulator build.
