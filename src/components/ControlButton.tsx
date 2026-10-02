import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

interface ControlButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning';
  size?: 'large' | 'medium';
}

export const ControlButton: React.FC<ControlButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
}) => {
  const getColors = () => {
    switch (variant) {
      case 'primary':
        return 'bg-emerald-500 active:bg-emerald-600 text-black';
      case 'warning':
        return 'bg-amber-500 active:bg-amber-600 text-black';
      case 'danger':
        return 'bg-red-500/20 border border-red-500/50 active:bg-red-500/30 text-red-400';
      case 'secondary':
      default:
        return 'bg-zinc-800 active:bg-zinc-700 text-white';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'warning':
        return 'text-black font-extrabold';
      case 'danger':
        return 'text-red-400 font-bold';
      case 'secondary':
      default:
        return 'text-white font-bold';
    }
  };

  const isLarge = size === 'large';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      className={`items-center justify-center rounded-full ${
        isLarge ? 'h-20 px-10 min-w-[200px]' : 'h-14 px-6 min-w-[120px]'
      } ${getColors()}`}
    >
      <Text className={`tracking-widest uppercase text-center ${isLarge ? 'text-xl' : 'text-sm'} ${getTextColor()}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};
