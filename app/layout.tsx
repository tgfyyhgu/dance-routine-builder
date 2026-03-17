'use client'

import "./globals.css"
import Link from "next/link"
import { AuthProvider, useAuth } from "@/lib/AuthContext"
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
    <nav className="p-4 border-b flex justify-between items-center">
      <Link href="/" className="font-bold text-lg">
        Dance Routine Builder
      </Link>
      
      <div className="flex gap-4 items-center">
        <Link href="/">Home</Link>
        {user ? (
          <>
            <Link href="/my-routines">My Routines</Link>
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-blue-500 hover:underline">
              Login
            </Link>
            <Link href="/signup" className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
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
    <html lang="en">
      <body>
        <AuthProvider>
          <Navigation />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}