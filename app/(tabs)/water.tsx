import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, Modal } from 'react-native';
import { Text, Card, Button, ProgressBar, IconButton, TextInput, Portal, Dialog } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { DatabaseService } from '../../src/services/database';
import { User } from '../../src/types/database';
import { theme } from '../../src/constants/theme';

const QUICK_ADD_AMOUNTS = [250, 500, 750, 1000]; // ml

export default function WaterScreen() {
  const db = useSQLiteContext();
  const [dbService] = useState(() => new DatabaseService(db));
  const [waterIntake, setWaterIntake] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [inputAmount, setInputAmount] = useState('');

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
      Alert.alert('Cannot Add Water', 'You can only log water for today.');
      return;
    }

    setIsLoading(true);
    try {
      await dbService.addWaterIntake(amount, dateString);
      await loadData();
    } catch (error) {
      console.error('Error adding water:', error);
      Alert.alert('Error', 'Failed to log water intake');
    } finally {
      setIsLoading(false);
    }
  };

  const removeWater = async (amount: number) => {
    if (!isToday) {
      Alert.alert('Cannot Remove Water', 'You can only modify water for today.');
      return;
    }

    if (waterIntake < amount) {
      Alert.alert('Invalid Amount', 'Cannot remove more water than logged.');
      return;
    }

    setIsLoading(true);
    try {
      await dbService.addWaterIntake(-amount, dateString);
      await loadData();
    } catch (error) {
      console.error('Error removing water:', error);
      Alert.alert('Error', 'Failed to remove water intake');
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
  const glassesConsumed = Math.floor(waterIntake / 250); // Assuming 250ml per glass
  const glassesNeeded = Math.ceil(waterGoal / 250);

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

  const WaterGlass = ({ filled, index }: { filled: boolean; index: number }) => (
    <View style={styles.glassContainer}>
      <Ionicons
        name={filled ? 'water' : 'water-outline'}
        size={32}
        color={filled ? theme.colors.text : theme.colors.border}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
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

      {/* Visual Glasses */}
      <Card style={styles.glassesCard}>
        <Card.Content>
          <Text style={styles.glassesTitle}>
            Glasses: {glassesConsumed} / {glassesNeeded}
          </Text>
          <View style={styles.glassesGrid}>
            {Array.from({ length: glassesNeeded }, (_, index) => (
              <WaterGlass
                key={index}
                filled={index < glassesConsumed}
                index={index}
              />
            ))}
          </View>
          <Text style={styles.glassesSubtext}>
            Each glass = 250ml
          </Text>
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
            <TextInput
              mode="outlined"
              value={inputAmount}
              onChangeText={setInputAmount}
              keyboardType="numeric"
              placeholder="Enter amount (e.g., 250)"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
              style={styles.dialogInput}
              textColor={theme.colors.text}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
              right={<TextInput.Affix text="ml" />}
              theme={{
                colors: {
                  onSurfaceVariant: theme.colors.textSecondary,
                  outline: theme.colors.border,
                  primary: theme.colors.primary,
                }
              }}
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
                  Alert.alert('Invalid Amount', 'Please enter a value between 1 and 2000 ml.');
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
            <TextInput
              mode="outlined"
              value={inputAmount}
              onChangeText={setInputAmount}
              keyboardType="numeric"
              placeholder="Enter amount to remove"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
              style={styles.dialogInput}
              textColor={theme.colors.text}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.error}
              right={<TextInput.Affix text="ml" />}
              theme={{
                colors: {
                  onSurfaceVariant: theme.colors.textSecondary,
                  outline: theme.colors.border,
                  primary: theme.colors.error,
                }
              }}
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
                  Alert.alert('Invalid Amount', `Please enter a value between 1 and ${waterIntake} ml.`);
                }
              }}
              style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
              textColor={theme.colors.background}
            >
              Remove Water
            </Button>
          </Dialog.Actions>
        </Dialog>
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
  },
  glassesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  glassesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  glassContainer: {
    padding: theme.spacing.xs,
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
  quickAddButtonContent: {
    height: 40,
  },
  customCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
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
    marginBottom: 120,
    backgroundColor: theme.colors.surface,
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
  dialogInput: {
    marginBottom: theme.spacing.xs,
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