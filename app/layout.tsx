'use client'

import "./globals.css"
import Link from "next/link"
import { AuthProvider, useAuth } from "@/lib/AuthContext"
import { ThemeProvider } from "@/lib/ThemeContext"
import { useRouter } from "next/navigation"

function Navigation() {
  const { user, signOut, loading } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  if (loading) return null

  return (
    <nav className="p-3 md:p-4 border-b flex flex-col md:flex-row gap-3 md:gap-6 justify-between items-start md:items-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm flex-shrink-0">
      <Link href="/" className="font-bold text-base md:text-lg hover:opacity-80 transition-opacity whitespace-nowrap">
        🎬 Dance Routine Builder
      </Link>
      
      <div className="w-full md:w-auto flex flex-col md:flex-row gap-3 md:gap-6 items-start md:items-center">
        {user ? (
          <>
            <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 break-all">
              {user.email}
            </span>
            <Link 
              href="/account"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors text-sm md:text-base font-medium"
            >
              Account
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-500 dark:bg-red-700 text-white px-3 py-1 md:px-4 md:py-2 rounded text-xs md:text-sm hover:bg-red-600 dark:hover:bg-red-600 transition-colors font-medium w-full md:w-auto"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors font-medium text-sm md:text-base">
              Login
            </Link>
            <Link href="/signup" className="bg-blue-500 dark:bg-blue-700 text-white px-3 py-1 md:px-4 md:py-2 rounded text-xs md:text-sm hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors font-medium w-full md:w-auto">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default function RootLayout({children,}: {
  readonly children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <ThemeProvider>
          <AuthProvider>
            <Navigation />
            <div className="overflow-y-auto">
              {children}
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}