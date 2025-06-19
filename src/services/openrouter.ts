import axios from 'axios';
import { OpenRouterConfig, NutritionAnalysisRequest, NutritionAnalysisResponse, OpenRouterResponse, APIError } from '../types/api';

const DEFAULT_CONFIG: OpenRouterConfig = {
  apiKey: '', // Will be set from secure storage
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'anthropic/claude-3.5-sonnet',
  maxTokens: 1000
};

const NUTRITION_ANALYSIS_PROMPT = `
Analyze this food image and provide detailed nutritional information. Return ONLY a valid JSON object with this exact structure:

{
  "food_description": "Detailed description of the food item(s)",
  "estimated_serving": "Serving size estimate (e.g., '1 medium apple', '200g pasta')",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "confidence": "high" | "medium" | "low"
}

Guidelines:
- Be as accurate as possible with nutritional values
- Use standard serving sizes when possible
- Set confidence based on image clarity and food recognition certainty
- All nutritional values should be in grams except calories
- If multiple food items, provide totals for the entire meal
- Do not include any text outside the JSON object
`;

export class OpenRouterService {
  private config: OpenRouterConfig;

  constructor(apiKey?: string) {
    this.config = {
      ...DEFAULT_CONFIG,
      apiKey: apiKey || ''
    };
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  async analyzeFood(imageBase64: string): Promise<NutritionAnalysisResponse> {
    if (!this.config.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await axios.post<OpenRouterResponse>(
        `${this.config.baseURL}/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: NUTRITION_ANALYSIS_PROMPT
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nutritionai.app',
            'X-Title': 'NutritionAI Mobile App'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenRouter');
      }

      // Parse the JSON response
      try {
        const nutritionData = JSON.parse(content.trim()) as NutritionAnalysisResponse;
        
        // Validate the response structure
        if (!this.isValidNutritionResponse(nutritionData)) {
          throw new Error('Invalid nutrition analysis response format');
        }

        return nutritionData;
      } catch (parseError) {
        console.error('Failed to parse nutrition analysis:', parseError);
        throw new Error('Failed to parse AI response. Please try again.');
      }

    } catch (error) {
      console.error('OpenRouter API Error:', error);
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        
        switch (status) {
          case 401:
            throw new Error('Invalid API key. Please check your OpenRouter configuration.');
          case 429:
            throw new Error('Rate limit exceeded. Please try again later.');
          case 500:
            throw new Error('OpenRouter service error. Please try again later.');
          default:
            throw new Error(`API Error: ${message}`);
        }
      }
      
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  private isValidNutritionResponse(data: any): data is NutritionAnalysisResponse {
    return (
      typeof data === 'object' &&
      typeof data.food_description === 'string' &&
      typeof data.estimated_serving === 'string' &&
      typeof data.calories === 'number' &&
      typeof data.protein === 'number' &&
      typeof data.carbs === 'number' &&
      typeof data.fat === 'number' &&
      ['high', 'medium', 'low'].includes(data.confidence)
    );
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    try {
      const response = await axios.get(
        `${this.config.baseURL}/models`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          timeout: 10000
        }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    if (!this.config.apiKey) {
      // Return fallback models if no API key
      return [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'google/gemini-pro-1.5',
        'meta-llama/llama-3.1-8b-instruct',
      ];
    }

    try {
      const response = await fetch(
        `${this.config.baseURL}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter for popular/recommended models and sort by name
      const popularModels = data.data
        .filter((model: any) => {
          const id = model.id.toLowerCase();
          return (
            id.includes('claude') ||
            id.includes('gpt-4') ||
            id.includes('gemini') ||
            id.includes('llama-3')
          );
        })
        .map((model: any) => model.id)
        .sort();

      return popularModels.length > 0 ? popularModels : [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
      ];
    } catch (error) {
      console.error('Error fetching models from OpenRouter:', error);
      // Return fallback models on error
      return [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'google/gemini-pro-1.5',
        'meta-llama/llama-3.1-8b-instruct',
      ];
    }
  }

  setModel(model: string): void {
    this.config.model = model;
  }
}