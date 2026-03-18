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

    // Check if we have the service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json(
        { error: 'Server configuration error: missing SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
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
    const { error: routinesError } = await supabaseAdmin
      .from('routines')
      .delete()
      .eq('user_id', userId)

    if (routinesError) {
      console.error('Error deleting routines:', routinesError)
      return NextResponse.json(
        { error: `Failed to delete routines: ${routinesError.message}` },
        { status: 500 }
      )
    }

    // Delete user's figures
    const { error: figuresError } = await supabaseAdmin
      .from('figures')
      .delete()
      .eq('created_by', userId)

    if (figuresError) {
      console.error('Error deleting figures:', figuresError)
      return NextResponse.json(
        { error: `Failed to delete figures: ${figuresError.message}` },
        { status: 500 }
      )
    }

    // Delete user's shares
    const { error: sharesError } = await supabaseAdmin
      .from('shares')
      .delete()
      .eq('created_by', userId)

    if (sharesError) {
      console.error('Error deleting shares:', sharesError)
      return NextResponse.json(
        { error: `Failed to delete shares: ${sharesError.message}` },
        { status: 500 }
      )
    }

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete auth user: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting account:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to delete account: ${errorMessage}` },
      { status: 500 }
    )
  }
}

