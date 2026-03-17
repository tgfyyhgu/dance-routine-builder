'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    // Only access localStorage/matchMedia on client
    if (typeof globalThis === 'undefined' || !globalThis.document) return false
    const saved = localStorage.getItem('theme')
    const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    return saved === 'dark' || (!saved && prefersDark)
  })

  // Update document class and localStorage when theme changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => {
    setIsDark(prev => !prev)
  }

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ isDark, toggleTheme }), [isDark])

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
