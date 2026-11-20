# SPEC-004: Post-Run Route Breadcrumbs & Elevation Profiles

1. **Specification ID**: SPEC-004
2. **Feature Name**: Post-Run Route Breadcrumbs & Elevation Profiles
3. **Status**: PROPOSED
4. **Problem Statement**: Runners want to visually review the geographic route they traversed and understand elevation changes, but rendering live maps during the run consumes massive battery and distracts attention.
5. **User Value**: Runners get complete post-run route visualization and elevation graphs without sacrificing in-run battery life or the distraction-free HUD philosophy.
6. **Goals**:
   - Record downsampled coordinate polyline breadcrumbs during accepted points.
   - Render static or lightweight vector map polyline *exclusively* on the finished run screen and history detail modal.
   - Calculate total elevation gain/loss from GPS altitude data.
7. **Non-Goals**:
   - Zero live map rendering during active runs.
8. **Functional Requirements**:
   - **FR-01**: Downsample accepted GPS coordinates (Douglas-Peucker algorithm) into a lightweight route polyline.
   - **FR-02**: Calculate cumulative elevation gain/loss with altitude noise thresholding.
   - **FR-03**: Display post-run polyline path on summary view.
9. **Non-Functional Requirements**:
   - Downsampled polyline must remain $< 50\text{ KB}$ per 10K workout.
10. **User Flows**:
    - Runner completes run -> Run Summary includes a crisp minimalist path showing route trajectory and ascent.
11. **UI/UX Requirements**:
    - Minimalist monochrome or emerald route vector line on dark background.
12. **Technical Architecture**:
    - Pure SVG path rendering or lightweight static map snapshot.
13. **Data Model Changes**:
    - Add `routePoints?: [number, number][]` (downsampled lat/lon array) and `elevationGainMeters?: number` to `RunSummary`.
14. **API Requirements**: None (local vector rendering or static map tile).
15. **Offline Behavior**: 100% offline via local vector projection.
16. **Battery Impact**: Zero impact during run (downsampling runs asynchronously post-run).
17. **Application Size Impact**: $< 35\text{ KB}$ if using pure SVG rendering.
18. **Security and Privacy Considerations**: Route points saved locally; excluded from AI requests.
19. **Dependency Analysis**: `react-native-svg` (if chosen) or pure Canvas/SVG projection.
20. **Testing Requirements**: Douglas-Peucker reduction tests; altitude noise filter tests.
21. **Acceptance Criteria**: Polyline displays accurate shape without bloating AsyncStorage.
22. **Failure Scenarios**: Missing altitude data gracefully hides elevation metrics.
23. **Backward Compatibility**: Runs without route points render standard numeric summary.
24. **Rollback Strategy**: Revert component to standard summary view.
25. **Dependencies on Other Specifications**: Depends on SPEC-001.
26. **Implementation Phases**:
    - Phase 4.1: Coordinate downsampling & elevation math.
    - Phase 4.2: Post-run vector path component.
27. **Definition of Done**: Passing tests and verified low storage footprint.
