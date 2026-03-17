/**
 * PHASE 1: TIME UTILITIES
 * 
 * These are helper functions for converting between different time formats.
 * 
 * Context: YouTube video timestamps are stored in SECONDS in the database
 * but users want to INPUT/VIEW them in familiar formats like "2:30" (2 mins 30 secs).
 * 
 * Solution:
 * - parseTimeToSeconds: Convert user input "2:30" → 150 seconds
 * - formatSecondsToTime: Convert database seconds 150 → "2:30" for display
 */

/**
 * Function: parseTimeToSeconds
 * ============================
 * 
 * Purpose: Convert VARIOUS time input formats into SECONDS (a single number)
 * 
 * Why? Users might type "2:30" or "150" or "136", and all should mean 2 mins 30 secs
 * The database and YouTube API need SECONDS only, so we normalize all inputs.
 * 
 * Input: string (what user typed, e.g., "2:30")
 * Output: number (total seconds, e.g., 150)
 * 
 * Supported input formats:
 * ├─ "30"      → 30 seconds
 * ├─ "2:30"    → 150 seconds (format: mm:ss)
 * ├─ "1:30:45" → 5445 seconds (format: hh:mm:ss)
 * ├─ "136"     → 96 seconds (smart parse: last 2 digits = seconds, rest = minutes)
 * └─ "1245"    → 765 seconds (smart parse: 12 minutes 45 seconds)
 */
export function parseTimeToSeconds(input: string): number {
  // Remove whitespace from start/end (e.g., " 2:30 " becomes "2:30")
  const trimmed = input.trim()
  
  // Edge case: if user inputs nothing, return 0 seconds
  if (!trimmed) return 0
  
  // ============ CASE 1: INPUT HAS COLONS (explicit format like "2:30") ============
  if (trimmed.includes(":")) {
    // Split by ":" and convert each part to a number
    // Example: "2:30" → split → ["2", "30"] → map to number → [2, 30]
    // The .filter removes any NaN values (invalid input)
    const parts = trimmed.split(":").map(p => Number.parseInt(p, 10)).filter(n => !Number.isNaN(n))
    
    // If no valid numbers found, return 0
    if (parts.length === 0) return 0
    
    // If only one number present (e.g., "30:"), treat as just seconds
    if (parts.length === 1) return parts[0]
    
    // If two numbers (e.g., "2:30"), interpret as mm:ss format
    // minutes * 60 + seconds
    // Example: [2, 30] → 2 * 60 + 30 = 150
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    
    // If three or more numbers (e.g., "1:30:45"), interpret as hh:mm:ss format
    // hours * 3600 + minutes * 60 + seconds
    // Example: [1, 30, 45] → 1 * 3600 + 30 * 60 + 45 = 5445
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  
  // ============ CASE 2: INPUT HAS NO COLONS (smart parsing) ============
  // User typed a raw number like "136" or "1245"
  // We need to intelligently guess what they meant
  
  // Try to parse the input as a number
  const num = Number.parseInt(trimmed, 10)
  
  // If parsing failed (not a valid number), return 0
  if (Number.isNaN(num)) return 0
  
  // If number is less than 60, assume user meant just seconds
  // Example: user types "30", probably means 30 seconds, not 30 minutes
  if (num < 60) return num
  
  // Convert number back to string so we can check its length
  const str = num.toString()
  
  // If the number has exactly 2 digits AND is >= 60, user probably meant minutes
  // Example: user types "90", probably means 90 minutes (not seconds)
  // This is a guess, but 2-digit numbers >= 60 are most likely minutes
  if (str.length === 2) return num < 60 ? num : num * 60
  
  // ============ CASE 3: 3+ DIGIT NUMBERS (smart format: last 2 = seconds, rest = minutes) ============
  // Example: 
  //   - user types "136" → should mean "1:36" (1 min 36 sec)
  //   - user types "1245" → should mean "12:45" (12 min 45 sec)
  //   - user types "13045" → should mean "130:45" (130 min 45 sec)
  
  // Take the LAST 2 characters and convert to number (these are seconds)
  // .slice(-2) means "from the end, take 2 characters"
  // Example: "1245".slice(-2) → "45" → 45
  const seconds = Number.parseInt(str.slice(-2), 10)
  
  // Take EVERYTHING EXCEPT last 2 characters and convert to number (these are minutes)
  // .slice(0, -2) means "from start to 2 characters from end"
  // Example: "1245".slice(0, -2) → "12" → 12
  const minutes = Number.parseInt(str.slice(0, -2), 10)
  
  // Return total seconds: (minutes * 60) + seconds
  // Example: 12 * 60 + 45 = 720 + 45 = 765 seconds
  return minutes * 60 + seconds
}

/**
 * Function: formatSecondsToTime
 * =============================
 * 
 * Purpose: Convert SECONDS (a number) into a READABLE time format
 * This is the OPPOSITE of parseTimeToSeconds.
 * 
 * Why? The database has 150 (seconds), but we want to DISPLAY it as "2:30"
 * 
 * Input: number (seconds, e.g., 150)
 * Output: string (formatted time, e.g., "2:30")
 * 
 * Output format:
 * ├─ If hours = 0: "m:ss" (e.g., "2:30")
 * └─ If hours > 0: "h:mm:ss" (e.g., "1:02:30")
 */
export function formatSecondsToTime(seconds: number): string {
  // Ensure seconds is non-negative and rounded to whole number
  // Math.max(0, ...) prevents negative numbers
  // Math.round(...) converts 2.3 to 2, 2.7 to 3
  const s = Math.max(0, Math.round(seconds))
  
  // Calculate hours by dividing total seconds by 3600
  // Math.floor rounds DOWN to get whole hours
  // Example: 5445 / 3600 = 1.51... → Math.floor → 1 hour
  const hours = Math.floor(s / 3600)
  
  // Calculate minutes from REMAINING seconds (after removing full hours)
  // (s % 3600) gives remainder after removing hours
  // Then divide by 60 to get minutes
  // Example: 5445 % 3600 = 1845 seconds remaining → 1845 / 60 = 30.75 → Math.floor → 30 mins
  const minutes = Math.floor((s % 3600) / 60)
  
  // Calculate seconds from REMAINING seconds (after removing hours and minutes)
  // s % 60 gives remainder after removing all minutes
  // Example: 5445 % 60 = 45 seconds
  const secs = s % 60
  
  // ============ FORMAT DECISION ============
  // If we have hours (more than 0), use "h:mm:ss" format
  // Example: 1 hour 2 minutes 30 seconds → "1:02:30"
  if (hours > 0) {
    // Template: `${hours}:${padded minutes}:${padded seconds}`
    // .padStart(2, "0") adds leading zeros if needed
    // Example: 2 minutes → "02", 5 seconds → "05"
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  
  // If no hours, use "m:ss" format
  // Example: 2 minutes 30 seconds → "2:30"
  // Minutes are NOT padded (so 2:30 not 02:30), but seconds ARE padded
  // Example: 0 minutes 5 seconds → "0:05"
  return `${minutes}:${String(secs).padStart(2, "0")}`
}
