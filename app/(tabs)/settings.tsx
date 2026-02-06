import { Button, Card, GradientBackground, HelpTooltip, RelayInput, SoundscapeSelector, VolumeControl } from '@/components/ui';
import { useCredentials, useSigner, useCopyFeedback } from '@/hooks';
import { audioService } from '@/services/audio';
import { useAudioStore, useLogStore, usePeerStore, useRelayStore, useSignerStore } from '@/stores';
import type { SoundscapeId } from '@/types';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Music,
  Volume2,
} from 'lucide-react-native';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import pkg from '../../package.json';

const IGLOO_CORE_VERSION = pkg.dependencies['@frostr/igloo-core']?.replace(/^[\^~]/, '') ?? 'unknown';

export default function SettingsTab() {
  const { stop, isRunning } = useSigner();
  const { shareDetails, deleteCredentials } = useCredentials();
  const relays = useRelayStore((s) => s.relays);
  const setRelays = useRelayStore((s) => s.setRelays);
  const { copied: groupCopied, copy: copyGroup } = useCopyFeedback();

  // Audio preferences (persisted)
  const volume = useAudioStore((s) => s.volume);
  const soundscapeId = useAudioStore((s) => s.soundscapeId);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setSoundscape = useAudioStore((s) => s.setSoundscape);

  const handleRelaysChange = useCallback((newRelays: string[]) => {
    setRelays(newRelays);
  }, [setRelays]);

  const handleVolumeChange = useCallback(async (value: number) => {
    const previousVolume = volume;
    try {
      await audioService.setVolume(value);
      setVolume(value);
    } catch (error) {
      // Revert to previous volume on failure
      setVolume(previousVolume);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to set volume'
      );
    }
  }, [volume, setVolume]);

  const handleSoundscapeChange = useCallback(async (id: SoundscapeId) => {
    const previousSoundscapeId = soundscapeId;
    try {
      // If signer is running, update the active audio player
      if (isRunning) {
        await audioService.setSoundscape(id);
      }
      // Always save the preference
      setSoundscape(id);
    } catch (error) {
      // Revert to previous soundscape on failure
      setSoundscape(previousSoundscapeId);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to change soundscape'
      );
    }
  }, [soundscapeId, setSoundscape, isRunning]);

  const handleClearCredentials = useCallback(async () => {
    Alert.alert(
      'Clear Credentials',
      'This will delete your stored credentials and return you to onboarding. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await stop();
              await deleteCredentials();

              // Clear all session-specific data
              useLogStore.getState().clearLogs();
              usePeerStore.getState().clearPeers();
              useSignerStore.getState().resetSession();
              useRelayStore.getState().resetToDefaults();

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/onboarding');
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to clear credentials'
              );
            }
          },
        },
      ]
    );
  }, [stop, deleteCredentials]);

  const handleCopyGroupPubkey = useCallback(async () => {
    if (shareDetails?.groupPubkey) {
      await copyGroup(shareDetails.groupPubkey);
    }
  }, [shareDetails, copyGroup]);

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={[]}>
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {/* Relay Configuration */}
          <View className="mb-6">
            <View className="flex-row items-center gap-1 mb-3">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Relay Configuration
              </Text>
              <HelpTooltip
                title="Relays"
                content="Relays are servers that help coordinate signing operations between peers. Configure one or more WebSocket relays (wss://) for optimal connectivity."
                size={14}
              />
            </View>

            <Card>
              <RelayInput
                relays={relays}
                onChange={handleRelaysChange}
                showResetButton
              />
            </Card>
          </View>

          {/* Soundscape Selection */}
          <View className="mb-6">
            <View className="flex-row items-center gap-1 mb-3">
              <Music size={14} color="#9ca3af" strokeWidth={2} />
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Soundscape
              </Text>
              <HelpTooltip
                title="Soundscape Selection"
                content="Choose the ambient sound that plays while your signer is active. The soundscape keeps your signer responsive in the background."
                size={14}
              />
            </View>

            <Card>
              <SoundscapeSelector
                value={soundscapeId}
                onValueChange={handleSoundscapeChange}
              />
              {!isRunning && (
                <Text className="text-xs text-gray-500 mt-2">
                  Start signer to play soundscape
                </Text>
              )}
            </Card>
          </View>

          {/* Soundscape Volume */}
          <View className="mb-6">
            <View className="flex-row items-center gap-1 mb-3">
              <Volume2 size={14} color="#9ca3af" strokeWidth={2} />
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Soundscape Volume
              </Text>
              <HelpTooltip
                title="Background Audio"
                content="The soundscape keeps your signer active when the app is in the background. It plays even in silent mode. Adjust volume to your preference - set to Off to mute."
                size={14}
              />
            </View>

            <Card>
              <VolumeControl
                value={volume}
                onValueChange={handleVolumeChange}
                disabled={!isRunning}
              />
              {!isRunning && (
                <Text className="text-xs text-gray-500 mt-2">
                  Start the signer to adjust volume
                </Text>
              )}
            </Card>
          </View>

          {/* Credential Info */}
          {shareDetails && (
            <View className="mb-6">
              <View className="flex-row items-center gap-1 mb-3">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Credential Information
                </Text>
                <HelpTooltip
                  title="Credential Info"
                  content="Information about your signing share including your index in the group and the threshold required for signing."
                  size={14}
                />
              </View>

              <Card>
                <InfoRow label="Share Index" value={`#${shareDetails.idx}`} />
                <InfoRow
                  label="Threshold"
                  value={`${shareDetails.threshold}-of-${shareDetails.totalMembers}`}
                  isLast={!shareDetails.groupPubkey}
                />
                {shareDetails.groupPubkey && (
                  <Pressable onPress={handleCopyGroupPubkey}>
                    <InfoRow
                      label="Group Pubkey"
                      value={truncatePubkey(shareDetails.groupPubkey)}
                      copyable
                      copied={groupCopied}
                      isLast
                    />
                  </Pressable>
                )}
              </Card>
            </View>
          )}

          {/* App Info */}
          <View className="mb-6">
            <View className="flex-row items-center gap-1 mb-3">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                About
              </Text>
              <HelpTooltip
                title="About"
                content="Version information for the app and the underlying igloo-core library."
                size={14}
              />
            </View>

            <Card>
              <InfoRow label="App Version" value={pkg.version} />
              <InfoRow label="igloo-core" value={IGLOO_CORE_VERSION} isLast />
            </Card>
          </View>

          {/* Danger Zone */}
          <View>
            <View className="flex-row items-center gap-1 mb-3">
              <AlertTriangle size={14} color="#f87171" strokeWidth={2} />
              <Text className="text-sm font-semibold text-red-400 uppercase tracking-wide">
                Danger Zone
              </Text>
            </View>

            <Card className="border-red-900/30">
              <View className="flex-row items-start mb-4">
                <Info size={16} color="#9ca3af" strokeWidth={2} />
                <Text className="flex-1 ml-2 text-sm text-gray-400">
                  Clearing your credentials will remove all stored data and return you to the
                  onboarding screen. Make sure you have a backup of your credentials.
                </Text>
              </View>
              <Button
                title="Clear All Credentials"
                variant="danger"
                onPress={handleClearCredentials}
              />
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function InfoRow({
  label,
  value,
  copyable = false,
  copied = false,
  isLast = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  copied?: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-2 ${
        isLast ? '' : 'border-b border-gray-700/30'
      }`}
    >
      <Text className="text-sm text-gray-400">{label}</Text>
      <View className="flex-row items-center">
        <Text className="text-sm font-medium text-gray-100">{value}</Text>
        {copyable && (
          <View className="ml-1.5">
            {copied ? (
              <Check size={12} color="#4ade80" strokeWidth={2} />
            ) : (
              <Copy size={12} color="#9ca3af" strokeWidth={2} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}
