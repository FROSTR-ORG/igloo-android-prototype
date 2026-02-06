import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, Waves, CloudRain, Trees, Radio, Flame, Lock, TreePalm, Sparkles, Bird, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { SoundscapeId, SoundscapeConfig } from '@/types';
import { getAllSoundscapes } from '@/services/audio/soundscapes';

interface SoundscapeSelectorProps {
  value: SoundscapeId;
  onValueChange: (id: SoundscapeId) => void;
  disabled?: boolean;
}

/**
 * Get the icon component for a soundscape
 */
function getSoundscapeIcon(id: SoundscapeId, color: string, size: number) {
  const iconProps = { size, color, strokeWidth: 2 };

  switch (id) {
    case 'ocean-waves':
      return <Waves {...iconProps} />;
    case 'rain':
      return <CloudRain {...iconProps} />;
    case 'forest':
      return <Trees {...iconProps} />;
    case 'white-noise':
      return <Radio {...iconProps} />;
    case 'campfire':
      return <Flame {...iconProps} />;
    case 'amazon-jungle':
      return <TreePalm {...iconProps} />;
    case 'ambient-dream':
      return <Sparkles {...iconProps} />;
    case 'birds':
      return <Bird {...iconProps} />;
    case 'rain-and-birds':
      return <CloudRain {...iconProps} />;
    case 'space-atmosphere':
      return <Star {...iconProps} />;
    default:
      return <Waves {...iconProps} />;
  }
}

/**
 * Single soundscape option card
 */
function SoundscapeOption({
  soundscape,
  isSelected,
  disabled,
  onPress,
}: {
  soundscape: SoundscapeConfig;
  isSelected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const isAvailable = soundscape.available;
  const isDisabled = disabled || !isAvailable;

  const handlePress = async () => {
    if (isDisabled) return;
    await Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      className={`flex-1 min-w-[45%] p-3 rounded-xl border-2 ${
        isSelected
          ? 'bg-blue-600/20 border-blue-500'
          : isAvailable
            ? 'bg-gray-800/50 border-gray-700/50 active:bg-gray-700/50'
            : 'bg-gray-900/30 border-gray-800/30'
      }`}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View
          className={`w-8 h-8 rounded-full items-center justify-center ${
            isSelected ? 'bg-blue-500/30' : isAvailable ? 'bg-gray-700/50' : 'bg-gray-800/30'
          }`}
        >
          {getSoundscapeIcon(
            soundscape.id,
            isSelected ? '#60a5fa' : isAvailable ? '#9ca3af' : '#4b5563',
            18
          )}
        </View>
        {isSelected && (
          <View className="w-5 h-5 rounded-full bg-blue-500 items-center justify-center">
            <Check size={12} color="white" strokeWidth={3} />
          </View>
        )}
        {!isAvailable && (
          <View className="flex-row items-center gap-1">
            <Lock size={10} color="#6b7280" strokeWidth={2} />
            <Text className="text-[10px] text-gray-500 uppercase">Soon</Text>
          </View>
        )}
      </View>
      <Text
        className={`text-sm font-medium ${
          isSelected ? 'text-blue-300' : isAvailable ? 'text-gray-200' : 'text-gray-500'
        }`}
      >
        {soundscape.name}
      </Text>
      <Text
        className={`text-xs mt-0.5 ${
          isSelected ? 'text-blue-400/70' : isAvailable ? 'text-gray-400' : 'text-gray-600'
        }`}
        numberOfLines={1}
      >
        {soundscape.description}
      </Text>
    </Pressable>
  );
}

/**
 * SoundscapeSelector - Grid of soundscape options for selection.
 * Shows all soundscapes with coming soon badges for unavailable ones.
 */
export function SoundscapeSelector({ value, onValueChange, disabled }: SoundscapeSelectorProps) {
  const soundscapes = getAllSoundscapes();

  return (
    <View className="py-2">
      <View className="flex-row flex-wrap gap-3">
        {soundscapes.map((soundscape) => (
          <SoundscapeOption
            key={soundscape.id}
            soundscape={soundscape}
            isSelected={value === soundscape.id}
            disabled={disabled}
            onPress={() => onValueChange(soundscape.id)}
          />
        ))}
      </View>
    </View>
  );
}
