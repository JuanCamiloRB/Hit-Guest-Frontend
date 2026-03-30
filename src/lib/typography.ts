// Typography System - HiTGuest Brand
// Clean, professional typography for hospitality management

export const typography = {
  // Font Families
  fonts: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    serif: ['Georgia', 'serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
  
  // Font Sizes - Responsive Scale
  sizes: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],      // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],    // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],     // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
    '5xl': ['3rem', { lineHeight: '1' }],          // 48px
    '6xl': ['3.75rem', { lineHeight: '1' }],       // 60px
    '7xl': ['4.5rem', { lineHeight: '1' }],        // 72px
    '8xl': ['6rem', { lineHeight: '1' }],          // 96px
    '9xl': ['8rem', { lineHeight: '1' }],          // 128px
  },
  
  // Font Weights
  weights: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  
  // Letter Spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
  
  // Line Heights
  lineHeights: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
}

// Typography Components - Semantic Text Styles
export const textStyles = {
  // Headings
  h1: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.tight,
    letterSpacing: typography.letterSpacing.tight,
    color: 'var(--color-grey-900)',
  },
  
  h2: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.tight,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-900)',
  },
  
  h3: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.snug,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-800)',
  },
  
  h4: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.snug,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-800)',
  },
  
  // Body Text
  body: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-700)',
  },
  
  bodyLarge: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.normal,
    lineHeight: typography.lineHeights.relaxed,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-700)',
  },
  
  bodySmall: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.normal,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-600)',
  },
  
  // UI Elements
  caption: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.wide,
    color: 'var(--color-grey-500)',
    textTransform: 'uppercase',
  },
  
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-700)',
  },
  
  // Links
  link: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-brand-600)',
    textDecoration: 'none',
    transition: 'color 0.2s ease',
    
    '&:hover': {
      color: 'var(--color-brand-700)',
    },
  },
  
  // Buttons
  buttonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.none,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'none',
  },
  
  buttonSmallText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.none,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'none',
  },
  
  // Form Elements
  inputText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-900)',
  },
  
  placeholderText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-grey-400)',
  },
  
  // Status Text
  errorText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-error-500)',
  },
  
  successText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-success-500)',
  },
  
  warningText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.normal,
    letterSpacing: typography.letterSpacing.normal,
    color: 'var(--color-warning-500)',
  },
}

// Responsive typography utilities
export const responsiveText = {
  // Mobile-first responsive headings
  h1: {
    mobile: typography.sizes['2xl'],
    tablet: typography.sizes['3xl'],
    desktop: typography.sizes['4xl'],
  },
  
  h2: {
    mobile: typography.sizes.xl,
    tablet: typography.sizes['2xl'],
    desktop: typography.sizes['3xl'],
  },
  
  h3: {
    mobile: typography.sizes.lg,
    tablet: typography.sizes.xl,
    desktop: typography.sizes['2xl'],
  },
}

// Type definitions
export type FontSize = keyof typeof typography.sizes
export type FontWeight = keyof typeof typography.weights
export type TextStyle = keyof typeof textStyles
