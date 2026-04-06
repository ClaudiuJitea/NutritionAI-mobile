import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, Button, ProgressBar } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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

const RECENT_TIPS_STORAGE_KEY = 'recent_nutrition_tips';
const MAX_RECENT_TIPS = 8;

function normalizeTip(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWordSet(text: string): Set<string> {
  return new Set(
    normalizeTip(text)
      .split(' ')
      .filter((word) => word.length > 3)
  );
}

function areTipsTooSimilar(first: string, second: string): boolean {
  const normalizedFirst = normalizeTip(first);
  const normalizedSecond = normalizeTip(second);

  if (!normalizedFirst || !normalizedSecond) {
    return false;
  }

  if (normalizedFirst === normalizedSecond) {
    return true;
  }

  const firstWords = getWordSet(first);
  const secondWords = getWordSet(second);

  if (firstWords.size === 0 || secondWords.size === 0) {
    return false;
  }

  const overlap = [...firstWords].filter((word) => secondWords.has(word)).length;
  const overlapRatio = overlap / Math.min(firstWords.size, secondWords.size);

  return overlapRatio >= 0.7;
}

function sanitizeTip(rawTip: string): string {
  return rawTip.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const tabBarHeight = useBottomTabBarHeight();
  const dbService = new DatabaseService(db);
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
  const [recentTips, setRecentTips] = useState<string[]>([]);

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
      let savedTips: string[] = [];
      const savedTipsRaw = await SecureStore.getItemAsync(RECENT_TIPS_STORAGE_KEY);
      if (savedTipsRaw) {
        const parsedTips = JSON.parse(savedTipsRaw);
        if (Array.isArray(parsedTips)) {
          savedTips = parsedTips.filter((tip): tip is string => typeof tip === 'string');
          setRecentTips(savedTips);
        }
      }

      // Load API key and set nutrition tip
      const apiKey = await SecureStore.getItemAsync('openrouter_api_key');
      
      if (apiKey) {
        openRouterService.setApiKey(apiKey);
      }
      
      // Then load nutrition tip
      await loadNutritionTip(savedTips);
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

  const saveTipHistory = async (tip: string, existingTips = recentTips) => {
    const cleanTip = sanitizeTip(tip);
    const updatedTips = [cleanTip, ...existingTips.filter((existingTip) => !areTipsTooSimilar(existingTip, cleanTip))]
      .slice(0, MAX_RECENT_TIPS);

    setRecentTips(updatedTips);
    await SecureStore.setItemAsync(RECENT_TIPS_STORAGE_KEY, JSON.stringify(updatedTips));
  };

  const getCuratedFallbackTip = (existingTips = recentTips) => {
    const disallowedTips = [currentTip, ...existingTips];
    const freshTip = NUTRITION_TIPS.find(
      (tip) => !disallowedTips.some((existingTip) => areTipsTooSimilar(existingTip, tip))
    );

    return freshTip || NUTRITION_TIPS[Math.floor(Math.random() * NUTRITION_TIPS.length)];
  };

  const requestUniqueAiTip = async (apiKey: string, existingTips = recentTips) => {
    let attemptHistory = [currentTip, ...existingTips].filter(Boolean);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      openRouterService.setApiKey(apiKey);

      const aiTip = sanitizeTip(await openRouterService.generateNutritionTip({
        currentTip,
        recentTips: attemptHistory,
        calorieGoal: user?.calorie_goal,
        waterGoal: user?.water_goal,
        currentCalories: dailyNutrition.calories,
        currentWater: dailyNutrition.water,
        weightGoal: user?.weight_goal,
        activityLevel: user?.activity_level,
      }));

      const isTooSimilar = attemptHistory.some((previousTip) => areTipsTooSimilar(previousTip, aiTip));
      if (!isTooSimilar) {
        return aiTip;
      }

      attemptHistory = [aiTip, ...attemptHistory];
    }

    throw new Error('AI returned repeated nutrition tips');
  };

  const loadNutritionTip = async (existingTips = recentTips) => {
    try {
      const apiKey = await SecureStore.getItemAsync('openrouter_api_key');
      if (apiKey) {
        setIsLoadingTip(true);
        openRouterService.setApiKey(apiKey);
        
        // Try to generate AI nutrition tip
        try {
          const aiTip = await requestUniqueAiTip(apiKey, existingTips);
          setCurrentTip(aiTip);
          await saveTipHistory(aiTip, existingTips);
        } catch (aiError) {
          console.error('Failed to generate AI tip:', aiError);
          // Fall back to curated tip if AI fails
          const fallbackTip = getCuratedFallbackTip(existingTips);
          setCurrentTip(fallbackTip);
          await saveTipHistory(fallbackTip, existingTips);
        }
      } else {
        // Use curated tips when no API key
        setIsLoadingTip(true);
        const fallbackTip = getCuratedFallbackTip(existingTips);
        setCurrentTip(fallbackTip);
        await saveTipHistory(fallbackTip, existingTips);
      }
    } catch (error) {
      console.error('Error loading nutrition tip:', error);
      const fallbackTip = getCuratedFallbackTip(existingTips);
      setCurrentTip(fallbackTip);
      await saveTipHistory(fallbackTip, existingTips);
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
    <Card style={[styles.macroCard, { borderColor: `${color}33` }]}>
      <Card.Content style={styles.macroContent}>
        <View style={[styles.macroAccent, { backgroundColor: color }]} />
        <Text style={[styles.macroTitle, { color }]}>{title}</Text>
        <Text style={[styles.macroValue, { color }]}>
          {Math.round(current)}
        </Text>
        <View style={styles.macroMetaRow}>
          <Text style={[styles.macroUnit, { color: theme.colors.textSecondary }]}>
            {unit}
          </Text>
          {goal && (
            <Text style={[styles.macroGoal, { color: theme.colors.textSecondary }]}>
              Target {goal}{unit}
            </Text>
          )}
        </View>
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
            onPress={() => {
              void loadNutritionTip();
            }}
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
      contentContainerStyle={{ paddingBottom: tabBarHeight + theme.spacing.xl }}
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
          <View style={styles.datePill}>
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
            <Text style={styles.progressTitle}>Water</Text>
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
          unit="grams"
          color={theme.colors.chart.protein}
        />
        <MacroCard
          title="Carbs"
          current={dailyNutrition.carbs}
          unit="grams"
          color={theme.colors.chart.carbs}
        />
        <MacroCard
          title="Fat"
          current={dailyNutrition.fat}
          unit="grams"
          color={theme.colors.chart.fat}
        />
      </View>

      {/* Nutrition Tips */}
      <NutritionTipsCard />
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
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  nameText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 4,
  },
  datePill: {
    alignItems: 'flex-end',
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
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
    borderRadius: theme.borderRadius.xl,
  },
  secondaryButton: {
    flex: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.surface,
  },
  buttonContent: {
    height: 52,
  },
  progressCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  progressValue: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  progressValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceVariant,
  },
  progressPercent: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
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
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  macroContent: {
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  macroAccent: {
    width: 24,
    height: 3,
    borderRadius: 999,
    marginBottom: theme.spacing.sm,
  },
  macroTitle: {
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  macroValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  macroMetaRow: {
    width: '100%',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  macroUnit: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    flex: 1,
  },
  tipText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
});
