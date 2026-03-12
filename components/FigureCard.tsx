/*
  The FigureCard component is designed to display information about a specific figure, including its name, difficulty, notes, and an optional YouTube video preview. 
  It accepts several props to manage the figure's data and the state of the video preview. 
  The component extracts the YouTube video ID from the provided URL and conditionally renders an embedded video player when the preview is toggled on.
*/

import { useState, useEffect } from "react"
import React from 'react';




  function formatTime(seconds: number | null | undefined) {
    /* Formats seconds into a time string (HH:MM:SS or MM:SS)
    - If hours are present, it returns HH:MM:SS
    - If no hours, it returns MM:SS
    - Handles null or undefined input by returning an empty string
    - const pad function ensures that minutes and seconds are always two digits, padding with a leading zero if necessary.
    --------------------------------------------------------------
    Next: Consider adding support for negative time values or invalid inputs, and decide on a consistent behavior (e.g., return "00:00" or throw an error).
  */
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
  /* Props for the FigureCard component 
  - figureId: A unique identifier for the figure, used to manage video preview state.
  - name: The name of the figure to be displayed.
  - difficulty: An optional number representing the difficulty level of the figure.
  - note: An optional string for additional notes about the figure.
  - youtube_url: An optional string containing the URL of a YouTube video related to the figure.
  - start_time: An optional number indicating the start time (in seconds) for the video preview.
  - end_time: An optional number indicating the end time (in seconds) for the video preview.
  - isOpen: A boolean indicating whether the video preview is currently open or not.
  - toggleVideo: A function that takes a figureId and toggles the video preview state for that specific figure.
  */
  readonly figureId: string
  readonly name: string
  readonly difficulty?: number
  readonly note?: string
  readonly youtube_url?: string;
  readonly start_time?: number | null;
  readonly end_time: number | null;
  readonly isOpen: boolean
  readonly toggleVideo: (id:string)=>void
  
}
//rendering a single figure's information in a table row, along with a button to toggle the video preview. It also handles extracting the YouTube video ID from the provided URL and embedding the video when requested.
export default function FigureCard(
  { figureId, name, difficulty, note, youtube_url, start_time, end_time, isOpen, toggleVideo }: 
  Props){
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
    // The component returns a fragment containing a table row with the figure's information and a conditional row for the video preview.
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
              onClick={() => toggleVideo(figureId)}
            >
              {videoVisible ? "Collapse" : "View"}
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
              title={`${figureId} - YouTube video`}
              src={`https://www.youtube.com/embed/${videoId}?start=${start_time || 0}&end=${end_time || ""}`}
              allowFullScreen
            />

          </td>

        </tr>

      )}

    </>

  )
}