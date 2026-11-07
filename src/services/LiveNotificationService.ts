import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatDistanceKm, formatDuration, formatPace } from '../utils/geo';

const NOTIFICATION_ID = 'truepace_live_hud_notification';
const CHANNEL_ID = 'truepace_live_hud';

// Set notification handler to present silent, non-intrusive live metric updates
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

export class LiveNotificationService {
  private static instance: LiveNotificationService | null = null;
  private isConfigured = false;
  private lastUpdateTimestamp = 0;
  private minUpdateIntervalMs = 1500; // Throttle to prevent excessive OS notification redraws

  private constructor() {
    this.configureChannel();
  }

  public static getInstance(): LiveNotificationService {
    if (!LiveNotificationService.instance) {
      LiveNotificationService.instance = new LiveNotificationService();
    }
    return LiveNotificationService.instance;
  }

  public async configureChannel(): Promise<void> {
    if (this.isConfigured) return;
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'TruePace Live Metrics',
          importance: Notifications.AndroidImportance.LOW, // Silent, stays in tray & lock screen without buzzing
          vibrationPattern: [0],
          enableVibrate: false,
          showBadge: false,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
      this.isConfigured = true;
    } catch (err) {
      console.warn('[TruePace] Failed to configure notification channel:', err);
    }
  }

  public async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch {
      return false;
    }
  }

  public async updateLiveMetrics(
    distanceMeters: number,
    elapsedSeconds: number,
    currentPaceSecondsPerKm: number | null,
    isPaused: boolean,
    force = false
  ): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastUpdateTimestamp < this.minUpdateIntervalMs) {
      return;
    }
    this.lastUpdateTimestamp = now;

    const km = formatDistanceKm(distanceMeters);
    const duration = formatDuration(elapsedSeconds);
    const pace = formatPace(currentPaceSecondsPerKm);

    const title = isPaused ? '⏸ TruePace • PAUSED' : '🏃 TruePace • ACTIVE';
    const body = `${km} KM   |   ${duration}   |   ${pace}/km`;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: {
          title,
          body,
          color: isPaused ? '#eab308' : '#22c55e',
          sticky: true,
          autoDismiss: false,
          data: { type: 'live_tracking' },
        },
        trigger: null, // Display immediately
      });
    } catch (err) {
      console.warn('[TruePace] Failed to update live notification:', err);
    }
  }

  public async dismissLiveNotification(): Promise<void> {
    try {
      await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
    } catch (err) {
      console.warn('[TruePace] Failed to dismiss live notification:', err);
    }
  }
}
