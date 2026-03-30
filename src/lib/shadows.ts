// Shadow System - HiTGuest Brand
// Subtle, professional shadows for depth and hierarchy

export const shadows = {
  // Base shadows
  none: 'none',
  
  // Subtle shadows for UI elements
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  
  // Default shadow for cards, buttons
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  
  // Medium shadow for elevated elements
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  
  // Large shadow for modals, dropdowns
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  
  // Extra large shadow for special elements
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  
  // 2xl shadow for overlays
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  
  // Inner shadow for inset effects
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
}

// Brand-specific shadows with color tinting
export const brandShadows = {
  // Brand blue shadow
  brand: {
    sm: '0 1px 2px 0 rgba(124, 139, 193, 0.1)',
    base: '0 1px 3px 0 rgba(124, 139, 193, 0.15), 0 1px 2px 0 rgba(124, 139, 193, 0.1)',
    md: '0 4px 6px -1px rgba(124, 139, 193, 0.15), 0 2px 4px -1px rgba(124, 139, 193, 0.1)',
    lg: '0 10px 15px -3px rgba(124, 139, 193, 0.15), 0 4px 6px -2px rgba(124, 139, 193, 0.08)',
  },
  
  // Purple accent shadow
  purple: {
    sm: '0 1px 2px 0 rgba(168, 85, 247, 0.1)',
    base: '0 1px 3px 0 rgba(168, 85, 247, 0.15), 0 1px 2px 0 rgba(168, 85, 247, 0.1)',
    md: '0 4px 6px -1px rgba(168, 85, 247, 0.15), 0 2px 4px -1px rgba(168, 85, 247, 0.1)',
  },
  
  // Success green shadow
  success: {
    sm: '0 1px 2px 0 rgba(34, 197, 94, 0.1)',
    base: '0 1px 3px 0 rgba(34, 197, 94, 0.15), 0 1px 2px 0 rgba(34, 197, 94, 0.1)',
  },
  
  // Error red shadow
  error: {
    sm: '0 1px 2px 0 rgba(239, 68, 68, 0.1)',
    base: '0 1px 3px 0 rgba(239, 68, 68, 0.15), 0 1px 2px 0 rgba(239, 68, 68, 0.1)',
  },
  
  // Warning orange shadow
  warning: {
    sm: '0 1px 2px 0 rgba(245, 158, 11, 0.1)',
    base: '0 1px 3px 0 rgba(245, 158, 11, 0.15), 0 1px 2px 0 rgba(245, 158, 11, 0.1)',
  },
}

// Interactive shadows for hover/focus states
export const interactiveShadows = {
  // Hover states
  hover: {
    card: '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.08)',
    button: '0 4px 6px -1px rgba(124, 139, 193, 0.2), 0 2px 4px -1px rgba(124, 139, 193, 0.15)',
    dropdown: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.06)',
  },
  
  // Focus states
  focus: {
    primary: '0 0 0 3px rgba(124, 139, 193, 0.3)',
    secondary: '0 0 0 3px rgba(168, 85, 247, 0.3)',
    error: '0 0 0 3px rgba(239, 68, 68, 0.3)',
    success: '0 0 0 3px rgba(34, 197, 94, 0.3)',
  },
  
  // Active states
  active: {
    button: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
    card: '0 4px 6px -1px rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.08)',
  },
}

// Contextual shadows for specific components
export const contextualShadows = {
  // Navigation
  navigation: {
    sidebar: '2px 0 8px rgba(0, 0, 0, 0.1)',
    header: '0 2px 8px rgba(0, 0, 0, 0.06)',
    dropdown: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  
  // Cards
  card: {
    default: shadows.md,
    elevated: shadows.lg,
    interactive: interactiveShadows.hover.card,
    pressed: interactiveShadows.active.card,
  },
  
  // Buttons
  button: {
    default: shadows.sm,
    hover: interactiveShadows.hover.button,
    focus: interactiveShadows.focus.primary,
    active: interactiveShadows.active.button,
    disabled: 'none',
  },
  
  // Modals and overlays
  modal: {
    overlay: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    content: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  
  // Forms
  form: {
    input: '0 1px 3px rgba(0, 0, 0, 0.1)',
    inputFocus: interactiveShadows.focus.primary,
    inputError: interactiveShadows.focus.error,
    select: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  
  // Tables
  table: {
    header: '0 1px 3px rgba(0, 0, 0, 0.05)',
    rowHover: '0 1px 3px rgba(0, 0, 0, 0.08)',
    cell: 'none',
  },
}

// Animated shadows for transitions
export const animatedShadows = {
  // Smooth shadow transitions
  smooth: {
    transition: 'box-shadow 0.2s ease-in-out',
    values: {
      rest: shadows.sm,
      hover: shadows.md,
      active: shadows.lg,
    },
  },
  
  // Bounce effect for interactions
  bounce: {
    transition: 'box-shadow 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    values: {
      rest: shadows.sm,
      hover: shadows.lg,
      active: shadows.xl,
    },
  },
}

// CSS Custom Properties for shadows
export const shadowCSSVariables = {
  '--shadow-sm': shadows.sm,
  '--shadow-base': shadows.base,
  '--shadow-md': shadows.md,
  '--shadow-lg': shadows.lg,
  '--shadow-xl': shadows.xl,
  '--shadow-2xl': shadows['2xl'],
  '--shadow-inner': shadows.inner,
  
  '--shadow-brand-sm': brandShadows.brand.sm,
  '--shadow-brand-base': brandShadows.brand.base,
  '--shadow-brand-md': brandShadows.brand.md,
  '--shadow-brand-lg': brandShadows.brand.lg,
  
  '--shadow-focus-primary': interactiveShadows.focus.primary,
  '--shadow-focus-secondary': interactiveShadows.focus.secondary,
  '--shadow-focus-error': interactiveShadows.focus.error,
}

// Type definitions
export type ShadowValue = keyof typeof shadows
export type BrandShadowColor = keyof typeof brandShadows
export type InteractiveShadowType = keyof typeof interactiveShadows
export type ContextualComponent = keyof typeof contextualShadows

// Utility functions for shadows
export const shadowUtils = {
  // Get shadow by key
  get: (key: ShadowValue): string => shadows[key],
  
  // Get brand shadow
  getBrand: (color: BrandShadowColor, size: 'sm' | 'base' | 'md' | 'lg'): string => {
    const colorShadows = brandShadows[color] as any
    return colorShadows?.[size] || brandShadows.brand[size as keyof typeof brandShadows.brand]
  },
  
  // Get contextual shadow
  getContextual: (component: ContextualComponent, state?: string): string => {
    const componentShadows = contextualShadows[component]
    if (state && typeof componentShadows === 'object' && state in componentShadows) {
      return (componentShadows as any)[state]
    }
    return typeof componentShadows === 'string' ? componentShadows : shadows.sm
  },
  
  // Combine multiple shadows
  combine: (...shadowValues: string[]): string => shadowValues.join(', '),
}
