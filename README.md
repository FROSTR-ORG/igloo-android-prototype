# Igloo Android

Mobile app prototype for [Frostr](https://frostr.org) threshold signing.

This repo is an almost exact clone of `../igloo-ios`. The key difference is background signer keepalive:
- iOS uses soundscape/background audio.
- Android uses a foreground service with a persistent notification.

See `llm/BACKGROUND_SIGNING_ANDROID.md` for Android details.

## App icon

- Adaptive foreground icon uses the transparent Frostr mark (`assets/images/adaptive-icon.png`).
- Adaptive background color stays `#041b25` (configured in `app.json` and Android `iconBackground` color).
- Legacy and round launcher icons use the solid-background Frostr logo (`assets/images/icon.png` and generated `mipmap-*/ic_launcher*.webp`).
- Do not pre-round or mask source assets; Android launcher applies shape masks.

## Run it

```bash
bun install
bun start
```

Then press `i` for iOS simulator or `a` for Android emulator.

For full native background-signing behavior, use development builds:
- `bun run android`
- `bun run ios`
