import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, Card, Button, Portal } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { DatabaseService } from '../src/services/database';
import { theme } from '../src/constants/theme';
import { AppDialog } from '../src/components/AppDialog';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

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
  <View style={[styles.inputShell, style]}>
    <Text style={styles.inputCaption}>{label}</Text>
    <View style={styles.inputRowShell}>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType}
        style={styles.inputNative}
      />
      {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
    </View>
  </View>
);

export default function ManualFoodEntryScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams();
  const dbService = new DatabaseService(db);
  
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
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: 'Error',
    message: '',
  });

  const showMessage = (title: string, message: string) => {
    setDialogState({ visible: true, title, message });
  };

  const saveFoodEntry = async () => {
    if (!foodDescription.trim()) {
      showMessage('Food Description Required', 'Please enter a food description before saving.');
      return;
    }

    if (!calories || isNaN(Number(calories))) {
      showMessage('Calories Required', 'Please enter a valid calorie value to continue.');
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
      showMessage('Save Failed', `Failed to ${isEditMode ? 'update' : 'save'} food entry. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Ionicons 
            name="restaurant" 
            size={22} 
            color={theme.colors.primary} 
          />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{isEditMode ? 'Edit meal' : 'Manual entry'}</Text>
          <Text style={styles.title}>{isEditMode ? 'Refine your food log' : 'Log a food item'}</Text>
        </View>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Food Details</Text>
          
          <FormInput
            label="Food Description"
            value={foodDescription}
            onChangeText={setFoodDescription}
            placeholder="e.g., Grilled chicken breast"
            style={styles.fullInput}
          />

          <View style={styles.row}>
            <FormInput
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              style={styles.quantityInput}
              keyboardType="numeric"
            />
            <FormInput
              label="Unit"
              value={unit}
              onChangeText={setUnit}
              style={styles.unitInput}
              placeholder="serving, cup, oz, etc."
            />
          </View>

          <FormInput
            label="Category"
            value={category}
            onChangeText={setCategory}
            style={styles.fullInput}
            placeholder="e.g., Protein, Vegetable, Grain"
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Nutrition Information</Text>
          
          <View style={styles.row}>
            <FormInput
              label="Calories"
              value={calories}
              onChangeText={setCalories}
              style={styles.nutritionInput}
              keyboardType="numeric"
              suffix="cal"
            />
            <FormInput
              label="Protein"
              value={protein}
              onChangeText={setProtein}
              style={styles.nutritionInput}
              keyboardType="numeric"
              suffix="g"
            />
          </View>

          <View style={styles.row}>
            <FormInput
              label="Carbs"
              value={carbs}
              onChangeText={setCarbs}
              style={styles.nutritionInput}
              keyboardType="numeric"
              suffix="g"
            />
            <FormInput
              label="Fat"
              value={fat}
              onChangeText={setFat}
              style={styles.nutritionInput}
              keyboardType="numeric"
              suffix="g"
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Meal Type</Text>
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
        <AppDialog
          visible={showSuccessDialog} 
          onDismiss={() => {
            setShowSuccessDialog(false);
            router.back();
          }}
          title="Saved"
          message={successMessage}
          tone="success"
          primaryAction={{
            label: 'Continue',
            onPress: () => {
              setShowSuccessDialog(false);
              router.back();
            },
          }}
        />
        <AppDialog
          visible={dialogState.visible}
          onDismiss={() => setDialogState((prev) => ({ ...prev, visible: false }))}
          title={dialogState.title}
          message={dialogState.message}
          tone="error"
          primaryAction={{
            label: 'OK',
            onPress: () => setDialogState((prev) => ({ ...prev, visible: false })),
          }}
        />
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
    gap: theme.spacing.md,
  },
  headerBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,214,176,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(18,214,176,0.2)',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  card: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
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
  inputRowShell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputNative: {
    flex: 1,
    paddingVertical: 0,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  inputSuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
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
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
  },
  bottomSpacing: {
    height: 40,
  },
});
