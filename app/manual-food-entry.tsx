import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, Card, TextInput, Button, SegmentedButtons, Portal, Dialog } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { DatabaseService } from '../src/services/database';
import { theme } from '../src/constants/theme';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function ManualFoodEntryScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams();
  const [dbService] = useState(() => new DatabaseService(db));
  
  // Check if we're in edit mode
  const isEditMode = !!params.editId;
  const editId = params.editId ? parseInt(params.editId as string) : null;
  
  const [selectedMeal, setSelectedMeal] = useState<MealType>((params.meal as MealType) || 'lunch');
  const [foodDescription, setFoodDescription] = useState((params.foodDescription as string) || '');
  const [quantity, setQuantity] = useState((params.quantity as string) || '1');
  const [unit, setUnit] = useState((params.unit as string) || 'serving');
  const [calories, setCalories] = useState((params.calories as string) || '');
  const [protein, setProtein] = useState((params.protein as string) || '');
  const [carbs, setCarbs] = useState((params.carbs as string) || '');
  const [fat, setFat] = useState((params.fat as string) || '');
  const [category, setCategory] = useState((params.category as string) || '');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const saveFoodEntry = async () => {
    if (!foodDescription.trim()) {
      Alert.alert('Error', 'Please enter a food description.');
      return;
    }

    if (!calories || isNaN(Number(calories))) {
      Alert.alert('Error', 'Please enter valid calories.');
      return;
    }

    setIsLoading(true);
    try {
      if (isEditMode && editId) {
        // Update existing food entry
        await dbService.updateFoodEntry(editId, {
          food_description: foodDescription.trim(),
          quantity: parseFloat(quantity) || 1,
          unit: unit.trim(),
          meal_type: selectedMeal,
          food_category: category.trim() || undefined,
          calories: parseFloat(calories) || 0,
          protein: parseFloat(protein) || 0,
          carbs: parseFloat(carbs) || 0,
          fat: parseFloat(fat) || 0,
        });

        setSuccessMessage('Food entry has been updated.');
        setShowSuccessDialog(true);
      } else {
        // Add new food entry
      await dbService.addFoodEntry({
        user_id: 1,
        food_description: foodDescription.trim(),
        quantity: parseFloat(quantity) || 1,
        unit: unit.trim(),
        meal_type: selectedMeal,
        food_category: category.trim() || undefined,
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        logged_date: format(new Date(), 'yyyy-MM-dd'),
      });

      setSuccessMessage('Food entry has been saved to your log.');
      setShowSuccessDialog(true);
      }
    } catch (error) {
      console.error('Error saving food entry:', error);
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'save'} food entry. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const mealOptions = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'snack', label: 'Snack' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons 
          name="restaurant" 
          size={24} 
          color={theme.colors.textSecondary} 
        />
        <Text style={styles.title}>{isEditMode ? 'Edit Food Entry' : 'Add Food Entry'}</Text>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Food Details</Text>
          
          <TextInput
            label="Food Description *"
            value={foodDescription}
            onChangeText={setFoodDescription}
            style={styles.input}
            mode="outlined"
            placeholder="e.g., Grilled chicken breast"
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

          <View style={styles.row}>
            <TextInput
              label="Quantity *"
              value={quantity}
              onChangeText={setQuantity}
              style={[styles.input, styles.quantityInput]}
              mode="outlined"
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
              label="Unit"
              value={unit}
              onChangeText={setUnit}
              style={[styles.input, styles.unitInput]}
              mode="outlined"
              placeholder="serving, cup, oz, etc."
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

          <TextInput
            label="Category (Optional)"
            value={category}
            onChangeText={setCategory}
            style={styles.input}
            mode="outlined"
            placeholder="e.g., Protein, Vegetable, Grain"
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

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Nutrition Information</Text>
          
          <View style={styles.row}>
            <TextInput
              label="Calories *"
              value={calories}
              onChangeText={setCalories}
              style={[styles.input, styles.nutritionInput]}
              mode="outlined"
              keyboardType="numeric"
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
            <TextInput
              label="Protein"
              value={protein}
              onChangeText={setProtein}
              style={[styles.input, styles.nutritionInput]}
              mode="outlined"
              keyboardType="numeric"
              right={<TextInput.Affix text="g" />}
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

          <View style={styles.row}>
            <TextInput
              label="Carbs"
              value={carbs}
              onChangeText={setCarbs}
              style={[styles.input, styles.nutritionInput]}
              mode="outlined"
              keyboardType="numeric"
              right={<TextInput.Affix text="g" />}
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
              label="Fat"
              value={fat}
              onChangeText={setFat}
              style={[styles.input, styles.nutritionInput]}
              mode="outlined"
              keyboardType="numeric"
              right={<TextInput.Affix text="g" />}
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
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Meal Type</Text>
          <SegmentedButtons
            value={selectedMeal}
            onValueChange={(value) => setSelectedMeal(value as MealType)}
            buttons={mealOptions}
            style={styles.segmentedButtons}
            theme={{
              colors: {
                secondaryContainer: theme.colors.primary,
                onSecondaryContainer: theme.colors.background,
                outline: theme.colors.border,
                onSurface: theme.colors.text,
              }
            }}
          />
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.cancelButton}
          disabled={isLoading}
          textColor={theme.colors.textSecondary}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={saveFoodEntry}
          style={styles.saveButton}
          loading={isLoading}
          disabled={isLoading}
          textColor={theme.colors.background}
        >
{isEditMode ? 'Update Entry' : 'Save Entry'}
        </Button>
      </View>

      <View style={styles.bottomSpacing} />

      {/* Custom Success Dialog */}
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
              <Ionicons name="checkmark-circle" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.successTitle}>Success</Text>
            <Text style={styles.successMessage}>
              {successMessage}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  card: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  input: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  quantityInput: {
    flex: 1,
  },
  unitInput: {
    flex: 2,
  },
  nutritionInput: {
    flex: 1,
  },
  segmentedButtons: {
    marginTop: theme.spacing.sm,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    borderColor: theme.colors.border,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  bottomSpacing: {
    height: 120,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  successMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  successDialogActions: {
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  successButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
  },
});