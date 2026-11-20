/**
 * TruePace — Intelligent Running Analytics Engine
 * Pure mathematical functions for pace consistency, split variances, and personal records.
 * Zero external dependencies.
 */

import type { RunSummary } from '../types/tracking';

export interface ConsistencyEvaluation {
  score: number; // 0 to 100
  label: 'Metronomic' | 'Consistent' | 'Varied' | 'Erratic';
  standardDeviationSeconds: number;
}

export interface PersonalRecords {
  fastest1kSeconds: number | null;
  fastest5kSeconds: number | null;
  fastest10kSeconds: number | null;
  longestDistanceMeters: number;
  longestDurationSeconds: number;
}

export type PersonalRecordType =
  | 'fastest1k'
  | 'fastest5k'
  | 'fastest10k'
  | 'longestDistance'
  | 'longestDuration';

export const DEFAULT_PERSONAL_RECORDS: PersonalRecords = {
  fastest1kSeconds: null,
  fastest5kSeconds: null,
  fastest10kSeconds: null,
  longestDistanceMeters: 0,
  longestDurationSeconds: 0,
};

/**
 * Calculates the Pace Consistency Index (PCI) from kilometer split times.
 * Returns null if fewer than 2 splits exist.
 */
export function calculatePaceConsistency(splits: number[] | undefined): ConsistencyEvaluation | null {
  if (!splits || splits.length < 2) {
    return null;
  }

  const n = splits.length;
  const mean = splits.reduce((acc, val) => acc + val, 0) / n;
  if (mean <= 0) return null;

  const variance = splits.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Coefficient of Variation = stdDev / mean
  const cv = stdDev / mean;

  // Normalized score: 100 for 0% variation, drops as CV increases
  // E.g. CV of 0.05 (5%) -> ~92, CV of 0.15 (15%) -> ~77, CV > 0.40 -> ~40
  const score = Math.max(0, Math.min(100, Math.round(100 - cv * 150)));

  let label: ConsistencyEvaluation['label'];
  if (score >= 90) {
    label = 'Metronomic';
  } else if (score >= 80) {
    label = 'Consistent';
  } else if (score >= 70) {
    label = 'Varied';
  } else {
    label = 'Erratic';
  }

  return {
    score,
    label,
    standardDeviationSeconds: Math.round(stdDev * 10) / 10,
  };
}

/**
 * Evaluates whether a run achieved a negative split (second half faster than first half).
 * Requires at least 2 whole kilometer splits.
 */
export function isNegativeSplit(splits: number[] | undefined): boolean {
  if (!splits || splits.length < 2) {
    return false;
  }

  const mid = Math.floor(splits.length / 2);
  const firstHalf = splits.slice(0, mid);
  // If odd length, second half takes the latter half
  const secondHalf = splits.slice(splits.length - mid);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  // Faster by at least 1.5 seconds per km to qualify as a deliberate negative split
  return avgSecond <= avgFirst - 1.5;
}

/**
 * Evaluates a completed run against current personal records and detects any broken records.
 */
export function evaluatePersonalRecords(
  run: RunSummary,
  existingRecords: PersonalRecords = DEFAULT_PERSONAL_RECORDS
): {
  updatedRecords: PersonalRecords;
  newRecordKeys: PersonalRecordType[];
} {
  const updated: PersonalRecords = { ...existingRecords };
  const newRecordKeys: PersonalRecordType[] = [];

  // 1. Longest Distance
  if (run.distanceMeters > (updated.longestDistanceMeters || 0) && run.distanceMeters >= 500) {
    updated.longestDistanceMeters = run.distanceMeters;
    newRecordKeys.push('longestDistance');
  }

  // 2. Longest Duration
  if (run.durationSeconds > (updated.longestDurationSeconds || 0) && run.durationSeconds >= 300) {
    updated.longestDurationSeconds = run.durationSeconds;
    newRecordKeys.push('longestDuration');
  }

  // 3. Fastest 1K
  if (run.splits && run.splits.length > 0) {
    const minSplit = Math.min(...run.splits.filter((s) => s > 90 && s < 1200));
    if (minSplit && (!updated.fastest1kSeconds || minSplit < updated.fastest1kSeconds)) {
      updated.fastest1kSeconds = minSplit;
      newRecordKeys.push('fastest1k');
    }
  }

  // 4. Fastest 5K
  if (run.distanceMeters >= 5000 && run.durationSeconds > 0) {
    let fiveKTime: number | null = null;
    if (run.splits && run.splits.length >= 5) {
      // Find the minimum continuous 5-split window
      let minWindow = Infinity;
      for (let i = 0; i <= run.splits.length - 5; i++) {
        const windowSum = run.splits.slice(i, i + 5).reduce((a, b) => a + b, 0);
        if (windowSum < minWindow) minWindow = windowSum;
      }
      if (minWindow < Infinity) fiveKTime = minWindow;
    } else {
      // Pro-rated 5k time from active average pace
      fiveKTime = Math.round((run.durationSeconds / (run.distanceMeters / 1000)) * 5);
    }

    if (fiveKTime !== null && (!updated.fastest5kSeconds || fiveKTime < updated.fastest5kSeconds)) {
      updated.fastest5kSeconds = fiveKTime;
      newRecordKeys.push('fastest5k');
    }
  }

  // 5. Fastest 10K
  if (run.distanceMeters >= 10000 && run.durationSeconds > 0) {
    let tenKTime: number | null = null;
    if (run.splits && run.splits.length >= 10) {
      let minWindow = Infinity;
      for (let i = 0; i <= run.splits.length - 10; i++) {
        const windowSum = run.splits.slice(i, i + 10).reduce((a, b) => a + b, 0);
        if (windowSum < minWindow) minWindow = windowSum;
      }
      if (minWindow < Infinity) tenKTime = minWindow;
    } else {
      tenKTime = Math.round((run.durationSeconds / (run.distanceMeters / 1000)) * 10);
    }

    if (tenKTime !== null && (!updated.fastest10kSeconds || tenKTime < updated.fastest10kSeconds)) {
      updated.fastest10kSeconds = tenKTime;
      newRecordKeys.push('fastest10k');
    }
  }

  return {
    updatedRecords: updated,
    newRecordKeys,
  };
}
