import type { AudioStatus, SignerStatus, SignerStoreState, SigningRequest } from '@/types';
import { create } from 'zustand';

const MAX_RECENT_REQUESTS = 10;

export const useSignerStore = create<SignerStoreState>()((set, get) => ({
  // State (ephemeral - not persisted)
  status: 'stopped',
  audioStatus: 'idle',
  connectedRelays: [],
  lastError: null,
  signingRequestsReceived: 0,
  signingRequestsCompleted: 0,
  sessionStartTime: null,
  recentRequests: [],

  // Actions
  setStatus: (status: SignerStatus) => {
    set((state) => ({
      status,
      sessionStartTime: status === 'running' && state.status !== 'running'
        ? new Date()
        : state.sessionStartTime,
      lastError: status === 'running' ? null : state.lastError,
      // Reset audio status when signer stops
      audioStatus: status === 'stopped' ? 'idle' : state.audioStatus,
    }));
  },

  setAudioStatus: (audioStatus: AudioStatus) => {
    set({ audioStatus });
  },

  setConnectedRelays: (relays: string[]) => {
    set({ connectedRelays: relays });
  },

  setError: (error: string | null) => {
    set({
      lastError: error,
      status: error ? 'error' : get().status,
    });
  },

  incrementRequestsReceived: () => {
    set((state) => ({
      signingRequestsReceived: state.signingRequestsReceived + 1,
    }));
  },

  incrementRequestsCompleted: () => {
    set((state) => ({
      signingRequestsCompleted: state.signingRequestsCompleted + 1,
    }));
  },

  addSigningRequest: (request: SigningRequest) => {
    set((state) => {
      const recentRequests = [request, ...state.recentRequests].slice(0, MAX_RECENT_REQUESTS);
      return {
        recentRequests,
        signingRequestsReceived: state.signingRequestsReceived + 1,
      };
    });
  },

  updateSigningRequest: (id: string, update: Partial<SigningRequest>) => {
    set((state) => {
      const existingRequest = state.recentRequests.find((req) => req.id === id);
      const previousStatus = existingRequest?.status;
      const isTransitioningToCompleted =
        previousStatus !== 'completed' && update.status === 'completed';

      return {
        recentRequests: state.recentRequests.map((req) =>
          req.id === id ? { ...req, ...update } : req
        ),
        signingRequestsCompleted: isTransitioningToCompleted
          ? state.signingRequestsCompleted + 1
          : state.signingRequestsCompleted,
      };
    });
  },

  resetSession: () => {
    set({
      status: 'stopped',
      audioStatus: 'idle',
      connectedRelays: [],
      lastError: null,
      signingRequestsReceived: 0,
      signingRequestsCompleted: 0,
      sessionStartTime: null,
      recentRequests: [],
    });
  },
}));
