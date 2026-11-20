/**
 * TruePace — Workload, ACWR & Race Predictor Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAcwr,
  predictRaceTimes,
  calculateWeeklyVolume,
} from '../src/utils/workload';
import type { RunSummary } from '../src/types/tracking';

const NOW = 1700000000000;
const ONE_DAY = 24 * 60 * 60 * 1000;

function createMockRun(daysAgo: number, distanceMeters: number, durationSeconds: number): RunSummary {
  return {
    id: `run-${daysAgo}`,
    startTime: NOW - daysAgo * ONE_DAY,
    endTime: NOW - daysAgo * ONE_DAY + durationSeconds * 1000,
    durationSeconds,
    distanceMeters,
    avgPaceSecondsPerKm: Math.round(durationSeconds / (distanceMeters / 1000)),
    bestPaceSecondsPerKm: 300,
    maxSpeedMps: 3.3,
  };
}

describe('Workload Engine — Acute:Chronic Workload Ratio (ACWR)', () => {
  it('returns insufficient baseline when history is empty', () => {
    const report = calculateAcwr([], NOW);
    assert.equal(report.acwrRatio, null);
    assert.equal(report.riskLevel, 'undertraining');
    assert.equal(report.acuteDistanceMeters, 0);
  });

  it('calculates optimal ratio (~1.0) when acute volume matches weekly chronic average', () => {
    // 4 weeks of consistent 20,000m per week (total chronic = 80,000m, weekly chronic avg = 20,000m)
    // Run 1: 2 days ago (20,000m)
    // Run 2: 9 days ago (20,000m)
    // Run 3: 16 days ago (20,000m)
    // Run 4: 23 days ago (20,000m)
    const runs = [
      createMockRun(2, 20000, 7200),
      createMockRun(9, 20000, 7200),
      createMockRun(16, 20000, 7200),
      createMockRun(23, 20000, 7200),
    ];

    const report = calculateAcwr(runs, NOW);
    assert.equal(report.acuteDistanceMeters, 20000);
    assert.equal(report.chronicDistanceMeters, 80000);
    assert.equal(report.weeklyChronicAverageMeters, 20000);
    assert.equal(report.acwrRatio, 1.0);
    assert.equal(report.riskLevel, 'optimal');
  });

  it('detects dangerous volume spike when acute mileage surges (> 1.5)', () => {
    // Week 4, 3, 2 were 10,000m each (30,000m total).
    // Current week surges to 35,000m!
    // Total chronic = 65,000m. Weekly avg = 16,250m.
    // Ratio = 35,000 / 16,250 = 2.15 (danger!)
    const runs = [
      createMockRun(1, 35000, 12600),
      createMockRun(10, 10000, 3600),
      createMockRun(17, 10000, 3600),
      createMockRun(24, 10000, 3600),
    ];

    const report = calculateAcwr(runs, NOW);
    assert.ok(report.acwrRatio !== null && report.acwrRatio > 1.5);
    assert.equal(report.riskLevel, 'danger');
  });
});

describe('Workload Engine — Pete Riegel Race Time Predictor', () => {
  it('returns empty predictions if no runs >= 1500m exist', () => {
    const runs = [createMockRun(1, 1000, 360)];
    assert.deepEqual(predictRaceTimes(runs), []);
  });

  it('accurately predicts 10K, Half, and Marathon from a 5K performance', () => {
    // 5000m in 1500s (25:00, 5:00/km)
    const runs = [createMockRun(1, 5000, 1500)];
    const predictions = predictRaceTimes(runs);

    assert.equal(predictions.length, 4);

    const p5k = predictions.find((p) => p.distanceName === '5K');
    const p10k = predictions.find((p) => p.distanceName === '10K');
    const pHalf = predictions.find((p) => p.distanceName === 'Half Marathon');
    const pFull = predictions.find((p) => p.distanceName === 'Marathon');

    assert.ok(p5k && p10k && pHalf && pFull);

    // 5K prediction should equal the baseline time
    assert.equal(p5k.predictedSeconds, 1500);

    // 10K = 1500 * (10000/5000)^1.06 = 1500 * 2^1.06 = ~3127s (52m 07s)
    assert.ok(Math.abs(p10k.predictedSeconds - 3127) <= 2);

    // Half Marathon (21.0975km) pace should be slightly slower than 10K pace
    assert.ok(pHalf.predictedPaceSecondsPerKm > p10k.predictedPaceSecondsPerKm);

    // Marathon (42.195km) pace should be slower than Half Marathon pace
    assert.ok(pFull.predictedPaceSecondsPerKm > pHalf.predictedPaceSecondsPerKm);
  });
});

describe('Workload Engine — Weekly Volume Progression', () => {
  it('computes current vs previous week distance and percentage change', () => {
    const runs = [
      createMockRun(2, 12000, 4320), // Current week
      createMockRun(9, 10000, 3600), // Previous week
    ];

    const volume = calculateWeeklyVolume(runs, NOW);
    assert.equal(volume.currentWeekMeters, 12000);
    assert.equal(volume.previousWeekMeters, 10000);
    assert.equal(volume.weekOverWeekChangePct, 20); // +20%
  });
});
