# Android Background Signing

## Overview

This document covers how background signing is handled on Android in this repository.

This codebase is nearly identical to the sibling `../igloo-ios` project, with one key difference:
- iOS keeps the signer alive using soundscape/background audio.
- Android keeps the signer alive using a foreground service and persistent notification.

Android background signing does **not** depend on soundscape playback.

---

## Architecture

```text
UI (Signer tab) / useSigner hook
          |
          v
androidForegroundSignerService.start()
(services/background/AndroidForegroundSignerService.ts)
          |
          v
react-native-background-actions
          |
          v
Android foreground service notification
(task title: "Igloo signer is active")

In parallel:
useSigner -> iglooService.startSigner() -> Bifrost node connects to relays
```

---

## Lifecycle Flow

### Start Flow

When user taps **Start Signer** (`hooks/useSigner.ts`):
1. Load credentials from secure storage.
2. If platform is Android, start foreground service first.
3. Start signer node through `iglooService.startSigner(...)`.
4. If signer startup fails, stop the foreground service in the error path.

This ensures Android keepalive is active before signer connectivity starts.

### Stop Flow

When user taps **Stop Signer** (`hooks/useSigner.ts`):
1. Call `stopSigner()`.
2. In `finally`, stop Android foreground service.

Using `finally` guarantees cleanup even if signer shutdown throws.

---

## Implementation Files

- `hooks/useSigner.ts`
  - Orchestrates Android service start/stop around signer lifecycle.
  - Starts service before signer start.
  - Stops service both on normal stop and startup failure.

- `services/background/AndroidForegroundSignerService.ts`
  - Wraps `react-native-background-actions`.
  - Configures notification:
    - `taskName`: `IglooSigner`
    - `taskTitle`: `Igloo signer is active`
    - `taskDesc`: `Background signing is running`
  - Maintains a lightweight keepalive loop while running.

- `android/app/src/main/AndroidManifest.xml`
  - Declares foreground-service permissions.
  - Merges `RNBackgroundActionsTask` service with `foregroundServiceType="dataSync"`.

- `app/(tabs)/settings.tsx`
  - Android-specific copy explains foreground-service behavior.

---

## Permissions and Notification

Android foreground mode is backed by:
- `android.permission.FOREGROUND_SERVICE`
- `android.permission.FOREGROUND_SERVICE_DATA_SYNC`
- `android.permission.WAKE_LOCK`
- `android.permission.POST_NOTIFICATIONS`

While signer mode is active on Android, users should see a persistent system notification indicating background signing is running.

---

## Relationship to iOS Soundscape Docs

The following documents are iOS-specific and describe audio-based keepalive:
- `./BACKGROUND_AUDIO_IMPLEMENTATION.md`
- `./SIGNER_SOUNDSCAPE_INTEGRATION.md`
- `./SOUNDSCAPE_SYSTEM.md`

For Android implementation decisions, use this document as the source of truth.
