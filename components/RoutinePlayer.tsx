/**
 * Right panel: YouTube video player with playback controls and step navigation.
 * Auto-advances to next step when video ends (if autoplay enabled).
 */
"use client"

import { useState, useEffect, useRef, useId } from "react"
import { RoutineStep, YTPlayer } from "@/types/routine"

// Helper to clean YouTube URLs (remove playlist parameters that prevent embedding)
function cleanYouTubeUrl(url: string): string {
  if (!url) return url
  const regExp = /^.*(?:youtu\.be\/|watch\?v=)([^#&?]*).*/
  const videoId = regExp.exec(url)?.[1]
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`
  }
  return url
}

interface Props {
  readonly steps: RoutineStep[]
  readonly currentStep: number
  readonly onStepChange: (index: number, fromClick?: boolean) => void
  readonly repeatMode?: 'repeat1' | 'repeatAll'
  readonly onRepeatModeChange?: (mode: 'repeat1' | 'repeatAll') => void
}

export default function RoutinePlayer({ 
  steps, 
  currentStep, 
  onStepChange,
  repeatMode = 'repeatAll',
  onRepeatModeChange
}: Props) {
  const [playing, setPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const playerRef = useRef<HTMLDivElement>(null)
  const playerInstanceRef = useRef<YTPlayer | null>(null)
  const autoAdvancingRef = useRef(false)
  const playerId = useId()

  const step = steps.length > 0 ? steps[currentStep] : null

  const regExp =
    /^.*(?:youtu\.be\/|watch\?v=)([^#&?]*).*/

  // Clean the URL to remove playlist parameters, then extract video ID
  const cleanedUrl = step?.figure.youtube_url ? cleanYouTubeUrl(step.figure.youtube_url) : null
  const videoId = cleanedUrl 
    ? (regExp.exec(cleanedUrl)?.[1] ?? null)
    : null

  // Debug logging for troubleshooting old figures
  useEffect(() => {
    if (step?.figure.youtube_url && cleanedUrl) {
      console.log(`[RoutinePlayer] Figure: ${step.figure.name} | Original URL: ${step.figure.youtube_url} | Cleaned URL: ${cleanedUrl} | VideoID: ${videoId || 'NONE'}`)
    }
  }, [cleanedUrl, videoId, step?.figure.youtube_url, step?.figure.name])

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
        autoplay: 0,
        // Don't set start/end here - we handle them manually
        // start conflicts with seekTo(), end doesn't work reliably
      },
      events: {
        onReady: () => {
          console.log(`[RoutinePlayer] onReady for ${step?.figure.name} (${videoId}), seeking to ${startTime}s, end at ${endTime}s`)
          try {
            playerInstanceRef.current?.seekTo(startTime)
            console.log(`[RoutinePlayer] seekTo completed successfully`)
          } catch (e) {
            console.error(`[RoutinePlayer] seekTo failed:`, e)
          }
        },
        onError: (event: { data: number }) => {
          // 2 = invalid video ID, 5 = HTML5 player error, 100 = video not found, 101 = video not allowed to be played embedded, 150 = same as 101
          const errorCodes: { [key: number]: string } = {
            2: 'Invalid video ID',
            5: 'HTML5 player error',
            100: 'Video not found',
            101: 'Video not allowed to be played embedded',
            150: 'Video not allowed to be played embedded (same as 101)'
          }
          console.error(`[RoutinePlayer] YouTube Error for ${step?.figure.name} (${videoId}): ${errorCodes[event.data] || `Unknown error ${event.data}`}`)
        },
        onStateChange: (event: { data: number }) => {
          // -1 = unstarted, 0 = ended, 1 = playing, 2 = paused, 3 = buffering, 5 = cued/ready
          const stateNames: { [key: number]: string } = { '-1': 'unstarted', '0': 'ended', '1': 'playing', '2': 'paused', '3': 'buffering', '5': 'cued' }
          console.log(`[RoutinePlayer] onStateChange for ${step?.figure.name}: ${stateNames[event.data] || event.data}`)
          setPlaying(event.data === 1)
          
          // Handle auto-play for Repeat All right after video is ready to play
          // but before user sees it (state change 2 = paused means video loaded and ready)
          if (event.data === 2 && autoAdvancingRef.current && repeatMode === 'repeatAll') {
            autoAdvancingRef.current = false
            playerInstanceRef.current?.playVideo()
          }

          // Handle end-of-video based on repeat mode
          if (event.data === 0) {
            if (repeatMode === 'repeat1') {
              // Repeat 1: Loop same video
              const startTime = step?.figure.start_time || 0
              playerInstanceRef.current?.seekTo(startTime)
              playerInstanceRef.current?.pauseVideo()
              setPlaying(false)
            } else if (repeatMode === 'repeatAll') {
              // Repeat All: Auto-advance to next (or loop to first)
              autoAdvancingRef.current = true // Mark this as an auto-advance
              if (currentStep < steps.length - 1) {
                // Not at last step, go to next
                onStepChange(currentStep + 1)
              } else {
                // At last step, loop back to first
                onStepChange(0)
              }
            }
          }
        },
      },
    })

    return () => {
      // Cleanup will happen when this effect runs again with new videoId
    }
  }, [videoId, step?.figure.start_time, step?.figure.end_time, currentStep, steps.length, onStepChange, playerId, repeatMode])

  // Monitor video time and pause at endTime since playerVars end doesn't work reliably
  useEffect(() => {
    if (!playerInstanceRef.current || !step?.figure.end_time) return

    const endTime = step.figure.end_time
    const interval = setInterval(() => {
      const currentTime = playerInstanceRef.current?.getCurrentTime()
      if (currentTime !== undefined && currentTime >= endTime) {
        playerInstanceRef.current?.pauseVideo()
        setPlaying(false)
        console.log(`[RoutinePlayer] Paused at end time ${endTime}s`)
      }
    }, 100) // Check every 100ms

    return () => clearInterval(interval)
  }, [videoId, step?.figure.end_time])

  function previous() {
    if (currentStep > 0) {
      onStepChange(currentStep - 1, false)
      // Pause when manually navigating (user override)
      if (playerInstanceRef.current) {
        playerInstanceRef.current.pauseVideo()
        setPlaying(false)
      }
    }
  }

  function next() {
    if (currentStep < steps.length - 1) {
      onStepChange(currentStep + 1, false)
      // Pause when manually navigating (user override)
      if (playerInstanceRef.current) {
        playerInstanceRef.current.pauseVideo()
        setPlaying(false)
      }
    }
  }

  function togglePlay() {
    if (!playerInstanceRef.current) return

    if (playing) {
      playerInstanceRef.current.pauseVideo()
      setPlaying(false)
    } else {
      // Resume from current position, don't seek to start
      playerInstanceRef.current.playVideo()
      setPlaying(true)
    }
  }

  function restartCurrentVideo() {
    if (!playerInstanceRef.current) return

    const startTime = step?.figure.start_time || 0
    playerInstanceRef.current.seekTo(startTime)
    playerInstanceRef.current.pauseVideo()
    setPlaying(false)
  }

  function restartRoutine() {
    if (repeatMode === 'repeat1') {
      // In Repeat 1 mode, restart current video
      restartCurrentVideo()
    } else {
      // In Repeat All mode, go to first step
      onStepChange(0)
      if (playerInstanceRef.current) {
        playerInstanceRef.current.pauseVideo()
        setPlaying(false)
      }
    }
  }

  function toggleFullscreen() {
    if (!playerRef.current) {
      console.error('[RoutinePlayer] playerRef not available for fullscreen')
      return
    }

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
          console.error(`[RoutinePlayer] Error exiting fullscreen:`, err)
        })
      } else {
        playerRef.current.requestFullscreen().catch((err) => {
          console.error(`[RoutinePlayer] Error requesting fullscreen:`, err)
        })
      }
    } catch (err) {
      console.error(`[RoutinePlayer] Fullscreen error:`, err)
    }
  }

  // Auto-advance after video duration is handled by onStateChange callback based on repeat mode
  // No need for separate timer

  if (steps.length === 0 || !step) return null

  return (
    <div className="border dark:border-gray-800 p-4 flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-base font-bold">
              {step.figure.name}
            </h2>
            <div className="text-xs text-yellow-600 dark:text-yellow-500">
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
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
            <div className="max-h-32 overflow-y-auto mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs border border-gray-300 dark:border-gray-700">
              <p className="text-gray-800 dark:text-gray-100">{step.figure.note}</p>
            </div>
          )}

          {/* Control buttons - optimized and always at bottom */}
          <div className="grow-0 space-y-2">
            {/* Main playback controls */}
            <div className="flex gap-2">
              <button
                onClick={togglePlay}
                className="flex-1 bg-blue-600 dark:bg-blue-700 text-white px-3 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                onClick={restartRoutine}
                className="flex-1 bg-gray-600 dark:bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm"
                title={repeatMode === 'repeat1' ? "Restart current video" : "Restart routine"}
              >
                ↻ Restart
              </button>
            </div>

            {/* Navigation and mode controls */}
            <div className="flex gap-2">
              <button
                onClick={previous}
                className="px-2 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
                disabled={currentStep === 0}
                title="Previous step"
              >
                ←
              </button>
              <button
                onClick={next}
                className="px-2 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
                disabled={currentStep >= steps.length - 1}
                title="Next step"
              >
                →
              </button>
              <button
                onClick={() => onRepeatModeChange?.(repeatMode === 'repeat1' ? 'repeatAll' : 'repeat1')}
                className={`flex-1 px-3 py-2 rounded transition-colors text-sm font-medium ${
                  repeatMode === 'repeat1'
                    ? "bg-orange-600 dark:bg-orange-700 text-white hover:bg-orange-700 dark:hover:bg-orange-600"
                    : "bg-purple-600 dark:bg-purple-700 text-white hover:bg-purple-700 dark:hover:bg-purple-600"
                }`}
                title={repeatMode === 'repeat1' ? "Repeat 1 (loop current video)" : "Repeat All (auto-advance, loop routine)"}
              >
                {repeatMode === 'repeat1' ? "🔁 Rep1" : "🔄 All"}
              </button>
              <button
                onClick={toggleFullscreen}
                className="px-2 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Fullscreen"
              >
                ⛶
              </button>
            </div>

            {/* Speed control */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
                Speed: {playbackSpeed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.25"
                max="2"
                step="0.25"
                value={playbackSpeed}
                onChange={(e) => {
                  const newSpeed = Number.parseFloat(e.target.value)
                  setPlaybackSpeed(newSpeed)
                  if (playerInstanceRef.current?.setPlaybackRate) {
                    try {
                      playerInstanceRef.current.setPlaybackRate(newSpeed)
                      console.log(`[RoutinePlayer] Speed changed to ${newSpeed}x`)
                    } catch (err) {
                      console.error(`[RoutinePlayer] Failed to set playback rate:`, err)
                    }
                  } else {
                    console.warn(`[RoutinePlayer] setPlaybackRate not available on player`)
                  }
                }}
                className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
                title="Adjust playback speed"
              />
              <div className="flex gap-1 text-xs">
                <button
                  onClick={() => {
                    const newSpeed = Math.max(0.25, playbackSpeed - 0.25)
                    setPlaybackSpeed(newSpeed)
                    try {
                      playerInstanceRef.current?.setPlaybackRate(newSpeed)
                    } catch (err) {
                      console.error('[RoutinePlayer] Failed to set speed:', err)
                    }
                  }}
                  className="flex-1 bg-gray-500 dark:bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600 dark:hover:bg-gray-600"
                >
                  -
                </button>
                <button
                  onClick={() => {
                    setPlaybackSpeed(1)
                    try {
                      playerInstanceRef.current?.setPlaybackRate(1)
                    } catch (err) {
                      console.error('[RoutinePlayer] Failed to reset speed:', err)
                    }
                  }}
                  className="flex-1 bg-gray-500 dark:bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600 dark:hover:bg-gray-600"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    const newSpeed = Math.min(2, playbackSpeed + 0.25)
                    setPlaybackSpeed(newSpeed)
                    try {
                      playerInstanceRef.current?.setPlaybackRate(newSpeed)
                    } catch (err) {
                      console.error('[RoutinePlayer] Failed to set speed:', err)
                    }
                  }}
                  className="flex-1 bg-gray-500 dark:bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600 dark:hover:bg-gray-600"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!videoId && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grow flex items-center justify-center bg-gray-100 rounded mb-3">
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-2">No video available</p>
              <p className="text-gray-500 text-xs">for {step?.figure.name}</p>
            </div>
          </div>

          {/* Notes section with scroll if needed */}
          {step.figure.note && (
            <div className="max-h-32 overflow-y-auto mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs border border-gray-300 dark:border-gray-700">
              <p className="text-gray-800 dark:text-gray-100">{step.figure.note}</p>
            </div>
          )}

          {/* Control buttons - optimized for no video */}
          <div className="grow-0 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={previous}
                className="px-2 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
                disabled={currentStep === 0}
                title="Previous step"
              >
                ←
              </button>
              <button
                onClick={next}
                className="px-2 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
                disabled={currentStep >= steps.length - 1}
                title="Next step"
              >
                →
              </button>
              <button
                onClick={restartRoutine}
                className="flex-1 px-3 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
                disabled={repeatMode === 'repeat1' || currentStep === 0}
                title={repeatMode === 'repeat1' ? "Restart current video" : "Restart routine"}
              >
                ↻ Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}