import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Snowflake,
  Shield,
  Users,
  Lock,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '@/components/ui';

export default function OnboardingWelcome() {
  return (
    <SafeAreaView className="flex-1 bg-gray-950">
      <View className="flex-1 px-6 pt-12 pb-8">
        {/* Header */}
        <View className="items-center mb-12">
          <View className="w-24 h-24 bg-blue-900/30 rounded-full items-center justify-center mb-6">
            <Snowflake size={48} color="#60a5fa" strokeWidth={1.5} />
          </View>
          <Text className="text-3xl font-bold text-gray-100 mb-2">
            Welcome to Igloo
          </Text>
          <Text className="text-lg text-gray-400 text-center">
            FROST threshold signing for Nostr
          </Text>
        </View>

        {/* Description */}
        <View className="mb-12">
          <Text className="text-base text-gray-400 text-center leading-6">
            Igloo turns your device into a secure signing node for distributed key management.
            Import your share to start signing requests from your peers.
          </Text>
        </View>

        {/* Features */}
        <View className="gap-4 mb-auto">
          <FeatureItem
            Icon={Shield}
            title="Secure Storage"
            description="Your credentials are encrypted and stored securely on your device"
          />
          <FeatureItem
            Icon={Users}
            title="Peer Signing"
            description="Respond to signing requests from other key holders in your group"
          />
          <FeatureItem
            Icon={Lock}
            title="Threshold Security"
            description="No single device can sign alone - requires cooperation from peers"
          />
        </View>

        {/* Action */}
        <View className="mt-8">
          <Button
            title="Get Started"
            size="lg"
            icon={<ArrowRight size={20} color="white" strokeWidth={2} />}
            onPress={() => router.push('/onboarding/howto')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-start">
      <View className="w-10 h-10 bg-blue-900/30 rounded-lg items-center justify-center mr-4">
        <Icon size={18} color="#60a5fa" strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-100 mb-0.5">
          {title}
        </Text>
        <Text className="text-sm text-gray-400">
          {description}
        </Text>
      </View>
    </View>
  );
}
