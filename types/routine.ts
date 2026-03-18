
export interface Figure {
  id: string
  name: string
  difficulty: number
  note: string
  youtube_url: string
  start_time: number
  end_time: number
  created_by?: string
  visibility?: 'private' | 'public'
}

export interface RoutineStep {
  stepId: string
  figure: Figure
}

export interface Routine {

  id: string
  name: string
  dance_style: string
  created_at: string
  steps: RoutineStep[]
  user_id?: string
  visibility?: 'private' | 'public'
  based_on_id?: string | null
}

export interface Share {
  id: string
  token: string
  type: 'routine' | 'figure'
  resource_id: string
  created_by: string
  is_public: boolean
  created_at: string
  expiry_date?: string | null
  view_count: number
  last_viewed_at?: string | null
}

export interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number) => void
  setPlaybackRate: (rate: number) => void
  getAvailablePlaybackRates?: () => number[]
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
