# TruePace — Data Architecture & Persistence Specification

## 1. Local Storage Keys & Schemas

TruePace is an offline-first mobile platform utilizing `@react-native-async-storage/async-storage` for local persistence.

### 1.1 Active Session Snapshot
- **Key**: `@truepace_active_run_v1`
- **Purpose**: Real-time checkpoint to survive app suspension, OS low-memory termination, and cold restarts.
- **Update Frequency**: Saved on every accepted coordinate point and on status changes (start, pause, resume).
- **Schema**:
```typescript
interface PersistedActiveSession {
  status: 'idle' | 'tracking' | 'paused' | 'finished';
  startTime: number;              // Epoch ms
  totalPausedMs: number;          // Accumulated pause duration in ms
  pauseStartTime: number | null;  // Timestamp when current pause began
  accumulatedDistance: number;    // Distance in meters
  lastAcceptedCoord: GpsCoordinate | null;
  lastAcceptedTimestamp: number | null;
  maxSpeedMps: number;
  lastKilometerMilestone: number;
  totalValidPoints: number;
  splits: number[];               // Active seconds per km split
  splitStartActiveSeconds: number;// Active elapsed seconds at start of split
}
```

### 1.2 Run History Cache
- **Key**: `@truepace_run_history_v1` (to be migrated to `@truepace_run_history_v2` in Phase 1)
- **Purpose**: Completed workouts list for the local history screen and analytics aggregation.
- **Schema**:
```typescript
interface RunSummary {
  id: string;                     // Unique identifier `${startTime}_${random}`
  startTime: number;              // Epoch ms
  endTime: number;                // Epoch ms
  durationSeconds: number;        // Active moving time only
  distanceMeters: number;
  avgPaceSecondsPerKm: number | null;
  bestPaceSecondsPerKm: number | null;
  maxSpeedMps: number;
  splits?: number[];              // Array of split durations in seconds
  // Phase 1 Extensions:
  consistencyIndex?: number;      // Split variance score (0-100)
  elevationGainMeters?: number;   // Cumulative ascent
  cadenceAvg?: number;            // Steps per minute
}
```

### 1.3 Athlete Preferences
- **Audio Voice Coach**: `@truepace_audio_cues_enabled_v1` (`'true' | 'false'`)
- **Unit Preference (Phase 2)**: `@truepace_unit_preference_v1` (`'metric' | 'imperial'`)
- **Target Pace (Phase 2)**: `@truepace_target_pace_v1` (Target seconds per km)

---

## 2. Migration & Schema Versioning Strategy

1. **Explicit Version Keys**: Every storage key includes a version suffix (e.g. `_v1`, `_v2`).
2. **Non-Destructive Migrations**: When schema changes occur, a migration runner detects legacy keys, reads the payload, applies transformation defaults, writes to the new key, and preserves the legacy key as a rollback backup until verified.
3. **Defensive Parsing & Fallbacks**: All JSON reads must be wrapped in error boundaries with schema verification (defensive defaults for missing array or number fields). Never allow malformed data to crash the app.
4. **Storage Pruning Guard**: AsyncStorage on Android has a soft 6MB ceiling by default. Workout history records only summary telemetry and splits (approx. 500 bytes per run). 1,000 workouts consume $< 0.5\text{ MB}$, well within safe limits.
