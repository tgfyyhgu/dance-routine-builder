"use client"

import React, { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import FigureCard from "@/components/FigureCard"
import Link from "next/link"
import { parseTimeToSeconds, formatSecondsToTime } from "@/lib/timeUtils"
import { useAuth } from "@/lib/AuthContext"

interface Figure {
  id: string
  name: string
  difficulty: number
  note: string
  youtube_url: string
  start_time: number
  end_time: number
  dance_style: string
  visibility?: 'private' | 'public'
  created_by?: string
}

// Helper function to clean YouTube URLs by removing playlist parameters
function cleanYouTubeUrl(url: string): string {
  if (!url) return url
  
  // Extract video ID using the same regex as RoutinePlayer
  const regExp = /^.*(?:youtu\.be\/|watch\?v=)([^#&?]*).*/
  const videoId = regExp.exec(url)?.[1]
  
  // If we found a video ID, return clean URL; otherwise return original
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`
  }
  return url
}

export default function FiguresPage() {
  const params = useParams()
  const dance = params.dance as string
  const { user } = useAuth()
  const [figures, setFigures] = useState<Figure[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState("")
  const [openVideos, setOpenVideos] = useState<Set<string>>(new Set())
  useEffect(() => {

    async function loadFigures() {
      const { data } = await supabase
        .from("figures")
        .select("*")
        .eq("dance_style", dance)

      if (data) {
        // Clean YouTube URLs for all figures (handles old figures with playlist params)
        const cleanedData = data.map(fig => ({
          ...fig,
          youtube_url: cleanYouTubeUrl(fig.youtube_url)
        }))
        setFigures(cleanedData)
      }
    }
    loadFigures()
  }, [dance])

  const filteredFigures = figures.filter((figure) => {
    const matchesSearch =
      figure.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      figure.note.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDifficulty =
      difficultyFilter === "" ||
      figure.difficulty === Number(difficultyFilter)
    return matchesSearch && matchesDifficulty
  })

  const [editMode, setEditMode] = useState(false)
  const [editedFigures, setEditedFigures] = useState<Figure[]>([])
  const [openVideosInEditMode, setOpenVideosInEditMode] = useState<Set<string>>(new Set())
  const [editingFigureId, setEditingFigureId] = useState<string | null>(null)
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)


  // Validate edited figures and sync with Supabase (delete, update, insert)
  async function saveChanges() {
    // Separate figures into: empty (delete), incomplete (need name), complete (save)
    const emptyFigures: string[] = []
    const incompleteFigures: Figure[] = []
    const completeFigures: Figure[] = []

    for (const fig of editedFigures) {
      const isCompletelyEmpty = 
        !fig.name?.trim() &&
        !fig.youtube_url?.trim() &&
        !fig.note?.trim() &&
        fig.start_time === 0 &&
        fig.end_time === 0 &&
        fig.difficulty === 0

      const hasOtherData = 
        fig.youtube_url?.trim() ||
        fig.note?.trim() ||
        fig.start_time !== 0 ||
        fig.end_time !== 0 ||
        fig.difficulty !== 0

      if (isCompletelyEmpty) {
        emptyFigures.push(fig.id)
      } else if (hasOtherData && !fig.name?.trim()) {
        incompleteFigures.push(fig)
      } else if (fig.name?.trim()) {
        completeFigures.push(fig)
      }
    }

    // Prompt for names if figures have data but no name
    if (incompleteFigures.length > 0) {
      for (let i = 0; i < incompleteFigures.length; i++) {
        const fig = incompleteFigures[i]
        
        // Build identifying info for the prompt
        const identifiers: string[] = []
        if (fig.note?.trim()) identifiers.push(`Note: "${fig.note}"`)
        if (fig.youtube_url?.trim()) identifiers.push("Has video")
        if (fig.difficulty > 0) identifiers.push(`Difficulty: ${fig.difficulty}`)
        const identifyingInfo = identifiers.length > 0 ? identifiers.join(" | ") : "Empty figure"
        
        const promptMsg = `Figure ${i + 1} of ${incompleteFigures.length}:\n${identifyingInfo}\n\nPlease enter a name:`
        const name = prompt(promptMsg, "")
        
        if (name === null) {
          // User cancelled - abort entire save
          return
        }
        if (!name.trim()) {
          alert("Name cannot be empty")
          return
        }
        fig.name = name.trim()
        completeFigures.push(fig)
      }
    }

    // Validate times for complete figures
    for (const fig of completeFigures) {
      if (fig.end_time && fig.start_time && fig.end_time <= fig.start_time) {
        alert(`End time must be greater than start time for ${fig.name}`)
        return
      }
    }

    const originalIds = figures.map(f => f.id)
    const allDeleteIds = new Set([...emptyFigures, ...originalIds.filter(id => !completeFigures.map(f => f.id).includes(id))])
    const deletedIds = Array.from(allDeleteIds)

    try {
      // DELETE
      for (const id of deletedIds) {
        const { error } = await supabase
          .from("figures")
          .delete()
          .eq("id", id)
        if (error) {
          console.error("Delete error for id", id, ":", error)
          alert(`Error deleting figure: ${error.message}`)
          return
        }
      }

      // UPDATE and INSERT
      for (const fig of completeFigures) {
        // Clean YouTube URL before saving (removes playlist parameters that prevent embedding)
        const cleanUrl = cleanYouTubeUrl(fig.youtube_url)

        if (originalIds.includes(fig.id)) {

          // UPDATE
          const { error } = await supabase
            .from("figures")
            .update({
              name: fig.name,
              difficulty: fig.difficulty,
              note: fig.note,
              youtube_url: cleanUrl,
              start_time: fig.start_time,
              end_time: fig.end_time,
              visibility: fig.visibility || 'private'
            })
            .eq("id", fig.id)
          
          if (error) {
            console.error("Update error:", error)
            alert("Error updating figure: " + error.message)
            return
          }

        } else {

          // INSERT
          const { error } = await supabase
            .from("figures")
            .insert({
              id: fig.id,
              name: fig.name,
              difficulty: fig.difficulty,
              note: fig.note,
              youtube_url: cleanUrl,
              start_time: fig.start_time,
              end_time: fig.end_time,
              dance_style: dance,
              created_by: user?.id,
              visibility: 'private'
            })
          
          if (error) {
            console.error("Insert error:", error)
            alert("Error adding figure: " + error.message)
            return
          }

        }

      }

      // Reload figures from database to confirm all changes persisted
      const { data } = await supabase
        .from("figures")
        .select("*")
        .eq("dance_style", dance)

      if (data) {
        const cleanedData = data.map(fig => ({
          ...fig,
          youtube_url: cleanYouTubeUrl(fig.youtube_url)
        }))
        setFigures(cleanedData)
      }
      
      // Collapse all videos when exiting edit mode
      setOpenVideosInEditMode(new Set())
      setEditingFigureId(null)
      setEditMode(false)
      alert("Changes saved successfully!")

    } catch (error) {
      console.error("Save error:", error)
      alert("Error saving changes: " + (error as Error).message)
    }

  }

  function toggleVideo(id: string) {
    const updated = new Set(openVideos)
    if (updated.has(id)) { updated.delete(id) } else { updated.add(id) }
    setOpenVideos(updated)
  }

  function toggleVideoInEditMode(id: string) {
    const updated = new Set(openVideosInEditMode)
    if (updated.has(id)) { updated.delete(id) } else { updated.add(id) }
    setOpenVideosInEditMode(updated)
  }

  return (
    <main className="bg-gray-50 dark:bg-gray-950">
      {/* Navigation Header */}
      <div className="border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{dance.toUpperCase()} - Manage Figures</h1>
          <Link 
            href={`/${dance}/choreo`}
            className="bg-blue-500 dark:bg-blue-700 text-white px-2 py-1 rounded hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors font-medium text-xs"
          >
            🎬 Choreography Builder
          </Link>
        </div>
      </div>

      <div className="p-10">
      <div className="flex gap-4 mb-8 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search figures by name or notes..."
          className="flex-1 min-w-60 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
        >
          <option value="">All Difficulties</option>
          <option value="0">No Difficulty (0)</option>
          <option value="1">⭐ Difficulty 1</option>
          <option value="2">⭐⭐ Difficulty 2</option>
          <option value="3">⭐⭐⭐ Difficulty 3</option>
          <option value="4">⭐⭐⭐⭐ Difficulty 4</option>
          <option value="5">⭐⭐⭐⭐⭐ Difficulty 5</option>
        </select>
        {(searchTerm || difficultyFilter) && (
          <button
            onClick={() => {
              setSearchTerm("")
              setDifficultyFilter("")
            }}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Showing {filteredFigures.length} of {figures.length} figures
      </p>

      {!editMode && (
        <div className="flex justify-between mb-4">
          <div className="flex gap-2">
            <button
              className="bg-yellow-500 dark:bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-600 dark:hover:bg-yellow-700 transition-colors font-medium"
              onClick={() => {
                // Only allow editing figures the user created
                const userFigures = figures.filter(f => f.created_by === user?.id)
                // Sort by created_at DESC (newest first), fallback to id if no created_at
              const sorted = [...userFigures].sort((a, b) => {
                const aFig = a as Figure & { created_at?: string }
                const bFig = b as Figure & { created_at?: string }
                const aTime = aFig.created_at ? new Date(aFig.created_at).getTime() : 0
                const bTime = bFig.created_at ? new Date(bFig.created_at).getTime() : 0
                return bTime - aTime
              })
              setEditedFigures(sorted)
                // Collapse all videos when entering edit mode
                setOpenVideosInEditMode(new Set())
                setEditingFigureId(null)
                setEditMode(true)
              }}
            >
              Edit
            </button>
            <button
              className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium text-sm"
              onClick={async () => {
                if (!confirm("This will update all figures in the database to use clean YouTube URLs (removing playlist parameters). This fixes videos that won't embed. Continue?")) return
                
                let cleaned = 0
                for (const fig of figures) {
                  const cleanUrl = cleanYouTubeUrl(fig.youtube_url)
                  if (cleanUrl !== fig.youtube_url) {
                    const { error } = await supabase
                      .from("figures")
                      .update({ youtube_url: cleanUrl })
                      .eq("id", fig.id)
                    if (!error) cleaned++
                  }
                }
                alert(`Cleaned ${cleaned} figures with playlist parameters`)
                // Reload
                globalThis.location.reload()
              }}
              title="Clean YouTube URLs in database (removes playlist params that prevent embedding)"
            >
              Clean URLs
            </button>
          </div>
          <div className="flex gap-4">
            <button
              className="bg-blue-500 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors font-medium"
              onClick={() => { setOpenVideos(new Set(figures.map(f => f.id))) }}
            >
              View All
            </button>
            <button
              className="bg-gray-500 dark:bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors font-medium"
              onClick={() => { setOpenVideos(new Set()) }}
            >
              Collapse All
            </button>
          </div>
        </div>
      )}

      {editMode && (
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex gap-2">
            <button
              className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
              onClick={() => {
                setEditedFigures([{
                  id: crypto.randomUUID(),
                  name: "",
                  difficulty: 0,
                  note: "",
                  youtube_url: "",
                  start_time: 0,
                  end_time: 0,
                  dance_style: dance,
                  visibility: 'private'
                }, ...editedFigures])
                // Collapse all videos when adding new figure
                setOpenVideosInEditMode(new Set())
                setEditingFigureId(null)
              }}
            >
              Add
            </button>
            <button
              className="bg-gray-500 dark:bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors font-medium"
              onClick={() => {
                setEditMode(false)
                // Collapse all videos when canceling
                setOpenVideosInEditMode(new Set())
                setEditingFigureId(null)
              }}
            >
              Cancel
            </button>
            <button
              className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium"
              onClick={saveChanges}
            >
              Save
            </button>
          </div>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th className="text-left p-2 text-gray-900 dark:text-white">Name</th>
            <th className="text-left p-2 text-gray-900 dark:text-white">Difficulty</th>
            <th className="text-left p-2 text-gray-900 dark:text-white">Notes</th>
            <th className="text-left p-2 text-gray-900 dark:text-white">YouTube URL</th>
            <th className="text-left p-2 text-gray-900 dark:text-white">Start Time</th>
            <th className="text-left p-2 text-gray-900 dark:text-white">End Time</th>
            {editMode && <th className="text-left p-2 text-gray-900 dark:text-white">Visibility</th>}
            {editMode && <th className="text-left p-2 text-gray-900 dark:text-white">Action</th>}
          </tr>
        </thead>

        <tbody ref={tableBodyRef}>

          {editMode
            ? editedFigures.map((figure, index) => {

              let videoId: string | null = null

              if (figure.youtube_url) {
                const regExp =
                  /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
                const match = regExp.exec(figure.youtube_url)
                videoId = match?.[1].length === 11 ? match[1] : null
              }

              return (

                <React.Fragment key={figure.id}>
                  <tr className="border-b">
                    <td className="p-2">
                      <textarea
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full resize-none font-medium"
                        value={figure.name}
                        onFocus={() => {
                          setEditingFigureId(figure.id)
                          if (figure.youtube_url) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                        }}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].name = e.target.value
                          setEditedFigures(updated)
                          e.target.style.height = 'auto'
                          e.target.style.height = `${e.target.scrollHeight}px`
                        }}
                        style={{ minHeight: '42px' }}
                      />
                    </td>

                    <td className="p-2">
                      <select
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-20"
                        value={figure.difficulty}
                        onFocus={() => {
                          setEditingFigureId(figure.id)
                          if (figure.youtube_url) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                        }}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].difficulty = Number(e.target.value)
                          setEditedFigures(updated)
                        }}
                      >
                        <option value="0">0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </td>

                    <td className="p-2">
                      <textarea
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full resize-none"
                        value={figure.note}
                        onFocus={() => {
                          setEditingFigureId(figure.id)
                          if (figure.youtube_url) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                        }}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].note = e.target.value
                          setEditedFigures(updated)
                          e.target.style.height = 'auto'
                          e.target.style.height = `${e.target.scrollHeight}px`
                        }}
                        style={{ minHeight: '42px' }}
                      />
                    </td>

                    <td className="p-2">
                      <input
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full"
                        placeholder="YouTube URL"
                        value={figure.youtube_url}
                        onFocus={() => {
                          setEditingFigureId(figure.id)
                        }}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].youtube_url = e.target.value
                          setEditedFigures(updated)
                          // Expand video when YouTube URL is entered
                          if (e.target.value) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                        }}
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-24"
                        placeholder="hh:mm:ss"
                        value={formatSecondsToTime(figure.start_time)}
                        onFocus={(e) => {
                          setEditingFigureId(figure.id)
                          if (figure.youtube_url) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                          if (figure.start_time === 0) {
                            e.target.value = ""
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === "") {
                            e.target.value = formatSecondsToTime(0)
                          }
                        }}
                        onChange={(e) => {
                          const parsed = parseTimeToSeconds(e.target.value)
                          const updated = [...editedFigures]
                          updated[index].start_time = parsed
                          setEditedFigures(updated)
                        }}
                        style={figure.start_time === 0 ? { color: '#9ca3af' } : {}}
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-24"
                        placeholder="hh:mm:ss"
                        value={formatSecondsToTime(figure.end_time)}
                        onFocus={(e) => {
                          setEditingFigureId(figure.id)
                          if (figure.youtube_url) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                          if (figure.end_time === 0) {
                            e.target.value = ""
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === "") {
                            e.target.value = formatSecondsToTime(0)
                          }
                        }}
                        onChange={(e) => {
                          const parsed = parseTimeToSeconds(e.target.value)
                          const updated = [...editedFigures]
                          updated[index].end_time = parsed
                          setEditedFigures(updated)
                        }}
                        style={figure.end_time === 0 ? { color: '#9ca3af' } : {}}
                      />
                    </td>

                    <td className="p-2">
                      <select
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full text-sm"
                        value={figure.visibility || 'private'}
                        onFocus={() => {
                          setEditingFigureId(figure.id)
                          if (figure.youtube_url) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                        }}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].visibility = e.target.value as 'private' | 'public'
                          setEditedFigures(updated)
                        }}
                      >
                        <option value="private">🔒 Private</option>
                        <option value="public">🌍 Public</option>
                      </select>
                    </td>

                    <td className="p-2">
                      <button
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                        onClick={() => {
                          const updated = editedFigures.filter((_, i) => i !== index)
                          setEditedFigures(updated)
                        }}
                      >
                        Delete
                      </button>
                    </td>

                  </tr>

                  {videoId && openVideosInEditMode.has(figure.id) && (

                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">

                      <td colSpan={8} className="p-4">

                        <iframe
                          width="420"
                          height="240"
                          title={`${figure.name || "Figure"} - YouTube video`}
                          src={`https://www.youtube.com/embed/${videoId}?start=${figure.start_time || 0}&end=${figure.end_time || ""}`}
                          allowFullScreen
                        />

                      </td>

                    </tr>

                  )}

                </React.Fragment>

              )

            })
            : filteredFigures.map((figure) => (
              <FigureCard
                key={figure.id}
                name={figure.name}
                difficulty={figure.difficulty}
                note={figure.note}
                youtube_url={figure.youtube_url}
                start_time={figure.start_time}
                end_time={figure.end_time}
                isOpen={openVideos.has(figure.id)}
                toggleVideo={toggleVideo}
                figureId={figure.id}
                visibility={figure.visibility}
                created_by={figure.created_by}
                currentUserId={user?.id}
              />
            ))
          }
          
        </tbody>
      </table>
      </div>
    </main>
  )
}