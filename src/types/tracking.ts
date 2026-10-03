export interface GpsCoordinate {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null; // meters per second
  heading: number | null;
  timestamp: number;
}

export type RunStatus = 'idle' | 'tracking' | 'paused' | 'finished';

export type GpsIssueReason =
  | 'services_disabled'
  | 'permission_denied'
  | 'acquiring'
  | 'weak_signal'
  | null;

export type GpsPointRejectionReason =
  | 'INVALID_ACCURACY'
  | 'LOW_ACCURACY'
  | 'GPS_JITTER'
  | 'IMPOSSIBLE_SPEED'
  | 'INVALID_TIMESTAMP'
  | 'PAUSED'
  | 'GPS_GAP'
  | 'STATIONARY_DRIFT'
  | null;

export interface GpsDiagnosticLog {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  distanceFromAnchor: number | null;
  elapsedSeconds: number | null;
  impliedSpeed: number | null;
  nativeGpsSpeed: number | null;
  accepted: boolean;
  rejectionReason: GpsPointRejectionReason;
  accumulatedDistance: number;
}

export interface RunSummary {
  id: string;
  startTime: number;
  endTime: number;
  durationSeconds: number; // Active moving time only
  distanceMeters: number;
  avgPaceSecondsPerKm: number | null;
  bestPaceSecondsPerKm: number | null;
  maxSpeedMps: number;
}

export interface TrackingTelemetry {
  status: RunStatus;
  elapsedSeconds: number; // Active time
  distanceMeters: number;
  currentPaceSecondsPerKm: number | null; // null represents stationary/unknown
  avgPaceSecondsPerKm: number | null;
  currentSpeedMps: number;
  gpsAccuracyMeters: number | null;
  isGpsAccurate: boolean;
  isGpsReady: boolean;
  gpsIssueReason: GpsIssueReason;
  totalValidPoints: number;
  lastRejectionReason?: GpsPointRejectionReason;
  lastDiagnosticLog?: GpsDiagnosticLog | null;
}
