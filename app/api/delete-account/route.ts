import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Use service role key for admin operations (from environment)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Delete user's routines
    await supabaseAdmin
      .from('routines')
      .delete()
      .eq('user_id', userId)

    // Delete user's figures
    await supabaseAdmin
      .from('figures')
      .delete()
      .eq('created_by', userId)

    // Delete user's shares
    await supabaseAdmin
      .from('shares')
      .delete()
      .eq('created_by', userId)

    // Delete the auth user
    await supabaseAdmin.auth.admin.deleteUser(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
