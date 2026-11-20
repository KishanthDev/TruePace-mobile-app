/**
 * TruePace — Polyline Simplification & Elevation Utilities
 * Implements the Ramer-Douglas-Peucker algorithm for downsampling GPS breadcrumbs
 * and provides altitude noise filtering to compute genuine elevation gain/loss.
 * 100% pure TypeScript, zero dependencies.
 */

import type { BreadcrumbPoint } from '../types/tracking';

/**
 * Calculates perpendicular distance from a point to a line segment defined by p1 and p2.
 * Uses Euclidean approximation in projected meters, sufficient for local GPS paths.
 */
function perpendicularDistance(
  p: BreadcrumbPoint,
  p1: BreadcrumbPoint,
  p2: BreadcrumbPoint
): number {
  // Rough local metric projection (1 deg lat ~= 111,000m, 1 deg lon ~= 111,000 * cos(lat)m)
  const latFactor = 111000;
  const avgLatRad = ((p1.latitude + p2.latitude) / 2) * (Math.PI / 180);
  const lonFactor = 111000 * Math.cos(avgLatRad);

  const x = (p.longitude - p1.longitude) * lonFactor;
  const y = (p.latitude - p1.latitude) * latFactor;

  const dx = (p2.longitude - p1.longitude) * lonFactor;
  const dy = (p2.latitude - p1.latitude) * latFactor;

  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    return Math.sqrt(x * x + y * y);
  }

  // Projection scalar t of point p onto line p1-p2
  const t = Math.max(0, Math.min(1, (x * dx + y * dy) / segmentLengthSquared));
  const projX = t * dx;
  const projY = t * dy;

  const distSq = (x - projX) * (x - projX) + (y - projY) * (y - projY);
  return Math.sqrt(distSq);
}

/**
 * Ramer-Douglas-Peucker simplification algorithm.
 * Reduces the number of points in a curve that are within tolerance distance.
 *
 * @param points Array of breadcrumb points
 * @param toleranceMeters Maximum distance tolerance in meters (default 5.0m)
 */
export function simplifyPolyline(
  points: BreadcrumbPoint[],
  toleranceMeters: number = 5.0
): BreadcrumbPoint[] {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let maxIndex = 0;
  const lastIndex = points.length - 1;

  for (let i = 1; i < lastIndex; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[lastIndex]);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }

  if (maxDistance > toleranceMeters) {
    const left = simplifyPolyline(points.slice(0, maxIndex + 1), toleranceMeters);
    const right = simplifyPolyline(points.slice(maxIndex), toleranceMeters);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[lastIndex]];
}

/**
 * Computes cumulative elevation gain and loss from breadcrumb altitude readings.
 * Employs a hysteresis noise threshold (e.g., 3.0 meters) to avoid false elevation
 * caused by vertical GNSS satellite jitter.
 */
export function calculateElevationProfile(
  points: BreadcrumbPoint[],
  noiseThresholdMeters: number = 3.0
): { gainMeters: number; lossMeters: number } {
  if (!points || points.length < 2) {
    return { gainMeters: 0, lossMeters: 0 };
  }

  let gain = 0;
  let loss = 0;
  let lastAltitude: number | null = null;

  for (const pt of points) {
    if (pt.altitude === null || pt.altitude === undefined || isNaN(pt.altitude)) {
      continue;
    }

    if (lastAltitude === null) {
      lastAltitude = pt.altitude;
      continue;
    }

    const diff = pt.altitude - lastAltitude;
    if (Math.abs(diff) >= noiseThresholdMeters) {
      if (diff > 0) {
        gain += diff;
      } else {
        loss += Math.abs(diff);
      }
      lastAltitude = pt.altitude;
    }
  }

  return {
    gainMeters: Math.round(gain),
    lossMeters: Math.round(loss),
  };
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Normalizes an array of geographic points to fit within a rectangular 2D viewport
 * preserving true geographic aspect ratio.
 */
export function projectCoordinatesToViewport(
  points: BreadcrumbPoint[],
  viewWidth: number,
  viewHeight: number,
  padding: number = 16
): ScreenPoint[] {
  if (!points || points.length === 0) return [];

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLon = points[0].longitude;
  let maxLon = points[0].longitude;

  for (const pt of points) {
    if (pt.latitude < minLat) minLat = pt.latitude;
    if (pt.latitude > maxLat) maxLat = pt.latitude;
    if (pt.longitude < minLon) minLon = pt.longitude;
    if (pt.longitude > maxLon) maxLon = pt.longitude;
  }

  const usableWidth = Math.max(10, viewWidth - padding * 2);
  const usableHeight = Math.max(10, viewHeight - padding * 2);

  // Equalize aspect ratio using local latitude cos projection
  const avgLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(avgLat);

  const geoWidth = Math.max(0.00001, (maxLon - minLon) * cosLat);
  const geoHeight = Math.max(0.00001, maxLat - minLat);

  const scale = Math.min(usableWidth / geoWidth, usableHeight / geoHeight);

  const offsetX = padding + (usableWidth - geoWidth * scale) / 2;
  const offsetY = padding + (usableHeight - geoHeight * scale) / 2;

  return points.map((pt) => {
    const x = offsetX + (pt.longitude - minLon) * cosLat * scale;
    // Invert Y because screen coordinates increase downwards
    const y = offsetY + (maxLat - pt.latitude) * scale;
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    };
  });
}
