import axios from 'axios';
import { OpenRouterConfig, NutritionAnalysisRequest, NutritionAnalysisResponse, OpenRouterResponse, APIError } from '../types/api';

const DEFAULT_CONFIG: OpenRouterConfig = {
  apiKey: '', // Will be set from secure storage
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'google/gemini-2.5-flash', // Fixed stable model - use stable versions like google/gemini-2.8-flash or google/gemini-3.0-flash in future, avoid preview versions
  maxTokens: 1000
};

const NUTRITION_ANALYSIS_PROMPT = `
Analyze this food image and provide detailed nutritional information. Return ONLY a valid JSON object with this exact structure:

{
  "food_description": "Detailed description of the food item(s)",
  "estimated_serving": "Serving size estimate using specific format",
  "food_category": "vegetables" | "fruits" | "grains" | "protein" | "dairy",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "confidence": "high" | "medium" | "low"
}

Guidelines:
- Be as accurate as possible with nutritional values
- All nutritional values should be in grams except calories
- If multiple food items, provide totals for the entire meal
- For estimated_serving, use this EXACT format:
  * For individual items/portions: "1x serving" (e.g., "1x serving" for one apple, "2x serving" for two cookies)
  * For bulk/loose foods: estimate weight in grams (e.g., "150 grams" for rice, "200 grams" for salad)
- Set confidence based on image clarity and food recognition certainty
- Categorize the food into ONE of these five groups:
  * "vegetables": leafy greens, root vegetables, peppers, tomatoes, etc.
  * "fruits": apples, bananas, berries, citrus, etc.
  * "grains": bread, rice, pasta, cereals, oats, quinoa, etc.
  * "protein": meat, fish, poultry, eggs, beans, nuts, tofu, etc.
  * "dairy": milk, cheese, yogurt, butter, ice cream, etc.
- If mixed dish, choose the category of the primary/dominant ingredient
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
      console.log('Making API request to OpenRouter with model:', this.config.model);
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
      console.log('API response received:', response.status, response.statusText);

      console.log('Full API response data:', JSON.stringify(response.data, null, 2));

      const content = response.data.choices[0]?.message?.content;
      console.log('Extracted content:', content);
      
      if (!content) {
        console.error('No content in response. Response structure:', response.data);
        throw new Error('No response content from OpenRouter');
      }

      console.log('Raw AI response:', content);

      // Parse the JSON response with better error handling
      try {
        // Clean the content - remove markdown code blocks, extra whitespace, etc.
        let cleanContent = content.trim();
        
        // Remove markdown code blocks if present
        cleanContent = cleanContent.replace(/```json\s*|\s*```/g, '');
        cleanContent = cleanContent.replace(/```\s*|\s*```/g, '');
        
        // Find JSON object boundaries
        const jsonStart = cleanContent.indexOf('{');
        const jsonEnd = cleanContent.lastIndexOf('}');
        
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error('No valid JSON object found in response');
        }
        
        const jsonString = cleanContent.substring(jsonStart, jsonEnd + 1);
        console.log('Extracted JSON:', jsonString);
        
        const nutritionData = JSON.parse(jsonString) as NutritionAnalysisResponse;
        
        // Validate the response structure
        if (!this.isValidNutritionResponse(nutritionData)) {
          console.error('Invalid response structure:', nutritionData);
          throw new Error('Invalid nutrition analysis response format');
        }

        return nutritionData;
      } catch (parseError) {
        console.error('Failed to parse nutrition analysis:', parseError);
        console.error('Raw content that failed to parse:', content);
        
        // Provide a more helpful error message
        if (parseError instanceof SyntaxError) {
          throw new Error('The AI returned an invalid response format. Please try again with a clearer image.');
        } else {
          throw new Error('Failed to parse AI response. Please try again.');
        }
      }

    } catch (error) {
      console.error('OpenRouter API Error:', error);
      console.error('Error type:', typeof error);
      console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers
        });
        
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
      
      // If it's not an axios error, it might be a parsing error or other issue
      if (error instanceof Error) {
        throw error; // Re-throw the original error with its message
      }
      
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  private isValidNutritionResponse(data: any): data is NutritionAnalysisResponse {
    return (
      typeof data === 'object' &&
      typeof data.food_description === 'string' &&
      typeof data.estimated_serving === 'string' &&
      typeof data.food_category === 'string' &&
      ['vegetables', 'fruits', 'grains', 'protein', 'dairy'].includes(data.food_category) &&
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

  getCurrentModel(): string {
    return this.config.model;
  }

  async generateNutritionTip(): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.config.baseURL}/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: 'Generate a helpful nutrition tip in 1-2 sentences. Focus on practical advice for healthy eating.'
            }
          ],
          max_tokens: 100,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return response.data.choices[0]?.message?.content || 'Stay hydrated and eat a variety of colorful fruits and vegetables!';
    } catch (error) {
      console.error('Error generating nutrition tip:', error);
      return 'Remember to balance your meals with proteins, healthy fats, and complex carbohydrates!';
    }
  }
}