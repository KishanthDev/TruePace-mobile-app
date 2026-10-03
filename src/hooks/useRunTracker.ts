import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
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

// ─── Environment Detection ───────────────────────────────────────────────────

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';
const isAndroidExpoGo = isExpoGo && Platform.OS === 'android';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Rolling speed buffer size for median best-pace protection */
const SPEED_BUFFER_SIZE = 5;

/** Consecutive LOW_ACCURACY rejections before relaxing to fallback threshold */
const ADAPTIVE_ACCURACY_TRIGGER = 5;

/** Doppler speed ≈ 0 but implied speed clearly running → override stationary guard */
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
  const lastGpsReadingRef = useRef<GpsCoordinate | null>(null);
  const lastAcceptedCoordRef = useRef<GpsCoordinate | null>(null);
  const lastAcceptedTimestampRef = useRef<number | null>(null);
  const accumulatedDistanceRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);

  // ── Refs: wall-clock elapsed time ───────────────────────────────────────────
  const startTimeRef = useRef<number>(0);
  const totalPausedMsRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef<number>(0);

  // ── Refs: pace & speed ──────────────────────────────────────────────────────
  const recentPointsRef = useRef<GpsCoordinate[]>([]);
  const speedBufferRef = useRef<number[]>([]);
  const maxSpeedRef = useRef<number>(0);
  const lastKilometerMilestoneRef = useRef<number>(0);

  // ── Refs: adaptive accuracy state ───────────────────────────────────────────
  const consecutiveLowAccuracyRef = useRef<number>(0);

  // ── Refs: subscriptions & timer ─────────────────────────────────────────────
  const foregroundSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const isBackgroundTrackingActiveRef = useRef<boolean>(false);
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

  // ── Timer: wall-clock elapsed ───────────────────────────────────────────────
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

  /**
   * Evaluates rolling pace across the last 10 seconds of valid points.
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

    if (totalDist < 3) return null;
    const speed = totalDist / timeDeltaSeconds;
    return speedToPace(speed);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Core GPS update handler — shared between foreground watch and background task
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

    if (rawSpeed !== null) {
      speedBufferRef.current = [...speedBufferRef.current, rawSpeed].slice(-SPEED_BUFFER_SIZE);
    }

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

    // ── Step 2: LOW_ACCURACY with adaptive fallback ──────────────────────────
    const isPreferredAccurate = isValidGpsPoint(coord, GPS_ACCURACY_THRESHOLD_METERS);
    let effectivelyAccurate = isPreferredAccurate;

    if (!isPreferredAccurate) {
      consecutiveLowAccuracyRef.current++;
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
    } else {
      consecutiveLowAccuracyRef.current = 0;
    }

    setIsGpsAccurate(effectivelyAccurate);

    // ── Step 3: PAUSED ───────────────────────────────────────────────────────
    if (isPausedRef.current || statusRef.current === 'paused') {
      setCurrentSpeedMps(0);
      setCurrentPace(null);
      recordDiagnostic(false, 'PAUSED', null, null, null);
      return;
    }

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

    // ── Update rolling pace buffer ───────────────────────────────────────────
    const now = coord.timestamp;
    recentPointsRef.current = [
      ...recentPointsRef.current.filter((p) => now - p.timestamp <= 10000),
      coord,
    ];

    let calculatedPace = speedToPace(rawSpeed);
    if (calculatedPace === null && rawSpeed === null) {
      calculatedPace = computeRollingPace(recentPointsRef.current);
    }
    setCurrentSpeedMps(rawSpeed ?? 0);
    setCurrentPace(calculatedPace);

    // ── Update median max speed ──────────────────────────────────────────────
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

    // ── Step 6: GPS_GAP + clear stale pace buffer ───────────────────────────
    const elapsedFromAnchorSeconds = (coord.timestamp - lastAcceptedTimestampRef.current) / 1000;

    if (elapsedFromAnchorSeconds > MAX_GPS_GAP_SECONDS) {
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

    if (impliedSpeed > MAX_REASONABLE_RUNNING_SPEED_MPS) {
      recordDiagnostic(false, 'IMPOSSIBLE_SPEED', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // ── Step 8: GPS_JITTER ───────────────────────────────────────────────────
    if (deltaMeters < MIN_DISTANCE_DELTA_METERS) {
      recordDiagnostic(false, 'GPS_JITTER', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // ── Step 9: STATIONARY_DRIFT protection ──────────────────────────────────
    let isStationary = false;

    if (rawSpeed !== null) {
      if (rawSpeed < 0.35) {
        if (impliedSpeed > DOPPLER_ZERO_IMPLIED_OVERRIDE_MPS) {
          isStationary = false;
        } else {
          isStationary = true;
        }
      } else if (rawSpeed < 0.5 && impliedSpeed < 0.4) {
        isStationary = true;
      }
    } else {
      if (impliedSpeed < 0.35) {
        isStationary = true;
      }
    }

    if (isStationary) {
      recordDiagnostic(false, 'STATIONARY_DRIFT', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // ── Step 10: ACCEPT ──────────────────────────────────────────────────────
    accumulatedDistanceRef.current += deltaMeters;
    lastAcceptedCoordRef.current = coord;
    lastAcceptedTimestampRef.current = coord.timestamp;

    setDistanceMeters(accumulatedDistanceRef.current);
    setTotalPointsCount((prev) => prev + 1);
    recordDiagnostic(true, null, deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);

    const currentKm = Math.floor(accumulatedDistanceRef.current / 1000);
    if (currentKm > lastKilometerMilestoneRef.current) {
      lastKilometerMilestoneRef.current = currentKm;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // GPS Watch Management (Resilient Foreground + Optional Background)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Primary foreground location watch (100% reliable across all Android/iOS/Expo Go versions)
   */
  const startForegroundWatch = useCallback(async () => {
    if (foregroundSubscriptionRef.current) return;
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        handleLocationUpdate
      );
      foregroundSubscriptionRef.current = sub;
    } catch (err) {
      console.warn('[TruePace] Foreground GPS watch error:', err);
    }
  }, [handleLocationUpdate]);

  const stopForegroundWatch = useCallback(() => {
    if (foregroundSubscriptionRef.current) {
      foregroundSubscriptionRef.current.remove();
      foregroundSubscriptionRef.current = null;
    }
  }, []);

  /**
   * Background location tracking (Progressive Enhancement).
   * Fully protected: never throws, never crashes if permissions or OS restrictions prevent it.
   */
  const startBackgroundWatch = useCallback(async () => {
    // In Expo Go on Android, background location is explicitly unsupported
    if (isAndroidExpoGo) {
      await startForegroundWatch();
      return;
    }

    try {
      const canBackground = await TaskManager.isAvailableAsync().catch(() => false);
      if (!canBackground) {
        await startForegroundWatch();
        return;
      }

      // Check if user granted "Allow all the time" background permission
      const bgPerm = await Location.getBackgroundPermissionsAsync().catch(() => null);
      if (!bgPerm || bgPerm.status !== 'granted') {
        // Without background permission, calling startLocationUpdatesAsync on Android throws E_LOCATION_UNAUTHORIZED.
        // Fall back gracefully to foreground tracking — prevents APK crash!
        await startForegroundWatch();
        return;
      }

      setLocationUpdateHandler(handleLocationUpdate);

      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (!alreadyRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
          foregroundService: {
            notificationTitle: 'TruePace — Recording',
            notificationBody: 'Tracking your active run',
            notificationColor: '#22c55e',
          },
          activityType: Location.ActivityType.Fitness,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
        });
      }
      isBackgroundTrackingActiveRef.current = true;
      // Also maintain foreground watch for real-time responsiveness when screen is visible
      await startForegroundWatch();
    } catch (err) {
      console.warn('[TruePace] Background location failed to start, falling back to foreground:', err);
      isBackgroundTrackingActiveRef.current = false;
      await startForegroundWatch();
    }
  }, [handleLocationUpdate, startForegroundWatch]);

  const stopBackgroundWatch = useCallback(async () => {
    setLocationUpdateHandler(null);
    isBackgroundTrackingActiveRef.current = false;
    if (isAndroidExpoGo) return;
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  // ── Boot: check permissions and start foreground GPS ─────────────────────────
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
            await startForegroundWatch();
          }
        }
      } catch (err) {
        console.warn('[TruePace] Boot permission check error:', err);
        if (isMounted) setHasPermission(false);
      }
    })();

    return () => {
      isMounted = false;
      stopForegroundWatch();
      setLocationUpdateHandler(null);
      stopTimer();
    };
  }, [checkLocationServices, startForegroundWatch, stopForegroundWatch]);

  // ── Permission request ────────────────────────────────────────────────────────
  const requestPermission = async (): Promise<boolean> => {
    try {
      const servicesEnabled = await checkLocationServices();
      if (!servicesEnabled) return false;

      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      const granted = permStatus === 'granted';
      setHasPermission(granted);

      if (granted) {
        await startForegroundWatch();

        // On standalone builds (not Expo Go Android), request background permission
        if (!isAndroidExpoGo) {
          try {
            await Location.requestBackgroundPermissionsAsync();
          } catch {
            // Non-fatal if user declines background
          }
        }
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
  // Run lifecycle (All wrapped in resilient try/catch — NEVER crashes)
  // ────────────────────────────────────────────────────────────────────────────

  const startRun = async (): Promise<{ success: boolean; reason?: GpsIssueReason }> => {
    try {
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

      // Safely start tracking (background if available, foreground fallback guaranteed)
      await startBackgroundWatch();

      // Reset all session metrics
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

      // Wall-clock timer reset
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
    } catch (err) {
      console.error('[TruePace] Error starting run:', err);
      // Ensure foreground tracking is running so the user is never left without tracking
      await startForegroundWatch().catch(() => {});
      return { success: false, reason: 'acquiring' };
    }
  };

  const pauseRun = () => {
    pauseStartTimeRef.current = Date.now();
    setStatus('paused');
    isPausedRef.current = true;

    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;

    setCurrentPace(null);
    setCurrentSpeedMps(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const resumeRun = () => {
    if (pauseStartTimeRef.current !== null) {
      totalPausedMsRef.current += Date.now() - pauseStartTimeRef.current;
      pauseStartTimeRef.current = null;
    }

    setStatus('tracking');
    isPausedRef.current = false;

    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;
    recentPointsRef.current = [];

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const finishRun = async (): Promise<RunSummary | null> => {
    stopTimer();

    if (pauseStartTimeRef.current !== null) {
      totalPausedMsRef.current += Date.now() - pauseStartTimeRef.current;
      pauseStartTimeRef.current = null;
    }
    const finalDuration = elapsedSecondsRef.current;
    const finalDistance = accumulatedDistanceRef.current;

    await stopBackgroundWatch();
    await startForegroundWatch();

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

    await stopBackgroundWatch();
    await startForegroundWatch();

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
