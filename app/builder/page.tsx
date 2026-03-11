"use client"

import { useState } from "react"

export default function BuilderPage() {

  const [routine, setRoutine] = useState<string[]>([])

  function addFigure(name: string) {
    setRoutine([...routine, name])
  }

  return (

    <main className="p-10">

      <h1 className="text-2xl font-bold mb-6">
        Routine Builder
      </h1>

      <button
        onClick={() => addFigure("Spin Turn")}
        className="border p-2 mr-4"
      >
        Add Spin Turn
      </button>

      <button
        onClick={() => addFigure("Rumba Walk")}
        className="border p-2"
      >
        Add Rumba Walk
      </button>

      <h2 className="mt-8 font-bold">
        Routine
      </h2>

      <ol className="list-decimal ml-6">

        {routine.map((figure, index) => (
          <li key={index}>{figure}</li>
        ))}

      </ol>

    </main>

  )
}