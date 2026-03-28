import React from 'react';
import { Tabs } from 'expo-router';
import { Shirt, Sparkles, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#000', // Şık bir siyah
      headerShown: true,
      headerTitleStyle: { fontWeight: 'bold' } 
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Kombin Doktoru',
          tabBarIcon: ({ color }) => <Sparkles size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Gardırobum',
          tabBarIcon: ({ color }) => <Shirt size={24} color={color} />,
        }}
      />
      {/* İleride Profil ekranı eklemek isterseniz hazır dursun */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}