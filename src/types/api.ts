export interface OpenRouterConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
}

export interface NutritionAnalysisRequest {
  imageBase64: string;
  prompt: string;
}

export interface NutritionAnalysisResponse {
  food_description: string;
  estimated_serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export interface APIError {
  message: string;
  code?: string;
  status?: number;
}