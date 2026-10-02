import React from 'react';
import { View, Text } from 'react-native';

interface MetricTileProps {
  label: string;
  value: string;
  unit?: string;
  isHero?: boolean;
  accentColor?: string;
}

export const MetricTile: React.FC<MetricTileProps> = ({
  label,
  value,
  unit,
  isHero = false,
  accentColor,
}) => {
  return (
    <View className={`items-center justify-center ${isHero ? 'my-4' : 'my-2'}`}>
      <Text className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-1">
        {label}
      </Text>
      <View className="flex-row items-baseline">
        <Text
          style={accentColor ? { color: accentColor } : undefined}
          className={`${
            isHero
              ? 'text-7xl font-extrabold tracking-tighter text-white'
              : 'text-4xl font-bold tracking-tight text-white'
          }`}
        >
          {value}
        </Text>
        {unit && (
          <Text className="ml-1.5 text-base font-semibold text-zinc-400">
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
};
