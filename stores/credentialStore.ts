import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '@/services/storage/secureStorage';
import type { CredentialStoreState, ShareDetails } from '@/types';

export const useCredentialStore = create<CredentialStoreState>()(
  persist(
    (set, get) => ({
      // State
      hasCredentials: false,
      shareDetails: null,
      onboardingComplete: false,
      echoSent: false,
      isHydrated: false,

      // Actions
      hydrateFromStorage: async () => {
        try {
          const hasCredentials = await secureStorage.hasCredentials();
          set({
            hasCredentials,
            isHydrated: true,
          });
        } catch (error) {
          console.error('Failed to hydrate credentials:', error);
          set({ isHydrated: true });
        }
      },

      setCredentialsExist: (exists: boolean) => {
        set({ hasCredentials: exists });
      },

      setShareDetails: (details: ShareDetails | null) => {
        set({ shareDetails: details });
      },

      setOnboardingComplete: (complete: boolean) => {
        set({ onboardingComplete: complete });
      },

      setEchoSent: (sent: boolean) => {
        set({ echoSent: sent });
      },

      clearCredentials: async () => {
        await secureStorage.clearCredentials();
        set({
          hasCredentials: false,
          shareDetails: null,
          onboardingComplete: false,
          echoSent: false,
        });
      },
    }),
    {
      name: 'igloo-credentials',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist non-sensitive metadata
      partialize: (state) => ({
        shareDetails: state.shareDetails,
        onboardingComplete: state.onboardingComplete,
        echoSent: state.echoSent,
      }),
      onRehydrateStorage: () => (state) => {
        // After Zustand rehydrates, also check secure storage
        state?.hydrateFromStorage();
      },
    }
  )
);
