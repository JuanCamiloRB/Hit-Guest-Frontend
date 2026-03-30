// Spacing System - HiTGuest Brand
// Consistent spacing scale for clean, professional layouts

export const spacing = {
  // Base spacing unit (4px)
  base: '0.25rem',
  
  // Spacing Scale - Based on 4px grid system
  0: '0',
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
  36: '9rem',        // 144px
  40: '10rem',       // 160px
  44: '11rem',       // 176px
  48: '12rem',       // 192px
  52: '13rem',       // 208px
  56: '14rem',       // 224px
  60: '15rem',       // 240px
  64: '16rem',       // 256px
  72: '18rem',       // 288px
  80: '20rem',       // 320px
  96: '24rem',       // 384px
}

// Layout Spacing - Common layout patterns
export const layoutSpacing = {
  // Container padding
  container: {
    mobile: spacing[4],   // 16px
    tablet: spacing[6],   // 24px
    desktop: spacing[8],  // 32px
  },
  
  // Section spacing
  section: {
    small: spacing[12],   // 48px
    medium: spacing[16],  // 64px
    large: spacing[20],  // 80px
    xlarge: spacing[24],  // 96px
  },
  
  // Component spacing
  component: {
    xs: spacing[2],       // 8px
    sm: spacing[4],       // 16px
    md: spacing[6],       // 24px
    lg: spacing[8],       // 32px
    xl: spacing[12],      // 48px
  },
  
  // Form spacing
  form: {
    fieldGap: spacing[4],     // 16px between fields
    labelGap: spacing[2],     // 8px between label and input
    buttonGap: spacing[3],    // 12px between buttons
    sectionGap: spacing[6],   // 24px between form sections
  },
  
  // Card spacing
  card: {
    padding: spacing[6],       // 24px internal padding
    gap: spacing[4],           // 16px between elements
    margin: spacing[4],        // 16px external margin
  },
  
  // Navigation spacing
  navigation: {
    itemGap: spacing[2],       // 8px between nav items
    sectionGap: spacing[4],    // 16px between nav sections
    padding: spacing[4],       // 16px internal padding
  },
}

// Responsive spacing utilities
export const responsiveSpacing = {
  // Mobile-first responsive margins
  margin: {
    section: {
      mobile: spacing[8],     // 32px
      tablet: spacing[12],    // 48px
      desktop: spacing[16],   // 64px
    },
  },
  
  // Mobile-first responsive padding
  padding: {
    container: {
      mobile: spacing[4],     // 16px
      tablet: spacing[6],     // 24px
      desktop: spacing[8],    // 32px
    },
  },
}

// Spacing tokens for specific use cases
export const spacingTokens = {
  // Micro interactions
  micro: {
    xs: spacing[1],      // 4px
    sm: spacing[2],      // 8px
    md: spacing[3],      // 12px
  },
  
  // Touch targets (minimum 44px for mobile)
  touch: {
    min: spacing[11],    // 44px minimum touch target
    comfortable: spacing[12], // 48px comfortable touch target
    large: spacing[14],  // 56px large touch target
  },
  
  // Grid spacing
  grid: {
    gap: spacing[4],     // 16px grid gap
    margin: spacing[8],  // 32px grid margin
  },
  
  // Breathing room
  breathing: {
    tight: spacing[2],    // 8px
    normal: spacing[4],  // 16px
    relaxed: spacing[6], // 24px
    spacious: spacing[8], // 32px
  },
}

// CSS Custom Properties for spacing
export const spacingCSSVariables = {
  '--spacing-0': spacing[0],
  '--spacing-1': spacing[1],
  '--spacing-2': spacing[2],
  '--spacing-3': spacing[3],
  '--spacing-4': spacing[4],
  '--spacing-5': spacing[5],
  '--spacing-6': spacing[6],
  '--spacing-8': spacing[8],
  '--spacing-10': spacing[10],
  '--spacing-12': spacing[12],
  '--spacing-16': spacing[16],
  '--spacing-20': spacing[20],
  '--spacing-24': spacing[24],
  '--spacing-32': spacing[32],
}

// Type definitions
export type SpacingValue = keyof typeof spacing
export type LayoutSpacingKey = keyof typeof layoutSpacing
export type ResponsiveSpacingKey = keyof typeof responsiveSpacing

// Utility functions for spacing calculations
export const spacingUtils = {
  // Convert spacing value to pixels
  toPx: (value: string): number => {
    const base = 4 // 4px base unit
    const remValue = parseFloat(value.replace('rem', ''))
    return Math.round(remValue * base)
  },
  
  // Get spacing value by key
  get: (key: SpacingValue): string => spacing[key],
  
  // Calculate spacing ratio
  ratio: (larger: SpacingValue, smaller: SpacingValue): number => {
    const largerPx = spacingUtils.toPx(spacing[larger])
    const smallerPx = spacingUtils.toPx(spacing[smaller])
    return largerPx / smallerPx
  },
}
