import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRunTracker } from '../hooks/useRunTracker';
import { MetricTile } from '../components/MetricTile';
import { ControlButton } from '../components/ControlButton';
import { RunHistoryModal } from '../components/RunHistoryModal';
import { GpsAlertModal } from '../components/GpsAlertModal';
import { formatDuration } from '../utils/geo';
import {
  formatUnitDistance,
  formatUnitPace,
  getUnitLabels,
} from '../utils/units';
import { AiCoachingService } from '../services/AiCoachingService';

export default function RunHudScreen() {
  const insets = useSafeAreaInsets();
  const {
    telemetry,
    hasPermission,
    lastFinishedRun,
    isAudioCuesEnabled,
    toggleAudioCues,
    unitPreference,
    toggleUnitPreference,
    setTargetPace,
    requestPermission,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    resetRun,
  } = useRunTracker();

  const [historyVisible, setHistoryVisible] = useState(false);
  const [gpsModalVisible, setGpsModalVisible] = useState(false);

  const {
    status,
    elapsedSeconds,
    distanceMeters,
    currentPaceSecondsPerKm,
    avgPaceSecondsPerKm,
    isGpsReady,
    gpsIssueReason,
    gpsAccuracyMeters,
    targetPaceSecondsPerKm,
    targetDeltaSeconds,
  } = telemetry;

  const unitLabels = getUnitLabels(unitPreference);

  const coachingReport = useMemo(() => {
    if (!lastFinishedRun) return null;
    return AiCoachingService.getInstance().generateLocalCoachingReport(lastFinishedRun);
  }, [lastFinishedRun]);

  const handleFinishPrompt = () => {
    Alert.alert(
      'Finish Run?',
      'Are you sure you want to end your current workout?',
      [
        { text: 'Keep Running', style: 'cancel' },
        { text: 'Finish', style: 'destructive', onPress: finishRun },
      ]
    );
  };

  const promptTargetPace = () => {
    Alert.alert(
      'Target Running Pace',
      'Select a target pace for real-time guidance and pace delta indicators:',
      [
        { text: 'Turn Off', onPress: () => setTargetPace(null) },
        { text: '4:30 /km (7:14 /mi)', onPress: () => setTargetPace(270) },
        { text: '5:00 /km (8:02 /mi)', onPress: () => setTargetPace(300) },
        { text: '5:30 /km (8:51 /mi)', onPress: () => setTargetPace(330) },
        { text: '6:00 /km (9:39 /mi)', onPress: () => setTargetPace(360) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getGpsStatus = () => {
    if (gpsAccuracyMeters === null) {
      return { label: 'ACQUIRING...', color: 'bg-amber-400', textColor: 'text-amber-400' };
    }
    const acc = Math.round(gpsAccuracyMeters);
    if (acc <= 15) {
      return { label: `LOCK ±${acc}m`, color: 'bg-emerald-400', textColor: 'text-emerald-400' };
    }
    if (acc <= 25) {
      return { label: `GOOD ±${acc}m`, color: 'bg-lime-400', textColor: 'text-lime-400' };
    }
    return { label: `WEAK ±${acc}m`, color: 'bg-amber-400', textColor: 'text-amber-400' };
  };

  const gpsStatus = getGpsStatus();

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top, 20),
        paddingBottom: Math.max(insets.bottom, 16),
      }}
      className="flex-1 bg-black"
    >
      <View className="flex-1 px-6 pt-2 pb-6 justify-between">
        {/* Top Header / Precision Telemetry Status */}
        <View className="flex-row items-center justify-between pb-3 border-b border-zinc-900">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setGpsModalVisible(true)}
            className="flex-row items-center space-x-2"
          >
            <Text className="text-sm font-extrabold tracking-widest text-white uppercase">
              TRUEPACE
            </Text>
            <View className={`w-2 h-2 rounded-full ml-2 ${gpsStatus.color}`} />
            <Text className={`text-[11px] font-bold uppercase ml-1 ${gpsStatus.textColor}`}>
              {gpsStatus.label}
            </Text>
          </TouchableOpacity>

          <View className="flex-row items-center space-x-1.5 gap-1.5">
            {/* Unit Toggle (KM / MI) */}
            <TouchableOpacity
              onPress={toggleUnitPreference}
              activeOpacity={0.7}
              className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800"
            >
              <Text className="text-[11px] font-black text-zinc-300">
                {unitPreference === 'metric' ? 'KM' : 'MI'}
              </Text>
            </TouchableOpacity>

            {/* Target Pace Toggle / Modal (Idle only) */}
            {status === 'idle' && (
              <TouchableOpacity
                onPress={promptTargetPace}
                activeOpacity={0.7}
                className={`px-2.5 py-1 rounded-full border ${
                  targetPaceSecondsPerKm
                    ? 'bg-emerald-950/40 border-emerald-500/40'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    targetPaceSecondsPerKm ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                >
                  {targetPaceSecondsPerKm
                    ? `TARGET ${formatUnitPace(targetPaceSecondsPerKm, unitPreference)}`
                    : 'TARGET'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={toggleAudioCues}
              activeOpacity={0.7}
              className={`px-2.5 py-1 rounded-full border ${
                isAudioCuesEnabled
                  ? 'bg-emerald-950/40 border-emerald-500/40'
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  isAudioCuesEnabled ? 'text-emerald-400' : 'text-zinc-500'
                }`}
              >
                {isAudioCuesEnabled ? 'AUDIO' : 'MUTE'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setHistoryVisible(true)}
              className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800"
            >
              <Text className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                History
              </Text>
            </TouchableOpacity>
          </View>
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
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="text-6xl font-black text-white tracking-tighter"
            >
              {formatUnitDistance(lastFinishedRun.distanceMeters, unitPreference)}
            </Text>
            <Text className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">
              {unitLabels.distanceUnit === 'KM' ? 'KILOMETERS' : 'MILES'}
            </Text>

            {/* Intelligent Analytics Badges */}
            {(lastFinishedRun.consistencyScore !== undefined ||
              lastFinishedRun.isNegativeSplit ||
              (lastFinishedRun.newRecords && lastFinishedRun.newRecords.length > 0)) && (
              <View className="flex-row flex-wrap justify-center gap-2 mb-6 px-2">
                {lastFinishedRun.consistencyScore !== undefined && (
                  <View className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/60">
                    <Text className="text-xs font-bold text-zinc-300">
                      PACE {lastFinishedRun.consistencyScore}% • {lastFinishedRun.consistencyLabel?.toUpperCase()}
                    </Text>
                  </View>
                )}
                {lastFinishedRun.isNegativeSplit && (
                  <View className="px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/50">
                    <Text className="text-xs font-black text-emerald-400">
                      NEGATIVE SPLIT
                    </Text>
                  </View>
                )}
                {lastFinishedRun.newRecords && lastFinishedRun.newRecords.length > 0 && (
                  <View className="px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/50">
                    <Text className="text-xs font-black text-amber-400">
                      PERSONAL RECORD
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View className="w-full flex-row justify-around py-6 rounded-3xl bg-zinc-950 border border-zinc-900">
              <View className="items-center">
                <Text className="text-xs font-semibold text-zinc-500 uppercase">
                  Time
                </Text>
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="text-2xl font-bold text-white mt-1"
                >
                  {formatDuration(lastFinishedRun.durationSeconds)}
                </Text>
              </View>

              <View className="items-center">
                <Text className="text-xs font-semibold text-zinc-500 uppercase">
                  Avg Pace
                </Text>
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="text-2xl font-bold text-white mt-1"
                >
                  {formatUnitPace(lastFinishedRun.avgPaceSecondsPerKm, unitPreference)}{unitLabels.paceUnit}
                </Text>
              </View>

              <View className="items-center">
                <Text className="text-xs font-semibold text-zinc-500 uppercase">
                  Best Pace
                </Text>
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="text-2xl font-bold text-white mt-1"
                >
                  {formatUnitPace(lastFinishedRun.bestPaceSecondsPerKm, unitPreference)}{unitLabels.paceUnit}
                </Text>
              </View>
            </View>

            {/* Kilometer Splits Breakdown */}
            {lastFinishedRun.splits && lastFinishedRun.splits.length > 0 && (
              <View className="w-full mt-4 p-4 rounded-3xl bg-zinc-950 border border-zinc-900">
                <Text className="text-[11px] font-extrabold tracking-widest text-zinc-500 uppercase mb-3">
                  Split Intervals
                </Text>
                {(() => {
                  const fastest = Math.min(...lastFinishedRun.splits);
                  return lastFinishedRun.splits.map((splitTime, idx) => {
                    const isFastest = splitTime === fastest && lastFinishedRun.splits!.length > 1;
                    return (
                      <View
                        key={idx}
                        className="flex-row items-center justify-between py-2 border-b border-zinc-900/60"
                      >
                        <View className="flex-row items-center">
                          <Text className="text-xs font-bold text-zinc-400">
                            KM {idx + 1}
                          </Text>
                          {isFastest && (
                            <View className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                              <Text className="text-[9px] font-black text-emerald-400 uppercase">
                                FASTEST
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={{ fontVariant: ['tabular-nums'] }}
                          className={`text-sm font-black ${
                            isFastest ? 'text-emerald-400' : 'text-white'
                          }`}
                        >
                          {formatUnitPace(splitTime, unitPreference)}{unitLabels.paceUnit}
                        </Text>
                      </View>
                    );
                  });
                })()}
              </View>
            )}

            {/* AI Coach Post-Workout Insights */}
            {coachingReport && (
              <View className="w-full mt-4 p-5 rounded-3xl bg-zinc-950 border border-zinc-900">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Text className="text-[11px] font-extrabold tracking-widest text-emerald-400 uppercase">
                      AI COACH INSIGHTS
                    </Text>
                  </View>
                  <View className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                    <Text className="text-[9px] font-black text-emerald-400 uppercase">
                      GRADE {coachingReport.pacingEvaluation.consistencyGrade} • {coachingReport.performanceCategory.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <Text className="text-base font-bold text-white mb-2">
                  {coachingReport.summaryTitle}
                </Text>

                <Text className="text-xs text-zinc-400 leading-relaxed mb-4">
                  {coachingReport.pacingEvaluation.observation}
                </Text>

                {coachingReport.pacingEvaluation.fatigueOnsetKilometer && (
                  <View className="mb-4 px-3 py-2 rounded-2xl bg-amber-950/40 border border-amber-500/30">
                    <Text className="text-xs font-semibold text-amber-300">
                      ⚠️ Pace fade noted starting at KM {coachingReport.pacingEvaluation.fatigueOnsetKilometer}
                    </Text>
                  </View>
                )}

                <View className="pt-3 border-t border-zinc-900">
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-xs font-medium text-zinc-500">
                      Recommended Recovery:
                    </Text>
                    <Text className="text-xs font-bold text-white">
                      {coachingReport.recoveryAdvice.recommendedRestHours} hours
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-xs font-medium text-zinc-500">
                      Suggested Next Session:
                    </Text>
                    <Text className="text-xs font-bold text-zinc-300">
                      {coachingReport.recoveryAdvice.recommendedNextWorkout}
                    </Text>
                  </View>

                  <Text className="text-[11px] text-zinc-500 italic mt-2">
                    💡 {coachingReport.recoveryAdvice.hydrationNutritionTip}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          /* Active Live In-Run HUD */
          <View className="flex-1 justify-center items-center py-4">
            {/* Run Status Pill & Target Delta */}
            <View className="flex-row items-center gap-2 mb-2">
              <View className="px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800">
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
                    ? 'TRACKING • BG ON'
                    : status === 'paused'
                    ? 'PAUSED'
                    : 'READY'}
                </Text>
              </View>

              {targetPaceSecondsPerKm && (
                <View className="px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-800 flex-row items-center">
                  <Text
                    style={{ fontVariant: ['tabular-nums'] }}
                    className={`text-[10px] font-black uppercase ${
                      targetDeltaSeconds == null
                        ? 'text-zinc-500'
                        : targetDeltaSeconds < 0
                        ? 'text-emerald-400'
                        : targetDeltaSeconds > 0
                        ? 'text-amber-400'
                        : 'text-lime-400'
                    }`}
                  >
                    {targetDeltaSeconds == null
                      ? `TARGET ${formatUnitPace(targetPaceSecondsPerKm, unitPreference)}`
                      : targetDeltaSeconds < 0
                      ? `▲ ${Math.abs(targetDeltaSeconds)}S AHEAD`
                      : targetDeltaSeconds > 0
                      ? `▼ ${targetDeltaSeconds}S BEHIND`
                      : 'ON TARGET'}
                  </Text>
                </View>
              )}
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
              value={formatUnitDistance(distanceMeters, unitPreference)}
              unit={unitLabels.distanceUnit}
              isHero
              accentColor="#22c55e"
            />

            {/* Split Metrics: Current Pace vs Average Pace */}
            <View className="w-full flex-row justify-around px-2 pt-4 border-t border-zinc-900">
              <View className="items-center">
                <Text className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-1">
                  Current Pace
                </Text>
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="text-3xl font-black text-white"
                >
                  {formatUnitPace(currentPaceSecondsPerKm, unitPreference)}
                </Text>
                <Text className="text-[10px] font-bold text-zinc-600 uppercase mt-0.5">
                  {unitLabels.paceUnit}
                </Text>
              </View>

              <View className="w-[1px] h-12 bg-zinc-900 self-center" />

              <View className="items-center">
                <Text className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-1">
                  Avg Pace
                </Text>
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="text-3xl font-black text-white"
                >
                  {formatUnitPace(avgPaceSecondsPerKm, unitPreference)}
                </Text>
                <Text className="text-[10px] font-bold text-zinc-600 uppercase mt-0.5">
                  {unitLabels.paceUnit}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Lower Control Actions */}
        <View className="pt-4 items-center">
          {status === 'idle' && (
            <View className="items-center">
              <ControlButton
                label={isGpsReady ? 'START RUN' : 'WAITING FOR GPS'}
                variant={isGpsReady ? 'primary' : 'secondary'}
                size="large"
                onPress={async () => {
                  if (!isGpsReady) {
                    setGpsModalVisible(true);
                    return;
                  }
                  try {
                    const res = await startRun();
                    if (!res.success) {
                      setGpsModalVisible(true);
                    }
                  } catch (err) {
                    console.warn('[TruePace] Error starting run:', err);
                  }
                }}
              />
              {!isGpsReady && (
                <TouchableOpacity
                  onPress={() => setGpsModalVisible(true)}
                  className="mt-2.5 px-3 py-1"
                >
                  <Text className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase text-center">
                    Tap to check GPS status
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
                onPress={handleFinishPrompt}
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
        unitPreference={unitPreference}
      />

      {/* GPS Status & Alert Modal */}
      <GpsAlertModal
        visible={gpsModalVisible}
        reason={gpsIssueReason}
        accuracyMeters={gpsAccuracyMeters}
        onDismiss={() => setGpsModalVisible(false)}
        onRequestPermission={requestPermission}
      />
    </View>
  );
}
