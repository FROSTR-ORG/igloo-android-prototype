import { View, Text, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

type StatusType = 'success' | 'error' | 'warning' | 'info' | 'idle';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  count?: number;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Solid status dot colors (matches desktop pattern)
const statusColors: Record<StatusType, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
  idle: 'bg-gray-500',
};

// Text colors for labels
const statusTextColors: Record<StatusType, string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-blue-400',
  idle: 'text-gray-400',
};

// Badge background colors for count
const statusBadgeBg: Record<StatusType, string> = {
  success: 'bg-green-500/20',
  error: 'bg-red-500/20',
  warning: 'bg-yellow-500/20',
  info: 'bg-blue-500/20',
  idle: 'bg-gray-500/20',
};

const sizeStyles: Record<'sm' | 'md' | 'lg', { dot: string; text: string; badge: string }> = {
  sm: {
    dot: 'w-1.5 h-1.5',
    text: 'text-xs',
    badge: 'px-1 py-0.5 text-xs',
  },
  md: {
    dot: 'w-2 h-2',
    text: 'text-sm',
    badge: 'px-1.5 py-0.5 text-xs',
  },
  lg: {
    dot: 'w-2.5 h-2.5',
    text: 'text-base',
    badge: 'px-2 py-0.5 text-sm',
  },
};

export function StatusIndicator({
  status,
  label,
  count,
  pulse = false,
  size = 'md',
  className,
}: StatusIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulse) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pulse, pulseAnim]);

  const dotColor = statusColors[status];
  const textColor = statusTextColors[status];
  const badgeBg = statusBadgeBg[status];
  const sizeStyle = sizeStyles[size];

  return (
    <View className={`flex-row items-center gap-2 ${className || ''}`}>
      {/* Status Dot */}
      <Animated.View
        style={pulse ? { transform: [{ scale: pulseAnim }] } : undefined}
        className={`
          rounded-full
          ${sizeStyle.dot}
          ${dotColor}
        `}
      />

      {/* Optional Label */}
      {label && (
        <Text className={`${sizeStyle.text} ${textColor} font-medium`}>
          {label}
        </Text>
      )}

      {/* Optional Count Badge */}
      {count !== undefined && (
        <View className={`rounded-full ${sizeStyle.badge} ${badgeBg}`}>
          <Text className={`${textColor} font-medium`}>
            {count}
          </Text>
        </View>
      )}
    </View>
  );
}

// Export status colors for external use
export { statusColors, statusTextColors };
