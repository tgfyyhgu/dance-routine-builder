/**
 * Right panel: YouTube video player with playback controls and step navigation.
 * Auto-advances to next step when video ends (if autoplay enabled).
 */
"use client"

import { useState, useEffect, useRef, useId } from "react"
import { RoutineStep } from "@/types/routine"

interface Props {
  readonly steps: RoutineStep[]
  readonly currentStep: number
  readonly onStepChange: (index: number) => void
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: Record<string, unknown>) => YTPlayer
      PlayerState: Record<string, number>
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number) => void
  destroy: () => void
  getCurrentTime: () => number
}

export default function RoutinePlayer({ steps, currentStep, onStepChange }: Props) {
  const [autoplay, setAutoplay] = useState(false)
  const [playing, setPlaying] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)
  const playerInstanceRef = useRef<YTPlayer | null>(null)
  const playerId = useId()

  const step = steps.length > 0 ? steps[currentStep] : null

  const regExp =
    /^.*(?:youtu\.be\/|watch\?v=)([^#&?]*).*/

  const videoId = step?.figure.youtube_url 
    ? (regExp.exec(step.figure.youtube_url)?.[1] ?? null)
    : null

  // Load YouTube API script
  useEffect(() => {
    if (typeof globalThis === "undefined" || globalThis.window?.YT) return

    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName("script")[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    globalThis.window.onYouTubeIframeAPIReady = () => {}
  }, [])

  // Initialize player when videoId changes
  useEffect(() => {
    if (!videoId || !globalThis.window?.YT) return

    if (playerInstanceRef.current?.destroy) {
      playerInstanceRef.current.destroy()
    }

    const startTime = step?.figure.start_time || 0
    const endTime = step?.figure.end_time || 0

    playerInstanceRef.current = new globalThis.window.YT.Player(playerId, {
      videoId: videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        controls: 0,
        start: startTime,
        end: endTime,
        autoplay: autoplay ? 1 : 0,
      },
      events: {
        onReady: () => {
          playerInstanceRef.current?.seekTo(startTime)
        },
        onStateChange: (event: { data: number }) => {
          // 1 = playing, 2 = paused, 0 = ended
          setPlaying(event.data === 1)

          // Auto-advance when video ends
          if (event.data === 0 && autoplay && currentStep < steps.length - 1) {
            onStepChange(currentStep + 1)
          }
        },
      },
    })

    return () => {
      // Cleanup will happen when this effect runs again with new videoId
    }
  }, [videoId, autoplay, step?.figure.start_time, step?.figure.end_time, currentStep, steps.length, onStepChange, playerId])

  function next() {
    if (currentStep < steps.length - 1) {
      onStepChange(currentStep + 1)
    }
  }

  function previous() {
    if (currentStep > 0) {
      onStepChange(currentStep - 1)
    }
  }

  function restart() {
    onStepChange(0)
  }

  function togglePlay() {
    if (!playerInstanceRef.current) return

    if (playing) {
      playerInstanceRef.current.pauseVideo()
      setPlaying(false)
    } else {
      const startTime = step?.figure.start_time || 0
      playerInstanceRef.current.seekTo(startTime)
      playerInstanceRef.current.playVideo()
      setPlaying(true)
    }
  }

  function replayCurrent() {
    if (!playerInstanceRef.current) return

    const startTime = step?.figure.start_time || 0
    playerInstanceRef.current.seekTo(startTime)
    playerInstanceRef.current.playVideo()
    setPlaying(true)
  }

  function toggleFullscreen() {
    if (!playerRef.current) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      playerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen:`, err)
      })
    }
  }

  // Auto-advance after video duration
  useEffect(() => {
    if (!autoplay || !videoId || !step || currentStep >= steps.length - 1) return

    const videoDuration = (step.figure.end_time || 0) - (step.figure.start_time || 0)
    if (videoDuration <= 0) return

    const timer = setTimeout(() => {
      onStepChange(currentStep + 1)
    }, videoDuration * 1000)

    return () => clearTimeout(timer)
  }, [currentStep, videoId, step, steps.length, autoplay, onStepChange])

  if (steps.length === 0 || !step) return null

  return (
    <div className="border p-4 flex flex-col h-full">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-base font-bold">
              {step.figure.name}
            </h2>
            <div className="text-xs text-yellow-600">
              {step.figure.difficulty === 0 ? (
                <span className="text-gray-400">Not rated</span>
              ) : (
                <>
                  {'★'.repeat(step.figure.difficulty)}
                  {'☆'.repeat(5 - step.figure.difficulty)}
                </>
              )}
            </div>
          </div>
          <span className="text-xs text-gray-600">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {videoId && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grow-0 mb-3 aspect-video">
            <div id={playerId} ref={playerRef} className="w-full h-full" />
          </div>
          
          {/* Notes section with scroll if needed */}
          {step.figure.note && (
            <div className="max-h-32 overflow-y-auto mb-3 p-2 bg-gray-50 rounded text-xs border border-gray-200">
              <p className="text-gray-700">{step.figure.note}</p>
            </div>
          )}

          {/* Control buttons - always at bottom */}
          <div className="grow-0 space-y-2">
            {/* Primary controls row */}
            <div className="flex gap-2">
              <button
                onClick={() => setAutoplay(!autoplay)}
                className={`flex-1 px-3 py-2 rounded transition-colors text-xs font-medium ${
                  autoplay
                    ? "bg-gray-500 text-white hover:bg-gray-600"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                {autoplay ? "⏸ Manual" : "▶ Auto"}
              </button>
              <button
                onClick={restart}
                className="flex-1 bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 transition-colors text-xs disabled:opacity-50"
                disabled={currentStep === 0}
              >
                ↻ Restart
              </button>
            </div>

            {/* Playback controls row */}
            <div className="flex gap-2">
              <button
                onClick={togglePlay}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors text-xs font-medium"
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                onClick={replayCurrent}
                className="flex-1 bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors text-xs"
              >
                ↻ Replay Clip
              </button>
              <button
                onClick={toggleFullscreen}
                className="flex-1 bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors text-xs"
              >
                ⛶ Fullscreen
              </button>
            </div>

            {/* Navigation controls row */}
            <div className="flex gap-2">
              <button
                onClick={previous}
                className="flex-1 bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 transition-colors text-xs disabled:opacity-50"
                disabled={currentStep === 0}
              >
                ← Previous
              </button>
              <button
                onClick={next}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors text-xs disabled:opacity-50"
                disabled={currentStep >= steps.length - 1}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}