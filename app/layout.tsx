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
    <nav className="p-4 border-b flex justify-between items-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm flex-shrink-0">
      <Link href="/" className="font-bold text-lg hover:opacity-80 transition-opacity">
        🎬 Dance Routine Builder
      </Link>
      
      <div className="flex gap-6 items-center">
        {user ? (
          <>
            <Link href="/my-routines" className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
              My Routines
            </Link>
            <span className="text-sm text-gray-600 dark:text-gray-400">{user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 dark:bg-red-700 text-white px-4 py-2 rounded text-sm hover:bg-red-600 dark:hover:bg-red-600 transition-colors font-medium"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors font-medium">
              Login
            </Link>
            <Link href="/signup" className="bg-blue-500 dark:bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors font-medium">
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