/**
 * TruePace — GPX & TCX File Serializer
 * Exports workout sessions into standard, schema-valid GPX 1.1 and TCX XML documents
 * compatible with Strava, Garmin Connect, Runkeeper, TrainingPeaks, and Apple/Google Health.
 * 100% pure TypeScript, zero external dependencies.
 */

import type { RunSummary, BreadcrumbPoint } from '../types/tracking';

/**
 * Escapes special XML characters to prevent injection and syntax errors.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a UNIX epoch timestamp (ms) into UTC ISO 8601 string expected by GPX schema.
 */
function toIsoTime(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/**
 * Generates an official, schema-compliant GPX 1.1 XML string for a workout.
 */
export function generateGpx(run: RunSummary): string {
  const startTimeIso = toIsoTime(run.startTime);
  const runTitle = `TruePace Run - ${new Date(run.startTime).toLocaleDateString()}`;

  let trkptsXml = '';
  const points: BreadcrumbPoint[] = run.breadcrumbs || [];

  if (points.length > 0) {
    trkptsXml = points
      .map((pt) => {
        const eleTag =
          pt.altitude !== null && pt.altitude !== undefined && !isNaN(pt.altitude)
            ? `\n        <ele>${pt.altitude.toFixed(1)}</ele>`
            : '';
        const timeTag = `\n        <time>${toIsoTime(pt.timestamp)}</time>`;
        return `      <trkpt lat="${pt.latitude.toFixed(6)}" lon="${pt.longitude.toFixed(6)}">${eleTag}${timeTag}\n      </trkpt>`;
      })
      .join('\n');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TruePace Running Engine"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(runTitle)}</name>
    <time>${startTimeIso}</time>
  </metadata>
  <trk>
    <name>${escapeXml(runTitle)}</name>
    <type>running</type>
    <trkseg>
${trkptsXml}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Generates an official Garmin Training Center XML (TCX) string with lap information.
 */
export function generateTcx(run: RunSummary): string {
  const startTimeIso = toIsoTime(run.startTime);
  const totalSeconds = run.durationSeconds;
  const distanceMeters = run.distanceMeters.toFixed(1);
  const maxSpeedMps = run.maxSpeedMps.toFixed(2);
  const points = run.breadcrumbs || [];

  let trackpointsXml = '';
  if (points.length > 0) {
    trackpointsXml = points
      .map((pt) => {
        const altTag =
          pt.altitude !== null && pt.altitude !== undefined
            ? `\n            <AltitudeMeters>${pt.altitude.toFixed(1)}</AltitudeMeters>`
            : '';
        return `          <Trackpoint>
            <Time>${toIsoTime(pt.timestamp)}</Time>
            <Position>
              <LatitudeDegrees>${pt.latitude.toFixed(6)}</LatitudeDegrees>
              <LongitudeDegrees>${pt.longitude.toFixed(6)}</LongitudeDegrees>
            </Position>${altTag}
          </Trackpoint>`;
      })
      .join('\n');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Running">
      <Id>${startTimeIso}</Id>
      <Lap StartTime="${startTimeIso}">
        <TotalTimeSeconds>${totalSeconds}</TotalTimeSeconds>
        <DistanceMeters>${distanceMeters}</DistanceMeters>
        <MaximumSpeed>${maxSpeedMps}</MaximumSpeed>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpointsXml}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}

/**
 * Formats a clean JSON export of full run history for secure offline backup.
 */
export function generateHistoryBackupJson(runs: RunSummary[]): string {
  const payload = {
    app: 'TruePace',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    totalWorkouts: runs.length,
    runs,
  };
  return JSON.stringify(payload, null, 2);
}
