'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Trophy, Gamepad2, Handshake, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SplashScreen from '@/components/SplashScreen'

const ACTIVE_COLOR   = '#E8622A'
const INACTIVE_COLOR = 'rgba(255,255,255,0.45)'

const navItems = [
  {
    href:  '/accueil',
    label: 'Accueil',
    icon:  (active: boolean) => (
      <Home size={26} strokeWidth={2} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} fill="none" />
    ),
  },
  {
    href:  '/bds',
    label: 'BDS',
    icon:  (active: boolean) => (
      <Trophy size={26} strokeWidth={2} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} fill="none" />
    ),
  },
  {
    href:  '/jeu',
    label: 'Jeu',
    icon:  (active: boolean) => (
      <Gamepad2 size={26} strokeWidth={2} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} fill="none" />
    ),
  },
  {
    href:  '/partenaires',
    label: 'Partenaires',
    icon:  (active: boolean) => (
      <Handshake size={26} strokeWidth={2} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} fill="none" />
    ),
  },
  {
    href:  '/profil',
    label: 'Profil',
    icon:  (active: boolean) => (
      <User size={26} strokeWidth={2} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} fill="none" />
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
              >
                <div
                  className="relative"
                  style={{
                    filter: active ? 'drop-shadow(0 0 6px rgba(232,98,42,0.7))' : 'none',
                  }}
                >
                  {item.icon(active)}
                  {showDot && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                      style={{ backgroundColor: '#EF4444', boxShadow: '0 0 4px rgba(239,68,68,0.8)' }}
                    />
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold tracking-wide transition-colors duration-200"
                  style={{ color: active ? '#E8622A' : 'rgba(255,255,255,0.45)' }}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
