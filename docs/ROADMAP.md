# TruePace — Product Evolution Roadmap

This roadmap defines the phase-by-phase evolution of TruePace into an intelligent, AI-native running platform.

---

## Roadmap Overview

```
Phase 0 (Foundation & Spec) ──► Phase 1 (Analytics & Testing) ──► Phase 2 (Intelligent HUD)
                                                                             │
Phase 5 (Long-Term Insights) ◄── Phase 4 (Route & Ecosystem) ◄── Phase 3 (AI Coaching)
```

---

## Phase 0: Discovery, Audit & Specification Foundation (CURRENT)
- **Status**: **IN PROGRESS (Finishing)**
- **Prerequisites**: None.
- **Objectives**:
  - Full codebase and configuration audit.
  - Verification of reported feature status.
  - Creation of complete documentation architecture (`CLAUDE.md`, `docs/`, `specifications/`, `quality/`, `agents/`, `progress/`).
  - Identification of architectural bugs and technical debt.
  - Quality gate definitions.

---

## Phase 1: Data, Analytics & Quality Foundation
- **Status**: **READY (Next Up)**
- **Prerequisites**: Phase 0 Completion & Sign-off.
- **Objectives**:
  1. **Bug Fix**: Fix cold-restart GPS stream initialization on restored paused sessions (`TrackingEngine.ts`).
  2. **Automated Testing Harness**: Set up unit testing for pure mathematical utilities (`calculateHaversineDistance`, `speedToPace`, `calculateAveragePace`) and `TrackingEngine` acceptance state machine.
  3. **Data Layer Hardening**: Implement versioned storage schemas, migration guards, individual run deletion (`deleteRun`), and defensive parsing.
  4. **Deterministic Running Analytics**:
     - Pace Consistency Index (standard deviation of km splits).
     - Split degradation / negative split detection.
     - Personal records tracking (fastest 1K, 5K, 10K, longest distance, longest duration).
     - Historical weekly / monthly volume aggregation.
  5. **Safety Controls**: Add confirmation alerts for `FINISH RUN` and `CLEAR HISTORY`.

---

## Phase 2: Intelligent Running Experience
- **Status**: **PLANNED**
- **Prerequisites**: Phase 1 Completion.
- **Objectives**:
  1. **Target Pace & Delta Telemetry**:
     - Pre-run target pace configuration (e.g. `5'15"/km`).
     - Real-time delta indicator on HUD ($+12\text{s}$ behind / $-8\text{s}$ ahead).
     - Audio cue warnings when drifting $> 15\text{s}$ outside target window.
  2. **Interval Workouts Engine**:
     - Time-based and distance-based interval workouts (e.g., $6 \times 800\text{m}$ with $90\text{s}$ recovery).
     - Dedicated interval HUD mode with remaining interval counter and stage announcements.
  3. **Unit Conversion**:
     - User setting toggle for Kilometers / Miles.
     - Adaptive pace notation (`min/km` vs `min/mi`).
  4. **Tabular Typography & Visual Polish**:
     - Native tabular number font formatting (`tabular-nums`) to eliminate numeric horizontal jitter.
     - Subtle entry animations and countdown timer ($3\dots 2\dots 1\dots \text{GO}$).

---

## Phase 3: AI Coaching & Contextual Personalization
- **Status**: **PLANNED**
- **Prerequisites**: Phase 1 & Phase 2 Completion.
- **Objectives**:
  1. **Post-Run Narrative Insights**:
     - Optional, asynchronous AI generation of structured post-run analysis.
     - Explanations of fatigue onset, pacing strategy, and terrain impact.
  2. **Personalized Recovery & Training Suggestions**:
     - Context-aware suggestions based on acute vs chronic training volume.
     - Natural language queries over historical workout data.
  3. **Zero-Leakage Privacy Architecture**:
     - On-device anonymization: strip absolute GPS coordinates prior to any external AI request.
     - Transmit only derived, aggregated metrics (split times, pacing variances, elevation delta, total distance).
     - Zero hardcoded API keys; secure proxy architecture or user-provided BYOK (Bring Your Own Key) with local encrypted storage.

---

## Phase 4: Route Intelligence & Ecosystem Integrations
- **Status**: **PLANNED**
- **Prerequisites**: Phase 1 Completion.
- **Objectives**:
  1. **Post-Run Route Polyline Visualizer**:
     - Static or lightweight offline map render *exclusively* on the finished run summary and history detail screen.
     - Strictly map-free live HUD maintained.
  2. **Data Export & Import**:
     - Standard GPX and TCX file generation and sharing.
     - Automatic or manual export to Strava and Android Health Connect / Apple Health.
  3. **Offline Backup & Restore**:
     - Encrypted JSON export/import of entire workout history.

---

## Phase 5: Advanced Predictive Intelligence
- **Status**: **PLANNED**
- **Prerequisites**: Phase 3 & Phase 4 Completion.
- **Objectives**:
  1. **Race Time Prediction**:
     - Deterministic Pete Riegel formula combined with historical pace decay models for 5K, 10K, Half, and Full Marathon estimates.
  2. **Training Load & Overreaching Alerts**:
     - Rolling 7-day vs 28-day workload ratio (ACWR) to warn runners of injury risks before overtraining occurs.
  3. **Adaptive Training Plans**:
     - Conversational training plan generator tailoring mileage build-up based on athlete schedule and target race date.
