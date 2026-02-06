import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState, useCallback } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, QrCode } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IconButton } from './IconButton';
import { HelpTooltip } from './Tooltip';
import { QRCodeModal } from './QRCodeModal';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CredentialDisplayProps {
  /** Label for the credential */
  label: string;
  /** The credential string (e.g., bfgroup... or bfshare...) */
  credential: string;
  /** Decoded data to show when expanded */
  decodedData?: object;
  /** Whether the credential should be masked (for secret share) */
  masked?: boolean;
  /** Number of characters to show before masking/truncating */
  visibleChars?: number;
  /** Help tooltip content */
  helpContent?: string;
  /** Whether to show QR code button. Default: true */
  showQR?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * CredentialDisplay component for showing group/share credentials.
 * Matches desktop's credential display pattern with:
 * - Copy button with check feedback
 * - Expandable decoded JSON view
 * - Optional masking for sensitive data
 */
export function CredentialDisplay({
  label,
  credential,
  decodedData,
  masked = false,
  visibleChars = 24,
  helpContent,
  showQR = true,
  className = '',
}: CredentialDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const { copied, copy } = useCopyFeedback();

  const handleToggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isExpanded]);

  const handleCopy = useCallback(() => {
    copy(credential);
  }, [copy, credential]);

  // Format the credential for display
  const formatCredential = (cred: string) => {
    if (cred.length <= visibleChars) return cred;
    if (masked) {
      return `${cred.slice(0, visibleChars)}${'•'.repeat(12)}`;
    }
    return `${cred.slice(0, visibleChars)}...`;
  };

  // Format decoded data as JSON
  const formatDecodedData = () => {
    if (!decodedData) return null;
    try {
      return JSON.stringify(decodedData, null, 2);
    } catch {
      return 'Unable to decode';
    }
  };

  return (
    <View className={`bg-gray-800/30 rounded-lg border border-gray-700/30 ${className}`}>
      {/* Header Row */}
      <View className="flex-row items-center justify-between px-3 py-2.5 border-b border-gray-700/30">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-medium text-blue-200">{label}</Text>
          {helpContent && (
            <HelpTooltip
              title={label}
              content={helpContent}
              size={14}
            />
          )}
        </View>
        <View className="flex-row items-center gap-1">
          {/* QR Button */}
          {showQR && (
            <IconButton
              icon={<QrCode size={14} color="#9ca3af" strokeWidth={2} />}
              variant="ghost"
              size="sm"
              onPress={() => setShowQRModal(true)}
            />
          )}
          {/* Copy Button */}
          <IconButton
            icon={
              copied ? (
                <Check size={14} color="#4ade80" strokeWidth={2} />
              ) : (
                <Copy size={14} color="#9ca3af" strokeWidth={2} />
              )
            }
            variant="ghost"
            size="sm"
            onPress={handleCopy}
          />
          {/* Expand Button (only if decodedData exists) */}
          {decodedData && (
            <IconButton
              icon={
                isExpanded ? (
                  <ChevronDown size={14} color="#93c5fd" strokeWidth={2} />
                ) : (
                  <ChevronRight size={14} color="#9ca3af" strokeWidth={2} />
                )
              }
              variant="ghost"
              size="sm"
              onPress={handleToggleExpand}
            />
          )}
        </View>
      </View>

      {/* Credential Value */}
      <Pressable onPress={handleCopy} className="px-3 py-2.5">
        <Text
          className="text-sm font-mono text-blue-300"
          numberOfLines={isExpanded ? undefined : 1}
          selectable={isExpanded}
        >
          {isExpanded ? credential : formatCredential(credential)}
        </Text>
      </Pressable>

      {/* Expanded Decoded View */}
      {isExpanded && decodedData && (
        <View className="px-3 pb-3">
          <View className="bg-gray-900/50 rounded p-3 mt-1">
            <Text className="text-xs text-gray-400 mb-2 font-medium">
              Decoded Data
            </Text>
            <Text
              className="text-xs font-mono text-gray-300"
              selectable
            >
              {formatDecodedData()}
            </Text>
          </View>
        </View>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          value={credential}
          title={label}
          subtitle="Scan to import credential"
        />
      )}
    </View>
  );
}

interface CompactCredentialProps {
  /** The value to display (truncated) */
  value: string;
  /** Label shown above the value */
  label?: string;
  /** Help tooltip content */
  helpContent?: string;
  /** Whether to show copy button */
  copyable?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Compact credential display for inline use (e.g., pubkeys).
 * Shows truncated value with optional copy button.
 */
export function CompactCredential({
  value,
  label,
  helpContent,
  copyable = true,
  className = '',
}: CompactCredentialProps) {
  const { copied, copy } = useCopyFeedback();

  const truncateValue = (val: string) => {
    if (val.length <= 16) return val;
    return `${val.slice(0, 8)}...${val.slice(-4)}`;
  };

  const handleCopy = useCallback(() => {
    if (copyable) {
      copy(value);
    }
  }, [copy, copyable, value]);

  return (
    <Pressable
      onPress={handleCopy}
      disabled={!copyable}
      className={`flex-row items-center ${className}`}
    >
      <View className="flex-1">
        {label && (
          <View className="flex-row items-center gap-1 mb-0.5">
            <Text className="text-xs text-gray-400">{label}</Text>
            {helpContent && (
              <HelpTooltip title={label} content={helpContent} size={12} />
            )}
          </View>
        )}
        <Text className="text-sm font-mono text-gray-100">
          {truncateValue(value)}
        </Text>
      </View>
      {copyable && (
        <View className="ml-2">
          {copied ? (
            <Check size={14} color="#4ade80" strokeWidth={2} />
          ) : (
            <Copy size={14} color="#9ca3af" strokeWidth={2} />
          )}
        </View>
      )}
    </Pressable>
  );
}
