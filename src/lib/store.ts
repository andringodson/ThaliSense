import { useEffect, useState } from 'react'

/** useState that survives reloads. Everything stays in this browser only. */
export function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private mode or storage full: keep working in memory.
    }
  }, [key, value])
  return [value, setValue] as const
}
