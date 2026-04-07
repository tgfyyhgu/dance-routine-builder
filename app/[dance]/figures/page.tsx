"use client"

import React, { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import FigureCard from "@/components/FigureCard"
import Link from "next/link"
import { parseTimeToSeconds, formatSecondsToTime } from "@/lib/timeUtils"
import { useAuth } from "@/lib/AuthContext"
import { YTPlayer } from "@/types/routine"

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
  created_at?: string
}

// Helper function to clean YouTube URLs by removing playlist parameters
function cleanYouTubeUrl(url: string): string {
  if (!url) return url
  
  // Try to extract video ID from different YouTube URL formats
  // Handles: youtu.be/ID, watch?v=ID, watch?app=X&v=ID, etc.
  let videoId: string | undefined
  
  // Try youtu.be format
  const shortMatch = /youtu\.be\/([^#&?]+)/.exec(url)
  if (shortMatch) {
    videoId = shortMatch[1]
  }
  
  // Try watch?v= format with v parameter (handles v= anywhere in query string)
  if (!videoId) {
    const watchMatch = /[?&]v=([^&#]+)/.exec(url)
    if (watchMatch) {
      videoId = watchMatch[1]
    }
  }
  
  // If we found a video ID, return clean URL; otherwise return original
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`
  }
  return url
}

// Video player component for edit mode that properly handles end_time
function EditModeVideoPlayer({ videoId, startTime, endTime, playerId }: 
  { videoId: string; startTime: number; endTime: number; playerId: string }) {
  const playerRef = useRef<HTMLDivElement>(null)
  const playerInstanceRef = useRef<YTPlayer | null>(null)
  const endTimeTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!videoId || !globalThis.window?.YT || !playerRef.current) return

    // Clean up old player
    if (playerInstanceRef.current?.destroy) {
      playerInstanceRef.current.destroy()
    }
    if (endTimeTimerRef.current) {
      clearTimeout(endTimeTimerRef.current)
    }

    try {
      playerInstanceRef.current = new globalThis.window.YT.Player(playerId, {
        videoId: videoId,
        width: '420',
        height: '240',
        playerVars: {
          controls: 1,
          autoplay: 0,
        },
        events: {
          onReady: () => {
            playerInstanceRef.current?.seekTo(startTime)
          },
          onStateChange: (event: { data: number }) => {
            // 1 = playing
            if (event.data === 1) {
              // Video is playing - set up end time check
              setupEndTimeTimer()
            }
          },
        },
      })
    } catch (e) {
      console.error('EditModeVideoPlayer initialization error:', e)
    }

    function setupEndTimeTimer() {
      if (endTimeTimerRef.current) clearTimeout(endTimeTimerRef.current)
      if (!endTime || endTime <= startTime) return

      const checkInterval = setInterval(() => {
        const currentTime = playerInstanceRef.current?.getCurrentTime() || 0
        if (currentTime >= endTime) {
          playerInstanceRef.current?.pauseVideo()
          if (endTimeTimerRef.current) clearTimeout(endTimeTimerRef.current)
          clearInterval(checkInterval)
        }
      }, 100)

      endTimeTimerRef.current = checkInterval as any
    }

    return () => {
      if (endTimeTimerRef.current) clearTimeout(endTimeTimerRef.current)
      if (playerInstanceRef.current?.destroy) {
        playerInstanceRef.current.destroy()
      }
    }
  }, [videoId, startTime, endTime, playerId])

  return <div id={playerId} ref={playerRef} style={{ width: '100%', height: '100%' }} />
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
        // Sort by created_at descending (newest first)
        const sortedData = cleanedData.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          return bTime - aTime
        })
        setFigures(sortedData)
      }
    }
    loadFigures()
  }, [dance])

  const filteredFigures = figures
    .filter((figure) => {
      const matchesSearch =
        figure.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        figure.note.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDifficulty =
        difficultyFilter === "" ||
        figure.difficulty === Number(difficultyFilter)
      return matchesSearch && matchesDifficulty
    })
    .sort((a, b) => {
      // Maintain created_at order (newest first)
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })

  const [editMode, setEditMode] = useState(false)
  const [editedFigures, setEditedFigures] = useState<Figure[]>([])
  const [openVideosInEditMode, setOpenVideosInEditMode] = useState<Set<string>>(new Set())
  const [editingFigureId, setEditingFigureId] = useState<string | null>(null)
  const [rawTimeInputs, setRawTimeInputs] = useState<{ [figureId: string]: { start: string; end: string } }>({})
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
  const debounceTimersRef = useRef<{ [figureId: string]: NodeJS.Timeout }>({})


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

    // Parse time inputs
    for (const fig of completeFigures) {
      const rawInput = rawTimeInputs[fig.id] || { start: '', end: '' }
      
      // Parse start time
      if (rawInput.start.trim()) {
        const parsed = parseTimeInputToSeconds(rawInput.start)
        if (parsed === null) return // Error already shown, abort save
        fig.start_time = parsed
      }
      
      // Parse end time
      if (rawInput.end.trim()) {
        const parsed = parseTimeInputToSeconds(rawInput.end)
        if (parsed === null) return // Error already shown, abort save
        fig.end_time = parsed
      }
      
      // Validate that end time is greater than start time
      if (fig.end_time && fig.start_time && fig.end_time <= fig.start_time) {
        alert(`End time must be greater than start time for ${fig.name}`)
        return
      }
    }

    const originalIds = figures.map(f => f.id)
    const allDeleteIds = new Set([...emptyFigures, ...originalIds.filter(id => !completeFigures.map(f => f.id).includes(id))])
    const deletedIds = Array.from(allDeleteIds)

    // Validate: Check for duplicate IDs in completeFigures to prevent primary key conflicts
    const figureIds = new Set<string>()
    for (const fig of completeFigures) {
      if (figureIds.has(fig.id)) {
        console.error("Duplicate figure ID detected:", fig.id)
        alert(`Internal error: Duplicate figure ID detected (${fig.id}). This should not happen. Please refresh and try again.`)
        return
      }
      figureIds.add(fig.id)
    }

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

      // Separate figures into updates and inserts, clean URLs for all
      const figuresToUpdate: Figure[] = []
      const figuresToInsert: Array<{
        id: string
        name: string
        difficulty: number
        note: string
        youtube_url: string
        start_time: number
        end_time: number
        dance_style: string
        created_by: string | undefined
        visibility: string
      }> = []

      for (const fig of completeFigures) {
        const cleanUrl = cleanYouTubeUrl(fig.youtube_url)
        
        if (originalIds.includes(fig.id)) {
          // Mark for update
          const figWithCleanUrl = { ...fig, youtube_url: cleanUrl }
          figuresToUpdate.push(figWithCleanUrl)
        } else {
          // Prepare for batch insert
          figuresToInsert.push({
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
        }
      }

      // BATCH INSERT all new figures at once (more efficient and avoids race conditions)
      if (figuresToInsert.length > 0) {
        const { error } = await supabase
          .from("figures")
          .insert(figuresToInsert)
        
        if (error) {
          console.error("Batch insert error:", error)
          console.error("Figures being inserted:", figuresToInsert)
          alert(`Error adding figures: ${error.message}`)
          return
        }
      }

      // UPDATE each modified figure
      for (const fig of figuresToUpdate) {
        const { error } = await supabase
          .from("figures")
          .update({
            name: fig.name,
            difficulty: fig.difficulty,
            note: fig.note,
            youtube_url: fig.youtube_url,
            start_time: fig.start_time,
            end_time: fig.end_time,
            visibility: fig.visibility || 'private'
          })
          .eq("id", fig.id)
        
        if (error) {
          console.error("Update error:", error)
          alert(`Error updating figure "${fig.name}": ${error.message}`)
          return
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
      setRawTimeInputs({})
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

  // Apply debounced time parsing to a figure's start/end time inputs
  // This updates the figure's actual times after user stops editing
  function debounceTimeUpdate(figureId: string) {
    // Clear existing timer for this figure
    if (debounceTimersRef.current[figureId]) {
      clearTimeout(debounceTimersRef.current[figureId])
    }

    // Set new timer to parse and apply the times after 1s of no input
    debounceTimersRef.current[figureId] = setTimeout(() => {
      const rawInput = rawTimeInputs[figureId]
      if (!rawInput) return

      // Parse times (suppress error alerts during preview)
      let newStartTime = undefined
      let newEndTime = undefined

      if (rawInput.start.trim()) {
        const parsed = parseTimeInputToSeconds(rawInput.start, true)
        if (parsed !== null) newStartTime = parsed
      }

      if (rawInput.end.trim()) {
        const parsed = parseTimeInputToSeconds(rawInput.end, true)
        if (parsed !== null) newEndTime = parsed
      }

      // Update the edited figure with parsed times (for video preview)
      setEditedFigures(prev => prev.map(fig => {
        if (fig.id === figureId) {
          return {
            ...fig,
            start_time: newStartTime !== undefined ? newStartTime : fig.start_time,
            end_time: newEndTime !== undefined ? newEndTime : fig.end_time
          }
        }
        return fig
      }))

      // Clean up timer reference
      delete debounceTimersRef.current[figureId]
    }, 1000)
  }

  // Parse time string to seconds using strict rules
  // suppressErrors: if true, don't show alert messages (used during preview)
  function parseTimeInputToSeconds(input: string, suppressErrors: boolean = false): number | null {
    // Strip all non-numeric characters
    let stripped = input.replace(/[^0-9]/g, '')
    
    // Check if empty after stripping
    if (!stripped) return 0
    
    // Remove leading zeros before padding (so 000045 becomes 45, then pads to 000045)
    stripped = stripped.replace(/^0+/, '') || '0'
    
    // Check if larger than 6 digits
    if (stripped.length > 6) {
      if (!suppressErrors) {
        alert(`Time input is too long (${stripped.length} digits). Maximum 6 digits allowed (HHMMSS format).`)
      }
      return null
    }
    
    // Left-fill with zeros to 6 digits
    const padded = stripped.padStart(6, '0')
    
    // Slice into pairs: HH, MM, SS
    const hh = parseInt(padded.slice(0, 2), 10)
    const mm = parseInt(padded.slice(2, 4), 10)
    const ss = parseInt(padded.slice(4, 6), 10)
    
    // Validate MM and SS are in range [0, 60)
    if (mm >= 60) {
      if (!suppressErrors) {
        alert(`Minutes value (${mm}) is invalid. Must be between 0 and 59.`)
      }
      return null
    }
    if (ss >= 60) {
      if (!suppressErrors) {
        alert(`Seconds value (${ss}) is invalid. Must be between 0 and 59.`)
      }
      return null
    }
    
    // Calculate total seconds
    return hh * 3600 + mm * 60 + ss
  }

  return (
    <main className="bg-gray-50 dark:bg-gray-950">

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
            className="px-3 py-1 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
          >
            Clear Filters
          </button>
        )}
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-400 mb-6">
        Showing {filteredFigures.length} of {figures.length} figures
      </p>

      {!editMode && (
        <div className="flex justify-between mb-4">
          <div className="flex gap-2">
            <button
              className="bg-yellow-500 dark:bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-600 dark:hover:bg-yellow-700 transition-colors font-medium text-sm"
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
                setRawTimeInputs({})
                setEditMode(true)
              }}
            >
              Edit
            </button>
            <button
              className="bg-green-600 dark:bg-green-700 text-white px-3 py-1 rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium text-xs"
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
              className="bg-blue-500 dark:bg-blue-700 text-white px-3 py-1 rounded hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors font-medium text-sm"
              onClick={() => { setOpenVideos(new Set(figures.map(f => f.id))) }}
            >
              View All
            </button>
            <button
              className="bg-gray-500 dark:bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
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
              className="bg-blue-600 dark:bg-blue-700 text-white px-3 py-1 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium text-sm"
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
              className="bg-gray-500 dark:bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
              onClick={() => {
                setEditMode(false)
                // Collapse all videos when canceling
                setOpenVideosInEditMode(new Set())
                setEditingFigureId(null)
                setRawTimeInputs({})
              }}
            >
              Cancel
            </button>
            <button
              className="bg-green-600 dark:bg-green-700 text-white px-3 py-1 rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium text-sm"
              onClick={saveChanges}
            >
              Save
            </button>
          </div>
        </div>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold">Name</th>
            <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold">Difficulty</th>
            <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold">Notes</th>
            {!editMode && <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold">Visibility</th>}
            {!editMode && <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold">Video</th>}
            {editMode && <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold">YouTube URL</th>}
            {editMode && <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold whitespace-nowrap">Start</th>}
            {editMode && <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold whitespace-nowrap">End</th>}
            {editMode && <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold w-12 text-center">Vis</th>}
            {editMode && <th className="text-left p-1 text-gray-900 dark:text-white text-xs font-semibold w-8 text-center">Del</th>}
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
                  <tr className="border-b text-sm">
                    <td className="p-1">
                      <textarea
                        rows={1}
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full resize-none font-medium text-xs overflow-hidden"
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
                        style={{ lineHeight: '1.2' }}
                      />
                    </td>

                    <td className="p-1">
                      <select
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-0.5 w-12 text-xs"
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

                    <td className="p-1">
                      <textarea
                        rows={1}
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full resize-none text-xs overflow-hidden"
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
                        style={{ lineHeight: '1.2' }}
                      />
                    </td>

                    <td className="p-1">
                      <input
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full text-xs"
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

                    <td className="p-1">
                      <input
                        type="text"
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-0.5 w-16 text-xs"
                        placeholder="hhmmss"
                        value={rawTimeInputs[figure.id]?.start ?? (figure.start_time === 0 ? "" : formatSecondsToTime(figure.start_time))}
                        onFocus={(e) => {
                          setEditingFigureId(figure.id)
                          if (figure.youtube_url) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                          // Clear field only if user hasn't typed anything yet
                          if (!rawTimeInputs[figure.id]?.start) {
                            e.target.value = ""
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === "") {
                            e.target.value = figure.start_time === 0 ? "" : formatSecondsToTime(figure.start_time)
                          }
                        }}
                        onChange={(e) => {
                          setRawTimeInputs({
                            ...rawTimeInputs,
                            [figure.id]: {
                              start: e.target.value,
                              end: rawTimeInputs[figure.id]?.end ?? ""
                            }
                          })
                          // Debounce time parsing for video preview
                          debounceTimeUpdate(figure.id)
                        }}
                        style={(rawTimeInputs[figure.id]?.start === "" || !rawTimeInputs[figure.id]?.start) && figure.start_time === 0 ? { color: '#9ca3af' } : {}}
                      />
                    </td>

                    <td className="p-1">
                      <input
                        type="text"
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-0.5 w-16 text-xs"
                        placeholder="hhmmss"
                        value={rawTimeInputs[figure.id]?.end ?? (figure.end_time === 0 ? "" : formatSecondsToTime(figure.end_time))}
                        onFocus={(e) => {
                          setEditingFigureId(figure.id)
                          if (figure.youtube_url) {
                            setOpenVideosInEditMode(new Set([figure.id]))
                          } else {
                            setOpenVideosInEditMode(new Set())
                          }
                          // Clear field only if user hasn't typed anything yet
                          if (!rawTimeInputs[figure.id]?.end) {
                            e.target.value = ""
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === "") {
                            e.target.value = figure.end_time === 0 ? "" : formatSecondsToTime(figure.end_time)
                          }
                        }}
                        onChange={(e) => {
                          setRawTimeInputs({
                            ...rawTimeInputs,
                            [figure.id]: {
                              start: rawTimeInputs[figure.id]?.start ?? "",
                              end: e.target.value
                            }
                          })
                          // Debounce time parsing for video preview
                          debounceTimeUpdate(figure.id)
                        }}
                        style={(rawTimeInputs[figure.id]?.end === "" || !rawTimeInputs[figure.id]?.end) && figure.end_time === 0 ? { color: '#9ca3af' } : {}}
                      />
                    </td>

                    <td className="p-1 text-center">
                      <button
                        className="text-lg hover:opacity-70 transition-opacity"
                        onClick={() => {
                          const updated = [...editedFigures]
                          updated[index].visibility = figure.visibility === 'private' ? 'public' : 'private'
                          setEditedFigures(updated)
                        }}
                        title={figure.visibility === 'private' ? 'Click to make public' : 'Click to make private'}
                      >
                        {figure.visibility === 'private' ? '🔒' : '🌍'}
                      </button>
                    </td>

                    <td className="p-1 text-center">
                      <button
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium text-sm hover:opacity-70 transition-opacity"
                        onClick={() => {
                          const updated = editedFigures.filter((_, i) => i !== index)
                          setEditedFigures(updated)
                        }}
                        title="Delete figure"
                      >
                        🗑️
                      </button>
                    </td>

                  </tr>

                  {videoId && openVideosInEditMode.has(figure.id) && (

                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">

                      <td colSpan={8} className="p-1">

                        <div key={`${figure.id}-player`} style={{ width: '420px', height: '240px', position: 'relative' }} id={`player-${figure.id}`} />

                        <EditModeVideoPlayer 
                          videoId={videoId}
                          startTime={figure.start_time || 0}
                          endTime={figure.end_time || 0}
                          playerId={`player-${figure.id}`}
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