'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { RoutineStep, Routine } from '@/types/routine'
import RoutinePlayer from '@/components/RoutinePlayer'
import { supabase } from '@/lib/supabaseClient'

export default function SharePage() {
  const { token } = useParams() as { token: string }
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSharedRoutine() {
      if (!token) return

      try {
        const { data, error: fetchError } = await supabase
          .from('routines')
          .select('*')
          .eq('shared_token', token)
          .single()

        if (fetchError) {
          setError('Routine not found or no longer shared')
          return
        }

        if (!data) {
          setError('Routine not found')
          return
        }

        setRoutine(data as Routine)
      } catch (err) {
        console.error('Error loading shared routine:', err)
        setError('Error loading routine')
      } finally {
        setLoading(false)
      }
    }

    loadSharedRoutine()
  }, [token])

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

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>This is a shared view. You can&apos;t edit this routine.</p>
        </div>
      </div>
    </main>
  )
}
