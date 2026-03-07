type Props = {
  name: string
  difficulty: number
  notes: string
}

export default function FigureCard(
  { name, difficulty, notes }: Props
) {

  return (

    <div className="border rounded p-4 shadow">

      <h3 className="font-bold">
        {name}
      </h3>

      <p>Difficulty: {difficulty}</p>

      <p className="text-sm text-gray-600">
        {notes}
      </p>

    </div>

  )
}