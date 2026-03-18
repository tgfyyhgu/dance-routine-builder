'use client'

import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export default function AccountPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null)

  if (!user) {
    return (
      <main className="bg-gray-50 dark:bg-gray-950 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to access account settings</p>
          <Link 
            href="/login"
            className="text-blue-500 dark:text-blue-400 hover:underline font-medium"
          >
            Go to Login
          </Link>
        </div>
      </main>
    )
  }

  async function handleDeleteAccount() {
    if (!user) {
      alert('User not found')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete your account?\n\nThis will delete:\n• All your routines\n• All your figures\n• All your shares\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    const doubleConfirm = window.confirm(
      'This is your last chance. Type "DELETE" in the next prompt to confirm permanent deletion.'
    )

    if (!doubleConfirm) return

    const userInput = window.prompt('Type DELETE to confirm account deletion:')
    if (userInput !== 'DELETE') {
      alert('Cancelled. Your account is safe.')
      return
    }

    setIsDeleting(true)
    setDeleteStatus('Deleting account...')

    try {
      // Call API route to delete account
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Error deleting account:', error)
        setDeleteStatus('❌ Failed to delete account')
        setIsDeleting(false)
        return
      }

      setDeleteStatus('✓ Account deleted successfully')

      // Sign out and redirect after a short delay
      setTimeout(async () => {
        await signOut()
        router.push('/')
      }, 1500)
    } catch (error) {
      console.error('Unexpected error:', error)
      setDeleteStatus('❌ Unexpected error')
      setIsDeleting(false)
    }
  }

  return (
    <main className="bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
      </div>

      <div className="max-w-2xl mx-auto p-8">
        {/* Account Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Email
              </label>
              <p className="text-gray-900 dark:text-white">{user.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                User ID
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">{user.id}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Account Created
              </label>
              <p className="text-gray-900 dark:text-white">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Danger Zone</h2>
          <p className="text-red-600 dark:text-red-300 text-sm mb-4">
            Delete your account and all associated data. This action is permanent and cannot be undone.
          </p>

          {deleteStatus && (
            <div className={`p-3 rounded mb-4 text-sm font-medium ${
              deleteStatus.includes('✓')
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {deleteStatus}
            </div>
          )}

          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="bg-red-600 dark:bg-red-700 text-white px-6 py-3 rounded font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : '🗑️ Delete Account'}
          </button>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <Link 
            href="/"
            className="text-blue-500 dark:text-blue-400 hover:underline font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
