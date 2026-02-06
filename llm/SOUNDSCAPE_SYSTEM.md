# Soundscape System

## Overview

The Soundscape System provides a scalable architecture for managing multiple ambient audio options in the Igloo signer. Users can select from a variety of soundscapes to play while their signer is active, personalizing their background audio experience.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
├─────────────────────────────────────────────────────────────┤
│  SoundscapeSelector.tsx                                      │
│  - Grid of soundscape options                                │
│  - Selected indicator with checkmark                         │
│  - "Coming Soon" badges for unavailable soundscapes          │
│  - Haptic feedback on selection                              │
│                                                              │
│  VolumeControl.tsx                                           │
│  - Continuous slider (range 0.0–1.0, displayed as 0%–100%)  │
│  - Mute toggle button (toggles between 0 and previous volume)│
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     State Layer                              │
├─────────────────────────────────────────────────────────────┤
│  audioStore.ts (Zustand + AsyncStorage)                      │
│  - volume: number (0.0 to 1.0)                               │
│  - soundscapeId: SoundscapeId                                │
│  - Persisted across app restarts                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
├─────────────────────────────────────────────────────────────┤
│  AudioService.ts                                             │
│  - play(soundscapeId?): Start audio with soundscape          │
│  - stop(): Stop audio                                        │
│  - setVolume(volume): Adjust volume (0.0 to 1.0)             │
│  - setSoundscape(id): Change soundscape (hot-swappable)      │
│  - getCurrentSoundscape(): Get current soundscape ID         │
│                                                              │
│  soundscapes.ts (Registry)                                   │
│  - SOUNDSCAPE_REGISTRY: All soundscape configurations        │
│  - getAvailableSoundscapes(): Bundled soundscapes            │
│  - getSoundscapeFilename(id): Get audio filename             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Native Layer                               │
├─────────────────────────────────────────────────────────────┤
│  BackgroundAudioModule.swift                                 │
│  - play(filename?): Start playback with specific audio       │
│  - setSoundscape(filename): Hot-swap audio file              │
│  - Automatic fallback to ocean-waves if file not found       │
│  - Control Center integration with soundscape name           │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```text
types/
└── index.ts                    # SoundscapeId, SoundscapeConfig types

services/audio/
├── AudioService.ts             # High-level audio control
├── soundscapes.ts              # Soundscape registry & helpers
└── index.ts                    # Exports

stores/
└── audioStore.ts               # Persisted audio preferences

components/ui/
├── VolumeControl.tsx           # Continuous volume slider (0.0–1.0) with mute toggle
├── SoundscapeSelector.tsx      # Soundscape grid selector
└── index.ts                    # Exports

modules/background-audio/
├── src/
│   └── BackgroundAudioModule.ts  # TypeScript interface
└── ios/
    └── BackgroundAudioModule.swift  # Native implementation

ios/Igloo/
├── ocean-waves.m4a             # Default soundscape
├── rain.m4a                    # Rain sounds
├── forest.m4a                  # Forest ambience
├── white-noise.m4a             # White noise
├── campfire.m4a                # Campfire sounds
├── amazon-jungle.m4a           # Tropical rainforest ambience
├── ambient-dream.m4a           # Ethereal atmospheric soundscape
├── birds.m4a                   # Gentle birdsong
├── rain-and-birds.m4a          # Rainfall with birdsong
└── space-atmosphere.m4a        # Cosmic ambient sounds
```

## Types

### SoundscapeId

Unique identifier for each soundscape:

```typescript
type SoundscapeId =
  | 'ocean-waves'
  | 'rain'
  | 'forest'
  | 'white-noise'
  | 'campfire'
  | 'amazon-jungle'
  | 'ambient-dream'
  | 'birds'
  | 'rain-and-birds'
  | 'space-atmosphere';
```

### SoundscapeConfig

Configuration for a single soundscape option:

```typescript
interface SoundscapeConfig {
  id: SoundscapeId;
  name: string;           // Display name (e.g., "Ocean Waves")
  description: string;    // Short description
  filename: string;       // Audio filename without extension
  available: boolean;     // Whether the audio file is bundled
}
```

## Soundscape Registry

All soundscapes are defined in `services/audio/soundscapes.ts`:

```typescript
export const SOUNDSCAPE_REGISTRY: Record<SoundscapeId, SoundscapeConfig> = {
  'ocean-waves': {
    id: 'ocean-waves',
    name: 'Ocean Waves',
    description: 'Gentle waves lapping on the shore',
    filename: 'ocean-waves',
    available: true,
  },
  'rain': {
    id: 'rain',
    name: 'Rain',
    description: 'Soft rainfall on leaves',
    filename: 'rain',
    available: true,
  },
  // ... 10 available soundscapes total
};
```

## Adding a New Soundscape

### Step 1: Prepare Audio File

1. Source or create your audio file
2. Convert to AAC/M4A format (VBR ~128kbps recommended):
   ```bash
   afconvert -f m4af -d aac -b 128000 -q 127 -s 2 source.wav output.m4a
   ```
   - `-q 127`: Max VBR quality (0-127)
   - `-s 2`: Constrained VBR mode
3. Ensure it loops cleanly (60-90 seconds recommended)

### Step 2: Add to iOS Bundle

