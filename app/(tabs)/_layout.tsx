import { Tabs } from 'expo-router';
import { Key, Users, List, Settings } from 'lucide-react-native';

import Colors from '@/constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabIconSelected,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors.tabBackground,
          borderTopColor: Colors.border,
        },
        headerStyle: {
          backgroundColor: Colors.backgroundSecondary,
        },
        headerTintColor: Colors.text,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hide from tab bar - only used for redirect
        }}
      />
      <Tabs.Screen
        name="signer"
        options={{
          title: 'Signer',
          tabBarIcon: ({ color }) => <Key size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Peers',
          tabBarIcon: ({ color }) => <Users size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Logs',
          tabBarIcon: ({ color }) => <List size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={22} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
