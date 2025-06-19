# NutritionAI 🥗📱

An AI-powered mobile application for tracking food intake and water consumption using computer vision and machine learning.

## Features ✨

- **AI Food Analysis**: Take photos of your meals and get instant nutrition information
- **Smart Tracking**: Automatic calorie, protein, carbs, and fat calculation
- **Water Intake**: Track daily hydration with visual progress indicators
- **Analytics Dashboard**: View trends, charts, and insights about your nutrition
- **Goal Setting**: Customize daily calorie and water intake goals
- **Offline Storage**: All data stored locally using SQLite
- **Dark Theme**: Beautiful, modern UI optimized for mobile

## Screenshots 📸

*Add screenshots of your app here*

## Tech Stack 🛠️

- **Framework**: React Native with Expo
- **Navigation**: Expo Router
- **Database**: SQLite with expo-sqlite
- **AI Service**: OpenRouter API (Claude, GPT-4, Gemini)
- **UI Components**: React Native Paper
- **Charts**: React Native Chart Kit
- **Camera**: Expo Camera & Image Picker
- **Security**: Expo SecureStore for API keys
- **Language**: TypeScript

## Prerequisites 📋

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- OpenRouter API key (get one at [openrouter.ai](https://openrouter.ai))
- iOS Simulator / Android Emulator or physical device

## Installation 🚀

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd NutritionAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npx expo start
   ```

4. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your device

## Configuration ⚙️

### OpenRouter API Setup

1. Visit [openrouter.ai](https://openrouter.ai) and create an account
2. Generate an API key
3. Open the app and go to Settings
4. Enter your API key in the "AI Configuration" section
5. Test the connection to ensure it's working
6. Choose your preferred AI model (Claude 3.5 Sonnet recommended)

### Supported AI Models

- **Anthropic Claude 3.5 Sonnet** (Recommended)
- **Anthropic Claude 3 Haiku** (Faster, lower cost)
- **OpenAI GPT-4o** (High quality)
- **OpenAI GPT-4o Mini** (Cost-effective)
- **Google Gemini Pro 1.5** (Good performance)
- **Meta Llama 3.1 8B** (Open source)

## Project Structure 📁

```
NutritionAI/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab navigation
│   │   ├── index.tsx            # Dashboard
│   │   ├── food.tsx             # Food Log
│   │   ├── water.tsx            # Water Tracking
│   │   └── analytics.tsx        # Analytics
│   ├── food-analysis.tsx        # AI Food Analysis
│   ├── settings.tsx             # Settings
│   └── _layout.tsx              # Root layout
├── src/
│   ├── components/              # Reusable components
│   ├── constants/
│   │   └── theme.ts            # App theme
│   ├── services/
│   │   ├── database.ts         # SQLite service
│   │   └── openrouter.ts       # AI service
│   └── types/
│       ├── database.ts         # Database types
│       └── api.ts              # API types
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
└── tsconfig.json               # TypeScript config
```

## Usage Guide 📖

### Getting Started

1. **Set up your profile**: Enter your name and daily goals in Settings
2. **Configure AI**: Add your OpenRouter API key for food analysis
3. **Start tracking**: Use the camera to analyze your meals
4. **Monitor progress**: Check your dashboard for daily summaries
5. **View analytics**: Explore trends and insights in the Analytics tab

### Food Analysis

1. Tap the camera button on the Dashboard or Food Log
2. Take a photo of your meal or select from gallery
3. Wait for AI analysis (usually 3-5 seconds)
4. Review and adjust the detected nutrition information
5. Select meal type (breakfast, lunch, dinner, snack)
6. Save to your food log

### Water Tracking

1. Go to the Water tab
2. Use quick-add buttons (250ml, 500ml, 750ml, 1000ml)
3. Or add custom amounts using the "+" button
4. Track your progress toward daily goals
5. View hydration tips and motivation

## Database Schema 🗄️

### Tables

- **users**: User profile and goals
- **food_entries**: Logged meals with nutrition data
- **water_intake**: Daily water consumption records
- **settings**: App configuration and preferences

### Key Features

- Automatic database initialization
- Migration support for future updates
- Efficient querying with proper indexing
- Data validation and error handling

## API Integration 🔌

### OpenRouter Service

The app uses OpenRouter as a unified API gateway to access multiple AI models:

- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Authentication**: Bearer token (API key)
- **Models**: Multiple providers (Anthropic, OpenAI, Google, Meta)
- **Rate Limiting**: Handled with exponential backoff
- **Error Handling**: Comprehensive error messages and retry logic

### Food Analysis Prompt

The AI receives a detailed prompt to analyze food images:

- Identify food items and portions
- Estimate nutritional values
- Provide confidence scores
- Return structured JSON data
- Handle edge cases (unclear images, non-food items)

## Development 👨‍💻

### Available Scripts

```bash
# Start development server
npm start

# Start with cache cleared
npm run start:clear

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web

# Type checking
npm run type-check

# Build for production
npm run build
```

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Consistent naming conventions
- Comprehensive error handling

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Troubleshooting 🔧

### Common Issues

1. **Camera not working**
   - Check camera permissions in device settings
   - Restart the app
   - Try using image picker instead

2. **AI analysis failing**
   - Verify API key is correct
   - Check internet connection
   - Test API connection in Settings
   - Try a different AI model

3. **Database errors**
   - Clear app data and restart
   - Check device storage space
   - Update to latest app version

4. **Performance issues**
   - Close other apps
   - Restart device
   - Clear app cache

### Debug Mode

Enable debug logging by setting `__DEV__` flag:

```typescript
if (__DEV__) {
  console.log('Debug information');
}
```

## Contributing 🤝

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Use semantic commit messages
- Ensure cross-platform compatibility

## Deployment 🚀

### Building for Production

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both platforms
eas build --platform all
```

### App Store Submission

1. Update version in `app.json`
2. Build production version
3. Test thoroughly on devices
4. Submit to App Store/Play Store
5. Monitor for issues

## Privacy & Security 🔒

- **Local Storage**: All nutrition data stored locally on device
- **API Keys**: Securely stored using Expo SecureStore
- **No Tracking**: No user analytics or tracking
- **Permissions**: Only camera and storage permissions required
- **Data Export**: Users can export their data anytime

## Roadmap 🗺️

### Planned Features

- [ ] Barcode scanning for packaged foods
- [ ] Recipe analysis and meal planning
- [ ] Social features and sharing
- [ ] Wearable device integration
- [ ] Nutritionist consultation booking
- [ ] Advanced analytics and insights
- [ ] Multi-language support
- [ ] Cloud sync and backup

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support 💬

For support, email support@nutritionai.app or join our Discord community.

## Acknowledgments 🙏

- OpenRouter for AI API access
- Expo team for the amazing framework
- React Native Paper for UI components
- All contributors and testers

---

**Made with ❤️ for healthier living**