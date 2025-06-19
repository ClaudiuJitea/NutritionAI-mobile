import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Text, Card, SegmentedButtons } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { DatabaseService } from '../../src/services/database';
import { WeeklyStats, DailyNutrition } from '../../src/types/database';
import { theme } from '../../src/constants/theme';

const screenWidth = Dimensions.get('window').width;

type ViewType = 'week' | 'month';
type ChartType = 'calories' | 'macros' | 'water';

export default function AnalyticsScreen() {
  const db = useSQLiteContext();
  const [dbService] = useState(() => new DatabaseService(db));
  const [viewType, setViewType] = useState<ViewType>('week');
  const [chartType, setChartType] = useState<ChartType>('calories');
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [dailyNutrition, setDailyNutrition] = useState<DailyNutrition | null>(null);
  const [consistencyDays, setConsistencyDays] = useState(0);
  const [averageCalories, setAverageCalories] = useState(0);

  const loadAnalyticsData = async () => {
    try {
      const endDate = new Date();
      const startDate = viewType === 'week' 
        ? subDays(endDate, 6) 
        : subDays(endDate, 29);

      const [stats, todayNutrition, consistency] = await Promise.all([
        dbService.getWeeklyStats(startDate, endDate),
        dbService.getDailyTotals(format(new Date(), 'yyyy-MM-dd')),
        dbService.getConsistencyDays(startDate, endDate),
      ]);

      setWeeklyStats(stats);
      setDailyNutrition(todayNutrition);
      setConsistencyDays(consistency);
      
      // Calculate average calories
      const totalCalories = stats.reduce((sum, day) => sum + day.calories, 0);
      setAverageCalories(stats.length > 0 ? totalCalories / stats.length : 0);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [viewType]);

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 212, 170, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: theme.borderRadius.md,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
  };

  const getChartData = () => {
    const days = viewType === 'week' ? 7 : 30;
    const endDate = new Date();
    const labels: string[] = [];
    const data: number[] = [];

    // Generate all dates in range
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(endDate, i);
      const dateString = format(date, 'yyyy-MM-dd');
      const dayData = weeklyStats.find(stat => stat.date === dateString);
      
      labels.push(format(date, viewType === 'week' ? 'EEE' : 'M/d'));
      
      switch (chartType) {
        case 'calories':
          data.push(dayData?.calories || 0);
          break;
        case 'water':
          // For water, we'll need to get it from daily nutrition
          data.push(0); // Placeholder - would need separate water stats
          break;
        default:
          data.push(dayData?.calories || 0);
      }
    }

    return { labels, datasets: [{ data }] };
  };

  const getMacrosPieData = () => {
    if (!dailyNutrition) return [];

    const total = dailyNutrition.protein + dailyNutrition.carbs + dailyNutrition.fat;
    if (total === 0) return [];

    return [
      {
        name: 'Protein',
        population: dailyNutrition.protein,
        color: theme.colors.chart.protein,
        legendFontColor: theme.colors.text,
        legendFontSize: 12,
      },
      {
        name: 'Carbs',
        population: dailyNutrition.carbs,
        color: theme.colors.chart.carbs,
        legendFontColor: theme.colors.text,
        legendFontSize: 12,
      },
      {
        name: 'Fat',
        population: dailyNutrition.fat,
        color: theme.colors.chart.fat,
        legendFontColor: theme.colors.text,
        legendFontSize: 12,
      },
    ];
  };

  const getMacrosBarData = () => {
    const days = Math.min(weeklyStats.length, 7);
    const labels = weeklyStats.slice(-days).map(stat => 
      format(new Date(stat.date), 'EEE')
    );
    
    return {
      labels,
      datasets: [
        {
          data: weeklyStats.slice(-days).map(stat => stat.protein),
          color: () => theme.colors.chart.protein,
        },
        {
          data: weeklyStats.slice(-days).map(stat => stat.carbs),
          color: () => theme.colors.chart.carbs,
        },
        {
          data: weeklyStats.slice(-days).map(stat => stat.fat),
          color: () => theme.colors.chart.fat,
        },
      ],
    };
  };

  const StatCard = ({ title, value, unit, subtitle }: {
    title: string;
    value: number;
    unit: string;
    subtitle?: string;
  }) => (
    <Card style={styles.statCard}>
      <Card.Content style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>
          {Math.round(value)}
          <Text style={styles.statUnit}>{unit}</Text>
        </Text>
        {subtitle && (
          <Text style={styles.statSubtitle}>{subtitle}</Text>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView style={styles.container}>
      {/* View Type Selector */}
      <View style={styles.selectorContainer}>
        <SegmentedButtons
          value={viewType}
          onValueChange={(value) => setViewType(value as ViewType)}
          buttons={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          style={styles.segmentedButtons}
          theme={{
            colors: {
              secondaryContainer: theme.colors.primary,
              onSecondaryContainer: theme.colors.background,
              outline: theme.colors.border,
              onSurface: theme.colors.text,
            },
          }}
        />
      </View>

      {/* Summary Stats */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Avg Calories"
          value={averageCalories}
          unit=" cal"
          subtitle="per day"
        />
        <StatCard
          title="Consistency"
          value={consistencyDays}
          unit={` / ${viewType === 'week' ? '7' : '30'}`}
          subtitle="days logged"
        />
      </View>

      {/* Chart Type Selector */}
      <View style={styles.selectorContainer}>
        <SegmentedButtons
          value={chartType}
          onValueChange={(value) => setChartType(value as ChartType)}
          buttons={[
            { value: 'calories', label: 'Calories' },
            { value: 'macros', label: 'Macros' },
            { value: 'water', label: 'Water' },
          ]}
          style={styles.segmentedButtons}
          theme={{
            colors: {
              secondaryContainer: theme.colors.primary,
              onSecondaryContainer: theme.colors.background,
              outline: theme.colors.border,
              onSurface: theme.colors.text,
            },
          }}
        />
      </View>

      {/* Charts */}
      <Card style={styles.chartCard}>
        <Card.Content>
          {chartType === 'calories' && (
            <>
              <Text style={styles.chartTitle}>Calorie Trend</Text>
              <LineChart
                data={getChartData()}
                width={screenWidth - 64}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            </>
          )}
          
          {chartType === 'macros' && dailyNutrition && (
            <>
              <Text style={styles.chartTitle}>Today's Macronutrients</Text>
              {getMacrosPieData().length > 0 ? (
                <PieChart
                  data={getMacrosPieData()}
                  width={screenWidth - 64}
                  height={220}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  style={styles.chart}
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No macro data for today</Text>
                  <Text style={styles.noDataSubtext}>Start logging food to see your macronutrient breakdown</Text>
                </View>
              )}
              
              {weeklyStats.length > 0 && (
                <>
                  <Text style={styles.chartTitle}>Weekly Macros Trend</Text>
                  <BarChart
                    data={getMacrosBarData()}
                    width={screenWidth - 64}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    showValuesOnTopOfBars
                    yAxisLabel="g"
                    yAxisSuffix=""
                  />
                </>
              )}
            </>
          )}
          
          {chartType === 'water' && (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>Water analytics coming soon</Text>
              <Text style={styles.noDataSubtext}>We're working on detailed water intake analytics</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Detailed Stats */}
      {dailyNutrition && (
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text style={styles.detailsTitle}>Today's Nutrition</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Calories</Text>
                <Text style={[styles.detailValue, { color: theme.colors.chart.calories }]}>
                  {Math.round(dailyNutrition.calories)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Protein</Text>
                <Text style={[styles.detailValue, { color: theme.colors.chart.protein }]}>
                  {Math.round(dailyNutrition.protein)}g
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Carbs</Text>
                <Text style={[styles.detailValue, { color: theme.colors.chart.carbs }]}>
                  {Math.round(dailyNutrition.carbs)}g
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Fat</Text>
                <Text style={[styles.detailValue, { color: theme.colors.chart.fat }]}>
                  {Math.round(dailyNutrition.fat)}g
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Insights */}
      <Card style={styles.insightsCard}>
        <Card.Content>
          <Text style={styles.insightsTitle}>📊 Insights</Text>
          <View style={styles.insightsList}>
            {averageCalories > 0 && (
              <Text style={styles.insightItem}>
                • Your average daily intake is {Math.round(averageCalories)} calories
              </Text>
            )}
            {consistencyDays > 0 && (
              <Text style={styles.insightItem}>
                • You've logged food for {consistencyDays} out of {viewType === 'week' ? '7' : '30'} days
              </Text>
            )}
            {consistencyDays >= (viewType === 'week' ? 5 : 20) && (
              <Text style={styles.insightItem}>
                • Great consistency! Keep up the good work 🎉
              </Text>
            )}
            {weeklyStats.length > 0 && (
              <Text style={styles.insightItem}>
                • Track more days to unlock detailed insights and trends
              </Text>
            )}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  selectorContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  segmentedButtons: {
    backgroundColor: theme.colors.surface,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  statTitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: 'normal',
    color: theme.colors.textSecondary,
  },
  statSubtitle: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chartCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  chart: {
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  noDataText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  noDataSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  detailsCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  insightsCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  insightsList: {
    gap: theme.spacing.xs,
  },
  insightItem: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});