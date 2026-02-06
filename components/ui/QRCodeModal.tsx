import { useCallback } from 'react';
import { View, Text, Modal, Pressable, useWindowDimensions } from 'react-native';
import { X, Copy, Check } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from './Button';
import { useCopyFeedback } from '@/hooks';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  title?: string;
  subtitle?: string;
}

/**
 * Modal that displays a QR code for sharing credentials.
 * Includes copy and share functionality.
 */
export function QRCodeModal({
  isOpen,
  onClose,
  value,
  title = 'QR Code',
  subtitle,
}: QRCodeModalProps) {
  const { width } = useWindowDimensions();
  const { copied, copy } = useCopyFeedback();

  // QR code size - responsive to screen width
  const qrSize = Math.min(width - 80, 280);

  const handleCopy = useCallback(async () => {
    await copy(value);
  }, [copy, value]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/80 justify-center items-center"
        onPress={onClose}
      >
        <Pressable
          className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full border border-gray-700/50"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-100">
                {title}
              </Text>
              {subtitle && (
                <Text className="text-sm text-gray-400 mt-0.5">
                  {subtitle}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              className="p-2 -m-2 rounded-full active:bg-gray-800"
              hitSlop={8}
            >
              <X size={20} color="#9ca3af" strokeWidth={2} />
            </Pressable>
          </View>

          {/* QR Code */}
          <View className="bg-white rounded-xl p-4 items-center justify-center mb-4">
            <QRCode
              value={value}
              size={qrSize}
              backgroundColor="white"
              color="#1f2937"
            />
          </View>

          {/* Truncated Value Preview */}
          <View className="bg-gray-800 rounded-lg p-3 mb-4">
            <Text className="text-xs font-mono text-gray-400 text-center" numberOfLines={2}>
              {value.length > 63 ? `${value.slice(0, 30)}...${value.slice(-30)}` : value}
            </Text>
          </View>

          {/* Actions */}
          <View className="flex-row gap-3">
            <Button
              title={copied ? 'Copied!' : 'Copy'}
              variant="secondary"
              size="md"
              icon={
                copied
                  ? <Check size={16} color="#4ade80" strokeWidth={2} />
                  : <Copy size={16} color="#9ca3af" strokeWidth={2} />
              }
              onPress={handleCopy}
              className="flex-1"
            />
            <Button
              title="Close"
              variant="ghost"
              size="md"
              onPress={onClose}
              className="flex-1"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
