import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
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
  MIN_SPEED_THRESHOLD_MPS,
  MIN_DISTANCE_DELTA_METERS,
  GPS_ACCURACY_THRESHOLD_METERS,
  MAX_REASONABLE_RUNNING_SPEED_MPS,
  MAX_GPS_GAP_SECONDS,
} from '../utils/geo';
import { saveRunSummary } from '../utils/storage';

export function useRunTracker() {
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

  // References for mutable state inside intervals & listeners without re-subscribing
  const statusRef = useRef<RunStatus>('idle');
  statusRef.current = status;

  // Separate concepts for GPS tracking:
  // - lastGpsReadingRef: latest received raw GPS reading
  // - lastAcceptedCoordRef: last coordinate accepted as a distance anchor (NEVER updated on reject)
  // - lastAcceptedTimestampRef: timestamp of the accepted anchor
  // - accumulatedDistanceRef: total accepted running distance
  // - isPausedRef: current pause state
  const lastGpsReadingRef = useRef<GpsCoordinate | null>(null);
  const lastAcceptedCoordRef = useRef<GpsCoordinate | null>(null);
  const lastAcceptedTimestampRef = useRef<number | null>(null);
  const accumulatedDistanceRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);

  const elapsedSecondsRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const recentPointsRef = useRef<GpsCoordinate[]>([]); // Rolling buffer for pace fallback
  const lastKilometerMilestoneRef = useRef(0);
  const maxSpeedRef = useRef(0);

  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkLocationServices = useCallback(async (): Promise<boolean> => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      setIsLocationServicesEnabled(enabled);
      return enabled;
    } catch {
      return true;
    }
  }, []);

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
        elapsedSecondsRef.current += 1;
        setElapsedSeconds(elapsedSecondsRef.current);

        // Update real-time average pace every second using active elapsed seconds
        const computedAvg = calculateAveragePace(
          elapsedSecondsRef.current,
          accumulatedDistanceRef.current
        );
        setAvgPace(computedAvg);
      }
    }, 1000);
  };

  const stopGpsWatch = () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
  };

  /**
   * Evaluates rolling pace across recent valid points as fallback if Doppler speed is null.
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

  /**
   * GPS Coordinate handler called on every hardware location update.
   * Implements stateful acceptance: anchor is only updated when genuine movement is accepted.
   */
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

    // Store latest received reading regardless of acceptance
    lastGpsReadingRef.current = coord;

    // Validate estimated horizontal accuracy
    const isAccurate = isValidGpsPoint(coord, GPS_ACCURACY_THRESHOLD_METERS);
    setIsGpsAccurate(isAccurate);
    setGpsAccuracy(coord.accuracy);

    const rawSpeed = coord.speed !== null && coord.speed >= 0 ? coord.speed : null;

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

    // 1. Verify GPS accuracy: reject null, <=0, or worse than configured threshold
    if (coord.accuracy === null || coord.accuracy === undefined || coord.accuracy <= 0) {
      recordDiagnostic(false, 'INVALID_ACCURACY', null, null, null);
      return;
    }

    if (!isAccurate) {
      recordDiagnostic(false, 'LOW_ACCURACY', null, null, null);
      return;
    }

    // 2. Check paused state: do NOT accumulate distance while paused
    if (isPausedRef.current || statusRef.current === 'paused') {
      setCurrentSpeedMps(0);
      setCurrentPace(null);
      recordDiagnostic(false, 'PAUSED', null, null, null);
      return;
    }

    // If not tracking (idle/finished), do not accumulate distance
    if (statusRef.current !== 'tracking') {
      return;
    }

    // 3. Validate timestamp anomalies: reject missing, non-positive, or out-of-order timestamps
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

    // Track peak native speed
    if (rawSpeed !== null && rawSpeed > maxSpeedRef.current) {
      maxSpeedRef.current = rawSpeed;
    }

    // Maintain rolling window for instantaneous pace (last 10 seconds)
    const now = coord.timestamp;
    recentPointsRef.current = [
      ...recentPointsRef.current.filter((p) => now - p.timestamp <= 10000),
      coord,
    ];

    // Compute instantaneous pace: prioritize Doppler hardware speed, fallback to rolling window
    let calculatedPace = speedToPace(rawSpeed);
    if (calculatedPace === null && rawSpeed === null) {
      calculatedPace = computeRollingPace(recentPointsRef.current);
    }
    setCurrentSpeedMps(rawSpeed ?? 0);
    setCurrentPace(calculatedPace);

    // 4. If no accepted anchor exists (initial start, post-resume, post-gap), establish new anchor
    if (lastAcceptedCoordRef.current === null || lastAcceptedTimestampRef.current === null) {
      lastAcceptedCoordRef.current = coord;
      lastAcceptedTimestampRef.current = coord.timestamp;
      setTotalPointsCount((prev) => prev + 1);
      recordDiagnostic(true, null, 0, 0, 0);
      return;
    }

    // 5. Calculate elapsed time from anchor
    const elapsedFromAnchorSeconds = (coord.timestamp - lastAcceptedTimestampRef.current) / 1000;

    // Large tracking gap check (signal loss, backgrounding, or extended loss of lock)
    if (elapsedFromAnchorSeconds > MAX_GPS_GAP_SECONDS) {
      // Re-establish anchor without inventing straight-line distance across the gap
      lastAcceptedCoordRef.current = coord;
      lastAcceptedTimestampRef.current = coord.timestamp;
      recordDiagnostic(false, 'GPS_GAP', null, elapsedFromAnchorSeconds, null);
      return;
    }

    // 6. Calculate distance from anchor using Haversine formula
    const deltaMeters = calculateHaversineDistance(
      lastAcceptedCoordRef.current.latitude,
      lastAcceptedCoordRef.current.longitude,
      coord.latitude,
      coord.longitude
    );

    // 7. Calculate implied speed
    const impliedSpeed = deltaMeters / elapsedFromAnchorSeconds;

    // Sanity check: Reject impossible jump / teleportation (e.g. multipath spike)
    if (impliedSpeed > MAX_REASONABLE_RUNNING_SPEED_MPS) {
      recordDiagnostic(false, 'IMPOSSIBLE_SPEED', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // 8. Ignore small GPS jitter: do NOT update anchor so genuine slow movement builds up!
    if (deltaMeters < MIN_DISTANCE_DELTA_METERS) {
      recordDiagnostic(false, 'GPS_JITTER', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // 9. Stationary drift protection
    let isStationary = false;
    if (rawSpeed !== null) {
      // Doppler speed is available: if speed < 0.35 m/s (~1.26 km/h), user is stationary/drift
      if (rawSpeed < 0.35) {
        isStationary = true;
      } else if (rawSpeed < 0.5 && impliedSpeed < 0.4) {
        isStationary = true;
      }
    } else {
      // Doppler speed is absent: check if implied speed is unrealistically low for actual movement
      if (impliedSpeed < 0.35) {
        isStationary = true;
      }
    }

    if (isStationary) {
      recordDiagnostic(false, 'STATIONARY_DRIFT', deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);
      return;
    }

    // 10. Genuine movement accepted!
    // Accumulate distance and update accepted anchor
    accumulatedDistanceRef.current += deltaMeters;
    lastAcceptedCoordRef.current = coord;
    lastAcceptedTimestampRef.current = coord.timestamp;

    setDistanceMeters(accumulatedDistanceRef.current);
    setTotalPointsCount((prev) => prev + 1);
    recordDiagnostic(true, null, deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);

    // Kilometer milestone vibration
    const currentKm = Math.floor(accumulatedDistanceRef.current / 1000);
    if (currentKm > lastKilometerMilestoneRef.current) {
      lastKilometerMilestoneRef.current = currentKm;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  const startGpsWatch = useCallback(async () => {
    if (locationSubscriptionRef.current) return;
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1, // update every 1 meter
        },
        handleLocationUpdate
      );
      locationSubscriptionRef.current = subscription;
    } catch (err) {
      console.warn('Error starting location watch:', err);
    }
  }, [handleLocationUpdate]);

  // Check initial location permission and pre-warm GPS
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
            await startGpsWatch();
          }
        }
      } catch (err) {
        console.warn('Error checking location permission:', err);
        if (isMounted) setHasPermission(false);
      }
    })();

    return () => {
      isMounted = false;
      stopGpsWatch();
      stopTimer();
    };
  }, [checkLocationServices, startGpsWatch]);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const servicesEnabled = await checkLocationServices();
      if (!servicesEnabled) {
        return false;
      }
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      const granted = permStatus === 'granted';
      setHasPermission(granted);
      if (granted) {
        await startGpsWatch();
      }
      return granted;
    } catch (err) {
      console.warn('Error requesting location permission:', err);
      setHasPermission(false);
      return false;
    }
  };

  // Derive current GPS health & readiness
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

    // Gatekeeper: Must have accurate satellite lock to start
    if (gpsAccuracy === null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return { success: false, reason: 'acquiring' };
    }

    if (gpsAccuracy > GPS_ACCURACY_THRESHOLD_METERS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return { success: false, reason: 'weak_signal' };
    }

    // Ensure GPS watch is running
    await startGpsWatch();

    // Reset session metrics and distance anchors
    accumulatedDistanceRef.current = 0;
    elapsedSecondsRef.current = 0;
    lastKilometerMilestoneRef.current = 0;
    maxSpeedRef.current = 0;
    lastGpsReadingRef.current = null;
    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;
    isPausedRef.current = false;
    recentPointsRef.current = [];
    startTimeRef.current = Date.now();

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
    setStatus('paused');
    isPausedRef.current = true;
    // Clear accepted anchor so post-resume establishes a clean fresh anchor
    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;
    setCurrentPace(null);
    setCurrentSpeedMps(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const resumeRun = () => {
    setStatus('tracking');
    isPausedRef.current = false;
    // Clear anchor to guarantee the first post-resume reading becomes the new anchor
    lastAcceptedCoordRef.current = null;
    lastAcceptedTimestampRef.current = null;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const finishRun = async (): Promise<RunSummary | null> => {
    stopTimer();

    const endTime = Date.now();
    const finalDistance = accumulatedDistanceRef.current;
    const finalDuration = elapsedSecondsRef.current;

    const summary: RunSummary = {
      id: `${startTimeRef.current}_${Math.random().toString(36).substring(2, 7)}`,
      startTime: startTimeRef.current,
      endTime,
      durationSeconds: finalDuration,
      distanceMeters: finalDistance,
      avgPaceSecondsPerKm: calculateAveragePace(finalDuration, finalDistance),
      bestPaceSecondsPerKm: speedToPace(maxSpeedRef.current),
      maxSpeedMps: maxSpeedRef.current,
    };

    setStatus('finished');
    setLastFinishedRun(summary);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Save to local cache if run has meaningful distance (> 20 meters)
    if (finalDistance >= 20) {
      await saveRunSummary(summary);
    }

    return summary;
  };

  const resetRun = () => {
    stopTimer();
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
  };

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
