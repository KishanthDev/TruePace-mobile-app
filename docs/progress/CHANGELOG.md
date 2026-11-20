# TruePace — Engineering Changelog

## [Phase 1 Complete] — 2026-11-20

### Fixed
- **DEF-01 (High Severity)**: Fixed GPS stream loss on cold-restored paused sessions:
  - `resumeRun()` now explicitly awaits and verifies both foreground watch and background location tasks are running.
  - `restoreActiveSession()` starts foreground watch when restored in `paused` state so satellite lock status is immediately visible.
  - `resetRun()` cleans `lastProcessedTimestamp = null` between sessions.
- **DEF-02 (Medium Severity)**: Added accidental tap confirmation modals:
  - Tapping `FINISH` on paused HUD prompts runner with "Keep Running" vs "Finish".
  - Tapping `Clear History Cache` requires explicit confirmation before wiping all records.
  - Individual run deletion triggers a confirmation alert naming the specific workout.

### Added
- **Zero-Dependency Native Automated Test Suite**:
  - Implemented Node 22 native test runner with experimental type stripping (`npm test`).
  - `scripts/register.mjs` and `scripts/test-hooks.mjs` for seamless ESM TypeScript module resolution.
  - `tests/geo.test.ts`: 15 comprehensive unit tests covering Haversine distance, GPS accuracy validation, Doppler speed-to-pace conversion, average pace calculations, and duration/distance string formatters.
  - `tests/analytics.test.ts`: 13 comprehensive unit tests covering Pace Consistency Index (PCI), Negative Split detection, and Personal Records evaluation.
  - 28/28 tests passing in ~600ms.
- **Intelligent Local Running Analytics (`src/utils/analytics.ts`)**:
  - `calculatePaceConsistency`: Computes normalized Pace Consistency Index (0–100) from kilometer split times and assigns qualitative labels ('Metronomic', 'Consistent', 'Varied', 'Erratic').
  - `isNegativeSplit`: Detects genuine negative splits (second half faster than first half by $\ge 1.5\text{s/km}$).
  - `evaluatePersonalRecords`: Detects all-time records for fastest 1K, fastest 5K, fastest 10K, longest distance, and longest duration.
- **Storage Layer Hardening & Individual Run Deletion (`src/utils/storage.ts`)**:
  - Added `deleteRun(id: string)` for individual workout removal.
  - Added `getPersonalRecords()` and `savePersonalRecords()`.
  - Added defensive validation on `getRunHistory()` to filter out corrupted storage items.
  - Automatically enriches saved runs with consistency scores, negative split flags, and record achievements.
- **UI & Accessibility Enhancements**:
  - `RunHistoryModal.tsx`: Added individual "Delete" action button per card, and badges for Consistency Score, Negative Split, and Record Set.
  - `index.tsx`: Rendered intelligent analytics badges on the completed run summary screen.

---

## [Phase 0 Complete] — 2026-11-20

### Added
- `CLAUDE.md`: Project-level operating instructions and CLI commands.
- Product Documentation: `PRODUCT_VISION.md`, `PRODUCT_REQUIREMENTS.md`, `CURRENT_STATE.md`, `ROADMAP.md`.
- Architecture Documentation: `SYSTEM_ARCHITECTURE.md`, `TRACKING_ENGINE.md`, `DATA_ARCHITECTURE.md`, `AI_ARCHITECTURE.md`, `SECURITY_AND_PRIVACY.md`, `PERFORMANCE_BUDGETS.md`, `ADR-001`.
- Specifications: `SPEC-001` through `SPEC-006` in 27-point architectural format.
- Quality Framework: `TEST_STRATEGY.md`, `REGRESSION_MATRIX.md`, `DEVICE_VALIDATION.md`, `PERFORMANCE_VALIDATION.md`.
- Autonomous Agent Protocols: `AGENT_ARCHITECTURE.md`, `AGENT_RULES.md`, `EXECUTION_PROTOCOL.md`, `HANDOFF_PROTOCOL.md`.
- Progress Tracking: `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md`, `CHANGELOG.md`.
