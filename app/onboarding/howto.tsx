import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  ArrowLeft,
  Radio,
  QrCode,
  Keyboard,
  ExternalLink,
} from 'lucide-react-native';
import { Button, Alert } from '@/components/ui';

const EXTERNAL_LINKS = [
  {
    label: 'Igloo Desktop',
    url: 'https://github.com/FROSTR-ORG/igloo-desktop/releases',
  },
  {
    label: 'Igloo CLI',
    url: 'https://www.npmjs.com/package/@frostr/igloo-cli',
  },
  {
    label: 'FROSTR Apps',
    url: 'https://frostr.org/apps',
  },
];

export default function OnboardingHowto() {
  const openUrl = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      {/* Header with back button */}
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center"
        >
          <ArrowLeft size={18} color="white" strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="items-center mb-8 mt-4">
          <View className="w-20 h-20 bg-blue-900/30 rounded-full items-center justify-center mb-4">
            <Radio size={40} color="#60a5fa" strokeWidth={1.5} />
          </View>
          <Text className="text-2xl font-bold text-gray-100 mb-1">
            How Igloo Works
          </Text>
          <Text className="text-base text-gray-400 text-center">
            Your phone as a threshold signing node
          </Text>
        </View>

        {/* About box */}
        <Alert variant="info" className="mb-4">
          <Text className="text-sm text-blue-300 leading-5">
            Igloo turns your phone into a remote signer for your Nostr private
            key using FROSTR threshold signatures. Your private key is split
            into shares, and signing requires multiple shares to cooperate. The
            full key is never reconstructed.
          </Text>
        </Alert>

        {/* Beta notice */}
        <Alert variant="info" title="Currently in Beta" className="mb-4">
          <Text className="text-sm text-blue-300 leading-5">
            This app runs as a background signer that responds to signing
            requests from other nodes in your quorum. It cannot initiate
            signatures yet - only respond when your peers request a signature.
          </Text>
        </Alert>

        {/* Before You Start */}
        <Alert variant="warning" title="Before You Start" className="mb-6">
          <Text className="text-sm text-yellow-300 leading-5">
            You need a FROSTR keyset (group credential + share credential) to
            configure this signer. Generate one using Igloo Desktop or CLI, then
            bring a share here.
          </Text>
        </Alert>

        {/* Demo mode for review */}
        <Alert variant="info" title="App Review Demo Mode" className="mb-6">
          <Text className="text-sm text-blue-300 leading-5">
            If you don't have credentials yet, you can enter demo mode to load
            a review-ready group and share.
          </Text>
        </Alert>

        {/* External links */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-400 mb-3">
            Get FROSTR Credentials
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {EXTERNAL_LINKS.map((link) => (
              <Pressable
                key={link.url}
                onPress={() => openUrl(link.url)}
                className="flex-row items-center bg-gray-800 px-3 py-2 rounded-lg active:bg-gray-700"
              >
                <ExternalLink size={14} color="#9ca3af" strokeWidth={2} />
                <Text className="text-sm text-gray-300 ml-2">{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View className="px-6 pb-8 pt-4 gap-3">
        <Button
          title="Scan QR Code"
          size="lg"
          icon={<QrCode size={20} color="white" strokeWidth={2} />}
          onPress={() => router.push('/onboarding/scan')}
        />
        <Button
          title="Enter Manually"
          variant="secondary"
          size="lg"
          icon={<Keyboard size={20} color="#9ca3af" strokeWidth={2} />}
          onPress={() => router.push('/onboarding/manual')}
        />
        <Button
          title="Enter Demo Mode"
          variant="outline"
          size="lg"
          onPress={() =>
            router.push({
              pathname: '/onboarding/manual',
              params: { demo: '1' },
            })
          }
        />
      </View>
    </SafeAreaView>
  );
}
