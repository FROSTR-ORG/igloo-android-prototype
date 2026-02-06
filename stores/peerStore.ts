import type { Peer, PeerStatus, PeerStoreState } from '@/types';
import { normalizePubkey } from '@frostr/igloo-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const normalizePeerKey = (pubkey?: string | null): string => {
  if (!pubkey) return '';
  try {
    return normalizePubkey(pubkey).toLowerCase();
  } catch {
    return '';
  }
};

const findPeerKey = (peers: Record<string, Peer>, pubkey: string) => {
  const normalizedKey = normalizePeerKey(pubkey) || pubkey;
  if (peers[normalizedKey]) {
    return { normalizedKey, existingKey: normalizedKey };
  }
  const existingKey = Object.keys(peers).find(
    (key) => normalizePeerKey(key) === normalizedKey
  );
  return { normalizedKey, existingKey };
};

export const usePeerStore = create<PeerStoreState>()(
  persist(
    (set, get) => ({
      // State
      peers: {},
      selfPubkey: null,
      lastPingTime: null,

      // Actions
      setPeers: (peers: Peer[]) => {
        const peersRecord: Record<string, Peer> = {};
        const existingByNormalized = new Map<string, Peer>();
        for (const [key, peer] of Object.entries(get().peers)) {
          const normalizedKey = normalizePeerKey(peer.pubkey || key);
          if (!normalizedKey) continue;
          const existing = existingByNormalized.get(normalizedKey);
          if (existing) {
            existingByNormalized.set(normalizedKey, {
              ...existing,
              ...peer,
              pubkey: normalizedKey,
              displayName: existing.displayName ?? peer.displayName,
              allowSend: existing.allowSend ?? peer.allowSend,
              allowReceive: existing.allowReceive ?? peer.allowReceive,
            });
          } else {
            existingByNormalized.set(normalizedKey, {
              ...peer,
              pubkey: normalizedKey,
            });
          }
        }

        for (const peer of peers) {
          const normalizedKey = normalizePeerKey(peer.pubkey);
          if (!normalizedKey) continue;
          // Preserve existing policies if peer already exists
          const existing = existingByNormalized.get(normalizedKey);
          peersRecord[normalizedKey] = {
            ...peer,
            pubkey: normalizedKey,
            displayName: existing?.displayName ?? peer.displayName,
            allowSend: existing?.allowSend ?? peer.allowSend,
            allowReceive: existing?.allowReceive ?? peer.allowReceive,
            status: existing?.status ?? peer.status,
            lastSeen: existing?.lastSeen ?? peer.lastSeen,
            latency: existing?.latency ?? peer.latency,
          };
        }
        set({ peers: peersRecord });
      },

      updatePeer: (pubkey: string, update: Partial<Peer>) => {
        set((state) => {
          const { normalizedKey, existingKey } = findPeerKey(state.peers, pubkey);
          const key = normalizedKey || pubkey;
          const existing = existingKey ? state.peers[existingKey] : undefined;
          const nextPeer = existing
            ? { ...existing, ...update, pubkey: key }
            : {
                pubkey: key,
                status: 'unknown',
                lastSeen: null,
                latency: null,
                allowSend: true,
                allowReceive: true,
                ...update,
              };
          const nextPeers = { ...state.peers };
          if (existingKey && existingKey !== key) {
            delete nextPeers[existingKey];
          }
          nextPeers[key] = nextPeer;
          return { peers: nextPeers };
        });
      },

      updatePeerStatus: (pubkey: string, status: PeerStatus, latency?: number) => {
        set((state) => {
          const { normalizedKey, existingKey } = findPeerKey(state.peers, pubkey);
          const key = normalizedKey || pubkey;
          const existing = existingKey ? state.peers[existingKey] : undefined;
          const nextPeer = existing
            ? {
                ...existing,
                status,
                latency: latency ?? existing.latency,
                lastSeen:
                  status === 'online' ? new Date().toISOString() : existing.lastSeen,
                pubkey: key,
              }
            : {
                pubkey: key,
                status,
                lastSeen: status === 'online' ? new Date().toISOString() : null,
                latency: latency ?? null,
                allowSend: true,
                allowReceive: true,
              };
          const nextPeers = { ...state.peers };
          if (existingKey && existingKey !== key) {
            delete nextPeers[existingKey];
          }
          nextPeers[key] = nextPeer;
          return { peers: nextPeers };
        });
      },

      updatePeerPolicy: (
        pubkey: string,
        policy: { allowSend?: boolean; allowReceive?: boolean }
      ) => {
        set((state) => {
          const { normalizedKey, existingKey } = findPeerKey(state.peers, pubkey);
          const key = normalizedKey || pubkey;
          const existing = existingKey ? state.peers[existingKey] : undefined;
          const nextPeer = existing
            ? { ...existing, ...policy, pubkey: key }
            : {
                pubkey: key,
                status: 'unknown',
                lastSeen: null,
                latency: null,
                allowSend: policy.allowSend ?? true,
                allowReceive: policy.allowReceive ?? true,
              };
          const nextPeers = { ...state.peers };
          if (existingKey && existingKey !== key) {
            delete nextPeers[existingKey];
          }
          nextPeers[key] = nextPeer;
          return { peers: nextPeers };
        });
      },

      setSelfPubkey: (pubkey: string) => {
        set({ selfPubkey: normalizePeerKey(pubkey) || pubkey });
      },

      setLastPingTime: (time: Date) => {
        set({ lastPingTime: time });
      },

      clearPeers: () => {
        set({ peers: {}, selfPubkey: null, lastPingTime: null });
      },
    }),
    {
      name: 'igloo-peers',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist policies, not ephemeral status
      partialize: (state) => ({
        peers: Object.fromEntries(
          Object.entries(state.peers).map(([pubkey, peer]) => [
            normalizePeerKey(peer.pubkey || pubkey) || pubkey,
            {
              pubkey: normalizePeerKey(peer.pubkey || pubkey) || peer.pubkey,
              displayName: peer.displayName,
              allowSend: peer.allowSend,
              allowReceive: peer.allowReceive,
              // Don't persist ephemeral state
              status: 'unknown' as const,
              lastSeen: null,
              latency: null,
            },
          ])
        ),
        selfPubkey: state.selfPubkey,
      }),
    }
  )
);
