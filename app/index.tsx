import React, { useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { DatabaseService } from '../src/services/database';

export default function IndexScreen() {
  const db = useSQLiteContext();
  const dbService = new DatabaseService(db);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const user = await dbService.getUser();
      
      if (!user || !user.setup_completed) {
        // User hasn't completed onboarding
        router.replace('/onboarding');
      } else {
        // User has completed onboarding, go to main app
        router.replace('/(tabs)/');
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Default to onboarding if there's an error
      router.replace('/onboarding');
    }
  };

  return null;
}
