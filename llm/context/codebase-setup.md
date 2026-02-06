# Igloo iOS - Codebase Context

## Overview

**Igloo iOS** is a mobile prototype application for [Frostr](https://frostr.org), implementing FROST (Flexible Round-Optimized Schnorr Threshold) threshold signing for the Nostr protocol.

### What is Frostr?

Frostr enables threshold cryptography for Nostr:

- **Shamir Secret Sharing** - Splits nsec (Nostr secret keys) into shares distributed across multiple devices
- **FROST Protocol** - Coordinates signing of messages between key share holders
- **Nostr Relay Communication** - Nodes communicate over the Nostr network using end-to-end encrypted notes

This allows k-of-n multi-signature setups while maintaining the user's original npub identity.

---

## Project Structure

```
igloo-ios/
├── app/                      # Expo Router - file-based routing
│   ├── _layout.tsx           # Root layout (credential routing, theme)
│   ├── (tabs)/               # Tab navigator group
│   │   ├── _layout.tsx       # Tab bar configuration
│   │   ├── signer.tsx        # Start/stop signer, status, stats
│   │   ├── sessions.tsx      # Peer list, ping, policy management
│   │   ├── logs.tsx          # Verbose event log with filtering
│   │   └── settings.tsx      # Relay config, credential info
│   ├── onboarding/           # Credential import flow
│   │   ├── _layout.tsx       # Stack navigator
│   │   ├── index.tsx         # Welcome screen
│   │   ├── scan.tsx          # QR code scanner (two-step)
│   │   └── manual.tsx        # Manual text input
│   ├── +html.tsx             # Web HTML template
│   └── +not-found.tsx        # 404 fallback
│
├── services/                 # Core services
│   ├── igloo/
│   │   ├── index.ts          # Barrel export
│   │   ├── IglooService.ts   # EventEmitter wrapping igloo-core
│   │   └── types.ts          # Service-specific types
│   └── storage/
│       └── secureStorage.ts  # expo-secure-store wrapper
│
├── stores/                   # Zustand state management
│   ├── index.ts              # Barrel export
│   ├── credentialStore.ts    # Credential state + hydration
│   ├── signerStore.ts        # Signer status (ephemeral)
│   ├── peerStore.ts          # Peers + policies (persisted)
│   ├── relayStore.ts         # Relay configuration (persisted)
│   └── logStore.ts           # Event log (in-memory buffer)
│
├── hooks/                    # React hooks
│   ├── index.ts              # Barrel export
│   ├── useIgloo.ts           # Service event bridge
│   ├── useSigner.ts          # Signer control
│   ├── usePeers.ts           # Peer management
│   └── useCredentials.ts     # Credential operations
│
├── types/
│   └── index.ts              # Shared type definitions
│
├── components/               # Reusable React components
│   ├── ui/                   # Generic UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   └── Switch.tsx
│   ├── ExternalLink.tsx
│   ├── useColorScheme.ts
│   └── useClientOnlyValue.ts
│
├── constants/
│   └── Colors.ts             # Light/dark theme colors
│
├── assets/
│   ├── fonts/
│   └── images/
│
├── llm/                      # LLM-focused documentation
│   ├── context/              # Codebase context and overview
│   ├── implementation/       # Implementation details
│   └── workflow/             # Development workflow guides
│
├── scripts/                  # Build/install scripts
│   └── patch-noble-hashes.js # Postinstall patch for @noble/hashes exports
│
├── index.js                  # Custom entry point (crypto polyfill + expo-router)
├── polyfills/                # Runtime polyfills for React Native
│   └── crypto.ts             # Crypto polyfill (legacy - now in index.js)
│
├── Configuration Files:
├── app.json                  # Expo app configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.js        # Tailwind/NativeWind config
├── babel.config.js           # Babel transpiler config
├── metro.config.js           # Metro bundler config
├── eslint.config.js          # ESLint rules
├── .prettierrc               # Code formatting
├── global.css                # Tailwind CSS imports
└── nativewind-env.d.ts       # NativeWind TypeScript types
```

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Expo** | 54.0.31 | React Native framework & tooling |
| **React Native** | 0.81.5 | Cross-platform mobile framework |
| **React** | 19.1.0 | UI component library |
| **TypeScript** | 5.9.2 | Type-safe JavaScript |
| **Expo Router** | 6.0.21 | File-based navigation |
| **NativeWind** | 4.2.1 | Tailwind CSS for React Native |
| **Tailwind CSS** | 3.4.17 | Utility-first CSS framework |
| **Bun** | 1.3+ | Fast JavaScript runtime & package manager |
| **@frostr/igloo-core** | 0.2.4 | FROST threshold signing core library |
| **Zustand** | 5.0.9 | Lightweight state management |
| **@shopify/flash-list** | 2.0.2 | High-performance list (pinned for Expo 54) |

---

## Core Dependencies

### FROST Signing
- `@frostr/igloo-core` - Core library for FROST threshold signing
- `@frostr/bifrost` - Bifrost node for relay communication (peer dep)
- `nostr-tools` - Nostr protocol utilities (peer dep)

### State Management & Storage
- `zustand` - Lightweight state management with persist middleware
- `expo-secure-store` - Encrypted credential storage (Keychain/Keystore)
- `@react-native-async-storage/async-storage` - Persistent non-sensitive storage

### Navigation & Routing
- `expo-router` - File-based routing (like Next.js for React Native)
- `@react-navigation/native` - Navigation primitives

### Styling & UI
- `nativewind` - Tailwind CSS compiler for React Native (primary styling system)
- `tailwindcss` - Utility class definitions
- `@expo/vector-icons` - Icon library (FontAwesome, etc.)

> **Styling pattern**: All screens use `import { View, Text } from 'react-native'` with NativeWind `className` props. Dark mode uses `dark:` variants (e.g., `bg-white dark:bg-gray-900`).

### Expo Utilities
- `expo-font` - Custom font loading
- `expo-splash-screen` - Splash screen management
- `expo-status-bar` - Status bar styling
- `expo-linking` - Deep linking support
- `expo-web-browser` - In-app browser
- `expo-camera` - QR code scanning for credential import
- `expo-clipboard` - Paste support for credentials
- `expo-haptics` - Tactile feedback
- `expo-crypto` - Native crypto for `getRandomValues()` polyfill (required by @noble/hashes)

### Utilities
- `eventemitter3` - Event system for IglooService
- `nanoid` - Unique ID generation

### Animation & Performance
- `react-native-reanimated` - Smooth 60fps animations
- `react-native-screens` - Native screen optimizations
- `react-native-safe-area-context` - Safe area handling
- `@shopify/flash-list` - High-performance list component (use version **2.0.2** for Expo 54 compatibility)

### Platform Support
- `react-native-web` - Web platform support
- `react-dom` - React DOM for web

---

## Configuration Files

### `app.json` - Expo Configuration
Defines app metadata, icons, splash screen, and platform-specific settings:
- App name: "Igloo"
- URL scheme: `igloo://`
- New Architecture enabled
- Typed routes enabled

### `tsconfig.json` - TypeScript
- Extends Expo's base TypeScript config
- Strict mode enabled
- Path alias: `@/*` → root directory

### `tailwind.config.js` - Styling
- Content paths: `app/`, `components/`
- NativeWind preset
- Custom "frost" color palette (brand colors)

### `babel.config.js` - Transpilation
- Expo preset with NativeWind JSX source
- NativeWind babel plugin

### `metro.config.js` - Bundler
- Expo default config
- NativeWind middleware with `global.css` input

### `package.json` - Overrides & Postinstall
- `@noble/hashes` forced to `1.8.0` via `overrides` to dedupe dependencies
- Postinstall script (`scripts/patch-noble-hashes.js`) patches the missing `./crypto.js` export
- Together these fully eliminate the `@noble/hashes` Metro warnings
- See `llm/workflow/development.md` for details on known warnings

### `eslint.config.js` - Linting (ESLint v9 Flat Config)
- Uses ESLint v9's new flat config format (not legacy `.eslintrc`)
- File extensions configured via `files: ['**/*.{ts,tsx}']` (replaces deprecated `--ext` flag)
- TypeScript parser and plugin
- React and React Hooks plugins
- Custom rules: unused vars with `_` prefix allowed, `no-require-imports` disabled

---

## Theming & Colors

### Color Scheme Support
The app supports automatic light/dark mode via:
- `useColorScheme()` hook
- `ThemeProvider` from React Navigation
- NativeWind `dark:` variant classes

### Brand Colors (Frost Palette)
```javascript
frost: {
  50:  '#f0f9ff',  // Lightest
  100: '#e0f2fe',
  200: '#bae6fd',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',  // Primary
  600: '#0284c7',
  700: '#0369a1',
  800: '#075985',
  900: '#0c4a6e',  // Darkest
}
```

### Theme Colors (`constants/Colors.ts`)

> **Note**: Used primarily by tab bar configuration. Screen content styling uses NativeWind `className` with `dark:` variants and the `frost-*` color palette.

```javascript
light: {
  text: '#000',
  background: '#fff',
  tint: '#2f95dc',
  tabIconDefault: '#ccc',
  tabIconSelected: '#2f95dc',
}
dark: {
  text: '#fff',
  background: '#000',
  tint: '#fff',
  tabIconDefault: '#ccc',
  tabIconSelected: '#fff',
}
```

---

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| iOS | Primary | Full support, tablet enabled |
| Android | Supported | Edge-to-edge, adaptive icons |
| Web | Supported | Static output, Metro bundler |

---

## Implemented Features

The app is a functional FROST threshold signer with:

- **Credential Import** - QR scan (two-step) or manual text entry for bfshare/bfgroup
- **Signer Control** - Manual start/stop with status display and session stats
- **Peer Management** - View peers, ping for online status, configure send/receive policies
- **Relay Configuration** - Add/remove relays, reset to defaults
- **Event Logging** - Verbose log with level/category filtering
- **Echo Signal** - Notify group on successful onboarding

> See `llm/implementation/` for detailed documentation on each feature.

---

## Related Projects

- [Igloo Desktop](https://github.com/frostr-org) - Desktop signing application
- [Igloo CLI](https://github.com/frostr-org) - Command-line tool
- [Igloo Web](https://github.com/frostr-org) - Browser-based signer
- [Bifrost](https://github.com/frostr-org) - Reference client implementation
- [Igloo Core](https://github.com/frostr-org) - TypeScript core library
