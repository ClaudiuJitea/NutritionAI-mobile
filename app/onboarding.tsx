import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Dimensions, Linking } from 'react-native';
import { Text, Card, TextInput, Button, SegmentedButtons, ProgressBar, Dialog, Portal } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { DatabaseService } from '../src/services/database';
import { OpenRouterService } from '../src/services/openrouter';
import { theme } from '../src/constants/theme';

const { width } = Dimensions.get('window');

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
  const [dbService] = useState(() => new DatabaseService(db));
  const [openRouterService] = useState(() => new OpenRouterService());
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
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
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const weight = parseFloat(formData.weight);
      const age = parseInt(formData.age);
      const customCalories = formData.custom_calories ? parseInt(formData.custom_calories) : undefined;

      if (isNaN(weight) || weight <= 0 || weight > 300) {
        Alert.alert('Error', 'Please enter a valid weight between 1-300 kg');
        return;
      }

      if (isNaN(age) || age < 13 || age > 120) {
        Alert.alert('Error', 'Please enter a valid age between 13-120 years');
        return;
      }

      if (customCalories && (isNaN(customCalories) || customCalories < 800 || customCalories > 5000)) {
        Alert.alert('Error', 'Custom calories should be between 800-5000');
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
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
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
      <View style={styles.navigation}>
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
            disabled={!validateCurrentStep()}
            loading={isLoading}
            style={styles.navButton}
            icon="check"
          >
            Complete Setup
          </Button>
        )}
      </View>

      {/* Success Dialog */}
      <Portal>
        <Dialog 
          visible={showSuccessDialog} 
          onDismiss={() => {}} // Prevent dismissing by tapping outside
          style={styles.successDialog}
        >
          <Dialog.Content style={styles.successDialogContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color={theme.colors.primary} />
            </View>
            <Text style={styles.successTitle}>Welcome to NutritionAI!</Text>
            <Text style={styles.successMessage}>
              Your profile has been set up successfully. You can always update your goals in Settings.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.successDialogActions}>
            <Button
              mode="contained"
              onPress={() => {
                setShowSuccessDialog(false);
                router.replace('/(tabs)/');
              }}
              style={styles.successButton}
              textColor={theme.colors.background}
            >
              Get Started
            </Button>
          </Dialog.Actions>
        </Dialog>
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
        Your personal nutrition tracking companion powered by AI
      </Text>
      <Text style={styles.welcomeDescription}>
        Let's set up your profile to provide personalized nutrition recommendations and accurate calorie goals based on your lifestyle.
      </Text>
      <View style={styles.featureList}>
        <FeatureItem icon="camera" text="AI-powered food analysis" />
        <FeatureItem icon="analytics" text="Detailed nutrition tracking" />
        <FeatureItem icon="water" text="Hydration monitoring" />
        <FeatureItem icon="trending-up" text="Progress insights" />
      </View>
    </Card.Content>
  </Card>
);

