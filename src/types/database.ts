export interface User {
  id: number;
  name: string;
  calorie_goal: number;
  water_goal: number;
  created_at: string;
}

export interface FoodEntry {
  id: number;
  user_id: number;
  food_description: string;
  quantity: number;
  unit: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_category?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logged_date: string;
  created_at: string;
}

export interface WaterIntake {
  id: number;
  user_id: number;
  amount: number; // in ml
  logged_date: string;
  created_at: string;
}

export interface Setting {
  id: number;
  user_id: number;
  setting_key: string;
  setting_value: string;
}

export interface DailyNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

export interface WeeklyStats {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}