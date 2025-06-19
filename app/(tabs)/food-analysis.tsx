import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { Text, Button, Card, TextInput, SegmentedButtons, ActivityIndicator } from 'react-native-paper';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
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
      console.error('Error loading API key:', error);
    }
  };

  const checkApiKey = async (): Promise<boolean> => {
    const apiKey = await SecureStore.getItemAsync('openrouter_api_key');
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
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      
      if (photo?.base64) {
        setCapturedImage(photo.uri);
        await analyzeFood(photo.base64);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const pickImage = async () => {
    if (!(await checkApiKey())) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setCapturedImage(result.assets[0].uri);
        await analyzeFood(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const analyzeFood = async (base64Image: string) => {
    setStep('analyzing');
    setIsLoading(true);

    try {
      const result = await openRouterService.analyzeFood(base64Image);
      setAnalysisResult(result);
      setQuantity(result.estimated_serving.split(' ')[0] || '1');
      setUnit(result.estimated_serving.split(' ').slice(1).join(' ') || 'serving');
      setStep('review');
    } catch (error) {
      console.error('Error analyzing food:', error);
      Alert.alert(
        'Analysis Failed',
        error instanceof Error ? error.message : 'Failed to analyze food. Please try again.',
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
      const quantityNum = parseFloat(quantity) || 1;
      const multiplier = quantityNum;

      await dbService.addFoodEntry({
        user_id: 1,
        food_description: analysisResult.food_description,
        quantity: quantityNum,
        unit: unit,
        meal_type: selectedMeal,
        food_category: 'AI Analyzed',
        calories: analysisResult.calories * multiplier,
        protein: analysisResult.protein * multiplier,
        carbs: analysisResult.carbs * multiplier,
        fat: analysisResult.fat * multiplier,
        logged_date: format(new Date(), 'yyyy-MM-dd'),
      });

      Alert.alert(
        'Success!',
        'Food entry has been saved to your log.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving food entry:', error);
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
                Gallery
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

  if (step === 'review' && analysisResult) {
    return (
      <View style={styles.reviewContainer}>
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
                onChangeText={setQuantity}
                keyboardType="numeric"
                style={styles.quantityInput}
                mode="outlined"
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
                onChangeText={setUnit}
                style={styles.unitInput}
                mode="outlined"
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
      </View>
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
    paddingBottom: 40,
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
});