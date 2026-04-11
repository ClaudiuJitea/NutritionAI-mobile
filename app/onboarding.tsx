import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Linking, TextInput as RNTextInput } from 'react-native';
import { Text, Card, Button, ProgressBar, Portal } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatabaseService } from '../src/services/database';
import { OpenRouterService } from '../src/services/openrouter';
import { theme } from '../src/constants/theme';
import { AppDialog } from '../src/components/AppDialog';

const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoFocus,
  suffix,
  actionLabel,
  onActionPress,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  suffix?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: any;
}) => (
  <View style={[styles.inputShell, style]}>
    <Text style={styles.inputCaption}>{label}</Text>
    <View style={styles.inputShellRow}>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.inputNative}
      />
      {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      {actionLabel ? (
        <Button
          mode="text"
          compact
          onPress={onActionPress}
          textColor={theme.colors.textSecondary}
          style={styles.inputActionButton}
          contentStyle={styles.inputActionButtonContent}
          labelStyle={styles.inputActionButtonLabel}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  </View>
);

interface OnboardingData {
  name: string;
  weight: string;
  age: string;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  weight_goal: 'maintain' | 'lose_steady' | 'lose_aggressive';
  custom_calories: string;
  api_key: string;
}

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const bottomPadding = theme.spacing.lg + Math.min(insets.bottom, theme.spacing.lg);
  const dbService = new DatabaseService(db);
  const [openRouterService] = useState(() => new OpenRouterService());
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: 'Error',
    message: '',
  });
  
  const [formData, setFormData] = useState<OnboardingData>({
    name: '',
    weight: '',
    age: '',
    activity_level: 'moderate',
    weight_goal: 'maintain',
    custom_calories: '',
    api_key: '',
  });

  const totalSteps = 6;
  const progress = (currentStep + 1) / totalSteps;

  const showError = (title: string, message: string) => {
    setErrorDialog({ visible: true, title, message });
  };

  const updateFormData = (field: keyof OnboardingData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: // Welcome
        return true;
      case 1: // Name
        return formData.name.trim().length > 0;
      case 2: // Physical info
        return formData.weight.trim().length > 0 && formData.age.trim().length > 0;
      case 3: // Activity & Goals
        return true; // These have default values
      case 4: // Calorie customization
        return true; // Optional step
      case 5: // API Key setup
        return true; // Optional step - user can skip
      default:
        return false;
    }
  };

  const testApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey.trim()) return false;
    
    setIsTestingApiKey(true);
    try {
      openRouterService.setApiKey(apiKey.trim());
      const isValid = await openRouterService.testConnection();
      return isValid;
    } catch (error) {
      console.error('Error testing API key:', error);
      return false;
    } finally {
      setIsTestingApiKey(false);
    }
  };

  const completeOnboarding = async () => {
    if (!validateCurrentStep()) {
      showError('Missing Information', 'Please fill in all required fields before continuing.');
      return;
    }

    setIsLoading(true);
    try {
      const weight = parseFloat(formData.weight);
      const age = parseInt(formData.age);
      const customCalories = formData.custom_calories ? parseInt(formData.custom_calories) : undefined;

      if (isNaN(weight) || weight <= 0 || weight > 300) {
        showError('Invalid Weight', 'Please enter a valid weight between 1 and 300 kg.');
        return;
      }

      if (isNaN(age) || age < 13 || age > 120) {
        showError('Invalid Age', 'Please enter a valid age between 13 and 120 years.');
        return;
      }

      if (customCalories && (isNaN(customCalories) || customCalories < 800 || customCalories > 5000)) {
        showError('Invalid Calories', 'Custom calories should be between 800 and 5000.');
        return;
      }

      await dbService.updateUserProfile({
        name: formData.name.trim(),
        weight,
        age,
        activity_level: formData.activity_level,
        weight_goal: formData.weight_goal,
        calorie_goal: customCalories,
      });

      if (formData.api_key.trim()) {
        await SecureStore.setItemAsync('openrouter_api_key', formData.api_key.trim());
      }

      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      showError('Setup Failed', 'Failed to save your profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <WelcomeStep />
        );
      case 1:
        return (
          <NameStep 
            name={formData.name}
            onNameChange={(value) => updateFormData('name', value)}
          />
        );
      case 2:
        return (
          <PhysicalInfoStep
            weight={formData.weight}
            age={formData.age}
            onWeightChange={(value) => updateFormData('weight', value)}
            onAgeChange={(value) => updateFormData('age', value)}
          />
        );
      case 3:
        return (
          <ActivityGoalsStep
            activityLevel={formData.activity_level}
            weightGoal={formData.weight_goal}
            onActivityLevelChange={(value) => updateFormData('activity_level', value)}
            onWeightGoalChange={(value) => updateFormData('weight_goal', value)}
          />
        );
      case 4:
        return (
          <CalorieCustomizationStep
            customCalories={formData.custom_calories}
            onCustomCaloriesChange={(value) => updateFormData('custom_calories', value)}
            formData={formData}
          />
        );
      case 5:
        return (
          <ApiKeySetupStep
            apiKey={formData.api_key}
            onApiKeyChange={(value) => updateFormData('api_key', value)}
            onTestApiKey={testApiKey}
            isTestingApiKey={isTestingApiKey}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <ProgressBar
          progress={progress}
          color={theme.colors.primary}
          style={styles.progressBar}
        />
        <Text style={styles.progressText}>
          Step {currentStep + 1} of {totalSteps}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      {/* Navigation */}
      <View style={[styles.navigation, { paddingBottom: bottomPadding }]}>
        {currentStep > 0 && (
          <Button
            mode="outlined"
            onPress={prevStep}
            style={styles.navButton}
            icon="arrow-left"
          >
            Back
          </Button>
        )}
        
        <View style={styles.navSpacer} />
        
        {currentStep < totalSteps - 1 ? (
          <Button
            mode="contained"
            onPress={nextStep}
            disabled={!validateCurrentStep()}
            style={styles.navButton}
            icon="arrow-right"
            contentStyle={styles.nextButtonContent}
          >
            Next
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={completeOnboarding}
            disabled={!validateCurrentStep() || isLoading}
            style={styles.navButton}
            icon="check"
          >
            Complete Setup
          </Button>
        )}
      </View>

      {/* Success Dialog */}
      <Portal>
        <AppDialog
          visible={showSuccessDialog}
          onDismiss={() => {}}
          title="Welcome to NutritionAI!"
          message="Your profile has been set up successfully. You can always update your goals in Settings."
          tone="success"
          primaryAction={{
            label: 'Get Started',
            onPress: () => {
              setShowSuccessDialog(false);
              router.replace('/(tabs)/');
            },
          }}
        />
        <AppDialog
          visible={errorDialog.visible}
          onDismiss={() => setErrorDialog((prev) => ({ ...prev, visible: false }))}
          title={errorDialog.title}
          message={errorDialog.message}
          tone="error"
          primaryAction={{
            label: 'OK',
            onPress: () => setErrorDialog((prev) => ({ ...prev, visible: false })),
          }}
        />
      </Portal>
    </View>
  );
}

const WelcomeStep = () => (
  <Card style={styles.stepCard}>
    <Card.Content style={styles.welcomeContent}>
      <View style={styles.iconContainer}>
        <Ionicons name="nutrition" size={80} color={theme.colors.primary} />
      </View>
      <Text style={styles.welcomeTitle}>Welcome to NutritionAI</Text>
      <Text style={styles.welcomeSubtitle}>
        A simple setup and you're ready to track food and water.
      </Text>
      <View style={styles.featureList}>
        <FeatureItem icon="camera" text="Food analysis" />
        <FeatureItem icon="analytics" text="Nutrition tracking" />
        <FeatureItem icon="water" text="Water tracking" />
      </View>
    </Card.Content>
  </Card>
);

const NameStep = ({ name, onNameChange }: { name: string; onNameChange: (value: string) => void }) => (
  <Card style={styles.stepCard}>
    <Card.Content>
      <Text style={styles.stepTitle}>What's your name?</Text>
      <Text style={styles.stepDescription}>
        Used across the app.
      </Text>

      <FormInput
        label="Name"
        value={name}
        onChangeText={onNameChange}
        placeholder="Your name"
        autoFocus
      />
    </Card.Content>
  </Card>
);

const PhysicalInfoStep = ({ 
  weight, 
  age, 
  onWeightChange, 
  onAgeChange 
}: { 
  weight: string; 
  age: string; 
  onWeightChange: (value: string) => void; 
  onAgeChange: (value: string) => void; 
}) => (
  <Card style={styles.stepCard}>
    <Card.Content>
      <Text style={styles.stepTitle}>Physical Information</Text>
      <Text style={styles.stepDescription}>
        This is used to set your daily goals.
      </Text>
      
      <View style={styles.inputRow}>
        <FormInput
          label="Weight"
          value={weight}
          onChangeText={onWeightChange}
          style={styles.halfInput}
          placeholder="70"
          keyboardType="numeric"
          suffix="kg"
        />
        
        <FormInput
          label="Age"
          value={age}
          onChangeText={onAgeChange}
          style={styles.halfInput}
          placeholder="25"
          keyboardType="numeric"
          suffix="yrs"
        />
      </View>
    </Card.Content>
  </Card>
);

const ActivityGoalsStep = ({ 
  activityLevel, 
  weightGoal, 
  onActivityLevelChange, 
  onWeightGoalChange 
}: { 
  activityLevel: string; 
  weightGoal: string; 
  onActivityLevelChange: (value: string) => void; 
  onWeightGoalChange: (value: string) => void; 
}) => (
  <Card style={styles.stepCard}>
    <Card.Content>
      <Text style={styles.stepTitle}>Activity & Goals</Text>
      <Text style={styles.stepDescription}>
        Tell us about your lifestyle and goals
      </Text>
      
      <Text style={styles.sectionLabel}>Activity Level</Text>
      <View style={styles.activityButtonsContainer}>
        {[
          { value: 'sedentary', label: 'Sedentary', short: 'Sed.' },
          { value: 'light', label: 'Light', short: 'Light' },
          { value: 'moderate', label: 'Moderate', short: 'Mod.' },
          { value: 'active', label: 'Active', short: 'Active' },
          { value: 'very_active', label: 'Very Active', short: 'Ver.' },
        ].map((option) => (
          <Button
            key={option.value}
            mode={activityLevel === option.value ? "contained" : "outlined"}
            onPress={() => onActivityLevelChange(option.value)}
            style={[
              styles.activityButton,
              activityLevel === option.value 
                ? { backgroundColor: theme.colors.primary }
                : { borderColor: theme.colors.border }
            ]}
            textColor={activityLevel === option.value ? theme.colors.background : theme.colors.text}
            compact
            labelStyle={styles.activityButtonLabel}
          >
            {option.short}
          </Button>
        ))}
      </View>
      
      <View style={styles.activityDescriptions}>
        <Text style={styles.activityDesc}>
          {getActivityDescription(activityLevel)}
        </Text>
      </View>
      
      <Text style={styles.sectionLabel}>Weight Goal</Text>
      <View style={styles.goalButtonsContainer}>
        {[
          { value: 'maintain', label: 'Maintain' },
          { value: 'lose_steady', label: 'Lose Steady' },
          { value: 'lose_aggressive', label: 'Lose Fast' },
        ].map((option) => (
          <Button
            key={option.value}
            mode={weightGoal === option.value ? "contained" : "outlined"}
            onPress={() => onWeightGoalChange(option.value)}
            style={[
              styles.goalButton,
              weightGoal === option.value 
                ? { backgroundColor: theme.colors.primary }
                : { borderColor: theme.colors.border }
            ]}
            textColor={weightGoal === option.value ? theme.colors.background : theme.colors.text}
            compact
            labelStyle={styles.goalButtonLabel}
          >
            {option.label}
          </Button>
        ))}
      </View>
      
      <View style={styles.goalDescriptions}>
        <Text style={styles.goalDesc}>
          {getWeightGoalDescription(weightGoal)}
        </Text>
      </View>
    </Card.Content>
  </Card>
);

const CalorieCustomizationStep = ({ 
  customCalories, 
  onCustomCaloriesChange, 
  formData 
}: { 
  customCalories: string; 
  onCustomCaloriesChange: (value: string) => void; 
  formData: OnboardingData; 
}) => {
  const calculateEstimatedCalories = () => {
    const weight = parseFloat(formData.weight);
    const age = parseInt(formData.age);
    
    if (isNaN(weight) || isNaN(age)) return 2000;
    
    // Basic BMR calculation
    const bmr = 10 * weight + 6.25 * 175 - 5 * age + 5;
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };
    
    const tdee = bmr * activityMultipliers[formData.activity_level];
    
    switch (formData.weight_goal) {
      case 'lose_aggressive':
        return Math.round(tdee - 750);
      case 'lose_steady':
        return Math.round(tdee - 500);
      case 'maintain':
      default:
        return Math.round(tdee);
    }
  };

  const estimatedCalories = calculateEstimatedCalories();

  return (
    <Card style={styles.stepCard}>
      <Card.Content>
        <Text style={styles.stepTitle}>Calorie Goal</Text>
        <Text style={styles.stepDescription}>
          Use the recommendation or enter your own number.
        </Text>
        
        <View style={styles.calorieRecommendation}>
          <Text style={styles.recommendedLabel}>Recommended Daily Calories</Text>
          <Text style={styles.recommendedValue}>{estimatedCalories} cal</Text>
        </View>
        
        <Text style={styles.customLabel}>Custom Goal</Text>
        <FormInput
          label="Calories"
          value={customCalories}
          onChangeText={onCustomCaloriesChange}
          style={styles.fullInput}
          placeholder={`Default: ${estimatedCalories}`}
          keyboardType="numeric"
          suffix="cal"
        />
      </Card.Content>
    </Card>
  );
};

