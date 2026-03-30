// Design System Colors - HiTGuest Brand
// Based on the logo: dark grey text with purple accent

export const colors = {
  // Primary Brand Colors
  brand: {
    50: '#f8f9fc',
    100: '#f1f3f9',
    200: '#e3e6f1',
    300: '#c5cae3',
    400: '#9ca9d1',
    500: '#7c8bc1', // Primary brand blue
    600: '#5c6fb1',
    700: '#4a5ca0',
    800: '#3e4d85',
    900: '#36416f',
  },
  
  // Purple Accent (from logo dot)
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7', // Primary purple
    600: '#9333ea',
    700: '#7c3aed',
    800: '#6b21a8',
    900: '#581c87',
  },
  
  // Dark Grey (from logo text)
  grey: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569', // Primary grey
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  
  // Semantic Colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  
  // Neutral Shades
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
}

// CSS Custom Properties for Tailwind
export const cssVariables = {
  '--color-brand-50': colors.brand[50],
  '--color-brand-100': colors.brand[100],
  '--color-brand-200': colors.brand[200],
  '--color-brand-300': colors.brand[300],
  '--color-brand-400': colors.brand[400],
  '--color-brand-500': colors.brand[500],
  '--color-brand-600': colors.brand[600],
  '--color-brand-700': colors.brand[700],
  '--color-brand-800': colors.brand[800],
  '--color-brand-900': colors.brand[900],
  
  '--color-purple-50': colors.purple[50],
  '--color-purple-100': colors.purple[100],
  '--color-purple-200': colors.purple[200],
  '--color-purple-300': colors.purple[300],
  '--color-purple-400': colors.purple[400],
  '--color-purple-500': colors.purple[500],
  '--color-purple-600': colors.purple[600],
  '--color-purple-700': colors.purple[700],
  '--color-purple-800': colors.purple[800],
  '--color-purple-900': colors.purple[900],
  
  '--color-grey-50': colors.grey[50],
  '--color-grey-100': colors.grey[100],
  '--color-grey-200': colors.grey[200],
  '--color-grey-300': colors.grey[300],
  '--color-grey-400': colors.grey[400],
  '--color-grey-500': colors.grey[500],
  '--color-grey-600': colors.grey[600],
  '--color-grey-700': colors.grey[700],
  '--color-grey-800': colors.grey[800],
  '--color-grey-900': colors.grey[900],
  
  '--color-success-500': colors.success[500],
  '--color-warning-500': colors.warning[500],
  '--color-error-500': colors.error[500],
}

// Type definitions for theme
export type ColorShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type ColorPalette = keyof typeof colors

// Brand-specific color combinations
export const brandColors = {
  primary: colors.brand[600], // Main brand color
  secondary: colors.purple[600], // Purple accent
  accent: colors.brand[500], // Lighter brand blue
  text: {
    primary: colors.grey[900],
    secondary: colors.grey[600],
    tertiary: colors.grey[500],
    inverse: colors.white,
  },
  background: {
    primary: colors.white,
    secondary: colors.grey[50],
    tertiary: colors.brand[50],
  },
  border: {
    light: colors.grey[200],
    medium: colors.grey[300],
    dark: colors.grey[400],
  },
} as const
