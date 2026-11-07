import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUDIO_CUES_STORAGE_KEY = '@truepace_audio_cues_enabled_v1';

export class AudioCoach {
  private static instance: AudioCoach | null = null;
  private isEnabled = true;
  private isLoaded = false;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadPreference();
  }

  public static getInstance(): AudioCoach {
    if (!AudioCoach.instance) {
      AudioCoach.instance = new AudioCoach();
    }
    return AudioCoach.instance;
  }

  private async loadPreference(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(AUDIO_CUES_STORAGE_KEY);
      if (stored !== null) {
        this.isEnabled = stored === 'true';
      }
    } catch {
      this.isEnabled = true;
    } finally {
      this.isLoaded = true;
      this.notifyListeners();
    }
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {}
    }
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    this.notifyListeners();
    try {
      await AsyncStorage.setItem(AUDIO_CUES_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (err) {
      console.warn('[TruePace] Failed to save audio cues preference:', err);
    }
  }

  public getIsEnabled = (): boolean => {
    return this.isEnabled;
  };

  /**
   * Speaks a clear, concise hands-free audio cue through headphones / speaker.
   */
  public speak(message: string): void {
    if (!this.isEnabled) return;
    try {
      Speech.stop();
      Speech.speak(message, {
        language: 'en-US',
        rate: 1.0,
        pitch: 1.0,
      });
    } catch (err) {
      console.warn('[TruePace] Audio coach speak error:', err);
    }
  }

  /**
   * Formats seconds into natural spoken words (e.g. "5 minutes 12 seconds" or "48 seconds")
   */
  private formatSpokenTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.round(totalSeconds % 60);

    if (mins > 0 && secs > 0) {
      return `${mins} minute${mins > 1 ? 's' : ''} ${secs} second${secs > 1 ? 's' : ''}`;
    }
    if (mins > 0) {
      return `${mins} minute${mins > 1 ? 's' : ''}`;
    }
    return `${secs} second${secs > 1 ? 's' : ''}`;
  }

  /**
   * Announces milestone split and current pace when crossing a whole kilometer.
   */
  public announceKilometer(
    km: number,
    splitDurationSeconds: number,
    avgPaceSecondsPerKm: number | null
  ): void {
    if (!this.isEnabled) return;

    const splitText = this.formatSpokenTime(splitDurationSeconds);
    let message = `Kilometer ${km}. Split time: ${splitText}.`;

    if (avgPaceSecondsPerKm !== null && avgPaceSecondsPerKm > 0) {
      const avgPaceText = this.formatSpokenTime(avgPaceSecondsPerKm);
      message += ` Average pace: ${avgPaceText} per kilometer.`;
    }

    this.speak(message);
  }

  public announceRunStarted(): void {
    this.speak('Run started. GPS locked.');
  }

  public announceRunPaused(): void {
    this.speak('Run paused.');
  }

  public announceRunResumed(): void {
    this.speak('Resuming run.');
  }

  public announceRunFinished(distanceMeters: number, durationSeconds: number): void {
    if (!this.isEnabled) return;
    const km = (distanceMeters / 1000).toFixed(2);
    const durationText = this.formatSpokenTime(durationSeconds);
    this.speak(`Run complete. Total distance: ${km} kilometers. Time: ${durationText}. Great job!`);
  }
}
