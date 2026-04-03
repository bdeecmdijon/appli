'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface EventOption {
  id:    string
  title: string
}

interface NotifHistory {
  id:         string
  title:      string
  message:    string
  sent_at:    string
  recipients: number
  event_id:   string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [title,    setTitle]    = useState('')
  const [message,  setMessage]  = useState('')
  const [eventId,  setEventId]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [events,   setEvents]   = useState<EventOption[]>([])
  const [history,  setHistory]  = useState<NotifHistory[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function fetchData() {
      const now = new Date().toISOString()
      const [eventsRes, historyRes] = await Promise.all([
        supabase.from('events').select('id, title').gte('starts_at', now).order('starts_at').limit(10),
        supabase.from('notifications_history').select('id, title, message, sent_at, recipients, event_id').order('sent_at', { ascending: false }).limit(10),
      ])
      setEvents(eventsRes.data ?? [])
      setHistory(historyRes.data ?? [])
      setLoading(false)
    }
    fetchData()
  }, [sent])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !message.trim()) { setError('Titre et message sont obligatoires.'); return }
    setSending(true); setError(null)

    const appId  = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    const apiKey = process.env.NEXT_PUBLIC_ONESIGNAL_REST_API_KEY

    if (!appId || !apiKey) {
      setError('Clés OneSignal non configurées (NEXT_PUBLIC_ONESIGNAL_APP_ID / NEXT_PUBLIC_ONESIGNAL_REST_API_KEY).')
      setSending(false); return
    }

    try {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Basic ${apiKey}`,
        },
        body: JSON.stringify({
          app_id:             appId,
          included_segments:  ['All'],
          headings:  { fr: title.trim() },
          contents:  { fr: message.trim() },
          ...(eventId ? { url: `/accueil/${eventId}` } : {}),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.errors?.[0] ?? 'Erreur OneSignal')

      // Historique
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('notifications_history').insert({
        title:      title.trim(),
        message:    message.trim(),
        event_id:   eventId || null,
        sent_by:    user?.id ?? null,
        recipients: json.recipients ?? 0,
      })

      setTitle(''); setMessage(''); setEventId('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSending(false)
    }
  }

  const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white'
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-5" style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}>
        <h1 className="text-xl font-extrabold text-white">Notifications</h1>
        <p className="text-xs text-white/50 mt-0.5">Envoyer une notification push à tous les utilisateurs</p>
      </div>

      <div className="px-4 py-5 pb-24 space-y-5">

        {/* Toast succès */}
        {sent && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#DCFCE7', border: '1px solid #86EFAC' }}>
            <span className="text-xl">✅</span>
            <p className="text-sm font-semibold text-green-700">Notification envoyée avec succès !</p>
          </div>
        )}

        {/* Formulaire */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold mb-4" style={{ color: '#1D3550' }}>Nouvelle notification</h2>

          <form onSubmit={handleSend} className="space-y-4">
            {error && (
              <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label className={lbl}>Titre *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="ex: Soirée BDE ce soir !" className={inp} style={{ color: '#1D3550' }} />
            </div>

            <div>
              <label className={lbl}>Message *</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                placeholder="Détails de la notification…"
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white resize-none"
                style={{ color: '#1D3550' }} />
            </div>

            <div>
              <label className={lbl}>Lier à un événement (optionnel)</label>
              <select value={eventId} onChange={e => setEventId(e.target.value)}
                className={inp} style={{ color: '#1D3550' }}>
                <option value="">— Aucun —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>

            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#FFF4EE', border: '1px solid #FEDDCC' }}>
              <p className="text-xs font-semibold" style={{ color: '#E8622A' }}>
                ⚠️ Cette notification sera envoyée à TOUS les utilisateurs abonnés aux notifications push.
              </p>
            </div>

            <button type="submit" disabled={sending}
              className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#E8622A' }}>
              {sending ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Envoi en cours…</>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Envoyer la notification
                </>
              )}
            </button>
          </form>
        </section>

        {/* Historique */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-bold" style={{ color: '#1D3550' }}>Historique</h2>
            <p className="text-xs text-gray-400 mt-0.5">10 dernières notifications envoyées</p>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-center">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#E8622A] rounded-full animate-spin mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Aucune notification envoyée.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map(n => (
                <div key={n.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1D3550' }}>{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{n.message}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{timeAgo(n.sent_at)}</p>
                      {n.recipients > 0 && (
                        <p className="text-xs font-semibold mt-0.5" style={{ color: '#E8622A' }}>
                          {n.recipients} destinataire{n.recipients !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
