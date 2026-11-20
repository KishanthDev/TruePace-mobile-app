# TruePace — Security, Privacy & Data Protection

## 1. Threat Modeling & Threat Vectors

| Threat Vector | Risk Level | Mitigation in TruePace |
| :--- | :---: | :--- |
| **Location Data Leaks** | **CRITICAL** | Raw GPS coordinates are stored strictly on the local device in sandboxed app storage. Coordinates are never transmitted to third parties, analytics providers, or AI services. |
| **Client API Key Exposure** | **HIGH** | No external proprietary API tokens are bundled into client APK/IPA binaries. Any optional cloud capabilities authenticate through serverless edge proxies or secure athlete-provided keys. |
| **Silent Tracking / Stalking** | **HIGH** | Transparent persistent notifications are mandatory on Android and iOS whenever location services or background tasks are active. The HUD clearly displays `TRACKING` status. |
| **Data Loss via Cold Eviction** | **MEDIUM** | Snapshot persistence to AsyncStorage occurs on every accepted coordinate, ensuring state survives process death. |

---

## 2. Privacy Principles

1. **Local-Only by Default**: All workout history, personal records, and settings remain on the athlete's device.
2. **Opt-In AI & Cloud Sync**: Data export (GPX, Strava, AI coaching) requires explicit user action.
3. **Anonymized Telemetry for AI**: If the runner requests AI coaching analysis, the payload is sanitized to include only derived scalar numbers (distance, split seconds, pace variances) with zero geographic coordinate points.
4. **Permanent Local Erasure**: Runners can purge individual runs or wipe the entire cache at any time with a single tap.

---

## 3. Platform Permission Strategy

- **Android**:
  - `ACCESS_FINE_LOCATION`: Required for GPS coordinate precision.
  - `ACCESS_BACKGROUND_LOCATION`: Required to sustain run tracking when phone screen is locked.
  - `FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_LOCATION`: Android 14+ mandatory foreground service declaration.
  - `POST_NOTIFICATIONS`: Android 13+ permission for lock-screen live HUD updates.
- **iOS**:
  - `NSLocationWhenInUseUsageDescription`: Clear explanation for live HUD pace calculations.
  - `NSLocationAlwaysAndWhenInUseUsageDescription`: Clear explanation for screen-lock continuity.
  - `UIBackgroundModes: ["location"]`: Background audio and GPS processing.
