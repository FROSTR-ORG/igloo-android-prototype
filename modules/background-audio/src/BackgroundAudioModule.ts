import { NativeModule, requireNativeModule } from 'expo-modules-core';
import { Platform, NativeEventEmitter, NativeModulesStatic } from 'react-native';

declare class BackgroundAudioModuleType extends NativeModule {
  /**
   * Start audio playback.
   * @param filename - Optional soundscape filename (without extension). Defaults to current soundscape.
   */
  play(filename?: string): Promise<boolean>;

  /** Stop audio playback. */
  stop(): Promise<boolean>;

  /**
   * Set the playback volume.
   * @param volume - Volume level from 0.0 to 1.0
   */
  setVolume(volume: number): Promise<boolean>;

  /** Check if audio is currently playing. */
  isPlaying(): Promise<boolean>;

  /**
   * Change the soundscape. If audio is playing, it will restart with the new soundscape.
   * @param filename - Soundscape filename without extension (e.g., "ocean-waves", "rain")
   */
  setSoundscape(filename: string): Promise<boolean>;

  /** Get the current soundscape filename. */
  getCurrentSoundscape(): Promise<string>;
}

// Gracefully handle missing native module (e.g., when running in Expo Go)
let BackgroundAudioModule: BackgroundAudioModuleType | null = null;
let audioEventEmitter: NativeEventEmitter | null = null;

if (Platform.OS === 'ios') {
  try {
    BackgroundAudioModule = requireNativeModule<BackgroundAudioModuleType>('BackgroundAudio');
    // Create event emitter for native module events
    audioEventEmitter = new NativeEventEmitter(
      BackgroundAudioModule as unknown as NativeModulesStatic[string]
    );
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[BackgroundAudio] Native module not available. ' +
          'This is expected in Expo Go. Use `npx expo run:ios` for a development build.',
        error
      );
    }
  }
}

export default BackgroundAudioModule;
export { audioEventEmitter };
