import { View, Text, Modal, Pressable, Dimensions } from 'react-native';
import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface TooltipProps {
  content: string | React.ReactNode;
  title?: string;
  children?: React.ReactNode;
  iconSize?: number;
  iconColor?: string;
}

/**
 * Tooltip component that shows help content in a modal popup.
 * User requested modal style (tap to show, tap outside to dismiss).
 *
 * Usage:
 * <Tooltip content="This is helpful information" title="Help">
 *   <Text>Custom trigger element</Text>
 * </Tooltip>
 *
 * Or with default HelpCircle icon:
 * <Tooltip content="This is helpful information" />
 */
export function Tooltip({
  content,
  title,
  children,
  iconSize = 16,
  iconColor = '#60a5fa', // blue-400
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsVisible(true);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <>
      {/* Trigger */}
      <Pressable
        onPress={handleOpen}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={title ? `Help: ${title}` : 'Show help'}
      >
        {children || (
          <HelpCircle
            size={iconSize}
            color={iconColor}
            strokeWidth={2}
          />
        )}
      </Pressable>

      {/* Modal Popup */}
      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/60"
          onPress={handleClose}
        >
          <Pressable
            className="mx-6 max-w-sm bg-gray-900 rounded-xl border border-gray-700/50 shadow-xl"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {title && (
              <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-gray-800">
                <View className="flex-row items-center gap-2">
                  <HelpCircle size={18} color="#60a5fa" strokeWidth={2} />
                  <Text className="text-blue-300 font-semibold text-base">
                    {title}
                  </Text>
                </View>
                <Pressable
                  onPress={handleClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  className="p-1 rounded-full active:bg-gray-800"
                >
                  <X size={18} color="#9ca3af" strokeWidth={2} />
                </Pressable>
              </View>
            )}

            {/* Content */}
            <View className={`px-4 py-4 ${!title ? 'pt-4' : ''}`}>
              {typeof content === 'string' ? (
                <Text className="text-gray-300 text-sm leading-relaxed">
                  {content}
                </Text>
              ) : (
                content
              )}
            </View>

            {/* Close button (if no title header) */}
            {!title && (
              <View className="px-4 pb-4">
                <Pressable
                  onPress={handleClose}
                  className="bg-gray-800 rounded-lg py-2 px-4 active:bg-gray-700"
                >
                  <Text className="text-gray-300 text-center font-medium">
                    Got it
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * HelpTooltip - convenience wrapper with HelpCircle icon
 * Commonly used pattern throughout the app for contextual help
 */
interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  size?: number;
  color?: string;
  className?: string;
}

export function HelpTooltip({
  content,
  title,
  size = 16,
  color = '#60a5fa',
  className,
}: HelpTooltipProps) {
  return (
    <View className={className}>
      <Tooltip
        content={content}
        title={title}
        iconSize={size}
        iconColor={color}
      />
    </View>
  );
}
