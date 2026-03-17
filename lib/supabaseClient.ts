/**
 * Supabase client for PostgreSQL database connection.
 */

import { createClient } from '@supabase/supabase-js'

// Database URL (Supabase server location)
const supabaseUrl = "https://bccahcyviopumyhjmkwl.supabase.co"

// Public API key for client-side use (safe to expose)
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjY2FoY3l2aW9wdW15aGpta3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTAyNDcsImV4cCI6MjA4ODQ2NjI0N30.7qjisUD5-1Ch_-OvwIFUg2XrEqOQZiJAK8O6vFTz0XY"

// Exported client: supabase.from("table").select("*").eq("column", value)
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)