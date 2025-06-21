import { SQLiteDatabase } from 'expo-sqlite';
import { FoodEntry, WaterIntake, User, Setting, DailyNutrition, WeeklyStats } from '../types/database';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export class DatabaseService {
  private db: SQLiteDatabase;

  constructor(database: SQLiteDatabase) {
    this.db = database;
  }

  // Initialize database with tables
  async initializeDatabase(): Promise<void> {
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        weight REAL,
        age INTEGER,
        activity_level TEXT,
        weight_goal TEXT,
        calorie_goal INTEGER DEFAULT 2000,
        water_goal INTEGER DEFAULT 2500,
        setup_completed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS food_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        food_description TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        food_category TEXT,
        calories REAL NOT NULL,
        protein REAL DEFAULT 0,
        carbs REAL DEFAULT 0,
        fat REAL DEFAULT 0,
        logged_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
      
      CREATE TABLE IF NOT EXISTS water_intake (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        amount INTEGER NOT NULL,
        logged_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
      
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        setting_key TEXT NOT NULL,
        setting_value TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    // Migrate existing users table if needed
    await this.migrateUsersTable();

    // Create default user if not exists
    const userExists = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM users WHERE id = 1'
    );
    
    if (userExists?.count === 0) {
      await this.db.runAsync(
        'INSERT INTO users (id, name, calorie_goal, water_goal, setup_completed) VALUES (1, ?, 2000, 2500, 0)',
        'Default User'
      );
    }
  }

  private async migrateUsersTable(): Promise<void> {
    try {
      // Check if the new columns exist by querying the table schema
      const tableInfo = await this.db.getAllAsync<{ name: string; type: string }>(
        "PRAGMA table_info(users)"
      );
      
      const columnNames = tableInfo.map(col => col.name);
      
      // Add missing columns if they don't exist
      const columnsToAdd = [
        { name: 'weight', sql: 'ALTER TABLE users ADD COLUMN weight REAL' },
        { name: 'age', sql: 'ALTER TABLE users ADD COLUMN age INTEGER' },
        { name: 'activity_level', sql: 'ALTER TABLE users ADD COLUMN activity_level TEXT' },
        { name: 'weight_goal', sql: 'ALTER TABLE users ADD COLUMN weight_goal TEXT' },
        { name: 'setup_completed', sql: 'ALTER TABLE users ADD COLUMN setup_completed BOOLEAN DEFAULT 0' },
      ];

      for (const column of columnsToAdd) {
        if (!columnNames.includes(column.name)) {
          await this.db.execAsync(column.sql);
          console.log(`Added column: ${column.name}`);
        }
      }
    } catch (error) {
      console.error('Error migrating users table:', error);
      // Don't throw error to prevent app from crashing
    }
  }

  // Food Entry Operations
  async addFoodEntry(entry: Omit<FoodEntry, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO food_entries 
       (user_id, food_description, quantity, unit, meal_type, food_category, calories, protein, carbs, fat, logged_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.user_id,
      entry.food_description,
      entry.quantity,
      entry.unit,
      entry.meal_type,
      entry.food_category || null,
      entry.calories,
      entry.protein,
      entry.carbs,
      entry.fat,
      entry.logged_date
    );
    return result.lastInsertRowId;
  }

  async getFoodEntriesByDate(date: string, userId: number = 1): Promise<FoodEntry[]> {
    return await this.db.getAllAsync<FoodEntry>(
      'SELECT * FROM food_entries WHERE user_id = ? AND logged_date = ? ORDER BY created_at DESC',
      userId,
      date
    );
  }

  async updateFoodEntry(id: number, updates: Partial<FoodEntry>): Promise<void> {
    const entries = Object.entries(updates)
      .filter(([key, value]) => key !== 'id' && key !== 'created_at' && value !== undefined);

    if (entries.length === 0) {
      return;
    }

    const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([, value]) => value);

    await this.db.runAsync(
      `UPDATE food_entries SET ${setClause} WHERE id = ?`,
      ...values,
      id
    );
  }

  async deleteFoodEntry(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM food_entries WHERE id = ?', id);
  }

  // Water Intake Operations
  async addWaterIntake(amount: number, date: string, userId: number = 1): Promise<number> {
    const result = await this.db.runAsync(
      'INSERT INTO water_intake (user_id, amount, logged_date) VALUES (?, ?, ?)',
      userId,
      amount,
      date
    );
    return result.lastInsertRowId;
  }

  async getWaterIntakeByDate(date: string, userId: number = 1): Promise<number> {
    const result = await this.db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM water_intake WHERE user_id = ? AND logged_date = ?',
      userId,
      date
    );
    return result?.total || 0;
  }

  // Daily Nutrition Totals
  async getDailyTotals(date: string, userId: number = 1): Promise<DailyNutrition> {
    const nutritionResult = await this.db.getFirstAsync<{
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>(
      `SELECT 
         COALESCE(SUM(calories), 0) as calories,
         COALESCE(SUM(protein), 0) as protein,
         COALESCE(SUM(carbs), 0) as carbs,
         COALESCE(SUM(fat), 0) as fat
       FROM food_entries 
       WHERE user_id = ? AND logged_date = ?`,
      userId,
      date
    );

    const water = await this.getWaterIntakeByDate(date, userId);

    return {
      calories: nutritionResult?.calories || 0,
      protein: nutritionResult?.protein || 0,
      carbs: nutritionResult?.carbs || 0,
      fat: nutritionResult?.fat || 0,
      water
    };
  }

  // Weekly Statistics
  async getWeeklyStats(startDate: Date, endDate: Date, userId: number = 1): Promise<WeeklyStats[]> {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');

    return await this.db.getAllAsync<WeeklyStats>(
      `SELECT 
         logged_date as date,
         COALESCE(SUM(calories), 0) as calories,
         COALESCE(SUM(protein), 0) as protein,
         COALESCE(SUM(carbs), 0) as carbs,
         COALESCE(SUM(fat), 0) as fat
       FROM food_entries 
       WHERE user_id = ? AND logged_date BETWEEN ? AND ?
       GROUP BY logged_date
       ORDER BY logged_date`,
      userId,
      start,
      end
    );
  }

  // User Operations
  async getUser(userId: number = 1): Promise<User | null> {
    return await this.db.getFirstAsync<User>(
      'SELECT * FROM users WHERE id = ?',
      userId
    );
  }

  async updateUserGoals(calorieGoal: number, waterGoal: number, userId: number = 1): Promise<void> {
    await this.db.runAsync(
      'UPDATE users SET calorie_goal = ?, water_goal = ? WHERE id = ?',
      calorieGoal,
      waterGoal,
      userId
    );
  }

  async updateUserName(name: string, userId: number = 1): Promise<void> {
    await this.db.runAsync(
      'UPDATE users SET name = ? WHERE id = ?',
      name,
      userId
    );
  }

  async updateUserProfile(profile: {
    name: string;
    weight: number;
    age: number;
    activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
    weight_goal: 'maintain' | 'lose_steady' | 'lose_aggressive';
    calorie_goal?: number;
    water_goal?: number;
  }, userId: number = 1): Promise<void> {
    const calorieGoal = profile.calorie_goal || this.calculateCalorieGoal(
      profile.weight,
      profile.age,
      profile.activity_level,
      profile.weight_goal
    );
    
    const waterGoal = profile.water_goal || this.calculateWaterGoal(
      profile.weight,
      profile.age
    );

    await this.db.runAsync(
      `UPDATE users SET 
        name = ?, 
        weight = ?, 
        age = ?, 
        activity_level = ?, 
        weight_goal = ?, 
        calorie_goal = ?, 
        water_goal = ?, 
        setup_completed = 1 
      WHERE id = ?`,
      profile.name,
      profile.weight,
      profile.age,
      profile.activity_level,
      profile.weight_goal,
      calorieGoal,
      waterGoal,
      userId
    );
  }

  private calculateCalorieGoal(
    weight: number,
    age: number,
    activityLevel: string,
    weightGoal: string
  ): number {
    // Basic BMR calculation using Mifflin-St Jeor equation (assuming male for simplicity)
    // For a more accurate calculation, you'd need gender information
    const bmr = 10 * weight + 6.25 * 175 - 5 * age + 5; // Assuming average height of 175cm
    
    // Activity multipliers
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };
    
    const tdee = bmr * (activityMultipliers[activityLevel as keyof typeof activityMultipliers] || 1.2);
    
    // Adjust based on weight goal
    switch (weightGoal) {
      case 'lose_aggressive':
        return Math.round(tdee - 750); // 1.5 lbs per week
      case 'lose_steady':
        return Math.round(tdee - 500); // 1 lb per week
      case 'maintain':
      default:
        return Math.round(tdee);
    }
  }

  private calculateWaterGoal(weight: number, age: number): number {
    // Basic water calculation: 35ml per kg of body weight
    // Adjusted for age (older adults need slightly more)
    const baseWater = weight * 35;
    const ageAdjustment = age > 65 ? 1.1 : 1.0;
    return Math.round(baseWater * ageAdjustment);
  }

  // Settings Operations
  async getSetting(key: string, userId: number = 1): Promise<string | null> {
    const result = await this.db.getFirstAsync<{ setting_value: string }>(
      'SELECT setting_value FROM settings WHERE user_id = ? AND setting_key = ?',
      userId,
      key
    );
    return result?.setting_value || null;
  }

  async setSetting(key: string, value: string, userId: number = 1): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO settings (user_id, setting_key, setting_value) 
       VALUES (?, ?, ?)`,
      userId,
      key,
      value
    );
  }

  // Water Statistics
  async getWaterStats(startDate: Date, endDate: Date, userId: number = 1): Promise<{ date: string; water: number }[]> {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');

    return await this.db.getAllAsync<{ date: string; water: number }>(
      `SELECT 
         logged_date as date,
         COALESCE(SUM(amount), 0) as water
       FROM water_intake 
       WHERE user_id = ? AND logged_date BETWEEN ? AND ?
       GROUP BY logged_date
       ORDER BY logged_date`,
      userId,
      start,
      end
    );
  }

  // Consistency tracking
  async getConsistencyDays(startDate: Date, endDate: Date, userId: number = 1): Promise<number> {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');

    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT logged_date) as count 
       FROM food_entries 
       WHERE user_id = ? AND logged_date BETWEEN ? AND ?`,
      userId,
      start,
      end
    );
    return result?.count || 0;
  }
}