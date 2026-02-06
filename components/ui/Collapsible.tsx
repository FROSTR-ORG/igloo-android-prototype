/// <reference lib="dom" />
import * as Haptics from 'expo-haptics';
import { ChevronDown } from 'lucide-react-native';
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from 'react-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  onToggle?: (isExpanded: boolean) => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  onToggle?: (isExpanded: boolean) => void;
}

export function Collapsible({
  title,
  icon,
  actions,
  defaultOpen = false,
  children,
  className,
  headerClassName,
  contentClassName,
  onToggle,
}: CollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = !isExpanded;
    setIsExpanded(newState);
    onToggle?.(newState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View className={`${className || ''}`}>
      {/* Header */}
      <Pressable
        onPress={handleToggle}
        {...(Platform.OS === 'web' && {
          onKeyPress: (event: React.KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleToggle();
            }
          },
        })}
        className={`
          flex-row items-center justify-between py-3 px-4
          bg-gray-800/40 rounded-lg
          active:bg-gray-800/60
          ${headerClassName || ''}
        `}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${title}, ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        <View className="flex-row items-center gap-2 flex-1">
          {/* Icon */}
          {icon && (
            <View className="items-center justify-center">
              {icon}
            </View>
          )}

          {/* Title */}
          <Text className="text-blue-200 text-sm font-medium flex-1">
            {title}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Actions (right side, before chevron) */}
          {actions && (
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="flex-row items-center"
            >
              {actions}
            </Pressable>
          )}

          {/* Chevron */}
          <View
            style={{
              transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
            }}
          >
            <ChevronDown
              size={16}
              color="#93c5fd" // blue-300
              strokeWidth={2}
            />
          </View>
        </View>
      </Pressable>

      {/* Content */}
      {isExpanded && (
        <View
          className={`
            mt-2 overflow-hidden
            ${contentClassName || ''}
          `}
        >
          {children}
        </View>
      )}
    </View>
  );
}

// Variant for use inside cards (no background)
export function CollapsibleSection({
  title,
  icon,
  actions,
  defaultOpen = false,
  children,
  className,
  onToggle,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = !isExpanded;
    setIsExpanded(newState);
    onToggle?.(newState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View className={`${className || ''}`}>
      {/* Header */}
      <Pressable
        onPress={handleToggle}
        className="flex-row items-center justify-between py-2"
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View className="flex-row items-center gap-2 flex-1">
          {icon && <View>{icon}</View>}
          <Text className="text-gray-400 text-sm font-medium">{title}</Text>
        </View>

        <View className="flex-row items-center gap-2">
          {actions}
          <View
            style={{
              transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
            }}
          >
            <ChevronDown
              size={14}
              color="#9ca3af" // gray-400
              strokeWidth={2}
            />
          </View>
        </View>
      </Pressable>

      {/* Content */}
      {isExpanded && (
        <View className="mt-1">
          {children}
        </View>
      )}
    </View>
  );
}
