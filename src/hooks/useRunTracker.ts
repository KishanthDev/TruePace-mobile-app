import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  GpsIssueReason,
  RunSummary,
} from '../types/tracking';
import { TrackingEngine } from '../services/TrackingEngine';
import { AudioCoach } from '../services/AudioCoach';
import { LiveNotificationService } from '../services/LiveNotificationService';

const engine = TrackingEngine.getInstance();
const audioCoach = AudioCoach.getInstance();
const liveNotificationService = LiveNotificationService.getInstance();

export function useRunTracker() {
  const telemetry = useSyncExternalStore(engine.subscribe, engine.getTelemetry);
  const isAudioCuesEnabled = useSyncExternalStore(audioCoach.subscribe, audioCoach.getIsEnabled);
  const [hasPermission, setHasPermission] = useState<boolean | null>(() => engine.hasPermission);
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState<boolean | null>(null);
  const [lastFinishedRun, setLastFinishedRun] = useState<RunSummary | null>(() => engine.lastFinishedRun);

  // Wall-clock ticker when tracking in foreground
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (telemetry.status === 'tracking') {
      activateKeepAwakeAsync().catch(() => {});
      interval = setInterval(() => {
        engine.notifyListeners();
      }, 1000);
    } else {
      deactivateKeepAwake().catch(() => {});
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [telemetry.status]);

  // Check location services
  const checkLocationServices = useCallback(async (): Promise<boolean> => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      engine.setLocationServicesEnabled(enabled);
      return enabled;
    } catch {
      return true;
    }
  }, []);

  // Boot permissions check
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        await engine.initialize();
        const servicesEnabled = await checkLocationServices();

        const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
        const fgGranted = fgStatus === 'granted';

        if (isMounted) {
          setHasPermission(fgGranted);
          engine.setHasPermission(fgGranted);

          if (fgGranted) {
            try {
              const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
              setHasBackgroundPermission(bgStatus === 'granted');
            } catch {}

            liveNotificationService.requestPermissions().catch(() => {});

            if (servicesEnabled && engine.status === 'idle') {
              await engine.startForegroundWatch();
            }
          }
        }
      } catch (err) {
        console.warn('[TruePace] Boot permission check error:', err);
        if (isMounted) {
          setHasPermission(false);
          engine.setHasPermission(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [checkLocationServices]);

  // Request permissions (Foreground + Background)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const servicesEnabled = await checkLocationServices();
      if (!servicesEnabled) return false;

      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      const fgGranted = fgStatus === 'granted';

      if (!fgGranted) {
        setHasPermission(false);
        engine.setHasPermission(false);
        return false;
      }

      setHasPermission(true);
      engine.setHasPermission(true);

      try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        setHasBackgroundPermission(bgStatus === 'granted');
      } catch (bgErr) {
        console.warn('[TruePace] Background permission request note:', bgErr);
      }

      await liveNotificationService.requestPermissions().catch(() => {});
      await engine.startForegroundWatch();
      return true;
    } catch (err) {
      console.warn('[TruePace] Permission request error:', err);
      setHasPermission(false);
      engine.setHasPermission(false);
      return false;
    }
  }, [checkLocationServices]);

  const startRun = useCallback(async (): Promise<{ success: boolean; reason?: GpsIssueReason }> => {
    try {
      let perm = hasPermission;
      if (!perm) {
        perm = await requestPermission();
        if (!perm) {
          return { success: false, reason: 'permission_denied' };
        }
      }

      const res = await engine.startRun();
      return res;
    } catch (err) {
      console.error('[TruePace] Error starting run:', err);
      return { success: false, reason: 'acquiring' };
    }
  }, [hasPermission, requestPermission]);

  const pauseRun = useCallback(() => {
    engine.pauseRun();
  }, []);

  const resumeRun = useCallback(() => {
    engine.resumeRun();
  }, []);

  const finishRun = useCallback(async (): Promise<RunSummary | null> => {
    const summary = await engine.finishRun();
    setLastFinishedRun(summary);
    return summary;
  }, []);

  const resetRun = useCallback(async () => {
    await engine.resetRun();
    setLastFinishedRun(null);
  }, []);

  const toggleAudioCues = useCallback(() => {
    audioCoach.setEnabled(!audioCoach.getIsEnabled());
  }, []);

  return {
    telemetry,
    hasPermission,
    hasBackgroundPermission,
    lastFinishedRun,
    isAudioCuesEnabled,
    toggleAudioCues,
    checkLocationServices,
    requestPermission,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    resetRun,
  };
}
