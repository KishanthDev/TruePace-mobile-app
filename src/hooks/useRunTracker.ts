import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Haptics from 'expo-haptics';
import {
  GpsCoordinate,
  GpsDiagnosticLog,
  GpsIssueReason,
  GpsPointRejectionReason,
  RunStatus,
  RunSummary,
  TrackingTelemetry,
} from '../types/tracking';
import {
  calculateHaversineDistance,
  isValidGpsPoint,
  speedToPace,
  calculateAveragePace,
  MIN_DISTANCE_DELTA_METERS,
  GPS_ACCURACY_THRESHOLD_METERS,
  GPS_ACCURACY_FALLBACK_THRESHOLD_METERS,
  MAX_REASONABLE_RUNNING_SPEED_MPS,
  MAX_GPS_GAP_SECONDS,
} from '../utils/geo';
import { saveRunSummary } from '../utils/storage';
import {
  LOCATION_TASK_NAME,
  setLocationUpdateHandler,
} from '../tasks/locationTask';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Rolling speed buffer size for median best-pace protection (Fix 6) */
const SPEED_BUFFER_SIZE = 5;

/** Consecutive LOW_ACCURACY rejections before relaxing to fallback threshold (Fix 5) */
const ADAPTIVE_ACCURACY_TRIGGER = 5;

