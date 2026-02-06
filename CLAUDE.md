# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Igloo Android is a mobile app prototype for FROSTR threshold signing. It allows users to run a remote signer node on their mobile device, participating in k-of-n threshold signature schemes over nostr relays. Built with Expo/React Native using TypeScript.

This repository is nearly identical to the sibling `../igloo-ios` project. The key difference is background signer keepalive:
- iOS: soundscape/background audio
- Android: foreground service with persistent notification

**Core dependency**: All cryptographic operations are handled by `@frostr/igloo-core` and `@frostr/bifrost`. Never implement crypto logic in the app—always delegate to these libraries.

## Development Commands

```bash
bun install              # Install dependencies
bun start                # Start Expo dev server (press 'i' for iOS, 'a' for Android)
bun run android          # Build and run on Android emulator/device (native build)
bun run ios              # Build and run on iOS simulator (requires native build)
bun run lint             # Run ESLint
bun run format           # Format code with Prettier
```

For native module changes, rebuild on the affected platform:
- iOS audio module changes (`modules/background-audio`): `bun run ios`
- Android foreground-service changes (`services/background`, Android manifest/gradle): `bun run android`

## Documentation Maintenance

**IMPORTANT**: When making code changes, ensure relevant LLM documentation in `llm/` is updated to reflect the changes. This maintains accuracy for AI-assisted development.

The `llm/` directory contains:
- **Implementation docs** (`llm/implementation/`): Architecture and feature documentation
  - `igloo-service.md`: IglooService patterns and lifecycle
  - `onboarding-flow.md`: Credential setup and validation
  - `signer-features.md`: Signer functionality and peer management
  - `state-management.md`: Zustand stores and state patterns
- **System docs**: Feature-specific documentation
  - `BACKGROUND_SIGNING_ANDROID.md`: Android foreground-service background signing
  - `BACKGROUND_AUDIO_IMPLEMENTATION.md`: Background audio system
  - `SIGNER_SOUNDSCAPE_INTEGRATION.md`: Audio-signer integration
  - `SOUNDSCAPE_SYSTEM.md`: Soundscape selection and playback
- **Workflow docs** (`llm/workflow/`): Development processes
- **Context docs** (`llm/context/`): External dependencies and setup

**When to update docs**:
- Architecture changes (service patterns, state management, routing)
- New features or significant feature modifications
- API changes (service methods, store interfaces, hook signatures)
- Behavioral changes (lifecycle, error handling, edge cases)
- Configuration or setup changes

**When docs updates may be skipped** (within reason):
- Minor bug fixes that don't change behavior
- Refactoring that preserves public APIs
- Styling or UI-only changes
- Test-only changes

Always review the relevant `llm/` files when making substantial changes and update them accordingly.

## Architecture

### Entry Point & Crypto Polyfill

The app uses a custom CommonJS entry point (`index.js`) that loads the compiled CommonJS polyfill (`polyfills/crypto.js`) via `require()` before any ES modules. If the TypeScript source (`polyfills/crypto.ts`) exists, it is the authoring source compiled to `polyfills/crypto.js`. The polyfill uses `expo-crypto` to provide `crypto.getRandomValues` on all global scopes (global, globalThis, window). This ordering is necessary because `index.js` must synchronously load the compiled polyfill before any ES module evaluation, which is critical for `@noble/hashes` (used by bifrost) and bifrost capturing `crypto.getRandomValues` at module-eval time. ES imports are hoisted, so polyfills must run synchronously first.

### Routing (Expo Router)

```
app/
├── _layout.tsx              # Root layout, credential hydration, audio init
├── (tabs)/                  # Main tab navigation (after onboarding)
│   ├── signer.tsx          # Start/stop signer, view status
│   ├── sessions.tsx        # Peer management, ping peers
│   ├── logs.tsx            # Event log viewer
│   └── settings.tsx        # Relay config, soundscape, clear credentials
└── onboarding/              # First-time setup
    ├── index.tsx           # Welcome screen
    ├── scan.tsx            # QR code scanner for credentials
    └── manual.tsx          # Manual credential entry
```

Navigation is credential-gated: users without credentials are redirected to `/onboarding`.

### Service Layer

