import { createBrowserClient } from '@supabase/ssr'

// createBrowserClient stocke la session dans les cookies (et non localStorage)
// ce qui permet au middleware de lire la session côté serveur.
// sameSite: 'lax' est requis pour Safari/iOS (strict bloque certaines navigations).
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookieOptions: {
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
    },
  }
)
