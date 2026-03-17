-- Add shared_token column to routines for sharing
ALTER TABLE routines ADD COLUMN shared_token text UNIQUE;

-- Create index for faster shared_token lookups
CREATE INDEX idx_shared_token ON routines(shared_token);

-- Update RLS: Allow public access to routines with shared_token
-- (Modify existing SELECT policy to allow shared routines)

-- Note: You'll need to manually update the existing RLS SELECT policy:
-- OLD: CREATE POLICY "Users can view own routines" ON routines FOR SELECT USING (auth.uid() = user_id);
-- NEW: Allow viewing if user owns it OR it's publicly shared (shared_token IS NOT NULL)

-- Example new policy to replace old one:
-- DROP POLICY "Users can view own routines" ON routines;
-- CREATE POLICY "Users can view own or shared routines" ON routines
--   FOR SELECT
--   USING (auth.uid() = user_id OR shared_token IS NOT NULL);

-- Then for INSERT/UPDATE/DELETE, keep existing policies (user_id check)
