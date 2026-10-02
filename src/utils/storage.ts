import AsyncStorage from '@react-native-async-storage/async-storage';
import { RunSummary } from '../types/tracking';

const RUNS_CACHE_KEY = '@truepace_run_history_v1';

export async function getRunHistory(): Promise<RunSummary[]> {
  try {
    const rawData = await AsyncStorage.getItem(RUNS_CACHE_KEY);
    if (!rawData) return [];
    const parsed: RunSummary[] = JSON.parse(rawData);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load run history from cache:', error);
    return [];
  }
}

export async function saveRunSummary(summary: RunSummary): Promise<void> {
  try {
    const currentHistory = await getRunHistory();
    const updatedHistory = [summary, ...currentHistory];
    await AsyncStorage.setItem(RUNS_CACHE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Failed to save run summary to cache:', error);
  }
}

export async function clearRunHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RUNS_CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear run history cache:', error);
  }
}
