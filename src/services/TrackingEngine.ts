import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  MIN_DISTANCE_DELTA_METERS,
  GPS_ACCURACY_THRESHOLD_METERS,
  GPS_ACCURACY_FALLBACK_THRESHOLD_METERS,
  MAX_REASONABLE_RUNNING_SPEED_MPS,
  MAX_GPS_GAP_SECONDS,
} from '../utils/geo';
import { saveRunSummary } from '../utils/storage';
import { AudioCoach } from './AudioCoach';
import { LiveNotificationService } from './LiveNotificationService';

export const BACKGROUND_LOCATION_TASK = 'TRUEPACE_BACKGROUND_LOCATION_TASK';
const ACTIVE_RUN_STORAGE_KEY = '@truepace_active_run_v1';
const SPEED_BUFFER_SIZE = 5;
const ADAPTIVE_ACCURACY_TRIGGER = 5;
const DOPPLER_ZERO_IMPLIED_OVERRIDE_MPS = 1.0;

export const LOCATION_TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
  deferredUpdatesInterval: 1000,
  deferredUpdatesDistance: 0,
  showsBackgroundLocationIndicator: true,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  foregroundService: {
    notificationTitle: 'TruePace Run Active',
    notificationBody: 'Tracking workout distance & pace with precision GPS',
    notificationColor: '#22c55e',
    killServiceOnDestroy: false,
  },
};

type StoreListener = () => void;

interface PersistedActiveSession {
  status: RunStatus;
  startTime: number;
  totalPausedMs: number;
  pauseStartTime: number | null;
  accumulatedDistance: number;
  lastAcceptedCoord: GpsCoordinate | null;
  lastAcceptedTimestamp: number | null;
  maxSpeedMps: number;
  lastKilometerMilestone: number;
  totalValidPoints: number;
  splits: number[];
  splitStartActiveSeconds: number;
}

export class TrackingEngine {
  private static instance: TrackingEngine | null = null;

  // ── Engine State ────────────────────────────────────────────────────────────
  public status: RunStatus = 'idle';
  public startTime = 0;
  public totalPausedMs = 0;
  public pauseStartTime: number | null = null;
  public accumulatedDistance = 0;

  public lastGpsReading: GpsCoordinate | null = null;
  public lastAcceptedCoord: GpsCoordinate | null = null;
  public lastAcceptedTimestamp: number | null = null;
  public lastProcessedTimestamp: number | null = null;

  public currentSpeedMps = 0;
  public currentPaceSecondsPerKm: number | null = null;
  public maxSpeedMps = 0;
  public speedBuffer: number[] = [];
  public recentPoints: GpsCoordinate[] = [];

  public gpsAccuracy: number | null = null;
  public isGpsAccurate = false;
  public isLocationServicesEnabled = true;
  public hasPermission: boolean | null = null;

  public totalValidPoints = 0;
  public consecutiveLowAccuracy = 0;
  public lastKilometerMilestone = 0;
  public splitStartActiveSeconds = 0; // Active elapsed seconds at the start of the current split
  public splits: number[] = []; // Per-km split times in seconds

  public lastRejectionReason: GpsPointRejectionReason = null;
  public lastDiagnosticLog: GpsDiagnosticLog | null = null;
  public lastFinishedRun: RunSummary | null = null;

  // ── Native Subscriptions ────────────────────────────────────────────────────
  private foregroundSubscription: Location.LocationSubscription | null = null;
  private isBackgroundTrackingActive = false;
  private listeners: Set<StoreListener> = new Set();
  private appStateSubscription: { remove: () => void } | null = null;
  private isInitialized = false;
  private telemetrySnapshot: TrackingTelemetry;

  private constructor() {
    this.telemetrySnapshot = this.computeTelemetrySnapshot();
    this.setupAppStateListener();
  }

  public static getInstance(): TrackingEngine {
    if (!TrackingEngine.instance) {
      TrackingEngine.instance = new TrackingEngine();
    }
    return TrackingEngine.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    await this.restoreActiveSession();
  }

  public setLocationServicesEnabled(enabled: boolean): void {
    this.isLocationServicesEnabled = enabled;
    this.notifyListeners();
  }

