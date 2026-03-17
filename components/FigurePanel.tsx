/**
 * PHASE 4: FIGURE PANEL COMPONENT
 * 
 * FILE PURPOSE: FigurePanel is the LEFT SIDE PANEL of the choreography editor.
 * High-level role: Display draggable, expandable list of dance figures.
 * Users drag figures to builder, can expand for video previews, and resize/collapse panel.
 */
"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Figure } from "@/types/routine"
import { memo, useRef, useEffect, useId } from "react"

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number) => void
  destroy: () => void
  getCurrentTime: () => number
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

interface DraggableFigureProps {
  readonly figure: Figure
  readonly isExpanded: boolean
  readonly onToggleExpand: (id: string) => void
  readonly onAddFigure?: (figure: Figure) => void
}

/**
 * OPTIMIZATION: React.memo prevents re-renders when parent updates
 * Unless props change, this component won't re-render even if FigurePanel re-renders
 * Benefit: Smooths drag-drop performance by avoiding unnecessary DOM recalculations
 */
const DraggableFigure = memo(function DraggableFigure({ figure, isExpanded, onToggleExpand, onAddFigure }: DraggableFigureProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: figure.id,
    data: { figure },
  })

  const playerRef = useRef<HTMLDivElement>(null)
  const playerInstanceRef = useRef<YTPlayer | null>(null)
  const playerId = useId()

  let videoId: string | null = null
  if (figure.youtube_url) {
    const regExp = /^.*(?:youtu\.be\/|watch\?v=)([^#&?]*).*/
    const match = regExp.exec(figure.youtube_url)
    videoId = match?.[1].length === 11 ? match[1] : null
  }

  // Load YouTube API script
  useEffect(() => {
    if (typeof globalThis === "undefined" || globalThis.window?.YT) return

    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName("script")[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    globalThis.window.onYouTubeIframeAPIReady = () => {
      // API is ready
    }
  }, [])

  // Initialize player when expanded
  useEffect(() => {
    if (!isExpanded || !videoId || !globalThis.window?.YT || !playerRef.current) return

    const startTime = figure.start_time || 0
    const endTime = figure.end_time || 0

    // Destroy old player if it exists
    if (playerInstanceRef.current?.destroy) {
      playerInstanceRef.current.destroy()
    }

    playerInstanceRef.current = new globalThis.window.YT.Player(playerId, {
      videoId: videoId,
      width: "480",
      height: "270",
      playerVars: {
        controls: 1,
        start: startTime,
        end: endTime,
      },
      events: {
        onReady: () => {
          playerInstanceRef.current?.seekTo(startTime)
        },
      },
    })

    return () => {
      // CLEANUP: Destroy YouTube player instance when component unmounts or figure collapses
      // This prevents memory leaks and duplicate player instances on subsequent expansions
      if (playerInstanceRef.current?.destroy) {
        playerInstanceRef.current.destroy()
        playerInstanceRef.current = null
      }
    }
  }, [isExpanded, videoId, figure.start_time, figure.end_time, playerId])

  return (
    <div
      key={figure.id}
      className={`border-b transition-colors ${isDragging ? "bg-blue-100" : "hover:bg-gray-50"}`}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        overflow: "hidden",
        position: isDragging ? "absolute" : "relative",
        zIndex: isDragging ? 1000 : "auto",
      }}
    >
      <div className="flex items-center justify-between w-full p-2 hover:bg-gray-100">
        <div
          ref={setNodeRef}
          className="flex-1 text-left cursor-grab active:cursor-grabbing text-sm"
          {...listeners}
          {...attributes}
          onClick={(e) => {
            e.stopPropagation()
            onAddFigure?.(figure)
          }}
        >
          {figure.name}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(figure.id)
          }}
          className="px-2 py-1 text-xs bg-gray-300 hover:bg-gray-400 rounded transition-colors"
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 text-xs space-y-2 bg-white border-t">
          <div>Difficulty: {figure.difficulty}</div>
          <div>{figure.note}</div>
          {videoId && (
            <div id={playerId} ref={playerRef} style={{ width: "100%", maxWidth: "100%", height: "270px" }} />
          )}
        </div>
      )}
    </div>
  )
})

interface Props {
  readonly figures: Figure[]
  readonly panelWidth: number
  readonly collapsed: boolean
  readonly expanded: string | null
  readonly onToggleExpand: (id: string) => void
  readonly onAddFigure?: (figure: Figure) => void
  readonly onStartResize: (e: React.MouseEvent) => void
  readonly onCollapse: () => void
}

export default function FigurePanel({
  figures,
  panelWidth,
  collapsed,
  expanded,
  onToggleExpand,
  onAddFigure,
  onStartResize,
  onCollapse,
}: Props) {
  return (
    <>
      {!collapsed && (
        <div
          className="border-r bg-gray-50 overflow-y-scroll overflow-x-clip"
          style={{ width: panelWidth, contain: "layout", position: "relative" }}
        >
          <div className="p-3 border-b flex justify-between">
            <span className="font-bold text-sm">Figures</span>
            <button onClick={onCollapse} className="text-gray-600 text-sm">
              ◀
            </button>
          </div>

          <div className="bg-green-500 text-white text-center py-2 font-bold text-xs">
            ✓ Code Updates Working!
          </div>

          {figures.map((fig) => (
            <DraggableFigure
              key={fig.id}
              figure={fig}
              isExpanded={expanded === fig.id}
              onToggleExpand={onToggleExpand}
              onAddFigure={onAddFigure}
            />
          ))}
        </div>
      )}

      {!collapsed && (
        <button
          className="w-1 bg-gray-300 hover:bg-gray-400 cursor-col-resize transition-colors"
          onMouseDown={onStartResize}
          aria-label="Resize panel"
        />
      )}

      {collapsed && (
        <button
          onClick={onCollapse}
          className="text-gray-600 p-2 hover:bg-gray-100"
          aria-label="Open figures panel"
        >
          ▶
        </button>
      )}
    </>
  )
}
