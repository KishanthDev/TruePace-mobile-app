# SPEC-005: Long-Term Fatigue, Volume Progression & ACWR Modeling

1. **Specification ID**: SPEC-005
2. **Feature Name**: Long-Term Fatigue, Volume Progression & ACWR Modeling
3. **Status**: PROPOSED
4. **Problem Statement**: Runners frequently increase weekly mileage too rapidly or fail to balance recovery, leading to overuse injuries, overtraining, and performance stagnation.
5. **User Value**: Runners receive evidence-based warnings when weekly training volume spikes dangerously, along with projected race times for upcoming distances.
6. **Goals**:
   - Compute Acute:Chronic Workload Ratio (ACWR) across 7-day vs 28-day moving volume.
   - Project 5K, 10K, Half Marathon, and Marathon times using Pete Riegel's endurance formula.
   - Display a clean Weekly Volume Progression bar.
7. **Non-Goals**:
   - No clinical medical advice.
8. **Functional Requirements**:
   - **FR-01**: Aggregate weekly moving volume and compute ACWR score.
   - **FR-02**: Flag safe training sweet spot ($0.8 \le \text{ACWR} \le 1.3$) vs danger zone ($\text{ACWR} > 1.5$).
   - **FR-03**: Calculate race predictions: $T_2 = T_1 \times (D_2 / D_1)^{1.06}$.
9. **Non-Functional Requirements**:
   - Computations execute instantly from cached workout metadata.
10. **User Flows**:
    - Athlete opens History / Insights tab -> Views weekly mileage bar (e.g. 28.4 KM this week, +8% safe progression) and race time estimates.
11. **UI/UX Requirements**:
    - Tabular monospace numbers, simple ASCII or minimal bar gauges in OLED theme.
12. **Technical Architecture**:
    - Pure TypeScript analytics utility `src/utils/workload.ts`.
13. **Data Model Changes**:
    - None (computed dynamically from existing `RunSummary[]`).
14. **API Requirements**: None.
15. **Offline Behavior**: 100% offline.
16. **Battery Impact**: Zero (runs on demand when viewing insights).
17. **Application Size Impact**: $< 20\text{ KB}$.
18. **Security and Privacy Considerations**: Local only.
19. **Dependency Analysis**: Zero new packages.
20. **Testing Requirements**: ACWR mathematical edge cases; Riegel formula verification against standard tables.
21. **Acceptance Criteria**: ACWR accurately identifies volume spikes; race predictions align with standard benchmarks.
22. **Failure Scenarios**: Fewer than 3 historical workouts displays "Need more runs to establish workload baseline".
23. **Backward Compatibility**: Fully backward compatible with legacy history records.
24. **Rollback Strategy**: Revert commits.
25. **Dependencies on Other Specifications**: Depends on SPEC-001.
26. **Implementation Phases**:
    - Phase 5.1: Workload and race prediction math.
    - Phase 5.2: UI insights component.
27. **Definition of Done**: Passing tests and verified baseline handling.
