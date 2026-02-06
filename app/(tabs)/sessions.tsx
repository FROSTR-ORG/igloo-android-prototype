import {
  Badge,
  Button,
  Card,
  Switch,
  IconButton,
  HelpTooltip,
  GradientBackground,
} from '@/components/ui';
import { usePeers, useSigner, useCopyFeedback } from '@/hooks';
import type { Peer } from '@/types';
import {
  Radio,
  User,
  Users,
  CheckCircle,
  Info,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  SlidersHorizontal,
  Copy,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PeersTab() {
  const { isRunning } = useSigner();
  const {
    peers,
    selfPubkey,
    lastPingTime,
    onlineCount,
    totalCount,
    pingPeers,
    pingPeer,
    setPeerPolicy,
    loadPeers,
  } = usePeers();

  const [isPinging, setIsPinging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pingingPeers, setPingingPeers] = useState<Set<string>>(new Set());
  const { copied: selfCopied, copy: copySelf } = useCopyFeedback();

  const handlePingAll = useCallback(async () => {
    if (!isRunning) {
      Alert.alert('Signer Not Running', 'Start the signer to ping peers.');
      return;
    }

    setIsPinging(true);
    try {
      await pingPeers(5000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ping Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsPinging(false);
    }
  }, [isRunning, pingPeers]);

  const handlePingSinglePeer = useCallback(async (pubkey: string) => {
    if (!isRunning) {
      Alert.alert('Signer Not Running', 'Start the signer to ping peers.');
      return;
    }

    setPingingPeers((prev) => new Set(prev).add(pubkey));
    try {
      await pingPeer(pubkey, 5000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Ping Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setPingingPeers((prev) => {
        const next = new Set(prev);
        next.delete(pubkey);
        return next;
      });
    }
  }, [isRunning, pingPeer]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPeers();
    } catch {
      // Optionally log or show error
    } finally {
      setRefreshing(false);
    }
  }, [loadPeers]);

  const handleCopySelfPubkey = useCallback(async () => {
    if (selfPubkey) {
      await copySelf(selfPubkey);
    }
  }, [selfPubkey, copySelf]);

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={[]}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Header Stats */}
          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <View>
                <View className="flex-row items-center gap-1">
                  <Text className="text-sm text-gray-400">Peers in Group</Text>
                  <HelpTooltip
                    title="Peer Status"
                    content="Shows all peers in your signing group. Online peers can participate in threshold signing. Use Ping All to check which peers are currently available."
                    size={14}
                  />
                </View>
                <View className="flex-row items-center mt-1">
                  <Text className="text-2xl font-bold text-gray-100">
                    {totalCount}
                  </Text>
                  {isRunning && (
                    <>
                      <Badge
                        label={`${onlineCount} online`}
                        variant={onlineCount > 0 ? 'success' : 'default'}
                        size="sm"
                        dot
                        className="ml-2"
                      />
                      {getAveragePing(peers) !== null && (
                        <View className="flex-row items-center ml-2">
                          <Radio size={12} color="#9ca3af" strokeWidth={2} />
                          <Text className="text-sm text-gray-400 ml-1">
                            {getAveragePing(peers)}ms avg
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <IconButton
                  icon={<RefreshCw size={16} color="#9ca3af" strokeWidth={2} />}
                  variant="ghost"
                  size="md"
                  onPress={handleRefresh}
                />
                <Button
                  title={isPinging ? 'Pinging...' : 'Ping All'}
                  variant="secondary"
                  size="sm"
                  loading={isPinging}
                  disabled={!isRunning}
                  icon={<Radio size={14} color="#9ca3af" strokeWidth={2} />}
                  onPress={handlePingAll}
                />
              </View>
            </View>
            {lastPingTime && (
              <Text className="text-xs text-gray-400 mt-2">
                Last ping: {lastPingTime.toLocaleTimeString()}
              </Text>
            )}
          </Card>

          {/* Self Info */}
          {selfPubkey && (
            <Card className="mb-4 bg-blue-900/20">
              <Pressable
                onPress={handleCopySelfPubkey}
                className="flex-row items-center"
              >
                <View className="w-10 h-10 bg-blue-800 rounded-full items-center justify-center mr-3">
                  <User size={18} color="#60a5fa" strokeWidth={2} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-blue-400 mb-0.5">
                    Your Share
                  </Text>
                  <Text className="text-sm font-mono text-blue-200">
                    {truncatePubkey(selfPubkey)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {selfCopied ? (
                    <Check size={14} color="#4ade80" strokeWidth={2} />
                  ) : (
                    <Copy size={14} color="#60a5fa" strokeWidth={2} />
                  )}
                  <CheckCircle size={20} color="#60a5fa" strokeWidth={2} />
                </View>
              </Pressable>
            </Card>
          )}

          {/* Peer List */}
          <View className="mb-2">
            <Text className="text-sm font-medium text-gray-400 mb-2">
              Other Peers
            </Text>
          </View>

          {peers.length === 0 ? (
            <Card>
              <View className="py-8 items-center">
                <Users size={32} color="#9ca3af" strokeWidth={1.5} />
                <Text className="text-gray-400 mt-2">
                  No peers found
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Add credentials to see your signing group
                </Text>
              </View>
            </Card>
          ) : (
            <View className="space-y-3">
              {peers.map((peer) => (
                <PeerCard
                  key={peer.pubkey}
                  peer={peer}
                  isSignerRunning={isRunning}
                  isPinging={pingingPeers.has(peer.pubkey)}
                  onPing={() => handlePingSinglePeer(peer.pubkey)}
                  onUpdatePolicy={(policy) => setPeerPolicy(peer.pubkey, policy)}
                />
              ))}
            </View>
          )}

          {/* Info Card */}
          {!isRunning && peers.length > 0 && (
            <Card className="mt-4 bg-yellow-900/20">
              <View className="flex-row items-start">
                <Info size={16} color="#eab308" strokeWidth={2} />
                <Text className="flex-1 ml-2 text-sm text-yellow-400">
                  Start the signer to ping peers and update their status in real-time.
                </Text>
              </View>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function PeerCard({
  peer,
  isSignerRunning,
  isPinging,
  onPing,
  onUpdatePolicy,
}: {
  peer: Peer;
  isSignerRunning: boolean;
  isPinging: boolean;
  onPing: () => void;
  onUpdatePolicy: (policy: { allowSend?: boolean; allowReceive?: boolean }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { copied, copy } = useCopyFeedback();

  const handleCopyPubkey = useCallback(async () => {
    await copy(peer.pubkey);
  }, [copy, peer.pubkey]);

  const getStatusBadge = () => {
    if (!isSignerRunning) return null;

    switch (peer.status) {
      case 'online':
        return <Badge label="Online" variant="success" size="sm" dot />;
      case 'offline':
        return <Badge label="Offline" variant="error" size="sm" dot />;
      default:
        return <Badge label="Unknown" variant="default" size="sm" />;
    }
  };

  // Get peer status icon color
  const getStatusColor = () => {
    switch (peer.status) {
      case 'online':
        return '#22c55e'; // green-500
      case 'offline':
        return '#ef4444'; // red-500
      default:
        return '#9ca3af'; // gray-400
    }
  };

  return (
    <Card padding="none">
      {/* Main Row */}
      <View className="flex-row items-center p-4">
        <Pressable
          className="flex-1 flex-row items-center"
          onPress={() => setExpanded(!expanded)}
        >
          {/* Status Avatar */}
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              peer.status === 'online'
                ? 'bg-green-900/30'
                : peer.status === 'offline'
                  ? 'bg-red-900/30'
                  : 'bg-gray-800'
            }`}
          >
            <User size={18} color={getStatusColor()} strokeWidth={2} />
          </View>

          {/* Peer Info */}
          <View className="flex-1">
            {peer.displayName && (
              <Text className="text-sm font-medium text-gray-100 mb-0.5">
                {peer.displayName}
              </Text>
            )}
            <View className="flex-row items-center">
              <Text className={`text-sm font-mono ${peer.displayName ? 'text-gray-400' : 'text-gray-100'}`}>
                {truncatePubkey(peer.pubkey)}
              </Text>
            </View>
            <View className="flex-row items-center mt-1 flex-wrap gap-1">
              {getStatusBadge()}
              {peer.latency !== null && peer.status === 'online' && (
                <View className="flex-row items-center">
                  <Radio size={10} color="#9ca3af" strokeWidth={2} />
                  <Text className="text-xs text-gray-400 ml-1">
                    {peer.latency}ms
                  </Text>
                </View>
              )}
              {peer.lastSeen && (
                <Text className="text-xs text-gray-400">
                  {formatLastSeen(peer.lastSeen)}
                </Text>
              )}
            </View>
          </View>

          {/* Expand indicator with policy icon */}
          <View className="flex-row items-center gap-1 ml-2">
            {expanded && (
              <SlidersHorizontal size={14} color="#60a5fa" strokeWidth={2} />
            )}
            {expanded ? (
              <ChevronUp size={14} color="#9ca3af" strokeWidth={2} />
            ) : (
              <ChevronDown size={14} color="#9ca3af" strokeWidth={2} />
            )}
          </View>
        </Pressable>

        {/* Row action controls (separate press targets from row Pressable) */}
        <View className="flex-row items-center gap-1 ml-2">
          <IconButton
            icon={
              copied ? (
                <Check size={12} color="#4ade80" strokeWidth={2} />
              ) : (
                <Copy size={12} color="#9ca3af" strokeWidth={2} />
              )
            }
            variant="ghost"
            size="sm"
            onPress={handleCopyPubkey}
          />
          {isSignerRunning && (
            <IconButton
              icon={<Radio size={14} color="#9ca3af" strokeWidth={2} />}
              variant="ghost"
              size="sm"
              onPress={onPing}
              loading={isPinging}
            />
          )}
        </View>
      </View>

      {/* Expanded Section - Policies */}
      {expanded && (
        <View className="px-4 pb-4 pt-2 border-t border-gray-700/30">
          <View className="flex-row items-center gap-1 mb-3">
            <SlidersHorizontal size={12} color="#9ca3af" strokeWidth={2} />
            <Text className="text-xs font-medium text-gray-400">
              Policy Settings
            </Text>
            <HelpTooltip
              title="Policy Settings"
              content="Control which signing requests this peer can send to you and receive from you. Policies persist across sessions."
              size={12}
            />
          </View>
          <View className="space-y-3">
            <Switch
              label="Allow Send"
              description="Allow sending signing requests to this peer"
              value={peer.allowSend}
              onValueChange={(value) => onUpdatePolicy({ allowSend: value })}
            />
            <Switch
              label="Allow Receive"
              description="Accept signing requests from this peer"
              value={peer.allowReceive}
              onValueChange={(value) => onUpdatePolicy({ allowReceive: value })}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

function formatLastSeen(lastSeen: string): string {
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function getAveragePing(peers: Peer[]): number | null {
  const onlinePeers = peers.filter(p => p.status === 'online' && p.latency !== null);
  if (onlinePeers.length === 0) return null;
  const totalLatency = onlinePeers.reduce((sum, p) => sum + (p.latency || 0), 0);
  return Math.round(totalLatency / onlinePeers.length);
}
