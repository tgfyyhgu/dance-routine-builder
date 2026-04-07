/**
 * Display single figure in table row with metadata and optional video preview.
 * Used in: /[dance]/figures page
 */

import React from 'react';



type Props = {
  readonly figureId: string
  readonly name: string
  readonly difficulty: number
  readonly note?: string
  readonly youtube_url?: string
  readonly start_time?: number | null
  readonly end_time: number | null
  readonly isOpen: boolean
  readonly toggleVideo: (id: string) => void
  readonly visibility?: 'private' | 'public'
  readonly created_by?: string
  readonly currentUserId?: string
  readonly number?: number  // Display number (top = largest, bottom = 1)
}
export default function FigureCard({
  figureId,
  name,
  difficulty,
  note,
  youtube_url,
  start_time,
  end_time,
  isOpen,
  toggleVideo,
  visibility,
  created_by,
  currentUserId,
  number,
}: Props) {
  const videoVisible = isOpen

  let videoId: string | null = null

  if (youtube_url) {
    const getYouTubeId = (url: string): string | null => {
      const regExp =
        /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
      const match = regExp.exec(url)
      return match?.[1].length === 11 ? match[1] : null
    }
    videoId = getYouTubeId(youtube_url)
  }

  return (
    <tr
      className="border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      onClick={() => toggleVideo(figureId)}
    >
      {number !== undefined && (
        <td className="p-2 text-center font-semibold text-xs w-8 text-gray-600 dark:text-gray-400">
          {number}
        </td>
      )}
      <td className="p-2 font-semibold text-sm">
        <div className="flex items-center gap-2">
          <span>{name}</span>
          {visibility === 'public' && created_by !== currentUserId && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-1 rounded whitespace-nowrap">
              🌍 From another creator
            </span>
          )}
        </div>
      </td>

      <td className="p-2 text-xs">
        {difficulty === 0 ? (
          <span className="text-gray-400 dark:text-gray-500 text-xs">Not rated</span>
        ) : (
          <span className="text-yellow-600 dark:text-yellow-500">
            {"★".repeat(difficulty)}{"☆".repeat(5 - difficulty)}
          </span>
        )}
      </td>

      <td className="p-2 text-gray-600 dark:text-gray-400 text-xs max-w-xs overflow-auto">{note}</td>

      <td className="p-2 text-center text-xs">
        {visibility === 'private' ? '🔒' : '🌍'}
      </td>

      <td className="p-2 text-center text-xs">
        {videoId && <span className="text-blue-600 dark:text-blue-400 text-xs">{videoVisible ? "▶" : "▼"}</span>}
      </td>

      {videoVisible && videoId && (
        <td className="p-4">
          <iframe
            width="560"
            height="315"
            title={`${figureId} - YouTube video`}
            src={`https://www.youtube.com/embed/${videoId}?start=${start_time || 0}&end=${end_time || ""}`}
            allowFullScreen
          />
        </td>
      )}
    </tr>
  )
}