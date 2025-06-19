export const theme = {
  colors: {
    primary: '#00D4AA', // Teal green (buttons, accents)
    background: '#1A1D29', // Dark navy background
    surface: '#252836', // Card/surface background
    surfaceVariant: '#2A2D3E', // Secondary surface
    text: '#FFFFFF', // Primary text
    textSecondary: '#8B92A5', // Secondary text
    border: '#3A3D4E', // Border color
    success: '#00D4AA',
    warning: '#FFB800',
    error: '#FF6B6B',
    elevation: {
      level0: 'transparent',
      level1: '#2A2D3E',
      level2: '#2F3240',
      level3: '#343742',
      level4: '#393C44',
      level5: '#3E4146'
    },
    chart: {
      calories: '#00D4AA',
      protein: '#8B5CF6',
      carbs: '#F59E0B',
      fat: '#EF4444'
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
    xl: 20
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