const ApiKeySetupStep = ({ 
  apiKey, 
  onApiKeyChange, 
  onTestApiKey, 
  isTestingApiKey 
}: { 
  apiKey: string; 
  onApiKeyChange: (value: string) => void; 
  onTestApiKey: (apiKey: string) => Promise<boolean>; 
  isTestingApiKey: boolean; 
}) => {
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [showApiKeyRequiredDialog, setShowApiKeyRequiredDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      setShowApiKeyRequiredDialog(true);
      return;
    }

    const isValid = await onTestApiKey(apiKey);
    setTestResult(isValid ? 'success' : 'error');
    
    if (isValid) {
      setShowSuccessDialog(true);
    } else {
      setShowErrorDialog(true);
    }
  };

  return (
    <>
      <Card style={styles.stepCard}>
        <Card.Content>
          <View style={styles.apiKeyHeader}>
            <Ionicons name="key" size={32} color={theme.colors.primary} />
            <Text style={styles.stepTitle}>API Key</Text>
          </View>
          
          <Text style={styles.stepDescription}>
            Optional. You can add this now or later in Settings.
          </Text>

          <FormInput
            label="OpenRouter API Key"
            value={apiKey}
            onChangeText={onApiKeyChange}
            style={styles.fullInput}
            placeholder="sk-or-v1-..."
            secureTextEntry={!showApiKey}
            actionLabel={showApiKey ? 'Hide' : 'Show'}
            onActionPress={() => setShowApiKey((current) => !current)}
          />

          {testResult ? (
            <Text style={[
              styles.apiStatusText,
              testResult === 'success' ? styles.apiStatusSuccess : styles.apiStatusError
            ]}>
              {testResult === 'success' ? 'Key looks valid.' : 'Key test failed.'}
            </Text>
          ) : null}

          {apiKey.trim() && (
            <Button
              mode="outlined"
              onPress={handleTestApiKey}
              loading={isTestingApiKey}
              disabled={isTestingApiKey}
              style={[styles.testButton, { borderColor: theme.colors.primary }]}
              textColor={theme.colors.primary}
              icon="lightning-bolt"
            >
              {isTestingApiKey ? 'Testing Connection...' : 'Test API Key'}
            </Button>
          )}

          <View style={styles.skipInfo}>
            <Ionicons name="information-circle" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.skipInfoText}>
              You can skip this and add it later in Settings.
            </Text>
          </View>

          <Button
            mode="text"
            onPress={() => Linking.openURL('https://openrouter.ai')}
            style={styles.helpButton}
            textColor={theme.colors.primary}
            icon="open-in-new"
            compact
          >
            Open OpenRouter.ai
          </Button>
        </Card.Content>
      </Card>

      {/* Custom Dialogs */}
      <Portal>
        <AppDialog
          visible={showApiKeyRequiredDialog}
          onDismiss={() => setShowApiKeyRequiredDialog(false)}
          title="API Key Required"
          message="Please enter an API key to test the connection."
          tone="warning"
          icon="key"
          primaryAction={{
            label: 'OK',
            onPress: () => setShowApiKeyRequiredDialog(false),
          }}
        />
        <AppDialog
          visible={showSuccessDialog}
          onDismiss={() => setShowSuccessDialog(false)}
          title="Success"
          message="API key is valid and working correctly."
          tone="success"
          primaryAction={{
            label: 'OK',
            onPress: () => setShowSuccessDialog(false),
          }}
        />
        <AppDialog
          visible={showErrorDialog}
          onDismiss={() => setShowErrorDialog(false)}
          title="Invalid API Key"
          message="The API key is invalid or there was a connection error. Please check your key and try again."
          tone="error"
          primaryAction={{
            label: 'OK',
            onPress: () => setShowErrorDialog(false),
          }}
        />
      </Portal>
    </>
  );
};

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.featureItem}>
    <Ionicons name={icon as any} size={20} color={theme.colors.primary} />
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const getActivityDescription = (level: string): string => {
  switch (level) {
    case 'sedentary':
      return 'Little to no exercise, desk job';
    case 'light':
      return 'Light exercise 1-3 days/week';
    case 'moderate':
      return 'Moderate exercise 3-5 days/week';
    case 'active':
      return 'Heavy exercise 6-7 days/week';
    case 'very_active':
      return 'Very heavy exercise, physical job';
    default:
      return '';
  }
};

