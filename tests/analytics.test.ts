import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePaceConsistency,
  isNegativeSplit,
  evaluatePersonalRecords,
  DEFAULT_PERSONAL_RECORDS,
} from '../src/utils/analytics';
import type { RunSummary } from '../src/types/tracking';

describe('Analytics Engine — Pace Consistency Index (PCI)', () => {
  test('returns null when fewer than 2 splits are provided', () => {
    assert.equal(calculatePaceConsistency(undefined), null);
    assert.equal(calculatePaceConsistency([]), null);
    assert.equal(calculatePaceConsistency([300]), null);
  });

  test('scores 100 (Metronomic) for perfectly identical splits', () => {
    const result = calculatePaceConsistency([300, 300, 300, 300]);
    assert.ok(result !== null);
    assert.equal(result!.score, 100);
    assert.equal(result!.label, 'Metronomic');
    assert.equal(result!.standardDeviationSeconds, 0);
  });

  test('scores high (Metronomic) for tight pacing (within 1-2%)', () => {
    const result = calculatePaceConsistency([301, 299, 300, 302, 298]);
    assert.ok(result !== null);
    assert.ok(result!.score >= 95, `Expected >= 95, got ${result!.score}`);
    assert.equal(result!.label, 'Metronomic');
  });

  test('identifies varied and erratic pacing correctly', () => {
    // Varied splits: ~15% variance
    const varied = calculatePaceConsistency([250, 350, 260, 360]);
    assert.ok(varied !== null);
    assert.ok(varied!.score >= 70 && varied!.score <= 80, `Expected 70-80, got ${varied!.score}`);
    assert.equal(varied!.label, 'Varied');

    // Highly erratic splits: massive surges and collapses (> 35% variance)
    const erratic = calculatePaceConsistency([200, 450, 220, 480]);
    assert.ok(erratic !== null);
    assert.ok(erratic!.score < 60, `Expected < 60, got ${erratic!.score}`);
    assert.equal(erratic!.label, 'Erratic');
  });
});

describe('Analytics Engine — Negative Split Detection', () => {
  test('returns false for runs with fewer than 2 splits', () => {
    assert.equal(isNegativeSplit(undefined), false);
    assert.equal(isNegativeSplit([300]), false);
  });

  test('returns false for positive splits (second half slower)', () => {
    // KM 1-2 fast, KM 3-4 fading
    assert.equal(isNegativeSplit([280, 285, 320, 330]), false);
  });

  test('returns false for even splits within 1.5s margin', () => {
    assert.equal(isNegativeSplit([300, 300, 300, 299]), false);
  });

  test('detects genuine negative splits (second half faster)', () => {
    // First half avg: 310s/km, Second half avg: 295s/km
    assert.equal(isNegativeSplit([312, 308, 298, 292]), true);

    // 5K with strong progression
    assert.equal(isNegativeSplit([330, 325, 320, 305, 290]), true);
  });
});

describe('Analytics Engine — Personal Records (PR) Evaluation', () => {
  const mockRunBase: RunSummary = {
    id: 'test_run_1',
    startTime: 1700000000000,
    endTime: 1700001800000,
    durationSeconds: 1500, // 25 mins
    distanceMeters: 5000,  // 5K
    avgPaceSecondsPerKm: 300,
    bestPaceSecondsPerKm: 270,
    maxSpeedMps: 3.7,
    splits: [310, 305, 300, 295, 290], // min split 290s
  };

  test('detects all initial PRs on first completed run', () => {
    const { updatedRecords, newRecordKeys } = evaluatePersonalRecords(
      mockRunBase,
      DEFAULT_PERSONAL_RECORDS
    );

    assert.ok(newRecordKeys.includes('longestDistance'));
    assert.ok(newRecordKeys.includes('longestDuration'));
    assert.ok(newRecordKeys.includes('fastest1k'));
    assert.ok(newRecordKeys.includes('fastest5k'));
    assert.equal(updatedRecords.longestDistanceMeters, 5000);
    assert.equal(updatedRecords.fastest1kSeconds, 290);
    assert.equal(updatedRecords.fastest5kSeconds, 1500);
  });

  test('detects new fastest 1K when beating previous record', () => {
    const initialRecords = {
      ...DEFAULT_PERSONAL_RECORDS,
      longestDistanceMeters: 10000,
      longestDurationSeconds: 3600,
      fastest1kSeconds: 290,
      fastest5kSeconds: 1500,
    };

    const faster1kRun: RunSummary = {
      ...mockRunBase,
      splits: [300, 280, 295], // 280s is faster than 290s
    };

    const { updatedRecords, newRecordKeys } = evaluatePersonalRecords(faster1kRun, initialRecords);
    assert.ok(newRecordKeys.includes('fastest1k'));
    assert.equal(updatedRecords.fastest1kSeconds, 280);
    assert.ok(!newRecordKeys.includes('longestDistance')); // Did not beat 10000m
  });

  test('ignores runs under 5K for 5K record detection', () => {
    const shortFastRun: RunSummary = {
      ...mockRunBase,
      distanceMeters: 3000, // Only 3K
      durationSeconds: 750, // 4'10"/km pace
      splits: [250, 250, 250],
    };

    const { newRecordKeys } = evaluatePersonalRecords(shortFastRun, DEFAULT_PERSONAL_RECORDS);
    assert.ok(!newRecordKeys.includes('fastest5k'));
    assert.ok(newRecordKeys.includes('fastest1k')); // 250s is still fastest 1k
  });
});
