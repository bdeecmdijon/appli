'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface Partner {
  id:          string
  name:        string
  address:     string | null
  city:        string | null
  phone:       string | null
  description: string | null
  offer:       string | null
  category:    string | null
  logo_url:    string | null
}

// ── Constantes ─────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Restaurant:  '#16A34A',
  Bar:         '#7C3AED',
  Sport:       '#EA580C',
  Culture:     '#0284C7',
  Mode:        '#EC4899',
  'Bien-être': '#059669',
  Tech:        '#2563EB',
  Autre:       '#6B7280',
}

function categoryColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? '#6B7280'
}

function fullAddress(p: Partner) {
  const parts = [p.address, p.city].filter(Boolean)
  return parts.join(', ') || null
}

// ── Bottom Sheet ───────────────────────────────────────────────────────────

function BottomSheet({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const catColor = categoryColor(partner.category)
  const addr     = fullAddress(partner)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-6 pt-3 pb-8">
          {/* En-tête */}
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border border-gray-100"
              style={{ backgroundColor: '#F3F4F6' }}
            >
              {partner.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={partner.logo_url}
                  alt={partner.name}
                  className="w-12 h-12 object-contain rounded-xl"
                />
              ) : (
                <span
                  className="text-lg font-extrabold"
                  style={{ color: catColor }}
                >
                  {partner.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>{partner.name}</h2>
              {partner.category && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: catColor }}
                >
                  {partner.category}
                </span>
              )}
            </div>
          </div>

          {/* Offre */}
          {partner.offer && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ backgroundColor: '#E8622A12', border: '1px solid #E8622A30' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E8622A" className="w-4 h-4 flex-shrink-0">
                  <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 01.75.75c0 5.056-2.383 9.555-6.084 12.436A6.75 6.75 0 019.75 22.5a.75.75 0 01-.75-.75v-4.131A15.838 15.838 0 016.382 15H2.25a.75.75 0 01-.75-.75 6.75 6.75 0 017.815-6.666zM15 6.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" clipRule="evenodd" />
                  <path d="M5.26 17.242a.75.75 0 10-.897-1.203 5.243 5.243 0 00-2.05 5.022.75.75 0 00.625.627 5.243 5.243 0 005.022-2.051.75.75 0 10-1.202-.897 3.744 3.744 0 01-3.008 1.51c0-1.23.592-2.323 1.51-3.008z" />
                </svg>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#E8622A' }}>
                  Offre partenaire
                </p>
              </div>
              <p className="text-sm font-bold" style={{ color: '#1D3550' }}>{partner.offer}</p>
            </div>
          )}

          {/* Description */}
          {partner.description && (
            <p className="text-sm text-gray-500 leading-relaxed mb-5">{partner.description}</p>
          )}

          {/* Infos contact */}
          <div className="space-y-2.5">
            {addr && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm active:opacity-70"
                style={{ color: '#1D3550' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.8} className="w-4 h-4 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="underline underline-offset-2">{addr}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={1.8} className="w-3 h-3 flex-shrink-0 ml-auto">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
            {partner.phone && (
              <a
                href={`tel:${partner.phone}`}
                className="flex items-center gap-3 text-sm text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={1.8} className="w-4 h-4 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {partner.phone}
              </a>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 h-13 rounded-2xl font-bold text-white transition active:scale-[0.98]"
            style={{ backgroundColor: '#1D3550', height: '52px' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PartenairesPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Partner | null>(null)

  useEffect(() => {
    async function fetchPartners() {
      const { data } = await supabase
        .from('partners')
        .select('id, name, address, city, phone, description, offer, category, logo_url')
        .eq('is_active', true)
        .order('name')
      setPartners(data ?? [])
      setLoading(false)
    }
    fetchPartners()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <p className="text-sm text-white/50 font-medium">Avantages exclusifs</p>
        <h1 className="text-2xl font-extrabold text-white mt-0.5">Nos partenaires</h1>
        <p className="text-sm text-white/60 mt-1">
          {loading ? '…' : `${partners.length} partenaire${partners.length !== 1 ? 's' : ''}`} · Offres réservées aux étudiants ECM
        </p>
      </div>

      <div className="px-5 py-5 space-y-3 pb-24">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24 animate-pulse" />
          ))
        ) : partners.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-3xl mb-2">🤝</p>
            <p className="text-gray-400 text-sm">Aucun partenaire disponible pour le moment.</p>
          </div>
        ) : (
          partners.map(partner => {
            const catColor = categoryColor(partner.category)
            const addr     = fullAddress(partner)
            return (
              <button
                key={partner.id}
                onClick={() => setSelected(partner)}
                className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-4">
                  {/* Logo */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border border-gray-100"
                    style={{ backgroundColor: '#F3F4F6' }}
                  >
                    {partner.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={partner.logo_url}
                        alt={partner.name}
                        className="w-10 h-10 object-contain rounded-xl"
                      />
                    ) : (
                      <span className="text-base font-extrabold" style={{ color: catColor }}>
                        {partner.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold truncate" style={{ color: '#1D3550' }}>
                        {partner.name}
                      </p>
                      {partner.category && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                          style={{ backgroundColor: catColor }}
                        >
                          {partner.category}
                        </span>
                      )}
                    </div>
                    {partner.offer && (
                      <p className="text-xs font-semibold truncate" style={{ color: '#E8622A' }}>
                        {partner.offer}
                      </p>
                    )}
                    {addr && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{addr}</p>
                    )}
                  </div>

                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </button>
            )
          })
        )}
      </div>

      {selected && (
        <BottomSheet partner={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
