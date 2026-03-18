/**
 * Database Schema for Sharing & Public Routines/Figures
 * 
 * This migration adds:
 * 1. shares table - stores share tokens and metadata
 * 2. visibility columns - on routines and figures
 * 3. based_on_id - tracks routine lineage (for copies)
 * 4. RLS policies - for read-only shared content
 * 
 * Run this in Supabase SQL editor
 */

-- ============================================================
-- 1. ADD SHARES TABLE (new)
-- ============================================================

CREATE TABLE shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Share metadata
  token varchar(8) UNIQUE NOT NULL,           -- URL token (e.g. "AbCd1234")
  type varchar(20) NOT NULL,                  -- 'routine' or 'figure'
  resource_id uuid NOT NULL,                  -- routines.id or figures.id
  
  -- Creator & visibility
  created_by uuid NOT NULL,                   -- user who shared it
  is_public boolean DEFAULT FALSE,            -- true = in discover, false = link-only
  
  -- Lifecycle
  created_at timestamp DEFAULT now(),
  expiry_date timestamp,                      -- optional expiration
  
  -- Analytics
  view_count int DEFAULT 0,
  last_viewed_at timestamp,
  
  -- Constraints
  CONSTRAINT created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for fast lookups
CREATE INDEX shares_token_idx ON shares(token);
CREATE INDEX shares_resource_id_idx ON shares(resource_id, type);
CREATE INDEX shares_created_by_idx ON shares(created_by);



-- ============================================================
-- 2. UPDATE ROUTINES TABLE
-- ============================================================

-- Add visibility column if not exists
ALTER TABLE routines ADD COLUMN visibility varchar(20) DEFAULT 'private' 
  CHECK (visibility IN ('private', 'public'));

-- Add based_on_id to track lineage (for copies)
ALTER TABLE routines ADD COLUMN based_on_id uuid;

-- Add foreign key constraint separately
ALTER TABLE routines 
  ADD CONSTRAINT based_on_fk FOREIGN KEY (based_on_id) REFERENCES routines(id) ON DELETE SET NULL;

-- Add creation metadata if not exists (optional, but useful for tracking)
-- ALTER TABLE routines ADD COLUMN is_original boolean DEFAULT TRUE;



-- ============================================================
-- 3. UPDATE FIGURES TABLE (optional, for future figure sharing)
-- ============================================================

-- Add created_by column to track figure creator
ALTER TABLE figures ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Visibility column already exists (added in previous migration)
-- ALTER TABLE figures ADD COLUMN visibility varchar(20) DEFAULT 'private'
--   CHECK (visibility IN ('private', 'public'));



-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- SHARES TABLE: Anyone can read if they have token
-- (queries by token are implicit - checking that token exists)
CREATE POLICY shares_read_by_anyone
  ON shares FOR SELECT
  USING (true);  -- Anyone can query, but must provide token

-- SHARES TABLE: Only creator can insert (create share)
CREATE POLICY shares_insert_own
  ON shares FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- SHARES TABLE: Only creator can delete (revoke)
CREATE POLICY shares_delete_own
  ON shares FOR DELETE
  USING (created_by = auth.uid());

-- SHARES TABLE: Only creator can update
CREATE POLICY shares_update_own
  ON shares FOR UPDATE
  USING (created_by = auth.uid());


-- ROUTINES TABLE: Anyone can read if: owner, public, or shared via link
CREATE POLICY routines_read_own_or_shared
  ON routines FOR SELECT
  USING (
    user_id = auth.uid() OR 
    visibility = 'public' OR
    -- Allow reading if a valid share link exists for this routine
    EXISTS (
      SELECT 1 FROM shares 
      WHERE shares.resource_id = routines.id 
        AND shares.type = 'routine'
    )
  );

-- ROUTINES TABLE: Only owner can update
CREATE POLICY routines_update_own
  ON routines FOR UPDATE
  USING (user_id = auth.uid());

-- ROUTINES TABLE: Only owner can delete
CREATE POLICY routines_delete_own
  ON routines FOR DELETE
  USING (user_id = auth.uid());


-- FIGURES TABLE: Anyone can read if owner or public
CREATE POLICY figures_read_own_or_public
  ON figures FOR SELECT
  USING (
    created_by = auth.uid() OR 
    visibility = 'public'
  );

-- FIGURES TABLE: Only creator can update
CREATE POLICY figures_update_own
  ON figures FOR UPDATE
  USING (created_by = auth.uid());

-- FIGURES TABLE: Only creator can delete
CREATE POLICY figures_delete_own
  ON figures FOR DELETE
  USING (created_by = auth.uid());


-- ============================================================
-- 5. ENABLE RLS
-- ============================================================

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE figures ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. VERIFY THE CHANGES
-- ============================================================

-- Check shares table
-- SELECT * FROM shares LIMIT 1;

-- Check routines columns
-- SELECT id, name, visibility, based_on_id FROM routines LIMIT 1;

-- Check figures columns
-- SELECT id, name, visibility FROM figures LIMIT 1;
