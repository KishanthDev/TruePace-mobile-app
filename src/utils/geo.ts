import { GpsCoordinate } from '../types/tracking';

const EARTH_RADIUS_METERS = 6371000;
export const GPS_ACCURACY_THRESHOLD_METERS = 15; // Preferred GPS horizontal accuracy threshold (meters)
export const GPS_ACCURACY_FALLBACK_THRESHOLD_METERS = 20; // Configurable fallback threshold for challenging environments
export const GPS_OPTIMAL_LOCK_METERS = 15; // Optimal precision lock threshold
export const MIN_SPEED_THRESHOLD_MPS = 0.5; // 0.5 m/s (~1.8 km/h) stationary cutoff
export const MIN_DISTANCE_DELTA_METERS = 2.0; // Minimum distance from anchor to evaluate movement
export const MAX_REASONABLE_RUNNING_SPEED_MPS = 8.0; // ~28.8 km/h upper bound for implied speed (teleportation guard)
export const MAX_GPS_GAP_SECONDS = 15.0; // Max allowed gap before establishing a new anchor

/**
 * Calculates distance between two coordinates in meters using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Validates whether a GPS point satisfies precision thresholds.
 * Note: accuracy represents estimated horizontal accuracy, not an exact error radius.
 */
export function isValidGpsPoint(
  coord: GpsCoordinate,
  threshold: number = GPS_ACCURACY_THRESHOLD_METERS
): boolean {
  if (coord.accuracy === null || coord.accuracy === undefined || coord.accuracy <= 0) {
    return false;
  }
  return coord.accuracy <= threshold;
}

/**
 * Computes instantaneous pace in seconds per kilometer from Doppler speed (m/s).
 * Returns null if stationary or invalid.
 */
export function speedToPace(speedMps: number | null): number | null {
  if (speedMps === null || speedMps === undefined || speedMps < MIN_SPEED_THRESHOLD_MPS) {
    return null;
  }
  // 1000 meters / speed in m/s = seconds to cover 1 km
  const paceSeconds = 1000 / speedMps;
  // Cap at reasonable running bounds (e.g., slower than 20:00/km is walking standstill, faster than 1:30/km is vehicle anomaly)
  if (paceSeconds > 1200 || paceSeconds < 90) {
    return null;
  }
  return paceSeconds;
}

/**
 * Computes average pace in seconds per kilometer given total moving seconds and distance in meters.
 */
export function calculateAveragePace(
  durationSeconds: number,
  distanceMeters: number
): number | null {
  if (distanceMeters < 30 || durationSeconds <= 0) {
    return null;
  }
  const distanceKm = distanceMeters / 1000;
  return durationSeconds / distanceKm;
}

/**
 * Formats pace in seconds/km to standard running notation: M'SS" (e.g. 5'24")
 */
export function formatPace(paceSeconds: number | null): string {
  if (paceSeconds === null || !isFinite(paceSeconds) || paceSeconds <= 0) {
    return `--'--"`;
  }
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

/**
 * Formats distance in meters to kilometers with 2 decimal places (e.g. 4.25).
 */
export function formatDistanceKm(distanceMeters: number): string {
  const km = distanceMeters / 1000;
  return km.toFixed(2);
}

/**
 * Formats seconds into HH:MM:SS or MM:SS stopwatch format.
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
