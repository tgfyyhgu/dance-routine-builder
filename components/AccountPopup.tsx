'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'

interface AccountPopupProps {
  readonly onClose: () => void
}

export default function AccountPopup({ onClose }: AccountPopupProps) {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null)
  const [isClearingData, setIsClearingData] = useState(false)
  const [clearDataStatus, setClearDataStatus] = useState<string | null>(null)

  if (!user) return null

  const handleLogout = async () => {
    await signOut()
    router.push('/')
    onClose()
  }

  async function handleDeleteAccount() {
    if (!user) return

    const confirmed = window.confirm(
      `Are you sure you want to delete your account?\n\nThis will delete:\n• All your routines\n• All your figures\n• All your shares\n\nThis action cannot be undone.`
    )
    if (!confirmed) return

    const doubleConfirm = window.confirm(
      'This is your last chance to change your mind. Confirm deletion?'
    )
    if (!doubleConfirm) return

    const userInput = window.prompt('Type DELETE to confirm permanent account deletion:')
    if (userInput !== 'DELETE') {
      alert('Cancelled. Your account is safe.')
      return
    }

    setIsDeleting(true)
    setDeleteStatus('Deleting account...')

    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        setDeleteStatus(`❌ ${error.error || 'Failed to delete account'}`)
        setIsDeleting(false)
        return
      }

      setDeleteStatus('✓ Account deleted successfully')
      setTimeout(async () => {
        await signOut()
        router.push('/')
      }, 1500)
    } catch (error) {
      console.error('Error:', error)
      setDeleteStatus('❌ Unexpected error')
      setIsDeleting(false)
    }
  }

  async function handleClearData() {
    if (!user) return

    const confirmed = window.confirm(
      `Are you sure you want to clear your data?\n\nThis will delete:\n• All your routines\n• All your figures\n• All your shares\n\nThis action cannot be undone.`
    )
    if (!confirmed) return

    const doubleConfirm = window.confirm('This is your last chance. Confirm data deletion?')
    if (!doubleConfirm) return

    setIsClearingData(true)
    setClearDataStatus('Clearing data...')

    try {
      // Delete all routines, figures, and shares for this user
      const { error: routinesError } = await supabase
        .from('routines')
        .delete()
        .eq('created_by', user.id)

      const { error: figuresError } = await supabase
        .from('figures')
        .delete()
        .eq('created_by', user.id)

      const { error: sharesError } = await supabase
        .from('shares')
        .delete()
        .eq('created_by', user.id)

      // Ignore errors if they're just about no matching rows - consider it a success
      // since the goal is to have no data anyway
      if (routinesError && routinesError.code !== 'PGRST116') {
        console.error('Routines delete error:', routinesError)
        setClearDataStatus('❌ Failed to clear routines')
        setIsClearingData(false)
        return
      }
      if (figuresError && figuresError.code !== 'PGRST116') {
        console.error('Figures delete error:', figuresError)
        setClearDataStatus('❌ Failed to clear figures')
        setIsClearingData(false)
        return
      }
      if (sharesError && sharesError.code !== 'PGRST116') {
        console.error('Shares delete error:', sharesError)
        setClearDataStatus('❌ Failed to clear shares')
        setIsClearingData(false)
        return
      }

      setClearDataStatus('✓ Data cleared successfully')
      setTimeout(() => {
        router.push('/')
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Error:', error)
      setClearDataStatus('❌ Unexpected error')
      setIsClearingData(false)
    }
  }

  return (
    <>
      {/* Backdrop to close popup when clicking outside */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Popup Panel */}
      <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50 w-64">
        {/* Account Info */}
        <div className="border-b dark:border-gray-700 p-4">
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Email</label>
            <p className="text-sm text-gray-900 dark:text-white break-all">{user.email}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">User ID</label>
            <p className="text-xs text-gray-600 dark:text-gray-300 font-mono break-all">{user.id}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-3">
          <Link
            href="/my-routines"
            className="block text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            onClick={onClose}
          >
            My Routines
          </Link>

          <button
            onClick={handleClearData}
            disabled={isClearingData}
            className="w-full text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium disabled:opacity-50 text-left"
          >
            {isClearingData ? 'Clearing...' : 'Clear Data'}
          </button>

          {clearDataStatus && (
            <p className="text-xs text-center text-gray-600 dark:text-gray-400">{clearDataStatus}</p>
          )}

          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="w-full text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium disabled:opacity-50 text-left"
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </button>

          {deleteStatus && (
            <p className="text-xs text-center text-red-600 dark:text-red-400">{deleteStatus}</p>
          )}

          <button
            onClick={handleLogout}
            className="w-full text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium pt-3 border-t border-gray-300 dark:border-gray-700 text-left"
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}
