# Signer Soundscape Integration

## Overview

The "soundscape" feature is the integration between the Igloo threshold signer (BifrostNode) and the background audio system. When the signer starts, ambient audio begins playing to keep the iOS app alive in the background. When the signer stops, the audio stops.

## Purpose

The Igloo app runs a BifrostNode that:
- Connects to Nostr relays
- Listens for threshold signing requests
- Participates in distributed key signing ceremonies

Without background execution, iOS suspends the app within seconds of being backgrounded, making the signer unavailable. The soundscape keeps the signer operational 24/7.

## Integration Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
│  - Start/Stop signer button                                 │
│  - Signer status display                                    │
│  - Signing request notifications                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    IglooService                             │
│  services/igloo/IglooService.ts                             │
├─────────────────────────────────────────────────────────────┤
│  startSigner()                                              │
│    1. Create BifrostNode                                    │
│    2. Connect to relays                                     │
│    3. Set up event listeners                                │
│    4. ▶ audioService.play()  ← Start soundscape             │
│                                                             │
│  stopSigner(options?)                                       │
│    1. Emit disconnect events                                │
│    2. Clean up node                                         │
│    3. ◼ audioService.stop()  ← Stop soundscape              │
│       (unless options.keepAudio = true)                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    AudioService                             │
│  services/audio/AudioService.ts                             │
├─────────────────────────────────────────────────────────────┤
│  - Manages native BackgroundAudioModule                     │
│  - Checks native isPlaying() before starting                │
│  - Tracks playback state (synced with native)               │
│  - Handles errors gracefully                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                BackgroundAudioModule                        │
│  (Native Swift - keeps app alive)                           │
└─────────────────────────────────────────────────────────────┘
```

## IglooService Integration

### Starting the Signer

In `IglooService.startSigner()`, after the BifrostNode is successfully created and connected:

```typescript
// Start background audio to keep app alive in iOS background mode
try {
  await audioService.play();
} catch (error) {
  this.log('warn', 'system', 'Failed to start background audio', {
    error: error instanceof Error ? error.message : 'Unknown',
  });
}
```

**Key Design Decisions:**
- Audio starts **after** successful node creation (not before)
- Failure to start audio is a warning, not a fatal error
- The signer can still function in foreground even without audio

### Stopping the Signer

In `IglooService.stopSigner()`, the method accepts an options parameter:

```typescript
async stopSigner(options: { keepAudio?: boolean } = {}): Promise<void> {
  // ... node cleanup ...

  // Stop background audio (unless we're restarting)
  if (!options.keepAudio) {
    try {
      await audioService.stop();
    } catch (audioError) {
      this.log('warn', 'system', 'Failed to stop background audio', { ... });
    }
  }
}
```

**Key Design Decisions:**
- `keepAudio: true` preserves audio during signer restarts
- Prevents audio drops caused by React re-renders or Strict Mode
- Audio stop errors don't prevent signer from being marked as stopped

### Handling Signer Restarts

If `startSigner()` is called while already running, audio is preserved:

```typescript
async startSigner(...): Promise<void> {
  // Don't start if already running - restart with audio preserved
  if (this.node) {
    this.log('warn', 'system', 'Signer already running, restarting (keeping audio)...');
    await this.stopSigner({ keepAudio: true });
  }
  // ... continue with startup ...
}
```

This prevents audio interruptions during:
- React 18 Strict Mode (effects run twice in development)
- Component re-renders that trigger signer restart
- Navigation events

### Error Handling

If the signer encounters an error during operation:

```typescript
} catch (error) {
  // ... error handling ...

  // Also stop audio on error (unless we're restarting)
  if (!options.keepAudio) {
    try {
      await audioService.stop();
    } catch {
      // Ignore audio stop errors during error handling
    }
  }
}
```

## AudioService Integration

### Native State Verification

The AudioService checks native state before starting to prevent duplicate playback:

```typescript
async play(): Promise<void> {
  if (Platform.OS === 'ios' && BackgroundAudioModule) {
    // Check native state in case JS state is out of sync
    const nativeIsPlaying = await BackgroundAudioModule.isPlaying();
    if (nativeIsPlaying) {
      console.log('[AudioService] Already playing (native confirmed)');
      this.isPlaying = true;
      return;
    }

    if (this.isPlaying) {
      console.log('[AudioService] Already playing (JS state)');
      return;
    }

    await BackgroundAudioModule.play();
    this.isPlaying = true;
  }
}
```

This handles cases where:
- JS state gets out of sync with native state
- Multiple components try to start audio simultaneously
- Rapid start/stop cycles from React re-renders

## Lifecycle States

```text
┌─────────────┐     startSigner()     ┌─────────────┐
│   Stopped   │ ───────────────────▶  │ Connecting  │
│  (no audio) │                       │  (no audio) │
└─────────────┘                       └──────┬──────┘
       ▲                                     │
       │                                     │ Success
       │                                     ▼
       │                              ┌─────────────┐
       │  stopSigner()                │   Running   │
       │  (keepAudio: false)          │ (AUDIO ON)  │ ◀── Signer active,
       │                              └──────┬──────┘     audio playing
       │                                     │
       │                                     │ stopSigner({ keepAudio: true })
       │                                     │ (for restart)
       │                                     ▼
       │                              ┌─────────────┐
       │                              │ Restarting  │
       │                              │ (AUDIO ON)  │ ◀── Audio preserved
       │                              └──────┬──────┘
       │                                     │
       └─────────────────────────────────────┘
