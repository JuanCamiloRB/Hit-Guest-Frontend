// Border Radius System - HiTGuest Brand
// Consistent border radius for modern, clean interfaces

export const borderRadius = {
  // Base border radius values
  none: '0',
  sm: '0.125rem',    // 2px
  base: '0.25rem',   // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  '3xl': '1.5rem',   // 24px
  full: '9999px',    // Pill shape
}

// Component-specific border radius
export const componentBorders = {
  // Buttons
  button: {
    sm: borderRadius.sm,
    base: borderRadius.md,
    lg: borderRadius.lg,
    xl: borderRadius.xl,
    pill: borderRadius.full,
  },
  
  // Inputs and form elements
  input: {
    sm: borderRadius.sm,
    base: borderRadius.base,
    lg: borderRadius.md,
  },
  
  // Cards
  card: {
    sm: borderRadius.base,
    base: borderRadius.lg,
    lg: borderRadius.xl,
    modal: borderRadius['2xl'],
  },
  
  // Navigation
  navigation: {
    item: borderRadius.sm,
    dropdown: borderRadius.lg,
    sidebar: borderRadius.xl,
  },
  
  // Badges and tags
  badge: {
    sm: borderRadius.sm,
    base: borderRadius.base,
    pill: borderRadius.full,
  },
  
  // Avatars
  avatar: {
    sm: borderRadius.full,
    base: borderRadius.full,
    lg: borderRadius.full,
    rounded: borderRadius.lg,
  },
  
  // Modals and overlays
  modal: {
    base: borderRadius['2xl'],
    fullscreen: borderRadius.none,
  },
  
  // Tables
  table: {
    container: borderRadius.lg,
    cell: borderRadius.none,
    header: borderRadius.sm,
  },
  
  // Alerts and notifications
  alert: {
    base: borderRadius.lg,
    toast: borderRadius.xl,
  },
}

// Responsive border radius
export const responsiveBorders = {
  // Mobile-first responsive buttons
  button: {
    mobile: borderRadius.md,
    tablet: borderRadius.lg,
    desktop: borderRadius.xl,
  },
  
  // Mobile-first responsive cards
  card: {
    mobile: borderRadius.base,
    tablet: borderRadius.lg,
    desktop: borderRadius.xl,
  },
}

// Border radius for specific design patterns
export const patternBorders = {
  // Neumorphic elements
  neumorphic: {
    base: borderRadius['2xl'],
    large: borderRadius['3xl'],
  },
  
  // Glass morphism
  glass: {
    base: borderRadius.xl,
    card: borderRadius['2xl'],
  },
  
  // Minimal design
  minimal: {
    subtle: borderRadius.sm,
    base: borderRadius.base,
  },
  
  // Playful design
  playful: {
    rounded: borderRadius.lg,
    pill: borderRadius.full,
  },
}

// CSS Custom Properties for border radius
export const borderCSSVariables = {
  '--border-radius-none': borderRadius.none,
  '--border-radius-sm': borderRadius.sm,
  '--border-radius-base': borderRadius.base,
  '--border-radius-md': borderRadius.md,
  '--border-radius-lg': borderRadius.lg,
  '--border-radius-xl': borderRadius.xl,
  '--border-radius-2xl': borderRadius['2xl'],
  '--border-radius-3xl': borderRadius['3xl'],
  '--border-radius-full': borderRadius.full,
}

// Type definitions
export type BorderRadiusValue = keyof typeof borderRadius
export type ComponentType = keyof typeof componentBorders
export type ComponentSize = 'sm' | 'base' | 'lg' | 'xl' | 'pill' | 'rounded' | 'modal' | 'fullscreen'

// Utility functions for border radius
export const borderUtils = {
  // Get border radius by key
  get: (key: BorderRadiusValue): string => borderRadius[key],
  
  // Get component-specific border radius
  getComponent: (component: ComponentType, size: ComponentSize): string => {
    const componentBordersTyped = componentBorders as any
    return componentBordersTyped[component]?.[size] || borderRadius.base
  },
  
  // Get responsive border radius
  getResponsive: (component: ComponentType, breakpoint: 'mobile' | 'tablet' | 'desktop'): string => {
    const responsiveBordersTyped = responsiveBorders as any
    return responsiveBordersTyped[component]?.[breakpoint] || borderRadius.base
  },
  
  // Check if border radius is circular
  isCircular: (value: string): boolean => value === borderRadius.full,
  
  // Convert to pixels
  toPx: (value: string): number => {
    const remValue = parseFloat(value.replace('rem', ''))
    return Math.round(remValue * 16) // 16px = 1rem
  },
}

// Border width system
export const borderWidth = {
  none: '0',
  thin: '0.5px',
  light: '1px',
  normal: '1.5px',
  medium: '2px',
  thick: '3px',
  heavy: '4px',
}

// Border style system
export const borderStyle = {
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
  double: 'double',
  groove: 'groove',
  ridge: 'ridge',
  inset: 'inset',
  outset: 'outset',
}

// Combined border utilities
export const borderCombinations = {
  // Common button borders
  button: {
    default: `${borderWidth.light} ${borderStyle.solid} var(--color-brand-600)`,
    hover: `${borderWidth.normal} ${borderStyle.solid} var(--color-brand-700)`,
    focus: `${borderWidth.medium} ${borderStyle.solid} var(--color-brand-600)`,
    disabled: `${borderWidth.light} ${borderStyle.solid} var(--color-grey-300)`,
  },
  
  // Common input borders
  input: {
    default: `${borderWidth.light} ${borderStyle.solid} var(--color-grey-300)`,
    focus: `${borderWidth.normal} ${borderStyle.solid} var(--color-brand-600)`,
    error: `${borderWidth.normal} ${borderStyle.solid} var(--color-error-500)`,
    disabled: `${borderWidth.light} ${borderStyle.dashed} var(--color-grey-200)`,
  },
  
  // Common card borders
  card: {
    default: `${borderWidth.light} ${borderStyle.solid} var(--color-grey-200)`,
    elevated: `${borderWidth.light} ${borderStyle.solid} var(--color-grey-100)`,
    interactive: `${borderWidth.normal} ${borderStyle.solid} var(--color-brand-200)`,
  },
}