**IglooService** (`services/igloo/IglooService.ts`):
- Singleton wrapping `@frostr/igloo-core` functions
- Manages BifrostNode lifecycle (start/stop signer)
- Uses EventEmitter pattern to communicate with React layer
- Handles iOS background audio lifecycle only (required for iOS background execution)

Key events emitted: `status:changed`, `signing:request`, `signing:complete`, `peer:status`, `log`

**AudioService** (`services/audio/AudioService.ts`):
- Wraps native `BackgroundAudioModule` (Expo Modules API)
- Plays ambient soundscapes to keep app alive in iOS background
- Handles audio interruptions (phone calls, Siri) and automatic resume

**AndroidForegroundSignerService** (`services/background/AndroidForegroundSignerService.ts`):
- Wraps `react-native-background-actions`
- Starts/stops Android foreground service while signer is running
- Provides persistent notification keepalive on Android

**SecureStorage** (`services/storage/secureStorage.ts`):
- Uses `expo-secure-store` for encrypted credential storage
- Stores `bfshare` and `bfgroup` credentials separately

### State Management (Zustand)

```
stores/
├── credentialStore.ts      # Credential presence, share details, onboarding state
├── signerStore.ts          # Signer status, connected relays, signing requests
├── peerStore.ts            # Peer list, online status, policies
├── relayStore.ts           # Relay configuration
├── logStore.ts             # Event log entries
└── audioStore.ts           # Volume, soundscape selection
```

- `credentialStore` persists metadata to AsyncStorage (not the credentials themselves)
- `signerStore` is ephemeral—resets when app restarts
- Zustand stores are accessed directly from services via `useStore.getState()` (no React context needed)

### Hooks

**useIgloo** (`hooks/useIgloo.ts`):
- Primary hook for interacting with IglooService
- Sets up event listeners on mount, syncs events to Zustand stores
- Returns methods: `startSigner`, `stopSigner`, `pingAllPeers`, `getPeers`, etc.

**useCredentials**, **usePeers**, **useSigner**, **useCopyFeedback**:
- Specialized hooks for common UI patterns

### Native Module: BackgroundAudioModule

Located in `modules/background-audio/`. Uses Expo Modules API with Swift/AVAudioPlayer for iOS background audio. Soundscape files (`.m4a`) are bundled in `ios/Igloo/`.

Native events are emitted for interruptions and state changes, translated to `AudioStatus` in JS.

## Key Patterns

### Credential Flow
1. User scans QR or enters credentials manually in onboarding
2. Credentials validated via `iglooService.validateCredentialsWithDecode()`
3. Stored in secure storage, metadata in Zustand
4. On app launch, `credentialStore.hydrateFromStorage()` checks secure storage

### Signer Lifecycle
1. `iglooService.startSigner(group, share, relays)` creates BifrostNode
2. Node connects to relays, starts listening for signing requests
3. Platform keepalive starts:
   - iOS: AudioService soundscape playback
   - Android: `androidForegroundSignerService` foreground service
4. Events flow: BifrostNode → IglooService → EventEmitter → useIgloo → Zustand stores → UI

### Peer Pubkey Normalization
Pubkeys are normalized to lowercase hex via `normalizePubkey()` from igloo-core. Always normalize before comparison or storage.

## Credential Types

- `bfshare`: Encoded share credential (contains threshold share secret)
- `bfgroup`: Encoded group credential (contains group public key, commits, threshold info)

Decoded via `decodeShare()` and `decodeGroup()` from `@frostr/igloo-core`.

## Background Execution by Platform

- iOS requires active audio playback for background execution. The app plays ambient soundscapes while the signer is running and handles interruptions with resume logic.
- Android uses a foreground service and persistent notification while signer mode is active.

Authoritative docs:
- Android: `llm/BACKGROUND_SIGNING_ANDROID.md`
- iOS: `llm/BACKGROUND_AUDIO_IMPLEMENTATION.md`

## Type Definitions

All shared types are in `types/index.ts`:
- `SignerStatus`: `'stopped' | 'connecting' | 'running' | 'error'`
- `AudioStatus`: `'idle' | 'playing' | 'interrupted' | 'error'`
- `PeerStatus`: `'online' | 'offline' | 'unknown'`
- Store state types for each Zustand store
