# Igloo iOS - Development Workflow

> **iOS-Specific Guide**: For detailed instructions on running the app with Expo Go, iOS Simulator, or a physical device, see [ios-development.md](./ios-development.md).

## Prerequisites

### Required Tools

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Bun** | 1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| **Watchman** | Latest | `brew install watchman` (macOS) |

### For iOS Development

| Tool | Notes |
|------|-------|
| **Xcode** | Install from Mac App Store |
| **Xcode CLI Tools** | `xcode-select --install` |
| **iOS Simulator** | Included with Xcode |
| **CocoaPods** | `sudo gem install cocoapods` (for native modules) |

### For Android Development

| Tool | Notes |
|------|-------|
| **Android Studio** | [developer.android.com](https://developer.android.com/studio) |
| **Android SDK** | Install via Android Studio |
| **Android Emulator** | Configure via Android Studio AVD Manager |
| **Java JDK** | OpenJDK 17 recommended |

---

## Getting Started

### 1. Clone & Install

```bash
# Clone the repository
git clone <repository-url>
cd igloo-ios

# Install dependencies with Bun
bun install
```

### 2. Start Development Server

```bash
# Start Expo development server
bun start
```

This opens the Expo Dev Tools in your terminal with options:

```
› Press i │ open iOS simulator
› Press a │ open Android emulator
› Press w │ open web browser
› Press r │ reload app
› Press m │ toggle menu
› Press ? │ show all commands
```

### 3. Run on Specific Platform

```bash
# iOS Simulator (development build with native modules)
npx expo run:ios

# Android Emulator
bun run android

# Web Browser
bun run web
```

> **Important**: This app includes custom native modules (BackgroundAudioModule for background signer operation). Use `npx expo run:ios` for full functionality. Expo Go only works for UI prototyping. See [ios-development.md](./ios-development.md) for details.

---

## Development Server

### Expo Dev Server Commands

| Key | Action |
|-----|--------|
| `i` | Open iOS Simulator |
| `a` | Open Android Emulator |
| `w` | Open in Web Browser |
| `r` | Reload the app |
| `m` | Toggle dev menu |
| `j` | Open debugger |
| `o` | Open project in editor |
| `?` | Show all commands |

### Connection Options

The dev server can connect via:
- **LAN** - Device on same network (default)
- **Tunnel** - Through Expo's servers (for remote testing)
- **Localhost** - Simulator/emulator only

Toggle with: `bun start --tunnel` or `bun start --localhost`

---

## Hot Reloading

### Fast Refresh

Expo supports Fast Refresh out of the box:
- **Component changes** - Instantly reflected without losing state
- **Hook changes** - May trigger full reload
- **Module changes** - Full reload

### Preserving State

To preserve component state during Fast Refresh, ensure:
- Components are named (not anonymous)
- Only component code in component files
- No side effects at module level

### Manual Reload

If hot reload fails:
- Press `r` in terminal
- Shake device → "Reload"
- iOS: `Cmd+R` in Simulator
- Android: `Cmd+M` → "Reload"

---

## Code Quality Tools

### TypeScript Type Checking

```bash
# Run TypeScript compiler (no emit)
bunx tsc --noEmit

# Watch mode
bunx tsc --noEmit --watch
```

### ESLint

This project uses **ESLint v9** with the new **flat config** format (`eslint.config.js`).

```bash
# Run linter
bun run lint

# Lint specific files
bunx eslint app/
bunx eslint "**/*.tsx"
```

**Important**: ESLint v9 removed the `--ext` CLI flag. File extensions are now configured directly in `eslint.config.js` via the `files` property. The flat config already specifies `files: ['**/*.{ts,tsx}']`.

ESLint is configured with:
- TypeScript support (`@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`)
- React/React Hooks rules (`eslint-plugin-react`, `eslint-plugin-react-hooks`)
- Custom rules for unused variables (allows `_` prefixed variables)
- `@typescript-eslint/no-require-imports` disabled (for Expo compatibility)

### Prettier

```bash
# Format all files
bun run format

# Check formatting (no write)
bunx prettier --check "**/*.{ts,tsx,js,json}"

# Format specific file
bunx prettier --write app/_layout.tsx
```

Prettier config (`.prettierrc`):
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "bracketSameLine": false
}
```

---

## Project Scripts

All scripts from `package.json`:

```bash
# Development
bun start              # Start Expo dev server
bun run ios            # Run on iOS simulator
bun run android        # Run on Android emulator
bun run web            # Run in web browser

# Code Quality
bun run lint           # Run ESLint
bun run format         # Run Prettier (write)

# Type Checking (manual)
bunx tsc --noEmit      # TypeScript check
```

---

## Debugging

### React DevTools

```bash
# Automatically available in dev mode
# Press 'j' in terminal to open debugger
```

### Console Logging

```typescript
// Basic logging
console.log('Debug:', variable);

// Structured logging
console.log(JSON.stringify(data, null, 2));

// Component debugging
console.log('Rendered:', componentName);
```

View logs in:
- Terminal running dev server
- Browser DevTools (web)
- React Native Debugger
- Expo DevTools

### Network Debugging

Enable network inspection in React Native Debugger or use:
```bash
# Install Reactotron for advanced debugging
bun add -d reactotron-react-native
```

### Error Boundaries

The app includes error boundaries via Expo Router:
```typescript
export { ErrorBoundary } from 'expo-router';
```

---

## Building for Production

### Development Build (Preview)

Create a development build for testing on real devices:

```bash
# Install EAS CLI
bun add -g eas-cli

