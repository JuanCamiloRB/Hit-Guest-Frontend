import { useState, useCallback, useMemo } from "react"

interface UseLocalStorageOptions {
  excludeKeys?: string[]
}

export function useLocalStorage<T>(key: string, initialValue: T, options?: UseLocalStorageOptions) {
  // Las claves excluidas llegan como literal en línea (`{ excludeKeys: [...] }`),
  // así que el array es nuevo en cada render y no sirve como dependencia. Antes
  // se resolvía escribiendo una ref DURANTE el render, que es precisamente lo
  // que React desaconseja: en modo concurrente un render puede descartarse
  // después de haber mutado la ref, dejándola describiendo un árbol que nunca
  // se montó. Memorizar por CONTENIDO da la misma estabilidad sin escribir nada
  // fuera de tiempo.
  const excludeKeysSignature = (options?.excludeKeys ?? []).join("\u0000")
  const excludeKeys = useMemo(
    () => (excludeKeysSignature ? excludeKeysSignature.split("\u0000") : []),
    [excludeKeysSignature],
  )

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
          if (excludeKeys.length && typeof toPersist === "object" && toPersist !== null) {
            toPersist = { ...toPersist } as T
            for (const k of excludeKeys) {
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
  }, [key, excludeKeys])

  return [storedValue, setValue] as const
}
