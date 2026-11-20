# TruePace — Device & Platform Validation Protocol

## 1. Supported Hardware Profiles

TruePace must be validated across the following hardware tiers:

1. **Tier A (Modern High-End)**: Android 13–15 / iPhone 13–16 (OLED, Dual-Frequency GNSS L1/L5).
2. **Tier B (Mid-Range)**: Android 11–12 (OLED or IPS LCD, Single-Frequency GNSS L1).
3. **Tier C (Constrained / Legacy)**: Android 10 (Strict battery killer managers, e.g. Xiaomi MIUI / Samsung OneUI background limits).

---

## 2. Platform-Specific Verification Checklists

### 2.1 Android Checklist
- [ ] **Foreground Service**: Does the notification persist when the app is swiped away from Recents while tracking?
- [ ] **Notification Channel**: Is the channel set to `LOW` importance so updates do not buzz or vibrate?
- [ ] **Lock Screen Visibility**: Does the notification display public live telemetry on the secure lock screen?
- [ ] **Power Management Exemption**: Does the app handle manufacturer-specific background task killers?
- [ ] **Audio Focus**: Do `expo-speech` cues duck or pause background music gracefully?

### 2.2 iOS Checklist
- [ ] **Blue Status Bar Indicator**: Does the native background location indicator appear when backgrounded?
- [ ] **Keep Awake**: Does the screen stay awake during active tracking without unexpected dimming?
- [ ] **Lock Screen Live Activity / Notification**: Does the app handle lock-screen state transitions smoothly?
- [ ] **Dynamic Island / Safe Insets**: Do notch and pill cutouts avoid clipping the HUD telemetry?

---

## 3. Discrepancy Reporting Protocol
When testing on physical hardware, record:
- Device Model, OS Version, and Build ID.
- Satellite constellation status (GPS/GLONASS/Galileo lock time).
- Battery percentage delta over 30 minutes.
- Any background task suspension or notification freeze.
