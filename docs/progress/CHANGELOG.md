# TruePace — Engineering Changelog

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
