'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SplashScreen from '@/components/SplashScreen'

const navItems = [
  {
    href: '/accueil',
    label: 'Accueil',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12L12 3l9 9M4.5 10.5V20a.5.5 0 00.5.5h4.5v-5h5v5H19a.5.5 0 00.5-.5v-9.5" />
      </svg>
    ),
  },
  {
    href: '/bds',
    label: 'BDS',
    icon: (active: boolean) => (
      <Trophy
        size={28}
        strokeWidth={active ? 2.2 : 1.8}
        fill={active ? 'currentColor' : 'none'}
      />
    ),
  },
  {
    href: '/jeu',
    label: 'Jeu',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
      </svg>
    ),
  },
  {
    href: '/partenaires',
    label: 'Partenaires',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    ),
  },
  {
    href: '/profil',
    label: 'Profil',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname()
  const [hasUnread,   setHasUnread]   = useState(false)
  const [showSplash,  setShowSplash]  = useState(false)

  useEffect(() => {
    // Affiche le splash une seule fois par session
    if (!sessionStorage.getItem('splash_shown')) {
      sessionStorage.setItem('splash_shown', '1')
      setShowSplash(true)
    }
  }, [])

  useEffect(() => {
    const onAccueil = pathname === '/accueil' || pathname.startsWith('/accueil/')

    if (onAccueil) {
      // Marquer comme vu
      localStorage.setItem('events_seen_at', new Date().toISOString())
      setHasUnread(false)
      return
    }

    // Vérifier s'il y a de nouveaux événements depuis la dernière visite
    const seenAt = localStorage.getItem('events_seen_at') ?? '1970-01-01T00:00:00.000Z'
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gt('starts_at', new Date().toISOString())
      .gt('created_at', seenAt)
      .then(({ count }) => {
        setHasUnread((count ?? 0) > 0)
      })
  }, [pathname])

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <main className="flex-1 pb-28 overflow-y-auto">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
        style={{
          background:       'rgba(16, 24, 48, 0.93)',
          backdropFilter:   'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          paddingBottom:    'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          boxShadow:        '0 -1px 0 rgba(255,255,255,0.06), 0 -8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div className="flex items-center justify-around pt-2 max-w-md mx-auto px-2">
          {navItems.map((item) => {
            const active   = pathname === item.href || pathname.startsWith(item.href + '/')
            const showDot  = item.href === '/accueil' && hasUnread && !active

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-200 relative"
                style={{
                  color:  active ? '#E8622A' : 'rgba(255,255,255,0.45)',
                  filter: active ? 'drop-shadow(0 0 8px rgba(232,98,42,0.55))' : 'none',
                }}
              >
                <div className="relative">
                  {item.icon(active)}
                  {showDot && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                      style={{ backgroundColor: '#EF4444', boxShadow: '0 0 4px rgba(239,68,68,0.8)' }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
