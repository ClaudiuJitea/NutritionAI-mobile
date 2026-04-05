import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput as RNTextInput } from 'react-native';
import { Text, Card, TextInput, Button, Dialog, Portal } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { DatabaseService } from '../src/services/database';
import { OpenRouterService } from '../src/services/openrouter';
import { User } from '../src/types/database';
import { theme } from '../src/constants/theme';

const ThemedDialog = ({
  visible,
  onDismiss,
  title,
  children,
  actions,
}: {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) => (
  <Dialog visible={visible} onDismiss={onDismiss} style={styles.appDialog}>
    <Dialog.Title style={styles.appDialogTitle}>{title}</Dialog.Title>
    <Dialog.Content>
      <Text style={styles.appDialogText}>{children}</Text>
    </Dialog.Content>
    <Dialog.Actions style={styles.appDialogActions}>
      {actions}
    </Dialog.Actions>
  </Dialog>
);

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
    <View style={styles.goalInputShell}>
      <Text style={styles.goalInputCaption}>Calories</Text>
      <View style={styles.goalInputRow}>
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          style={styles.goalNativeInput}
          placeholder="2000"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Text style={styles.goalUnit}>cal</Text>
      </View>
    </View>
  );
};

const WaterGoalInput = ({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) => {
  return (
    <View style={styles.goalInputShell}>
      <Text style={styles.goalInputCaption}>Water</Text>
      <View style={styles.goalInputRow}>
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          style={styles.goalNativeInput}
          placeholder="2500"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Text style={styles.goalUnit}>ml</Text>
      </View>
    </View>
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

const StatTile = ({ label, value, accent }: {
  label: string;
  value: string;
  accent: string;
}) => (
  <View style={styles.statTile}>
    <View style={[styles.statAccent, { backgroundColor: accent }]} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const InfoChip = ({ icon, label, tone = 'default' }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'default' | 'success';
}) => (
  <View style={[
    styles.infoChip,
    tone === 'success' ? styles.infoChipSuccess : null
  ]}>
    <Ionicons
      name={icon}
      size={14}
      color={tone === 'success' ? theme.colors.success : theme.colors.textSecondary}
    />
    <Text style={[
      styles.infoChipText,
      tone === 'success' ? styles.infoChipTextSuccess : null
    ]}>
      {label}
    </Text>
  </View>
);

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const dbService = new DatabaseService(db);
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

  const hasApiKey = apiKey.trim().length > 0;
  const displayName = userName.trim() || user?.name || 'User';

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
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroEyebrow}>Preferences</Text>
          <Text style={styles.heroTitle}>Tune NutritionAI to your routine</Text>
          <Text style={styles.heroDescription}>
            Update your profile, daily targets, and AI access from one place.
          </Text>

          <View style={styles.heroChips}>
            <InfoChip
              icon={hasApiKey ? 'sparkles-outline' : 'key-outline'}
              label={hasApiKey ? 'AI ready' : 'API key needed'}
              tone={hasApiKey ? 'success' : 'default'}
            />
            <InfoChip
              icon="person-circle-outline"
              label={displayName}
            />
          </View>

          <View style={styles.statsRow}>
            <StatTile label="Calories" value={`${calorieGoal || '2000'} cal`} accent={theme.colors.primary} />
            <StatTile label="Hydration" value={`${waterGoal || '2500'} ml`} accent={theme.colors.chart.carbs} />
          </View>
        </View>

        {/* Profile Section */}
        <SettingCard title="Profile" icon="person-outline">
          <Text style={styles.sectionEyebrow}>Identity</Text>
          <Text style={styles.sectionDescription}>
            This name appears across your daily tracking flow.
          </Text>
          <ProfileInput
            value={userName}
            onChangeText={(value) => setUserName(value)}
          />
        </SettingCard>

        {/* Daily Goals */}
        <SettingCard title="Daily Goals" icon="trophy-outline">
          <Text style={styles.sectionEyebrow}>Targets</Text>
          <Text style={styles.sectionDescription}>
            Keep your calorie and hydration goals visible and easy to adjust.
          </Text>
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
          <Text style={styles.sectionEyebrow}>Food Analysis</Text>
          <Text style={styles.sectionDescription}>
            Configure your OpenRouter API key for food analysis
          </Text>

          <View style={styles.statusRow}>
            <InfoChip
              icon={hasApiKey ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              label={hasApiKey ? 'Key stored on device' : 'No API key saved'}
              tone={hasApiKey ? 'success' : 'default'}
            />
            <InfoChip
              icon="hardware-chip-outline"
              label="Gemma 4 26B"
            />
          </View>

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
          <View style={styles.modelBanner}>
            <Text style={styles.modelEyebrow}>Active model</Text>
            <Text style={styles.modelName}>Google Gemma 4 26B A4B IT</Text>
            <Text style={styles.modelCaption}>Model ID: google/gemma-4-26b-a4b-it</Text>
          </View>

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
          contentStyle={styles.saveButtonContent}
          labelStyle={styles.saveButtonLabel}
          icon="content-save-outline"
        >
          Save Settings
        </Button>

        {/* Data Management */}
        <SettingCard title="Data Management" icon="server-outline">
          <Text style={styles.sectionEyebrow}>Maintenance</Text>
          <Text style={styles.sectionDescription}>
            Reset onboarding or clear app data when you need a clean slate.
          </Text>
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
        <Card style={[styles.settingCard, styles.versionCard, { marginBottom: theme.spacing.xl }]}>
          <Card.Content>
            <Text style={styles.versionLabel}>NutritionAI</Text>
            <Text style={styles.versionText}>v1.0.0</Text>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Success Dialogs */}
      <Portal>
        <ThemedDialog visible={showApiKeySuccessDialog} onDismiss={() => setShowApiKeySuccessDialog(false)} title="API Key Saved" actions={
          <>
            <Button onPress={() => setShowApiKeySuccessDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </>
        }>
          API key saved successfully.
        </ThemedDialog>

        <ThemedDialog visible={showConnectionSuccessDialog} onDismiss={() => setShowConnectionSuccessDialog(false)} title="Connection Test" actions={
          <>
            <Button onPress={() => setShowConnectionSuccessDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </>
        }>
          Successfully connected to OpenRouter API.
        </ThemedDialog>

        <ThemedDialog visible={showSettingsSuccessDialog} onDismiss={() => setShowSettingsSuccessDialog(false)} title="Settings Saved" actions={
          <>
            <Button onPress={() => setShowSettingsSuccessDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </>
        }>
          Your settings have been updated successfully.
        </ThemedDialog>

        {/* Error Dialogs */}
        <ThemedDialog visible={showApiKeyErrorDialog} onDismiss={() => setShowApiKeyErrorDialog(false)} title="Error" actions={
          <>
            <Button onPress={() => setShowApiKeyErrorDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </>
        }>
          Please enter a valid API key.
        </ThemedDialog>

        <ThemedDialog visible={showConnectionErrorDialog} onDismiss={() => setShowConnectionErrorDialog(false)} title="Connection Failed" actions={
          <>
            <Button onPress={() => setShowConnectionErrorDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </>
        }>
          Could not connect to OpenRouter API. Please check your API key and internet connection.
        </ThemedDialog>

        <ThemedDialog visible={showSettingsErrorDialog} onDismiss={() => setShowSettingsErrorDialog(false)} title="Error" actions={
          <>
            <Button onPress={() => setShowSettingsErrorDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </>
        }>
          Failed to save settings. Please try again.
        </ThemedDialog>

        <ThemedDialog visible={showApiKeyRequiredDialog} onDismiss={() => setShowApiKeyRequiredDialog(false)} title="API Key Required" actions={
          <>
            <Button onPress={() => setShowApiKeyRequiredDialog(false)} textColor={theme.colors.primary}>
              OK
            </Button>
          </>
        }>
          Please enter an API key first to test the connection.
        </ThemedDialog>

        {/* Confirmation Dialogs */}
        <ThemedDialog visible={showResetConfirmDialog} onDismiss={() => setShowResetConfirmDialog(false)} title="Reset Onboarding" actions={
          <>
            <Button onPress={() => setShowResetConfirmDialog(false)} textColor={theme.colors.textSecondary}>
              Cancel
            </Button>
            <Button onPress={handleResetConfirm} textColor={theme.colors.primary}>
              Reset
            </Button>
          </>
        }>
          This will reset the onboarding process. You'll need to go through setup again. Continue?
        </ThemedDialog>

        <ThemedDialog visible={showClearDataConfirmDialog} onDismiss={() => setShowClearDataConfirmDialog(false)} title="Clear All Data" actions={
          <>
            <Button onPress={() => setShowClearDataConfirmDialog(false)} textColor={theme.colors.textSecondary}>
              Cancel
            </Button>
            <Button onPress={handleClearDataConfirm} textColor={theme.colors.error}>
              Delete All
            </Button>
          </>
        }>
          This will permanently delete all your food entries, water intake, and settings. This action cannot be undone. Continue?
        </ThemedDialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(18, 214, 176, 0.10)',
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 120,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(244, 183, 64, 0.07)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  heroCard: {
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(18, 214, 176, 0.12)',
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  settingCard: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  settingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  goalContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  goalItem: {
    flex: 1,
    minWidth: 140,
  },
  goalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goalInput: {
    flex: 1,
  },
  goalInputShell: {
    minHeight: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  goalInputCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalNativeInput: {
    flex: 1,
    paddingVertical: 0,
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  goalUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  apiActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  apiButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: theme.borderRadius.lg,
  },
  modelBanner: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: 'rgba(18, 214, 176, 0.20)',
  },
  modelEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  modelCaption: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  helpText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  saveButton: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  saveButtonContent: {
    minHeight: 58,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionButton: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  statTile: {
    flex: 1,
    minWidth: 130,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statAccent: {
    width: 28,
    height: 4,
    borderRadius: 999,
    marginBottom: theme.spacing.md,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statLabel: {
    marginTop: theme.spacing.xs,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  infoChipSuccess: {
    backgroundColor: 'rgba(18, 214, 176, 0.10)',
    borderColor: 'rgba(18, 214, 176, 0.24)',
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  infoChipTextSuccess: {
    color: theme.colors.success,
  },
  versionCard: {
    alignItems: 'center',
  },
  versionLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: theme.spacing.xs,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  appDialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  appDialogTitle: {
    color: theme.colors.text,
  },
  appDialogText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  appDialogActions: {
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  dialogButton: {
    marginHorizontal: theme.spacing.xs,
  },
});
