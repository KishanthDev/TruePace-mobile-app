# TruePace — Engineering Changelog

## [Phase 5 Complete] — 2026-11-20

### Added
- **Predictive Workload & ACWR Modeling Engine (`src/utils/workload.ts`)**:
  - Acute:Chronic Workload Ratio (ACWR) calculator comparing 7-day volume vs 28-day chronic volume.
  - Evidence-based risk categorizations: `undertraining` (< 0.8), `optimal` sweet spot (0.8 - 1.3), `overreaching` (1.3 - 1.5), and `danger` surge (> 1.5).
  - Pete Riegel race time predictor ($T_2 = T_1 \times (D_2 / D_1)^{1.06}$) accurately estimating 5K, 10K, Half Marathon, and Full Marathon times and target paces based on personal performance baselines.
  - Weekly moving volume progression tracker with week-over-week percentage change indicators.
  - 6 unit tests in `tests/workload.test.ts` (all 56 project tests passing).
- **Run History Modal Analytics Dashboard (`src/components/RunHistoryModal.tsx`)**:
  - Training Load & ACWR card with dynamic color badges and actionable coaching guidance.
  - 7-Day volume counter with week-over-week growth percentage.
  - Projected Race Times table rendering 5K, 10K, Half, and Full marathon estimates with tabular typography and user unit preferences.

---

## [Phase 4 Complete] — 2026-11-20

### Added
- **Polyline Simplification & Elevation Engine (`src/utils/polyline.ts`)**:
  - Pure TypeScript implementation of the Ramer-Douglas-Peucker algorithm for reducing GPS coordinate points with sub-meter accuracy.
  - Altitude noise filter with hysteresis thresholding ($\ge 3\text{m}$) for reliable cumulative elevation gain/loss.
  - 2D Viewport projection engine preserving true geographic aspect ratio for lightweight vector route rendering.
  - 7 unit tests in `tests/polyline.test.ts` (all 50 project tests passing).
- **Data Export & Portability Suite (`src/utils/gpxSerializer.ts`)**:
  - Schema-valid GPX 1.1 XML generation with trackpoints, ISO timestamps, and elevation.
  - Garmin Training Center XML (TCX) generator with laps and trackpoints.
  - Offline JSON workout history backup generator.
  - 4 unit tests in `tests/gpx.test.ts`.
- **Route Visualizer Component (`src/components/RouteVisualizer.tsx`)**:
  - Ultra-lightweight vector route polyline preview on completed run summary and history cards.
  - Green start marker, amber finish marker, and elevation gain badge.
  - Native GPX export button invoking the system share sheet (`Share.share`).
- **History Modal Enhancements (`src/components/RunHistoryModal.tsx`)**:
  - One-tap "Backup All" in the header to export complete JSON history.
  - Individual "Export" action per workout offering GPX 1.1 and TCX formats.
  - Inline route polyline preview for all runs containing GPS coordinates.

---

## [Phase 3 Complete] — 2026-11-20

### Added
- **AI Coaching & Recovery Insights Engine (`src/services/AiCoachingService.ts`)**:
  - Deterministic 100% offline local coaching heuristics:
    - Performance categorization (`recovery`, `base_building`, `tempo`, `threshold`, `interval`).
    - Pacing evaluation & consistency scoring (Grades A-D, negative/positive/even/erratic pacing).
    - Real-time fatigue onset detection: Identifies split index where runner experienced pacing degradation (> 8% fade).
    - Science-based recovery window calculation (12h to 72h based on distance, duration, intensity).
    - Post-run nutrition, hydration, and next workout recommendation engine.
  - Zero-GPS-leak anonymized cloud LLM prompt builder for optional cloud coaching.
  - Unit test suite in `tests/coaching.test.ts` covering negative splits, fatigue onset, and recovery hours.
- **UI Integration in HUD**:
  - OLED-styled "AI COACH INSIGHTS" card rendered on completed run summary.
  - Displays performance grade, pacing strategy, fatigue onset alert, recommended recovery hours, next suggested session, and hydration tip.

---

## [Phase 2 Complete] — 2026-11-20

### Added
- **Unit Conversion Engine & Preferences (`src/utils/units.ts`)**:
  - Full support for Metric (`KM`, `min/km`) and Imperial (`MI`, `min/mi`) systems.
  - Conversion utilities (`convertDistance`, `convertPace`, `formatUnitDistance`, `formatUnitPace`, `getUnitLabels`).
  - Unit preference state and persistence under `@truepace_unit_preference_v1`.
  - Unit toggle button directly in the HUD header.
  - 7 unit tests in `tests/units.test.ts` (all 35 project tests passing).
- **Target Running Pace & Real-Time Delta Guidance**:
  - Target Pace state and configuration in `TrackingEngine.ts` and `useRunTracker.ts`.
  - Target Pace quick-picker modal in the HUD header for setting paces (4:30, 5:00, 5:30, 6:00 /km) or turning off.
  - Real-time target pace delta indicator on active HUD showing seconds ahead (`▲ XS AHEAD` in emerald) or behind (`▼ XS BEHIND` in amber) or `ON TARGET` in lime.
  - Persisted in finished run summaries.
- **Tabular Numerics Anti-Jitter Typography**:
  - Applied `fontVariant: ['tabular-nums']` across `MetricTile.tsx`, `index.tsx`, and `RunHistoryModal.tsx`.
  - Fully eliminates horizontal numeric shifting as pace, distance, and duration digits tick up.
  - Added full accessibility label and role bindings to metric displays.

---

## [Phase 1 Complete] — 2026-11-20

### Fixed
- **DEF-01 (High Severity)**: Fixed GPS stream loss on cold-restored paused sessions.
- **DEF-02 (Medium Severity)**: Added accidental tap confirmation modals.

### Added
- Zero-Dependency Native Automated Test Suite (Node 22 native runner).
- Intelligent Local Running Analytics (`src/utils/analytics.ts`): Pace Consistency Index (PCI), Negative Split detection, Personal Records evaluation.
- Storage Layer Hardening & Individual Run Deletion (`src/utils/storage.ts`): `deleteRun(id)`, defensive parsing.
- UI Badges on completed run summary and run history modal.

---

## [Phase 0 Complete] — 2026-11-20

### Added
- Specifications, architecture documentation, quality framework, agent execution protocols, and changelog.
