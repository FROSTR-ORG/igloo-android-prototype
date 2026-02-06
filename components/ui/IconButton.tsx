import {
  TouchableOpacity,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';

type IconButtonVariant = 'default' | 'ghost' | 'destructive' | 'success' | 'outline';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  icon: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  haptic?: boolean;
}

const variantStyles: Record<IconButtonVariant, string> = {
  default: 'bg-gray-600/50 active:bg-gray-600/90',
  ghost: 'bg-transparent active:bg-gray-900/30',
  destructive: 'bg-transparent active:bg-red-900/30',
  success: 'bg-transparent active:bg-green-900/30',
  outline: 'bg-transparent border border-gray-700 active:border-gray-600',
};

const variantIconColors: Record<IconButtonVariant, string> = {
  default: '#f3f4f6', // gray-100
  ghost: '#9ca3af', // gray-400
  destructive: '#f87171', // red-400
  success: '#4ade80', // green-400
  outline: '#9ca3af', // gray-400
};

const sizeStyles: Record<IconButtonSize, { container: string; iconSize: number }> = {
  sm: {
    container: 'h-6 w-6 rounded-md',
    iconSize: 14,
  },
  md: {
    container: 'h-8 w-8 rounded-md',
    iconSize: 18,
  },
  lg: {
    container: 'h-10 w-10 rounded-lg',
    iconSize: 22,
  },
};

export function IconButton({
  icon,
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  haptic = true,
  className,
  onPress,
  ...props
}: IconButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];
  const iconColor = variantIconColors[variant];

  const handlePress = (event: any) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(event);
  };

  return (
    <TouchableOpacity
      className={`
        items-center justify-center
        ${sizeStyle.container}
        ${variantStyle}
        ${isDisabled ? 'opacity-50' : ''}
        ${className || ''}
      `}
      disabled={isDisabled}
      activeOpacity={0.7}
      onPress={handlePress}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={iconColor}
          size="small"
        />
      ) : (
        icon
      )}
    </TouchableOpacity>
  );
}

// Export icon color getter for use with Lucide icons
export function getIconButtonColor(variant: IconButtonVariant = 'default'): string {
  return variantIconColors[variant];
}

// Export size getter for use with Lucide icons
export function getIconButtonSize(size: IconButtonSize = 'md'): number {
  return sizeStyles[size].iconSize;
}
