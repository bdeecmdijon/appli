import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/accueil', '/bds', '/jeu', '/partenaires', '/profil']
const AUTH_PAGES = ['/auth/login', '/auth/register']

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const isProtected = PROTECTED.some(p => path === p || path.startsWith(p + '/'))
  const isAuthPage = AUTH_PAGES.some(p => path === p || path.startsWith(p + '/'))

  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/accueil', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/accueil/:path*',
    '/bds/:path*',
    '/jeu/:path*',
    '/partenaires/:path*',
    '/profil/:path*',
    '/auth/:path*',
  ],
}
