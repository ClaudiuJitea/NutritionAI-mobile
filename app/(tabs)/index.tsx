import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, Button, ProgressBar } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { DatabaseService } from '../../src/services/database';
import { DailyNutrition, User } from '../../src/types/database';
import { theme } from '../../src/constants/theme';

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const [dbService] = useState(() => new DatabaseService(db));
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
  }, []);

  const calorieProgress = user ? dailyNutrition.calories / user.calorie_goal : 0;
  const waterProgress = user ? dailyNutrition.water / user.water_goal : 0;

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
            <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Button
          mode="contained"
          onPress={() => router.push('/food-analysis')}
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
      <Card style={styles.progressCard}>
        <Card.Content>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Daily Calories</Text>
            <Text style={styles.progressValue}>
              {Math.round(dailyNutrition.calories)} / {user?.calorie_goal || 2000}
            </Text>
          </View>
          <ProgressBar
            progress={Math.min(calorieProgress, 1)}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
          <Text style={styles.progressPercent}>
            {Math.round(calorieProgress * 100)}% of goal
          </Text>
        </Card.Content>
      </Card>

      {/* Water Progress */}
      <Card style={styles.progressCard}>
        <Card.Content>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Water Intake</Text>
            <Text style={styles.progressValue}>
              {Math.round(dailyNutrition.water)} / {user?.water_goal || 2500} ml
            </Text>
          </View>
          <ProgressBar
            progress={Math.min(waterProgress, 1)}
            color={theme.colors.chart.calories}
            style={styles.progressBar}
          />
          <Text style={styles.progressPercent}>
            {Math.round(waterProgress * 100)}% of goal
          </Text>
        </Card.Content>
      </Card>

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

      {/* Consistency Tracker */}
      <Card style={styles.consistencyCard}>
        <Card.Content>
          <View style={styles.consistencyHeader}>
            <Ionicons 
              name="flame" 
              size={24} 
              color={theme.colors.warning} 
            />
            <Text style={styles.consistencyTitle}>Weekly Streak</Text>
          </View>
          <Text style={styles.consistencyValue}>
            {consistencyDays} / 7 days
          </Text>
          <Text style={styles.consistencySubtext}>
            Keep logging to maintain your streak!
          </Text>
        </Card.Content>
      </Card>
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
  dateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
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
});