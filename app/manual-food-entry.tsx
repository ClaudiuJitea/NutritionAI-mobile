import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, Card, TextInput, Button, SegmentedButtons } from 'react-native-paper';
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
  
  const [selectedMeal, setSelectedMeal] = useState<MealType>((params.meal as MealType) || 'lunch');
  const [foodDescription, setFoodDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

      Alert.alert(
        'Success',
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
          color={theme.colors.primary} 
        />
        <Text style={styles.title}>Add Food Entry</Text>
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
          Save Entry
        </Button>
      </View>

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
    height: theme.spacing.xl,
  },
});