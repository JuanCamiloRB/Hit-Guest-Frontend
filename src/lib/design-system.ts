// Design System Index - HiTGuest Brand
// Central export point for all design system tokens

export * from './colors'
export * from './typography'
export * from './spacing'
export * from './shadows'
export * from './borders'

// Combined design system configuration
export const designSystem = {
  // Brand identity
  brand: {
    name: 'HiTGuest',
    primaryColor: 'var(--color-brand-600)',
    secondaryColor: 'var(--color-purple-600)',
    accentColor: 'var(--color-brand-500)',
  },
  
  // Theme configuration
  theme: {
    // Light theme (default)
    light: {
      background: {
        primary: '#ffffff',
        secondary: 'var(--color-grey-50)',
        tertiary: 'var(--color-brand-50)',
      },
      text: {
        primary: 'var(--color-grey-900)',
        secondary: 'var(--color-grey-600)',
        tertiary: 'var(--color-grey-500)',
        inverse: '#ffffff',
      },
      border: {
        light: 'var(--color-grey-200)',
        medium: 'var(--color-grey-300)',
        dark: 'var(--color-grey-400)',
      },
    },
    
    // Dark theme (for future implementation)
    dark: {
      background: {
        primary: 'var(--color-grey-900)',
        secondary: 'var(--color-grey-800)',
        tertiary: 'var(--color-grey-700)',
      },
      text: {
        primary: '#ffffff',
        secondary: 'var(--color-grey-300)',
        tertiary: 'var(--color-grey-400)',
        inverse: 'var(--color-grey-900)',
      },
      border: {
        light: 'var(--color-grey-700)',
        medium: 'var(--color-grey-600)',
        dark: 'var(--color-grey-500)',
      },
    },
  },
  
  // Component defaults
  components: {
    button: {
      primary: {
        backgroundColor: 'var(--color-brand-600)',
        color: '#ffffff',
        border: 'none',
        borderRadius: 'var(--border-radius-md)',
        padding: 'var(--spacing-3) var(--spacing-6)',
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-semibold)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease-in-out',
      },
      secondary: {
        backgroundColor: 'transparent',
        color: 'var(--color-brand-600)',
        border: '1px solid var(--color-brand-600)',
        borderRadius: 'var(--border-radius-md)',
        padding: 'var(--spacing-3) var(--spacing-6)',
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-semibold)',
        boxShadow: 'none',
        transition: 'all 0.2s ease-in-out',
      },
    },
    
    input: {
      default: {
        backgroundColor: '#ffffff',
        color: 'var(--color-grey-900)',
        border: '1px solid var(--color-grey-300)',
        borderRadius: 'var(--border-radius-base)',
        padding: 'var(--spacing-3) var(--spacing-4)',
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-normal)',
        boxShadow: 'none',
        transition: 'all 0.2s ease-in-out',
      },
      focus: {
        border: '1px solid var(--color-brand-600)',
        boxShadow: '0 0 0 3px rgba(124, 139, 193, 0.3)',
      },
      error: {
        border: '1px solid var(--color-error-500)',
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)',
      },
    },
    
    card: {
      default: {
        backgroundColor: '#ffffff',
        border: '1px solid var(--color-grey-200)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--spacing-6)',
        boxShadow: 'var(--shadow-md)',
        transition: 'all 0.2s ease-in-out',
      },
      elevated: {
        boxShadow: 'var(--shadow-lg)',
      },
    },
  },
  
  // Layout defaults
  layout: {
    container: {
      maxWidth: '1200px',
      padding: 'var(--spacing-4)',
      margin: '0 auto',
    },
    section: {
      padding: 'var(--spacing-16) 0',
    },
    grid: {
      gap: 'var(--spacing-4)',
    },
  },
  
  // Animation defaults
  animations: {
    duration: {
      fast: '0.15s',
      normal: '0.2s',
      slow: '0.3s',
      slower: '0.5s',
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },
}

// CSS Custom Properties for the entire design system
export const cssVariables = {
  // Colors
  '--color-primary': 'var(--color-brand-600)',
  '--color-secondary': 'var(--color-purple-600)',
  '--color-accent': 'var(--color-brand-500)',
  
  // Typography
  '--font-family-sans': 'Inter, system-ui, sans-serif',
  '--font-size-xs': '0.75rem',
  '--font-size-sm': '0.875rem',
  '--font-size-base': '1rem',
  '--font-size-lg': '1.125rem',
  '--font-size-xl': '1.25rem',
  '--font-size-2xl': '1.5rem',
  '--font-size-3xl': '1.875rem',
  '--font-weight-normal': '400',
  '--font-weight-medium': '500',
  '--font-weight-semibold': '600',
  '--font-weight-bold': '700',
  
  // Spacing
  '--spacing-xs': 'var(--spacing-1)',
  '--spacing-sm': 'var(--spacing-2)',
  '--spacing-md': 'var(--spacing-4)',
  '--spacing-lg': 'var(--spacing-6)',
  '--spacing-xl': 'var(--spacing-8)',
  '--spacing-2xl': 'var(--spacing-12)',
  '--spacing-3xl': 'var(--spacing-16)',
  
  // Borders
  '--border-radius-sm': 'var(--border-radius-sm)',
  '--border-radius-md': 'var(--border-radius-md)',
  '--border-radius-lg': 'var(--border-radius-lg)',
  '--border-radius-xl': 'var(--border-radius-xl)',
  
  // Shadows
  '--shadow-sm': 'var(--shadow-sm)',
  '--shadow-md': 'var(--shadow-md)',
  '--shadow-lg': 'var(--shadow-lg)',
  
  // Animations
  '--transition-fast': '0.15s ease-in-out',
  '--transition-normal': '0.2s ease-in-out',
  '--transition-slow': '0.3s ease-in-out',
}

// Utility functions for the design system
export const designSystemUtils = {
  // Get theme value
  getTheme: (path: string, theme: 'light' | 'dark' = 'light'): string => {
    const keys = path.split('.')
    let value: any = designSystem.theme[theme]
    
    for (const key of keys) {
      value = value?.[key]
    }
    
    return value || ''
  },
  
  // Get component style
  getComponent: (component: string, variant: string): any => {
    const componentStyles = designSystem.components[component as keyof typeof designSystem.components] as any
    return componentStyles?.[variant] || {}
  },
  
  // Check if color is light or dark
  isLightColor: (color: string): boolean => {
    // Simple check - can be enhanced with proper color analysis
    return color.includes('white') || color.includes('50') || color.includes('100')
  },
  
  // Generate CSS custom property name
  cssVar: (name: string): string => `--${name}`,
}

// Type definitions
export type Theme = 'light' | 'dark'
export type ComponentName = keyof typeof designSystem.components
export type ComponentVariant = string

// Design system provider configuration (for future React context implementation)
export const designSystemConfig = {
  defaultTheme: 'light' as Theme,
  enableDarkMode: false, // For future implementation
  enableCustomProperties: true,
  enableResponsiveTypography: true,
  enableComponentVariants: true,
}
