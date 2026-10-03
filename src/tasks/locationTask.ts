import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const LOCATION_TASK_NAME = 'truepace-background-location';

export type LocationUpdateHandler = (location: Location.LocationObject) => void;

/**
 * Module-level singleton handler.
 * Background tasks run in a separate execution context from React hooks.
 * This bridges the gap: the task fires into this module, which forwards to
 * whatever handler the active useRunTracker hook has registered.
 */
let _activeHandler: LocationUpdateHandler | null = null;

/**
 * Register the current location update handler.
 * Called from useRunTracker when tracking starts; cleared when tracking ends.
 */
export function setLocationUpdateHandler(handler: LocationUpdateHandler | null): void {
  _activeHandler = handler;
}

/**
 * Background location task definition.
 *
 * IMPORTANT: This must be defined at module load time — before any React
 * component mounts. Import this file in _layout.tsx to guarantee registration.
 *
 * When the screen is locked or the app is backgrounded, expo-location calls
 * this task with buffered location updates. The task forwards each update to
 * the active handler registered by useRunTracker.
 */
TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>): Promise<void> => {
    if (error) {
      console.warn('[TruePace] Background location task error:', error.message);
      return;
    }
    if (data?.locations && _activeHandler) {
      data.locations.forEach((loc) => _activeHandler!(loc));
    }
  }
);
