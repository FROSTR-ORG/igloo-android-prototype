# iOS Development Guide

This guide covers three ways to run the Igloo app during development:

| Method | Use Case | Native Modules | Speed |
|--------|----------|----------------|-------|
| [Expo Go](#expo-go) | Quick UI iteration | No | Fastest startup |
| [Simulator](#ios-simulator) | Full testing with native code | Yes | Fast |
| [Physical Device](#physical-device) | Real-world testing, background audio | Yes | Requires build |

---

## Expo Go

### What is Expo Go?

Expo Go is a pre-built app from the App Store that can run Expo projects without building native code. It's the fastest way to see changes but has limitations.

### When to Use Expo Go

- Rapid UI prototyping and styling
- Testing React components and hooks
- Working on screens that don't need native modules
- Showing demos without building

### When NOT to Use Expo Go

Expo Go **cannot** run this app's full functionality because:
- Background audio requires the native `BackgroundAudioModule`
- The signer won't stay active when backgrounded
- Soundscape features won't work

Use Expo Go only for UI work that doesn't involve the signer.

### Running with Expo Go

#### Step 1: Install Expo Go

Download from the App Store on your iPhone:
- Search "Expo Go" or visit: [Expo Go](https://apps.apple.com/app/expo-go/id982107779)

#### Step 2: Start Development Server

```bash
# From project root
bun start
```

You'll see output like:
```text
› Metro waiting on exp://192.168.1.100:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press s │ switch to development build
› Press i │ open iOS simulator
› Press a │ open Android emulator
› Press w │ open web
› Press r │ reload app
› Press m │ toggle menu
› Press ? │ show all commands
```

#### Step 3: Connect Your Phone

**Option A: QR Code (Recommended)**
1. Open Camera app on your iPhone
2. Point at the QR code in terminal
3. Tap the notification banner to open in Expo Go

**Option B: Manual URL**
1. Open Expo Go app
2. Tap "Enter URL manually"
3. Enter: `exp://YOUR_IP:8081`

#### Step 4: Development

- Changes to JS/TS files hot-reload automatically
- Shake device to open dev menu
- Pull down to refresh

### Expo Go Limitations

| Feature | Works in Expo Go? |
|---------|-------------------|
| UI Components | Yes |
| Navigation | Yes |
| Styling/NativeWind | Yes |
| Zustand stores | Yes |
| Secure Storage | Yes |
| **Background Audio** | **No** |
| **Signer Background Mode** | **No** |
| **Soundscape Features** | **No** |

### Troubleshooting Expo Go

**"Unable to resolve module"**
```bash
bun start --clear
```

**Connection timeout**
- Ensure phone and computer are on same WiFi network
- Try: `bun start --tunnel` (uses Expo's servers)

**Metro bundler crash**
```bash
# Kill and restart
pkill -f metro
bun start
```

---

## iOS Simulator

### What is the iOS Simulator?

The iOS Simulator runs a virtual iPhone on your Mac. With a development build, it supports all native modules.

### When to Use Simulator

- Testing full app functionality including native modules
- Debugging with Xcode tools
- Testing different device sizes and iOS versions
- When you don't have a physical device handy

### When NOT to Use Simulator

- Testing true background behavior (simulator doesn't perfectly replicate iOS background suspension)
- Testing audio output quality
- Performance benchmarking
- App Store submission testing

### Prerequisites

1. **Xcode** (from Mac App Store)
2. **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```
3. **CocoaPods**:
   ```bash
   sudo gem install cocoapods
   ```
4. **iOS Simulator** (included with Xcode)

### Building for Simulator

#### First Time Setup

```bash
# Install dependencies
bun install

# Build and run on simulator
npx expo run:ios
```

This will:
1. Generate the `ios/` native project (if needed)
2. Install CocoaPods dependencies
3. Build the app in Xcode
4. Launch the iOS Simulator
5. Install and run the app

First build takes 5-10 minutes. Subsequent builds are faster.

#### Daily Development

```bash
# Start with existing build
npx expo run:ios
```

Or if the dev server is already running:
```bash
# Just press 'i' in the terminal running 'bun start'
```

### Choosing a Simulator

```bash
# List available simulators
xcrun simctl list devices

# Run on specific simulator
npx expo run:ios --device "iPhone 15 Pro"

# Run on specific iOS version
npx expo run:ios --device "iPhone 15 Pro (17.0)"
```

### Simulator Controls

| Action | Shortcut |
|--------|----------|
| Home button | `Cmd + Shift + H` |
| Lock screen | `Cmd + L` |
| Rotate | `Cmd + Left/Right Arrow` |
| Shake (dev menu) | `Cmd + Ctrl + Z` |
| Screenshot | `Cmd + S` |
| Slow animations | `Cmd + T` |

### Debugging in Simulator

#### React Native Debugger
```bash
# Press 'j' in terminal to open debugger
# Or shake device → "Open Debugger"
```

#### Console Logs
View in terminal running `npx expo run:ios` or in Xcode console.

#### Xcode Debugging
1. Open `ios/Igloo.xcworkspace` in Xcode
2. Select your simulator
3. Press Play (or `Cmd + R`)
4. Use Xcode's debugger, profiler, and console

### Rebuilding After Native Changes

If you modify native code (Swift, Objective-C, Podfile):

```bash
# Clean and rebuild
npx expo run:ios
```

Expo CLI detects native changes and rebuilds automatically.

For a complete clean rebuild:
```bash
# Nuclear option - removes all build artifacts
rm -rf ios/build ios/Pods ios/Podfile.lock
npx expo run:ios
```

### Troubleshooting Simulator

**Build fails with signing error**
- For simulator, signing isn't required
- If it persists: Xcode → Preferences → Accounts → Add Apple ID

**Simulator won't launch**
```bash
# Reset simulator
xcrun simctl shutdown all
xcrun simctl erase all
```

**"No bundle URL present"**
```bash
# Restart Metro bundler
bun start --clear
```

**Pod install fails**
```bash
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
cd ..
npx expo run:ios
```

---

## Physical Device

### Why Use a Physical Device?

- **True background testing** - iOS suspends apps differently on real devices
- **Background audio verification** - Hear the actual soundscape output
- **Performance testing** - Real-world speed and battery usage
- **Hardware features** - Haptics, audio routing, etc.

### Prerequisites

1. **Apple Developer Account** (free or paid)
   - Free: Can run on your own devices
   - Paid ($99/year): TestFlight, App Store distribution

2. **Device connected via USB** (first time) or on same WiFi network

3. **Trust the computer** on your device:
   - Connect via USB
   - Tap "Trust" on the device prompt

### Device Setup

#### Step 1: Register Device in Xcode

1. Connect iPhone via USB
2. Open Xcode
3. Go to Window → Devices and Simulators
4. Your device should appear in the left sidebar
5. If prompted, trust the device

#### Step 2: Configure Signing

1. Open `ios/Igloo.xcworkspace` in Xcode
2. Select the "Igloo" project in the navigator
3. Select the "Igloo" target
4. Go to "Signing & Capabilities" tab
5. Check "Automatically manage signing"
6. Select your Team (Apple ID)

If you don't have a team:
- Xcode → Preferences → Accounts → Add Apple ID
- Use your personal Apple ID

### Building for Physical Device

#### Option A: Command Line (Recommended)

```bash
# Build and run on connected device
npx expo run:ios --device

# If multiple devices, select from list
npx expo run:ios --device "John's iPhone"
```

#### Option B: Xcode

1. Open `ios/Igloo.xcworkspace`
2. Select your device from the device dropdown (top of window)
3. Press Play (`Cmd + R`)

### First Run on Device

The first time you run on a device:

1. **Build completes** in terminal/Xcode
2. **App installs** on device
3. **Trust prompt appears** on device:
   - Go to Settings → General → VPN & Device Management
   - Tap your developer certificate
   - Tap "Trust"
4. **Re-run** the app (it should work now)

### Wireless Development

After the first USB connection, you can build wirelessly:

#### Enable Wireless Debugging

1. Connect device via USB
2. Xcode → Window → Devices and Simulators
3. Select your device
4. Check "Connect via network"
5. Disconnect USB cable

Now you can run:
```bash
npx expo run:ios --device "John's iPhone"
```

The device must be on the same WiFi network.

### Testing Background Audio

The physical device is essential for testing background audio:

1. **Start the signer** in the app
2. **Verify audio plays** (ocean waves or selected soundscape)
3. **Press Home button** to background the app
4. **Wait 2+ minutes** - audio should continue
5. **Check Control Center** - should show "Igloo Signer"
6. **Return to app** - signer should still be running

### Testing Volume Controls

1. Start signer
2. Go to Settings tab
3. Test each volume preset (Off, Low, Med, High, Max)
4. Verify audio level changes
5. Test "Off" - audio should be silent but signer stays active

### Debugging on Device

#### Console Logs

**Option A: Xcode Console**
1. Open Xcode
2. Window → Devices and Simulators
3. Select device → Open Console

**Option B: Console.app**
1. Open Console.app on Mac
2. Select your device in sidebar
3. Filter by "Igloo"

#### Remote Debugging

Press `j` in terminal to open React Native debugger, works over network.

### Troubleshooting Device

**"Untrusted Developer"**
- Settings → General → VPN & Device Management
- Tap your certificate → Trust

**"Device is busy"**
- Unplug and replug the device
- Restart Xcode
- Restart the device

**Build succeeds but app won't launch**
- Check device for trust prompt
- Ensure iOS version is supported (15.1+)

**"Could not launch app"**
```bash
# Unlock device and try again
npx expo run:ios --device
```

**Wireless connection lost**
- Ensure same WiFi network
- Re-enable: Xcode → Devices → Check "Connect via network"

**App crashes on launch**
- Check Xcode console for crash logs
- Common cause: Missing provisioning profile

---

## Comparison Matrix

| Feature | Expo Go | Simulator | Physical Device |
|---------|---------|-----------|-----------------|
| Setup time | Instant | 5-10 min first build | 10-15 min first build |
| Iteration speed | Fastest | Fast | Fast (after first build) |
| Native modules | No | Yes | Yes |
| Background audio | No | Partial | **Full** |
| Signer functionality | UI only | Full | Full |
| Soundscapes | No | Yes | Yes |
| True background test | No | Partial | **Yes** |
| Haptics | No | No | Yes |
| Audio output | No | Yes (Mac speakers) | Yes (device speakers) |
| App Store testing | No | No | Yes |

---

## Recommended Workflow

### UI Development
1. Use **Expo Go** for rapid iteration
2. Focus on styling, layout, components
3. Test on simulator for native features

### Feature Development
1. Use **Simulator** for most development
2. Fast iteration with native module support
3. Occasional physical device testing

### Background Audio / Signer Testing
1. Use **Physical Device** for real-world testing
2. Verify background behavior
3. Test audio output and interruptions

### Pre-Release Testing
1. Test on **Physical Device**
2. Multiple iOS versions if possible
3. Test background mode for extended periods
4. Verify battery usage is acceptable

---

## Quick Commands Reference

```bash
# Expo Go (no native modules)
bun start                           # Start server, scan QR with phone

# Simulator
npx expo run:ios                    # Build and run on default simulator
npx expo run:ios --device "iPhone 15 Pro"  # Specific simulator

# Physical Device
npx expo run:ios --device           # Build and run on connected device
npx expo run:ios --device "John's iPhone"  # Specific device

# Rebuild after native changes
npx expo run:ios                    # Detects and rebuilds automatically

# Clean rebuild
rm -rf ios/build ios/Pods ios/Podfile.lock
npx expo run:ios

# Clear Metro cache
bun start --clear
```
