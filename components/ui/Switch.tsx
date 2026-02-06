import { View, Text, Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';
import Colors from '@/constants/Colors';

interface SwitchProps extends Omit<RNSwitchProps, 'value' | 'onValueChange'> {
  label?: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function Switch({
  label,
  description,
  value,
  onValueChange,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <View className="flex-row items-center justify-between">
      {(label || description) && (
        <View className="flex-1 mr-4">
          {label && (
            <Text
              className={`
                text-base font-medium
                ${disabled ? 'text-gray-500' : 'text-gray-100'}
              `}
            >
              {label}
            </Text>
          )}
          {description && (
            <Text className="text-sm text-gray-400 mt-0.5">
              {description}
            </Text>
          )}
        </View>
      )}
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: Colors.switchTrackOff,
          true: Colors.switchTrackOn,
        }}
        thumbColor={value ? Colors.switchThumbOn : Colors.switchThumbOff}
        ios_backgroundColor={Colors.switchTrackOff}
        {...props}
      />
    </View>
  );
}
