/**
 * TruePace — Distance & Pace Unit Conversion Engine
 * Supports Metric (Kilometers) and Imperial (Miles) systems.
 * Pure mathematical utilities with zero dependencies.
 */

export type UnitSystem = 'metric' | 'imperial';

export const METERS_PER_MILE = 1609.344;
export const METERS_PER_KM = 1000.0;
export const KM_PER_MILE = 1.609344;

/**
 * Converts meters to distance in specified unit system.
 */
export function convertDistance(meters: number, unit: UnitSystem): number {
  if (meters <= 0) return 0;
  return unit === 'imperial' ? meters / METERS_PER_MILE : meters / METERS_PER_KM;
}

/**
 * Converts a pace in seconds per kilometer to the specified unit system.
 * Returns null if pace is invalid or null.
 */
export function convertPace(
  paceSecondsPerKm: number | null | undefined,
  unit: UnitSystem
): number | null {
  if (paceSecondsPerKm === null || paceSecondsPerKm === undefined || paceSecondsPerKm <= 0) {
    return null;
  }
  if (unit === 'metric') {
    return paceSecondsPerKm;
  }
  // 1 mile is 1.609344 km, so seconds per mile = seconds per km * 1.609344
  return paceSecondsPerKm * KM_PER_MILE;
}

/**
 * Formats distance with appropriate unit label.
 * E.g. "4.25" with unit="KM" or "2.64" with unit="MI".
 */
export function formatUnitDistance(meters: number, unit: UnitSystem): string {
  const converted = convertDistance(meters, unit);
  return converted.toFixed(2);
}

/**
 * Formats pace in specified unit system: M'SS" (e.g. 5'24"/KM or 8'41"/MI).
 */
export function formatUnitPace(
  paceSecondsPerKm: number | null | undefined,
  unit: UnitSystem
): string {
  const converted = convertPace(paceSecondsPerKm, unit);
  if (converted === null || !isFinite(converted) || converted <= 0) {
    return `--'--"`;
  }
  const minutes = Math.floor(converted / 60);
  const seconds = Math.floor(converted % 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

/**
 * Returns unit label abbreviations.
 */
export function getUnitLabels(unit: UnitSystem): {
  distanceUnit: 'KM' | 'MI';
  paceUnit: '/KM' | '/MI';
} {
  return unit === 'imperial'
    ? { distanceUnit: 'MI', paceUnit: '/MI' }
    : { distanceUnit: 'KM', paceUnit: '/KM' };
}
