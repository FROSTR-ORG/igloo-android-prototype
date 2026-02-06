/**
 * Audio Store
 *
 * Persisted store for audio preferences including volume and soundscape selection.
 * Changes are automatically saved to AsyncStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AudioStoreState, SoundscapeId } from '@/types';
import { DEFAULT_VOLUME, DEFAULT_SOUNDSCAPE_ID } from '@/services/audio/soundscapes';

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set) => ({
      // State
      volume: DEFAULT_VOLUME,
      soundscapeId: DEFAULT_SOUNDSCAPE_ID,

      // Actions
      setVolume: (volume: number) => {
        // Clamp volume to valid range
        const clampedVolume = Math.max(0, Math.min(1, volume));
        set({ volume: clampedVolume });
      },

      setSoundscape: (id: SoundscapeId) => {
        set({ soundscapeId: id });
      },
    }),
    {
      name: 'igloo-audio',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
