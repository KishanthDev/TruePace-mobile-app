import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RunSummary } from '../types/tracking';
import { getRunHistory, clearRunHistory, deleteRun } from '../utils/storage';
import { formatDuration } from '../utils/geo';
import {
  UnitSystem,
  formatUnitDistance,
  formatUnitPace,
  getUnitLabels,
} from '../utils/units';
import {
  generateGpx,
  generateTcx,
  generateHistoryBackupJson,
} from '../utils/gpxSerializer';
import { RouteVisualizer } from './RouteVisualizer';

interface RunHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  unitPreference?: UnitSystem;
}

export const RunHistoryModal: React.FC<RunHistoryModalProps> = ({
  visible,
  onClose,
  unitPreference = 'metric',
}) => {
  const insets = useSafeAreaInsets();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const unitLabels = getUnitLabels(unitPreference);

  useEffect(() => {
    let isMounted = true;
    if (visible) {
      getRunHistory().then((list) => {
        if (isMounted) {
          setRuns(list);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [visible]);

  const handleDeleteRun = (run: RunSummary) => {
    Alert.alert(
      'Delete Workout?',
      `Are you sure you want to delete the ${formatUnitDistance(run.distanceMeters, unitPreference)} ${unitLabels.distanceUnit} run from ${formatDate(run.startTime)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteRun(run.id);
            if (success) {
              setRuns((prev) => prev.filter((r) => r.id !== run.id));
            }
          },
        },
      ]
    );
  };

  const handleExportRun = (run: RunSummary) => {
    Alert.alert(
      'Export Workout Data',
      'Select export format compatible with Strava, Garmin, Apple Health, or Google Fit:',
      [
        {
          text: 'GPX 1.1 (Standard)',
          onPress: async () => {
            try {
              await Share.share({
                title: `TruePace_${run.id}.gpx`,
                message: generateGpx(run),
              });
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Export failed';
              Alert.alert('Export Failed', message);
            }
          },
        },
        {
          text: 'TCX (Garmin Training Center)',
          onPress: async () => {
            try {
              await Share.share({
                title: `TruePace_${run.id}.tcx`,
                message: generateTcx(run),
              });
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Export failed';
              Alert.alert('Export Failed', message);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleExportAllBackup = async () => {
    if (runs.length === 0) return;
    try {
      const backupJson = generateHistoryBackupJson(runs);
      await Share.share({
        title: `TruePace_Backup_${new Date().toISOString().slice(0, 10)}.json`,
        message: backupJson,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Backup export failed';
      Alert.alert('Backup Failed', message);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear All History?',
      'Are you sure you want to permanently erase your entire run history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearRunHistory();
            setRuns([]);
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View
        style={{
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        className="flex-1 bg-black"
      >
        <View className="flex-1 px-5 pt-2">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-zinc-800">
            <Text className="text-xl font-bold tracking-wider text-white uppercase">
              Run History
            </Text>
            <View className="flex-row items-center gap-2">
              {runs.length > 0 && (
                <TouchableOpacity
                  onPress={handleExportAllBackup}
                  className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800"
                >
                  <Text className="text-xs font-semibold text-emerald-400">Backup All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                className="px-3 py-1.5 rounded-full bg-zinc-800"
              >
                <Text className="text-sm font-semibold text-zinc-300">Close</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {runs.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-base text-zinc-500">No cached runs yet.</Text>
              <Text className="mt-1 text-xs text-zinc-600">
                Completed runs with valid distance will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={runs}
              keyExtractor={(item) => item.id}
              className="py-4"
              renderItem={({ item }) => (
                <View className="p-4 mb-3 rounded-2xl bg-zinc-900 border border-zinc-800/80">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs font-semibold text-zinc-400">
                      {formatDate(item.startTime)}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Text
                        style={{ fontVariant: ['tabular-nums'] }}
                        className="text-xs font-bold text-emerald-400"
                      >
                        {formatUnitDistance(item.distanceMeters, unitPreference)} {unitLabels.distanceUnit}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleExportRun(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="px-2 py-0.5 rounded bg-zinc-800/80"
                      >
                        <Text className="text-[10px] font-semibold text-emerald-400">Export</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteRun(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="px-2 py-0.5 rounded bg-zinc-800/80"
                      >
                        <Text className="text-[10px] font-semibold text-zinc-400">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Badges row: Consistency, Negative split, PR */}
                  {(item.consistencyScore !== undefined || item.isNegativeSplit || (item.newRecords && item.newRecords.length > 0)) && (
                    <View className="flex-row flex-wrap gap-1.5 mb-2.5">
                      {item.consistencyScore !== undefined && (
                        <View className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60">
                          <Text className="text-[9px] font-bold text-zinc-300">
                            PACE {item.consistencyScore}% • {item.consistencyLabel?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {item.isNegativeSplit && (
                        <View className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/40">
                          <Text className="text-[9px] font-extrabold text-emerald-400">
                            NEGATIVE SPLIT
                          </Text>
                        </View>
                      )}
                      {item.newRecords && item.newRecords.length > 0 && (
                        <View className="px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/40">
                          <Text className="text-[9px] font-extrabold text-amber-400">
                            RECORD SET
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View className="flex-row justify-between pt-2 border-t border-zinc-800/50">
                    <View>
                      <Text className="text-[10px] tracking-wider text-zinc-500 uppercase">
                        Duration
                      </Text>
                      <Text
                        style={{ fontVariant: ['tabular-nums'] }}
                        className="text-base font-bold text-white"
                      >
                        {formatDuration(item.durationSeconds)}
                      </Text>
                    </View>

                    <View>
                      <Text className="text-[10px] tracking-wider text-zinc-500 uppercase">
                        Avg Pace
                      </Text>
                      <Text
                        style={{ fontVariant: ['tabular-nums'] }}
                        className="text-base font-bold text-white"
                      >
                        {formatUnitPace(item.avgPaceSecondsPerKm, unitPreference)}{unitLabels.paceUnit}
                      </Text>
                    </View>

                    <View>
                      <Text className="text-[10px] tracking-wider text-zinc-500 uppercase">
                        Best Pace
                      </Text>
                      <Text
                        style={{ fontVariant: ['tabular-nums'] }}
                        className="text-base font-bold text-white"
                      >
                        {formatUnitPace(item.bestPaceSecondsPerKm, unitPreference)}{unitLabels.paceUnit}
                      </Text>
                    </View>
                  </View>

                  {/* Splits Breakdown */}
                  {item.splits && item.splits.length > 0 && (
                    <View className="mt-3 pt-3 border-t border-zinc-800/50">
                      <Text className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase mb-2">
                        Kilometer Splits
                      </Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {(() => {
                          const fastest = Math.min(...item.splits);
                          return item.splits.map((split, sIdx) => {
                            const isFast = split === fastest && item.splits!.length > 1;
                            return (
                              <View
                                key={sIdx}
                                className={`px-2.5 py-1 rounded-lg border ${
                                  isFast
                                    ? 'bg-emerald-950/40 border-emerald-500/40'
                                    : 'bg-zinc-950 border-zinc-800'
                                }`}
                              >
                                <Text
                                  style={{ fontVariant: ['tabular-nums'] }}
                                  className={`text-[11px] font-bold ${
                                    isFast ? 'text-emerald-400' : 'text-zinc-300'
                                  }`}
                                >
                                  KM {sIdx + 1}: {formatUnitPace(split, unitPreference)}
                                  {isFast ? ' ★' : ''}
                                </Text>
                              </View>
                            );
                          });
                        })()}
                      </View>
                    </View>
                  )}

                  {/* Route Polyline Preview */}
                  {item.breadcrumbs && item.breadcrumbs.length >= 2 && (
                    <RouteVisualizer run={item} height={120} />
                  )}
                </View>
              )}
            />
          )}

          {/* Footer */}
          {runs.length > 0 && (
            <View className="pb-6 pt-2">
              <TouchableOpacity
                onPress={handleClear}
                className="py-3 items-center rounded-xl bg-zinc-900/60 border border-zinc-800"
              >
                <Text className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                  Clear History Cache
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
