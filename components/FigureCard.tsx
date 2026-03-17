/**
 * PHASE 6: FIGURE CARD COMPONENT
 * 
 * FILE PURPOSE: FigureCard is a TABLE ROW component for the Figures management page.
 * High-level role: Display one figure with metadata and optional video preview.
 * Used in: /[dance]/figures page to view/edit all figures for a dance style.
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
  - difficulty: A number (0-5) representing the difficulty level of the figure.
  - note: An optional string for additional notes about the figure.
  - youtube_url: An optional string containing the URL of a YouTube video related to the figure.
  - start_time: An optional number indicating the start time (in seconds) for the video preview.
  - end_time: An optional number indicating the end time (in seconds) for the video preview.
  - isOpen: A boolean indicating whether the video preview is currently open or not.
  - toggleVideo: A function that takes a figureId and toggles the video preview state for that specific figure.
  */
  readonly figureId: string
  readonly name: string
  readonly difficulty: number
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
    // The component returns a table row with the figure's information and video player side-by-side when opened
    
    <tr 
      className="border-b cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => toggleVideo(figureId)}
    >
      
      <td className="p-2 font-semibold text-sm">
        {name}
      </td>

      <td className="p-2 text-xs">
        {difficulty === 0 ? (
          <span className="text-gray-400 text-xs">Not rated</span>
        ) : (
          <span className="text-yellow-600">
            {'★'.repeat(difficulty)}{'☆'.repeat(5 - difficulty)}
          </span>
        )}
      </td>

      <td className="p-2 text-gray-600 text-xs max-w-xs overflow-auto">
        {note}
      </td>

      <td className="p-2 text-center text-xs">
        {videoId && (
          <span className="text-blue-600 text-xs">
            {videoVisible ? "▶" : "▼"}
          </span>
        )}
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