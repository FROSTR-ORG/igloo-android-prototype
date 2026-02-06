import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePeerStore, useCredentialStore, useSignerStore } from '@/stores';
import { secureStorage } from '@/services/storage/secureStorage';
import { useIgloo } from './useIgloo';
import type { Peer, PeerPolicy } from '@/types';

const AUTO_PING_INTERVAL_MS = 15000;
const AUTO_PING_TIMEOUT_MS = 5000;
const AUTO_PING_MIN_GAP_MS = 3000;

/**
 * Hook for peer management and monitoring.
 */
export function usePeers() {
  const {
    getPeers,
    getSelfPubkey,
    pingAllPeers,
    pingSinglePeer,
    updatePolicies,
    isRunning: isServiceRunning,
  } = useIgloo();

  // Peer state
  const peersRecord = usePeerStore((s) => s.peers);
  const selfPubkey = usePeerStore((s) => s.selfPubkey);
  const lastPingTime = usePeerStore((s) => s.lastPingTime);
  const setPeers = usePeerStore((s) => s.setPeers);
  const setSelfPubkey = usePeerStore((s) => s.setSelfPubkey);
  const setLastPingTime = usePeerStore((s) => s.setLastPingTime);
  const updatePeerPolicy = usePeerStore((s) => s.updatePeerPolicy);
  const clearPeers = usePeerStore((s) => s.clearPeers);

  // Credential state
  const hasCredentials = useCredentialStore((s) => s.hasCredentials);
  const signerStatus = useSignerStore((s) => s.status);

  const autoPingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPingInFlightRef = useRef(false);
  const lastAutoPingAtRef = useRef(0);
  const appStateRef = useRef<AppStateStatus | null>(AppState.currentState);

  /**
   * Convert peers record to array.
   */
  const peers = Object.values(peersRecord);

  /**
   * Get online peers count.
   */
  const onlineCount = peers.filter((p) => p.status === 'online').length;

  /**
   * Load peers from credentials.
   */
  const loadPeers = useCallback(async () => {
    const credentials = await secureStorage.getCredentials();
    if (!credentials) {
      console.warn('[usePeers] No credentials found in secure storage');
      return;
    }

    try {
      const peerPubkeys = getPeers(credentials.group, credentials.share);
      const self = getSelfPubkey(credentials.group, credentials.share);

      if (self) {
        setSelfPubkey(self);
      } else {
        console.warn('[usePeers] Could not extract self pubkey from credentials');
      }

      if (peerPubkeys.length === 0) {
        console.warn('[usePeers] No peers extracted from credentials - this may indicate invalid credentials');
      } else {
        console.log(`[usePeers] Extracted ${peerPubkeys.length} peers`);
      }

      // Create peer objects with default values
      const peerObjects: Peer[] = peerPubkeys.map((pubkey) => ({
        pubkey,
        status: 'unknown',
        lastSeen: null,
        latency: null,
        allowSend: true,
        allowReceive: true,
      }));

      setPeers(peerObjects);
    } catch (error) {
      console.error('[usePeers] Failed to load peers:', error);
      // Still clear peers to avoid stale data
      setPeers([]);
    }
  }, [getPeers, getSelfPubkey, setSelfPubkey, setPeers]);

  /**
   * Ping all peers and update their status.
   */
  const pingPeers = useCallback(
    async (timeout?: number) => {
      if (!isServiceRunning()) {
        throw new Error('Signer must be running to ping peers');
      }

      const results = await pingAllPeers(timeout);
      setLastPingTime(new Date());

      return results;
    },
    [isServiceRunning, pingAllPeers, setLastPingTime]
  );

  /**
   * Ping a single peer and update their status.
   */
  const pingPeer = useCallback(
    async (pubkey: string, timeout?: number) => {
      if (!isServiceRunning()) {
        throw new Error('Signer must be running to ping peer');
      }

      const result = await pingSinglePeer(pubkey, timeout);
      setLastPingTime(new Date());

      return result;
    },
    [isServiceRunning, pingSinglePeer, setLastPingTime]
  );

  /**
   * Update policy for a specific peer.
   */
  const setPeerPolicy = useCallback(
    async (pubkey: string, policy: { allowSend?: boolean; allowReceive?: boolean }) => {
      // Update local state
      updatePeerPolicy(pubkey, policy);

      // If signer is running, also update on the node
      if (isServiceRunning()) {
        const peer = peersRecord[pubkey];
        if (peer) {
          const updatedPolicy: PeerPolicy = {
            pubkey,
            allowSend: policy.allowSend ?? peer.allowSend,
            allowReceive: policy.allowReceive ?? peer.allowReceive,
          };
          await updatePolicies([updatedPolicy]);
        }
      }
    },
    [updatePeerPolicy, peersRecord, isServiceRunning, updatePolicies]
  );

  /**
   * Sync all local policies to the node.
   */
  const syncPoliciesToNode = useCallback(async () => {
    if (!isServiceRunning()) return;

    const policies: PeerPolicy[] = peers.map((peer) => ({
      pubkey: peer.pubkey,
      allowSend: peer.allowSend,
      allowReceive: peer.allowReceive,
    }));

    await updatePolicies(policies);
  }, [isServiceRunning, peers, updatePolicies]);

  // Load peers when credentials become available
  useEffect(() => {
    if (hasCredentials) {
      loadPeers();
    }
  }, [hasCredentials, loadPeers]);

  const runAutoPing = useCallback(
    async (reason: string) => {
      if (!hasCredentials || !isServiceRunning()) return;
      if (autoPingInFlightRef.current) return;
      const now = Date.now();
      if (now - lastAutoPingAtRef.current < AUTO_PING_MIN_GAP_MS) return;

      autoPingInFlightRef.current = true;
      lastAutoPingAtRef.current = now;

      try {
        await pingAllPeers(AUTO_PING_TIMEOUT_MS);
        setLastPingTime(new Date());
      } catch (error) {
        console.debug(`[usePeers] Auto ping (${reason}) failed`, error);
      } finally {
        autoPingInFlightRef.current = false;
      }
    },
    [hasCredentials, isServiceRunning, pingAllPeers, setLastPingTime]
  );

  const stopAutoPing = useCallback(() => {
    if (autoPingTimerRef.current) {
      clearInterval(autoPingTimerRef.current);
      autoPingTimerRef.current = null;
    }
  }, []);

  const startAutoPing = useCallback(() => {
    if (autoPingTimerRef.current) return;
    autoPingTimerRef.current = setInterval(() => {
      void runAutoPing('interval');
    }, AUTO_PING_INTERVAL_MS);
  }, [runAutoPing]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      if (nextState === 'active' && signerStatus === 'running') {
        void runAutoPing('app-active');
        startAutoPing();
      } else {
        stopAutoPing();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    if (signerStatus === 'running' && appStateRef.current === 'active') {
      void runAutoPing('initial');
      startAutoPing();
    } else {
      stopAutoPing();
    }

    return () => {
      stopAutoPing();
      subscription.remove();
    };
  }, [signerStatus, runAutoPing, startAutoPing, stopAutoPing]);

  return {
    // State
    peers,
    selfPubkey,
    lastPingTime,
    onlineCount,
    totalCount: peers.length,

    // Computed
    hasOnlinePeers: onlineCount > 0,

    // Actions
    loadPeers,
    pingPeers,
    pingPeer,
    setPeerPolicy,
    syncPoliciesToNode,
    clearPeers,
  };
}
