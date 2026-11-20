import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertDistance,
  convertPace,
  formatUnitDistance,
  formatUnitPace,
  getUnitLabels,
} from '../src/utils/units';

describe('Units Utility — Distance Conversion', () => {
  test('converts meters to kilometers accurately in metric', () => {
    assert.equal(convertDistance(0, 'metric'), 0);
    assert.equal(convertDistance(1000, 'metric'), 1.0);
    assert.equal(convertDistance(5000, 'metric'), 5.0);
    assert.equal(convertDistance(42195, 'metric'), 42.195);
  });

  test('converts meters to miles accurately in imperial', () => {
    assert.equal(convertDistance(0, 'imperial'), 0);
    // 1609.344 meters is exactly 1 mile
    assert.equal(convertDistance(1609.344, 'imperial'), 1.0);
    // 5K in miles: 5000 / 1609.344 = 3.106855...
    const fiveKMiles = convertDistance(5000, 'imperial');
    assert.ok(Math.abs(fiveKMiles - 3.1068) < 0.001);
    // Marathon 42.195 km = 26.2187 miles
    const marathonMiles = convertDistance(42195, 'imperial');
    assert.ok(Math.abs(marathonMiles - 26.2187) < 0.01);
  });

  test('formats distance strings to 2 decimal places in both systems', () => {
    assert.equal(formatUnitDistance(0, 'metric'), '0.00');
    assert.equal(formatUnitDistance(1000, 'metric'), '1.00');
    assert.equal(formatUnitDistance(5000, 'imperial'), '3.11');
    assert.equal(formatUnitDistance(1609.344, 'imperial'), '1.00');
  });
});

describe('Units Utility — Pace Conversion', () => {
  test('returns identical pace in metric (seconds/km)', () => {
    assert.equal(convertPace(300, 'metric'), 300);
    assert.equal(convertPace(null, 'metric'), null);
    assert.equal(convertPace(undefined, 'metric'), null);
  });

  test('converts pace from seconds/km to seconds/mile in imperial', () => {
    // 5'00"/km (300 s/km) in min/mile: 300 * 1.609344 = 482.8s = 8'02.8"/mile
    const paceMile = convertPace(300, 'imperial');
    assert.ok(paceMile !== null);
    assert.ok(Math.abs(paceMile! - 482.8) < 0.1);
  });

  test('formats pace strings correctly with M\'SS" notation in both systems', () => {
    assert.equal(formatUnitPace(null, 'metric'), `--'--"`);
    assert.equal(formatUnitPace(null, 'imperial'), `--'--"`);

    // 5'00"/km in metric -> 5'00"
    assert.equal(formatUnitPace(300, 'metric'), `5'00"`);

    // 5'00"/km in imperial -> 8'02" (482.8s)
    assert.equal(formatUnitPace(300, 'imperial'), `8'02"`);

    // 4'00"/km in imperial -> 6'26" (240 * 1.609344 = 386.2s)
    assert.equal(formatUnitPace(240, 'imperial'), `6'26"`);
  });

  test('returns correct unit labels', () => {
    assert.deepEqual(getUnitLabels('metric'), { distanceUnit: 'KM', paceUnit: '/KM' });
    assert.deepEqual(getUnitLabels('imperial'), { distanceUnit: 'MI', paceUnit: '/MI' });
  });
});
