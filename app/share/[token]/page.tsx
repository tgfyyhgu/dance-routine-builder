'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { RoutineStep, Routine } from '@/types/routine'
import RoutinePlayer from '@/components/RoutinePlayer'
import { getSharedRoutineByToken, copyRoutineToOwn } from '@/lib/sharing'

export default function SharePage() {
  const { token } = useParams() as { token: string }
  const { user } = useAuth()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [originalRoutine, setOriginalRoutine] = useState<Routine | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    async function loadSharedRoutine() {
      if (!token) return

      try {
        const result = await getSharedRoutineByToken(token)
        setRoutine(result.routine as Routine)
        if (result.original) {
          setOriginalRoutine(result.original as Routine)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error loading routine'
        console.error('Error loading shared routine:', err)
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadSharedRoutine()
  }, [token])

  async function handleCopyRoutine() {
    if (!user || !routine) {
      setError('You must be logged in to copy routines')
      return
    }

    setCopying(true)
    try {
      const newRoutineId = await copyRoutineToOwn(
        routine.id,
        user.id,
        `${routine.name} (Copy)`
      )
      setCopySuccess(true)
      setTimeout(() => {
        window.location.href = `/${routine.dance_style}/choreo?routineId=${newRoutineId}`
      }, 1500)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to copy routine'
      setError(message)
      console.error('Error copying routine:', err)
    } finally {
      setCopying(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading shared routine...</p>
      </main>
    )
  }

  if (error || !routine) {
    return (
      <main className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {error || 'Routine not found'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This shared routine is either not available or has been deleted.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-500 dark:bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-600 dark:hover:bg-blue-600"
          >
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">
            {routine.name || 'Untitled Routine'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {routine.dance_style ? routine.dance_style.toUpperCase() : 'Dance Routine'} • Shared View (Read-Only)
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Routine steps list */}
          <div className="border dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900">
            <h2 className="font-bold mb-4">Routine Steps</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {routine.steps && (routine.steps as RoutineStep[]).length > 0 ? (
                (routine.steps as RoutineStep[]).map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      currentStep === idx
                        ? 'bg-blue-500 dark:bg-blue-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="font-medium text-sm">{idx + 1}. {step.figure.name}</span>
                  </button>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No steps in this routine</p>
              )}
            </div>
          </div>

          {/* Routine player */}
          <div className="border dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900">
            <h2 className="font-bold mb-4">Preview</h2>
            {routine.steps && (routine.steps as RoutineStep[]).length > 0 ? (
              <RoutinePlayer
                steps={routine.steps as RoutineStep[]}
                currentStep={currentStep}
                onStepChange={setCurrentStep}
              />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No steps to preview</p>
            )}
          </div>
        </div>

        {/* Attribution & Copy Section */}
        {originalRoutine && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Based on <span className="font-semibold">{originalRoutine.name}</span>
            </p>
          </div>
        )}

        {/* Copy Button */}
        <div className="mt-8 text-center space-y-3">
          {user ? (
            <>
              <button
                onClick={handleCopyRoutine}
                disabled={copying}
                className="inline-block bg-green-600 dark:bg-green-700 text-white px-6 py-3 rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copySuccess ? '✓ Copied! Redirecting...' : copying ? 'Copying...' : '📋 Copy to My Routines'}
              </button>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                You can edit and save your own version
              </p>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-block bg-blue-600 dark:bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
            >
              Sign In to Copy
            </Link>
          )}
        </div>

        {/* Disclaimer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>This is a shared view. You can&apos;t edit this routine directly.</p>
          <p className="mt-1">Copy it to create your own editable version.</p>
        </div>
      </div>
    </main>
  )
}
