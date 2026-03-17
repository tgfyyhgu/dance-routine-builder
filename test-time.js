function parseTimeToSeconds(input) {
  const trimmed = input.trim()
  
  if (!trimmed) return 0
  
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map(p => Number.parseInt(p, 10)).filter(n => !Number.isNaN(n))
    
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
  
  const seconds = Number.parseInt(str.slice(-2), 10)
  const minutes = Number.parseInt(str.slice(0, -2), 10)
  
  return minutes * 60 + seconds
}

function formatSecondsToTime(seconds) {
  const s = Math.max(0, Math.round(seconds))
  
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const secs = s % 60
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

console.log("Input: '136'")
const parsed = parseTimeToSeconds('136')
console.log('Parsed to seconds:', parsed)
console.log('Formatted back:', formatSecondsToTime(parsed))
console.log('Expected: "1:36"')

// Also test what happens when we display it first, then user deletes and types
console.log("\n--- Scenario: Start with 0, user types '136' ---")
console.log("Initial display: '0:00'")
console.log("User types: '136'")
console.log("onChange fires with '136'")
const result = parseTimeToSeconds('136')
console.log("Parsed: " + result + " seconds")
console.log("Displayed: " + formatSecondsToTime(result))