# Login to Expo
eas login

# Create development build
eas build --profile development --platform ios
eas build --profile development --platform android
```

### Production Build

```bash
# Production build for App Store / Play Store
eas build --profile production --platform ios
eas build --profile production --platform android

# Or build both
eas build --profile production --platform all
```

### Local Builds (Advanced)

For building locally without EAS:

```bash
# Generate native projects
bunx expo prebuild

# iOS (requires Xcode)
cd ios && pod install && cd ..
bunx expo run:ios --configuration Release

# Android (requires Android Studio)
bunx expo run:android --variant release
```

### Web Build

```bash
# Build static web export
bunx expo export --platform web

# Output in /dist folder
```

---

## Environment Variables

### Using Environment Variables

Create `.env` file (add to `.gitignore`):
```
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_RELAY_URL=wss://relay.example.com
```

Access in code:
```typescript
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

Note: Only `EXPO_PUBLIC_*` variables are exposed to the client.

---

## Testing

### Run Tests

```bash
# Run Jest tests
bun test

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

### Test File Location

Tests live alongside components:
```
components/
├── MyComponent.tsx
└── __tests__/
    └── MyComponent-test.tsx
```

---

## Common Issues

### Known Warnings

| Warning | Source | Status |
|---------|--------|--------|
| `@noble/hashes` exports mismatch | `nostr-tools`, `@cmdcode/frost`, `@cmdcode/buff` | **Fixed** via postinstall patch script + bun overrides |
| `SafeAreaView has been deprecated` | `react-navigation` internals | **Suppressed** in app UI via `LogBox.ignoreLogs()`. Still appears in Metro terminal (unavoidable - from dependency internals). |

### Package Version Compatibility

Some packages require specific versions or configuration:

| Package | Version | Config | Notes |
|---------|---------|--------|-------|
| `@shopify/flash-list` | 2.0.2 | `dependencies` | Pinned for Expo 54 compatibility |
| `@noble/hashes` | 1.8.0 | `overrides` | Forces single version across all dependencies |

### Crypto Polyfill

React Native doesn't provide a global `crypto` object, but `@noble/hashes` (used by nostr-tools and igloo-core) requires `crypto.getRandomValues()`. This is fixed via a **custom entry point**:

**Why a custom entry point?**

The `@frostr/bifrost` library bundles its own copy of `@noble/hashes` which captures the `crypto` reference at **module evaluation time**. ES module `import` statements are hoisted, meaning all imports are resolved before any code executes. This makes it impossible to polyfill crypto via a normal import - by the time the polyfill runs, bifrost has already cached `undefined`.

**Solution:**

1. **Custom entry point** (`index.js`) - Uses CommonJS `require()` to set up crypto polyfill synchronously before loading expo-router
2. **expo-crypto** - Provides native crypto implementation via `getRandomValues`

```javascript
// index.js - Custom entry point
const { getRandomValues } = require('expo-crypto');

// Polyfill crypto.getRandomValues on all global objects
function polyfillCrypto(target) {
  if (!target) return;
  if (!target.crypto) {
    target.crypto = {};
  }
  // Always override - RN may have incomplete crypto object
  target.crypto.getRandomValues = getRandomValues;
}

// Apply to all possible global scopes
polyfillCrypto(global);
polyfillCrypto(globalThis);
if (typeof window !== 'undefined') {
  polyfillCrypto(window);
}

// Now load the actual app entry point
require('expo-router/entry');
```

```json
// package.json
{
  "main": "./index.js"  // NOT "expo-router/entry"
}
```

**IMPORTANT**: Do NOT change the entry point back to `expo-router/entry` or the crypto polyfill will fail to apply in time.

Without this polyfill, operations will fail with:
```text
crypto.getRandomValues must be defined
```

### @noble/hashes Patch System

The `@noble/hashes` package has an exports mismatch where dependencies import `./crypto.js` but the package only exports `./crypto`. This is fixed via:

1. **Bun overrides** - Forces all dependencies to use v1.8.0:
   ```json
   {
     "overrides": {
       "@noble/hashes": "1.8.0"
     }
   }
   ```

2. **Postinstall patch script** - Adds the missing `./crypto.js` export:
   ```bash
   # scripts/patch-noble-hashes.js runs automatically on bun install
   "postinstall": "node scripts/patch-noble-hashes.js"
   ```

The patch script (`scripts/patch-noble-hashes.js`) modifies `node_modules/@noble/hashes/package.json` to add the `./crypto.js` export mapping. It's idempotent and won't fail if already patched.

Check compatibility with:
```bash
bunx expo doctor
```

### Metro Bundler Cache

If you experience stale code or strange errors:
```bash
# Clear Metro cache
bun start --clear
# or
bunx expo start -c
```

### Node Modules Issues

```bash
# Remove and reinstall
rm -rf node_modules bun.lock
bun install
```

### iOS Simulator Issues

```bash
# Reset simulator
# Device → Erase All Content and Settings

# Clean Xcode build
cd ios && rm -rf build Pods Podfile.lock
pod install
```

### TypeScript Errors After Changes

```bash
# Restart TypeScript server
# In VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

## Quick Reference

```bash
# Daily Development
bun start                    # Start dev server
bun run ios                  # Run on iOS
bun run lint && bunx tsc     # Check code quality

# Before Committing
bun run format               # Format code
bun run lint                 # Check linting
bunx tsc --noEmit            # Type check

# Troubleshooting
bun start --clear            # Clear cache and start
rm -rf node_modules && bun i # Fresh install
```
