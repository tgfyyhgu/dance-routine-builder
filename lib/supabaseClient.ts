/**
 * PHASE 1: DATABASE CONNECTION
 * 
 * This file sets up the connection to Supabase (a PostgreSQL database).
 * Think of it like opening a phone line to a database server.
 * Once this is done, the app can send requests to read/write data.
 */

import { createClient } from '@supabase/supabase-js'

// The URL of the Supabase database server
// (Like an address: "Where is the database server located?")
const supabaseUrl = "https://bccahcyviopumyhjmkwl.supabase.co"

// Authentication key (like a password to access the database)
// This is a PUBLIC key for client-side use (safe to expose in browser)
// There are also SECRET keys that should never be exposed
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjY2FoY3l2aW9wdW15aGpta3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTAyNDcsImV4cCI6MjA4ODQ2NjI0N30.7qjisUD5-1Ch_-OvwIFUg2XrEqOQZiJAK8O6vFTz0XY"

/**
 * Create and EXPORT the Supabase client
 * This is imported by other files as:
 *   import { supabase } from '@/lib/supabaseClient'
 * 
 * Then they use it like:
 *   supabase
 *     .from("figures")              // Select table name
 *     .select("*")                  // Select all columns
 *     .eq("dance_style", "waltz")   // Filter by condition
 * 
 * This reads data from the "figures" table where dance_style = "waltz"
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)