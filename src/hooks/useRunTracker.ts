import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  GpsCoordinate,
  GpsIssueReason,
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

  // References for mutable state inside intervals & listeners without re-subscribing
  const statusRef = useRef<RunStatus>('idle');
  statusRef.current = status;

  const lastValidCoordRef = useRef<GpsCoordinate | null>(null);
  const accumulatedDistanceRef = useRef(0);
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

        // Update real-time average pace every second
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
   * GPS Coordinate handler called on every hardware location update
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

    const isAccurate = isValidGpsPoint(coord);
    setIsGpsAccurate(isAccurate);
    setGpsAccuracy(coord.accuracy);

    // If GPS is noisy or run is paused/idle, do not accumulate distance
    if (!isAccurate || statusRef.current !== 'tracking') {
      if (statusRef.current === 'paused') {
        setCurrentSpeedMps(0);
        setCurrentPace(null);
      }
      return;
    }

    setTotalPointsCount((prev) => prev + 1);

    // Track Doppler speed
    const rawSpeed = coord.speed !== null && coord.speed >= 0 ? coord.speed : null;
    if (rawSpeed !== null && rawSpeed > maxSpeedRef.current) {
      maxSpeedRef.current = rawSpeed;
    }

    // Maintain a rolling window of recent points (last 10 seconds)
    const now = coord.timestamp;
    recentPointsRef.current = [
      ...recentPointsRef.current.filter((p) => now - p.timestamp <= 10000),
      coord,
    ];

    // Compute instantaneous pace: prioritize Doppler hardware speed
    let calculatedPace = speedToPace(rawSpeed);
    if (calculatedPace === null && rawSpeed === null) {
      calculatedPace = computeRollingPace(recentPointsRef.current);
    }

    setCurrentSpeedMps(rawSpeed ?? 0);
    setCurrentPace(calculatedPace);

    // Accumulate distance with stationary drift suppression
    const lastCoord = lastValidCoordRef.current;
    if (lastCoord) {
      const deltaMeters = calculateHaversineDistance(
        lastCoord.latitude,
        lastCoord.longitude,
        coord.latitude,
        coord.longitude
      );

      // Stationary check: only accumulate if speed >= 0.5 m/s or delta > 2.0 meters
      const isMoving =
        (rawSpeed !== null && rawSpeed >= MIN_SPEED_THRESHOLD_MPS) ||
        deltaMeters >= MIN_DISTANCE_DELTA_METERS;

      if (isMoving && deltaMeters < 100) {
        accumulatedDistanceRef.current += deltaMeters;
        setDistanceMeters(accumulatedDistanceRef.current);

        // Kilometer milestone vibration
        const currentKm = Math.floor(accumulatedDistanceRef.current / 1000);
        if (currentKm > lastKilometerMilestoneRef.current) {
          lastKilometerMilestoneRef.current = currentKm;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    }

    lastValidCoordRef.current = coord;
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

    // Reset session metrics
    accumulatedDistanceRef.current = 0;
    elapsedSecondsRef.current = 0;
    lastKilometerMilestoneRef.current = 0;
    maxSpeedRef.current = 0;
    lastValidCoordRef.current = null;
    recentPointsRef.current = [];
    startTimeRef.current = Date.now();

    setDistanceMeters(0);
    setElapsedSeconds(0);
    setCurrentPace(null);
    setAvgPace(null);
    setCurrentSpeedMps(0);
    setTotalPointsCount(0);
    setLastFinishedRun(null);

    setStatus('tracking');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    startTimer();
    return { success: true };
  };

  const pauseRun = () => {
    setStatus('paused');
    setCurrentPace(null);
    setCurrentSpeedMps(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const resumeRun = () => {
    setStatus('tracking');
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
    setElapsedSeconds(0);
    setDistanceMeters(0);
    setCurrentPace(null);
    setAvgPace(null);
    setCurrentSpeedMps(0);
    setTotalPointsCount(0);
    setLastFinishedRun(null);
    accumulatedDistanceRef.current = 0;
    elapsedSecondsRef.current = 0;
    lastValidCoordRef.current = null;
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