/** Doppler speed ≈ 0 but implied speed clearly running → override stationary guard (Fix 3) */
const DOPPLER_ZERO_IMPLIED_OVERRIDE_MPS = 1.0;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRunTracker() {
  // ── React state (UI-facing) ──────────────────────────────────────────────────
  const [status, setStatus] = useState<RunStatus>('idle');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLocationServicesEnabled, setIsLocationServicesEnabled] = useState<boolean>(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [currentSpeedMps, setCurrentSpeedMps] = useState(0);
  const [currentPace, setCurrentPace] = useState<number | null>(null);
  const [avgPace, setAvgPace] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isGpsAccurate, setIsGpsAccurate] = useState(false);
  const [totalPointsCount, setTotalPointsCount] = useState(0);
  const [lastFinishedRun, setLastFinishedRun] = useState<RunSummary | null>(null);
  const [lastRejectionReason, setLastRejectionReason] = useState<GpsPointRejectionReason>(null);
  const [lastDiagnosticLog, setLastDiagnosticLog] = useState<GpsDiagnosticLog | null>(null);

  // ── Ref: status mirror (avoids stale closure in callbacks) ──────────────────
  const statusRef = useRef<RunStatus>('idle');
  statusRef.current = status;

  // ── Refs: GPS anchor state ───────────────────────────────────────────────────
  // lastGpsReadingRef   — latest received raw GPS fix (always updated)
  // lastAcceptedCoordRef — last anchor accepted for distance (NEVER updated on reject)
  // lastAcceptedTimestampRef — timestamp of that anchor
  // accumulatedDistanceRef — session running total
  // isPausedRef — synchronous pause flag (ref, not state, for callback visibility)
  const lastGpsReadingRef = useRef<GpsCoordinate | null>(null);
  const lastAcceptedCoordRef = useRef<GpsCoordinate | null>(null);
  const lastAcceptedTimestampRef = useRef<number | null>(null);
  const accumulatedDistanceRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);

  // ── Refs: wall-clock elapsed time (Fix 2) ───────────────────────────────────
  // Elapsed time is derived from wall clock, not setInterval ticks, to prevent drift.
  const startTimeRef = useRef<number>(0);
  const totalPausedMsRef = useRef<number>(0);   // cumulative paused milliseconds
  const pauseStartTimeRef = useRef<number | null>(null); // wall-clock ms when current pause began
  const elapsedSecondsRef = useRef<number>(0);  // last computed active elapsed seconds

  // ── Refs: pace & speed ──────────────────────────────────────────────────────
  const recentPointsRef = useRef<GpsCoordinate[]>([]); // 10-second rolling window for pace fallback
  const speedBufferRef = useRef<number[]>([]);          // rolling Doppler buffer for median max speed (Fix 6)
  const maxSpeedRef = useRef<number>(0);                // median-protected peak speed
  const lastKilometerMilestoneRef = useRef<number>(0);

  // ── Refs: adaptive accuracy state (Fix 5) ───────────────────────────────────
  const consecutiveLowAccuracyRef = useRef<number>(0);

  // ── Refs: subscriptions & timer ─────────────────────────────────────────────
  // preWarmSubscriptionRef — foreground watchPositionAsync used during idle GPS display
  const preWarmSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────

  const checkLocationServices = useCallback(async (): Promise<boolean> => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      setIsLocationServicesEnabled(enabled);
      return enabled;
    } catch {
      return true;
    }
  }, []);

  // ── Timer: wall-clock elapsed (Fix 2) ───────────────────────────────────────
  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      if (statusRef.current === 'tracking') {
        // Wall-clock calculation — immune to setInterval drift and JS event-loop delay
        const now = Date.now();
        const activeMs = now - startTimeRef.current - totalPausedMsRef.current;
        const newElapsed = Math.floor(activeMs / 1000);
        elapsedSecondsRef.current = newElapsed;
        setElapsedSeconds(newElapsed);

        const computedAvg = calculateAveragePace(newElapsed, accumulatedDistanceRef.current);
        setAvgPace(computedAvg);
      }
    }, 1000);
  };

  // ── GPS subscriptions ────────────────────────────────────────────────────────

  const stopPreWarmWatch = () => {
    if (preWarmSubscriptionRef.current) {
      preWarmSubscriptionRef.current.remove();
      preWarmSubscriptionRef.current = null;
    }
  };

  /**
   * Evaluates rolling pace across the last 10 seconds of valid points.
   * Fallback when Doppler speed is unavailable.
   */
  const computeRollingPace = (recentPoints: GpsCoordinate[]): number | null => {
    if (recentPoints.length < 2) return null;
    const oldest = recentPoints[0];
    const newest = recentPoints[recentPoints.length - 1];
    const timeDeltaSeconds = (newest.timestamp - oldest.timestamp) / 1000;
    if (timeDeltaSeconds < 2) return null;

    let totalDist = 0;
    for (let i = 1; i < recentPoints.length; i++) {
      totalDist += calculateHaversineDistance(
        recentPoints[i - 1].latitude,
        recentPoints[i - 1].longitude,
        recentPoints[i].latitude,
        recentPoints[i].longitude
      );
    }

    if (totalDist < 3) return null; // stationary drift in buffer
    const speed = totalDist / timeDeltaSeconds;
    return speedToPace(speed);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Core GPS update handler — shared between foreground watch and background task
  //
  // Acceptance pipeline (stateful, strictly ordered):
  //   1. INVALID_ACCURACY  – null / ≤0 accuracy
  //   2. LOW_ACCURACY      – exceeds threshold (adaptive fallback after 5 consecutive)
  //   3. PAUSED            – tracking paused
  //   4. INVALID_TIMESTAMP – missing / NaN / out-of-order
  //   5. Establish anchor  – first point after start / resume / gap
  //   6. GPS_GAP           – gap > 15s: re-anchor, clear pace buffer (Fix 4)
  //   7. IMPOSSIBLE_SPEED  – implied speed > 8 m/s (teleportation)
  //   8. GPS_JITTER        – delta < 2m: anchor stable, movement accumulates
  //   9. STATIONARY_DRIFT  – combined Doppler + implied speed check
  //      FIX 3: if Doppler ≈ 0 but implied > 1 m/s → override, trust coordinates
  //  10. ACCEPT            – update anchor, accumulate distance
  // ────────────────────────────────────────────────────────────────────────────
  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    const coord: GpsCoordinate = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: location.timestamp,
    };

    lastGpsReadingRef.current = coord;

    const rawSpeed = coord.speed !== null && coord.speed >= 0 ? coord.speed : null;

    // Update rolling Doppler speed buffer (Fix 6 — median max speed protection)
    if (rawSpeed !== null) {
      speedBufferRef.current = [...speedBufferRef.current, rawSpeed].slice(-SPEED_BUFFER_SIZE);
    }

    /** Emit structured diagnostic log and update rejection state */
    const recordDiagnostic = (
      accepted: boolean,
      rejectionReason: GpsPointRejectionReason,
      distFromAnchor: number | null,
      dt: number | null,
      impSpd: number | null
    ) => {
      const log: GpsDiagnosticLog = {
        latitude: coord.latitude,
        longitude: coord.longitude,
        accuracy: coord.accuracy,
        timestamp: coord.timestamp,
        distanceFromAnchor: distFromAnchor,
        elapsedSeconds: dt,
        impliedSpeed: impSpd,
        nativeGpsSpeed: rawSpeed,
        accepted,
        rejectionReason,
        accumulatedDistance: accumulatedDistanceRef.current,
      };
      setLastRejectionReason(rejectionReason);
      setLastDiagnosticLog(log);
    };

    // ── Step 1: INVALID_ACCURACY ─────────────────────────────────────────────
    if (coord.accuracy === null || coord.accuracy === undefined || coord.accuracy <= 0) {
      setIsGpsAccurate(false);
      setGpsAccuracy(coord.accuracy);
      consecutiveLowAccuracyRef.current = 0;
      recordDiagnostic(false, 'INVALID_ACCURACY', null, null, null);
      return;
    }

    setGpsAccuracy(coord.accuracy);

    // ── Step 2: LOW_ACCURACY with adaptive fallback (Fix 5) ─────────────────
    const isPreferredAccurate = isValidGpsPoint(coord, GPS_ACCURACY_THRESHOLD_METERS);
    let effectivelyAccurate = isPreferredAccurate;

    if (!isPreferredAccurate) {
      consecutiveLowAccuracyRef.current++;
      // Relax to fallback threshold only during active tracking after 5 bad reads
      if (
        statusRef.current === 'tracking' &&
        consecutiveLowAccuracyRef.current >= ADAPTIVE_ACCURACY_TRIGGER
      ) {
        effectivelyAccurate = isValidGpsPoint(coord, GPS_ACCURACY_FALLBACK_THRESHOLD_METERS);
      }
      if (!effectivelyAccurate) {
        setIsGpsAccurate(false);
        recordDiagnostic(false, 'LOW_ACCURACY', null, null, null);
        return;
      }
      // Accepted via fallback — don't reset streak so relaxed mode persists
    } else {
      consecutiveLowAccuracyRef.current = 0; // Good signal — reset adaptive streak
    }

    setIsGpsAccurate(effectivelyAccurate);

    // ── Step 3: PAUSED ───────────────────────────────────────────────────────
    if (isPausedRef.current || statusRef.current === 'paused') {
      setCurrentSpeedMps(0);
      setCurrentPace(null);
      recordDiagnostic(false, 'PAUSED', null, null, null);
      return;
    }

    // Not tracking (idle / finished) — only GPS display is needed, no distance
    if (statusRef.current !== 'tracking') {
      return;
    }

    // ── Step 4: INVALID_TIMESTAMP ────────────────────────────────────────────
    if (!coord.timestamp || isNaN(coord.timestamp) || coord.timestamp <= 0) {
      recordDiagnostic(false, 'INVALID_TIMESTAMP', null, null, null);
      return;
    }

    if (
      lastAcceptedTimestampRef.current !== null &&
      coord.timestamp <= lastAcceptedTimestampRef.current
    ) {
      recordDiagnostic(false, 'INVALID_TIMESTAMP', null, null, null);
      return;
    }

    // ── Update rolling pace buffer (all accuracy/timestamp-valid points) ─────
    const now = coord.timestamp;
    recentPointsRef.current = [
      ...recentPointsRef.current.filter((p) => now - p.timestamp <= 10000),
      coord,
    ];

    // ── Instantaneous pace: Doppler first, rolling fallback second ───────────
    let calculatedPace = speedToPace(rawSpeed);
    if (calculatedPace === null && rawSpeed === null) {
      calculatedPace = computeRollingPace(recentPointsRef.current);
    }
    setCurrentSpeedMps(rawSpeed ?? 0);
    setCurrentPace(calculatedPace);

    // ── Update median max speed (Fix 6) ──────────────────────────────────────
    if (speedBufferRef.current.length >= 3) {
      const sorted = [...speedBufferRef.current].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (median > maxSpeedRef.current) {
        maxSpeedRef.current = median;
      }
    }

    // ── Step 5: Establish initial anchor ────────────────────────────────────
    if (lastAcceptedCoordRef.current === null || lastAcceptedTimestampRef.current === null) {
      lastAcceptedCoordRef.current = coord;
      lastAcceptedTimestampRef.current = coord.timestamp;
      setTotalPointsCount((prev) => prev + 1);
      recordDiagnostic(true, null, 0, 0, 0);
      return;
    }

    // ── Step 6: GPS_GAP + clear stale pace buffer (Fix 4) ───────────────────
    const elapsedFromAnchorSeconds = (coord.timestamp - lastAcceptedTimestampRef.current) / 1000;

    if (elapsedFromAnchorSeconds > MAX_GPS_GAP_SECONDS) {
      // Clear stale rolling pace buffer — prevents fake pace spike after tunnel exit
      recentPointsRef.current = [];
      lastAcceptedCoordRef.current = coord;
      lastAcceptedTimestampRef.current = coord.timestamp;
      recordDiagnostic(false, 'GPS_GAP', null, elapsedFromAnchorSeconds, null);
      return;
    }

    // ── Step 7: Haversine distance + implied speed ───────────────────────────
    const deltaMeters = calculateHaversineDistance(
      lastAcceptedCoordRef.current.latitude,
      lastAcceptedCoordRef.current.longitude,
      coord.latitude,
      coord.longitude
    );

    const impliedSpeed = deltaMeters / elapsedFromAnchorSeconds;

    // IMPOSSIBLE_SPEED: coordinate jump implies > 8 m/s (multipath / tower handoff)
    if (impliedSpeed > MAX_REASONABLE_RUNNING_SPEED_MPS) {
      recordDiagnostic(false, 'IMPOSSIBLE_SPEED', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // ── Step 8: GPS_JITTER — anchor stable, slow movement builds up ──────────
    if (deltaMeters < MIN_DISTANCE_DELTA_METERS) {
      // Anchor intentionally NOT updated — genuine slow movement accumulates
      // across multiple GPS ticks until it crosses the 2m threshold.
      recordDiagnostic(false, 'GPS_JITTER', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // ── Step 9: STATIONARY_DRIFT protection ──────────────────────────────────
    let isStationary = false;

    if (rawSpeed !== null) {
      // Doppler speed is available
      if (rawSpeed < 0.35) {
        // Fix 3: Doppler reports stationary, but check if coordinates clearly
        // show movement (common on budget GNSS chipsets that output stale 0 m/s)
        if (impliedSpeed > DOPPLER_ZERO_IMPLIED_OVERRIDE_MPS) {
          // Coordinate-derived evidence overrides stale Doppler zero
          isStationary = false;
        } else {
          isStationary = true;
        }
      } else if (rawSpeed < 0.5 && impliedSpeed < 0.4) {
        isStationary = true;
      }
    } else {
      // Doppler unavailable — rely on implied speed alone
      if (impliedSpeed < 0.35) {
        isStationary = true;
      }
    }

    if (isStationary) {
      recordDiagnostic(false, 'STATIONARY_DRIFT', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // ── Step 10: ACCEPT — accumulate distance, advance anchor ────────────────
    accumulatedDistanceRef.current += deltaMeters;
    lastAcceptedCoordRef.current = coord;
    lastAcceptedTimestampRef.current = coord.timestamp;

    setDistanceMeters(accumulatedDistanceRef.current);
    setTotalPointsCount((prev) => prev + 1);
    recordDiagnostic(true, null, deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);

    // Kilometer milestone haptic
    const currentKm = Math.floor(accumulatedDistanceRef.current / 1000);
    if (currentKm > lastKilometerMilestoneRef.current) {
      lastKilometerMilestoneRef.current = currentKm;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // GPS Watch Management
  //
  // Pre-warm (idle state): lightweight watchPositionAsync — fires handleLocationUpdate
  //   for GPS accuracy display; status !== 'tracking' blocks distance accumulation.
  //
  // Active tracking: startLocationUpdatesAsync (Fix 1 — background capable) —
  //   continues firing when screen locks via the module-level task handler in
  //   src/tasks/locationTask.ts.
  // ────────────────────────────────────────────────────────────────────────────

  /** Start foreground pre-warm watch (idle GPS accuracy display only) */
  const startPreWarmWatch = useCallback(async () => {
    if (preWarmSubscriptionRef.current) return;
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        handleLocationUpdate
      );
      preWarmSubscriptionRef.current = sub;
    } catch (err) {
      console.warn('[TruePace] Pre-warm GPS watch error:', err);
    }
  }, [handleLocationUpdate]);

  /**
   * Start background-capable location tracking (Fix 1).
   *
   * Uses startLocationUpdatesAsync which:
   *  - Continues firing when screen is locked (Android + iOS background mode)
   *  - Shows a persistent notification on Android (foreground service)
   *  - Falls back to watchPositionAsync on Expo Go / unsupported environments
   */
  const startBackgroundWatch = useCallback(async () => {
    const canBackground = await TaskManager.isAvailableAsync().catch(() => false);

    if (canBackground) {
      // Register the module-level handler so the background task can reach our callback
      setLocationUpdateHandler(handleLocationUpdate);

      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (!alreadyRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
          // Android: foreground service notification keeps tracking alive
          foregroundService: {
            notificationTitle: 'TruePace — Recording',
            notificationBody: 'Tracking your active run',
            notificationColor: '#22c55e',
          },
          // iOS: activityType optimises GPS for fitness use, conserving battery
          activityType: Location.ActivityType.Fitness,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
        });
      }
    } else {
      // Expo Go / simulator — fall back to foreground-only watch
      console.warn('[TruePace] Background tasks unavailable — foreground-only tracking');
      await startPreWarmWatch();
    }
  }, [handleLocationUpdate, startPreWarmWatch]);

  /** Stop background location task and clear module handler */
  const stopBackgroundWatch = useCallback(async () => {
    setLocationUpdateHandler(null);
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    }
  }, []);

  // ── Boot: check permissions and start pre-warm GPS ───────────────────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await checkLocationServices();
        const { status: permStatus } = await Location.getForegroundPermissionsAsync();
        if (isMounted) {
          const granted = permStatus === 'granted';
          setHasPermission(granted);
          if (granted) {
            await startPreWarmWatch();
          }
        }
      } catch (err) {
        console.warn('[TruePace] Boot permission check error:', err);
        if (isMounted) setHasPermission(false);
      }
    })();

    return () => {
      isMounted = false;
      // Stop foreground pre-warm watch on unmount.
      // Background task is NOT stopped here — it keeps running while tracking is active.
      stopPreWarmWatch();
      setLocationUpdateHandler(null);
      stopTimer();
    };
  }, [checkLocationServices, startPreWarmWatch]);

  // ── Permission request ────────────────────────────────────────────────────────
  const requestPermission = async (): Promise<boolean> => {
    try {
      const servicesEnabled = await checkLocationServices();
      if (!servicesEnabled) return false;

      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      const granted = permStatus === 'granted';
      setHasPermission(granted);

      if (granted) {
        // Best-effort request for background / "Always Allow" permission.
        // The user may decline — foreground tracking still works.
        await Location.requestBackgroundPermissionsAsync().catch(() => {});
        await startPreWarmWatch();
      }
      return granted;
    } catch (err) {
      console.warn('[TruePace] Permission request error:', err);
      setHasPermission(false);
      return false;
    }
  };

  // ── GPS readiness derivation ──────────────────────────────────────────────────
  let gpsIssueReason: GpsIssueReason = null;
  if (!isLocationServicesEnabled) {
    gpsIssueReason = 'services_disabled';
  } else if (hasPermission === false) {
    gpsIssueReason = 'permission_denied';
  } else if (gpsAccuracy === null) {
    gpsIssueReason = 'acquiring';
  } else if (gpsAccuracy > GPS_ACCURACY_THRESHOLD_METERS) {
    gpsIssueReason = 'weak_signal';
  }

  const isGpsReady =
    isLocationServicesEnabled &&
    hasPermission === true &&
    isGpsAccurate &&
    gpsAccuracy !== null &&
    gpsAccuracy <= GPS_ACCURACY_THRESHOLD_METERS;

  // ────────────────────────────────────────────────────────────────────────────
  // Run lifecycle
  // ────────────────────────────────────────────────────────────────────────────

  const startRun = async (): Promise<{ success: boolean; reason?: GpsIssueReason }> => {
    const servicesEnabled = await checkLocationServices();
    if (!servicesEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return { success: false, reason: 'services_disabled' };
    }

    let perm = hasPermission;
    if (!perm) {
      perm = await requestPermission();
      if (!perm) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return { success: false, reason: 'permission_denied' };
      }
    }

    if (gpsAccuracy === null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return { success: false, reason: 'acquiring' };
    }

    if (gpsAccuracy > GPS_ACCURACY_THRESHOLD_METERS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return { success: false, reason: 'weak_signal' };
    }

    // Switch from foreground pre-warm to background-capable tracking (Fix 1)
    stopPreWarmWatch();
    await startBackgroundWatch();

    // Reset all session state
    accumulatedDistanceRef.current = 0;
    elapsedSecondsRef.current = 0;
    lastKilometerMilestoneRef.current = 0;
    maxSpeedRef.current = 0;
    lastGpsReadingRef.current = null;
    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;
    isPausedRef.current = false;
    recentPointsRef.current = [];
    speedBufferRef.current = [];
    consecutiveLowAccuracyRef.current = 0;

    // Wall-clock timer reset (Fix 2)
    startTimeRef.current = Date.now();
    totalPausedMsRef.current = 0;
    pauseStartTimeRef.current = null;

    setDistanceMeters(0);
    setElapsedSeconds(0);
    setCurrentPace(null);
    setAvgPace(null);
    setCurrentSpeedMps(0);
    setTotalPointsCount(0);
    setLastFinishedRun(null);
    setLastRejectionReason(null);
    setLastDiagnosticLog(null);

    setStatus('tracking');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    startTimer();
    return { success: true };
  };

  const pauseRun = () => {
    // Wall-clock: record when pause began (Fix 2)
    pauseStartTimeRef.current = Date.now();

    setStatus('paused');
    isPausedRef.current = true;

    // Clear accepted anchor — post-resume will establish a clean fresh anchor
    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;

    setCurrentPace(null);
    setCurrentSpeedMps(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const resumeRun = () => {
    // Wall-clock: accumulate the time spent paused (Fix 2)
    if (pauseStartTimeRef.current !== null) {
      totalPausedMsRef.current += Date.now() - pauseStartTimeRef.current;
      pauseStartTimeRef.current = null;
    }

    setStatus('tracking');
    isPausedRef.current = false;

    // Clear anchor — first post-resume GPS reading becomes the new anchor
    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;

    // Clear stale rolling pace (no stale pre-pause pace shown after resume)
    recentPointsRef.current = [];

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const finishRun = async (): Promise<RunSummary | null> => {
    stopTimer();

    // Final wall-clock elapsed: freeze active seconds at the moment finish is tapped
    if (pauseStartTimeRef.current !== null) {
      totalPausedMsRef.current += Date.now() - pauseStartTimeRef.current;
      pauseStartTimeRef.current = null;
    }
    const finalDuration = elapsedSecondsRef.current;
    const finalDistance = accumulatedDistanceRef.current;

    // Stop background tracking and return to foreground pre-warm (Fix 1)
    await stopBackgroundWatch();
    await startPreWarmWatch();

    const summary: RunSummary = {
      id: `${startTimeRef.current}_${Math.random().toString(36).substring(2, 7)}`,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      durationSeconds: finalDuration,
      distanceMeters: finalDistance,
      avgPaceSecondsPerKm: calculateAveragePace(finalDuration, finalDistance),
      bestPaceSecondsPerKm: speedToPace(maxSpeedRef.current),
      maxSpeedMps: maxSpeedRef.current,
    };

    setStatus('finished');
    setLastFinishedRun(summary);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (finalDistance >= 20) {
      await saveRunSummary(summary);
    }

    return summary;
  };

  const resetRun = async () => {
    stopTimer();

    // Stop any background tracking that may still be running
    await stopBackgroundWatch();
    await startPreWarmWatch();

    setStatus('idle');
    isPausedRef.current = false;
    setElapsedSeconds(0);
    setDistanceMeters(0);
    setCurrentPace(null);
    setAvgPace(null);
    setCurrentSpeedMps(0);
    setTotalPointsCount(0);
    setLastFinishedRun(null);
    setLastRejectionReason(null);
    setLastDiagnosticLog(null);

    accumulatedDistanceRef.current = 0;
    elapsedSecondsRef.current = 0;
    lastGpsReadingRef.current = null;
    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;
    recentPointsRef.current = [];
    speedBufferRef.current = [];
    maxSpeedRef.current = 0;
    totalPausedMsRef.current = 0;
    pauseStartTimeRef.current = null;
    consecutiveLowAccuracyRef.current = 0;
  };

  // ── Telemetry bundle ─────────────────────────────────────────────────────────
  const telemetry: TrackingTelemetry = {
    status,
    elapsedSeconds,
    distanceMeters,
    currentPaceSecondsPerKm: currentPace,
    avgPaceSecondsPerKm: avgPace,
    currentSpeedMps,
    gpsAccuracyMeters: gpsAccuracy,
    isGpsAccurate,
    isGpsReady,
    gpsIssueReason,
    totalValidPoints: totalPointsCount,
    lastRejectionReason,
    lastDiagnosticLog,
  };

  return {
    telemetry,
    hasPermission,
    lastFinishedRun,
    checkLocationServices,
    requestPermission,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    resetRun,
  };
}
