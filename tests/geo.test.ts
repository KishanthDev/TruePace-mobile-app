import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineDistance,
  isValidGpsPoint,
  speedToPace,
  calculateAveragePace,
  isStationaryReading,
  formatPace,
  formatDistanceKm,
  formatDuration,
} from '../src/utils/geo';
import type { GpsCoordinate } from '../src/types/tracking';

describe('Geo Utilities — Haversine Distance', () => {
  test('returns 0 for identical coordinates', () => {
    const dist = calculateHaversineDistance(51.5074, -0.1278, 51.5074, -0.1278);
    assert.equal(dist, 0);
  });

  test('calculates 1 degree of latitude accurately (~111.19 km)', () => {
    const dist = calculateHaversineDistance(0, 0, 1, 0);
    // 1 deg on spherical earth with R=6371000 is ~111,194.9 meters
    assert.ok(Math.abs(dist - 111195) < 10, `Expected ~111195m, got ${dist}`);
  });

  test('calculates known distance between London and Paris (~343 km)', () => {
    const london = { lat: 51.5074, lon: -0.1278 };
    const paris = { lat: 48.8566, lon: 2.3522 };
    const dist = calculateHaversineDistance(london.lat, london.lon, paris.lat, paris.lon);
    assert.ok(dist > 343000 && dist < 345000, `Expected ~343-345km, got ${dist}`);
  });

  test('measures micro movements with sub-meter precision', () => {
    // 0.00002 degrees latitude delta is ~2.22 meters
    const dist = calculateHaversineDistance(12.9716, 77.5946, 12.97162, 77.5946);
    assert.ok(dist > 2.0 && dist < 2.5, `Expected ~2.22m, got ${dist}`);
  });
});

describe('Geo Utilities — GPS Point Validation', () => {
  const baseCoord: GpsCoordinate = {
    latitude: 12.9716,
    longitude: 77.5946,
    altitude: 920,
    accuracy: 10,
    speed: 3.2,
    heading: 90,
    timestamp: 1700000000000,
  };

  test('accepts coordinate when accuracy <= preferred threshold (15m)', () => {
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: 12 }, 15), true);
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: 15 }, 15), true);
  });

  test('rejects coordinate when accuracy > threshold', () => {
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: 16 }, 15), false);
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: 50 }, 15), false);
  });

  test('rejects coordinate with null, undefined, or non-positive accuracy', () => {
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: null }, 15), false);
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: 0 }, 15), false);
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: -5 }, 15), false);
  });

  test('supports configurable fallback threshold (20m)', () => {
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: 18 }, 20), true);
    assert.equal(isValidGpsPoint({ ...baseCoord, accuracy: 22 }, 20), false);
  });
});

describe('Geo Utilities — Instantaneous Doppler Pace', () => {
  test('returns null when stationary (< 0.5 m/s)', () => {
    assert.equal(speedToPace(0), null);
    assert.equal(speedToPace(0.2), null);
    assert.equal(speedToPace(0.49), null);
  });

  test('returns null for null, undefined, or negative speed', () => {
    assert.equal(speedToPace(null), null);
    assert.equal(speedToPace(-1.0), null);
  });

  test('computes pace correctly for realistic running speeds', () => {
    // 2.7778 m/s = 10 km/h -> 360 s/km (6'00"/km)
    const pace10kmh = speedToPace(2.7778);
    assert.ok(pace10kmh !== null);
    assert.equal(Math.round(pace10kmh!), 360);

    // 3.3333 m/s = 12 km/h -> 300 s/km (5'00"/km)
    const pace12kmh = speedToPace(3.3333);
    assert.ok(pace12kmh !== null);
    assert.equal(Math.round(pace12kmh!), 300);

    // 4.1667 m/s = 15 km/h -> 240 s/km (4'00"/km)
    const pace15kmh = speedToPace(4.1667);
    assert.ok(pace15kmh !== null);
    assert.equal(Math.round(pace15kmh!), 240);
  });

  test('filters out extreme vehicle anomalies and walking standstill bounds', () => {
    // Speed > 11.1 m/s (pace < 90 s/km = faster than 1'30"/km)
    assert.equal(speedToPace(15.0), null);
    // Speed < 0.83 m/s (pace > 1200 s/km = slower than 20'00"/km)
    assert.equal(speedToPace(0.7), null);
  });
});

