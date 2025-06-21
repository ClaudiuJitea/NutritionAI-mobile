import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseService } from '../src/services/database';
import { theme } from '../src/constants/theme';

const paperTheme = {
  colors: {
    primary: theme.colors.primary,
    background: theme.colors.background,
    surface: theme.colors.surface,
    onSurface: theme.colors.text,
    outline: theme.colors.border,
    surfaceVariant: theme.colors.surfaceVariant,
    onSurfaceVariant: theme.colors.textSecondary,
    error: theme.colors.error,
    onError: '#FFFFFF',
    errorContainer: theme.colors.error + '20',
    onErrorContainer: theme.colors.error,
    primaryContainer: theme.colors.primary + '20',
    onPrimaryContainer: theme.colors.primary,
    secondary: theme.colors.textSecondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: theme.colors.textSecondary + '20',
    onSecondaryContainer: theme.colors.textSecondary,
    tertiary: theme.colors.primary,
    onTertiary: '#FFFFFF',
    tertiaryContainer: theme.colors.primary + '20',
    onTertiaryContainer: theme.colors.primary,
    inverseSurface: theme.colors.text,
    inverseOnSurface: theme.colors.background,
    inversePrimary: theme.colors.primary,
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.4)',
    elevation: {
      level0: theme.colors.elevation.level0,
      level1: theme.colors.elevation.level1,
      level2: theme.colors.elevation.level2,
      level3: theme.colors.elevation.level3,
      level4: theme.colors.elevation.level4,
      level5: theme.colors.elevation.level5,
    },
  },
  dark: true,
  version: 3 as const,
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <SQLiteProvider
          databaseName="nutritionai.db"
          onInit={async (db) => {
            const dbService = new DatabaseService(db);
            await dbService.initializeDatabase();
          }}
        >
          <StatusBar style="light" backgroundColor={theme.colors.background} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: theme.colors.background,
              },
              headerTintColor: theme.colors.text,
              headerTitleStyle: {
                fontWeight: 'bold',
              },
              contentStyle: {
                backgroundColor: theme.colors.background,
              },
            }}
          >
            <Stack.Screen 
              name="index" 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="onboarding" 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="(tabs)" 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="manual-food-entry" 
              options={{ 
                title: 'Add Food',
                presentation: 'modal'
              }} 
            />
            <Stack.Screen 
              name="settings" 
              options={{ 
                title: 'Settings',
                presentation: 'modal'
              }} 
            />
          </Stack>
        </SQLiteProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}