/**
 * TruePace — Workload, ACWR & Race Predictor Engine
 * Implements Acute:Chronic Workload Ratio (ACWR) modeling to prevent overtraining
 * and Pete Riegel's formula for deterministic race time predictions.
 * 100% pure TypeScript, zero external dependencies.
 */

import type { RunSummary } from '../types/tracking';

export type AcwrRiskLevel = 'undertraining' | 'optimal' | 'overreaching' | 'danger';

export interface AcwrReport {
  acuteDistanceMeters: number; // 7-day volume
  chronicDistanceMeters: number; // 28-day total volume
  weeklyChronicAverageMeters: number; // 28-day volume / 4
  acwrRatio: number | null; // acute / weeklyChronicAverage
  riskLevel: AcwrRiskLevel;
  guidance: string;
}

export interface RacePrediction {
  distanceName: '5K' | '10K' | 'Half Marathon' | 'Marathon';
  distanceMeters: number;
  predictedSeconds: number;
  predictedPaceSecondsPerKm: number;
}

export interface WeeklyVolumeReport {
  currentWeekMeters: number;
  previousWeekMeters: number;
  weekOverWeekChangePct: number | null; // e.g., +10%
}

const RIEGEL_EXPONENT = 1.06;

/**
 * Calculates Acute:Chronic Workload Ratio (ACWR) across 7-day vs 28-day window.
 * Reference: Gabbett TJ. The training—injury prevention paradox. Br J Sports Med 2016.
 */
export function calculateAcwr(
  runs: RunSummary[],
  referenceDateMs: number = Date.now()
): AcwrReport {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
  const TWENTY_EIGHT_DAYS_MS = 28 * ONE_DAY_MS;

  let acuteDistance = 0;
  let chronicDistance = 0;

  for (const run of runs) {
    const ageMs = referenceDateMs - run.startTime;
    if (ageMs < 0 || ageMs > TWENTY_EIGHT_DAYS_MS) {
      continue;
    }

    chronicDistance += run.distanceMeters;

    if (ageMs <= SEVEN_DAYS_MS) {
      acuteDistance += run.distanceMeters;
    }
  }

  const weeklyChronicAverage = chronicDistance / 4;

  if (weeklyChronicAverage < 500) {
    // Insufficient chronic baseline
    return {
      acuteDistanceMeters: Math.round(acuteDistance),
      chronicDistanceMeters: Math.round(chronicDistance),
      weeklyChronicAverageMeters: Math.round(weeklyChronicAverage),
      acwrRatio: null,
      riskLevel: 'undertraining',
      guidance: 'Insufficient 4-week mileage history to calculate a reliable workload baseline.',
    };
  }

  const ratio = Math.round((acuteDistance / weeklyChronicAverage) * 100) / 100;

  let riskLevel: AcwrRiskLevel;
  let guidance: string;

  if (ratio < 0.8) {
    riskLevel = 'undertraining';
    guidance = 'Workload is below training stimulus threshold. Fitness maintenance or taper phase.';
  } else if (ratio <= 1.3) {
    riskLevel = 'optimal';
    guidance = 'Optimal training sweet spot! Safe progressive overload with low injury risk.';
  } else if (ratio <= 1.5) {
    riskLevel = 'overreaching';
    guidance = 'Elevated workload. Monitor cumulative fatigue, sleep, and recovery.';
  } else {
    riskLevel = 'danger';
    guidance = 'High risk danger zone! Rapid mileage surge detected. Schedule recovery or reduce volume.';
  }

  return {
    acuteDistanceMeters: Math.round(acuteDistance),
    chronicDistanceMeters: Math.round(chronicDistance),
    weeklyChronicAverageMeters: Math.round(weeklyChronicAverage),
    acwrRatio: ratio,
    riskLevel,
    guidance,
  };
}

/**
 * Predicts target race times using Pete Riegel's endurance formula:
 * T2 = T1 * (D2 / D1)^1.06
 */
export function predictRaceTimes(runs: RunSummary[]): RacePrediction[] {
  // Find the most suitable baseline run (at least 1500m, prefer fastest pace among runs >= 3000m)
  const validRuns = runs.filter((r) => r.distanceMeters >= 1500 && r.durationSeconds > 0);
  if (validRuns.length === 0) return [];

  // Pick the best performance by speed (mps)
  let bestRun = validRuns[0];
  let bestSpeed = bestRun.distanceMeters / bestRun.durationSeconds;

  for (const r of validRuns) {
    const speed = r.distanceMeters / r.durationSeconds;
    if (speed > bestSpeed) {
      bestSpeed = speed;
      bestRun = r;
    }
  }

  const t1 = bestRun.durationSeconds;
  const d1 = bestRun.distanceMeters;

  const TARGETS: { name: '5K' | '10K' | 'Half Marathon' | 'Marathon'; dist: number }[] = [
    { name: '5K', dist: 5000 },
    { name: '10K', dist: 10000 },
    { name: 'Half Marathon', dist: 21097.5 },
    { name: 'Marathon', dist: 42195 },
  ];

  return TARGETS.map(({ name, dist }) => {
    // T2 = T1 * (D2 / D1)^1.06
    const predictedSecs = Math.round(t1 * Math.pow(dist / d1, RIEGEL_EXPONENT));
    const paceSecsPerKm = Math.round(predictedSecs / (dist / 1000));

    return {
      distanceName: name,
      distanceMeters: dist,
      predictedSeconds: predictedSecs,
      predictedPaceSecondsPerKm: paceSecsPerKm,
    };
  });
}

/**
 * Calculates current week vs previous week volume progression.
 */
export function calculateWeeklyVolume(
  runs: RunSummary[],
  referenceDateMs: number = Date.now()
): WeeklyVolumeReport {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
  const FOURTEEN_DAYS_MS = 14 * ONE_DAY_MS;

  let currentWeek = 0;
  let previousWeek = 0;

  for (const run of runs) {
    const ageMs = referenceDateMs - run.startTime;
    if (ageMs < 0 || ageMs > FOURTEEN_DAYS_MS) continue;

    if (ageMs <= SEVEN_DAYS_MS) {
      currentWeek += run.distanceMeters;
    } else {
      previousWeek += run.distanceMeters;
    }
  }

  let changePct: number | null = null;
  if (previousWeek > 500) {
    changePct = Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
  }

  return {
    currentWeekMeters: Math.round(currentWeek),
    previousWeekMeters: Math.round(previousWeek),
    weekOverWeekChangePct: changePct,
  };
}
