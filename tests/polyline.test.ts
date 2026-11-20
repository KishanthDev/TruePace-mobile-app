/**
 * TruePace — Polyline & Elevation Utilities Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  simplifyPolyline,
  calculateElevationProfile,
  projectCoordinatesToViewport,
} from '../src/utils/polyline';
import type { BreadcrumbPoint } from '../src/types/tracking';

describe('Polyline Utilities — Douglas-Peucker Simplification', () => {
  it('returns original points when array length is <= 2', () => {
    const single: BreadcrumbPoint[] = [
      { latitude: 37.7749, longitude: -122.4194, timestamp: 1000 },
    ];
    assert.deepEqual(simplifyPolyline(single), single);

    const twoPoints: BreadcrumbPoint[] = [
      { latitude: 37.7749, longitude: -122.4194, timestamp: 1000 },
      { latitude: 37.7750, longitude: -122.4195, timestamp: 2000 },
    ];
    assert.deepEqual(simplifyPolyline(twoPoints), twoPoints);
  });

  it('simplifies collinear points down to start and end points', () => {
    // Perfectly straight line of 5 points
    const points: BreadcrumbPoint[] = [
      { latitude: 37.0, longitude: -122.0, timestamp: 1000 },
      { latitude: 37.001, longitude: -122.001, timestamp: 2000 },
      { latitude: 37.002, longitude: -122.002, timestamp: 3000 },
      { latitude: 37.003, longitude: -122.003, timestamp: 4000 },
      { latitude: 37.004, longitude: -122.004, timestamp: 5000 },
    ];

    const simplified = simplifyPolyline(points, 5.0);
    assert.equal(simplified.length, 2);
    assert.equal(simplified[0].latitude, 37.0);
    assert.equal(simplified[1].latitude, 37.004);
  });

  it('preserves sharp corners that exceed the tolerance threshold', () => {
    // L-shaped detour: (0, 0) -> (0.01, 0) -> (0.01, 0.01)
    const points: BreadcrumbPoint[] = [
      { latitude: 37.0, longitude: -122.0, timestamp: 1000 },
      { latitude: 37.005, longitude: -122.0, timestamp: 2000 }, // ~550m north
      { latitude: 37.005, longitude: -122.005, timestamp: 3000 }, // ~440m west
    ];

    const simplified = simplifyPolyline(points, 10.0);
    // All 3 must be kept because the corner is ~400m from the direct hypotenuse
    assert.equal(simplified.length, 3);
  });
});

describe('Polyline Utilities — Elevation Profiling', () => {
  it('returns 0 gain and loss for empty or single point lists', () => {
    const res = calculateElevationProfile([]);
    assert.deepEqual(res, { gainMeters: 0, lossMeters: 0 });
  });

  it('filters out GPS altitude noise below 3 meters threshold', () => {
    const noisyPoints: BreadcrumbPoint[] = [
      { latitude: 37.0, longitude: -122.0, altitude: 100, timestamp: 1000 },
      { latitude: 37.001, longitude: -122.0, altitude: 101.5, timestamp: 2000 }, // +1.5m (noise)
      { latitude: 37.002, longitude: -122.0, altitude: 99.2, timestamp: 3000 }, // -2.3m (noise)
      { latitude: 37.003, longitude: -122.0, altitude: 100.8, timestamp: 4000 }, // +1.6m (noise)
    ];

    const { gainMeters, lossMeters } = calculateElevationProfile(noisyPoints, 3.0);
    assert.equal(gainMeters, 0);
    assert.equal(lossMeters, 0);
  });

  it('accumulates genuine elevation gains exceeding noise threshold', () => {
    const hillPoints: BreadcrumbPoint[] = [
      { latitude: 37.0, longitude: -122.0, altitude: 100, timestamp: 1000 },
      { latitude: 37.001, longitude: -122.0, altitude: 115, timestamp: 2000 }, // +15m gain
      { latitude: 37.002, longitude: -122.0, altitude: 130, timestamp: 3000 }, // +15m gain
      { latitude: 37.003, longitude: -122.0, altitude: 110, timestamp: 4000 }, // -20m loss
    ];

    const { gainMeters, lossMeters } = calculateElevationProfile(hillPoints, 3.0);
    assert.equal(gainMeters, 30);
    assert.equal(lossMeters, 20);
  });
});

describe('Polyline Utilities — Viewport Projection', () => {
  it('projects geographic coordinates inside given viewport dimensions', () => {
    const points: BreadcrumbPoint[] = [
      { latitude: 37.0, longitude: -122.0, timestamp: 1000 },
      { latitude: 37.01, longitude: -122.01, timestamp: 2000 },
    ];

    const width = 300;
    const height = 200;
    const padding = 10;
    const projected = projectCoordinatesToViewport(points, width, height, padding);

    assert.equal(projected.length, 2);
    for (const pt of projected) {
      assert.ok(pt.x >= padding && pt.x <= width - padding);
      assert.ok(pt.y >= padding && pt.y <= height - padding);
    }
  });
});
