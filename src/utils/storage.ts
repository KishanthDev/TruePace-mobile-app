import AsyncStorage from '@react-native-async-storage/async-storage';
import { RunSummary } from '../types/tracking';
import {
  PersonalRecords,
  DEFAULT_PERSONAL_RECORDS,
  calculatePaceConsistency,
  isNegativeSplit,
  evaluatePersonalRecords,
} from './analytics';

const RUNS_CACHE_KEY = '@truepace_run_history_v1';
const PR_CACHE_KEY = '@truepace_personal_records_v1';

/**
 * Loads run history from persistent storage with defensive sanitization.
 */
export async function getRunHistory(): Promise<RunSummary[]> {
  try {
    const rawData = await AsyncStorage.getItem(RUNS_CACHE_KEY);
    if (!rawData) return [];
    const parsed: unknown = JSON.parse(rawData);
    if (!Array.isArray(parsed)) return [];

    // Defensive validation: ensure each run has minimal valid properties
    return parsed.filter(
      (item): item is RunSummary =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as RunSummary).id === 'string' &&
        typeof (item as RunSummary).distanceMeters === 'number' &&
        typeof (item as RunSummary).durationSeconds === 'number'
    );
  } catch (error) {
    console.warn('[TruePace] Failed to load run history from cache:', error);
    return [];
  }
}

/**
 * Loads athlete personal records from persistent storage.
 */
export async function getPersonalRecords(): Promise<PersonalRecords> {
  try {
    const raw = await AsyncStorage.getItem(PR_CACHE_KEY);
    if (!raw) return DEFAULT_PERSONAL_RECORDS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PERSONAL_RECORDS,
      ...(typeof parsed === 'object' && parsed !== null ? parsed : {}),
    };
  } catch {
    return DEFAULT_PERSONAL_RECORDS;
  }
}

/**
 * Saves updated personal records to persistent storage.
 */
export async function savePersonalRecords(records: PersonalRecords): Promise<void> {
  try {
    await AsyncStorage.setItem(PR_CACHE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('[TruePace] Failed to save personal records:', err);
  }
}

/**
 * Saves a completed run summary, automatically enriching with consistency score,
 * negative split detection, and personal records evaluation.
 */
export async function saveRunSummary(summary: RunSummary): Promise<RunSummary> {
  try {
    // Enrich with Pace Consistency if not already computed
    if (summary.consistencyScore === undefined && summary.splits) {
      const consistency = calculatePaceConsistency(summary.splits);
      if (consistency) {
        summary.consistencyScore = consistency.score;
        summary.consistencyLabel = consistency.label;
      }
    }

    // Enrich with Negative Split achievement
    if (summary.isNegativeSplit === undefined && summary.splits) {
      summary.isNegativeSplit = isNegativeSplit(summary.splits);
    }

    // Evaluate Personal Records
    try {
      const existingPRs = await getPersonalRecords();
      const { updatedRecords, newRecordKeys } = evaluatePersonalRecords(summary, existingPRs);
      if (newRecordKeys.length > 0) {
        summary.newRecords = newRecordKeys;
        await savePersonalRecords(updatedRecords);
      }
    } catch (prErr) {
      console.warn('[TruePace] Personal records evaluation error:', prErr);
    }

    const currentHistory = await getRunHistory();
    // Prepend new run and prevent duplicates
    const updatedHistory = [summary, ...currentHistory.filter((r) => r.id !== summary.id)];
    await AsyncStorage.setItem(RUNS_CACHE_KEY, JSON.stringify(updatedHistory));
    return summary;
  } catch (error) {
    console.error('[TruePace] Failed to save run summary to cache:', error);
    return summary;
  }
}

/**
 * Deletes a single workout from history by its unique identifier.
 */
export async function deleteRun(id: string): Promise<boolean> {
  try {
    const currentHistory = await getRunHistory();
    const filtered = currentHistory.filter((r) => r.id !== id);
    if (filtered.length === currentHistory.length) {
      return false; // Run not found
    }
    await AsyncStorage.setItem(RUNS_CACHE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.warn('[TruePace] Failed to delete run:', err);
    return false;
  }
}

/**
 * Clears entire run history cache.
 */
export async function clearRunHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RUNS_CACHE_KEY);
  } catch (error) {
    console.error('[TruePace] Failed to clear run history cache:', error);
  }
}
