# TruePace — Architectural Decisions Log

This log captures formal architectural and engineering decisions made during the evolution of TruePace.

---

## Decision Index

### DEC-001: Strict Mathematical Determinism for Core Tracking
- **Date**: November 20, 2026
- **Context**: Determining whether machine learning or AI models should assist with GPS jitter filtering or pace estimation.
- **Decision**: All real-time telemetry (distance, pace, splits, active duration) must remain 100% deterministic, computed by pure TypeScript algorithms using the Haversine formula and GNSS Doppler velocity. AI models are strictly prohibited from modifying real-time tracking metrics.
- **Rationale**: Athlete trust requires mathematical truth. AI models introduce non-deterministic variance, latency, and battery drain.

### DEC-002: Zero Live Map Policy During Active Run
- **Date**: November 20, 2026
- **Context**: Whether to introduce an in-run map toggle on the HUD.
- **Decision**: The active running HUD will strictly remain 100% map-free. Route visualization will be rendered *only* post-workout on the completed run summary and history view.
- **Rationale**: Live OpenGL map views drain battery rapidly, cause thermal throttling on hot days, and distract athletes from glanceable pace metrics.

### DEC-003: Pure TypeScript Analytics over External Libraries
- **Date**: November 20, 2026
- **Context**: Selecting libraries for running consistency, standard deviations, and volume progressions.
- **Decision**: Implement mathematical formulas in small, pure TypeScript utilities with zero third-party dependencies.
- **Rationale**: Preserves APK size ($< 45\text{ MB}$), guarantees zero dependency vulnerability vectors, and enables 100% test coverage.

### DEC-004: Post-Run Anonymized AI Coaching Architecture
- **Date**: November 20, 2026
- **Context**: Integrating LLM capabilities for runner training advice.
- **Decision**: AI coaching will be executed on-demand post-workout, using sanitized aggregate metrics (splits, duration, variance) with zero geographic latitude/longitude coordinate points.
- **Rationale**: Protects runner privacy, avoids continuous background network/battery consumption, and ensures full offline operation when network is absent.
