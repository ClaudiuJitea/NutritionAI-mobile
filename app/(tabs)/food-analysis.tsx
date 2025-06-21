import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { Text, Button, Card, TextInput, SegmentedButtons, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
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

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type AnalysisStep = 'camera' | 'analyzing' | 'review' | 'saving';

export default function FoodAnalysisScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams();
  const [dbService] = useState(() => new DatabaseService(db));
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

  useEffect(() => {
    loadApiKey();
  }, []);

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
      Alert.alert(
        'API Key Required',
        'Please configure your OpenRouter API key in settings to use food analysis.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => router.push('/settings') },
        ]
      );
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
          Alert.alert('Error', 'Image capture failed. Please try again.');
          return;
        }
        
        setCapturedImage(photo.uri);
        await analyzeFood(photo.base64);
      } else {
        console.error('No base64 data from camera');
        Alert.alert('Error', 'Failed to capture image data. Please try again.');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
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
        Alert.alert(
          'Permission Required',
          'We need access to your photo library to analyze existing photos. Please enable photo library access in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                // Open device settings for this app
                Linking.openSettings();
              }
            },
          ]
        );
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
          Alert.alert('Error', 'Failed to process image. Please try again.');
        }
      } else {
        console.log('Image selection was canceled or failed');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
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
      
      Alert.alert(
        'Analysis Failed',
        errorMessage,
        [
          { text: 'Retry', onPress: () => setStep('camera') },
          { text: 'Cancel', onPress: () => router.back() },
        ]
      );
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
      Alert.alert('Error', 'Failed to save food entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAnalysis = () => {
    setStep('camera');
    setCapturedImage(null);
    setAnalysisResult(null);
    setQuantity('1');
    setUnit('serving');
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <Button mode="contained" onPress={requestPermission} textColor={theme.colors.background}>
          Grant Permission
        </Button>
      </View>
    );
  }

  if (step === 'camera') {
    return (
      <>
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
          <View style={styles.cameraOverlay}>
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
            
            <View style={styles.centerGuide}>
              <View style={styles.focusFrame} />
              <Text style={styles.guideText}>Center your food in the frame</Text>
            </View>
            
            <View style={styles.bottomControls}>
              <Button
                mode="contained-tonal"
                onPress={pickImage}
                icon="image"
                style={styles.galleryButton}
                textColor={theme.colors.text}
              >
                  Photos
              </Button>
              
              <Button
                mode="contained"
                onPress={takePicture}
                icon="camera"
                style={styles.captureButton}
                contentStyle={styles.captureButtonContent}
                textColor={theme.colors.background}
              >
                Capture
              </Button>
              
              <View style={styles.placeholder} />
            </View>
          </View>
        </CameraView>
      </View>
        
        {/* Success Dialog */}
        <Portal>
          <Dialog 
            visible={showSuccessDialog} 
            onDismiss={() => {
              setShowSuccessDialog(false);
              router.back();
            }}
            style={styles.successDialog}
          >
            <Dialog.Content style={styles.successDialogContent}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
              </View>
              <Text style={styles.successTitle}>Success!</Text>
              <Text style={styles.successMessage}>
                Food entry has been saved to your log.
              </Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.successDialogActions}>
              <Button
                mode="contained"
                onPress={() => {
                  setShowSuccessDialog(false);
                  router.back();
                }}
                style={styles.successButton}
                textColor={theme.colors.background}
              >
                OK
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </>
    );
  }

  if (step === 'analyzing') {
    return (
      <View style={styles.loadingContainer}>
        {capturedImage && (
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        )}
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        <Text style={styles.loadingText}>Analyzing your food...</Text>
        <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
      </View>
    );
  }

  if (step === 'saving') {
    return (
      <View style={styles.loadingContainer}>
        {capturedImage && (
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        )}
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        <Text style={styles.loadingText}>Saving to your food log...</Text>
        <Text style={styles.loadingSubtext}>This will only take a moment</Text>
      </View>
    );
  }

  if (step === 'review' && analysisResult) {
    return (
      <>
        <ScrollView 
          style={styles.reviewContainer}
          contentContainerStyle={styles.reviewContent}
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
              <TextInput
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
                mode="outlined"
                placeholder={unit === 'serving' ? 'e.g., 1x, 2x' : 'e.g., 150, 200'}
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
                style={styles.unitInput}
                mode="outlined"
                placeholder="serving or grams"
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
            
            <Text style={styles.mealLabel}>Meal Type</Text>
            <SegmentedButtons
              value={selectedMeal}
              onValueChange={(value: string) => setSelectedMeal(value as MealType)}
              buttons={[
                { value: 'breakfast', label: 'Breakfast' },
                { value: 'lunch', label: 'Lunch' },
                { value: 'dinner', label: 'Dinner' },
                { value: 'snack', label: 'Snack' },
              ]}
              style={styles.mealButtons}
            />
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
        
        {/* Bottom spacer to ensure content is not hidden behind navigation */}
        <View style={styles.bottomSpacer} />
        </ScrollView>
        
        {/* Success Dialog */}
        <Portal>
          <Dialog 
            visible={showSuccessDialog} 
            onDismiss={() => {
              setShowSuccessDialog(false);
              router.back();
            }}
            style={styles.successDialog}
          >
            <Dialog.Content style={styles.successDialogContent}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
              </View>
              <Text style={styles.successTitle}>Success!</Text>
              <Text style={styles.successMessage}>
                Food entry has been saved to your log.
              </Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.successDialogActions}>
              <Button
                mode="contained"
                onPress={() => {
                  setShowSuccessDialog(false);
                  router.back();
                }}
                style={styles.successButton}
                textColor={theme.colors.background}
              >
                OK
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </>
    );
  }

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
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
    flex: 1,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    paddingBottom: 120, // Increased to clear floating navigation
  },
  galleryButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  captureButton: {
    backgroundColor: theme.colors.primary,
  },
  captureButtonContent: {
    height: 60,
    width: 120,
  },
  placeholder: {
    width: 80,
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
    paddingBottom: 140, // Extra space for floating navigation
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
  mealButtons: {
    backgroundColor: theme.colors.surfaceVariant,
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
  // Success Dialog Styles
  successDialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    margin: theme.spacing.lg,
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
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successDialogActions: {
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  successButton: {
    backgroundColor: theme.colors.primary,
    minWidth: 120,
  },
});