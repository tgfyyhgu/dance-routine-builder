"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/AuthContext"
import { createShareLink, copyToClipboard } from "@/lib/sharing"

interface SavedRoutine {
  id: string
  name: string
  dance_style: string
  created_at: string
  steps: unknown[]
}

export default function MyRoutinesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [routines, setRoutines] = useState<SavedRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [groupedByDance, setGroupedByDance] = useState<Record<string, SavedRoutine[]>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [shareModal, setShareModal] = useState<{ id: string; url: string } | null>(null)
  const [shareLoading, setShareLoading] = useState(false)

  useEffect(() => {
    // Don't load routines until we know if user is authenticated
    if (authLoading) return

    // Redirect if not logged in
    if (!user) {
      router.push('/login')
      return
    }

    async function loadRoutines() {
      try {
        const { data, error } = await supabase
          .from("routines")
          .select("*")
          .eq("user_id", user!.id)
          .order("dance_style", { ascending: true })
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error loading routines:", error)
          alert("Failed to load routines")
          return
        }

        if (data) {
          setRoutines(data)
          
          // Group routines by dance style
          const grouped = data.reduce((acc: Record<string, SavedRoutine[]>, routine) => {
            const danceStyle = routine.dance_style
            if (!acc[danceStyle]) {
              acc[danceStyle] = []
            }
            acc[danceStyle].push(routine)
            return acc
          }, {})
          
          setGroupedByDance(grouped)
        }
      } finally {
        setLoading(false)
      }
    }

    loadRoutines()
  }, [user, authLoading, router])

  async function deleteRoutine(id: string) {
    try {
      const { error } = await supabase.from("routines").delete().eq("id", id)

      if (error) {
        console.error("Error deleting routine:", error)
        alert("Failed to delete routine")
        return
      }

      // Remove from state
      setRoutines(r => r.filter(routine => routine.id !== id))
      setGroupedByDance(prev => {
        const updated = { ...prev }
        for (const danceStyle in updated) {
          updated[danceStyle] = updated[danceStyle].filter(r => r.id !== id)
          if (updated[danceStyle].length === 0) {
            delete updated[danceStyle]
          }
        }
        return updated
      })
      
      setDeleteConfirm(null)
      alert("Routine deleted successfully")
    } catch (error) {
      console.error("Error deleting routine:", error)
      alert("Error deleting routine")
    }
  }

  function editRoutine(id: string, danceStyle: string) {
    router.push(`/${danceStyle}/choreo?routineId=${id}`)
  }

  async function duplicateRoutine(routine: SavedRoutine) {
    const newName = prompt("Duplicate routine with a new name:", routine.name + " (Copy)")
    if (newName === null) return

    if (!newName.trim()) {
      alert("Please enter a routine name")
      return
    }

    try {
      const { v4: uuid } = await import("uuid")
      const newId = uuid()
      
      const { error } = await supabase.from("routines").insert([
        {
          id: newId,
          name: newName,
          dance_style: routine.dance_style,
          steps: routine.steps,
          created_at: new Date().toISOString(),
          user_id: user?.id,
        },
      ])

      if (error) {
        console.error("Error duplicating routine:", error)
        alert("Failed to duplicate routine: " + error.message)
        return
      }

      // Add new routine to state
      const newRoutine: SavedRoutine = {
        id: newId,
        name: newName,
        dance_style: routine.dance_style,
        steps: routine.steps,
        created_at: new Date().toISOString(),
      }

      setRoutines(r => [...r, newRoutine])
      setGroupedByDance(prev => ({
        ...prev,
        [routine.dance_style]: [...(prev[routine.dance_style] || []), newRoutine],
      }))

      alert(`Routine duplicated as "${newName}"!`)
    } catch (error) {
      console.error("Error duplicating routine:", error)
      alert("Error duplicating routine")
    }
  }

  async function shareRoutine(routine: SavedRoutine) {
    setShareLoading(true)
    
    try {
      // Generate share link using the sharing utilities
      const { token, url } = await createShareLink(routine.id, user!.id, false)
      
      // Show share modal with the new URL
      setShareModal({ id: routine.id, url })
    } catch (error) {
      console.error("Error creating share link:", error)
      alert("Failed to share routine: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setShareLoading(false)
    }
  }

  async function copyShareLink() {
    if (!shareModal) return
    const copied = await copyToClipboard(shareModal.url)
    if (copied) {
      alert('Share link copied to clipboard!')
    } else {
      alert('Failed to copy link')
    }
  }

  if (loading) {
    return (
      <main className="bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6 min-h-[60vh]">
        <p className="text-lg text-gray-600 dark:text-gray-400">Loading routines...</p>
      </main>
    )
  }

  return (
    <main className="bg-gray-50 dark:bg-gray-950 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">My Routines</h1>

        {routines.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow dark:shadow-lg p-12 text-center border dark:border-gray-800">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">No saved routines yet</p>
            <Link
              href="/"
              className="inline-block bg-blue-500 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors font-medium text-sm"
            >
              Create Your First Routine
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByDance).map(([danceStyle, danceRoutines]) => (
              <div key={danceStyle} className="bg-white dark:bg-gray-900 rounded-lg shadow dark:shadow-lg overflow-hidden border dark:border-gray-800">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 px-6 py-3">
                  <h2 className="text-lg font-bold text-white">{danceStyle.toUpperCase()}</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white text-xs">
                          Routine Name
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white text-xs">
                          Figures
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white text-xs">
                          Created
                        </th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white text-xs">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {danceRoutines.map(routine => (
                        <tr key={routine.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white text-sm">{routine.name}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">
                            {Array.isArray(routine.steps) ? routine.steps.length : 0} figures
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">
                            {new Date(routine.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-right space-x-1">
                            <button
                              onClick={() => editRoutine(routine.id, routine.dance_style)}
                              className="inline-block bg-green-500 dark:bg-green-700 text-white px-2 py-1 rounded hover:bg-green-600 dark:hover:bg-green-600 transition-colors text-xs font-medium"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => duplicateRoutine(routine)}
                              className="inline-block bg-cyan-500 dark:bg-cyan-700 text-white px-2 py-1 rounded hover:bg-cyan-600 dark:hover:bg-cyan-600 transition-colors text-xs font-medium"
                            >
                              📋 Copy
                            </button>
                            <button
                              onClick={() => shareRoutine(routine)}
                              disabled={shareLoading}
                              className="inline-block bg-indigo-500 dark:bg-indigo-700 text-white px-2 py-1 rounded hover:bg-indigo-600 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors text-xs font-medium"
                            >
                              🔗 Share
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(routine.id)}
                              className="inline-block bg-red-500 dark:bg-red-700 text-white px-2 py-1 rounded hover:bg-red-600 dark:hover:bg-red-600 transition-colors text-xs font-medium"
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 max-w-sm dark:text-white border dark:border-gray-800">
            <h3 className="text-lg font-bold mb-3">Share Routine</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-3 text-xs">
              Your routine is now shareable! Copy the link below to share with coaches or dance partners.
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded mb-3 break-all text-xs font-mono text-gray-900 dark:text-gray-100">
              {shareModal.url}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShareModal(null)}
                className="px-3 py-1.5 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
              >
                Close
              </button>
              <button
                onClick={copyShareLink}
                className="px-3 py-1.5 bg-indigo-500 dark:bg-indigo-700 text-white rounded hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-colors font-medium text-xs"
              >
                📋 Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 max-w-sm dark:text-white border dark:border-gray-800">
            <h3 className="text-lg font-bold mb-3">Delete Routine?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-xs">
              This action cannot be undone. Are you sure you want to delete this routine?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteRoutine(deleteConfirm)}
                className="px-3 py-1.5 bg-red-500 dark:bg-red-700 text-white rounded hover:bg-red-600 dark:hover:bg-red-600 transition-colors font-medium text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    )
}
