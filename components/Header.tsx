'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { useParams, usePathname } from 'next/navigation'
import AccountPopup from './AccountPopup'

interface HeaderProps {
  readonly danceName?: string
  readonly currentPage?: 'figures' | 'choreo'
}

export default function Header({ danceName: propDanceName, currentPage: propCurrentPage }: HeaderProps) {
  const { user, loading } = useAuth()
  const [showAccountPopup, setShowAccountPopup] = useState(false)
  const params = useParams()
  const pathname = usePathname()

  // Auto-detect dance name and current page from URL if not provided as props
  const paramDance = params.dance as string | undefined
  const danceName = propDanceName || paramDance

  // Determine current page from pathname if not provided as props
  let currentPage: 'figures' | 'choreo' | undefined = propCurrentPage
  if (!currentPage) {
    if (pathname?.includes('/figures')) currentPage = 'figures'
    else if (pathname?.includes('/choreo')) currentPage = 'choreo'
  }

  if (loading) return null

  const otherPage = currentPage === 'figures' ? 'choreo' : 'figures'
  const otherPageLabel = currentPage === 'figures' ? 'Choreo' : 'Figures'
  const otherPageHref = danceName ? `/${danceName}/${otherPage}` : '#'

  return (
    <header className="border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-4 md:px-6 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            Home
          </Link>
          {danceName && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium capitalize">
                {danceName}
              </span>
            </>
          )}
          {currentPage && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium capitalize">
                {currentPage}
              </span>
            </>
          )}
        </div>

        {/* Middle: Context-Specific Link */}
        {danceName && currentPage && (
          <div className="flex-1 text-center">
            <Link
              href={otherPageHref}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
            >
              {otherPageLabel}
            </Link>
          </div>
        )}

        {/* Right: Account Icon or Sign In */}
        <div className="flex items-center gap-4 relative">
          {user ? (
            <button
              onClick={() => setShowAccountPopup(!showAccountPopup)}
              className="text-2xl hover:opacity-70 transition-opacity"
              title="Account"
            >
              👤
            </button>
          ) : (
            <Link
              href="/login"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
            >
              Sign In
            </Link>
          )}

          {/* Account Popup */}
          {user && showAccountPopup && (
            <AccountPopup
              onClose={() => setShowAccountPopup(false)}
            />
          )}
        </div>
      </div>
    </header>
  )
}
