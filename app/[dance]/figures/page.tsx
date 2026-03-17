"use client"

import React, { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import FigureCard from "@/components/FigureCard"
import Link from "next/link"
import { parseTimeToSeconds, formatSecondsToTime } from "@/lib/timeUtils"

interface Figure {
  id: string
  name: string
  difficulty: number
  note: string
  youtube_url: string
  start_time: number
  end_time: number
  dance_style: string
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
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
  const previousLengthRef = useRef(0)

  // Auto-scroll to bottom when new figure is added
  useEffect(() => {
    if (editMode && editedFigures.length > previousLengthRef.current) {
      setTimeout(() => {
        tableBodyRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" })
      }, 0)
    }
    previousLengthRef.current = editedFigures.length
  }, [editedFigures.length, editMode])


  // Validate edited figures and sync with Supabase (delete, update, insert)
  async function saveChanges() {

    for (const fig of editedFigures) {

      if (!fig.name) {
        alert("Name cannot be empty")
        return
      }

      if (fig.end_time && fig.start_time && fig.end_time <= fig.start_time) {
        alert(`End time must be greater than start time for ${fig.name}`)
        return
      }

    }

    const originalIds = figures.map(f => f.id)
    const editedIds = new Set(editedFigures.map(f => f.id))

    const deletedIds = originalIds.filter(id => !editedIds.has(id))

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
      for (const fig of editedFigures) {
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
              end_time: fig.end_time
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
              dance_style: dance
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

  return (
    <main className="bg-gray-50 dark:bg-gray-950">
      {/* Navigation Header */}
      <div className="border-b bg-white dark:bg-gray-900 dark:border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{dance.toUpperCase()} - Manage Figures</h1>
        <Link 
          href={`/${dance}/choreo`}
          className="bg-blue-500 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors font-medium"
        >
          🎬 Choreography Builder
        </Link>
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
                setEditedFigures(figures)
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
                window.location.reload()
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
        <div className="flex gap-4 mb-4">
          <button
            className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
            onClick={() => {
              setEditedFigures([...editedFigures, {
                id: crypto.randomUUID(),
                name: "",
                difficulty: 0,
                note: "",
                youtube_url: "",
                start_time: 0,
                end_time: 0,
                dance_style: dance
              }
              ])
            }}
          >
            Add
          </button>
          <button
            className="bg-gray-500 dark:bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors font-medium"
            onClick={() => setEditMode(false)}
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
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th className="text-left p-2 text-gray-900 dark:text-white">Name</th>
            <th className="text-left p-2 text-gray-900 dark:text-white">Difficulty 1-5</th>
            <th className="text-left p-2 text-gray-900 dark:text-white">Notes</th>
            <th className="text-left p-2 text-gray-900 dark:text-white">Videos</th>
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
                      <input
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full"
                        value={figure.name}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].name = e.target.value
                          setEditedFigures(updated)
                        }}
                      />
                    </td>

                    <td className="p-2">
                      <select
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-20"
                        value={figure.difficulty}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].difficulty = Number(e.target.value)
                          setEditedFigures(updated)
                        }}
                      >
                        <option value="0">0 (None)</option>
                        <option value="1">1 ⭐</option>
                        <option value="2">2 ⭐⭐</option>
                        <option value="3">3 ⭐⭐⭐</option>
                        <option value="4">4 ⭐⭐⭐⭐</option>
                        <option value="5">5 ⭐⭐⭐⭐⭐</option>
                      </select>
                    </td>

                    <td className="p-2">
                      <input
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full"
                        value={figure.note}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].note = e.target.value
                          setEditedFigures(updated)
                        }}
                      />
                    </td>

                    <td className="p-2">
                      <input
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-full"
                        placeholder="YouTube URL"
                        value={figure.youtube_url}
                        onChange={(e) => {
                          const updated = [...editedFigures]
                          updated[index].youtube_url = e.target.value
                          setEditedFigures(updated)
                        }}
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-24"
                        placeholder="mm:ss"
                        defaultValue={formatSecondsToTime(figure.start_time)}
                        onChange={(e) => {
                          const parsed = parseTimeToSeconds(e.target.value)
                          const updated = [...editedFigures]
                          updated[index].start_time = parsed
                          setEditedFigures(updated)
                        }}
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white p-1 w-24"
                        placeholder="mm:ss"
                        defaultValue={formatSecondsToTime(figure.end_time)}
                        onChange={(e) => {
                          const parsed = parseTimeToSeconds(e.target.value)
                          const updated = [...editedFigures]
                          updated[index].end_time = parsed
                          setEditedFigures(updated)
                        }}
                      />
                    </td>

                    <td>
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

                  {videoId && (

                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">

                      <td colSpan={7} className="p-4">

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
              />
            ))
          }
          
        </tbody>
      </table>
      </div>
    </main>
  )
}