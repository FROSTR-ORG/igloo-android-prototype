import React from 'react';
import { View, Text } from 'react-native';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react-native';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactElement;
  className?: string;
}

const variantStyles: Record<AlertVariant, {
  bg: string;
  border: string;
  titleColor: string;
  textColor: string;
  iconColor: string;
}> = {
  success: {
    bg: 'bg-green-900/30',
    border: 'border-green-800/30',
    titleColor: 'text-green-200',
    textColor: 'text-green-300',
    iconColor: '#4ade80', // green-400
  },
  error: {
    bg: 'bg-red-900/30',
    border: 'border-red-800/30',
    titleColor: 'text-red-200',
    textColor: 'text-red-300',
    iconColor: '#f87171', // red-400
  },
  warning: {
    bg: 'bg-yellow-900/30',
    border: 'border-yellow-800/30',
    titleColor: 'text-yellow-200',
    textColor: 'text-yellow-300',
    iconColor: '#facc15', // yellow-400
  },
  info: {
    bg: 'bg-blue-900/30',
    border: 'border-blue-800/30',
    titleColor: 'text-blue-200',
    textColor: 'text-blue-300',
    iconColor: '#60a5fa', // blue-400
  },
};

export function Alert({
  variant,
  title,
  children,
  icon,
  className = '',
}: AlertProps) {
  const styles = variantStyles[variant];

  // Default icons with proper color
  const getDefaultIcon = () => {
    const iconProps = { size: 18, strokeWidth: 2, color: styles.iconColor };
    switch (variant) {
      case 'success':
        return <CheckCircle {...iconProps} />;
      case 'error':
        return <XCircle {...iconProps} />;
      case 'warning':
        return <AlertCircle {...iconProps} />;
      case 'info':
        return <Info {...iconProps} />;
    }
  };

  // Use provided icon as-is (user controls color), or default icon
  const renderIcon = () => {
    if (icon) {
      return icon;
    }
    return getDefaultIcon();
  };

  return (
    <View
      className={`
        flex-row p-4 rounded-lg border
        ${styles.bg} ${styles.border}
        ${className}
      `}
    >
      {/* Icon */}
      <View className="mr-3 mt-0.5">
        {renderIcon()}
      </View>

      {/* Content */}
      <View className="flex-1">
        {title && (
          <Text className={`text-sm font-semibold ${styles.titleColor} mb-1`}>
            {title}
          </Text>
        )}
        {typeof children === 'string' ? (
          <Text className={`text-sm ${styles.textColor}`}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
