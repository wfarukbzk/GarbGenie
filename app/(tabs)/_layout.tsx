import { Tabs } from 'expo-router';
import { Home, Shirt, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#000', 
      headerShown: false,
      tabBarStyle: { height: 60, paddingBottom: 10 }
    }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Dolabım',
          tabBarIcon: ({ color }) => <Shirt size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
      {/* Modal'ı navigasyondan gizliyoruz kanka */}
      <Tabs.Screen name="modal" options={{ href: null }} />
    </Tabs>
  );
}