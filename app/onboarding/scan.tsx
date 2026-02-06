import { Badge, Button } from '@/components/ui';
import { useCredentials } from '@/hooks';
import { Camera, ArrowLeft, Check, Users, Key } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Timer functions available in React Native - declare for TypeScript
declare const setTimeout: (callback: () => void, delay: number) => number;
declare const clearTimeout: (id: number) => void;

type ScanStep = 'group' | 'transition' | 'share';

export default function OnboardingScan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanStep, setScanStep] = useState<ScanStep>('group');
  const [groupCredential, setGroupCredential] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { validate, saveCredentials } = useCredentials();

  // Cooldown to prevent rapid re-scans
  const lastScanTime = useRef<number>(0);
  const SCAN_COOLDOWN = 1500; // 1.5 seconds between scans

  // Animation for error message
  const errorOpacity = useMemo(() => new Animated.Value(0), []);

  // Animation for transition overlay
  const transitionOpacity = useMemo(() => new Animated.Value(0), []);
  const transitionScale = useMemo(() => new Animated.Value(0.8), []);

  // Refs to track timeouts for cleanup
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show error with auto-dismiss
  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    // Clear any existing timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    // Fade in
    Animated.timing(errorOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Auto dismiss after 2.5 seconds
    errorTimeoutRef.current = setTimeout(() => {
      Animated.timing(errorOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setErrorMessage(null));
    }, 2500);
  }, [errorOpacity]);

  // Show transition overlay then move to share step
  const showTransition = useCallback(() => {
    setScanStep('transition');

    // Clear any existing timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Animate in
    Animated.parallel([
      Animated.timing(transitionOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(transitionScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // After delay, fade out and move to share step
    transitionTimeoutRef.current = setTimeout(() => {
      Animated.timing(transitionOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        transitionScale.setValue(0.8);
        setScanStep('share');
      });
    }, 1500);
  }, [transitionOpacity, transitionScale]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (isProcessing || scanStep === 'transition') return;

    // Cooldown check
    const now = Date.now();
    if (now - lastScanTime.current < SCAN_COOLDOWN) return;
    lastScanTime.current = now;

    const trimmedData = data.trim();

    if (scanStep === 'group') {
      // Silently ignore non-group QR codes
      if (!trimmedData.startsWith('bfgroup')) {
        showError('Looking for group credential (bfgroup)');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGroupCredential(trimmedData);
      showTransition();
    } else if (scanStep === 'share') {
      // Silently ignore non-share QR codes
      if (!trimmedData.startsWith('bfshare')) {
        showError('Looking for share credential (bfshare)');
        return;
      }

      setIsProcessing(true);

      // Validate both credentials together
      const validation = validate(trimmedData, groupCredential!);
      if (!validation.isValid) {
        const errorMsg = validation.shareError || validation.groupError || 'Credentials are invalid';
        showError(errorMsg);
        setIsProcessing(false);
        return;
      }

      // Save credentials and send echo
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const result = await saveCredentials(trimmedData, groupCredential!);

        if (result.echoSent) {
          Alert.alert('Success', 'Credentials saved and echo sent to your group!', [
            { text: 'OK', onPress: () => router.replace('/(tabs)/signer') },
          ]);
        } else {
          Alert.alert(
            'Credentials Saved',
            'Your credentials were saved but echo could not be sent. You can still use the signer.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/signer') }]
          );
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to save credentials');
        setIsProcessing(false);
      }
    }
  }, [scanStep, groupCredential, isProcessing, validate, saveCredentials, showError, showTransition]);

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-gray-950 items-center justify-center">
        <Text className="text-gray-100">Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-gray-950">
        <View className="flex-1 px-6 items-center justify-center">
          <Camera size={48} color="#9ca3af" strokeWidth={1.5} />
          <Text className="text-lg font-semibold text-gray-100 mt-4 mb-2">
            Camera Access Required
          </Text>
          <Text className="text-base text-gray-400 text-center mb-6">
            We need camera access to scan QR codes containing your credentials.
          </Text>
          <Button title="Grant Permission" onPress={requestPermission} />
          <Pressable onPress={() => router.back()} className="mt-4 py-2">
            <Text className="text-blue-400">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={isProcessing ? undefined : handleBarCodeScanned}
      />

      {/* Header Overlay - absolutely positioned on top of camera */}
      <SafeAreaView className="absolute top-0 left-0 right-0" pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
          >
            <ArrowLeft size={18} color="white" strokeWidth={2} />
          </Pressable>
          <Badge
            label={scanStep === 'share' ? 'Step 2/2' : 'Step 1/2'}
            variant="info"
            size="md"
          />
          <View className="w-10" />
        </View>
      </SafeAreaView>

      {/* Scanner Frame - absolutely positioned on top of camera */}
      {scanStep !== 'transition' && (
        <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center" pointerEvents="none">
          <View className="w-64 h-64 relative">
            {/* Corner markers */}
            <View className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <View className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <View className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <View className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-lg" />
          </View>
        </View>
      )}

      {/* Transition Overlay - shown between group and share scans */}
      {scanStep === 'transition' && (
        <Animated.View
          style={{
            opacity: transitionOpacity,
            transform: [{ scale: transitionScale }],
          }}
          className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center bg-black/80"
        >
          <View className="items-center px-8">
            <View className="w-20 h-20 rounded-full bg-green-500 items-center justify-center mb-6">
              <Check size={40} color="white" strokeWidth={2} />
            </View>
            <Text className="text-2xl font-bold text-white text-center mb-2">
              Group Credential Captured!
            </Text>
            <Text className="text-gray-300 text-center text-base">
              Now scan your share credential to complete setup
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Bottom Overlay - absolutely positioned on top of camera */}
      {scanStep !== 'transition' && (
      <View className="absolute bottom-0 left-0 right-0 bg-black/70 px-6 pt-6 pb-12">
        <View className="items-center">
          {scanStep === 'group' ? (
            <>
              <Users size={24} color="#60a5fa" strokeWidth={2} />
              <Text className="text-xl font-semibold text-white mt-2">
                Scan Group Credential
              </Text>
              <Text className="text-gray-400 text-center mt-1">
                Point your camera at the QR code containing your bfgroup
              </Text>
            </>
          ) : (
            <>
              <Key size={24} color="#60a5fa" strokeWidth={2} />
              <Text className="text-xl font-semibold text-white mt-2">
                Scan Share Credential
              </Text>
              <Text className="text-gray-400 text-center mt-1">
                Now scan the QR code containing your bfshare
              </Text>
            </>
          )}

          {scanStep === 'share' && groupCredential && (
            <View className="mt-4 bg-green-900/30 px-3 py-1.5 rounded-full">
              <Text className="text-green-400 text-sm">
                Group credential captured
              </Text>
            </View>
          )}

          {errorMessage && (
            <Animated.View
              style={{ opacity: errorOpacity }}
              className="mt-4 bg-red-900/50 px-4 py-2 rounded-lg"
            >
              <Text className="text-red-300 text-sm text-center">{errorMessage}</Text>
            </Animated.View>
          )}
        </View>

        <Pressable
          onPress={() => router.push('/onboarding/manual')}
          className="mt-6 py-2"
        >
          <Text className="text-blue-400 text-center">
            Having trouble? Enter manually
          </Text>
        </Pressable>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
});
