// Base UI Components - HiTGuest Brand
// Reusable, clean architecture components with design system integration

import React from 'react'
import { cn } from '@/lib/utils'
import { designSystem, designSystemUtils } from '@/lib/design-system'

// Base Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    children,
    disabled,
    ...props 
  }, ref) => {
    const baseStyles = designSystemUtils.getComponent('button', 'primary')
    const variantStyles = designSystemUtils.getComponent('button', variant)
    
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
      xl: 'px-8 py-4 text-xl',
    }
    
    return (
      <button
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
          
          // Variant styles
          variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500',
          variant === 'secondary' && 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500',
          variant === 'outline' && 'border border-brand-600 text-brand-600 hover:bg-brand-50 focus:ring-brand-500',
          variant === 'ghost' && 'text-brand-600 hover:bg-brand-50 focus:ring-brand-500',
          variant === 'destructive' && 'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500',
          
          // Size styles
          sizeStyles[size],
          
          // State styles
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          fullWidth && 'w-full',
          
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {leftIcon && !loading && <span className="mr-2">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'

// Base Input Component
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  variant?: 'default' | 'filled' | 'outlined'
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type = 'text',
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    variant = 'default',
    ...props 
  }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-grey-700">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-grey-400">
              {leftIcon}
            </div>
          )}
          
          <input
            type={type}
            className={cn(
              // Base styles
              'w-full px-3 py-2 text-base border rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0',
              
              // Variant styles
              variant === 'default' && 'bg-white border-grey-300 focus:border-brand-600 focus:ring-brand-500',
              variant === 'filled' && 'bg-grey-50 border-grey-200 focus:border-brand-600 focus:ring-brand-500',
              variant === 'outlined' && 'bg-transparent border-grey-300 focus:border-brand-600 focus:ring-brand-500',
              
              // State styles
              error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
              props.disabled && 'bg-grey-100 border-grey-200 cursor-not-allowed',
              
              // Icon padding
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              
              className
            )}
            ref={ref}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-grey-400">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-error-600">{error}</p>
        )}
        
        {helperText && !error && (
          <p className="text-sm text-grey-500">{helperText}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

// Base Card Component
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className, 
    variant = 'default', 
    padding = 'md',
    hover = false,
    children,
    ...props 
  }, ref) => {
    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    }
    
    return (
      <div
        className={cn(
          // Base styles
          'bg-white rounded-lg transition-all duration-200',
          
          // Variant styles
          variant === 'default' && 'border border-grey-200 shadow-md',
          variant === 'elevated' && 'shadow-lg border-0',
          variant === 'outlined' && 'border-2 border-grey-300 shadow-none',
          
          // Hover effect
          hover && 'hover:shadow-lg hover:-translate-y-1',
          
          // Padding
          paddingStyles[padding],
          
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

// Base Badge Component
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'md',
    children,
    ...props 
  }, ref) => {
    const variantStyles = {
      default: 'bg-grey-100 text-grey-800',
      primary: 'bg-brand-100 text-brand-800',
      secondary: 'bg-purple-100 text-purple-800',
      success: 'bg-success-100 text-success-800',
      warning: 'bg-warning-100 text-warning-800',
      error: 'bg-error-100 text-error-800',
    }
    
    const sizeStyles = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-2.5 py-1.5 text-sm',
      lg: 'px-3 py-2 text-base',
    }
    
    return (
      <span
        className={cn(
          // Base styles
          'inline-flex items-center font-medium rounded-full',
          
          // Variant and size styles
          variantStyles[variant],
          sizeStyles[size],
          
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </span>
    )
  }
)
Badge.displayName = 'Badge'

// Base Avatar Component
export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fallback?: string
  variant?: 'circle' | 'square'
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ 
    className, 
    src, 
    alt = '',
    size = 'md',
    fallback,
    variant = 'circle',
    ...props 
  }, ref) => {
    const sizeStyles = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg',
    }
    
    const variantStyles = {
      circle: 'rounded-full',
      square: 'rounded-lg',
    }
    
    return (
      <div
        className={cn(
          // Base styles
          'inline-flex items-center justify-center bg-grey-200 text-grey-600 font-medium',
          
          // Size and variant styles
          sizeStyles[size],
          variantStyles[variant],
          
          className
        )}
        ref={ref}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className={cn('w-full h-full object-cover', variantStyles[variant])}
          />
        ) : (
          fallback || alt.charAt(0).toUpperCase()
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

// Base Separator Component
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  variant?: 'solid' | 'dashed' | 'dotted'
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ 
    className, 
    orientation = 'horizontal', 
    variant = 'solid',
    ...props 
  }, ref) => {
    const orientationStyles = {
      horizontal: 'h-px w-full',
      vertical: 'w-px h-full',
    }
    
    const variantStyles = {
      solid: 'bg-grey-200',
      dashed: 'border-t border-t-grey-200 border-dashed',
      dotted: 'border-t border-t-grey-200 border-dotted',
    }
    
    return (
      <div
        className={cn(
          // Base styles
          'shrink-0',
          
          // Orientation and variant styles
          orientationStyles[orientation],
          variantStyles[variant],
          
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Separator.displayName = 'Separator'
