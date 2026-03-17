import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/my-routines/:path*',
    '/waltz/:path*',
    '/tango/:path*',
    '/foxtrot/:path*',
    '/quickstep/:path*',
    '/viennese/:path*',
  ],
}