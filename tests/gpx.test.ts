/**
 * TruePace — GPX/TCX Serializer Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateGpx,
  generateTcx,
  generateHistoryBackupJson,
} from '../src/utils/gpxSerializer';
import type { RunSummary } from '../src/types/tracking';

const mockRun: RunSummary = {
  id: 'test-run-1',
  startTime: 1700000000000,
  endTime: 1700001800000,
  durationSeconds: 1800,
  distanceMeters: 5000,
  avgPaceSecondsPerKm: 360,
  bestPaceSecondsPerKm: 310,
  maxSpeedMps: 3.23,
  splits: [365, 360, 355, 360, 360],
  breadcrumbs: [
    { latitude: 37.7749, longitude: -122.4194, altitude: 15.2, timestamp: 1700000000000 },
    { latitude: 37.7755, longitude: -122.4185, altitude: 16.0, timestamp: 1700000500000 },
    { latitude: 37.7760, longitude: -122.4170, altitude: 17.5, timestamp: 1700001800000 },
  ],
};

describe('GPX Serializer', () => {
  it('generates standard GPX 1.1 XML with metadata and track points', () => {
    const xml = generateGpx(mockRun);

    assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(xml.includes('<gpx version="1.1" creator="TruePace Running Engine"'));
    assert.ok(xml.includes('<type>running</type>'));
    assert.ok(xml.includes('<trkpt lat="37.774900" lon="-122.419400">'));
    assert.ok(xml.includes('<ele>15.2</ele>'));
    assert.ok(xml.includes('<time>'));
  });

  it('handles workouts without breadcrumbs gracefully', () => {
    const noBreadcrumbsRun: RunSummary = { ...mockRun, breadcrumbs: [] };
    const xml = generateGpx(noBreadcrumbsRun);

    assert.ok(xml.includes('<gpx version="1.1"'));
    assert.ok(xml.includes('<trkseg>'));
    assert.ok(xml.includes('</trkseg>'));
  });
});

describe('TCX Serializer', () => {
  it('generates valid Garmin Training Center XML with laps and trackpoints', () => {
    const xml = generateTcx(mockRun);

    assert.ok(xml.includes('<TrainingCenterDatabase'));
    assert.ok(xml.includes('<Activity Sport="Running">'));
    assert.ok(xml.includes('<TotalTimeSeconds>1800</TotalTimeSeconds>'));
    assert.ok(xml.includes('<DistanceMeters>5000.0</DistanceMeters>'));
    assert.ok(xml.includes('<LatitudeDegrees>37.774900</LatitudeDegrees>'));
  });
});

describe('JSON History Backup', () => {
  it('exports valid JSON array payload with application metadata', () => {
    const json = generateHistoryBackupJson([mockRun]);
    const parsed = JSON.parse(json);

    assert.equal(parsed.app, 'TruePace');
    assert.equal(parsed.totalWorkouts, 1);
    assert.equal(parsed.runs[0].id, 'test-run-1');
  });
});
