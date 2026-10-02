import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { RunSummary } from '../types/tracking';
import { getRunHistory, clearRunHistory } from '../utils/storage';
import { formatDistanceKm, formatDuration, formatPace } from '../utils/geo';

interface RunHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RunHistoryModal: React.FC<RunHistoryModalProps> = ({
  visible,
  onClose,
}) => {
  const [runs, setRuns] = useState<RunSummary[]>([]);

  const loadHistory = async () => {
    const list = await getRunHistory();
    setRuns(list);
  };

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible]);

  const handleClear = async () => {
    await clearRunHistory();
    setRuns([]);
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
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1 px-5 pt-4">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-zinc-800">
            <Text className="text-xl font-bold tracking-wider text-white uppercase">
              Run History
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="px-3 py-1.5 rounded-full bg-zinc-800"
            >
              <Text className="text-sm font-semibold text-zinc-300">Close</Text>
            </TouchableOpacity>
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
                    <Text className="text-xs font-bold text-emerald-400">
                      {formatDistanceKm(item.distanceMeters)} KM
                    </Text>
                  </View>

                  <View className="flex-row justify-between pt-2 border-t border-zinc-800/50">
                    <View>
                      <Text className="text-[10px] tracking-wider text-zinc-500 uppercase">
                        Duration
                      </Text>
                      <Text className="text-base font-bold text-white">
                        {formatDuration(item.durationSeconds)}
                      </Text>
                    </View>

                    <View>
                      <Text className="text-[10px] tracking-wider text-zinc-500 uppercase">
                        Avg Pace
                      </Text>
                      <Text className="text-base font-bold text-white">
                        {formatPace(item.avgPaceSecondsPerKm)}/km
                      </Text>
                    </View>

                    <View>
                      <Text className="text-[10px] tracking-wider text-zinc-500 uppercase">
                        Best Pace
                      </Text>
                      <Text className="text-base font-bold text-white">
                        {formatPace(item.bestPaceSecondsPerKm)}/km
                      </Text>
                    </View>
                  </View>
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
      </SafeAreaView>
    </Modal>
  );
};
