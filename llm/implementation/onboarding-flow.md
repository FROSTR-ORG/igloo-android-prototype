# Onboarding Flow Implementation

## Overview

The onboarding flow guides users through importing their FROST credentials (bfshare + bfgroup). It supports two input methods:
1. **QR Code Scanning** - Two-step scan (share first, then group)
2. **Manual Entry** - Text input with paste support

After successful credential import, an echo signal is sent to notify the group.

---

## Navigation Structure

```
app/
├── _layout.tsx              # Root layout with conditional routing
└── onboarding/
    ├── _layout.tsx          # Stack navigator for onboarding
    ├── index.tsx            # Welcome screen
    ├── howto.tsx            # How to Get Started (info + prerequisites)
    ├── scan.tsx             # QR scanner (two-step)
    └── manual.tsx           # Manual text input
```

**Navigation Flow:**
```
Welcome (index.tsx)  →  How to Get Started (howto.tsx)  →  Scan/Manual
   [Get Started]           [Scan QR] / [Enter Manually]
```

---

## Conditional Routing

**Location:** `app/_layout.tsx`

The root layout determines initial route based on credential state:

```typescript
function RootLayoutNav() {
  const hasCredentials = useCredentialStore((s) => s.hasCredentials);
  const isHydrated = useCredentialStore((s) => s.isHydrated);
  const hydrateFromStorage = useCredentialStore((s) => s.hydrateFromStorage);
  const [isReady, setIsReady] = useState(false);

  // Initialize IglooService event listeners
  useIgloo();

  // Hydrate credential state on mount
  useEffect(() => {
    async function prepare() {
      await hydrateFromStorage();
      setIsReady(true);
    }
    prepare();
  }, []);

  // Navigate based on credentials
  useEffect(() => {
    if (!isReady || !isHydrated) return;
    if (!hasCredentials) {
      router.replace('/onboarding');
    }
  }, [isReady, isHydrated, hasCredentials]);

  // Don't render until we know credential state
  if (!isReady || !isHydrated) return null;

  return (
    <Stack>
      {hasCredentials ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="onboarding" />
      )}
    </Stack>
  );
}
```

**Flow:**
1. App starts → splash screen shown
2. `hydrateFromStorage()` checks SecureStore for credentials
3. `isHydrated` set to true
4. If no credentials → navigate to `/onboarding`
5. If credentials exist → show `(tabs)` layout

---

## Welcome Screen

**Location:** `app/onboarding/index.tsx`

Simple welcome screen introducing Igloo with a single "Get Started" button:

```typescript
export default function OnboardingWelcome() {
  return (
    <SafeAreaView>
      {/* Header with Igloo branding */}
      <View className="items-center mb-12">
        <Snowflake size={48} color="#60a5fa" />
        <Text className="text-3xl font-bold">Welcome to Igloo</Text>
        <Text>FROST threshold signing for Nostr</Text>
      </View>

      {/* Feature highlights */}
      <FeatureItem Icon={Shield} title="Secure Storage" ... />
      <FeatureItem Icon={Users} title="Peer Signing" ... />
      <FeatureItem Icon={Lock} title="Threshold Security" ... />

      {/* Single action button */}
      <Button
        title="Get Started"
        icon={<ArrowRight />}
        onPress={() => router.push('/onboarding/howto')}
      />
    </SafeAreaView>
  );
}
```

---

## How to Get Started Screen

**Location:** `app/onboarding/howto.tsx`

Informational page explaining how Igloo works, current limitations, and prerequisites:

### Content Sections

1. **Header** - Radio icon with "How Igloo Works" title
2. **About box** (info Alert) - Explains threshold signatures and key splitting
3. **Beta notice** (info Alert) - Clarifies this is a background signer only
4. **Before You Start** (warning Alert) - Lists prerequisites (FROSTR keyset)
5. **External links** - Links to get FROSTR credentials:
   - Igloo Desktop (GitHub releases)
   - Igloo CLI (npm)
   - FROSTR Apps (frostr.org)
6. **Action buttons** - "Scan QR Code" and "Enter Manually"

```typescript
export default function OnboardingHowto() {
  return (
    <SafeAreaView>
      {/* Back button */}
      <Pressable onPress={() => router.back()}>
        <ArrowLeft />
      </Pressable>

      {/* Header */}
      <View>
        <Radio size={40} />
        <Text>How Igloo Works</Text>
        <Text>Your phone as a threshold signing node</Text>
      </View>

      {/* Info alerts */}
      <Alert variant="info">About threshold signatures...</Alert>
      <Alert variant="info" title="Currently in Beta">Background signer only...</Alert>
      <Alert variant="warning" title="Before You Start">Need FROSTR keyset...</Alert>

      {/* External links */}
      <View className="flex-row flex-wrap gap-2">
        {EXTERNAL_LINKS.map((link) => (
          <Pressable onPress={() => Linking.openURL(link.url)}>
            <ExternalLink />
            <Text>{link.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Action buttons */}
      <Button title="Scan QR Code" onPress={() => router.push('/onboarding/scan')} />
      <Button title="Enter Manually" variant="secondary" onPress={() => router.push('/onboarding/manual')} />
    </SafeAreaView>
  );
}
```

