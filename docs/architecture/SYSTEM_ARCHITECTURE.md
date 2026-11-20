# TruePace — System Architecture

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph Hardware_Sensors ["Native Hardware & Sensors"]
        GNSS["Device GNSS Hardware"]
        Haptics["Tactile Haptic Engine"]
        Speaker["Audio Output / TTS"]
    end

    subgraph Native_Expo_Layer ["Expo & Native Modules"]
        ELocFG["expo-location (Foreground Watch)"]
        ELocBG["expo-location (startLocationUpdatesAsync)"]
        ETask["expo-task-manager (Headless Worker)"]
        ENotif["expo-notifications (Live Lockscreen HUD)"]
        ESpeech["expo-speech (AudioCoach Singleton)"]
        EStorage["AsyncStorage (@truepace_*)"]
    end

    subgraph Core_Engine ["TruePace Core Tracking Engine"]
        TE["TrackingEngine (Singleton Store)"]
        Filter["7-Stage Stateful Acceptance Pipeline"]
        GeoMath["Mathematical Geo Utilities (Haversine & Doppler)"]
        Dedup["lastProcessedTimestamp Dedup Guard"]
        Snapshot["Active Session Persistence Manager"]
    end

    subgraph Presentation_Layer ["React Native Presentation Layer"]
        Hook["useRunTracker() (useSyncExternalStore)"]
        HUD["RunHudScreen (OLED Black #000000)"]
        Tiles["MetricTile (Tabular Typography)"]
        ModalGPS["GpsAlertModal (Satellite Gatekeeper)"]
        ModalHist["RunHistoryModal (Cached Sessions)"]
    end

    subgraph Intelligence_Layer ["Intelligence & Analytics Layer"]
        LocalAnalytics["Deterministic Analytics Engine (Pace, Consistency, PRs)"]
        AIProxy["Optional Asynchronous AI Coaching (Post-Run Only)"]
    end

    GNSS --> ELocFG & ELocBG
    ELocBG --> ETask --> TE
    ELocFG --> TE
    TE --> Dedup --> Filter --> GeoMath
    Filter --> Snapshot --> EStorage
    Filter --> ENotif & ESpeech & Haptics
    TE --> Hook --> HUD
    HUD --> Tiles & ModalGPS & ModalHist
    TE --> LocalAnalytics --> AIProxy
```

---

## 2. Layer Responsibilities

### 2.1 Hardware & Native Sensor Layer
- Captures raw NMEA / GNSS satellite positions and speeds.
- Emits foreground coordinate streams while app is focused.
- Triggers background headless task via `expo-task-manager` and Android foreground service when app is backgrounded or screen is locked.

### 2.2 Core Tracking Engine Layer
- **Singleton Authority**: `TrackingEngine` holds the single source of truth for distance, active duration, status, speed, and splits.
- **Deduplication Guard**: Compares incoming coordinate timestamps against `lastProcessedTimestamp` to guarantee points from concurrent streams are processed exactly once.
- **Stateful Acceptance Pipeline**: Sequentially validates coordinates, filters stationary drift, enforces distance movement thresholds, and detects km milestones.
- **Active Elapsed Time**: Measures wall-clock time minus total paused milliseconds.

### 2.3 Presentation Layer
- **Zero Live Map**: Strictly minimal OLED dark UI built with NativeWind.
- **Tabular Synchronization**: Uses React's `useSyncExternalStore` to subscribe directly to `TrackingEngine`, achieving tear-free 60fps telemetry updates without unnecessary React re-renders.
- **GPS Gatekeeper**: Hardware status lock prevents starting a run with inadequate accuracy or missing permissions.

### 2.4 Intelligence Layer
- **Deterministic First**: Computes running metrics, split variances, personal records, and pacing trends locally in pure TypeScript.
- **AI Optional**: Dispatches post-run aggregated workout summaries to an optional, asynchronous AI coaching agent without ever blocking active tracking.
