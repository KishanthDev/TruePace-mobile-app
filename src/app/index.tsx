import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRunTracker } from '../hooks/useRunTracker';
import { MetricTile } from '../components/MetricTile';
import { ControlButton } from '../components/ControlButton';
import { RunHistoryModal } from '../components/RunHistoryModal';
import {
  formatDistanceKm,
  formatDuration,
  formatPace,
} from '../utils/geo';

export default function RunHudScreen() {
  const {
    telemetry,
    hasPermission,
    lastFinishedRun,
    requestPermission,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    resetRun,
  } = useRunTracker();

  const [historyVisible, setHistoryVisible] = useState(false);

  const {
    status,
    elapsedSeconds,
    distanceMeters,
    currentPaceSecondsPerKm,
    avgPaceSecondsPerKm,
    isGpsAccurate,
    gpsAccuracyMeters,
  } = telemetry;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-4 pb-8 justify-between">
        {/* Top Header / Precision Telemetry Status */}
        <View className="flex-row items-center justify-between pb-3 border-b border-zinc-900">
          <View className="flex-row items-center space-x-2">
            <Text className="text-sm font-extrabold tracking-widest text-white uppercase">
              TRUEPACE
            </Text>
            <View
              className={`w-2 h-2 rounded-full ml-2 ${
                isGpsAccurate ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <Text className="text-[11px] font-semibold text-zinc-500 uppercase ml-1">
              {isGpsAccurate
                ? `GPS ±${Math.round(gpsAccuracyMeters ?? 0)}m`
                : 'GPS ACQUIRING'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setHistoryVisible(true)}
            className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800"
          >
            <Text className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Permission Banner if not granted */}
        {hasPermission === false && (
          <TouchableOpacity
            onPress={requestPermission}
            className="p-3 my-2 rounded-xl bg-amber-500/10 border border-amber-500/30"
          >
            <Text className="text-center text-xs font-semibold text-amber-300">
              Location access is required for precision GPS. Tap to grant permission.
            </Text>
          </TouchableOpacity>
        )}

        {/* Telemetry Cockpit */}
        {status === 'finished' && lastFinishedRun ? (
          /* Finished Run Summary View */
          <ScrollView
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 24 }}
            className="flex-1"
          >
            <Text className="text-xs font-extrabold tracking-widest text-emerald-400 uppercase mb-2">
              RUN COMPLETE
            </Text>
            <Text className="text-6xl font-black text-white tracking-tighter">
              {formatDistanceKm(lastFinishedRun.distanceMeters)}
            </Text>
            <Text className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-8">
              KILOMETERS
            </Text>

            <View className="w-full flex-row justify-around py-6 rounded-3xl bg-zinc-950 border border-zinc-900">
              <View className="items-center">
                <Text className="text-xs font-semibold text-zinc-500 uppercase">
                  Time
                </Text>
                <Text className="text-2xl font-bold text-white mt-1">
                  {formatDuration(lastFinishedRun.durationSeconds)}
                </Text>
              </View>

              <View className="items-center">
                <Text className="text-xs font-semibold text-zinc-500 uppercase">
                  Avg Pace
                </Text>
                <Text className="text-2xl font-bold text-white mt-1">
                  {formatPace(lastFinishedRun.avgPaceSecondsPerKm)}/km
                </Text>
              </View>

              <View className="items-center">
                <Text className="text-xs font-semibold text-zinc-500 uppercase">
                  Best Pace
                </Text>
                <Text className="text-2xl font-bold text-white mt-1">
                  {formatPace(lastFinishedRun.bestPaceSecondsPerKm)}/km
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          /* Active Live In-Run HUD */
          <View className="flex-1 justify-center items-center py-4">
            {/* Run Status Pill */}
            <View className="mb-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800">
              <Text
                className={`text-[10px] font-black tracking-widest uppercase ${
                  status === 'tracking'
                    ? 'text-emerald-400'
                    : status === 'paused'
                    ? 'text-amber-400'
                    : 'text-zinc-500'
                }`}
              >
                {status === 'tracking'
                  ? 'LIVE HUD'
                  : status === 'paused'
                  ? 'PAUSED'
                  : 'READY'}
              </Text>
            </View>

            {/* Elapsed Time */}
            <MetricTile
              label="Elapsed Time"
              value={formatDuration(elapsedSeconds)}
              accentColor={status === 'tracking' ? '#ffffff' : '#a1a1aa'}
            />

            {/* Hero Distance */}
            <MetricTile
              label="Distance"
              value={formatDistanceKm(distanceMeters)}
              unit="KM"
              isHero
              accentColor="#22c55e"
            />

            {/* Split Metrics: Current Pace vs Average Pace */}
            <View className="w-full flex-row justify-around px-2 pt-4 border-t border-zinc-900">
              <View className="items-center">
                <Text className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-1">
                  Current Pace
                </Text>
                <Text className="text-3xl font-black text-white">
                  {formatPace(currentPaceSecondsPerKm)}
                </Text>
                <Text className="text-[10px] font-bold text-zinc-600 uppercase mt-0.5">
                  /KM
                </Text>
              </View>

              <View className="w-[1px] h-12 bg-zinc-900 self-center" />

              <View className="items-center">
                <Text className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-1">
                  Avg Pace
                </Text>
                <Text className="text-3xl font-black text-white">
                  {formatPace(avgPaceSecondsPerKm)}
                </Text>
                <Text className="text-[10px] font-bold text-zinc-600 uppercase mt-0.5">
                  /KM
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Lower Control Actions */}
        <View className="pt-4 items-center">
          {status === 'idle' && (
            <ControlButton
              label="START RUN"
              variant="primary"
              size="large"
              onPress={startRun}
            />
          )}

          {status === 'tracking' && (
            <ControlButton
              label="PAUSE"
              variant="warning"
              size="large"
              onPress={pauseRun}
            />
          )}

          {status === 'paused' && (
            <View className="w-full flex-row justify-center space-x-4 gap-4">
              <ControlButton
                label="RESUME"
                variant="primary"
                size="medium"
                onPress={resumeRun}
              />
              <ControlButton
                label="FINISH"
                variant="danger"
                size="medium"
                onPress={finishRun}
              />
            </View>
          )}

          {status === 'finished' && (
            <ControlButton
              label="NEW RUN"
              variant="primary"
              size="large"
              onPress={resetRun}
            />
          )}
        </View>
      </View>

      {/* History Modal */}
      <RunHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </SafeAreaView>
  );
}
