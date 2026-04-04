import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED  = ['/accueil', '/bds', '/jeu', '/partenaires', '/profil']
const AUTH_PAGES = ['/auth/login', '/auth/register']

export async function middleware(req: NextRequest) {
  // Réponse de base — les cookies rafraîchis seront posés dessus
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Écrire les nouveaux cookies sur la requête ET sur la réponse
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() rafraîchit le token si besoin (écrit dans res via setAll)
  const { data: { session } } = await supabase.auth.getSession()

  const path        = req.nextUrl.pathname
  const isProtected = PROTECTED.some(p => path === p || path.startsWith(p + '/'))
  const isAuthPage  = AUTH_PAGES.some(p => path === p || path.startsWith(p + '/'))

  // Pas connecté sur une page protégée → login
  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', path)
    const redirect = NextResponse.redirect(loginUrl)
    // Propager les cookies rafraîchis dans la réponse redirect
    res.cookies.getAll().forEach(c => redirect.cookies.set(c.name, c.value))
    return redirect
  }

  // Connecté sur une page auth → accueil
  if (isAuthPage && session) {
    const redirect = NextResponse.redirect(new URL('/accueil', req.url))
    res.cookies.getAll().forEach(c => redirect.cookies.set(c.name, c.value))
    return redirect
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
