import * as Haptics from 'expo-haptics';
import { Plus, RotateCcw, Server, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { DEFAULT_RELAYS } from '@/types';
import { IconButton } from './IconButton';

interface RelayInputProps {
  relays: string[];
  onChange: (relays: string[]) => void;
  defaultRelays?: readonly string[];
  showResetButton?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Validates a relay URL
 * Must be wss:// or ws:// protocol with valid URL structure
 */
function validateRelayUrl(url: string): { valid: boolean; error?: string } {
  const trimmed = url.trim();

  if (!trimmed) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  // Must start with ws:// or wss:// (case-insensitive)
  const lowerTrimmed = trimmed.toLowerCase();
  if (!lowerTrimmed.startsWith('wss://') && !lowerTrimmed.startsWith('ws://')) {
    return { valid: false, error: 'URL must start with wss:// or ws://' };
  }

  // Validate URL format using regex (works in React Native without URL constructor)
  // Pattern: ws(s)://hostname[:port][/path]
  const urlPattern = new RegExp('^wss?:\\/\\/([^\\s\\/?#:]+|\\[[^\\]]+\\])(:\\d+)?(\\/[^\\s?#]*)?$', 'i');
  if (!urlPattern.test(trimmed)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  return { valid: true };
}

/**
 * Normalize relay URL (trim, lowercase protocol, remove trailing slash)
 */
function normalizeRelayUrl(url: string): string {
  let normalized = url.trim();

  // Normalize protocol to lowercase (case-insensitive check)
  const protocolEndIndex = normalized.indexOf('://');
  
  if (protocolEndIndex !== -1) {
    const protocolPart = normalized.substring(0, protocolEndIndex).toLowerCase();
    const remainder = normalized.substring(protocolEndIndex + 3);
    
    if (protocolPart === 'wss') {
      normalized = 'wss://' + remainder;
    } else if (protocolPart === 'ws') {
      normalized = 'ws://' + remainder;
    }
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

export function RelayInput({
  relays,
  onChange,
  defaultRelays = DEFAULT_RELAYS,
  showResetButton = true,
  disabled = false,
  className,
}: RelayInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const handleAddRelay = () => {
    const validation = validateRelayUrl(inputValue);

    if (!validation.valid) {
      setInputError(validation.error || 'Invalid URL');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const normalized = normalizeRelayUrl(inputValue);

    // Check for duplicates
    if (relays.includes(normalized)) {
      setInputError('Relay already added');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    onChange([...relays, normalized]);
    setInputValue('');
    setInputError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveRelay = (relayToRemove: string) => {
    Alert.alert(
      'Remove Relay',
      `Remove ${relayToRemove}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onChange(relays.filter(r => r !== relayToRemove));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset Relays',
      'Reset to default relay list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            onChange([...defaultRelays]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleInputChange = (text: string) => {
    setInputValue(text);
    // Clear error when user starts typing
    if (inputError) {
      setInputError(null);
    }
  };

  return (
    <View className={className}>
      {/* Relay List */}
      <View className="mb-3">
        {relays.length === 0 ? (
          <View className="py-4 items-center">
            <Server size={24} color="#6b7280" strokeWidth={1.5} />
            <Text className="text-gray-500 text-sm mt-2">No relays configured</Text>
          </View>
        ) : (
          relays.map((relay, index) => (
            <View
              key={relay}
              className={`
                flex-row items-center justify-between py-2.5 px-3
                bg-gray-800/30 rounded-lg
                ${index < relays.length - 1 ? 'mb-2' : ''}
              `}
            >
              <View className="flex-row items-center flex-1 mr-2">
                <Server size={16} color="#6b7280" strokeWidth={1.5} />
                <Text
                  className="text-gray-300 text-sm ml-2 flex-1"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {relay}
                </Text>
              </View>
              <IconButton
                icon={<Trash2 size={16} color="#f87171" strokeWidth={2} />}
                variant="destructive"
                size="sm"
                onPress={() => handleRemoveRelay(relay)}
                disabled={disabled}
              />
            </View>
          ))
        )}
      </View>

      {/* Add Relay Input */}
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <TextInput
            className={`
              bg-gray-900 text-gray-100 text-sm
              px-3 py-2.5 rounded-lg
              border
              ${inputError
                ? 'border-red-500'
                : inputFocused
                  ? 'border-blue-500'
                  : 'border-gray-700/50'
              }
            `}
            placeholder="wss://relay.example.com"
            placeholderTextColor="#6b7280"
            value={inputValue}
            onChangeText={handleInputChange}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!disabled}
            onSubmitEditing={handleAddRelay}
            returnKeyType="done"
          />
          {inputError && (
            <Text className="text-red-400 text-xs mt-1 ml-1">
              {inputError}
            </Text>
          )}
        </View>
        <IconButton
          icon={<Plus size={18} color="#60a5fa" strokeWidth={2} />}
          variant="outline"
          size="lg"
          onPress={handleAddRelay}
          disabled={disabled || !inputValue.trim()}
        />
      </View>

      {/* Reset to Defaults */}
      {showResetButton && (
        <Pressable
          onPress={handleResetToDefaults}
          disabled={disabled}
          className="flex-row items-center justify-center mt-4 py-2"
        >
          <RotateCcw size={14} color="#60a5fa" strokeWidth={2} />
          <Text className="text-blue-400 text-sm ml-1.5">
            Reset to default relays
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export { normalizeRelayUrl, validateRelayUrl };

