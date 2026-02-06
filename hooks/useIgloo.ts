import { useEffect, useCallback } from 'react';
import { iglooService } from '@/services/igloo';
import { useSignerStore, useLogStore, usePeerStore } from '@/stores';
import type { AudioStatus, SignerStatus, PeerStatus, LogEntry, SigningRequest } from '@/types';

// Module-level ref count to keep event listeners alive while any useIgloo() instance is mounted.
let listenersRefCount = 0;

// Stable handlers so on/off always use the same references.
const handleStatusChange = (status: SignerStatus) => {
  useSignerStore.getState().setStatus(status);
};

const handleAudioStatus = (status: AudioStatus) => {
  useSignerStore.getState().setAudioStatus(status);
};

const handleRelayConnected = () => {
  useSignerStore.getState().setConnectedRelays([...iglooService.getConnectedRelays()]);
};

const handleRelayDisconnected = () => {
  useSignerStore.getState().setConnectedRelays([...iglooService.getConnectedRelays()]);
};

const handleSigningRequest = (request: SigningRequest) => {
  useSignerStore.getState().addSigningRequest(request);
};

const handleSigningComplete = (result: { requestId: string; success: boolean }) => {
  useSignerStore.getState().updateSigningRequest(result.requestId, {
    status: result.success ? 'completed' : 'failed',
  });
};

const handleSigningError = (error: Error, requestId?: string) => {
  if (requestId) {
    useSignerStore.getState().updateSigningRequest(requestId, { status: 'failed' });
  }
};

const handlePeerStatus = (pubkey: string, status: PeerStatus, latency?: number) => {
  usePeerStore.getState().updatePeerStatus(pubkey, status, latency);
};

const handleLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
  useLogStore.getState().addEntry(entry);
};

const handleError = (error: Error) => {
  useSignerStore.getState().setError(error.message);
};

/**
 * Main hook for interacting with the IglooService.
 * Sets up event listeners and provides methods to control the signer.
 */
export function useIgloo() {
  // Set up event listeners once on mount.
  // Uses empty dependency array because:
  // - iglooService is a singleton (stable reference)
  // - Zustand store selectors are stable references
  // This prevents duplicate listener registration from effect re-runs.
  // Module-level ref count prevents duplicates across multiple useIgloo() calls.
  useEffect(() => {
    listenersRefCount += 1;

    if (listenersRefCount === 1) {
      // Subscribe to events
      iglooService.on('status:changed', handleStatusChange);
      iglooService.on('audio:status', handleAudioStatus);
      iglooService.on('relay:connected', handleRelayConnected);
      iglooService.on('relay:disconnected', handleRelayDisconnected);
      iglooService.on('signing:request', handleSigningRequest);
      iglooService.on('signing:complete', handleSigningComplete);
      iglooService.on('signing:error', handleSigningError);
      iglooService.on('peer:status', handlePeerStatus);
      iglooService.on('log', handleLog);
      iglooService.on('error', handleError);
    }

    // Cleanup on unmount
    return () => {
      listenersRefCount -= 1;

      if (listenersRefCount === 0) {
        iglooService.off('status:changed', handleStatusChange);
        iglooService.off('audio:status', handleAudioStatus);
        iglooService.off('relay:connected', handleRelayConnected);
        iglooService.off('relay:disconnected', handleRelayDisconnected);
        iglooService.off('signing:request', handleSigningRequest);
        iglooService.off('signing:complete', handleSigningComplete);
        iglooService.off('signing:error', handleSigningError);
        iglooService.off('peer:status', handlePeerStatus);
        iglooService.off('log', handleLog);
        iglooService.off('error', handleError);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose service methods
  const startSigner = useCallback(
    (group: string, share: string, relays: string[]) => {
      return iglooService.startSigner(group, share, relays);
    },
    []
  );

  const stopSigner = useCallback(() => {
    return iglooService.stopSigner();
  }, []);

  const validateCredentials = useCallback((share: string, group: string) => {
    return iglooService.validateCredentials(share, group);
  }, []);

  const getShareDetails = useCallback((share: string, group: string) => {
    return iglooService.getShareDetails(share, group);
  }, []);

  const getPeers = useCallback((group?: string, share?: string) => {
    return iglooService.getPeers(group, share);
  }, []);

  const getSelfPubkey = useCallback((group?: string, share?: string) => {
    return iglooService.getSelfPubkey(group, share);
  }, []);

  const pingAllPeers = useCallback((timeout?: number) => {
    return iglooService.pingAllPeers(timeout);
  }, []);

  const pingSinglePeer = useCallback((pubkey: string, timeout?: number) => {
    return iglooService.pingSinglePeer(pubkey, timeout);
  }, []);

  const sendEcho = useCallback(
    (challenge: string, relays: string[], group?: string, share?: string) => {
      return iglooService.sendEchoSignal(challenge, relays, group, share);
    },
    []
  );

  const updatePolicies = useCallback((policies: Parameters<typeof iglooService.updatePeerPolicies>[0]) => {
    return iglooService.updatePeerPolicies(policies);
  }, []);

  const isRunning = useCallback(() => {
    return iglooService.isRunning();
  }, []);

  const decodeGroupCredential = useCallback((group: string) => {
    return iglooService.decodeGroupCredential(group);
  }, []);

  const decodeShareCredential = useCallback((share: string) => {
    return iglooService.decodeShareCredential(share);
  }, []);

  const getLoadedCredentials = useCallback(() => {
    return iglooService.getLoadedCredentials();
  }, []);

  return {
    // Methods
    startSigner,
    stopSigner,
    validateCredentials,
    getShareDetails,
    getPeers,
    getSelfPubkey,
    pingAllPeers,
    pingSinglePeer,
    sendEcho,
    updatePolicies,
    isRunning,
    decodeGroupCredential,
    decodeShareCredential,
    getLoadedCredentials,
  };
}
