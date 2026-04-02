/**
 * Utility functions to convert between camelCase and snake_case
 * Frontend uses camelCase, Backend uses snake_case
 */

type AnyObject = Record<string, any>

/**
 * Convert a string from camelCase to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

/**
 * Convert a string from snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function keysToSnakeCase<T extends AnyObject>(obj: T): any {
  if (obj === null || obj === undefined) return obj
  
  if (Array.isArray(obj)) {
    return obj.map(item => keysToSnakeCase(item))
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = toSnakeCase(key)
      const value = obj[key]
      acc[snakeKey] = keysToSnakeCase(value)
      return acc
    }, {} as any)
  }
  
  return obj
}

/**
 * Convert object keys from snake_case to camelCase
 */
export function keysToCamelCase<T extends AnyObject>(obj: T): any {
  if (obj === null || obj === undefined) return obj
  
  if (Array.isArray(obj)) {
    return obj.map(item => keysToCamelCase(item))
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = toCamelCase(key)
      const value = obj[key]
      acc[camelKey] = keysToCamelCase(value)
      return acc
    }, {} as any)
  }
  
  return obj
}
