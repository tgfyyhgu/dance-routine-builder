import FigureCard from "@/components/FigureCard"

export default function FiguresPage() {

  const figures = [
    {
      name: "Spin Turn",
      difficulty: 3,
      notes: "Standard ballroom spin turn"
    },
    {
      name: "Rumba Walk",
      difficulty: 2,
      notes: "Basic rumba forward walk"
    }
  ]

  return (

    <main className="p-10">

      <h1 className="text-2xl font-bold mb-6">
        Dance Figures
      </h1>


      {figures.map((figure, index) => (

        <FigureCard
          key={index}
          name={figure.name}
          difficulty={figure.difficulty}
          notes={figure.notes}
        />

      ))}

    </main>

  )
}