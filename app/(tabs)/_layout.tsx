import { Tabs, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
          paddingHorizontal: 20,
          marginHorizontal: 16,
          marginBottom: 16,
          borderRadius: 25,
          position: 'absolute',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: theme.colors.background,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/settings')}
              style={{ marginRight: 16 }}
            >
              <Ionicons 
                name="settings" 
                size={24} 
                color={theme.colors.textSecondary} 
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food Log',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/')}
              style={{ marginRight: 16 }}
            >
              <Ionicons 
                name="arrow-back" 
                size={24} 
                color={theme.colors.textSecondary} 
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="water"
        options={{
          title: 'Water',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="water-outline" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/')}
              style={{ marginRight: 16 }}
            >
              <Ionicons 
                name="arrow-back" 
                size={24} 
                color={theme.colors.textSecondary} 
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="food-analysis"
        options={{
          title: 'AI Analysis',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/')}
              style={{ marginRight: 16 }}
            >
              <Ionicons 
                name="arrow-back" 
                size={24} 
                color={theme.colors.textSecondary} 
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/')}
              style={{ marginRight: 16 }}
            >
              <Ionicons 
                name="arrow-back" 
                size={24} 
                color={theme.colors.textSecondary} 
              />
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}