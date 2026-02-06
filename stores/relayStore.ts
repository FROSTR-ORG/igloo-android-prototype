import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RelayStoreState } from '@/types';
import { DEFAULT_RELAYS } from '@/types';

export const useRelayStore = create<RelayStoreState>()(
  persist(
    (set, get) => ({
      // State
      relays: [...DEFAULT_RELAYS],

      // Actions
      addRelay: (relay: string) => {
        const normalized = normalizeRelayUrl(relay);
        if (!normalized) return;

        set((state) => {
          if (state.relays.includes(normalized)) {
            return state; // Already exists
          }
          return { relays: [...state.relays, normalized] };
        });
      },

      removeRelay: (relay: string) => {
        set((state) => ({
          relays: state.relays.filter((r) => r !== relay),
        }));
      },

      setRelays: (relays: string[]) => {
        const normalized = relays
          .map(normalizeRelayUrl)
          .filter((r): r is string => r !== null);
        set({ relays: normalized });
      },

      resetToDefaults: () => {
        set({ relays: [...DEFAULT_RELAYS] });
      },
    }),
    {
      name: 'igloo-relays',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Normalize relay URL to wss:// format
 */
function normalizeRelayUrl(url: string): string | null {
  try {
    let normalized = url.trim();

    // Add wss:// if no protocol specified
    if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
      normalized = `wss://${normalized}`;
    }

    // Upgrade ws to wss
    if (normalized.startsWith('ws://')) {
      normalized = normalized.replace('ws://', 'wss://');
    }

    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, '');

    // Validate URL format
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'wss:') {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}
