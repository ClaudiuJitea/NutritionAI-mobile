// OpenRouter API types
export interface OpenRouterConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
}

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Food Analysis API types
export interface NutritionAnalysisRequest {
  imageBase64: string;
  model?: string;
}

export interface NutritionAnalysisResponse {
  food_description: string;
  estimated_serving: string;
  food_category: 'vegetables' | 'fruits' | 'grains' | 'protein' | 'dairy';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface APIError {
  message: string;
  code?: string;
  status?: number;
}