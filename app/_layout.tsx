// Note: crypto polyfill is now handled in index.js entry point
// (must run before ES module imports are evaluated)

// Apply nostr-tools SimplePool shim to fix relay filter errors
// Must run before any signer connections are made
import '@/polyfills/nostr-shim';

import '../global.css';

import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';

// Suppress SafeAreaView deprecation warning from react-navigation internals
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { StatusBar } from 'expo-status-bar';
import { useCredentialStore } from '@/stores';
import { useIgloo } from '@/hooks';
import { secureStorage } from '@/services/storage/secureStorage';
import { audioService } from '@/services/audio';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ShareTechMono: require('../assets/fonts/ShareTechMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const hasCredentials = useCredentialStore((s) => s.hasCredentials);
  const isHydrated = useCredentialStore((s) => s.isHydrated);
  const hydrateFromStorage = useCredentialStore((s) => s.hydrateFromStorage);
  const setShareDetails = useCredentialStore((s) => s.setShareDetails);
  const [isReady, setIsReady] = useState(false);

  // Initialize IglooService event listeners and get the getShareDetails function
  const { getShareDetails } = useIgloo();

  // Pre-initialize audio mode to avoid delay when signer starts
  useEffect(() => {
    audioService.initialize().catch(console.warn);
  }, []);

  // Hydrate credential state from storage on mount
  useEffect(() => {
    async function prepare() {
      await hydrateFromStorage();
      setIsReady(true);
    }
    prepare();
  }, [hydrateFromStorage]);

  // Refresh shareDetails after hydration to ensure we have the latest calculated values
  // (fixes stale cached data where totalMembers was undefined)
  useEffect(() => {
    async function refreshShareDetails() {
      if (!isHydrated || !hasCredentials) return;

      try {
        const credentials = await secureStorage.getCredentials();
        if (credentials) {
          const details = getShareDetails(credentials.share, credentials.group);
          if (details) {
            setShareDetails(details);
            console.log('[RootLayout] Refreshed shareDetails:', details);
          } else {
            console.warn('[RootLayout] Failed to decode share details');
          }
        }
      } catch (error) {
        console.warn('[RootLayout] Failed to refresh shareDetails:', error);
      }
    }
    refreshShareDetails();
  }, [isHydrated, hasCredentials, getShareDetails, setShareDetails]);

  // Handle navigation based on credentials
  useEffect(() => {
    if (!isReady || !isHydrated) return;

    // Navigate to appropriate screen based on credential state
    if (!hasCredentials) {
      router.replace('/onboarding');
    }
  }, [isReady, isHydrated, hasCredentials]);

  // Don't render until we know the credential state
  if (!isReady || !isHydrated) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'Not Found' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
