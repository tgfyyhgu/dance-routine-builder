"use client"

import { useEffect, useState } from "react"
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
}

export default function FiguresPage() {

  const [figures, setFigures] = useState<Figure[]>([])

  useEffect(() => {

    async function loadFigures() {

      const { data } = await supabase
        .from("figures")
        .select("*")

      if (data) {
        setFigures(data)
      }

    }

    loadFigures()

  }, [])

  return (

    <main className="p-10">

      <h1 className="text-2xl font-bold mb-6">
        Dance Figures
      </h1>

      {figures.map((figure: Figure) => (

        <FigureCard
        key={figure.id}
        name={figure.name}
        difficulty={figure.difficulty}
        note={figure.note}
        youtube_url={figure.youtube_url}
        start_time={figure.start_time}
        end_time={figure.end_time}
        />

      ))}

    </main>

  )
}