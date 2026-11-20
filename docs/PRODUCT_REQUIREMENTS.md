# TruePace — Product Requirements Document (PRD)

## 1. System Requirements & Constraints

### 1.1 Mobile Platform Support
- **Android**: Android 10 (API 29) to Android 15 (API 35). Full background location support, foreground services with `FOREGROUND_SERVICE_LOCATION` permissions, and Android 13+ `POST_NOTIFICATIONS` support.
- **iOS**: iOS 15.0 through iOS 18.x. `UIBackgroundModes: ["location"]` support with standard `WhenInUse` and `Always` permissions.
- **Runtime**: React Native 0.86 / Expo SDK 57 / React 19.

### 1.2 Resource Budgets
- **Cold App Startup**: $< 1.5\text{ seconds}$ to active HUD render on mid-tier hardware.
- **Memory Footprint**: $< 85\text{ MB}$ RSS during continuous active tracking.
- **Foreground CPU Usage**: $< 4\%$ continuous CPU utilization.
- **Background Battery Consumption**: $< 3.5\%$ battery drain per 60 minutes of active GPS tracking.
- **Standalone Android APK Size**: $< 45\text{ MB}$.

---

## 2. Functional Requirements

### 2.1 Precision Tracking Engine (P0)
- **FR-01**: Must record coordinates via GNSS hardware with `Accuracy.BestForNavigation`.
- **FR-02**: Must calculate incremental distance between accepted anchor points using the Haversine formula ($R = 6,371,000\text{ m}$).
- **FR-03**: Must filter raw coordinates through a 7-stage stateful acceptance algorithm (Accuracy, Timestamp monotonicity, Pause status, Gap detection, Implied speed ceiling, Jitter cutoff, and Doppler stationary drift protection).
- **FR-04**: Must compute instantaneous pace ($1000 / \text{speed}$) directly from native satellite Doppler velocity, falling back to a 10s rolling coordinate buffer only when Doppler is unavailable.
- **FR-05**: Must enforce active elapsed time tracking using wall-clock intervals, strictly excluding paused duration from average pace calculations.
- **FR-06**: Must detect 1-kilometer milestones and calculate per-kilometer split durations based solely on active seconds.

### 2.2 Background Continuity & Resilience (P0)
- **FR-07**: Must maintain continuous location updates when the app transitions between foreground, background, and screen lock.
- **FR-08**: Must persist active session state snapshots to persistent local storage on every accepted coordinate and lifecycle event.
- **FR-09**: Must detect an interrupted session on cold restart ($< 12\text{ hours}$ old) and restore tracking metrics without data loss.

### 2.3 OLED HUD & Gatekeeper (P0)
- **FR-10**: Must display an OLED black (`#000000`) HUD with high-contrast tabular typography for elapsed time, distance (KM), current pace, and average pace.
- **FR-11**: Must hard-lock the `START RUN` action into `WAITING FOR GPS` state until device location services are enabled, permissions are granted, and horizontal accuracy is verified ($\le 15\text{m}$).
- **FR-12**: Must provide a diagnostic alert modal when tapping the locked status indicator, displaying real-time accuracy and resolution pathways.

### 2.4 Hands-Free Audio Coach (P1)
- **FR-13**: Must speak voice cues on workout start, pause, resume, finish, and per-kilometer milestones.
- **FR-14**: Must provide an audio cue toggle (`AUDIO ON` / `AUDIO OFF`) with persistent state across app launches.

### 2.5 Live Lock Screen Telemetry (P1)
- **FR-15**: Must publish a low-importance, persistent notification on Android devices updating KM distance, elapsed time, and pace every 1.5 seconds.
- **FR-16**: Must reflect paused state dynamically and dismiss cleanly upon workout completion or reset.

### 2.6 Local Workout History & Analytics (P1)
- **FR-17**: Must record completed runs ($\ge 20\text{m}$) into local persistent storage.
- **FR-18**: Must display past workouts detailing date, distance, active time, average pace, best pace, and per-kilometer splits with the fastest split highlighted.
- **FR-19**: Must support individual workout deletion and confirmation-guarded history wiping.

### 2.7 AI-Native Intelligence & Insights (P2)
- **FR-20**: Must compute deterministic running consistency indexes, pace stability metrics, and personal records locally.
- **FR-21**: Must provide an optional, non-blocking post-run AI summary explaining pacing strategy, fatigue onset, and recovery guidance.
- **FR-22**: Must maintain complete operational independence: all GPS tracking, split calculations, and local history must operate without network access or AI availability.
