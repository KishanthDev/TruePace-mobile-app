This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## TruePace Project Requirements & Architecture

- **App Name**: TruePace
- **Design Philosophy**: Minimalist, distraction-free HUD. No live map rendering during run to maximize battery life, screen clarity, and performance. OLED black palette with bold high-contrast tabular typography.
- **Precision Tracking Engine**:
  - Use `expo-location` with high accuracy (`Accuracy.BestForNavigation` / `Accuracy.High`).
  - **Distance Method**: Haversine distance formula with Earth radius $R = 6,371,000\text{ m}$.
  - **Separation of Concerns**: Separate raw GPS readings (`lastGpsReadingRef`) from accepted distance anchors (`lastAcceptedCoordRef`, `lastAcceptedTimestampRef`, `accumulatedDistanceRef`, `isPausedRef`). A GPS point can be validly received but rejected for distance.
  - **GPS Accuracy Filtering**: Configurable horizontal accuracy threshold (`GPS_ACCURACY_THRESHOLD_METERS = 15`, fallback ~20m). Reject coordinates when accuracy is null, undefined, $\le 0$, or exceeds threshold.
  - **Stateful Acceptance Algorithm** (No simple AND/OR rules):
    1. Validate estimated horizontal accuracy.
    2. Validate timestamps (reject non-positive, duplicate, or out-of-order readings).
    3. Check pause state (never accumulate distance while paused).
    4. Handle tracking gaps (`MAX_GPS_GAP_SECONDS = 15s`): Re-establish anchor without inventing straight-line distance across gaps.
    5. Implied speed validation (`impliedSpeed = deltaMeters / elapsedSeconds`): Reject impossible teleportation jumps ($> 8.0\text{ m/s} \approx 28.8\text{ km/h}$).
    6. Minimum movement threshold (`MIN_DISTANCE_DELTA_METERS = 2.0\text{m}`): Do NOT update anchor when below threshold so slow genuine movement builds up over time without Zeno truncation.
    7. Stationary drift protection: Combine native Doppler speed, implied speed, and elapsed time to suppress stationary GPS jitter and oscillations.
    8. Strict Anchor Rule: `lastAcceptedCoordRef` is ONLY updated when a point is accepted for distance. Rejected points never move the anchor.
  - **Pause/Resume Behavior**: Pausing clears `lastAcceptedCoordRef` and `lastAcceptedTimestampRef`. Resuming establishes a fresh anchor on the first accurate post-resume reading, completely excluding any distance traveled while paused.
  - **Doppler Speed Synergy**: Native GNSS Doppler speed (`coords.speed`) is used for instantaneous pace, telemetry, and movement confidence, but coordinate distance remains the primary authority for total session distance.
  - **Active Elapsed Time**: Stopwatch timer and average pace calculations strictly count active running seconds, excluding paused intervals.
  - **Diagnostic Telemetry**: Track rejection reasons (`INVALID_ACCURACY`, `LOW_ACCURACY`, `GPS_JITTER`, `IMPOSSIBLE_SPEED`, `INVALID_TIMESTAMP`, `PAUSED`, `GPS_GAP`, `STATIONARY_DRIFT`).
  - **Local Cache**: Save completed runs to local persistent storage for history view.
  - **GPS Gatekeeper**: "START RUN" is hard-locked in "WAITING FOR GPS" state until device location services are enabled, permissions granted, and satellite accuracy is verified. Tapping while locked triggers the GpsAlertModal with direct resolution pathways.


