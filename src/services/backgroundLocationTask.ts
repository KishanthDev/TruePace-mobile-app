import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { TrackingEngine, BACKGROUND_LOCATION_TASK } from './TrackingEngine';

/**
 * Top-level task definition required by expo-task-manager.
 * Must be executed in the global module scope at app startup.
 */
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[TruePace] Background location task error:', error.message);
      return;
    }

    if (data) {
      const { locations } = data as { locations?: Location.LocationObject[] };
      if (locations && locations.length > 0) {
        TrackingEngine.getInstance().processLocations(locations);
      }
    }
  });
}
