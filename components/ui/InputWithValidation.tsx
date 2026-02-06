import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { useState } from 'react';
import Colors from '@/constants/Colors';

export interface InputWithValidationProps extends TextInputProps {
  label: string | React.ReactNode;
  value: string;
  onChangeText: (value: string) => void;
  isValid?: boolean;
  errorMessage?: string;
  isRequired?: boolean;
  hint?: string;
}

export function InputWithValidation({
  label,
  value,
  onChangeText,
  isValid = true,
  errorMessage,
  isRequired = false,
  hint,
  className,
  multiline,
  ...props
}: InputWithValidationProps) {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !isValid && value.length > 0;
  const showError = hasError && errorMessage;

  return (
    <View className={className}>
      {/* Label with required indicator */}
      <View className="flex-row items-center mb-1.5">
        {typeof label === 'string' ? (
          <Text className="text-sm font-medium text-blue-200">{label}</Text>
        ) : (
          label
        )}
        {isRequired && (
          <Text className="text-red-500 ml-0.5">*</Text>
        )}
      </View>

      {/* Input field */}
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
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={Colors.placeholder}
        {...props}
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
      />

      {/* Error message */}
      {showError && (
        <Text className="text-sm text-red-400 mt-1">{errorMessage}</Text>
      )}

      {/* Hint text (only show if no error) */}
      {hint && !showError && (
        <Text className="text-sm text-gray-400 mt-1">{hint}</Text>
      )}
    </View>
  );
}
