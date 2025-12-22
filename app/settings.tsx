import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, TextInput, Button, Dialog, Portal } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { DatabaseService } from '../src/services/database';
import { OpenRouterService } from '../src/services/openrouter';
import { User } from '../src/types/database';
import { theme } from '../src/constants/theme';

// Extract components outside to prevent re-creation
const ProfileInput = ({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) => {
  return (
    <TextInput
      label="Name"
      value={value}
      onChangeText={onChangeText}
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
  );
};

const CalorieGoalInput = ({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) => {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      mode="outlined"
      keyboardType="numeric"
      style={styles.goalInput}
      right={<TextInput.Affix text="cal" />}
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
  );
};

const WaterGoalInput = ({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) => {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      mode="outlined"
      keyboardType="numeric"
      style={styles.goalInput}
      right={<TextInput.Affix text="ml" />}
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
  );
};

const ApiKeyInput = ({ value, onChangeText, showApiKey, onToggleVisibility }: {
  value: string;
  onChangeText: (value: string) => void;
  showApiKey: boolean;
  onToggleVisibility: () => void;
}) => {
  return (
    <TextInput
      label="OpenRouter API Key"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!showApiKey}
      mode="outlined"
      style={styles.input}
      placeholder="sk-or-v1-..."
      textColor={theme.colors.text}
      placeholderTextColor={theme.colors.textSecondary}
      outlineColor={theme.colors.border}
      activeOutlineColor={theme.colors.primary}
      right={
        <TextInput.Icon
          icon={showApiKey ? "eye-off" : "eye"}
          onPress={onToggleVisibility}
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
  );
};

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [dbService] = useState(() => new DatabaseService(db));
  const [openRouterService] = useState(() => new OpenRouterService());

  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [calorieGoal, setCalorieGoal] = useState('2000');
  const [waterGoal, setWaterGoal] = useState('2500');
  const [userName, setUserName] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Dialog states
  const [showApiKeySuccessDialog, setShowApiKeySuccessDialog] = useState(false);
  const [showApiKeyErrorDialog, setShowApiKeyErrorDialog] = useState(false);
  const [showConnectionSuccessDialog, setShowConnectionSuccessDialog] = useState(false);
  const [showConnectionErrorDialog, setShowConnectionErrorDialog] = useState(false);
  const [showSettingsSuccessDialog, setShowSettingsSuccessDialog] = useState(false);
  const [showSettingsErrorDialog, setShowSettingsErrorDialog] = useState(false);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);
  const [showClearDataConfirmDialog, setShowClearDataConfirmDialog] = useState(false);
  const [showApiKeyRequiredDialog, setShowApiKeyRequiredDialog] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [userData, storedApiKey] = await Promise.all([
        dbService.getUser(),
        SecureStore.getItemAsync('openrouter_api_key'),
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
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setShowApiKeyErrorDialog(true);
      return;
    }

    try {
      await SecureStore.setItemAsync('openrouter_api_key', apiKey.trim());
      openRouterService.setApiKey(apiKey.trim());
      setShowApiKeySuccessDialog(true);
    } catch (error) {
      console.error('Error saving API key:', error);
      setShowApiKeyErrorDialog(true);
    }
  };

  const testConnection = async () => {
    if (!apiKey.trim()) {
      setShowApiKeyRequiredDialog(true);
      return;
    }

    setIsTestingConnection(true);
    try {
      openRouterService.setApiKey(apiKey.trim());
      const isConnected = await openRouterService.testConnection();

      if (isConnected) {
        setShowConnectionSuccessDialog(true);
      } else {
        setShowConnectionErrorDialog(true);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setShowConnectionErrorDialog(true);
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
        dbService.updateUserName(userName.trim() || 'User'),
      ]);

      console.log('Settings saved successfully');

      setShowSettingsSuccessDialog(true);
      // Don't reload settings - just update the user state locally
      const userData = await dbService.getUser();
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setShowSettingsErrorDialog(true);
    } finally {
      setIsSaving(false);
    }
  };

  const resetOnboarding = async () => {
    setShowResetConfirmDialog(true);
  };

  const handleResetConfirm = async () => {
    try {
      // Reset setup completion status
      await db.runAsync(
        'UPDATE users SET setup_completed = 0 WHERE id = 1'
      );

      setShowResetConfirmDialog(false);
      router.replace('/onboarding');
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      setShowResetConfirmDialog(false);
      setShowSettingsErrorDialog(true);
    }
  };

  const clearAllData = () => {
    setShowClearDataConfirmDialog(true);
  };

  const handleClearDataConfirm = async () => {
    try {
      await db.execAsync(`
        DELETE FROM food_entries;
        DELETE FROM water_intake;
        DELETE FROM settings;
        UPDATE users SET calorie_goal = 2000, water_goal = 2500 WHERE id = 1;
      `);

      await SecureStore.deleteItemAsync('openrouter_api_key');

      setShowClearDataConfirmDialog(false);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error clearing data:', error);
      setShowClearDataConfirmDialog(false);
      setShowSettingsErrorDialog(true);
    }
  };

  const SettingCard = ({ title, children, icon }: {
    title: string;
    children: React.ReactNode;
    icon: string;
  }) => (
    <Card style={styles.settingCard}>
      <Card.Content>
        <View style={styles.settingHeader}>
          <Ionicons name={icon as any} size={20} color={theme.colors.textSecondary} />
          <Text style={styles.settingTitle}>{title}</Text>
        </View>
        {children}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <SettingCard title="Profile" icon="person-outline">
          <ProfileInput
            value={userName}
            onChangeText={(value) => setUserName(value)}
          />
        </SettingCard>

        {/* Daily Goals */}
        <SettingCard title="Daily Goals" icon="trophy-outline">
          <View style={styles.goalContainer}>
            <View style={styles.goalItem}>
              <Text style={styles.goalLabel}>Calorie Goal</Text>
              <CalorieGoalInput
                value={calorieGoal}
                onChangeText={(value) => setCalorieGoal(value)}
              />
            </View>

            <View style={styles.goalItem}>
              <Text style={styles.goalLabel}>Water Goal</Text>
              <WaterGoalInput
                value={waterGoal}
                onChangeText={(value) => setWaterGoal(value)}
              />
            </View>
          </View>
        </SettingCard>

        {/* AI Configuration */}
        <SettingCard title="AI Configuration" icon="cog-outline">
          <Text style={styles.sectionDescription}>
            Configure your OpenRouter API key for food analysis
          </Text>

          <ApiKeyInput
            value={apiKey}
            onChangeText={(value) => setApiKey(value)}
            showApiKey={showApiKey}
            onToggleVisibility={() => setShowApiKey(!showApiKey)}
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

          {/* AI Model Info */}
          <Text style={[styles.sectionDescription, { marginTop: theme.spacing.md }]}>
            AI Model: Google Gemini 2.5 Flash
          </Text>

          <Text style={styles.helpText}>
            💡 Get your free API key at openrouter.ai
          </Text>
        </SettingCard>

        <Button
          mode="contained"
          onPress={saveUserSettings}
          loading={isSaving}
          disabled={isSaving}
          style={styles.saveButton}
          buttonColor={theme.colors.primary}
          textColor="#FFFFFF"
        >
          Save Settings
        </Button>

        {/* Data Management */}
        <SettingCard title="Data Management" icon="server-outline">
          <Button
            mode="outlined"
            onPress={resetOnboarding}
            style={[styles.actionButton, { borderColor: theme.colors.primary }]}
            textColor={theme.colors.primary}
            icon="refresh"
          >
            Reset Onboarding
          </Button>

          <Button
            mode="outlined"
            onPress={clearAllData}
            style={[styles.actionButton, { borderColor: theme.colors.error }]}
            textColor={theme.colors.error}
            icon="delete"
          >
            Clear All Data
          </Button>
        </SettingCard>

        {/* App Version */}
        <Card style={[styles.settingCard, { marginBottom: theme.spacing.xl }]}>
          <Card.Content>
            <Text style={styles.versionText}>
              NutritionAI v1.0.0
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Success Dialogs */}
      <Portal>
        <Dialog visible={showApiKeySuccessDialog} onDismiss={() => setShowApiKeySuccessDialog(false)}>
          <Dialog.Title>Success!</Dialog.Title>
          <Dialog.Content>
            <Text>API key saved successfully.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowApiKeySuccessDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showConnectionSuccessDialog} onDismiss={() => setShowConnectionSuccessDialog(false)}>
          <Dialog.Title>Connection Test</Dialog.Title>
          <Dialog.Content>
            <Text>✅ Successfully connected to OpenRouter API!</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConnectionSuccessDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showSettingsSuccessDialog} onDismiss={() => setShowSettingsSuccessDialog(false)}>
          <Dialog.Title>Settings Saved</Dialog.Title>
          <Dialog.Content>
            <Text>Your settings have been updated successfully!</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSettingsSuccessDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Error Dialogs */}
        <Dialog visible={showApiKeyErrorDialog} onDismiss={() => setShowApiKeyErrorDialog(false)}>
          <Dialog.Title>Error</Dialog.Title>
          <Dialog.Content>
            <Text>Please enter a valid API key.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowApiKeyErrorDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showConnectionErrorDialog} onDismiss={() => setShowConnectionErrorDialog(false)}>
          <Dialog.Title>Connection Failed</Dialog.Title>
          <Dialog.Content>
            <Text>❌ Could not connect to OpenRouter API. Please check your API key and internet connection.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConnectionErrorDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showSettingsErrorDialog} onDismiss={() => setShowSettingsErrorDialog(false)}>
          <Dialog.Title>Error</Dialog.Title>
          <Dialog.Content>
            <Text>Failed to save settings. Please try again.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSettingsErrorDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showApiKeyRequiredDialog} onDismiss={() => setShowApiKeyRequiredDialog(false)}>
          <Dialog.Title>API Key Required</Dialog.Title>
          <Dialog.Content>
            <Text>Please enter an API key first to test the connection.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowApiKeyRequiredDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Confirmation Dialogs */}
        <Dialog visible={showResetConfirmDialog} onDismiss={() => setShowResetConfirmDialog(false)}>
          <Dialog.Title>Reset Onboarding</Dialog.Title>
          <Dialog.Content>
            <Text>This will reset the onboarding process. You'll need to go through setup again. Continue?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetConfirmDialog(false)} textColor={theme.colors.textSecondary}>
              Cancel
            </Button>
            <Button onPress={handleResetConfirm} textColor={theme.colors.primary}>
              Reset
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showClearDataConfirmDialog} onDismiss={() => setShowClearDataConfirmDialog(false)}>
          <Dialog.Title>Clear All Data</Dialog.Title>
          <Dialog.Content>
            <Text>⚠️ This will permanently delete all your food entries, water intake, and settings. This action cannot be undone. Continue?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClearDataConfirmDialog(false)} textColor={theme.colors.textSecondary}>
              Cancel
            </Button>
            <Button onPress={handleClearDataConfirm} textColor={theme.colors.error}>
              Delete All
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  settingCard: {
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
    fontWeight: 'bold',
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
  goalContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  goalItem: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  goalInput: {
    flex: 1,
  },
  apiActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  apiButton: {
    flex: 1,
  },
  helpText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  saveButton: {
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  actionButton: {
    marginBottom: theme.spacing.md,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  dialogButton: {
    marginHorizontal: theme.spacing.xs,
  },
});