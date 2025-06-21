import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, Button, ProgressBar } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as SecureStore from 'expo-secure-store';
import { DatabaseService } from '../../src/services/database';
import { OpenRouterService } from '../../src/services/openrouter';
import { DailyNutrition, User } from '../../src/types/database';
import { theme } from '../../src/constants/theme';

// Embedded nutrition tips that will be shown when no API key is available
const NUTRITION_TIPS = [
  "Drink a glass of water before each meal to aid digestion and control appetite.",
  "Fill half your plate with vegetables and fruits for optimal nutrition.",
  "Choose whole fruits over fruit juices to get more fiber and less sugar.",
  "Include a source of protein in every meal to maintain muscle mass.",
  "Opt for whole grains instead of refined grains for better nutrients.",
  "Include healthy fats like avocados, nuts, and olive oil in your diet.",
  "Eat regular meals and snacks to maintain stable blood sugar levels.",
  "Limit processed foods which are often high in sodium and preservatives.",
  "Practice mindful eating by eating slowly and paying attention to hunger cues.",
  "Eat a variety of colorful foods to ensure you get diverse nutrients."
];

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const [dbService] = useState(() => new DatabaseService(db));
  const [openRouterService] = useState(() => new OpenRouterService());
  const [dailyNutrition, setDailyNutrition] = useState<DailyNutrition>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    water: 0,
  });
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [consistencyDays, setConsistencyDays] = useState(0);
  const [currentTip, setCurrentTip] = useState(NUTRITION_TIPS[0]);
  const [isLoadingTip, setIsLoadingTip] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const loadData = async () => {
    try {
      const [nutrition, userData, consistency] = await Promise.all([
        dbService.getDailyTotals(today),
        dbService.getUser(),
        dbService.getConsistencyDays(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          new Date()
        ),
      ]);
      
      setDailyNutrition(nutrition);
      setUser(userData);
      setConsistencyDays(consistency);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    loadSavedModelAndTip();
  }, []);

  const loadSavedModelAndTip = async () => {
    try {
      // Load API key and set nutrition tip
      const apiKey = await SecureStore.getItemAsync('openrouter_api_key');
      
      if (apiKey) {
        openRouterService.setApiKey(apiKey);
      }
      
      // Then load nutrition tip
      await loadNutritionTip();
    } catch (error) {
      console.error('Error loading API configuration in dashboard:', error);
      // Fallback to loading tip anyway
      await loadNutritionTip();
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const calorieProgress = user ? dailyNutrition.calories / user.calorie_goal : 0;
  const waterProgress = user ? dailyNutrition.water / user.water_goal : 0;

  const loadNutritionTip = async () => {
    try {
      const apiKey = await SecureStore.getItemAsync('openrouter_api_key');
      if (apiKey) {
        setIsLoadingTip(true);
        openRouterService.setApiKey(apiKey);
        
        // Try to generate AI nutrition tip
        try {
          const aiTip = await openRouterService.generateNutritionTip();
          setCurrentTip(aiTip);
        } catch (aiError) {
          console.error('Failed to generate AI tip:', aiError);
          // Fall back to curated tip if AI fails
          const randomTip = NUTRITION_TIPS[Math.floor(Math.random() * NUTRITION_TIPS.length)];
          setCurrentTip(randomTip);
        }
      } else {
        // Use curated tips when no API key
        setIsLoadingTip(true);
        const randomTip = NUTRITION_TIPS[Math.floor(Math.random() * NUTRITION_TIPS.length)];
        setCurrentTip(randomTip);
      }
    } catch (error) {
      console.error('Error loading nutrition tip:', error);
      const randomTip = NUTRITION_TIPS[Math.floor(Math.random() * NUTRITION_TIPS.length)];
      setCurrentTip(randomTip);
    } finally {
      setIsLoadingTip(false);
    }
  };

  const MacroCard = ({ title, current, goal, unit, color }: {
    title: string;
    current: number;
    goal?: number;
    unit: string;
    color: string;
  }) => (
    <Card style={styles.macroCard}>
      <Card.Content style={styles.macroContent}>
        <Text style={[styles.macroTitle, { color: theme.colors.textSecondary }]}>
          {title}
        </Text>
        <Text style={[styles.macroValue, { color }]}>
          {Math.round(current)}
        </Text>
        <Text style={[styles.macroUnit, { color: theme.colors.textSecondary }]}>
          {unit}
        </Text>
        {goal && (
          <Text style={[styles.macroGoal, { color: theme.colors.textSecondary }]}>
            / {goal}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const NutritionTipsCard = () => (
    <Card style={styles.tipsCard}>
      <Card.Content>
        <View style={styles.tipsHeader}>
          <Text style={styles.tipsTitle}>Nutrition Tip</Text>
          <Button
            mode="text"
            onPress={loadNutritionTip}
            loading={isLoadingTip}
            disabled={isLoadingTip}
            compact
            textColor={theme.colors.primary}
          >
            New Tip
          </Button>
        </View>
        <Text style={styles.tipText}>
          {currentTip}
        </Text>
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>Good {getTimeOfDay()},</Text>
            <Text style={styles.nameText}>{user?.name || 'User'}!</Text>
          </View>
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Button
          mode="contained"
          onPress={() => router.push('/(tabs)/food-analysis')}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
          icon={({ size, color }) => (
            <Ionicons name="camera" size={size} color={color} />
          )}
        >
          Analyze Food
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.push('/(tabs)/water')}
          style={styles.secondaryButton}
          contentStyle={styles.buttonContent}
          textColor={theme.colors.primary}
        >
          Log Water
        </Button>
      </View>

      {/* Calorie Progress */}
      <TouchableOpacity 
        onPress={() => router.push('/(tabs)/analytics')}
        activeOpacity={0.7}
      >
      <Card style={styles.progressCard}>
        <Card.Content>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Daily Calories</Text>
              <View style={styles.progressValueContainer}>
            <Text style={styles.progressValue}>
              {Math.round(dailyNutrition.calories)} / {user?.calorie_goal || 2000}
            </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={16} 
                  color={theme.colors.textSecondary} 
                />
              </View>
          </View>
          <ProgressBar
            progress={Math.min(calorieProgress, 1)}
            color={calorieProgress > 1 ? theme.colors.error : theme.colors.primary}
            style={styles.progressBar}
          />
          <Text style={styles.progressPercent}>
            {Math.round(calorieProgress * 100)}% of goal
          </Text>
        </Card.Content>
      </Card>
      </TouchableOpacity>

      {/* Water Progress */}
      <TouchableOpacity 
        onPress={() => router.push('/(tabs)/analytics?chart=water')}
        activeOpacity={0.7}
      >
      <Card style={styles.progressCard}>
        <Card.Content>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Water Intake</Text>
              <View style={styles.progressValueContainer}>
            <Text style={styles.progressValue}>
              {Math.round(dailyNutrition.water)} / {user?.water_goal || 2500} ml
            </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={16} 
                  color={theme.colors.textSecondary} 
                />
              </View>
          </View>
          <ProgressBar
            progress={Math.min(waterProgress, 1)}
            color={waterProgress > 1 ? theme.colors.error : theme.colors.chart.calories}
            style={styles.progressBar}
          />
          <Text style={styles.progressPercent}>
            {Math.round(waterProgress * 100)}% of goal
          </Text>
        </Card.Content>
      </Card>
      </TouchableOpacity>

      {/* Macronutrients */}
      <Text style={styles.sectionTitle}>Today's Macros</Text>
      <View style={styles.macroGrid}>
        <MacroCard
          title="Protein"
          current={dailyNutrition.protein}
          unit="g"
          color={theme.colors.chart.protein}
        />
        <MacroCard
          title="Carbs"
          current={dailyNutrition.carbs}
          unit="g"
          color={theme.colors.chart.carbs}
        />
        <MacroCard
          title="Fat"
          current={dailyNutrition.fat}
          unit="g"
          color={theme.colors.chart.fat}
        />
      </View>

      {/* Nutrition Tips */}
      <NutritionTipsCard />
      
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 4,
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '400',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    flex: 1,
    borderColor: theme.colors.primary,
  },
  buttonContent: {
    height: 48,
  },
  progressCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  progressValue: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  progressValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceVariant,
  },
  progressPercent: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  macroGrid: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  macroCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  macroContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  macroTitle: {
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  macroUnit: {
    fontSize: 12,
    marginTop: 2,
  },
  macroGoal: {
    fontSize: 10,
    marginTop: 2,
  },
  consistencyCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
  },
  consistencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  consistencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  consistencyValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  consistencySubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  tipsCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  tipText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 120,
  },
});