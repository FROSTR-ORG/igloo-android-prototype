import { Platform, EmitterSubscription } from 'react-native';
import { BackgroundAudioModule, audioEventEmitter } from '@/modules/background-audio';
import type { AudioStatus, SoundscapeId } from '@/types';
import { getSoundscapeFilename, getSoundscapeIdFromFilename } from './soundscapes';

/** Native playback state change event from BackgroundAudioModule */
interface PlaybackStateEvent {
  isPlaying: boolean;
  reason: 'started' | 'stopped' | 'interrupted' | 'resumed' | 'resumeFailed' | 'routeChangeFailed' | 'decodeError';
  /** Actual soundscape being played (included on 'started' and 'resumed' events) */
  soundscape?: string;
  /** Error message (included on 'decodeError' events) */
  error?: string;
}

/**
 * AudioService - Wrapper for native BackgroundAudioModule.
 * Uses Expo Modules API with native Swift/AVAudioPlayer for reliable iOS background audio playback.
 * Subscribes to native events and translates them to AudioStatus changes.
 */
class AudioService {
  private isPlaying: boolean = false;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckInFlight: boolean = false;
  private onHealthCheckFailed?: () => void;
  private nativeEventSubscription: EmitterSubscription | null = null;
  private onStatusChange?: (status: AudioStatus) => void;
  private currentSoundscapeId: SoundscapeId = 'ocean-waves';