describe('Geo Utilities — Average Pace', () => {
  test('returns null if distance < 30m or duration <= 0', () => {
    assert.equal(calculateAveragePace(60, 25), null);
    assert.equal(calculateAveragePace(0, 500), null);
    assert.equal(calculateAveragePace(-10, 500), null);
  });

  test('calculates correct average pace for valid workouts', () => {
    // 1000m in 300s -> 300 s/km (5'00"/km)
    assert.equal(calculateAveragePace(300, 1000), 300);

    // 5000m in 1350s (22:30 5K) -> 270 s/km (4'30"/km)
    assert.equal(calculateAveragePace(1350, 5000), 270);
  });
});

describe('Geo Utilities — String Formatting', () => {
  test('formatPace renders M\'SS" and handles null/invalid', () => {
    assert.equal(formatPace(null), `--'--"`);
    assert.equal(formatPace(0), `--'--"`);
    assert.equal(formatPace(300), `5'00"`);
    assert.equal(formatPace(324), `5'24"`);
    assert.equal(formatPace(275), `4'35"`);
  });

  test('formatDistanceKm formats to 2 decimal places', () => {
    assert.equal(formatDistanceKm(0), '0.00');
    assert.equal(formatDistanceKm(950), '0.95');
    assert.equal(formatDistanceKm(1000), '1.00');
    assert.equal(formatDistanceKm(42195), '42.20');
  });

  test('formatDuration formats MM:SS and HH:MM:SS', () => {
    assert.equal(formatDuration(0), '00:00');
    assert.equal(formatDuration(54), '00:54');
    assert.equal(formatDuration(305), '05:05');
    assert.equal(formatDuration(3600), '1:00:00');
    assert.equal(formatDuration(3665), '1:01:05');
  });
});

describe('Geo Utilities — Stationary Drift & Multipath Protection', () => {
  test('rejects indoor jitter when Doppler speed confirms stationary (< 0.55 m/s)', () => {
    // Typical indoor room scenario: Doppler speed is 0.05 m/s, but coordinate bounced 3.5m in 1s
    const isStationary = isStationaryReading({
      rawSpeed: 0.05,
      impliedSpeed: 3.5,
      deltaMeters: 3.5,
      accuracy: 12,
      isStartOfRun: false,
    });
    assert.equal(isStationary, true);
  });

  test('rejects indoor jitter when Doppler is null and jump is inside accuracy circle', () => {
    // Indoor phone without Doppler speed: 3.2m jump inside 14m accuracy envelope
    const isStationary = isStationaryReading({
      rawSpeed: null,
      impliedSpeed: 3.2,
      deltaMeters: 3.2,
      accuracy: 14,
      isStartOfRun: false,
    });
    assert.equal(isStationary, true);
  });

  test('rejects initial start-of-run fidgeting before runner takes first genuine step', () => {
    // Runner standing still in a room when pressing START RUN
    const isStationary = isStationaryReading({
      rawSpeed: 0.1,
      impliedSpeed: 2.5,
      deltaMeters: 2.5,
      accuracy: 10,
      isStartOfRun: true,
    });
    assert.equal(isStationary, true);
  });

  test('accepts genuine running movement outdoors (Doppler confirmed)', () => {
    // Runner jogging outdoors at 2.8 m/s (~10 km/h) with 2.8m delta in 1s
    const isStationary = isStationaryReading({
      rawSpeed: 2.8,
      impliedSpeed: 2.8,
      deltaMeters: 2.8,
      accuracy: 5,
      isStartOfRun: false,
    });
    assert.equal(isStationary, false);
  });

  test('accepts genuine start-of-run acceleration when runner starts jogging', () => {
    // Runner starts jogging at 2.2 m/s
    const isStationary = isStationaryReading({
      rawSpeed: 2.2,
      impliedSpeed: 2.2,
      deltaMeters: 2.5,
      accuracy: 6,
      isStartOfRun: true,
    });
    assert.equal(isStationary, false);
  });

  test('suppresses stationary drift when runner stops at a traffic light', () => {
    // Runner halted at a red light: Doppler speed drops to 0.1 m/s, jitter is 2.8m
    const isStationary = isStationaryReading({
      rawSpeed: 0.1,
      impliedSpeed: 2.8,
      deltaMeters: 2.8,
      accuracy: 8,
      isStartOfRun: false,
    });
    assert.equal(isStationary, true);
  });
});