```

## User Experience

### When Signer Starts
1. User taps "Start Signer"
2. App connects to relays
3. Status changes to "Running"
4. Background audio begins (ocean waves at low volume)
5. User can now switch to other apps

### While Signer Runs
- Audio plays continuously at low volume (0.3)
- App stays active in background
- Signing requests are processed automatically
- User can check status anytime by returning to app

### When Signer Stops
1. User taps "Stop Signer" (or error occurs)
2. Node disconnects from relays
3. Audio stops immediately
4. Status changes to "Stopped"
5. App will be suspended normally when backgrounded

## Audio Configuration

### Current Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| Volume | 0.3 (default) | Low enough to not disturb, user-adjustable in Settings (0-0.75) |
| Loop | Infinite | Continuous operation required |
| Soundscape | User's choice | Ocean waves (default), with more options coming |
| Category | .playback | Required for background audio, overrides silent switch |

### Implemented Features

- **User volume control**: Volume presets available in Settings (Off/Low/Med/High/Max) ✓
- **Soundscape selection**: Choose from multiple ambient sounds in Settings ✓
- **Audio status indicator**: Shows "Soundscape active" or warnings in signer UI ✓
- **Now Playing**: Shows "Igloo Signer" and current soundscape in Control Center ✓
- **Persisted preferences**: Volume and soundscape saved across app restarts ✓
- **Hot-swappable**: Change soundscape while audio is playing ✓

### Future Considerations

- **Additional soundscapes**: Rain, forest, white noise, campfire (infrastructure ready)
- **Custom soundscapes**: Allow users to import their own audio files
- **Notifications**: Play different sounds for signing events

## Testing the Integration

### Manual Test Procedure

1. **Start signer**
   - Verify audio begins playing
   - Check logs for `[AudioService] Native playback started`

2. **Background the app**
   - Press home button
   - Wait 2+ minutes
   - Check Control Center for audio indicator

3. **Verify signer still running**
   - Return to app
   - Check signer status shows "Running"
   - Verify uptime has increased
   - Check relay connections still active

4. **Stop signer**
   - Tap stop button
   - Verify audio stops
   - Verify status shows "Stopped"

5. **Error scenario**
   - Start signer with invalid credentials
   - Verify audio doesn't start (or stops if started)
   - Verify app handles error gracefully

6. **Restart scenario**
   - Start signer
   - Trigger a restart (navigate away and back, or call startSigner again)
   - Verify audio doesn't drop/restart (should be continuous)

### Expected Log Sequence

```text
[IglooService] Starting signer node...
[IglooService] Signer node started successfully
[AudioService] Calling native play with soundscape: ocean-waves...
[BackgroundAudio] ========== START PLAYBACK ==========
[BackgroundAudio] Step 1: Configuring audio session...
[BackgroundAudio] Audio session activated successfully
[BackgroundAudio] Step 2: Looking for audio file 'ocean-waves.m4a'...
[BackgroundAudio] Found audio file at: /var/.../ocean-waves.m4a
[BackgroundAudio] Step 3: Creating AVAudioPlayer...
[BackgroundAudio] Player created successfully
[BackgroundAudio] - Duration: 70.8 seconds
[BackgroundAudio] Step 4: Preparing to play...
[BackgroundAudio] Prepare result: true
[BackgroundAudio] Step 5: Starting playback...
[BackgroundAudio] Play result: true
[BackgroundAudio] Playback started successfully!
[BackgroundAudio] ========== END START PLAYBACK ==========
[AudioService] Native playback started
```

### Restart Log Sequence (No Audio Drop)

```text
[IglooService] Signer already running, restarting (keeping audio)...
[IglooService] Stopping signer node... { keepAudio: true }
[IglooService] Signer node stopped
[IglooService] Starting signer node...
[AudioService] Calling native play...
[AudioService] Already playing (native confirmed)
[IglooService] Signer node started successfully
```

## Limitations

1. **Battery Impact**: Continuous audio playback uses battery, though the low-volume ambient sound minimizes this.

2. **Audio Interruptions**: Phone calls, Siri, or other apps taking audio focus will pause the soundscape (and potentially the signer). The native module handles resuming after interruptions end.

3. **iOS Restrictions**: Apple may reject apps that abuse background audio. The soundscape must serve a legitimate user-facing purpose.

4. **No True Silent Mode**: iOS requires actual audio output for the background mode to work. A truly silent/muted mode would need a different approach (like VoIP).

5. **Route Changes**: Plugging/unplugging headphones or Bluetooth changes can briefly interrupt audio. The native module handles resuming automatically.

## Files Involved

```text
services/
├── igloo/
│   └── IglooService.ts      # Main integration (emits audio:status events)
└── audio/
    ├── AudioService.ts      # Audio wrapper with native event subscription
    ├── soundscapes.ts       # Soundscape registry and configuration
    └── index.ts             # Exports