  /**
   * Initialize - check if module is available.
   */
  async initialize(): Promise<void> {
    console.log('[AudioService] Initializing...');
    console.log('[AudioService] Platform:', Platform.OS);
    console.log('[AudioService] BackgroundAudioModule:', BackgroundAudioModule);

    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      console.log('[AudioService] Expo BackgroundAudioModule available');
    } else if (__DEV__) {
      console.warn(
        '[AudioService] Module not available - ensure you are running a development build (npx expo run:ios)'
      );
    }
  }

  /**
   * Start playing background audio with the current soundscape.
   * Safe to call multiple times - will only start if not already playing.
   * @param soundscapeId - Optional soundscape to play. If not provided, uses current soundscape.
   */
  async play(soundscapeId?: SoundscapeId): Promise<void> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        // Update current soundscape if provided
        if (soundscapeId) {
          this.currentSoundscapeId = soundscapeId;
        }

        // Check native state in case JS state is out of sync
        const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
        if (nativeIsPlaying) {
          console.log('[AudioService] Already playing (native confirmed)');
          this.isPlaying = true;
          return;
        }

        // Detect and fix state desync: JS thinks playing but native stopped
        if (this.isPlaying && !nativeIsPlaying) {
          console.warn('[AudioService] State desync detected: JS thought playing but native stopped, resyncing');
          this.isPlaying = false;
          // Continue to start playback below
        }

        const filename = getSoundscapeFilename(this.currentSoundscapeId);
        console.log(`[AudioService] Calling native play with soundscape: ${filename}...`);
        await BackgroundAudioModule.play(filename);
        this.isPlaying = true;
        console.log('[AudioService] Native playback started');
      } catch (error) {
        console.error('[AudioService] Failed to start native playback:', error);
        throw error;
      }
    } else {
      console.warn('[AudioService] Cannot play - module not available');
    }
  }

  /**
   * Stop playing background audio.
   * @throws Error if native module call fails
   */
  async stop(): Promise<void> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        // Check native state in case JS state is out of sync
        const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
        if (!nativeIsPlaying && !this.isPlaying) {
          return;
        }

        await BackgroundAudioModule.stop();
        this.isPlaying = false;
        console.log('[AudioService] Native playback stopped');
      } catch (error) {
        console.error('[AudioService] Failed to stop native playback:', error);
        throw error;
      }
    }
  }

  /**
   * Check if audio is currently playing (cached JS state).
   * May be out of sync with native state in edge cases.
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Check if audio is currently playing (queries native state).
   * Use this for accurate state when native/JS sync matters.
   */
  async getIsPlayingAsync(): Promise<boolean> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
        // Sync JS state with native state
        this.isPlaying = nativeIsPlaying;
        return nativeIsPlaying;
      } catch (error) {
        console.error('[AudioService] Failed to check native playing state:', error);
        return this.isPlaying;
      }
    }
    return this.isPlaying;
  }

  /**
   * Set the playback volume (0.0 to 1.0).
   * @throws Error if native module call fails
   */
  async setVolume(volume: number): Promise<void> {
    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        await BackgroundAudioModule.setVolume(volume);
      } catch (error) {
        console.error('[AudioService] Failed to set volume:', error);
        throw error;
      }
    }
  }

  /**
   * Change the current soundscape.
   * If audio is playing, it will seamlessly switch to the new soundscape.
   * @param soundscapeId - The soundscape to switch to.
   * @throws Error if native module call fails
   */
  async setSoundscape(soundscapeId: SoundscapeId): Promise<void> {
    const filename = getSoundscapeFilename(soundscapeId);
    console.log(`[AudioService] Setting soundscape to: ${filename}`);

    if (Platform.OS === 'ios' && BackgroundAudioModule) {
      try {
        await BackgroundAudioModule.setSoundscape(filename);
        // Update JS state only after native call succeeds
        this.currentSoundscapeId = soundscapeId;
        console.log('[AudioService] Soundscape changed successfully');
      } catch (error) {
        console.error('[AudioService] Failed to set soundscape:', error);
        throw error;
      }
    } else {
      // Non-iOS or no module: just update local state
      this.currentSoundscapeId = soundscapeId;
    }
  }

  /**
   * Get the current soundscape ID.
   */
  getCurrentSoundscape(): SoundscapeId {
    return this.currentSoundscapeId;
  }

  /**
   * Start periodic health check to detect if audio unexpectedly stopped.
   * @param onFailed - Callback when health check detects audio has stopped
   * @param intervalMs - Check interval in milliseconds (default: 30000)
   */
  startHealthCheck(onFailed: () => void, intervalMs = 30000): void {
    this.stopHealthCheck(); // Clear any existing interval
    this.onHealthCheckFailed = onFailed;

    this.healthCheckInterval = setInterval(() => {
      // Skip if not playing or if a previous check is still running
      if (!this.isPlaying || this.healthCheckInFlight) {
        return;
      }

      this.healthCheckInFlight = true;

      this.getIsPlayingAsync()
        .then((nativeIsPlaying) => {
          if (!nativeIsPlaying && this.isPlaying) {
            console.warn('[AudioService] Health check failed - audio stopped unexpectedly');
            this.isPlaying = false;
            this.onHealthCheckFailed?.();
          }
        })
        .catch((error) => {
          console.error('[AudioService] Health check error:', error);
        })
        .finally(() => {
          this.healthCheckInFlight = false;
        });
    }, intervalMs);

    console.log(`[AudioService] Health check started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic health check.
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.healthCheckInFlight = false;
      console.log('[AudioService] Health check stopped');
    }
  }

  /**
   * Set callback for audio status changes from native events.
   * Called when audio is interrupted, resumed, or fails.
   * Pass undefined to clear the callback.
   */
  setStatusChangeCallback(callback: ((status: AudioStatus) => void) | undefined): void {
    this.onStatusChange = callback;
  }

  /**
   * Subscribe to native audio events.
   * Must be called after audio starts playing to receive interruption events.
   */
  subscribeToNativeEvents(): void {
    if (!audioEventEmitter) {
      if (__DEV__) {
        console.log('[AudioService] Native event emitter not available');
      }
      return;
    }

    // Prevent duplicate subscriptions
    if (this.nativeEventSubscription) {
      return;
    }

    this.nativeEventSubscription = audioEventEmitter.addListener(
      'onPlaybackStateChanged',
      (event: PlaybackStateEvent) => {
        console.log('[AudioService] Native event:', event.reason, 'isPlaying:', event.isPlaying);

        // Update internal state
        this.isPlaying = event.isPlaying;

        // Sync soundscape if native reports a different one (e.g., fallback occurred)
        if (event.soundscape) {
          const nativeSoundscapeId = getSoundscapeIdFromFilename(event.soundscape);
          if (nativeSoundscapeId !== this.currentSoundscapeId) {
            console.log(`[AudioService] Soundscape synced from native: ${this.currentSoundscapeId} -> ${nativeSoundscapeId}`);
            this.currentSoundscapeId = nativeSoundscapeId;
          }
        }

        // Translate native event reason to AudioStatus
        const status = this.translateEventToStatus(event);
        if (status && this.onStatusChange) {
          this.onStatusChange(status);
        }
      }
    );

    console.log('[AudioService] Subscribed to native events');
  }

  /**
   * Unsubscribe from native audio events.
   */
  unsubscribeFromNativeEvents(): void {
    if (this.nativeEventSubscription) {
      this.nativeEventSubscription.remove();
      this.nativeEventSubscription = null;
      console.log('[AudioService] Unsubscribed from native events');
    }
  }

  /**
   * Translate native event to AudioStatus.
   * Returns null for events that don't need status updates (e.g., 'started' is handled by play()).
   */
  private translateEventToStatus(event: PlaybackStateEvent): AudioStatus | null {
    switch (event.reason) {
      case 'interrupted':
        return 'interrupted';
      case 'resumed':
        return 'playing';
      case 'resumeFailed':
      case 'routeChangeFailed':
      case 'decodeError':
        return 'error';
      case 'stopped':
        return 'idle';
      // 'started' is handled by the play() call, not events
      default:
        return null;
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();
