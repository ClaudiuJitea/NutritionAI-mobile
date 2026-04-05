import { Tabs, router } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { theme } from '../../src/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomOffset = Platform.OS === 'android'
    ? Math.max(insets.bottom, 18)
    : Math.max(insets.bottom, 10);
  const headerTopInset = Math.max(insets.top, 8);
  const HeaderAction = ({
    icon,
    onPress,
    accent = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    accent?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.headerAction, accent ? styles.headerActionAccent : null]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={accent ? theme.colors.primary : theme.colors.text}
      />
    </TouchableOpacity>
  );
  const AppHeader = ({
    title,
    showBack = false,
  }: {
    title: string;
    showBack?: boolean;
  }) => (
    <View style={[styles.headerShell, { paddingTop: headerTopInset }]}>
      <View style={styles.headerBar}>
        <View style={styles.headerSide}>
          {showBack ? (
            <HeaderAction icon="chevron-back" onPress={() => router.push('/(tabs)/')} accent />
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.customHeaderTitle}>{title}</Text>
        </View>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <HeaderAction icon="settings-sharp" onPress={() => router.push('/settings')} />
        </View>
      </View>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: 'rgba(33, 37, 51, 0.96)',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          height: 74,
          paddingBottom: 10,
          paddingTop: 9,
          paddingHorizontal: 10,
          marginHorizontal: 18,
          bottom: bottomOffset,
          borderRadius: 28,
          position: 'absolute',
          borderWidth: 1,
          borderColor: theme.colors.border,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.22,
          shadowRadius: 18,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        header: ({ options, route }) => (
          <AppHeader
            title={options.title ?? route.name}
            showBack={route.name === 'food-analysis'}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food Log',
          tabBarLabel: 'Food',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="water"
        options={{
          title: 'Water',
          tabBarLabel: 'Water',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="water-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="food-analysis"
        options={{
          title: 'AI Analysis',
          tabBarLabel: 'Analyze',
          tabBarStyle: {
            display: 'none',
          },
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarLabel: 'Stats',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    width: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  customHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerActionAccent: {
    backgroundColor: 'rgba(18, 214, 176, 0.10)',
    borderColor: 'rgba(18, 214, 176, 0.22)',
  },
});