stores/
├── signerStore.ts           # audioStatus state (idle/playing/interrupted/error)
└── audioStore.ts            # Persisted audio preferences (volume, soundscape)

hooks/
├── useIgloo.ts              # Listens for audio:status events from IglooService
└── useSigner.ts             # Exposes audioStatus to components

components/ui/
├── VolumeControl.tsx        # Volume preset buttons (Off/Low/Med/High/Max)
└── SoundscapeSelector.tsx   # Soundscape selection grid

modules/background-audio/    # Native module (see BACKGROUND_AUDIO_IMPLEMENTATION.md)

ios/Igloo/
├── ocean-waves.m4a          # Default soundscape (ocean waves, AAC format)
└── Info.plist               # UIBackgroundModes config
```

For detailed soundscape system documentation, see [SOUNDSCAPE_SYSTEM.md](./SOUNDSCAPE_SYSTEM.md).

## User-Facing FAQ

### Why does Igloo play audio?

Igloo is a threshold signer that needs to stay awake to respond to signing requests from your connected apps (like Nostr clients). On iOS, apps are suspended when backgrounded unless they're actively playing audio. The ambient soundscape keeps your signer responsive while you use other apps.

### Can I mute the audio?

Yes! You can set the volume to "Off" in Settings while your signer is running. This mutes the soundscape but keeps the audio session active for background operation. You can also use your device's volume buttons for quick adjustments.

### What is the soundscape?

It's ambient audio designed to be unobtrusive at low volume. You can choose from different soundscapes in Settings - the default is gentle ocean waves. More options (rain, forest, etc.) will be added in future updates.

### Can I change the soundscape?

Yes! Go to Settings while your signer is running and select from available soundscapes. Your choice is saved and will be remembered the next time you start the signer.

### Does this use a lot of battery?

The audio playback typically uses minimal battery — comparable to playing music. Actual drain varies by device, OS version, volume level, and usage patterns. The signer itself also uses minimal resources when idle.

### Why not use silent audio?

iOS requires actual audio output for the background mode to work. A truly silent track would be detected and the app suspended. The low-volume ambient sound is the minimum required to stay alive.

## Failure Scenarios

### Audio Fails to Start

**Symptom:** Signer shows "Running" but no audio plays.

**Impact:** App will be suspended when backgrounded. Signer only works in foreground.

**Causes:**
- Audio file missing from bundle
- Audio session configuration failed
- Another app has exclusive audio access

**User Action:** Check if audio is playing. If not, stop and restart the signer.

### Audio Interrupted and Can't Resume

**Symptom:** Audio stops during a phone call and doesn't resume after.

**Impact:** Same as above - signer will be suspended on background.

**Causes:**
- Audio session failed to reactivate
- System denied audio access
- Audio player in invalid state

**User Action:** Stop and restart the signer to restore background operation.

### Signer Running Without Audio

**Symptom:** Signer status shows "Running" but audio indicator missing in Control Center.

**Impact:** Signer will be suspended within seconds of backgrounding.

**How Long Does It Work?** Only while the app is in the foreground. Once backgrounded, iOS suspends the app within 5-30 seconds without active audio.

**User Action:** Return to the app and restart the signer.

## Troubleshooting Flowchart

### "Signer isn't working in background"

```text
1. Is signer status "Running"?
   ├─ No → Start the signer
   └─ Yes → Continue to step 2

