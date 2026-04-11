'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

// ── Types ──────────────────────────────────────────────────────────────────

interface BdeMember {
  id:         string
  first_name: string
  last_name:  string
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdherentsPage() {
  const [members,   setMembers]   = useState<BdeMember[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [search,    setSearch]    = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchMembers() {
    const { data } = await supabase
      .from('bde_members')
      .select('id, first_name, last_name, created_at')
      .order('last_name', { ascending: true })
    setMembers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchMembers() }, [])

  // ── Import Excel ──────────────────────────────────────────────────────────

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    try {
      const buffer = await file.arrayBuffer()
      const wb     = XLSX.read(buffer, { type: 'array' })
      const ws     = wb.Sheets[wb.SheetNames[0]]
      const rows   = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

      if (rows.length === 0) {
        flash('Le fichier est vide.', false)
        return
      }

      const keys      = Object.keys(rows[0])
      const prenomKey = keys.find(k => normalize(k).includes('prenom') || normalize(k).includes('prénom')) ?? ''
      const nomKey    = keys.find(k => normalize(k) === 'nom') ?? ''

      if (!prenomKey || !nomKey) {
        flash(`Colonnes introuvables. Clés détectées : ${keys.join(', ')}`, false)
        return
      }

      const inserts = rows
        .map(r => ({
          first_name: String(r[prenomKey] ?? '').trim(),
          last_name:  String(r[nomKey]    ?? '').trim(),
        }))
        .filter(r => r.first_name && r.last_name)

      if (inserts.length === 0) {
        flash('Aucune ligne valide dans le fichier.', false)
        return
      }

      const { error } = await supabase.from('bde_members').insert(inserts)
      if (error) {
        flash(`Erreur : ${error.message}`, false)
      } else {
        flash(`${inserts.length} adhérent${inserts.length > 1 ? 's' : ''} importé${inserts.length > 1 ? 's' : ''}.`)
        await fetchMembers()
      }
    } catch (err) {
      console.error('[adherents] file error:', err)
      flash('Erreur lors de la lecture du fichier.', false)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeleteId(id)
    const { error } = await supabase.from('bde_members').delete().eq('id', id)
    if (error) {
      flash(`Erreur : ${error.message}`, false)
    } else {
      setMembers(prev => prev.filter(m => m.id !== id))
      flash('Adhérent supprimé.')
    }
    setDeleteId(null)
  }

  // ── Filtrage ──────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? members.filter(m =>
        normalize(`${m.first_name} ${m.last_name}`).includes(normalize(search)) ||
        normalize(`${m.last_name} ${m.first_name}`).includes(normalize(search))
      )
    : members

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-5 py-8">

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl whitespace-nowrap"
          style={{ backgroundColor: toast.ok ? '#1D3550' : '#DC2626' }}
        >
          {toast.msg}
        </div>
      )}

      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold" style={{ color: '#1D3550' }}>
          ⭐ Adhérents BDE
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {members.length} adhérent{members.length !== 1 ? 's' : ''} enregistré{members.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Import Excel */}
      <div
        className="rounded-2xl p-5 mb-5 border-2 border-dashed"
        style={{ borderColor: '#E8622A40', backgroundColor: '#FFF4EE' }}
      >
        <p className="text-sm font-bold mb-1" style={{ color: '#1D3550' }}>Importer un fichier Excel</p>
        <p className="text-xs text-gray-500 mb-4">
          Fichier <strong>.xlsx</strong> avec colonnes <strong>Prénom</strong> et <strong>Nom</strong>. Les doublons sont autorisés — vérifiez avant import.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="hidden"
          id="excel-input"
        />
        <label
          htmlFor="excel-input"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition active:scale-[0.97]"
          style={{ backgroundColor: uploading ? '#9CA3AF' : '#E8622A', pointerEvents: uploading ? 'none' : 'auto' }}
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Import en cours…
            </>
          ) : (
            '📂 Choisir un fichier .xlsx'
          )}
        </label>
      </div>

      {/* Recherche */}
      {members.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un adhérent…"
            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition"
            style={{ color: '#1D3550' }}
          />
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-10 text-center">
          <p className="text-3xl mb-3">👥</p>
          <p className="text-sm font-semibold text-gray-500">Aucun adhérent enregistré</p>
          <p className="text-xs text-gray-300 mt-1">Importe un fichier Excel pour commencer.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-400">Aucun résultat pour « {search} »</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div
              key={m.id}
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-gray-100"
            >
              <div>
                <p className="text-sm font-bold" style={{ color: '#1D3550' }}>
                  {m.first_name} {m.last_name.toUpperCase()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Ajouté le {formatDate(m.created_at)}</p>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                disabled={deleteId === m.id}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-[0.95] disabled:opacity-40"
                style={{ backgroundColor: '#FEE2E2' }}
              >
                {deleteId === m.id ? (
                  <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
