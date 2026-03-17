/**
 * Convert user input ("2:30", "150", etc.) to seconds and vice versa.
 */

/**
 * Convert various time formats to seconds: "30", "2:30", "1:30:45", "136", etc.
 * Supports mm:ss, hh:mm:ss, minSec format (e.g., "136" → 1:36), and raw seconds.
 */
export function parseTimeToSeconds(input: string): number {
  const trimmed = input.trim()
  if (!trimmed) return 0

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(p => Number.parseInt(p, 10)).filter(n => !Number.isNaN(n))
    if (parts.length === 0) return 0
    if (parts.length === 1) return parts[0]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  const num = Number.parseInt(trimmed, 10)
  if (Number.isNaN(num)) return 0
  if (num < 60) return num

  const str = num.toString()
  if (str.length === 2) return num < 60 ? num : num * 60

  // For 3+ digits: last 2 = seconds, rest = minutes (e.g., "136" → 1:36)
  const seconds = Number.parseInt(str.slice(-2), 10)
  const minutes = Number.parseInt(str.slice(0, -2), 10)
  
  // Return total seconds: (minutes * 60) + seconds
  // Example: 12 * 60 + 45 = 720 + 45 = 765 seconds
  return minutes * 60 + seconds
}

/**
 * Convert seconds to readable format: returns "m:ss" or "h:mm:ss" if hours > 0.
 */
export function formatSecondsToTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const secs = s % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`
}
