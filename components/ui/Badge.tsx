import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'orange';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

// Ring-inset style with 20% opacity backgrounds (dark-only, matches igloo design system)
// Includes purple (for ecdh events) and orange (for sign events) to match desktop
const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string; ring: string }> = {
  default: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    dot: 'bg-gray-500',
    ring: 'border border-gray-500/30',
  },
  success: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    dot: 'bg-green-500',
    ring: 'border border-green-500/30',
  },
  warning: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    dot: 'bg-yellow-500',
    ring: 'border border-yellow-500/30',
  },
  error: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-500',
    ring: 'border border-red-500/30',
  },
  info: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    dot: 'bg-blue-500',
    ring: 'border border-blue-500/30',
  },
  purple: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    dot: 'bg-purple-500',
    ring: 'border border-purple-500/30',
  },
  orange: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    dot: 'bg-orange-500',
    ring: 'border border-orange-500/30',
  },
};

const sizeStyles: Record<BadgeSize, { container: string; text: string; dot: string }> = {
  sm: {
    container: 'px-2 py-0.5 rounded-full',
    text: 'text-xs',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    container: 'px-2.5 py-0.5 rounded-full',
    text: 'text-sm',
    dot: 'w-2 h-2',
  },
};

export function Badge({ label, variant = 'default', size = 'md', dot = false, className }: BadgeProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <View
      className={`
        flex-row items-center
        ${sizeStyle.container}
        ${variantStyle.bg}
        ${variantStyle.ring}
        ${className || ''}
      `}
    >
      {dot && (
        <View
          className={`
            rounded-full mr-1.5
            ${sizeStyle.dot}
            ${variantStyle.dot}
          `}
        />
      )}
      <Text
        className={`
          font-medium
          ${sizeStyle.text}
          ${variantStyle.text}
        `}
      >
        {label}
      </Text>
    </View>
  );
}