---

## QR Scanner

**Location:** `app/onboarding/scan.tsx`

Two-step QR scanning flow using `expo-camera`.

### Camera Permission Handling

```typescript
const [permission, requestPermission] = useCameraPermissions();

// Loading state
if (!permission) {
  return <Text>Requesting camera permission...</Text>;
}

// Permission denied
if (!permission.granted) {
  return (
    <View>
      <Text>Camera Access Required</Text>
      <Button title="Grant Permission" onPress={requestPermission} />
    </View>
  );
}
```

### Two-Step Scan Flow

```typescript
type ScanStep = 'share' | 'group';

const [scanStep, setScanStep] = useState<ScanStep>('share');
const [shareCredential, setShareCredential] = useState<string | null>(null);
const [isProcessing, setIsProcessing] = useState(false);

const handleBarCodeScanned = async ({ data }: { data: string }) => {
  if (isProcessing) return;

  const trimmedData = data.trim();

  if (scanStep === 'share') {
    // Step 1: Scan share credential
    if (!trimmedData.startsWith('bfshare')) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid QR Code', 'Please scan a valid share credential (bfshare)');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShareCredential(trimmedData);
    setScanStep('group');  // Move to step 2
  } else {
    // Step 2: Scan group credential
    if (!trimmedData.startsWith('bfgroup')) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid QR Code', 'Please scan a valid group credential (bfgroup)');
      return;
    }

    setIsProcessing(true);

    // Validate both credentials together
    const validation = validate(shareCredential!, trimmedData);
    if (!validation.isValid) {
      Alert.alert('Invalid Credentials', validation.shareError || validation.groupError);
      setIsProcessing(false);
      return;
    }

    // Save and complete
    const result = await saveCredentials(shareCredential!, trimmedData);
    router.replace('/(tabs)/signer');
  }
};
```

### Camera View with Overlay

```typescript
<CameraView
  className="flex-1"
  facing="back"
  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
  onBarcodeScanned={isProcessing ? undefined : handleBarCodeScanned}
>
  {/* Header with step indicator */}
  <Badge label={scanStep === 'share' ? 'Step 1/2' : 'Step 2/2'} />

  {/* Scanner frame with corner markers */}
  <View className="w-64 h-64">
    <View className="border-t-4 border-l-4 border-white" /> {/* TL */}
    <View className="border-t-4 border-r-4 border-white" /> {/* TR */}
    <View className="border-b-4 border-l-4 border-white" /> {/* BL */}
    <View className="border-b-4 border-r-4 border-white" /> {/* BR */}
  </View>

  {/* Instructions */}
  <View>
    {scanStep === 'share' ? (
      <Text>Scan Share Credential</Text>
    ) : (
      <Text>Scan Group Credential</Text>
    )}

    {shareCredential && (
      <Badge label="Share credential captured" variant="success" />
    )}
  </View>
</CameraView>
```

---

## Manual Entry

**Location:** `app/onboarding/manual.tsx`

Text-based credential input with validation.

### State Management

```typescript
const [shareCredential, setShareCredential] = useState('');
const [groupCredential, setGroupCredential] = useState('');
const [shareError, setShareError] = useState<string>();
const [groupError, setGroupError] = useState<string>();
const [isLoading, setIsLoading] = useState(false);

const { validate, saveCredentials } = useCredentials();
```

### Validation Logic

```typescript
const validateInputs = () => {
  let hasError = false;
  setShareError(undefined);
  setGroupError(undefined);

  // Basic format checks
  if (!shareCredential.trim()) {
    setShareError('Share credential is required');
    hasError = true;
  } else if (!shareCredential.trim().startsWith('bfshare')) {
    setShareError('Must be a valid bfshare credential');
    hasError = true;
  }

  if (!groupCredential.trim()) {
    setGroupError('Group credential is required');
    hasError = true;
  } else if (!groupCredential.trim().startsWith('bfgroup')) {
    setGroupError('Must be a valid bfgroup credential');
    hasError = true;
  }

  // Full validation via igloo-core
  if (!hasError) {
    const validation = validate(shareCredential.trim(), groupCredential.trim());
    if (!validation.shareValid) {
      setShareError(validation.shareError || 'Invalid share credential');
      hasError = true;
    }
    if (!validation.groupValid) {
      setGroupError(validation.groupError || 'Invalid group credential');
      hasError = true;
    }
  }

  return !hasError;
};
```

### Paste Support

