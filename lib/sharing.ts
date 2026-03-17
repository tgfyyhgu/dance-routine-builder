/**
 * Sharing utilities for generating and managing routine share links
 */

/**
 * Generate a random share token (8 chars, alphanumeric, URL-safe)
 */
export function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Generate a shareable URL for a routine
 * @param token - The share token
 * @returns Full shareable URL
 */
export function generateShareUrl(token: string): string {
  if (typeof globalThis === 'undefined' || !globalThis.window) {
    return `/share/${token}`;
  }
  const origin = globalThis.window.location.origin;
  return `${origin}/share/${token}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
