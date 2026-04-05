'use client'

import "./globals.css"
import { AuthProvider } from "@/lib/AuthContext"
import { ThemeProvider } from "@/lib/ThemeContext"
import Header from "@/components/Header"

export default function RootLayout({children,}: {
  readonly children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <div className="overflow-y-auto">
              {children}
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}