1. Copy the file to `ios/Igloo/`:
   ```bash
   cp your-soundscape.m4a ios/Igloo/your-soundscape.m4a
   ```

2. Open Xcode: `open ios/Igloo.xcworkspace`

3. In Xcode Project Navigator:
   - Right-click the Igloo folder
   - Select "Add Files to 'Igloo'"
   - Choose your .m4a file
   - Ensure "Copy items if needed" is checked
   - Ensure "Add to targets: Igloo" is checked

4. Verify in Build Phases:
   - Select the Igloo target
   - Go to "Build Phases" tab
   - Expand "Copy Bundle Resources"
   - Confirm your file is listed

### Step 3: Register the Soundscape

1. Add the SoundscapeId to `types/index.ts`:
   ```typescript
   export type SoundscapeId = 'ocean-waves' | 'rain' | 'forest' | 'white-noise' | 'campfire' | 'your-new-id';
   ```

2. Add config to `services/audio/soundscapes.ts`:
   ```typescript
   'your-new-id': {
     id: 'your-new-id',
     name: 'Your Display Name',
     description: 'Brief description',
     filename: 'your-soundscape',  // Without .m4a extension
     available: true,
   },
   ```

3. Add icon mapping in `components/ui/SoundscapeSelector.tsx`:
   ```typescript
   case 'your-new-id':
     return <YourIcon {...iconProps} />;
   ```

4. Add display name in `BackgroundAudioModule.swift`:
   ```swift
   case "your-soundscape":
     return "Your Display Name"
   ```

### Step 4: Rebuild

```bash
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..
npx expo run:ios
```

## Volume Control

The VolumeControl component provides a continuous volume slider:

- **Range**: 0.0 to 1.0 (displayed as 0% to 100%)
- **Default**: 0.3 (30%) - defined in `soundscapes.ts` as `DEFAULT_VOLUME`
- **Mute button**: Toggles between 0 and previous volume
- **Accessibility**: Supports VoiceOver/TalkBack with 5% increment steps

**Note**: Even at 0 volume, the audio file continues playing silently. This is required by iOS for background execution. Setting volume to 0 effectively mutes the soundscape while maintaining background operation.

## Audio Store

The `audioStore` persists user preferences:

```typescript
interface AudioStoreState {
  volume: number;           // 0.0 to 1.0
  soundscapeId: SoundscapeId;
  setVolume: (volume: number) => void;
  setSoundscape: (id: SoundscapeId) => void;
}
```

Preferences are automatically saved to AsyncStorage and restored on app launch.

## Hot-Swapping Soundscapes

Soundscapes can be changed while audio is playing:

```typescript
// From Settings UI
const handleSoundscapeChange = async (id: SoundscapeId) => {
  setSoundscape(id);                    // Update store
  await audioService.setSoundscape(id); // Update native player
};
```

The native module handles the transition by:
1. Stopping current playback
2. Loading the new audio file
3. Starting playback at the current volume

## Control Center Integration

The currently playing soundscape is displayed in iOS Control Center:

```text
Igloo Signer
Ocean Waves
```

The display name updates automatically when switching soundscapes.

## Error Handling

### Missing Audio File

If a soundscape's audio file is not found in the bundle:
1. Native module logs a warning
2. Falls back to `ocean-waves.m4a`
3. Playback continues with fallback

### Invalid Soundscape ID

The registry validates soundscape IDs at compile time via TypeScript types.

## Testing

### Manual Testing Checklist

1. **Soundscape Selection**
   - [ ] All available soundscapes show with icons
   - [ ] Unavailable soundscapes show "Soon" badge
   - [ ] Selection updates checkmark indicator
   - [ ] Haptic feedback on selection

2. **Volume Control**
   - [ ] Slider allows continuous adjustment (0% to 100%)
   - [ ] Mute toggle button works (toggles between 0 and previous volume)
   - [ ] Volume persists across app restarts

3. **Hot-Swap**
   - [ ] Changing soundscape while playing works
   - [ ] No audio gap during transition
   - [ ] Control Center updates with new name

4. **Persistence**
   - [ ] Selected soundscape persists across restarts
   - [ ] Volume level persists across restarts

## Audio File Requirements

| Requirement | Value | Notes |
|-------------|-------|-------|
| Format | M4A/AAC | Hardware-accelerated on iOS |
| Bitrate | 128 kbps | Good balance of quality/size |
| Duration | 60-90 sec | Loops seamlessly |
| Channels | Stereo | Mono acceptable |
| Sample Rate | 44.1 kHz | Standard audio |

## Future Considerations

### Potential Enhancements

1. **Custom Soundscapes**: Allow users to import their own audio files
2. **Mixing**: Layer multiple soundscapes together
3. **Scheduled Rotation**: Auto-rotate soundscapes on a timer
4. **Seasonal Themes**: Holiday-specific soundscape packs

### Cloud Soundscape Library

If soundscapes are distributed remotely:
1. Download to app's Documents folder
2. Update registry dynamically
3. Handle offline availability

## Related Documentation

- [BACKGROUND_AUDIO_IMPLEMENTATION.md](./BACKGROUND_AUDIO_IMPLEMENTATION.md) - Native audio module details
- [SIGNER_SOUNDSCAPE_INTEGRATION.md](./SIGNER_SOUNDSCAPE_INTEGRATION.md) - Integration with signer lifecycle
