export const theme = {
  colors: {
    primary: '#12D6B0', // Teal green (buttons, accents)
    background: '#171A24', // Dark navy background
    surface: '#212533', // Card/surface background
    surfaceVariant: '#2B3041', // Secondary surface
    text: '#FFFFFF', // Primary text
    textSecondary: '#9AA3B8', // Secondary text
    border: '#33394D', // Border color
    success: '#12D6B0',
    warning: '#FFB84D',
    error: '#FF6E6E',
    elevation: {
      level0: 'transparent',
      level1: '#232838',
      level2: '#292E3D',
      level3: '#303545',
      level4: '#363C4D',
      level5: '#3C4255'
    },
    chart: {
      calories: '#12D6B0',
      protein: '#A78BFA',
      carbs: '#F4B740',
      fat: '#FF6E6E'
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24
  },
  typography: {
    h1: { fontSize: 28, fontWeight: 'bold' as const },
    h2: { fontSize: 24, fontWeight: 'bold' as const },
    h3: { fontSize: 20, fontWeight: '600' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    caption: { fontSize: 14, fontWeight: '400' as const },
    small: { fontSize: 12, fontWeight: '400' as const }
  }
};

export type Theme = typeof theme;
