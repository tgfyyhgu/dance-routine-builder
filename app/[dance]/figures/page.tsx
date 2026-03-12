"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import FigureCard from "@/components/FigureCard"

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
        setFigures(data)
      }
    }
    loadFigures()
  }, [])

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


  // The saveChanges function validates the edited figures, identifies which figures have been deleted, updated, or added, and then performs the corresponding database operations using Supabase. After saving, it updates the local state and exits edit mode.
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
    const editedIds = editedFigures.map(f => f.id)

    const deletedIds = originalIds.filter(id => !editedIds.includes(id))

    // DELETE
    for (const id of deletedIds) {
      await supabase
        .from("figures")
        .delete()
        .eq("id", id)
    }

    for (const fig of editedFigures) {

      if (originalIds.includes(fig.id)) {

        // UPDATE
        await supabase
          .from("figures")
          .update({
            name: fig.name,
            difficulty: fig.difficulty,
            note: fig.note,
            youtube_url: fig.youtube_url,
            start_time: fig.start_time,
            end_time: fig.end_time
          })
          .eq("id", fig.id)

      } else {

        // INSERT
        await supabase
          .from("figures")
          .insert({
            id: fig.id,
            name: fig.name,
            difficulty: fig.difficulty,
            note: fig.note,
            youtube_url: fig.youtube_url,
            start_time: fig.start_time,
            end_time: fig.end_time,
            dance_style: dance
          })

      }

    }

    setFigures(editedFigures)
    setEditMode(false)

  }
  

  function toggleVideo(id: string) {
    const updated = new Set(openVideos)
    if (updated.has(id)) {updated.delete(id)} else {updated.add(id)}
    setOpenVideos(updated)
  }

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold mb-6">
        {dance.toUpperCase()} Figures
      </h1>
      <input
        type="text"
        placeholder="Search figures..."
        className="border p-2 mb-6 w-full"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <select
        className="border p-2 mb-6 ml-4"
        value={difficultyFilter}
        onChange={(e) => setDifficultyFilter(e.target.value)}
      >
        <option value="">All difficulties</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>

      {!editMode && (
      <div className="flex gap-4 mb-4">
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={()=>{setOpenVideos(new Set(figures.map(f => f.id)))}}
          >
            View All
          </button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded"
            onClick={() => {setOpenVideos(new Set())} }
          >
            Collapse All
          </button>
          <button
            className="bg-yellow-500 text-white px-4 py-2 rounded"
            onClick={() => {
              setEditedFigures(figures)
              setEditMode(true)
            } }
          >
            Edit
          </button>
          </div>
      )}

      {editMode && (
      <div className="flex gap-4 mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => {setEditedFigures([...editedFigures,{
                id: crypto.randomUUID(),
                name: "",
                difficulty: 1,
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
          className="bg-gray-500 text-white px-4 py-2 rounded"
          onClick={() => setEditMode(false)}
        >
          Cancel
        </button>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={saveChanges}
        >
          Save
        </button>
      </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Difficulty 1-5</th>
            <th className="text-left p-2">Notes</th>
            <th className="text-left p-2">Videos</th>
          </tr>
        </thead>

        <tbody>

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

                <>
                <tr key={figure.id} className="border-b">

                <td className="p-2">
                <input
                className="border p-1 w-full"
                value={figure.name}
                onChange={(e)=>{
                const updated=[...editedFigures]
                updated[index].name=e.target.value
                setEditedFigures(updated)
                }}
                />
                </td>

                <td className="p-2">
                <input
                type="number"
                className="border p-1 w-16"
                value={figure.difficulty}
                onChange={(e)=>{
                const updated=[...editedFigures]
                updated[index].difficulty=Number(e.target.value)
                setEditedFigures(updated)
                }}
                />
                </td>

                <td className="p-2">
                <input
                className="border p-1 w-full"
                value={figure.note}
                onChange={(e)=>{
                const updated=[...editedFigures]
                updated[index].note=e.target.value
                setEditedFigures(updated)
                }}
                />
                </td>

                <td className="p-2">
                <input
                className="border p-1 w-full"
                placeholder="YouTube URL"
                value={figure.youtube_url}
                onChange={(e)=>{
                const updated=[...editedFigures]
                updated[index].youtube_url=e.target.value
                setEditedFigures(updated)
                }}
                />
                </td>

                <td className="p-2">
                <input
                type="number"
                className="border p-1 w-20"
                placeholder="start"
                value={figure.start_time}
                onChange={(e)=>{
                const updated=[...editedFigures]
                updated[index].start_time=Number(e.target.value)
                setEditedFigures(updated)
                }}
                />
                </td>

                <td className="p-2">
                <input
                type="number"
                className="border p-1 w-20"
                placeholder="end"
                value={figure.end_time}
                onChange={(e)=>{
                const updated=[...editedFigures]
                updated[index].end_time=Number(e.target.value)
                setEditedFigures(updated)
                }}
                />
                </td>

                <td>
                <button
                className="text-red-600"
                onClick={()=>{
                const updated=editedFigures.filter((_,i)=>i!==index)
                setEditedFigures(updated)
                }}
                >
                Delete
                </button>
                </td>

                </tr>

                {videoId && (

                <tr className="bg-gray-50">

                <td colSpan={7} className="p-4">

                <iframe
                width="420"
                height="240"
                src={`https://www.youtube.com/embed/${videoId}?start=${figure.start_time || 0}&end=${figure.end_time || ""}`}
                allowFullScreen
                />

                </td>

                </tr>

                )}

                </>

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
    </main>
  )
}