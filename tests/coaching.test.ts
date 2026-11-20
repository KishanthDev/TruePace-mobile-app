import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AiCoachingService } from '../src/services/AiCoachingService';
import type { RunSummary } from '../src/types/tracking';

describe('AI Coaching Service — Local Deterministic Report', () => {
  const service = AiCoachingService.getInstance();

  test('generates negative split coaching report accurately', () => {
    const negativeSplitRun: RunSummary = {
      id: 'test_neg',
      startTime: 1700000000000,
      endTime: 1700001800000,
      durationSeconds: 1500,
      distanceMeters: 5000,
      avgPaceSecondsPerKm: 300,
      bestPaceSecondsPerKm: 280,
      maxSpeedMps: 3.6,
      splits: [315, 310, 300, 290, 285],
      consistencyScore: 92,
      consistencyLabel: 'Metronomic',
      isNegativeSplit: true,
    };

    const report = service.generateLocalCoachingReport(negativeSplitRun);
    assert.equal(report.pacingEvaluation.pacingStrategy, 'negative_split');
    assert.equal(report.pacingEvaluation.consistencyGrade, 'A');
    assert.ok(report.summaryTitle.includes('Negative Split'));
    assert.ok(report.recoveryAdvice.recommendedRestHours >= 24);
  });

  test('identifies fatigue onset kilometer during positive split fade', () => {
    // KM 1-3 strong at ~300s, KM 4 collapses to 335s (+11% degradation)
    const fadingRun: RunSummary = {
      id: 'test_fade',
      startTime: 1700000000000,
      endTime: 1700001800000,
      durationSeconds: 1600,
      distanceMeters: 5000,
      avgPaceSecondsPerKm: 320,
      bestPaceSecondsPerKm: 295,
      maxSpeedMps: 3.4,
      splits: [300, 298, 302, 335, 345],
      consistencyScore: 72,
      consistencyLabel: 'Varied',
      isNegativeSplit: false,
    };

    const report = service.generateLocalCoachingReport(fadingRun);
    assert.equal(report.pacingEvaluation.pacingStrategy, 'positive_split');
    assert.equal(report.pacingEvaluation.fatigueOnsetKilometer, 4);
    assert.ok(report.summaryTitle.includes('KM 4') || report.pacingEvaluation.observation.includes('kilometer 4'));
  });

  test('estimates higher recovery window for long distance endurance runs', () => {
    const halfMarathon: RunSummary = {
      id: 'test_hm',
      startTime: 1700000000000,
      endTime: 1700007200000,
      durationSeconds: 6600, // 1h 50m
      distanceMeters: 21100, // Half marathon
      avgPaceSecondsPerKm: 312,
      bestPaceSecondsPerKm: 290,
      maxSpeedMps: 3.5,
      splits: new Array(21).fill(312),
      consistencyScore: 98,
      consistencyLabel: 'Metronomic',
      isNegativeSplit: false,
    };

    const report = service.generateLocalCoachingReport(halfMarathon);
    assert.equal(report.performanceCategory, 'threshold');
    assert.equal(report.recoveryAdvice.recommendedRestHours, 48);
    assert.ok(report.recoveryAdvice.hydrationNutritionTip.includes('electrolytes'));
  });

  test('falls back gracefully to local report when cloud endpoint is not provided', async () => {
    const simpleRun: RunSummary = {
      id: 'test_simple',
      startTime: 1700000000000,
      endTime: 1700001200000,
      durationSeconds: 1200,
      distanceMeters: 4000,
      avgPaceSecondsPerKm: 300,
      bestPaceSecondsPerKm: 290,
      maxSpeedMps: 3.4,
      splits: [300, 300, 300, 300],
      consistencyScore: 100,
      consistencyLabel: 'Metronomic',
      isNegativeSplit: false,
    };

    const report = await service.getCoachingReport(simpleRun);
    assert.ok(report !== null);
    assert.equal(report.pacingEvaluation.consistencyGrade, 'A');
    assert.equal(report.pacingEvaluation.pacingStrategy, 'even');
  });
});
