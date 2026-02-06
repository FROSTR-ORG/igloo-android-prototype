import { View, TextInput, Text, type TextInputProps } from 'react-native';
import { useState } from 'react';
import Colors from '@/constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  className,
  multiline,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !!error;

  return (
    <View className={className}>
      {label && (
        <Text className="text-sm font-medium text-gray-300 mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        className={`
          px-4 py-3 rounded-lg
          bg-gray-800/50
          text-blue-300
          border-2
          text-sm
          ${hasError
            ? 'border-red-500'
            : isFocused
              ? 'border-blue-500'
              : 'border-gray-700/50'
          }
          ${multiline ? 'min-h-[100px] text-top' : ''}
        `}
        placeholderTextColor={Colors.placeholder}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {error && (
        <Text className="text-sm text-red-400 mt-1">{error}</Text>
      )}
      {hint && !error && (
        <Text className="text-sm text-gray-400 mt-1">{hint}</Text>
      )}
    </View>
  );
}
