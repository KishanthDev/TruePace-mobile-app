import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { GpsIssueReason } from '../types/tracking';

interface GpsAlertModalProps {
  visible: boolean;
  reason: GpsIssueReason;
  accuracyMeters: number | null;
  onDismiss: () => void;
  onRequestPermission: () => Promise<boolean>;
}

export const GpsAlertModal: React.FC<GpsAlertModalProps> = ({
  visible,
  reason,
  accuracyMeters,
  onDismiss,
  onRequestPermission,
}) => {
  const getDetails = () => {
    switch (reason) {
      case 'services_disabled':
        return {
          title: 'Location Services Off',
          badge: 'GPS DISABLED',
          badgeColor: 'bg-red-500/20 border-red-500/50 text-red-400',
          message:
            'Device location services are turned off. TruePace requires active GPS hardware to measure your pace and distance.',
          actionLabel: 'Open Device Settings',
          onAction: () => Linking.openSettings(),
        };
      case 'permission_denied':
        return {
          title: 'Location Permission Needed',
          badge: 'PERMISSION REQUIRED',
          badgeColor: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
          message:
            'Location access is required so TruePace can track your workout accurately in real-time.',
          actionLabel: 'Grant Permission',
          onAction: async () => {
            const granted = await onRequestPermission();
            if (!granted) {
              Linking.openSettings();
            }
          },
        };
      case 'weak_signal':
      case 'acquiring':
      default:
        return {
          title: 'Waiting for Satellite Lock',
          badge: accuracyMeters ? `CURRENT ACCURACY: ±${Math.round(accuracyMeters)}M` : 'SEARCHING SATELLITES',
          badgeColor: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
          message:
            'Satellite signals are too weak or blocked by a ceiling. To ensure your distance and pace are 100% accurate, TruePace locks "START RUN" until an accurate GPS signal is secured.\n\nPlease move outdoors or near an open window.',
          actionLabel: null,
          onAction: null,
        };
    }
  };

  const details = getDetails();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/80 items-center justify-center px-6">
        <View className="w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          {/* Header Badge */}
          <View className="items-start mb-4">
            <View className={`px-3 py-1 rounded-full border ${details.badgeColor}`}>
              <Text className="text-[10px] font-black tracking-widest uppercase">
                {details.badge}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text className="text-xl font-bold tracking-tight text-white mb-2">
            {details.title}
          </Text>

          {/* Body message */}
          <Text className="text-sm text-zinc-400 leading-relaxed mb-6">
            {details.message}
          </Text>

          {/* Buttons */}
          <View className="space-y-3 gap-2">
            {details.actionLabel && details.onAction && (
              <TouchableOpacity
                onPress={details.onAction}
                activeOpacity={0.8}
                className="w-full h-12 bg-white items-center justify-center rounded-xl"
              >
                <Text className="text-sm font-bold text-black uppercase tracking-wider">
                  {details.actionLabel}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onDismiss}
              activeOpacity={0.8}
              className="w-full h-12 bg-zinc-900 border border-zinc-800 items-center justify-center rounded-xl"
            >
              <Text className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
                Understood
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
