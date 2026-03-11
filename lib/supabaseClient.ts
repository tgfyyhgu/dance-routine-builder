import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://bccahcyviopumyhjmkwl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjY2FoY3l2aW9wdW15aGpta3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTAyNDcsImV4cCI6MjA4ODQ2NjI0N30.7qjisUD5-1Ch_-OvwIFUg2XrEqOQZiJAK8O6vFTz0XY"

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)