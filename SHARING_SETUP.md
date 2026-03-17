# Sharing Feature Setup Instructions

## Step 1: Update Supabase Database Schema

Go to your Supabase dashboard → SQL Editor and run these commands:

```sql
-- Add shared_token column to routines table
ALTER TABLE routines ADD COLUMN shared_token text UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_shared_token ON routines(shared_token);
```

## Step 2: Update RLS Policies

Replace the existing SELECT policy on the routines table to allow public access to shared routines:

```sql
-- First, drop the old policy (if it exists)
DROP POLICY IF EXISTS "Users can view own routines" ON routines;

-- Create new policy that allows viewing own routines OR shared routines
CREATE POLICY "Users can view own or shared routines" ON routines
  FOR SELECT
  USING (auth.uid() = user_id OR shared_token IS NOT NULL);
```

## Step 3: Done!

That's it! The sharing feature is now ready to use. Users can:
1. Click the 🔗 Share button on any routine in My Routines
2. Get a shareable link (e.g., https://dance-routine-builder.vercel.app/share/ABC12345)  
3. Copy the link and share with coaches, dance partners, or anyone else
4. Recipients can view the routine in read-only mode with the player

## Features

- **Easy Sharing**: One-click sharing with copy-to-clipboard
- **Read-Only Access**: Shared routines can't be edited by viewers
- **Persistent Links**: Share tokens persist, so links work forever
- **Dark Mode Support**: Shared viewer respects user's dark mode preference
