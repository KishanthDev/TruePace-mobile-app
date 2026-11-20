/**
 * TruePace — Post-Run Route Polyline & Elevation Visualizer
 * Pure React Native zero-dependency route visualization.
 * Maps GPS breadcrumb coordinates to local screen dimensions and displays
 * route trajectory, start/finish anchors, elevation gain, and GPX export actions.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Share, Alert } from 'react-native';
import type { RunSummary } from '../types/tracking';
import { projectCoordinatesToViewport } from '../utils/polyline';
import { generateGpx } from '../utils/gpxSerializer';

interface RouteVisualizerProps {
  run: RunSummary;
  height?: number;
}

export const RouteVisualizer: React.FC<RouteVisualizerProps> = ({
  run,
  height = 180,
}) => {
  const VIEW_WIDTH = 320;
  const VIEW_HEIGHT = height;

  const screenPoints = useMemo(() => {
    const points = run.breadcrumbs || [];
    if (points.length < 2) return [];
    return projectCoordinatesToViewport(points, VIEW_WIDTH, VIEW_HEIGHT, 24);
  }, [run.breadcrumbs, VIEW_HEIGHT]);

  const handleExportGpx = async () => {
    try {
      const gpxContent = generateGpx(run);
      await Share.share({
        title: `TruePace_Run_${new Date(run.startTime).toISOString().slice(0, 10)}.gpx`,
        message: gpxContent,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export GPX';
      Alert.alert('Export Failed', message);
    }
  };

  const hasValidRoute = (run.breadcrumbs?.length ?? 0) >= 2;

  if (!hasValidRoute) {
    return (
      <View className="w-full mt-4 p-4 rounded-3xl bg-zinc-950 border border-zinc-900 items-center justify-center">
        <Text className="text-xs text-zinc-500 font-semibold text-center">
          Route polyline requires at least 2 accepted GPS coordinates.
        </Text>
      </View>
    );
  }

  // Pre-calculate line segment geometries
  const segments = [];
  for (let i = 0; i < screenPoints.length - 1; i++) {
    const p1 = screenPoints[i];
    const p2 = screenPoints[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) continue;

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    segments.push({
      key: i,
      midX,
      midY,
      length,
      angle,
    });
  }

  const startPoint = screenPoints[0];
  const endPoint = screenPoints[screenPoints.length - 1];

  return (
    <View className="w-full mt-4 p-4 rounded-3xl bg-zinc-950 border border-zinc-900">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[11px] font-extrabold tracking-widest text-zinc-500 uppercase">
          Route & Elevation Profile
        </Text>
        <TouchableOpacity
          onPress={handleExportGpx}
          activeOpacity={0.7}
          className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800"
          accessibilityRole="button"
          accessibilityLabel="Export GPX file"
        >
          <Text className="text-[10px] font-black text-emerald-400 uppercase">
            EXPORT GPX
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2D Polyline Canvas */}
      <View
        style={{ width: '100%', height: VIEW_HEIGHT }}
        className="relative overflow-hidden rounded-2xl bg-black border border-zinc-900/80 items-center justify-center"
      >
        {segments.map((seg) => (
          <View
            key={seg.key}
            style={{
              position: 'absolute',
              left: seg.midX - seg.length / 2,
              top: seg.midY - 1,
              width: seg.length,
              height: 2,
              backgroundColor: '#10b981', // emerald-500
              transform: [{ rotate: `${seg.angle}deg` }],
              borderRadius: 1,
            }}
          />
        ))}

        {/* Start Marker */}
        {startPoint && (
          <View
            style={{
              position: 'absolute',
              left: startPoint.x - 4,
              top: startPoint.y - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#34d399', // emerald-400
              borderWidth: 1.5,
              borderColor: '#064e3b',
            }}
          />
        )}

        {/* Finish Marker */}
        {endPoint && (
          <View
            style={{
              position: 'absolute',
              left: endPoint.x - 5,
              top: endPoint.y - 5,
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: '#f59e0b', // amber-500
              borderWidth: 1.5,
              borderColor: '#78350f',
            }}
          />
        )}
      </View>

      {/* Route & Elevation Footer */}
      <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-zinc-900/80">
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
            <Text className="text-[10px] font-bold text-zinc-400">START</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-sm bg-amber-500 mr-1.5" />
            <Text className="text-[10px] font-bold text-zinc-400">FINISH</Text>
          </View>
        </View>

        {run.elevationGainMeters !== null && run.elevationGainMeters !== undefined && (
          <View className="flex-row items-center">
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="text-xs font-black text-white"
            >
              ▲ +{run.elevationGainMeters}m GAIN
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
