'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'

interface ThemeContextType {
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    // Only check on client
    if (typeof globalThis === 'undefined' || !globalThis.document) return false
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  // Listen for OS theme changes
  useEffect(() => {
    const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Update document class when theme changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  // Memoize context value
  const value = useMemo(() => ({ isDark }), [isDark])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
