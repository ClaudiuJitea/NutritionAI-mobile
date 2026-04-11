import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, IconButton, Chip, Portal, Button } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { DatabaseService } from '../../src/services/database';
import { FoodEntry } from '../../src/types/database';
import { theme } from '../../src/constants/theme';
import { AppDialog } from '../../src/components/AppDialog';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: 'sunny',
  lunch: 'partly-sunny',
  dinner: 'moon',
  snack: 'cafe',
};

const EMPTY_MEAL_ICONS: Record<MealType, string> = {
  breakfast: 'cafe-outline',
  lunch: 'restaurant-outline',
  dinner: 'fish-outline',
  snack: 'ice-cream-outline',
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export default function FoodLogScreen() {
  const db = useSQLiteContext();
  const tabBarHeight = useBottomTabBarHeight();
  const dbService = new DatabaseService(db);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [showDeleteError, setShowDeleteError] = useState(false);

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  const loadFoodEntries = async () => {
    try {
      const entries = await dbService.getFoodEntriesByDate(dateString);
      setFoodEntries(entries);
    } catch (error) {
      console.error('Error loading food entries:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFoodEntries();
    setRefreshing(false);
  };

  const deleteFoodEntry = (id: number) => {
    setEntryToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDeleteEntry = async () => {
    if (entryToDelete) {
            try {
        await dbService.deleteFoodEntry(entryToDelete);
              await loadFoodEntries();
        setShowDeleteDialog(false);
        setEntryToDelete(null);
            } catch (error) {
              console.error('Error deleting food entry:', error);
              setShowDeleteError(true);
        setShowDeleteDialog(false);
        setEntryToDelete(null);
            }
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setEntryToDelete(null);
  };

  useEffect(() => {
    loadFoodEntries();
  }, [selectedDate]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadFoodEntries();
    }, [selectedDate])
  );

  const groupedEntries = foodEntries.reduce((acc, entry) => {
    const mealType = entry.meal_type as MealType;
    if (!acc[mealType]) {
      acc[mealType] = [];
    }
    acc[mealType].push(entry);
    return acc;
  }, {} as Record<MealType, FoodEntry[]>);

  const getMealTotals = (entries: FoodEntry[]) => {
    return entries.reduce(
      (totals, entry) => ({
        calories: totals.calories + entry.calories,
        protein: totals.protein + entry.protein,
        carbs: totals.carbs + entry.carbs,
        fat: totals.fat + entry.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const totalCalories = foodEntries.reduce((sum, entry) => sum + entry.calories, 0);

  const FoodEntryCard = ({ entry }: { entry: FoodEntry }) => (
    <Card style={styles.entryCard}>
      <Card.Content style={styles.entryContent}>
        <View style={styles.entryHeader}>
          <View style={styles.entryInfo}>
            <Text style={styles.entryTitle} numberOfLines={2} ellipsizeMode="tail">
              {entry.food_description}
            </Text>
            <Text style={styles.entryDetails} numberOfLines={1} ellipsizeMode="tail">
              {entry.quantity} {entry.unit}
            </Text>
          </View>
          <View style={styles.entryRightSection}>
            {entry.food_category && (
              <Chip 
                style={styles.categoryChip} 
                textStyle={styles.categoryText}
                compact
              >
                {entry.food_category}
              </Chip>
            )}
            <View style={styles.entryActions}>
              <IconButton
                icon="pencil"
                size={20}
                iconColor={theme.colors.textSecondary}
                onPress={() => router.push({
                  pathname: '/manual-food-entry',
                  params: {
                    editId: entry.id.toString(),
                    meal: entry.meal_type,
                    foodDescription: entry.food_description,
                    quantity: entry.quantity.toString(),
                    unit: entry.unit,
                    category: entry.food_category || '',
                    calories: entry.calories.toString(),
                    protein: entry.protein.toString(),
                    carbs: entry.carbs.toString(),
                    fat: entry.fat.toString(),
                  }
                })}
              />
          <IconButton
            icon="delete"
            size={20}
            iconColor={theme.colors.error}
            onPress={() => deleteFoodEntry(entry.id)}
          />
            </View>
          </View>
        </View>
        
        <View style={styles.nutritionRow}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{Math.round(entry.calories)}</Text>
            <Text style={styles.nutritionLabel}>cal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{Math.round(entry.protein)}g</Text>
            <Text style={styles.nutritionLabel}>protein</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{Math.round(entry.carbs)}g</Text>
            <Text style={styles.nutritionLabel}>carbs</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{Math.round(entry.fat)}g</Text>
            <Text style={styles.nutritionLabel}>fat</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const MealSection = ({ mealType }: { mealType: MealType }) => {
    const entries = groupedEntries[mealType] || [];
    const totals = getMealTotals(entries);

    return (
      <View style={styles.mealSection}>
        <View style={styles.mealHeader}>
          <View style={styles.mealTitleRow}>
            <Ionicons 
              name={MEAL_ICONS[mealType] as any} 
              size={20} 
              color={theme.colors.textSecondary} 
            />
            <Text style={styles.mealTitle}>{MEAL_LABELS[mealType]}</Text>
          </View>
          <View style={styles.mealHeaderRight}>
            {entries.length > 0 && (
              <Text style={styles.mealCalories}>
                {Math.round(totals.calories)} cal
              </Text>
            )}
            <IconButton
               icon="plus"
               size={20}
               iconColor={theme.colors.textSecondary}
               style={styles.addButton}
               onPress={() => router.push(`/manual-food-entry?meal=${mealType}`)}
             />
          </View>
        </View>
        
        {entries.length === 0 ? (
          <Card style={styles.emptyMealCard}>
            <Card.Content style={styles.emptyMealContent}>
              <View style={styles.emptyMealIcon}>
                <Ionicons
                  name={EMPTY_MEAL_ICONS[mealType] as any}
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.emptyMealText}>Nothing logged yet</Text>
              <Text style={styles.emptyMealSubtext}>Tap + to add food for this meal</Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            {entries.map((entry) => (
              <FoodEntryCard key={entry.id} entry={entry} />
            ))}
            <TouchableOpacity
              onPress={() => router.push(`/manual-food-entry?meal=${mealType}`)}
              activeOpacity={0.7}
            >
              <Card style={styles.addMoreCard}>
                <Card.Content style={styles.addMoreContent}>
                  <IconButton
                     icon="plus"
                     size={16}
                     iconColor={theme.colors.textSecondary}
                     style={styles.addMoreButton}
                     onPress={() => router.push(`/manual-food-entry?meal=${mealType}`)}
                   />
                  <Text style={styles.addMoreText}>Add more food</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Date Header */}
      <View style={styles.dateHeader}>
        <IconButton
          icon="chevron-left"
          size={24}
          iconColor={theme.colors.text}
          onPress={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() - 1);
            setSelectedDate(newDate);
          }}
        />
        <View style={styles.dateInfo}>
          <Text style={styles.dateText}>
            {format(selectedDate, 'EEEE, MMMM d')}
          </Text>
          <Text style={styles.totalCalories}>
            {Math.round(totalCalories)} calories total
          </Text>
        </View>
        <IconButton
          icon="chevron-right"
          size={24}
          iconColor={theme.colors.text}
          onPress={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + 1);
            setSelectedDate(newDate);
          }}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: tabBarHeight + theme.spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <MealSection mealType="breakfast" />
        <MealSection mealType="lunch" />
        <MealSection mealType="dinner" />
        <MealSection mealType="snack" />

        <View style={[styles.analyzeActionContainer, { marginBottom: theme.spacing.md }]}>
          <Button
            mode="contained"
            onPress={() => router.push('/(tabs)/food-analysis')}
            style={styles.analyzeButton}
            contentStyle={styles.analyzeButtonContent}
            icon={({ size, color }) => (
              <Ionicons name="camera" size={size} color={color} />
            )}
            textColor={theme.colors.background}
          >
            Analyze Food
          </Button>
        </View>
      </ScrollView>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <AppDialog
          visible={showDeleteDialog}
          onDismiss={cancelDelete}
          title="Delete Entry"
          message="Are you sure you want to delete this food entry?"
          tone="error"
          icon="trash"
          primaryAction={{
            label: 'Delete',
            onPress: confirmDeleteEntry,
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: cancelDelete,
            mode: 'outlined',
          }}
        />
        <AppDialog
          visible={showDeleteError}
          onDismiss={() => setShowDeleteError(false)}
          title="Delete Failed"
          message="We couldn't remove this food entry. Please try again."
          tone="error"
          primaryAction={{
            label: 'OK',
            onPress: () => setShowDeleteError(false),
          }}
        />
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dateInfo: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  totalCalories: {
    fontSize: 13,
    color: theme.colors.primary,
    marginTop: 4,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  mealSection: {
    marginBottom: theme.spacing.md,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  mealHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealCalories: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
    marginRight: theme.spacing.xs,
  },
  addButton: {
    margin: 0,
  },
  emptyMealCard: {
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: 'rgba(18,214,176,0.18)',
    borderRadius: theme.borderRadius.xl,
  },
  emptyMealContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyMealIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,214,176,0.12)',
    marginBottom: theme.spacing.sm,
  },
  emptyMealText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  emptyMealSubtext: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  entryCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  entryContent: {
    paddingVertical: 18,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  entryInfo: {
    flex: 1,
  },
  entryRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  entryDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  categoryChip: {
    backgroundColor: theme.colors.surfaceVariant,
    maxWidth: 80,
  },
  categoryText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  nutritionRow: {
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
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  nutritionLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  analyzeActionContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  analyzeButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
  },
  analyzeButtonContent: {
    height: 54,
  },
  addMoreCard: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(18,214,176,0.16)',
    elevation: 0,
    shadowOpacity: 0,
  },
  addMoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  addMoreButton: {
    margin: 0,
    marginRight: theme.spacing.xs,
  },
  addMoreText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
