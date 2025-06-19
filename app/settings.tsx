import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, TextInput, Button, Switch, Divider } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { DatabaseService } from '../src/services/database';
import { OpenRouterService } from '../src/services/openrouter';
import { User } from '../src/types/database';
import { theme } from '../src/constants/theme';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [dbService] = useState(() => new DatabaseService(db));
  const [openRouterService] = useState(() => new OpenRouterService());
  
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3.5-sonnet');
  const [calorieGoal, setCalorieGoal] = useState('2000');
  const [waterGoal, setWaterGoal] = useState('2500');
  const [userName, setUserName] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [userData, storedApiKey, storedModel] = await Promise.all([
        dbService.getUser(),
        SecureStore.getItemAsync('openrouter_api_key'),
        dbService.getSetting('ai_model'),
      ]);

      if (userData) {
        setUser(userData);
        setUserName(userData.name);
        setCalorieGoal(userData.calorie_goal.toString());
        setWaterGoal(userData.water_goal.toString());
      }

      if (storedApiKey) {
        setApiKey(storedApiKey);
        openRouterService.setApiKey(storedApiKey);
      }

      if (storedModel) {
        setSelectedModel(storedModel);
        openRouterService.setModel(storedModel);
      }

      // Load available models
      await loadAvailableModels();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadAvailableModels = async () => {
    setIsLoadingModels(true);
    try {
      const models = await openRouterService.getAvailableModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Error loading models:', error);
      // Set fallback models
      setAvailableModels([
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
      ]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter a valid API key');
      return;
    }

    try {
      await SecureStore.setItemAsync('openrouter_api_key', apiKey.trim());
      openRouterService.setApiKey(apiKey.trim());
      Alert.alert('Success', 'API key saved successfully');
    } catch (error) {
      console.error('Error saving API key:', error);
      Alert.alert('Error', 'Failed to save API key');
    }
  };

  const testConnection = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key first');
      return;
    }

    setIsTestingConnection(true);
    try {
      openRouterService.setApiKey(apiKey.trim());
      const isConnected = await openRouterService.testConnection();
      
      if (isConnected) {
        Alert.alert('Success', 'Connection to OpenRouter API successful!');
      } else {
        Alert.alert('Error', 'Failed to connect to OpenRouter API. Please check your API key.');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      Alert.alert('Error', 'Failed to test connection. Please try again.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveUserSettings = async () => {
    setIsSaving(true);
    try {
      const calorieGoalNum = parseInt(calorieGoal) || 2000;
      const waterGoalNum = parseInt(waterGoal) || 2500;

      await Promise.all([
        dbService.updateUserGoals(calorieGoalNum, waterGoalNum),
        dbService.setSetting('ai_model', selectedModel),
      ]);

      openRouterService.setModel(selectedModel);
      
      Alert.alert('Success', 'Settings saved successfully');
      await loadSettings(); // Reload to confirm changes
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your food logs, water intake, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.execAsync(`
                DELETE FROM food_entries;
                DELETE FROM water_intake;
                DELETE FROM settings;
                UPDATE users SET calorie_goal = 2000, water_goal = 2500 WHERE id = 1;
              `);
              
              await SecureStore.deleteItemAsync('openrouter_api_key');
              
              Alert.alert('Success', 'All data has been cleared', [
                { text: 'OK', onPress: () => router.replace('/(tabs)') }
              ]);
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const SettingCard = ({ title, children, icon }: {
    title: string;
    children: React.ReactNode;
    icon: string;
  }) => (
    <Card style={styles.settingCard}>
      <Card.Content>
        <View style={styles.settingHeader}>
          <Ionicons name={icon as any} size={20} color={theme.colors.primary} />
          <Text style={styles.settingTitle}>{title}</Text>
        </View>
        {children}
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Configure your NutritionAI experience</Text>
      </View>

      {/* User Profile */}
      <SettingCard title="Profile" icon="person">
        <TextInput
          label="Name"
          value={userName}
          onChangeText={setUserName}
          mode="outlined"
          style={styles.input}
          textColor={theme.colors.text}
          placeholderTextColor={theme.colors.textSecondary}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
          theme={{
            colors: {
              onSurfaceVariant: theme.colors.textSecondary,
              outline: theme.colors.border,
              primary: theme.colors.primary,
            }
          }}
        />
      </SettingCard>

      {/* Daily Goals */}
      <SettingCard title="Daily Goals" icon="trophy-outline">
        <View style={styles.goalRow}>
          <TextInput
            label="Calorie Goal"
            value={calorieGoal}
            onChangeText={setCalorieGoal}
            keyboardType="numeric"
            mode="outlined"
            style={styles.goalInput}
            textColor={theme.colors.text}
            placeholderTextColor={theme.colors.textSecondary}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
            right={<TextInput.Affix text="cal" />}
            theme={{
              colors: {
                onSurfaceVariant: theme.colors.textSecondary,
                outline: theme.colors.border,
                primary: theme.colors.primary,
                onSurface: theme.colors.text,
              }
            }}
          />
          <TextInput
            label="Water Goal"
            value={waterGoal}
            onChangeText={setWaterGoal}
            keyboardType="numeric"
            mode="outlined"
            style={styles.goalInput}
            textColor={theme.colors.text}
            placeholderTextColor={theme.colors.textSecondary}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
            right={<TextInput.Affix text="ml" />}
            theme={{
              colors: {
                onSurfaceVariant: theme.colors.textSecondary,
                outline: theme.colors.border,
                primary: theme.colors.primary,
                onSurface: theme.colors.text,
              }
            }}
          />
        </View>
      </SettingCard>

      {/* AI Configuration */}
      <SettingCard title="AI Configuration" icon="cog-outline">
        <Text style={styles.sectionDescription}>
          Configure your OpenRouter API key for food analysis
        </Text>
        
        <TextInput
          label="OpenRouter API Key"
          value={apiKey}
          onChangeText={setApiKey}
          secureTextEntry
          mode="outlined"
          style={styles.input}
          placeholder="sk-or-v1-..."
          textColor={theme.colors.text}
          placeholderTextColor={theme.colors.textSecondary}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
          right={
            <TextInput.Icon 
              icon="eye" 
              onPress={() => {/* Toggle visibility */}} 
            />
          }
          theme={{
            colors: {
              onSurfaceVariant: theme.colors.textSecondary,
              outline: theme.colors.border,
              primary: theme.colors.primary,
            }
          }}
        />
        
        <View style={styles.apiActions}>
          <Button
            mode="outlined"
            onPress={saveApiKey}
            style={[styles.apiButton, { borderColor: theme.colors.primary }]}
            disabled={!apiKey.trim()}
            textColor={theme.colors.primary}
            theme={{
              colors: {
                onSurfaceDisabled: theme.colors.primary,
                outline: theme.colors.primary,
              },
            }}
          >
            Save Key
          </Button>
          <Button
            mode="outlined"
            onPress={testConnection}
            loading={isTestingConnection}
            disabled={!apiKey.trim() || isTestingConnection}
            style={[styles.apiButton, { borderColor: theme.colors.primary }]}
            textColor={theme.colors.primary}
            theme={{
              colors: {
                onSurfaceDisabled: theme.colors.primary,
                outline: theme.colors.primary,
              },
            }}
          >
            Test Connection
          </Button>
        </View>
        

        
        <Text style={styles.helpText}>
          💡 Get your free API key at openrouter.ai
        </Text>
      </SettingCard>

      {/* App Preferences */}
      <SettingCard title="Preferences" icon="settings">
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>Notifications</Text>
            <Text style={styles.preferenceSubtitle}>Reminders and updates</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            color={theme.colors.primary}
          />
        </View>
        
        <Divider style={styles.divider} />
        
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>Dark Mode</Text>
            <Text style={styles.preferenceSubtitle}>Dark theme (always on)</Text>
          </View>
          <Switch
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
            color={theme.colors.primary}
            disabled
          />
        </View>
      </SettingCard>

      {/* Save Settings */}
      <View style={styles.saveContainer}>
        <Button
          mode="contained"
          onPress={saveUserSettings}
          loading={isSaving}
          disabled={isSaving}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
          textColor={theme.colors.background}
        >
          Save Settings
        </Button>
      </View>

      {/* About */}
      <SettingCard title="About" icon="information-circle">
        <Text style={styles.aboutText}>NutritionAI v1.0.0</Text>
        <Text style={styles.aboutText}>AI-powered nutrition tracking</Text>
        <Text style={styles.aboutText}>Built with React Native & Expo</Text>
      </SettingCard>

      {/* Danger Zone */}
      <SettingCard title="Danger Zone" icon="warning">
        <Text style={styles.dangerDescription}>
          Permanently delete all your data. This action cannot be undone.
        </Text>
        <Button
          mode="outlined"
          onPress={clearAllData}
          textColor={theme.colors.error}
          style={[styles.dangerButton, { borderColor: theme.colors.error }]}
        >
          Clear All Data
        </Button>
      </SettingCard>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  settingCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  goalRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  goalInput: {
    flex: 1,
  },
  apiActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  apiButton: {
    flex: 1,
  },
  divider: {
    marginVertical: theme.spacing.md,
    backgroundColor: theme.colors.border,
  },

  helpText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    color: theme.colors.text,
  },
  preferenceSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  saveContainer: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonContent: {
    height: 48,
  },
  aboutText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  dangerDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  dangerButton: {
    alignSelf: 'flex-start',
  },
  bottomSpacing: {
    height: theme.spacing.xl,
  },
});