
import { useState, useEffect } from "react"

  function formatTime(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return ""

  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const pad = (n: number) => n.toString().padStart(2, "0")

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  }

  return `${pad(mins)}:${pad(secs)}`
  }

type Props = {
  readonly figureId: string
  readonly name: string
  readonly difficulty?: number
  readonly note?: string
  readonly youtube_url?: string;
  readonly start_time?: number | null;
  readonly end_time: number | null;
  //readonly previewMode?: "none" | "all"
  readonly isOpen: boolean
  readonly toggleVideo: (id:string)=>void
  
}
// This component is responsible for rendering a single figure's information in a table row, along with a button to toggle the video preview. It also handles extracting the YouTube video ID from the provided URL and embedding the video when requested.
export default function FigureCard(
  { figureId, name, difficulty, note, youtube_url, start_time, end_time, isOpen, toggleVideo }: 
  Props) {//
//
  //const [showVideo, setShowVideo] = useState(false)
  //const videoVisible = previewMode==="all" || showVideo
  const videoVisible = isOpen

  let videoId: string | null = null;

  if (youtube_url) {
    const getYouTubeId = (url: string): string | null => {
      const regExp =
        /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = regExp.exec(url);
      return match && match[1].length === 11 ? match[1] : null;
    };

    videoId = getYouTubeId(youtube_url);
  }

  return (
    <>
      <tr className="border-b">
        
        <td className="p-2 font-semibold">
          {name}
        </td>

        <td className="p-2">
          {difficulty}
        </td>

        <td className="p-2 text-gray-600">
          {note}
        </td>

        <td className="p-2">

          {videoId && (
            <button
              className="text-blue-600 underline"
              //onClick={() => setShowVideo(!showVideo)}
              onClick={() => toggleVideo(figureId)}
            >
              {videoVisible ? "Hide" : "Preview"}
            </button>
          )}

        </td>

      </tr>
      {videoVisible && videoId && (

        <tr className="bg-gray-50">
          <td colSpan={4} className="p-4">

            <iframe
              width="420"
              height="240"
              src={`https://www.youtube.com/embed/${videoId}?start=${start_time || 0}&end=${end_time || ""}`}
              allowFullScreen
            />

          </td>

        </tr>

      )}

    </>

  )
}