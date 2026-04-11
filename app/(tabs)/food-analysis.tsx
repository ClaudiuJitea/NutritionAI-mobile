import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, Button, Card, ActivityIndicator, Portal } from 'react-native-paper';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { DatabaseService } from '../../src/services/database';
import { OpenRouterService } from '../../src/services/openrouter';
import { NutritionAnalysisResponse } from '../../src/types/api';
import { theme } from '../../src/constants/theme';
import { AppDialog } from '../../src/components/AppDialog';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type AnalysisStep = 'camera' | 'analyzing' | 'review' | 'saving';

const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  suffix?: string;
  style?: any;
}) => (
  <View style={[styles.formInputShell, style]}>
    <Text style={styles.formInputCaption}>{label}</Text>
    <View style={styles.formInputRow}>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType}
        style={styles.formInputNative}
      />
      {suffix ? <Text style={styles.formInputSuffix}>{suffix}</Text> : null}
    </View>
  </View>
);

export default function FoodAnalysisScreen() {
  const db = useSQLiteContext();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const dbService = new DatabaseService(db);
  const [openRouterService] = useState(() => new OpenRouterService());
  const cameraRef = useRef<CameraView>(null);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [step, setStep] = useState<AnalysisStep>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<NutritionAnalysisResponse | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType>((params.meal as MealType) || 'lunch');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDialogTitle, setErrorDialogTitle] = useState('Error');
  const [errorDialogMessage, setErrorDialogMessage] = useState('');
  const [errorDialogPrimaryLabel, setErrorDialogPrimaryLabel] = useState('OK');
  const [errorDialogSecondaryLabel, setErrorDialogSecondaryLabel] = useState<string | null>(null);
  const [errorDialogPrimaryAction, setErrorDialogPrimaryAction] = useState<(() => void) | null>(null);
  const [errorDialogSecondaryAction, setErrorDialogSecondaryAction] = useState<(() => void) | null>(null);
  const reviewBottomPadding = tabBarHeight + theme.spacing.xl;
  const cameraBottomPadding = insets.bottom + theme.spacing.xl;

  useEffect(() => {
    loadApiKey();
  }, []);

  const openErrorDialog = ({
    title,
    message,
    primaryLabel = 'OK',
    secondaryLabel = null,
    onPrimary,
    onSecondary,
  }: {
    title: string;
    message: string;
    primaryLabel?: string;
    secondaryLabel?: string | null;
    onPrimary?: () => void;
    onSecondary?: () => void;
  }) => {
    setErrorDialogTitle(title);
    setErrorDialogMessage(message);
    setErrorDialogPrimaryLabel(primaryLabel);
    setErrorDialogSecondaryLabel(secondaryLabel);
    setErrorDialogPrimaryAction(() => onPrimary ?? (() => setShowErrorDialog(false)));
    setErrorDialogSecondaryAction(() => onSecondary ?? (() => setShowErrorDialog(false)));
    setShowErrorDialog(true);
  };

  const dismissErrorDialog = () => {
    setShowErrorDialog(false);
  };

  const loadApiKey = async () => {
    try {
      const apiKey = await SecureStore.getItemAsync('openrouter_api_key');
      
      if (apiKey) {
        openRouterService.setApiKey(apiKey);
      }
    } catch (error) {
      console.error('Error loading API configuration:', error);
    }
  };

  const checkApiKey = async (): Promise<boolean> => {
    const apiKey = await SecureStore.getItemAsync('openrouter_api_key');
    console.log('API Key check:', apiKey ? 'Found' : 'Not found');
    if (!apiKey) {
      openErrorDialog({
        title: 'API Key Required',
        message: 'Please configure your OpenRouter API key in settings to use food analysis.',
        primaryLabel: 'Settings',
        secondaryLabel: 'Cancel',
        onPrimary: () => {
          dismissErrorDialog();
          router.push('/settings');
        },
        onSecondary: dismissErrorDialog,
      });
      return false;
    }
    return true;
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    
    if (!(await checkApiKey())) return;

    try {
      console.log('Taking picture...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false, // Allow Expo to process the image
      });
      
      console.log('Camera photo result:', {
        uri: photo?.uri,
        hasBase64: !!photo?.base64,
        base64Length: photo?.base64?.length || 0
      });
      
      if (photo?.base64) {
        // Validate base64 data
        if (photo.base64.length < 1000) {
          console.error('Base64 data seems too small:', photo.base64.length);
          openErrorDialog({
            title: 'Capture Failed',
            message: 'Image capture failed. Please try again.',
          });
          return;
        }
        
        setCapturedImage(photo.uri);
        await analyzeFood(photo.base64);
      } else {
        console.error('No base64 data from camera');
        openErrorDialog({
          title: 'Capture Failed',
          message: 'Failed to capture image data. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      openErrorDialog({
        title: 'Camera Error',
        message: 'Failed to take picture. Please try again.',
      });
    }
  };

  const pickImage = async () => {
    console.log('pickImage function called');
    try {
      // Check current media library permissions first
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      let finalStatus = existingStatus;

      // If not granted, request permission
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        openErrorDialog({
          title: 'Permission Required',
          message: 'We need access to your photo library to analyze existing photos. Please enable photo library access in your device settings.',
          primaryLabel: 'Open Settings',
          secondaryLabel: 'Cancel',
          onPrimary: () => {
            dismissErrorDialog();
            Linking.openSettings();
          },
          onSecondary: dismissErrorDialog,
        });
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.8,
        base64: true,
        exif: false,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.AUTOMATIC,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Selected image asset:', { uri: asset.uri, hasBase64: !!asset.base64 });
        
        // Check API key only after user has selected an image
        if (!(await checkApiKey())) return;
        
        if (asset.base64) {
          console.log('Setting captured image and starting analysis...');
          setCapturedImage(asset.uri);
          await analyzeFood(asset.base64);
        } else {
          console.log('No base64 data available');
          openErrorDialog({
            title: 'Image Error',
            message: 'Failed to process image. Please try again.',
          });
        }
      } else {
        console.log('Image selection was canceled or failed');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      openErrorDialog({
        title: 'Image Error',
        message: 'Failed to pick image. Please try again.',
      });
    }
  };

  const analyzeFood = async (base64Image: string) => {
    console.log('Starting food analysis...');
    console.log('Base64 image length:', base64Image.length);
    console.log('Base64 image starts with:', base64Image.substring(0, 50));
    
    setStep('analyzing');
    setIsLoading(true);

    try {
      // Validate base64 input
      if (!base64Image || base64Image.length < 1000) {
        throw new Error('Invalid image data. Please try taking another photo.');
      }

      // Test network connectivity first
      console.log('Testing network connectivity...');
      const testConnection = await openRouterService.testConnection();
      console.log('Network test result:', testConnection);
      
      if (!testConnection) {
        throw new Error('Unable to connect to OpenRouter API. Please check your internet connection and API key.');
      }

      console.log('Calling OpenRouter service...');
      const result = await openRouterService.analyzeFood(base64Image);
      console.log('Analysis result:', result);
      setAnalysisResult(result);
      
      // Parse the estimated_serving to extract quantity and unit
      const serving = result.estimated_serving.toLowerCase().trim();
      
      if (serving.includes('x serving')) {
        // Format: "1x serving", "2x serving", etc.
        const match = serving.match(/(\d+)x\s*serving/);
        if (match) {
          setQuantity(match[1] + 'x');
          setUnit('serving');
        } else {
          setQuantity('1x');
          setUnit('serving');
        }
      } else if (serving.includes('grams') || serving.includes('gram')) {
        // Format: "150 grams", "200 gram", etc.
        const match = serving.match(/(\d+)\s*grams?/);
        if (match) {
          setQuantity(match[1]);
          setUnit('grams');
        } else {
          setQuantity('100');
          setUnit('grams');
        }
      } else {
        // Fallback - try to extract any number and assume serving
        const match = serving.match(/(\d+)/);
        if (match) {
          setQuantity(match[1] + 'x');
          setUnit('serving');
        } else {
          setQuantity('1x');
          setUnit('serving');
        }
      }
      
      setStep('review');
    } catch (error) {
      console.error('Error analyzing food:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      let errorMessage = 'Failed to analyze food. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      openErrorDialog({
        title: 'Analysis Failed',
        message: errorMessage,
        primaryLabel: 'Retry',
        secondaryLabel: 'Cancel',
        onPrimary: () => {
          dismissErrorDialog();
          setStep('camera');
        },
        onSecondary: () => {
          dismissErrorDialog();
          router.back();
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveFoodEntry = async () => {
    if (!analysisResult) return;

    setStep('saving');
    setIsLoading(true);

    try {
      // Parse quantity and determine multiplier
      let quantityNum = 1;
      let multiplier = 1;
      
      if (unit === 'serving') {
        // For servings, parse the "2x" format and use as multiplier
        if (quantity.includes('x')) {
          const match = quantity.match(/(\d+)x/);
          quantityNum = match ? parseFloat(match[1]) : 1;
          multiplier = quantityNum; // Multiply nutrition values for multiple servings
        } else {
          quantityNum = parseFloat(quantity) || 1;
          multiplier = quantityNum;
        }
      } else {
        // For grams, the AI already calculated nutrition for the specific amount
        // So we don't multiply - just store the quantity as-is
        quantityNum = parseFloat(quantity) || 1;
        multiplier = 1; // Don't multiply nutrition values for grams
      }

      console.log('Saving food entry to database...', {
        food_description: analysisResult.food_description,
        quantity: quantityNum,
        unit: unit,
        meal_type: selectedMeal,
        food_category: analysisResult.food_category,
        calories: analysisResult.calories * multiplier,
        protein: analysisResult.protein * multiplier,
        carbs: analysisResult.carbs * multiplier,
        fat: analysisResult.fat * multiplier,
      });

      await dbService.addFoodEntry({
        user_id: 1,
        food_description: analysisResult.food_description,
        quantity: quantityNum,
        unit: unit,
        meal_type: selectedMeal,
        food_category: analysisResult.food_category,
        calories: analysisResult.calories * multiplier,
        protein: analysisResult.protein * multiplier,
        carbs: analysisResult.carbs * multiplier,
        fat: analysisResult.fat * multiplier,
        logged_date: format(new Date(), 'yyyy-MM-dd'),
      });

      console.log('Food entry saved successfully');
      setStep('review'); // Reset to review step
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Error saving food entry:', error);
      setStep('review'); // Reset to review step on error
      openErrorDialog({
        title: 'Save Failed',
        message: 'Failed to save food entry. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderErrorDialog = () => (
    <Portal>
      <AppDialog
        visible={showErrorDialog}
        onDismiss={dismissErrorDialog}
        title={errorDialogTitle}
        message={errorDialogMessage}
        tone="error"
        primaryAction={{
          label: errorDialogPrimaryLabel,
          onPress: () => (errorDialogPrimaryAction ?? dismissErrorDialog)(),
        }}
        secondaryAction={
          errorDialogSecondaryLabel
            ? {
                label: errorDialogSecondaryLabel,
                onPress: () => (errorDialogSecondaryAction ?? dismissErrorDialog)(),
                mode: 'outlined',
              }
            : undefined
        }
      />
    </Portal>
  );

  const renderSuccessDialog = () => (
    <Portal>
      <AppDialog
        visible={showSuccessDialog}
        onDismiss={() => {
          setShowSuccessDialog(false);
          resetAnalysis();
        }}
        title="Saved"
        message="Food entry has been saved to your log."
        tone="success"
        primaryAction={{
          label: 'Continue',
          onPress: () => {
            setShowSuccessDialog(false);
            resetAnalysis();
          },
        }}
      />
    </Portal>
  );

  const resetAnalysis = () => {
    setStep('camera');
    setCapturedImage(null);
    setAnalysisResult(null);
    setQuantity('1');
    setUnit('serving');
  };

  if (!permission) {
    return (
      <>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
        {renderErrorDialog()}
      </>
    );
  }

  if (!permission.granted) {
      return (
      <>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>We need your permission to show the camera</Text>
          <Button mode="contained" onPress={requestPermission} textColor={theme.colors.background}>
            Grant Permission
          </Button>
        </View>
        {renderErrorDialog()}
      </>
      );
  }

  if (step === 'camera') {
    return (
      <>
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
        <View pointerEvents="box-none" style={styles.cameraOverlay}>
          <View style={styles.topControls}>
            <Button
              mode="contained-tonal"
              onPress={() => router.back()}
              icon="close"
              style={styles.closeButton}
              textColor={theme.colors.text}
            >
              Close
            </Button>
            <Button
              mode="contained-tonal"
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              icon="camera-flip"
              style={styles.flipButton}
              textColor={theme.colors.text}
            >
              Flip
            </Button>
          </View>
          
          <View pointerEvents="none" style={styles.centerGuide}>
            <View style={styles.focusFrame} />
            <Text style={styles.guideText}>Center your food in the frame</Text>
          </View>
          
	          <View style={[styles.bottomControls, { paddingBottom: cameraBottomPadding }]}>
	            <View style={styles.captureTray}>
	              <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.galleryButton}>
	                <Ionicons name="image-outline" size={18} color={theme.colors.text} />
	                <Text style={styles.galleryButtonLabel}>Photos</Text>
	              </TouchableOpacity>
	              
	              <TouchableOpacity onPress={takePicture} activeOpacity={0.9} style={styles.captureButton}>
	                <Ionicons name="camera-outline" size={18} color={theme.colors.background} />
	                <Text style={styles.captureButtonLabel}>Capture</Text>
	              </TouchableOpacity>
	            </View>
	          </View>
        </View>
      </View>
        
        {renderSuccessDialog()}
          {renderErrorDialog()}
	      </>
	    );
	  }

  if (step === 'analyzing') {
      return (
      <>
        <View style={styles.loadingContainer}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          )}
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
          <Text style={styles.loadingText}>Analyzing your food...</Text>
          <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
        </View>
        {renderErrorDialog()}
      </>
    );
  }

  if (step === 'saving') {
      return (
      <>
        <View style={styles.loadingContainer}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          )}
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
          <Text style={styles.loadingText}>Saving to your food log...</Text>
          <Text style={styles.loadingSubtext}>This will only take a moment</Text>
        </View>
        {renderErrorDialog()}
      </>
    );
  }

  if (step === 'review' && analysisResult) {
    return (
      <>
        <ScrollView 
          style={styles.reviewContainer}
          contentContainerStyle={[styles.reviewContent, { paddingBottom: reviewBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
        {capturedImage && (
          <Image source={{ uri: capturedImage }} style={styles.reviewImage} />
        )}
        
        <Card style={styles.analysisCard}>
          <Card.Content>
            <Text style={styles.analysisTitle}>Analysis Result</Text>
            <Text style={styles.foodDescription}>{analysisResult.food_description}</Text>
            
            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceLabel}>Confidence: </Text>
              <Text style={[
                styles.confidenceValue,
                { color: 
                  analysisResult.confidence === 'high' ? theme.colors.success :
                  analysisResult.confidence === 'medium' ? theme.colors.warning :
                  theme.colors.error
                }
              ]}>
                {analysisResult.confidence.toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(analysisResult.calories)}</Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(analysisResult.protein)}g</Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(analysisResult.carbs)}g</Text>
                <Text style={styles.nutritionLabel}>Carbs</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(analysisResult.fat)}g</Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
        
        <Card style={styles.editCard}>
          <Card.Content>
            <Text style={styles.editTitle}>Adjust Details</Text>
            
            <View style={styles.quantityRow}>
              <FormInput
                label="Quantity"
                value={quantity}
                onChangeText={(text) => {
                  // Allow only numbers and 'x' character for serving format
                  if (unit === 'serving') {
                    // For servings, allow format like "1x", "2x", etc.
                    const cleaned = text.replace(/[^0-9x]/g, '');
                    if (cleaned.match(/^\d*x?$/)) {
                      setQuantity(cleaned);
                    }
                  } else {
                    // For grams, allow only numbers
                    const cleaned = text.replace(/[^0-9]/g, '');
                    setQuantity(cleaned);
                  }
                }}
                keyboardType="numeric"
                style={styles.quantityInput}
                placeholder={unit === 'serving' ? 'e.g., 1x, 2x' : 'e.g., 150, 200'}
              />
              <FormInput
                label="Unit"
                value={unit}
                onChangeText={(text) => {
                  // Only allow "serving" or "grams"
                  const lowercaseText = text.toLowerCase();
                  if (lowercaseText === 'serving' || lowercaseText === 'grams' || 
                      'serving'.startsWith(lowercaseText) || 'grams'.startsWith(lowercaseText)) {
                    setUnit(text);
                  }
                }}
                keyboardType="default"
                style={styles.unitInput}
                placeholder="serving or grams"
              />
            </View>
            
            <Text style={styles.mealLabel}>Meal Type</Text>
            <View style={styles.mealButtonsContainer}>
              {['breakfast', 'lunch', 'dinner', 'snack'].map((meal) => {
                const isSelected = selectedMeal === meal;
                return (
                  <TouchableOpacity
                    key={meal}
                    style={[
                      styles.mealButton,
                      isSelected && styles.mealButtonActive,
                    ]}
                    onPress={() => setSelectedMeal(meal as MealType)}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[
                        styles.mealButtonText,
                        isSelected && styles.mealButtonTextActive
                      ]}
                    >
                      {meal.charAt(0).toUpperCase() + meal.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card.Content>
        </Card>
        
        <View style={styles.reviewActions}>
          <Button
            mode="outlined"
            onPress={resetAnalysis}
            style={styles.retryButton}
            disabled={isLoading}
            textColor={theme.colors.primary}
          >
            Retake
          </Button>
          <Button
            mode="contained"
            onPress={saveFoodEntry}
            style={styles.saveButton}
            loading={isLoading}
            disabled={isLoading}
            textColor={theme.colors.background}
          >
            Save Entry
          </Button>
        </View>
        
        {/* Extra spacing to ensure buttons clear the Android navigation bar without excessive scrolling */}
        <View style={{ height: insets.bottom + 10 }} />
        
        </ScrollView>
        
        {renderSuccessDialog()}
          {renderErrorDialog()}
	      </>
	    );
	  }

  return (
    <>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
      {renderErrorDialog()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  permissionText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    paddingTop: 60,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  flipButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  centerGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
  },
  guideText: {
    color: 'white',
    fontSize: 16,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  bottomControls: {
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  galleryButton: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  captureButton: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
  },
  captureButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: theme.colors.background,
  },
  captureTray: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  galleryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: theme.colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
  },
  loader: {
    marginBottom: theme.spacing.lg,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  loadingSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  reviewContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  reviewContent: {
    padding: theme.spacing.lg,
  },
  reviewImage: {
    width: '100%',
    height: 200,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
  },
  analysisCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  foodDescription: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  confidenceLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  nutritionLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  editCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  formInputShell: {
    minHeight: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: theme.spacing.md,
  },
  formInputCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formInputNative: {
    flex: 1,
    paddingVertical: 0,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  formInputSuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  quantityInput: {
    flex: 1,
  },
  unitInput: {
    flex: 2,
  },
  mealLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  mealButtonsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.lg,
    padding: 4,
    marginTop: theme.spacing.sm,
  },
  mealButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg - 4,
  },
  mealButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  mealButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  mealButtonTextActive: {
    color: theme.colors.background,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  retryButton: {
    flex: 1,
    borderColor: theme.colors.primary,
  },
  saveButton: {
    flex: 2,
    backgroundColor: theme.colors.primary,
  },
  bottomSpacer: {
    height: 20, // Additional bottom spacing
  },
});