  public setHasPermission(granted: boolean): void {
    this.hasPermission = granted;
    this.notifyListeners();
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          // App returned to foreground — restart foreground GPS watch if actively tracking
          // The background task was handling GPS while backgrounded; now hand back to foreground watch
          if (this.status === 'tracking' || this.status === 'paused') {
            this.startForegroundWatch().catch(() => {});
          }
          // Immediately notify listeners so the HUD refreshes instantaneously
          this.notifyListeners();
        } else if (nextAppState === 'background') {
          // App going to background — stop foreground watch to avoid resource conflicts
          // The background task (startLocationUpdatesAsync) takes over GPS delivery
          if (this.status === 'tracking') {
            this.stopForegroundWatch();
          }
        }
      }
    );
  }

  // ── Subscription Management (useSyncExternalStore Compatible) ───────────────
  public subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getTelemetry = (): TrackingTelemetry => {
    return this.telemetrySnapshot;
  };

  public notifyListeners(): void {
    this.telemetrySnapshot = this.computeTelemetrySnapshot();
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.warn('[TruePace] Error in telemetry listener:', err);
      }
    }
  }

  // ── Elapsed Time Calculation (Wall-Clock Precision) ─────────────────────────
  public getElapsedSeconds(): number {
    if (this.status === 'idle') {
      return 0;
    }
    if (this.status === 'finished' && this.lastFinishedRun) {
      return this.lastFinishedRun.durationSeconds;
    }
    if (this.status === 'paused' && this.pauseStartTime !== null) {
      const activeMs = this.pauseStartTime - this.startTime - this.totalPausedMs;
      return Math.max(0, Math.floor(activeMs / 1000));
    }
    if (this.status === 'tracking') {
      const activeMs = Date.now() - this.startTime - this.totalPausedMs;
      return Math.max(0, Math.floor(activeMs / 1000));
    }
    return 0;
  }

  private computeTelemetrySnapshot(): TrackingTelemetry {
    const elapsed = this.getElapsedSeconds();
    const avgPace = calculateAveragePace(elapsed, this.accumulatedDistance);

    let gpsIssueReason: GpsIssueReason = null;
    if (!this.isLocationServicesEnabled) {
      gpsIssueReason = 'services_disabled';
    } else if (this.hasPermission === false) {
      gpsIssueReason = 'permission_denied';
    } else if (this.gpsAccuracy === null) {
      gpsIssueReason = 'acquiring';
    } else if (this.gpsAccuracy > GPS_ACCURACY_THRESHOLD_METERS) {
      gpsIssueReason = 'weak_signal';
    }

    const isGpsReady =
      this.isLocationServicesEnabled &&
      this.hasPermission === true &&
      this.isGpsAccurate &&
      this.gpsAccuracy !== null &&
      this.gpsAccuracy <= GPS_ACCURACY_THRESHOLD_METERS;

    return {
      status: this.status,
      elapsedSeconds: elapsed,
      distanceMeters: this.accumulatedDistance,
      currentPaceSecondsPerKm: this.currentPaceSecondsPerKm,
      avgPaceSecondsPerKm: avgPace,
      currentSpeedMps: this.currentSpeedMps,
      gpsAccuracyMeters: this.gpsAccuracy,
      isGpsAccurate: this.isGpsAccurate,
      isGpsReady,
      gpsIssueReason,
      totalValidPoints: this.totalValidPoints,
      lastRejectionReason: this.lastRejectionReason,
    };
  }

  // ── Rolling Pace Helper ─────────────────────────────────────────────────────
  private computeRollingPace(recentPoints: GpsCoordinate[]): number | null {
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
  }

  // ── Location Processing Engine ──────────────────────────────────────────────
  public processLocations(locations: Location.LocationObject[]): void {
    if (!locations || locations.length === 0) return;
    const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
    for (const loc of sorted) {
      this.processLocation(loc);
    }
  }

  public processLocation(location: Location.LocationObject): void {
    const coord: GpsCoordinate = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: location.timestamp,
    };

    // Deduplication guard between foreground & background streams
    if (
      this.lastProcessedTimestamp !== null &&
      coord.timestamp <= this.lastProcessedTimestamp
    ) {
      return;
    }
    this.lastProcessedTimestamp = coord.timestamp;
    this.lastGpsReading = coord;

    const rawSpeed = coord.speed !== null && coord.speed >= 0 ? coord.speed : null;
    if (rawSpeed !== null) {
      this.speedBuffer = [...this.speedBuffer, rawSpeed].slice(-SPEED_BUFFER_SIZE);
    }

    const recordDiagnostic = (
      accepted: boolean,
      rejectionReason: GpsPointRejectionReason,
      distFromAnchor: number | null,
      dt: number | null,
      impSpd: number | null
    ) => {
      this.lastRejectionReason = rejectionReason;
      this.lastDiagnosticLog = {
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
        accumulatedDistance: this.accumulatedDistance,
      };
      this.notifyListeners();
    };

    // ── Step 1: INVALID_ACCURACY ─────────────────────────────────────────────
    if (coord.accuracy === null || coord.accuracy === undefined || coord.accuracy <= 0) {
      this.isGpsAccurate = false;
      this.gpsAccuracy = coord.accuracy;
      this.consecutiveLowAccuracy = 0;
      recordDiagnostic(false, 'INVALID_ACCURACY', null, null, null);
      return;
    }

    this.gpsAccuracy = coord.accuracy;

    // ── Step 2: LOW_ACCURACY with adaptive fallback ──────────────────────────
    const isPreferredAccurate = isValidGpsPoint(coord, GPS_ACCURACY_THRESHOLD_METERS);
    let effectivelyAccurate = isPreferredAccurate;

    if (!isPreferredAccurate) {
      this.consecutiveLowAccuracy++;
      if (
        this.status === 'tracking' &&
        this.consecutiveLowAccuracy >= ADAPTIVE_ACCURACY_TRIGGER
      ) {
        effectivelyAccurate = isValidGpsPoint(
          coord,
          GPS_ACCURACY_FALLBACK_THRESHOLD_METERS
        );
      }
      if (!effectivelyAccurate) {
        this.isGpsAccurate = false;
        recordDiagnostic(false, 'LOW_ACCURACY', null, null, null);
        return;
      }
    } else {
      this.consecutiveLowAccuracy = 0;
    }

    this.isGpsAccurate = effectivelyAccurate;

    // ── Step 3: PAUSED / IDLE ────────────────────────────────────────────────
    if (this.status === 'paused') {
      this.currentSpeedMps = 0;
      this.currentPaceSecondsPerKm = null;
      recordDiagnostic(false, 'PAUSED', null, null, null);
      return;
    }

    if (this.status !== 'tracking') {
      this.notifyListeners();
      return;
    }

    // ── Step 4: INVALID_TIMESTAMP ────────────────────────────────────────────
    if (!coord.timestamp || isNaN(coord.timestamp) || coord.timestamp <= 0) {
      recordDiagnostic(false, 'INVALID_TIMESTAMP', null, null, null);
      return;
    }

    if (
      this.lastAcceptedTimestamp !== null &&
      coord.timestamp <= this.lastAcceptedTimestamp
    ) {
      recordDiagnostic(false, 'INVALID_TIMESTAMP', null, null, null);
      return;
    }

    // ── Update rolling pace buffer ───────────────────────────────────────────
    const now = coord.timestamp;
    this.recentPoints = [
      ...this.recentPoints.filter((p) => now - p.timestamp <= 10000),
      coord,
    ];

    let calculatedPace = speedToPace(rawSpeed);
    if (calculatedPace === null && rawSpeed === null) {
      calculatedPace = this.computeRollingPace(this.recentPoints);
    }
    this.currentSpeedMps = rawSpeed ?? 0;
    this.currentPaceSecondsPerKm = calculatedPace;

    // ── Update median max speed ──────────────────────────────────────────────
    if (this.speedBuffer.length >= 3) {
      const sorted = [...this.speedBuffer].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (median > this.maxSpeedMps) {
        this.maxSpeedMps = median;
      }
    }

    // ── Step 5: Establish initial anchor ────────────────────────────────────
    if (this.lastAcceptedCoord === null || this.lastAcceptedTimestamp === null) {
      this.lastAcceptedCoord = coord;
      this.lastAcceptedTimestamp = coord.timestamp;
      this.totalValidPoints++;
      recordDiagnostic(true, null, 0, 0, 0);
      return;
    }

    // ── Step 6: GPS_GAP + clear stale pace buffer ───────────────────────────
    const elapsedFromAnchorSeconds = (coord.timestamp - this.lastAcceptedTimestamp) / 1000;

    if (elapsedFromAnchorSeconds > MAX_GPS_GAP_SECONDS) {
      this.recentPoints = [];
      this.lastAcceptedCoord = coord;
      this.lastAcceptedTimestamp = coord.timestamp;
      recordDiagnostic(false, 'GPS_GAP', null, elapsedFromAnchorSeconds, null);
      return;
    }

    // ── Step 7: Haversine distance + implied speed ───────────────────────────
    const deltaMeters = calculateHaversineDistance(
      this.lastAcceptedCoord.latitude,
      this.lastAcceptedCoord.longitude,
      coord.latitude,
      coord.longitude
    );

    const impliedSpeed = deltaMeters / elapsedFromAnchorSeconds;

    if (impliedSpeed > MAX_REASONABLE_RUNNING_SPEED_MPS) {
      recordDiagnostic(
        false,
        'IMPOSSIBLE_SPEED',
        deltaMeters,
        elapsedFromAnchorSeconds,
        impliedSpeed
      );
      return;
    }

    // ── Step 8: GPS_JITTER ───────────────────────────────────────────────────
    if (deltaMeters < MIN_DISTANCE_DELTA_METERS) {
      recordDiagnostic(
        false,
        'GPS_JITTER',
        deltaMeters,
        elapsedFromAnchorSeconds,
        impliedSpeed
      );
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
      recordDiagnostic(
        false,
        'STATIONARY_DRIFT',
        deltaMeters,
        elapsedFromAnchorSeconds,
        impliedSpeed
      );
      return;
    }

    // ── Step 10: ACCEPT ──────────────────────────────────────────────────────
    this.accumulatedDistance += deltaMeters;
    this.lastAcceptedCoord = coord;
    this.lastAcceptedTimestamp = coord.timestamp;
    this.totalValidPoints++;

    recordDiagnostic(true, null, deltaMeters, elapsedFromAnchorSeconds, impliedSpeed);

    const currentKm = Math.floor(this.accumulatedDistance / 1000);
    if (currentKm > this.lastKilometerMilestone) {
      const activeSecs = this.getElapsedSeconds();
      const numSplitsToAdd = currentKm - this.lastKilometerMilestone;
      const splitSecs = Math.max(1, Math.round((activeSecs - this.splitStartActiveSeconds) / numSplitsToAdd));
      for (let i = 0; i < numSplitsToAdd; i++) {
        this.splits.push(splitSecs);
      }
      this.splitStartActiveSeconds = activeSecs;
      this.lastKilometerMilestone = currentKm;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const avgPace = calculateAveragePace(activeSecs, this.accumulatedDistance);
      AudioCoach.getInstance().announceKilometer(currentKm, splitSecs, avgPace);
    }

    this.saveActiveSessionSnapshot();
    LiveNotificationService.getInstance().updateLiveMetrics(
      this.accumulatedDistance,
      this.getElapsedSeconds(),
      this.currentPaceSecondsPerKm,
      false
    ).catch(() => {});
  }

  // ── Watch Position Management ───────────────────────────────────────────────
  public async startForegroundWatch(): Promise<void> {
    if (this.foregroundSubscription) return;
    try {
      this.foregroundSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (loc) => this.processLocation(loc)
      );
    } catch (err) {
      console.warn('[TruePace] Foreground GPS watch start error:', err);
    }
  }

  public stopForegroundWatch(): void {
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }
  }

  public async startBackgroundTracking(): Promise<boolean> {
    try {
      const isAvailable = await Location.isBackgroundLocationAvailableAsync().catch(
        () => false
      );
      if (!isAvailable) {
        console.warn('[TruePace] Background location is not supported on this platform/client.');
        return false;
      }

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK
      ).catch(() => false);

      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK,
          LOCATION_TASK_OPTIONS
        );
      }
      this.isBackgroundTrackingActive = true;
      return true;
    } catch (err) {
      console.warn('[TruePace] Failed to start background location updates:', err);
      this.isBackgroundTrackingActive = false;
      return false;
    }
  }

  public async stopBackgroundTracking(): Promise<void> {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK
      ).catch(() => false);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch (err) {
      console.warn('[TruePace] Failed to stop background location updates:', err);
    } finally {
      this.isBackgroundTrackingActive = false;
    }
  }

  // ── Lifecycle Actions ───────────────────────────────────────────────────────
  public async startRun(): Promise<{ success: boolean; reason?: GpsIssueReason }> {
    const isServicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
    this.isLocationServicesEnabled = isServicesEnabled;
    if (!isServicesEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return { success: false, reason: 'services_disabled' };
    }

    if (this.hasPermission === false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return { success: false, reason: 'permission_denied' };
    }

    if (this.gpsAccuracy === null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return { success: false, reason: 'acquiring' };
    }

    if (this.gpsAccuracy > GPS_ACCURACY_THRESHOLD_METERS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return { success: false, reason: 'weak_signal' };
    }

    // Reset session metrics
    this.accumulatedDistance = 0;
    this.lastKilometerMilestone = 0;
    this.splitStartActiveSeconds = 0;
    this.splits = [];
    this.maxSpeedMps = 0;
    this.lastGpsReading = null;
    this.lastAcceptedCoord = null;
    this.lastAcceptedTimestamp = null;
    this.lastProcessedTimestamp = null; // CRITICAL: Reset dedup guard so first location isn't rejected
    this.recentPoints = [];
    this.speedBuffer = [];
    this.consecutiveLowAccuracy = 0;
    this.totalValidPoints = 0;
    this.lastFinishedRun = null;
    this.lastRejectionReason = null;
    this.lastDiagnosticLog = null;

    this.startTime = Date.now();
    this.totalPausedMs = 0;
    this.pauseStartTime = null;

    this.status = 'tracking';

    // Start BOTH foreground watch AND background tracking concurrently.
    // Foreground watch delivers GPS while app is visible.
    // Background task delivers GPS when screen is locked / app backgrounded.
    // processLocation() deduplicates via lastProcessedTimestamp — no double-counting.
    const bgStarted = await this.startBackgroundTracking();
    await this.startForegroundWatch();
    if (!bgStarted) {
      console.warn('[TruePace] Background tracking unavailable — foreground-only mode.');
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    AudioCoach.getInstance().announceRunStarted();
    this.notifyListeners();
    this.saveActiveSessionSnapshot();
    LiveNotificationService.getInstance().updateLiveMetrics(0, 0, null, false, true).catch(() => {});

    return { success: true };
  }

  public pauseRun(): void {
    if (this.status !== 'tracking') return;
    this.pauseStartTime = Date.now();
    this.status = 'paused';

    // Strict anchor clearing upon pause
    this.lastAcceptedCoord = null;
    this.lastAcceptedTimestamp = null;
    this.currentPaceSecondsPerKm = null;
    this.currentSpeedMps = 0;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    AudioCoach.getInstance().announceRunPaused();
    this.notifyListeners();
    this.saveActiveSessionSnapshot();
    LiveNotificationService.getInstance().updateLiveMetrics(
      this.accumulatedDistance,
      this.getElapsedSeconds(),
      null,
      true,
      true
    ).catch(() => {});
  }

  public resumeRun(): void {
    if (this.status !== 'paused') return;
    if (this.pauseStartTime !== null) {
      this.totalPausedMs += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }

    this.status = 'tracking';
    // Establishing fresh anchor on next valid coordinate
    this.lastAcceptedCoord = null;
    this.lastAcceptedTimestamp = null;
    this.recentPoints = [];

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    AudioCoach.getInstance().announceRunResumed();
    this.notifyListeners();
    this.saveActiveSessionSnapshot();
    LiveNotificationService.getInstance().updateLiveMetrics(
      this.accumulatedDistance,
      this.getElapsedSeconds(),
      this.currentPaceSecondsPerKm,
      false,
      true
    ).catch(() => {});
  }

  public async finishRun(): Promise<RunSummary | null> {
    if (this.status !== 'tracking' && this.status !== 'paused') {
      return null;
    }

    if (this.pauseStartTime !== null) {
      this.totalPausedMs += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }

    const finalDuration = this.getElapsedSeconds();
    const finalDistance = this.accumulatedDistance;

    await this.stopBackgroundTracking();
    // Restart foreground watch so user sees satellite status for the next run
    await this.startForegroundWatch();

    const summary: RunSummary = {
      id: `${this.startTime}_${Math.random().toString(36).substring(2, 7)}`,
      startTime: this.startTime,
      endTime: Date.now(),
      durationSeconds: finalDuration,
      distanceMeters: finalDistance,
      avgPaceSecondsPerKm: calculateAveragePace(finalDuration, finalDistance),
      bestPaceSecondsPerKm: speedToPace(this.maxSpeedMps),
      maxSpeedMps: this.maxSpeedMps,
      splits: [...this.splits],
    };

    this.status = 'finished';
    this.lastFinishedRun = summary;
    this.clearActiveSessionSnapshot();
    LiveNotificationService.getInstance().dismissLiveNotification().catch(() => {});

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AudioCoach.getInstance().announceRunFinished(finalDistance, finalDuration);
    this.notifyListeners();

    if (finalDistance >= 20) {
      await saveRunSummary(summary);
    }

    return summary;
  }

  public async resetRun(): Promise<void> {
    await this.stopBackgroundTracking();
    await this.startForegroundWatch();

    this.status = 'idle';
    this.startTime = 0;
    this.totalPausedMs = 0;
    this.pauseStartTime = null;
    this.accumulatedDistance = 0;
    this.lastAcceptedCoord = null;
    this.lastAcceptedTimestamp = null;
    this.currentPaceSecondsPerKm = null;
    this.currentSpeedMps = 0;
    this.totalValidPoints = 0;
    this.lastFinishedRun = null;
    this.lastRejectionReason = null;
    this.lastDiagnosticLog = null;
    this.recentPoints = [];
    this.speedBuffer = [];
    this.maxSpeedMps = 0;
    this.consecutiveLowAccuracy = 0;
    this.lastKilometerMilestone = 0;
    this.splitStartActiveSeconds = 0;
    this.splits = [];

    this.clearActiveSessionSnapshot();
    LiveNotificationService.getInstance().dismissLiveNotification().catch(() => {});
    this.notifyListeners();
  }

  // ── Session Persistence (Protects Active Run from Process Eviction) ─────────
  private async saveActiveSessionSnapshot(): Promise<void> {
    if (this.status !== 'tracking' && this.status !== 'paused') return;
    try {
      const data: PersistedActiveSession = {
        status: this.status,
        startTime: this.startTime,
        totalPausedMs: this.totalPausedMs,
        pauseStartTime: this.pauseStartTime,
        accumulatedDistance: this.accumulatedDistance,
        lastAcceptedCoord: this.lastAcceptedCoord,
        lastAcceptedTimestamp: this.lastAcceptedTimestamp,
        maxSpeedMps: this.maxSpeedMps,
        lastKilometerMilestone: this.lastKilometerMilestone,
        totalValidPoints: this.totalValidPoints,
        splits: this.splits,
        splitStartActiveSeconds: this.splitStartActiveSeconds,
      };
      await AsyncStorage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[TruePace] Failed to save active run session snapshot:', err);
    }
  }

  private async clearActiveSessionSnapshot(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
    } catch {}
  }

  private async restoreActiveSession(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_RUN_STORAGE_KEY);
      if (!raw) return;
      const data: PersistedActiveSession = JSON.parse(raw);
      // Only restore if session is recent (< 12 hours old)
      if (data && Date.now() - data.startTime < 12 * 60 * 60 * 1000) {
        this.status = data.status;
        this.startTime = data.startTime;
        this.totalPausedMs = data.totalPausedMs;
        this.pauseStartTime = data.pauseStartTime;
        this.accumulatedDistance = data.accumulatedDistance;
        this.lastAcceptedCoord = data.lastAcceptedCoord;
        this.lastAcceptedTimestamp = data.lastAcceptedTimestamp;
        this.maxSpeedMps = data.maxSpeedMps;
        this.lastKilometerMilestone = data.lastKilometerMilestone;
        this.totalValidPoints = data.totalValidPoints;
        this.splits = Array.isArray(data.splits) ? data.splits : [];
        this.splitStartActiveSeconds = typeof data.splitStartActiveSeconds === 'number' ? data.splitStartActiveSeconds : 0;

        if (this.status === 'tracking') {
          await this.startBackgroundTracking();
          await this.startForegroundWatch();
        }
        this.notifyListeners();
      } else {
        await this.clearActiveSessionSnapshot();
      }
    } catch (err) {
      console.warn('[TruePace] Failed to restore active session snapshot:', err);
    }
  }
}
