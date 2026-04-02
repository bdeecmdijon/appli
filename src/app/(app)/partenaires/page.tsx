'use client'

import { useState } from 'react'

interface Partner {
  id: string
  name: string
  category: string
  categoryColor: string
  offer: string
  address: string
  description: string
  phone?: string
  website?: string
  initials: string
  color: string
}

const PARTNERS: Partner[] = [
  {
    id: '1',
    name: 'Le Café du Commerce',
    category: 'Restauration',
    categoryColor: '#16A34A',
    offer: '-10% sur présentation de l\'app',
    address: '12 rue de la Liberté, Dijon',
    description: 'Restaurant traditionnel bourguignon au cœur de Dijon. Spécialités : bœuf bourguignon, escargots, plateau de fromages.',
    phone: '03 80 30 12 34',
    website: 'cafducommerce-dijon.fr',
    initials: 'CC',
    color: '#E8622A',
  },
  {
    id: '2',
    name: 'Le Bureau',
    category: 'Bar',
    categoryColor: '#7C3AED',
    offer: '1 boisson offerte sur 3 achetées',
    address: '8 place Darcy, Dijon',
    description: 'Bar étudiant incontournable de Dijon. Happy hour tous les soirs de 18h à 20h. Soirées thématiques chaque semaine.',
    phone: '03 80 45 67 89',
    initials: 'LB',
    color: '#1D3550',
  },
  {
    id: '3',
    name: 'FitPark Dijon',
    category: 'Sport',
    categoryColor: '#EA580C',
    offer: '-15% sur l\'abonnement mensuel',
    address: '45 avenue Victor Hugo, Dijon',
    description: 'Salle de sport moderne avec équipements cardio, musculation, cours collectifs et espace bien-être. Ouverte 7j/7.',
    phone: '03 80 58 90 12',
    website: 'fitpark-dijon.com',
    initials: 'FP',
    color: '#EA580C',
  },
  {
    id: '4',
    name: 'Cinéma Olympia',
    category: 'Culture',
    categoryColor: '#0284C7',
    offer: 'Place à 6€ (au lieu de 10€)',
    address: '3 rue Paul Cabet, Dijon',
    description: 'Cinéma indépendant proposant films d\'auteur, avant-premières et cycle thématiques. Café-librairie sur place.',
    phone: '03 80 23 45 67',
    initials: 'CO',
    color: '#0284C7',
  },
]

function BottomSheet({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header partenaire */}
        <div className="px-6 pt-3 pb-5">
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0"
              style={{ backgroundColor: partner.color }}
            >
              {partner.initials}
            </div>
            <div>
              <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>{partner.name}</h2>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: partner.categoryColor }}
              >
                {partner.category}
              </span>
            </div>
          </div>

          {/* Offre */}
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: '#E8622A' + '12', border: '1px solid ' + '#E8622A' + '30' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E8622A" className="w-4 h-4">
                <path fillRule="evenodd" d="M5.25 2.095a.75.75 0 01.75.75v1.27l1.745-.633a.75.75 0 01.514 1.411l-2.014.732v1.346l1.745-.633a.75.75 0 11.514 1.411L6.75 8.283v.717a4.5 4.5 0 109 0v-.717l-2.009-.729a.75.75 0 11.514-1.411l1.745.633V5.43l-2.009-.729a.75.75 0 11.514-1.411l1.745.633V2.845a.75.75 0 011.5 0v1.27l.245-.089a.75.75 0 11.514 1.411l-.759.276v1.346l.245-.089a.75.75 0 11.514 1.411l-.759.276V9a6 6 0 01-12 0V8.567l-.759-.276a.75.75 0 11.514-1.411l.245.089V5.623l-.759-.276a.75.75 0 01.514-1.411l.245.089V2.845a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#E8622A' }}>
                Offre partenaire
              </p>
            </div>
            <p className="text-sm font-bold" style={{ color: '#1D3550' }}>{partner.offer}</p>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed mb-5">{partner.description}</p>

          {/* Infos contact */}
          <div className="space-y-2.5">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(partner.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm active:opacity-70"
              style={{ color: '#1D3550' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.8} className="w-4 h-4 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span className="underline underline-offset-2">{partner.address}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={1.8} className="w-3 h-3 flex-shrink-0 ml-auto">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
            {partner.phone && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={1.8} className="w-4 h-4 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {partner.phone}
              </div>
            )}
            {partner.website && (
              <div className="flex items-center gap-3 text-sm" style={{ color: '#E8622A' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.8} className="w-4 h-4 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
                </svg>
                {partner.website}
              </div>
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

export default function PartenairesPage() {
  const [selected, setSelected] = useState<Partner | null>(null)

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
          {PARTNERS.length} partenaires · Offres réservées aux étudiants ECM
        </p>
      </div>

      <div className="px-5 py-5 space-y-3">
        {PARTNERS.map(partner => (
          <button
            key={partner.id}
            onClick={() => setSelected(partner)}
            className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-4">
              {/* Logo placeholder */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-base flex-shrink-0"
                style={{ backgroundColor: partner.color }}
              >
                {partner.initials}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold truncate" style={{ color: '#1D3550' }}>
                    {partner.name}
                  </p>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{ backgroundColor: partner.categoryColor }}
                  >
                    {partner.category}
                  </span>
                </div>
                <p className="text-xs font-semibold" style={{ color: '#E8622A' }}>
                  {partner.offer}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{partner.address}</p>
              </div>

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom Sheet */}
      {selected && (
        <BottomSheet partner={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
