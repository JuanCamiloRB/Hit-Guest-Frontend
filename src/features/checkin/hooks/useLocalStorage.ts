import { useState, useCallback, useRef } from "react"

interface UseLocalStorageOptions {
  excludeKeys?: string[]
}

export function useLocalStorage<T>(key: string, initialValue: T, options?: UseLocalStorageOptions) {
  const excludeKeysRef = useRef(options?.excludeKeys)
  excludeKeysRef.current = options?.excludeKeys

  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        const parsed = JSON.parse(item)
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          typeof initialValue === "object" &&
          initialValue !== null &&
          !Array.isArray(initialValue)
        ) {
          return { ...initialValue, ...parsed }
        }
        return parsed
      }
      return initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  // useCallback ensures stable reference so callers can safely include it in useEffect deps.
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value
      try {
        if (typeof window !== "undefined") {
          let toPersist = valueToStore
          const exclude = excludeKeysRef.current
          if (exclude?.length && typeof toPersist === "object" && toPersist !== null) {
            toPersist = { ...toPersist } as T
            for (const k of exclude) {
              delete (toPersist as Record<string, unknown>)[k]
            }
          }
          window.localStorage.setItem(key, JSON.stringify(toPersist))
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
      return valueToStore
    })
  }, [key])

  return [storedValue, setValue] as const
}
