# SPEC-003: Structured Interval Workouts & Target Pace HUD

1. **Specification ID**: SPEC-003
2. **Feature Name**: Structured Interval Workouts & Target Pace HUD
3. **Status**: PROPOSED
4. **Problem Statement**: Runners training for specific race goals need real-time feedback on whether they are running ahead of or behind a target pace, as well as structured audio guidance through interval repeats (e.g. $400\text{m}$ fast, $200\text{m}$ recovery).
5. **User Value**: Runners stay locked into their target race pace without looking at their phone, relying on clear HUD delta metrics and spoken audio cues.
6. **Goals**:
   - Allow runners to set a target pace before starting a run.
   - Display dynamic target pace delta on the HUD (e.g. `+0'08"` ahead in emerald or `-0'12"` behind in amber).
   - Support interval repeats with automatic audio stage transitions.
7. **Non-Goals**:
   - No complex graphical workout builders requiring heavy state trees.
8. **Functional Requirements**:
   - **FR-01**: Input target pace via simple modal before starting.
   - **FR-02**: Calculate real-time pace delta against target pace during active tracking.
   - **FR-03**: Trigger AudioCoach voice alerts when pace drifts $> 15\text{s}$ off target for two consecutive split evaluations.
   - **FR-04**: Support distance-based and time-based interval segments.
9. **Non-Functional Requirements**:
   - Real-time calculations computed synchronously with zero frame drop.
10. **User Flows**:
    - Runner selects "Target Pace" -> Enters `5:00/km` -> Starts run -> HUD displays `+0:04/km` in emerald -> AudioCoach announces "On pace".
11. **UI/UX Requirements**:
    - High-contrast target delta pill directly beneath hero distance.
12. **Technical Architecture**:
    - Extend `TrackingEngine` with `targetPaceSecondsPerKm` state and `intervalWorkout` engine.
13. **Data Model Changes**:
    - Add `targetPaceSecondsPerKm?: number` to `TrackingTelemetry` and `RunSummary`.
14. **API Requirements**: None.
15. **Offline Behavior**: 100% offline.
16. **Battery Impact**: Negligible ($< 0.1\%$ additional CPU overhead).
17. **Application Size Impact**: $< 25\text{ KB}$.
18. **Security and Privacy Considerations**: Local only.
19. **Dependency Analysis**: Zero new dependencies.
20. **Testing Requirements**: Unit tests for target delta math and interval state transitions.
21. **Acceptance Criteria**: Audio alerts fire accurately on interval boundaries and pace deviations.
22. **Failure Scenarios**: Target pace cleared if invalid number provided.
23. **Backward Compatibility**: Fully backward compatible; target pace defaults to null.
24. **Rollback Strategy**: Revert commits.
25. **Dependencies on Other Specifications**: None (Integrates directly into Phase 2).
26. **Implementation Phases**:
    - Phase 2.1: Target pace input modal and delta math.
    - Phase 2.2: AudioCoach cue integration.
    - Phase 2.3: Interval workout state machine.
27. **Definition of Done**: Typecheck, lint, and physical run validation pass.
