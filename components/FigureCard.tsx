type Props = {
  readonly name: string
  readonly difficulty: number
  readonly note: string
  readonly youtube_url: string;
  readonly start_time: number | null;
  readonly end_time: number | null;
}

export default function FigureCard(
  { name, difficulty, note, youtube_url, start_time, end_time }: Props) {

  return (

    <div className="border rounded p-4 shadow">
      <h3 className="font-bold">{name}</h3>
      <p>Difficulty: {difficulty}</p>
      <p className="text-sm text-gray-600">{note}</p>
      {youtube_url && (
        <a
          href={youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          Watch on YouTube
        </a>
      )}
      {start_time !== null && end_time !== null && (
        <p className="text-lg font-bold">
          {start_time} - {end_time}
        </p>
      )}
    </div>

  )
}