const NameStep = ({ name, onNameChange }: { name: string; onNameChange: (value: string) => void }) => (
  <Card style={styles.stepCard}>
    <Card.Content>
      <Text style={styles.stepTitle}>What's your name?</Text>
      <Text style={styles.stepDescription}>
        We'll use this to personalize your experience
      </Text>
      
      <TextInput
        label="Your Name"
        value={name}
        onChangeText={onNameChange}
        mode="outlined"
        style={styles.input}
        placeholder="Enter your name"
        autoFocus
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
        This helps us calculate your personalized calorie and water goals
      </Text>
      
      <View style={styles.inputRow}>
        <TextInput
          label="Weight (kg)"
          value={weight}
          onChangeText={onWeightChange}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
          placeholder="70"
          keyboardType="numeric"
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
        
        <TextInput
          label="Age"
          value={age}
          onChangeText={onAgeChange}
          mode="outlined"
          style={[styles.input, styles.halfInput]}
          placeholder="25"
          keyboardType="numeric"
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
      </View>
      
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
        <Text style={styles.infoText}>
          Your information is stored locally and never shared
        </Text>
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
          We've calculated your daily calorie goal. You can use our recommendation or set a custom value.
        </Text>
        
        <View style={styles.calorieRecommendation}>
          <Text style={styles.recommendedLabel}>Recommended Daily Calories</Text>
          <Text style={styles.recommendedValue}>{estimatedCalories} calories</Text>
          <Text style={styles.recommendedBasis}>
            Based on: {formData.weight}kg, {formData.age} years old, {formData.activity_level.replace('_', ' ')} activity, {formData.weight_goal.replace('_', ' ')} weight goal
          </Text>
        </View>
        
        <Text style={styles.customLabel}>Custom Calorie Goal (Optional)</Text>
        <TextInput
          label="Custom Daily Calories"
          value={customCalories}
          onChangeText={onCustomCaloriesChange}
          mode="outlined"
          style={styles.input}
          placeholder={`Default: ${estimatedCalories}`}
          keyboardType="numeric"
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
        
        <View style={styles.infoBox}>
          <Ionicons name="bulb" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            Leave empty to use our calculated recommendation. You can always adjust this later in Settings.
          </Text>
        </View>
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
            <Text style={styles.stepTitle}>AI Features Setup</Text>
          </View>
          
          <Text style={styles.stepDescription}>
            Enable AI-powered food analysis by adding your OpenRouter API key
          </Text>

          {/* Features that require API key */}
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>Features you'll unlock:</Text>
            <View style={styles.featuresList}>
              <FeatureItem icon="camera" text="AI-powered food analysis from photos" />
              <FeatureItem icon="analytics" text="Detailed nutrition breakdowns" />
              <FeatureItem icon="bulb" text="Personalized nutrition tips" />
              <FeatureItem icon="restaurant" text="Smart meal recognition" />
            </View>
          </View>

          {/* Warning box */}
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color={theme.colors.warning} />
            <Text style={styles.warningText}>
              Without an API key, you'll miss out on AI food analysis and smart nutrition features. You can add this later in Settings.
            </Text>
          </View>

          <TextInput
            label="OpenRouter API Key (Optional)"
            value={apiKey}
            onChangeText={onApiKeyChange}
            mode="outlined"
            style={styles.input}
            placeholder="sk-or-v1-..."
            secureTextEntry
            textColor={theme.colors.text}
            placeholderTextColor={theme.colors.textSecondary}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
            right={
              testResult === 'success' ? (
                <TextInput.Icon icon="check-circle" color={theme.colors.success} />
              ) : testResult === 'error' ? (
                <TextInput.Icon icon="close-circle" color={theme.colors.error} />
              ) : undefined
            }
            theme={{
              colors: {
                onSurfaceVariant: theme.colors.textSecondary,
                outline: theme.colors.border,
                primary: theme.colors.primary,
              }
            }}
          />

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

          {/* Help section */}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>How to get your API key:</Text>
            <Text style={styles.helpStep}>1. Visit openrouter.ai</Text>
            <Text style={styles.helpStep}>2. Create a free account</Text>
            <Text style={styles.helpStep}>3. Generate an API key</Text>
            <Text style={styles.helpStep}>4. Copy and paste it above</Text>
            
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
          </View>

          <View style={styles.skipInfo}>
            <Ionicons name="information-circle" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.skipInfoText}>
              You can skip this step and add your API key later in Settings to enable AI features.
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Custom Dialogs */}
      <Portal>
        {/* API Key Required Dialog */}
        <Dialog 
          visible={showApiKeyRequiredDialog} 
          onDismiss={() => setShowApiKeyRequiredDialog(false)}
          style={styles.customDialog}
        >
          <Dialog.Content style={styles.dialogContent}>
            <View style={styles.dialogIconContainer}>
              <Ionicons name="key" size={60} color={theme.colors.warning} />
            </View>
            <Text style={styles.dialogTitle}>API Key Required</Text>
            <Text style={styles.dialogMessage}>
              Please enter an API key to test the connection.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              mode="contained"
              onPress={() => setShowApiKeyRequiredDialog(false)}
              style={styles.dialogButton}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.background}
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Success Dialog */}
        <Dialog 
          visible={showSuccessDialog} 
          onDismiss={() => setShowSuccessDialog(false)}
          style={styles.customDialog}
        >
          <Dialog.Content style={styles.dialogContent}>
            <View style={styles.dialogIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color={theme.colors.success} />
            </View>
            <Text style={styles.dialogTitle}>Success!</Text>
            <Text style={styles.dialogMessage}>
              ✅ API key is valid and working correctly!
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              mode="contained"
              onPress={() => setShowSuccessDialog(false)}
              style={styles.dialogButton}
              buttonColor={theme.colors.success}
              textColor={theme.colors.background}
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Error Dialog */}
        <Dialog 
          visible={showErrorDialog} 
          onDismiss={() => setShowErrorDialog(false)}
          style={styles.customDialog}
        >
          <Dialog.Content style={styles.dialogContent}>
            <View style={styles.dialogIconContainer}>
              <Ionicons name="close-circle" size={60} color={theme.colors.error} />
            </View>
            <Text style={styles.dialogTitle}>Invalid API Key</Text>
            <Text style={styles.dialogMessage}>
              ❌ The API key is invalid or there was a connection error. Please check your key and try again.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              mode="contained"
              onPress={() => setShowErrorDialog(false)}
              style={styles.dialogButton}
              buttonColor={theme.colors.error}
              textColor={theme.colors.background}
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
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
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  featureList: {
    // Remove flexWrap and gap, let them stack vertically
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
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
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  segmentedButtons: {
    marginBottom: theme.spacing.sm,
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
    marginBottom: theme.spacing.xs,
  },
  recommendedBasis: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
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
    paddingBottom: theme.spacing.xl,
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
  successDialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
  },
  successDialogContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  successIconContainer: {
    marginBottom: theme.spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  successDialogActions: {
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  successButton: {
    minWidth: 120,
  },
  testButton: {
    marginTop: theme.spacing.md,
  },
  apiKeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  featuresContainer: {
    marginBottom: theme.spacing.lg,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  featuresList: {
    // Remove flexWrap and gap, let them stack vertically
  },
  warningBox: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  helpSection: {
    marginBottom: theme.spacing.lg,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  helpStep: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
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
  customDialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
  },
  dialogContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  dialogIconContainer: {
    marginBottom: theme.spacing.lg,
  },
  dialogTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dialogActions: {
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  dialogButton: {
    minWidth: 120,
  },
}); 