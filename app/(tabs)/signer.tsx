import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Alert, Animated, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Key,
  Copy,
  Check,
  BarChart3,
  History,
  Inbox,
  CheckCircle,
  Loader2,
  AlertCircle,
  Power,
  Server,
  FileKey,
  User,
  VolumeX,
  Volume2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  Button,
  Card,
  Badge,
  HelpTooltip,
  Collapsible,
  CredentialDisplay,
  CompactCredential,
  GradientBackground,
} from '@/components/ui';
import { useSigner, useIgloo, useCopyFeedback } from '@/hooks';
import { useAudioStore } from '@/stores';
import { audioService } from '@/services/audio';
import { secureStorage } from '@/services/storage/secureStorage';
import type { SignerStatus, Credentials } from '@/types';

export default function SignerTab() {
  const {
    status,
    audioStatus,
    connectedRelays,
    lastError,
    signingRequestsReceived,
    signingRequestsCompleted,
    recentRequests,
    shareDetails,
    isRunning,
    isConnecting,
    start,
    stop,
    getUptime,
  } = useSigner();

  const { decodeGroupCredential, decodeShareCredential } = useIgloo();
  const { copied: pubkeyCopied, copy: copyPubkey } = useCopyFeedback();

  // Audio state for quick mute
  const volume = useAudioStore((s) => s.volume);
  const setVolume = useAudioStore((s) => s.setVolume);
  const previousVolume = useRef(volume > 0 ? volume : 0.3);

  const [uptime, setUptime] = useState(0);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [decodedGroup, setDecodedGroup] = useState<object | null>(null);
  const [decodedShare, setDecodedShare] = useState<object | null>(null);

  // Load credentials on mount
  useEffect(() => {
    let mounted = true;

    async function loadCredentials() {
      try {
        const creds = await secureStorage.getCredentials();
        if (!mounted || !creds) return;

        setCredentials(creds);
        setDecodedGroup(decodeGroupCredential(creds.group));
        setDecodedShare(decodeShareCredential(creds.share));
      } catch (error) {
        console.error('Failed to load credentials:', error);
      }
    }
    loadCredentials();

    return () => {
      mounted = false;
    };
  }, [decodeGroupCredential, decodeShareCredential]);

  // Update uptime every second when running
  useEffect(() => {
    if (!isRunning) {
      setUptime(0);
      return;
    }

    const interval = setInterval(() => {
      setUptime(getUptime());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, getUptime]);

  const handleToggle = useCallback(async () => {
    try {
      if (isRunning) {
        await stop();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to toggle signer'
      );
    }
  }, [isRunning, start, stop]);

  const handleCopyPubkey = useCallback(async () => {
    if (shareDetails?.groupPubkey) {
      await copyPubkey(shareDetails.groupPubkey);
    }
  }, [shareDetails?.groupPubkey, copyPubkey]);

  const handleMuteToggle = useCallback(async () => {
    await Haptics.selectionAsync();
    const previousVol = volume;
    const newVolume = volume === 0
      ? (previousVolume.current > 0 ? previousVolume.current : 0.3)
      : 0;

    try {
      // Native call first, then update store on success
      await audioService.setVolume(newVolume);

      // Only update store and refs after native call succeeds
      if (volume !== 0) {
        previousVolume.current = volume;
      }
      setVolume(newVolume);
    } catch (error) {
      // Revert to previous volume on failure
      setVolume(previousVol);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to change volume'
      );
    }
  }, [volume, setVolume]);

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={[]}>
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {/* Status Card */}
          <Card variant="elevated" className="mb-4">
            <View className="items-center py-4">
              <SignerStatusIndicator status={status} />
              <View className="flex-row items-center gap-2 mt-4">
                <Text className="text-2xl font-bold text-gray-100">
                  {getStatusText(status)}
                </Text>
                {isRunning && (
                  <HelpTooltip
                    title="Background Soundscape"
                    content="Tap the soundscape badge below to mute/unmute. The soundscape keeps your signer responsive in the background. Adjust volume in Settings."
                    size={18}
                  />
                )}
              </View>
              {lastError && (
                <Text className="text-sm text-red-400 mt-2 text-center">
                  {lastError}
                </Text>
              )}
              {/* Audio Status Warning */}
              {isRunning && audioStatus !== 'playing' && audioStatus !== 'idle' && (
                <View className="flex-row items-center gap-1 mt-2 px-3 py-1.5 bg-yellow-500/20 rounded-full">
                  <VolumeX size={14} color="#eab308" />
                  <Text className="text-xs text-yellow-400">
                    {audioStatus === 'error'
                      ? 'Audio failed - foreground only'
                      : 'Audio interrupted'}
                  </Text>
                </View>
              )}
              {/* Soundscape Mute Toggle */}
              {isRunning && audioStatus === 'playing' && (
                <Pressable
                  onPress={handleMuteToggle}
                  className={`flex-row items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full active:opacity-70 ${
                    volume === 0 ? 'bg-red-500/20' : 'bg-blue-500/20'
                  }`}
                >
                  {volume === 0 ? (
                    <>
                      <VolumeX size={14} color="#ef4444" />
                      <Text className="text-xs text-red-400">Muted</Text>
                    </>
                  ) : (
                    <>
                      <Volume2 size={14} color="#60a5fa" />
                      <Text className="text-xs text-blue-400">Soundscape</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {/* Toggle Button */}
            <Button
              title={isRunning ? 'Stop Signer' : isConnecting ? 'Connecting...' : 'Start Signer'}
              variant={isRunning ? 'danger' : 'primary'}
              size="lg"
              loading={isConnecting}
              onPress={handleToggle}
              className="mt-4"
            />
          </Card>

          {/* Share Info Card */}
          {shareDetails && (
            <Card className="mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Key size={16} color="#9ca3af" strokeWidth={2} />
                  <Text className="text-sm font-medium text-gray-400 ml-2">
                    Share Information
                  </Text>
                </View>
                <HelpTooltip
                  title="Share Info"
                  content="Your share index and threshold information for this signing group. The threshold shows how many shares are needed to sign (e.g., 2-of-3 means 2 shares needed from 3 total)."
                />
              </View>
              <View className="flex-row justify-between mb-3">
                <InfoItem label="Share Index" value={`#${shareDetails.idx}`} />
                <InfoItem
                  label="Threshold"
                  value={`${shareDetails.threshold}-of-${shareDetails.totalMembers}`}
                />
              </View>
              {shareDetails.groupPubkey && (
                <Pressable
                  onPress={handleCopyPubkey}
                  className="flex-row items-center justify-between pt-3 border-t border-gray-700/30"
                >
                  <View className="flex-row items-center flex-1">
                    <User size={14} color="#9ca3af" strokeWidth={2} />
                    <View className="ml-2 flex-1">
                      <Text className="text-xs text-gray-400 mb-1">Group Pubkey</Text>
                      <Text className="text-sm font-mono text-gray-100">
                        {truncatePubkey(shareDetails.groupPubkey)}
                      </Text>
                    </View>
                  </View>
                  {pubkeyCopied ? (
                    <Check size={14} color="#4ade80" strokeWidth={2} />
                  ) : (
                    <Copy size={14} color="#9ca3af" strokeWidth={2} />
                  )}
                </Pressable>
              )}
            </Card>
          )}

          {/* Credentials Section */}
          {credentials && (
            <Collapsible
              title="Credentials"
              icon={<FileKey size={16} color="#9ca3af" strokeWidth={2} />}
              className="mb-4"
              actions={
                <HelpTooltip
                  title="Credentials"
                  content="Your group and share credentials. The group credential identifies your signing group and contains public information about all participants. The share credential is your secret share - keep it secure!"
                  size={14}
                />
              }
            >
              <View className="space-y-3 mt-2">
                {/* Group Credential */}
                <CredentialDisplay
                  label="Group Credential"
                  credential={credentials.group}
                  decodedData={decodedGroup || undefined}
                  helpContent="The group credential (bfgroup) contains the group public key, threshold configuration, and commitments from all signers."
                />

                {/* Share Credential */}
                <CredentialDisplay
                  label="Share Credential"
                  credential={credentials.share}
                  decodedData={decodedShare || undefined}
                  masked
                  helpContent="Your share credential (bfshare) contains your secret signing share. Keep this secure and never share it with others."
                />
              </View>
            </Collapsible>
          )}

          {/* Relay Status Section */}
          <Card className="mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Server size={16} color="#9ca3af" strokeWidth={2} />
                <Text className="text-sm font-medium text-gray-400">
                  Relay Status
                </Text>
                <HelpTooltip
                  title="Relay Status"
                  content="Nostr relays your signer is connected to. These relays facilitate communication with other signers in your group."
                  size={14}
                />
              </View>
              <Badge
                label={isRunning ? `${connectedRelays.length} connected` : 'Offline'}
                variant={isRunning && connectedRelays.length > 0 ? 'success' : 'default'}
                size="sm"
                dot
              />
            </View>
            {isRunning && connectedRelays.length > 0 ? (
              <View className="space-y-2">
                {connectedRelays.map((relay, index) => (
                  <View
                    key={relay}
                    className={`flex-row items-center py-2 ${
                      index < connectedRelays.length - 1 ? 'border-b border-gray-800/50' : ''
                    }`}
                  >
                    <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                    <Text className="text-sm font-mono text-gray-300 flex-1" numberOfLines={1}>
                      {relay}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-gray-500">
                {isRunning ? 'Connecting to relays...' : 'Start signer to connect to relays'}
              </Text>
            )}
          </Card>

          {/* Stats Card */}
          <Card className="mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <BarChart3 size={16} color="#9ca3af" strokeWidth={2} />
              <Text className="text-sm font-medium text-gray-400">
                Session Statistics
              </Text>
              <HelpTooltip
                title="Session Statistics"
                content="Statistics for your current signing session including uptime, requests processed, and relay connections."
                size={14}
              />
            </View>
            <View className="flex-row justify-between">
              <InfoItem
                label="Uptime"
                value={isRunning ? formatUptime(uptime) : '-'}
              />
              <InfoItem
                label="Requests"
                value={`${signingRequestsCompleted}/${signingRequestsReceived}`}
              />
              <InfoItem
                label="Relays"
                value={isRunning ? String(connectedRelays.length) : '-'}
              />
            </View>
          </Card>

          {/* Recent Activity */}
          <Card>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <History size={16} color="#9ca3af" strokeWidth={2} />
                <Text className="text-sm font-medium text-gray-400">
                  Recent Activity
                </Text>
                <HelpTooltip
                  title="Recent Activity"
                  content="Recent signing requests received by your signer. Shows the requester's pubkey, timestamp, and completion status."
                  size={14}
                />
              </View>
              {recentRequests.length > 0 && (
                <Badge label={String(recentRequests.length)} size="sm" variant="info" />
              )}
            </View>

            {recentRequests.length === 0 ? (
              <View className="py-8 items-center">
                <Inbox size={32} color="#9ca3af" strokeWidth={1.5} />
                <Text className="text-gray-400 mt-2">
                  {isRunning ? 'Waiting for requests...' : 'Start signer to receive requests'}
                </Text>
              </View>
            ) : (
              <View className="space-y-2">
                {recentRequests.slice(0, 5).map((request, index, arr) => (
                  <View
                    key={request.id}
                    className={`flex-row items-center justify-between py-2 ${
                      index === arr.length - 1
                        ? ''
                        : 'border-b border-gray-700/30'
                    }`}
                  >
                    <View className="flex-1">
                      <Text className="text-sm text-gray-100">
                        {truncatePubkey(request.pubkey)}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {formatTime(request.timestamp)}
                      </Text>
                    </View>
                    <Badge
                      label={request.status}
                      variant={
                        request.status === 'completed'
                          ? 'success'
                          : request.status === 'failed'
                            ? 'error'
                            : 'warning'
                      }
                      size="sm"
                    />
                  </View>
                ))}
              </View>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function SignerStatusIndicator({ status }: { status: SignerStatus }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const spinAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Always stop and reset all animations before starting new ones
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    if (spinAnimationRef.current) {
      spinAnimationRef.current.stop();
      spinAnimationRef.current = null;
    }
    pulseAnim.setValue(1);
    spinAnim.setValue(0);

    if (status === 'running') {
      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ])
      );
      animationRef.current.start();
    } else if (status === 'connecting') {
      spinAnimationRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spinAnimationRef.current.start();
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      if (spinAnimationRef.current) {
        spinAnimationRef.current.stop();
        spinAnimationRef.current = null;
      }
    };
  }, [status, pulseAnim, spinAnim]);

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const renderStatusIcon = () => {
    const iconProps = { size: 36, color: 'white', strokeWidth: 2 };

    switch (status) {
      case 'running':
        return <CheckCircle {...iconProps} />;
      case 'connecting':
        return (
          <Animated.View
            style={{
              transform: [
                {
                  rotate: spinAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            }}
          >
            <Loader2 {...iconProps} />
          </Animated.View>
        );
      case 'error':
        return <AlertCircle {...iconProps} />;
      default:
        return <Power {...iconProps} />;
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View className={`w-20 h-20 rounded-full items-center justify-center ${getStatusColor()}`}>
        {renderStatusIcon()}
      </View>
    </Animated.View>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text className="text-xs text-gray-400 mb-1">{label}</Text>
      <Text className="text-lg font-semibold text-gray-100">{value}</Text>
    </View>
  );
}

function getStatusText(status: SignerStatus): string {
  switch (status) {
    case 'running':
      return 'Signer Active';
    case 'connecting':
      return 'Connecting...';
    case 'error':
      return 'Error';
    default:
      return 'Signer Stopped';
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