```typescript
const handlePaste = async (field: 'share' | 'group') => {
  const text = await Clipboard.getStringAsync();
  if (text) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (field === 'share') {
      setShareCredential(text.trim());
      setShareError(undefined);
    } else {
      setGroupCredential(text.trim());
      setGroupError(undefined);
    }
  }
};
```

### Submit Handler

```typescript
const handleSubmit = async () => {
  if (!validateInputs()) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return;
  }

  setIsLoading(true);

  try {
    const result = await saveCredentials(
      shareCredential.trim(),
      groupCredential.trim()
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (result.echoSent) {
      Alert.alert('Success', 'Credentials saved and echo sent!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/signer') },
      ]);
    } else {
      Alert.alert('Credentials Saved', 'Echo could not be sent but you can still use the signer.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/signer') },
      ]);
    }
  } catch (error) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Error', error.message);
  } finally {
    setIsLoading(false);
  }
};
```

### Input Fields

```typescript
<View>
  <View className="flex-row justify-between">
    <Text>Share Credential</Text>
    <Pressable onPress={() => handlePaste('share')}>
      <FontAwesome name="clipboard" />
      <Text>Paste</Text>
    </Pressable>
  </View>
  <Input
    placeholder="bfshare1..."
    value={shareCredential}
    onChangeText={(text) => {
      setShareCredential(text);
      setShareError(undefined);
    }}
    error={shareError}
    multiline
    numberOfLines={4}
    autoCapitalize="none"
    autoCorrect={false}
  />
</View>
```

---

## Echo Signal

When credentials are saved successfully, `useCredentials.saveCredentials()` sends an echo:

```typescript
// In useCredentials hook
const saveCredentials = async (share, group) => {
  // ... validation and save ...

  // Send echo signal (non-blocking)
  let echoSuccess = false;
  try {
    // Generate hex challenge: 32 bytes → 64 hex chars
    const challenge = generateHexChallenge(32);
    echoSuccess = await sendEcho(challenge, relays, group, share);
    setEchoSent(echoSuccess);
  } catch (error) {
    console.warn('Echo failed:', error);
    // Continue even if echo fails
  }

  setOnboardingComplete(true);
  return { success: true, echoSent: echoSuccess };
};
```

### Challenge Requirements

The `sendEcho()` function from igloo-core requires the challenge to be:
- A **string** (not null/undefined)
- **Non-empty** after trimming
- **Even length** (length % 2 === 0)
- **Hexadecimal only** (regex: `/^[0-9a-fA-F]+$/`)

The `generateHexChallenge()` helper generates cryptographically secure random bytes and converts them to hex:

```typescript
function generateHexChallenge(byteLength: number = 32): string {
  const bytes = new Uint8Array(byteLength);
  getRandomValues(bytes);  // from expo-crypto
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

32 bytes produces a 64-character hex string, which is the recommended length per igloo-core docs.

The echo uses `sendEcho()` from igloo-core:

```typescript
// In IglooService
async sendEchoSignal(
  challenge: string,
  relays: string[],
  groupCredential?: string,
  shareCredential?: string
): Promise<boolean> {
  const result = await sendEcho(group, share, challenge, {
    relays,
    timeout: 10000,
  });
  return result;
}
```

---

## Expo Router Type Issues

Expo Router's typed routes don't recognize dynamically added routes like `/onboarding`. The workaround uses type casting:

```typescript
// Suppress TypeScript error for unrecognized route
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.push('/onboarding/scan' as any);
```

This is a known limitation with Expo Router's `typedRoutes` experiment when routes are conditionally rendered.

---

## Dependencies

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
```

**app.json plugins:**
```json
{
  "plugins": [
    [
      "expo-camera",
      {
        "cameraPermission": "Allow Igloo to scan QR codes for importing credentials"
      }
    ],
    "expo-secure-store"
  ]
}
```

---

## User Flow Diagram

```
┌─────────────────────┐
│   App Launch        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Hydrate Credentials│
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐  ┌─────────┐
│ Has     │  │ No      │
│ Creds   │  │ Creds   │
└────┬────┘  └────┬────┘
     │            │
     ▼            ▼
┌─────────┐  ┌─────────────┐
│ (tabs)  │  │ Onboarding  │
│ Signer  │  │ Welcome     │
└─────────┘  └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │ How to Get  │
             │ Started     │
             └──────┬──────┘
                    │
          ┌────────┴────────┐
          ▼                 ▼
    ┌──────────┐      ┌──────────┐
    │ QR Scan  │      │ Manual   │
    │ (2-step) │      │ Entry    │
    └────┬─────┘      └────┬─────┘
         │                 │
         └────────┬────────┘
                  ▼
         ┌───────────────┐
         │ Validate +    │
         │ Save Creds    │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Send Echo     │
         │ (optional)    │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Navigate to   │
         │ (tabs)/signer │
         └───────────────┘
```
