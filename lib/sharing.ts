/**
 * Sharing utilities for generating and managing routine/figure share links
 */

import { supabase } from './supabaseClient'
import { RoutineStep } from '@/types/routine'
import { v4 as uuid } from 'uuid'

/**
 * Generate a random share token (8 chars, alphanumeric, URL-safe)
 */
export function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

/**
 * Generate a shareable URL for a routine or figure
 * @param token - The share token
 * @returns Full shareable URL
 */
export function generateShareUrl(token: string): string {
  if (typeof globalThis === 'undefined' || !globalThis.window) {
    return `/share/${token}`
  }
  const origin = globalThis.window.location.origin
  return `${origin}/share/${token}`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    return false
  }
}

/**
 * Create a share link for a routine
 */
export async function createShareLink(
  routineId: string,
  userId: string,
  isPublic: boolean = false
): Promise<{ token: string; url: string }> {
  const token = generateShareToken()
  
  const { error } = await supabase.from('shares').insert([
    {
      token,
      type: 'routine',
      resource_id: routineId,
      created_by: userId,
      is_public: isPublic,
    },
  ])
  
  if (error) {
    throw new Error(`Failed to create share: ${error.message}`)
  }
  
  return {
    token,
    url: generateShareUrl(token),
  }
}

/**
 * Revoke a share link
 */
export async function revokeShare(token: string): Promise<void> {
  const { error } = await supabase.from('shares').delete().eq('token', token)
  
  if (error) {
    throw new Error(`Failed to revoke share: ${error.message}`)
  }
}

/**
 * Get share info by token (used when viewing shared routine)
 */
export async function getShareByToken(token: string) {
  const { data, error } = await supabase
    .from('shares')
    .select('*')
    .eq('token', token)
    .single()
  
  if (error) {
    throw new Error(`Share not found: ${error.message}`)
  }
  
  return data
}

/**
 * Copy a shared routine to user's own routines
 * Creates a new routine with steps from the shared one
 */
export async function copyRoutineToOwn(
  sharedRoutineId: string,
  userId: string,
  newName?: string
): Promise<string> {
  // 1. Fetch the routine to copy
  const { data: originalRoutine, error: fetchError } = await supabase
    .from('routines')
    .select('*')
    .eq('id', sharedRoutineId)
    .single()
  
  if (fetchError || !originalRoutine) {
    throw new Error('Routine not found')
  }
  
  // 2. Create new routine
  const newId = uuid()
  const newRoutine = {
    id: newId,
    name: newName || `${originalRoutine.name} (Copy)`,
    dance_style: originalRoutine.dance_style,
    steps: originalRoutine.steps,
    user_id: userId,
    based_on_id: sharedRoutineId,  // Track lineage
    visibility: 'private',  // Always private when copied
    created_at: new Date().toISOString(),
  }
  
  const { error: insertError } = await supabase
    .from('routines')
    .insert([newRoutine])
  
  if (insertError) {
    throw new Error(`Failed to copy routine: ${insertError.message}`)
  }
  
  return newId
}

/**
 * Update routine visibility
 */
export async function updateRoutineVisibility(
  routineId: string,
  visibility: 'private' | 'shared' | 'public'
): Promise<void> {
  const { error } = await supabase
    .from('routines')
    .update({ visibility })
    .eq('id', routineId)
  
  if (error) {
    throw new Error(`Failed to update visibility: ${error.message}`)
  }
}

/**
 * Get routine with share info (if shared)
 */
export async function getRoutineWithShare(routineId: string) {
  const { data, error } = await supabase
    .from('routines')
    .select(
      `
      *,
      shares:shares!resource_id(token, is_public, created_at)
    `
    )
    .eq('id', routineId)
    .single()
  
  if (error) {
    throw new Error(`Failed to fetch routine: ${error.message}`)
  }
  
  return data
}

/**
 * Fetch shared routine by token (read-only view)
 */
export async function getSharedRoutineByToken(token: string) {
  try {
    // Get share info
    const share = await getShareByToken(token)
    
    if (share.type !== 'routine') {
      throw new Error('Share is not a routine')
    }
    
    // Check if expired
    if (share.expiry_date && new Date(share.expiry_date) < new Date()) {
      throw new Error('This share link has expired')
    }
    
    // Fetch the routine
    const { data: routine, error } = await supabase
      .from('routines')
      .select('*, shares!based_on_id(id, name, user_id)')
      .eq('id', share.resource_id)
      .single()
    
    if (error || !routine) {
      throw new Error('Routine not found')
    }
    
    // Increment view count
    await supabase
      .from('shares')
      .update({ 
        view_count: (share.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString()
      })
      .eq('token', token)
    
    return {
      routine,
      share,
      original: routine.shares?.[0] || null,  // Info about original if this is a copy
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to fetch shared routine: ${message}`)
  }
}