2. Is "Soundscape active" shown in the status card?
   ├─ No → Audio failed to start
   │       → Check for "Audio failed" warning
   │       → Stop and restart signer
   │       → If still fails, check device audio settings
   └─ Yes → Continue to step 3

3. Is audio playing? (Check Control Center for "Igloo Signer")
   ├─ No → Audio may have stopped unexpectedly
   │       → Return to app, check status
   │       → Restart signer if needed
   └─ Yes → Continue to step 4

4. Check relay connections in app
   ├─ 0 relays connected → Network issue
   │       → Check WiFi/cellular
   │       → Try different relays in Settings
   └─ Relays connected → Continue to step 5

5. Has the app been backgrounded for >10 minutes?
   ├─ Yes → iOS may have suspended despite audio
   │       → Return to app periodically
   │       → Check for iOS Low Power Mode (disable if enabled)
   └─ No → Issue may be relay-side, check peer connectivity
```

### Common Issues Table

| Symptom | Cause | Solution |
|---------|-------|----------|
| No audio after starting | Audio session failed | Restart signer |
| Audio stops after phone call | Interruption recovery failed | Restart signer |
| "Audio failed" warning in UI | Native module error | Check device volume, restart app |
| Signer suspended in background | Audio not playing | Check Control Center, restart signer |
| High battery drain | Typically minimal, varies by device/usage | Normal for background operation |
| Audio plays in silent mode | Required by iOS | Normal - adjust volume in Settings |

### Recovery Procedures

1. **Restart Signer**: Tap Stop → Wait 2 seconds → Tap Start
2. **Full App Restart**: Force quit app → Relaunch → Start signer
3. **Check System Settings**: iOS Settings → Igloo → Ensure "Background App Refresh" is on
4. **Check Audio Volume**: Adjust soundscape volume in Settings tab

## Related Documentation

- [BACKGROUND_AUDIO_IMPLEMENTATION.md](./BACKGROUND_AUDIO_IMPLEMENTATION.md) - Technical details of the native audio module
