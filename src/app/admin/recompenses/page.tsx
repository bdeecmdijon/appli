'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface Reward {
  id:          string
  emoji:       string
  name:        string
  description: string | null
  points_cost: number
  stock:       number | null
  is_active:   boolean
  created_at:  string
}

// ── Modal ajout / édition ─────────────────────────────────────────────────

function RewardModal({
  reward,
  onClose,
  onSaved,
}: {
  reward:   Reward | null   // null = nouveau
  onClose:  () => void
  onSaved:  () => void
}) {
  const [emoji,       setEmoji]       = useState(reward?.emoji       ?? '🎁')
  const [name,        setName]        = useState(reward?.name        ?? '')
  const [description, setDescription] = useState(reward?.description ?? '')
  const [pointsCost,  setPointsCost]  = useState(String(reward?.points_cost ?? ''))
  const [stock,       setStock]       = useState(reward?.stock != null ? String(reward.stock) : '')
  const [isActive,    setIsActive]    = useState(reward?.is_active ?? true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim())        { setError('Le nom est obligatoire.'); return }
    if (!pointsCost || isNaN(Number(pointsCost)) || Number(pointsCost) <= 0) {
      setError('Le coût en points doit être un nombre positif.'); return
    }
    setSaving(true)
    setError(null)

    const payload = {
      emoji:       emoji.trim() || '🎁',
      name:        name.trim(),
      description: description.trim() || null,
      points_cost: Number(pointsCost),
      stock:       stock !== '' ? Number(stock) : null,
      is_active:   isActive,
    }

    const { error: dbErr } = reward
      ? await supabase.from('rewards').update(payload).eq('id', reward.id)
      : await supabase.from('rewards').insert(payload)

    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-3xl shadow-2xl p-6 max-w-sm mx-auto">
        <h3 className="text-lg font-extrabold mb-4" style={{ color: '#1D3550' }}>
          {reward ? 'Modifier la récompense' : 'Nouvelle récompense'}
        </h3>

        <div className="space-y-3">
          {/* Emoji */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Emoji</label>
            <input
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-2xl outline-none focus:border-[#E8622A]"
              maxLength={4}
              placeholder="🎁"
            />
          </div>

          {/* Nom */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Nom *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
              style={{ color: '#1D3550' }}
              placeholder="ex: Boisson offerte"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
              style={{ color: '#1D3550' }}
              placeholder="ex: Valable au bar lors des soirées BDE"
            />
          </div>

          {/* Points */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Coût (pts) *</label>
              <input
                type="number"
                value={pointsCost}
                onChange={e => setPointsCost(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                style={{ color: '#1D3550' }}
                placeholder="200"
                min={1}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Stock (vide = ∞)</label>
              <input
                type="number"
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                style={{ color: '#1D3550' }}
                placeholder="∞"
                min={0}
              />
            </div>
          </div>

          {/* Active */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
            <span className="text-sm font-semibold" style={{ color: '#1D3550' }}>Récompense active</span>
            <button
              onClick={() => setIsActive(v => !v)}
              className="relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none"
              style={{ backgroundColor: isActive ? '#E8622A' : '#D1D5DB' }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                style={{ transform: isActive ? 'translateX(26px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-3">{error}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-12 rounded-2xl font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: '#E8622A' }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function RecompensesPage() {
  const [rewards,     setRewards]     = useState<Reward[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modalReward, setModalReward] = useState<Reward | null | undefined>(undefined) // undefined = fermé, null = nouveau

  async function fetchRewards() {
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .order('points_cost', { ascending: true })
    setRewards(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchRewards() }, [])

  async function toggleActive(reward: Reward) {
    await supabase.from('rewards').update({ is_active: !reward.is_active }).eq('id', reward.id)
    setRewards(prev => prev.map(r => r.id === reward.id ? { ...r, is_active: !r.is_active } : r))
  }

  async function deleteReward(reward: Reward) {
    if (!confirm(`Supprimer "${reward.name}" ? Cette action est irréversible.`)) return
    await supabase.from('rewards').delete().eq('id', reward.id)
    setRewards(prev => prev.filter(r => r.id !== reward.id))
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-5">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: '#1D3550' }}>Récompenses</h1>
            <p className="text-sm text-gray-400 mt-0.5">{rewards.length} récompense{rewards.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setModalReward(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-[0.97]"
            style={{ backgroundColor: '#E8622A' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 py-5 max-w-2xl mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-white animate-pulse" />
            ))}
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🎁</div>
            <p className="font-bold text-lg" style={{ color: '#1D3550' }}>Aucune récompense</p>
            <p className="text-sm text-gray-400 mt-1">Crée ta première récompense pour commencer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rewards.map(reward => (
              <div
                key={reward.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0 mt-0.5">{reward.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-extrabold" style={{ color: '#1D3550' }}>{reward.name}</p>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: reward.is_active ? '#DCFCE7' : '#F3F4F6',
                          color:           reward.is_active ? '#16A34A' : '#9CA3AF',
                        }}
                      >
                        {reward.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    {reward.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{reward.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm font-extrabold" style={{ color: '#E8622A' }}>
                        {reward.points_cost} pts
                      </span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400">
                        Stock : {reward.stock != null ? reward.stock : '∞'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => toggleActive(reward)}
                    className="flex-1 h-9 rounded-xl text-xs font-bold border border-gray-200 transition active:scale-[0.97]"
                    style={{ color: reward.is_active ? '#DC2626' : '#16A34A' }}
                  >
                    {reward.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => setModalReward(reward)}
                    className="flex-1 h-9 rounded-xl text-xs font-bold border border-gray-200 transition active:scale-[0.97]"
                    style={{ color: '#1D3550' }}
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => deleteReward(reward)}
                    className="w-9 h-9 rounded-xl border border-red-100 flex items-center justify-center transition active:scale-[0.97]"
                    style={{ color: '#DC2626', backgroundColor: '#FEF2F2' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalReward !== undefined && (
        <RewardModal
          reward={modalReward}
          onClose={() => setModalReward(undefined)}
          onSaved={() => { setModalReward(undefined); fetchRewards() }}
        />
      )}
    </div>
  )
}
