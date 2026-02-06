import { Button, IconButton } from '@/components/ui';
import { X } from 'lucide-react-native';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Modal as RNModal, Text, View } from 'react-native';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showCloseButton?: boolean;
  preventClickOutside?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  preventClickOutside = false,
  maxWidth = 'md',
}: ModalProps) {
  const handleBackdropPress = () => {
    if (!preventClickOutside) {
      onClose();
    }
  };

  return (
    <RNModal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={preventClickOutside ? undefined : onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Backdrop */}
        <Pressable
          className="flex-1 bg-black/80 items-center justify-center px-4"
          onPress={handleBackdropPress}
        >
          {/* Dialog Container - stop propagation */}
          <Pressable
            className={`
              w-full ${maxWidthMap[maxWidth]}
              bg-gray-900 rounded-lg shadow-xl
              border border-gray-700/50
            `}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
                {title ? (
                  <Text className="text-lg font-semibold text-blue-200">
                    {title}
                  </Text>
                ) : (
                  <View />
                )}
                {showCloseButton && (
                  <IconButton
                    icon={<X size={18} color="#9ca3af" strokeWidth={2} />}
                    variant="ghost"
                    size="sm"
                    onPress={onClose}
                  />
                )}
              </View>
            )}

            {/* Content */}
            <View className="p-4">
              {children}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  body: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  body,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      showCloseButton={false}
      preventClickOutside
    >
      {/* Body */}
      <View className="mb-4">
        {typeof body === 'string' ? (
          <Text className="text-sm text-gray-300">{body}</Text>
        ) : (
          body
        )}
      </View>

      {/* Actions */}
      <View className="flex-row gap-3">
        <Button
          title={cancelLabel}
          variant="ghost"
          onPress={onCancel}
          disabled={loading}
          className="flex-1"
        />
        <Button
          title={confirmLabel}
          variant={confirmVariant}
          onPress={onConfirm}
          loading={loading}
          className="flex-1"
        />
      </View>
    </Modal>
  );
}