const getWeightGoalDescription = (goal: string): string => {
  switch (goal) {
    case 'maintain':
      return 'Maintain current weight';
    case 'lose_steady':
      return 'Lose 0.5kg per week (500 cal deficit)';
    case 'lose_aggressive':
      return 'Lose 0.75kg per week (750 cal deficit)';
    default:
      return '';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  progressContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
  },
  progressText: {
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  stepCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
  },
  welcomeContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: theme.spacing.lg,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  featureList: {
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  featureText: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  stepDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  inputShell: {
    minHeight: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: theme.spacing.md,
  },
  fullInput: {
    width: '100%',
  },
  inputCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputShellRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputNative: {
    flex: 1,
    paddingVertical: 0,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  inputSuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  inputActionButton: {
    marginLeft: theme.spacing.sm,
  },
  inputActionButtonContent: {
    minHeight: 32,
  },
  inputActionButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  activityButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  activityButton: {
    flex: 1,
    minWidth: 60,
  },
  activityButtonLabel: {
    fontSize: 12,
  },
  goalButtonsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  goalButton: {
    flex: 1,
  },
  goalButtonLabel: {
    fontSize: 14,
  },
  activityDescriptions: {
    marginBottom: theme.spacing.lg,
  },
  activityDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  goalDescriptions: {
    marginTop: theme.spacing.sm,
  },
  goalDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  calorieRecommendation: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  recommendedLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  recommendedValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 0,
  },
  customLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  navigation: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  navButton: {
    minWidth: 100,
  },
  nextButtonContent: {
    flexDirection: 'row-reverse',
  },
  navSpacer: {
    flex: 1,
  },
  testButton: {
    marginTop: theme.spacing.xs,
  },
  apiKeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  apiStatusText: {
    fontSize: 12,
    marginTop: -4,
    marginBottom: theme.spacing.sm,
  },
  apiStatusSuccess: {
    color: theme.colors.success,
  },
  apiStatusError: {
    color: theme.colors.error,
  },
  helpButton: {
    marginTop: theme.spacing.sm,
  },
  skipInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  skipInfoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
}); 
