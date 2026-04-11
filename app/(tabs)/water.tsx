import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TextInput as RNTextInput } from 'react-native';
import { Text, Card, Button, ProgressBar, IconButton, Portal, Dialog } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { DatabaseService } from '../../src/services/database';
import { User } from '../../src/types/database';
import { theme } from '../../src/constants/theme';
import { AppDialog } from '../../src/components/AppDialog';

const QUICK_ADD_AMOUNTS = [250, 500, 750, 1000]; // ml

const DialogInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  accentColor,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accentColor: string;
}) => (
  <View style={[styles.dialogInputShell, { borderColor: accentColor + '40' }]}>
    <Text style={styles.dialogInputCaption}>{label}</Text>
    <View style={styles.dialogInputRow}>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        autoFocus
        style={styles.dialogInputNative}
      />
      <Text style={styles.dialogInputUnit}>ml</Text>
    </View>
  </View>
);

export default function WaterScreen() {
  const db = useSQLiteContext();
  const tabBarHeight = useBottomTabBarHeight();
  const dbService = new DatabaseService(db);
  const [waterIntake, setWaterIntake] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [inputAmount, setInputAmount] = useState('');
  const [messageDialog, setMessageDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    tone: 'warning' | 'error';
  }>({
    visible: false,
    title: '',
    message: '',
    tone: 'warning',
  });

  const showMessage = (title: string, message: string, tone: 'warning' | 'error' = 'warning') => {
    setMessageDialog({ visible: true, title, message, tone });
  };

  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const isToday = dateString === format(new Date(), 'yyyy-MM-dd');

  const loadData = async () => {
    try {
      const [intake, userData] = await Promise.all([
        dbService.getWaterIntakeByDate(dateString),
        dbService.getUser(),
      ]);
      setWaterIntake(intake);
      setUser(userData);
    } catch (error) {
      console.error('Error loading water data:', error);
    }
  };

  const addWater = async (amount: number) => {
    if (!isToday) {
      showMessage('Today Only', 'You can only log water for the current day.');
      return;
    }

    setIsLoading(true);
    try {
      await dbService.addWaterIntake(amount, dateString);
      setWaterIntake((current) => current + amount);
    } catch (error) {
      console.error('Error adding water:', error);
      showMessage('Add Failed', 'Failed to log water intake.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const removeWater = async (amount: number) => {
    if (!isToday) {
      showMessage('Today Only', 'You can only modify water for the current day.');
      return;
    }

    if (waterIntake < amount) {
      showMessage('Invalid Amount', 'Cannot remove more water than you have logged.');
      return;
    }

    setIsLoading(true);
    try {
      await dbService.addWaterIntake(-amount, dateString);
      setWaterIntake((current) => Math.max(current - amount, 0));
    } catch (error) {
      console.error('Error removing water:', error);
      showMessage('Remove Failed', 'Failed to remove water intake.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate])
  );

  const waterGoal = user?.water_goal || 2500;
  const progress = Math.min(waterIntake / waterGoal, 1);
  const remainingWater = Math.max(waterGoal - waterIntake, 0);
  const progressPercent = Math.round(progress * 100);

  const getProgressColor = () => {
    if (waterIntake > waterGoal) return theme.colors.error;
    if (progress >= 1) return theme.colors.success;
    if (progress >= 0.7) return theme.colors.primary;
    if (progress >= 0.4) return theme.colors.warning;
    return theme.colors.chart.calories;
  };

  const getMotivationalMessage = () => {
    if (progress >= 1) return "Great job! You've reached your daily goal!";
    if (progress >= 0.8) return "Almost there! Keep it up!";
    if (progress >= 0.5) return "You're halfway to your goal!";
    if (progress >= 0.2) return "Good start! Keep drinking!";
    return "Time to hydrate! Start your day right!";
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: tabBarHeight + theme.spacing.xl }}
      >
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
          {!isToday && (
            <Text style={styles.pastDateWarning}>View only</Text>
          )}
        </View>
        <IconButton
          icon="chevron-right"
          size={24}
          iconColor={theme.colors.text}
          onPress={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + 1);
            if (newDate <= new Date()) {
              setSelectedDate(newDate);
            }
          }}
        />
      </View>

      {/* Progress Card */}
      <Card style={styles.progressCard}>
        <Card.Content>
          <View style={styles.progressBadgeRow}>
            <View style={styles.progressBadge}>
              <Ionicons name="water" size={16} color={getProgressColor()} />
              <Text style={[styles.progressBadgeText, { color: getProgressColor() }]}>
                Hydration score
              </Text>
            </View>
          </View>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Daily Water Goal</Text>
            <Text style={styles.progressValue}>
              {waterIntake} / {waterGoal} ml
            </Text>
          </View>
          
          <ProgressBar
            progress={progress}
            color={getProgressColor()}
            style={styles.progressBar}
          />
          
          <View style={styles.progressStats}>
            <Text style={styles.progressPercent}>
              {Math.round(progress * 100)}% complete
            </Text>
            {remainingWater > 0 && (
              <Text style={styles.remainingText}>
                {remainingWater} ml remaining
              </Text>
            )}
          </View>
          
          <Text style={styles.motivationalText}>
            {getMotivationalMessage()}
          </Text>
        </Card.Content>
      </Card>

      {/* Hydration Visual */}
      <Card style={styles.glassesCard}>
        <Card.Content>
          <Text style={styles.glassesTitle}>Hydration level</Text>
          <View style={styles.hydrationVisualRow}>
            <View style={styles.bottleColumn}>
              <View style={styles.bottleCap} />
              <View style={styles.bottleBody}>
                <View style={styles.bottleFillTrack}>
                  <View
                    style={[
                      styles.bottleFill,
                      {
                        height: `${progressPercent}%`,
                        backgroundColor: getProgressColor(),
                      },
                    ]}
                  />
                </View>
                <View style={styles.bottleMarkers}>
                  {[100, 75, 50, 25].map((marker) => (
                    <View key={marker} style={styles.bottleMarkerRow}>
                      <View style={styles.bottleMarkerLine} />
                      <Text style={styles.bottleMarkerText}>{marker}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.hydrationStatsColumn}>
              <View style={styles.hydrationStatCard}>
                <Text style={styles.hydrationStatLabel}>Consumed</Text>
                <Text style={styles.hydrationStatValue}>{waterIntake} ml</Text>
              </View>
              <View style={styles.hydrationStatCard}>
                <Text style={styles.hydrationStatLabel}>Goal</Text>
                <Text style={styles.hydrationStatValue}>{waterGoal} ml</Text>
              </View>
              <View style={styles.hydrationStatCard}>
                <Text style={styles.hydrationStatLabel}>Remaining</Text>
                <Text style={styles.hydrationStatValue}>{remainingWater} ml</Text>
              </View>
            </View>
          </View>
          <Text style={styles.glassesSubtext}>{progressPercent}% of your daily target</Text>
        </Card.Content>
      </Card>

      {/* Quick Add Buttons */}
      {isToday && (
        <Card style={styles.quickAddCard}>
          <Card.Content>
            <Text style={styles.quickAddTitle}>Quick Add</Text>
            <View style={styles.quickAddGrid}>
              {QUICK_ADD_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  mode="outlined"
                  onPress={() => addWater(amount)}
                  disabled={isLoading}
                  style={styles.quickAddButton}
                  contentStyle={styles.quickAddButtonContent}
                >
                  +{amount}ml
                </Button>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {isToday && waterIntake > 0 && (
        <Card style={styles.quickRemoveCard}>
          <Card.Content>
            <Text style={styles.quickRemoveTitle}>Quick Remove</Text>
            <View style={styles.quickAddGrid}>
              {QUICK_ADD_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  mode="outlined"
                  onPress={() => removeWater(amount)}
                  disabled={isLoading || amount > waterIntake}
                  style={styles.quickRemoveButton}
                  contentStyle={styles.quickAddButtonContent}
                  textColor={theme.colors.error}
                >
                  -{amount}ml
                </Button>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Custom Amount */}
      {isToday && (
        <Card style={styles.customCard}>
          <Card.Content>
            <Text style={styles.customTitle}>Custom Amount</Text>
            <View style={styles.customControls}>
              <Button
                mode="outlined"
                onPress={() => {
                  setInputAmount('');
                  setShowAddDialog(true);
                }}
                disabled={isLoading}
                style={styles.customButton}
                icon="plus"
              >
                Add Custom
              </Button>
              
              {waterIntake > 0 && (
                <Button
                  mode="outlined"
                  onPress={() => {
                    setInputAmount('');
                    setShowRemoveDialog(true);
                  }}
                  disabled={isLoading}
                  style={styles.customButton}
                  textColor={theme.colors.error}
                  icon="minus"
                >
                  Remove
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Hydration Tips */}
      <Card style={styles.tipsCard}>
        <Card.Content>
          <Text style={styles.tipsTitle}>Hydration Tips</Text>
          <View style={styles.tipsList}>
            <Text style={styles.tipItem}>• Start your day with a glass of water</Text>
            <Text style={styles.tipItem}>• Drink water before, during, and after exercise</Text>
            <Text style={styles.tipItem}>• Keep a water bottle with you throughout the day</Text>
            <Text style={styles.tipItem}>• Set reminders to drink water regularly</Text>
            <Text style={styles.tipItem}>• Eat water-rich foods like fruits and vegetables</Text>
          </View>
        </Card.Content>
      </Card>
      </ScrollView>

      {/* Add Water Dialog */}
      <Portal>
        <Dialog 
          visible={showAddDialog} 
          onDismiss={() => setShowAddDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.dialogTitleText}>Add Water</Text>
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogDescription}>Enter amount in ml:</Text>
            <DialogInput
              label="Water"
              value={inputAmount}
              onChangeText={setInputAmount}
              placeholder="Enter amount (e.g., 250)"
              accentColor={theme.colors.primary}
            />
            <Text style={styles.dialogHint}>Recommended: 250ml per glass</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              onPress={() => setShowAddDialog(false)}
              textColor={theme.colors.textSecondary}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                const amount = parseInt(inputAmount || '0');
                if (amount > 0 && amount <= 2000) {
                  addWater(amount);
                  setShowAddDialog(false);
                } else {
                  showMessage('Invalid Amount', 'Please enter a value between 1 and 2000 ml.');
                }
              }}
              style={styles.actionButton}
              textColor={theme.colors.background}
            >
              Add Water
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Remove Water Dialog */}
      <Portal>
        <Dialog 
          visible={showRemoveDialog} 
          onDismiss={() => setShowRemoveDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            <Ionicons name="remove-circle-outline" size={20} color={theme.colors.error} />
            <Text style={styles.dialogTitleText}>Remove Water</Text>
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogDescription}>Enter amount to remove (ml):</Text>
            <DialogInput
              label="Water"
              value={inputAmount}
              onChangeText={setInputAmount}
              placeholder="Enter amount to remove"
              accentColor={theme.colors.error}
            />
            <Text style={styles.dialogHint}>Current intake: {waterIntake} ml</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              onPress={() => setShowRemoveDialog(false)}
              textColor={theme.colors.textSecondary}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                const amount = parseInt(inputAmount || '0');
                if (amount > 0 && amount <= waterIntake) {
                  removeWater(amount);
                  setShowRemoveDialog(false);
                } else {
                  showMessage('Invalid Amount', `Please enter a value between 1 and ${waterIntake} ml.`);
                }
              }}
              style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
              textColor={theme.colors.background}
            >
              Remove Water
            </Button>
          </Dialog.Actions>
        </Dialog>
        <AppDialog
          visible={messageDialog.visible}
          onDismiss={() => setMessageDialog((prev) => ({ ...prev, visible: false }))}
          title={messageDialog.title}
          message={messageDialog.message}
          tone={messageDialog.tone}
          primaryAction={{
            label: 'OK',
            onPress: () => setMessageDialog((prev) => ({ ...prev, visible: false })),
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
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
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
  pastDateWarning: {
    fontSize: 13,
    color: theme.colors.warning,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  progressCard: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  progressBadgeRow: {
    marginBottom: theme.spacing.md,
  },
  progressBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  progressValue: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceVariant,
    marginBottom: theme.spacing.sm,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  progressPercent: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  remainingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  motivationalText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  glassesCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  glassesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  hydrationVisualRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  bottleColumn: {
    alignItems: 'center',
  },
  bottleCap: {
    width: 30,
    height: 14,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
  },
  bottleBody: {
    width: 94,
    height: 176,
    borderRadius: 28,
    padding: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  bottleFillTrack: {
    ...StyleSheet.absoluteFillObject,
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bottleFill: {
    width: '100%',
    borderRadius: 22,
  },
  bottleMarkers: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  bottleMarkerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottleMarkerLine: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  bottleMarkerText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  hydrationStatsColumn: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  hydrationStatCard: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  hydrationStatLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    fontWeight: '700',
  },
  hydrationStatValue: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: '600',
  },
  glassesSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  quickAddCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quickAddTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  quickAddButton: {
    flex: 1,
    minWidth: '45%',
    borderColor: theme.colors.primary,
  },
  quickRemoveCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quickRemoveTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  quickRemoveButton: {
    flex: 1,
    minWidth: '45%',
    borderColor: theme.colors.error,
  },
  quickAddButtonContent: {
    height: 40,
  },
  customCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  customTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  customControls: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  customButton: {
    flex: 1,
    borderColor: theme.colors.primary,
  },
  tipsCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  tipsList: {
    gap: theme.spacing.xs,
  },
  tipItem: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  // Dialog styles
  dialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    margin: theme.spacing.md,
  },
  dialogTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  dialogTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dialogContent: {
    paddingTop: 0,
    paddingBottom: theme.spacing.sm,
  },
  dialogDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  dialogInputShell: {
    minHeight: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: theme.spacing.xs,
  },
  dialogInputCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dialogInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialogInputNative: {
    flex: 1,
    paddingVertical: 0,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  dialogInputUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  dialogHint: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  dialogActions: {
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  cancelButton: {
    borderRadius: theme.borderRadius.sm,
    minWidth: 80,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    minWidth: 100,
  },
});
