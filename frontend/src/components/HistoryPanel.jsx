import { useState, useEffect, useCallback } from 'react'

const LIMIT = 10

function VideoDownloadBtn({ api, id, lang }) {
  const [state, setState] = useState('idle') // idle | loading | error

  async function handleDownload(e) {
    e.stopPropagation()
    setState('loading')
    try {
      const res = await fetch(`${api}/api/subtitle-video/${id}?lang=${lang}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Erreur')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `khotba-${lang === 'arabic' ? 'arabe' : 'francais'}-${id.slice(0, 8)}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const label = lang === 'arabic' ? 'AR' : 'FR'
  const title = lang === 'arabic' ? 'Télécharger vidéo (sous-titres arabes)' : 'Télécharger vidéo (sous-titres français)'

  return (
    <button
      onClick={handleDownload}
      disabled={state === 'loading'}
      title={title}
      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 text-xs font-bold
        ${state === 'error'
          ? 'text-red-500 bg-red-50'
          : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100'
        }
        disabled:opacity-50`}
    >
      {state === 'loading' ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : state === 'error' ? (
        '!'
      ) : (
        <span className="flex items-center gap-0.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {label}
        </span>
      )}
    </button>
  )
}

function Spinner({ className = 'w-6 h-6' }) {
  return (
    <svg className={`animate-spin text-indigo-600 ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryPanel({ api, open, onClose, onSelect }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [loadingItemId, setLoadingItemId] = useState(null)

  const fetchHistory = useCallback(
    async (p = 1, replace = true) => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${api}/api/history?page=${p}&limit=${LIMIT}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Erreur')
        setTotal(data.total)
        setItems(prev => (replace ? data.items : [...prev, ...data.items]))
        setPage(p)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  useEffect(() => {
    if (open) fetchHistory(1, true)
  }, [open, fetchHistory])

  async function handleDelete(e, id) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      const res = await fetch(`${api}/api/history/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Suppression échouée')
      setItems(prev => prev.filter(i => i.id !== id))
      setTotal(t => t - 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSelect(item) {
    setLoadingItemId(item.id)
    try {
      const res = await fetch(`${api}/api/history/${item.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erreur')
      onSelect(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingItemId(null)
    }
  }

  const hasMore = items.length < total

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Historique</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}

          {loading && items.length === 0 && (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">Aucune analyse enregistrée</p>
            </div>
          )}

          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className="border border-gray-200 rounded-xl p-3 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all group"
              >
                <div className="flex items-start gap-3">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt=""
                      className="w-20 h-12 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-12 bg-gray-200 rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate leading-tight">
                      {item.video_title}
                    </p>
                    <p className="text-xs text-indigo-600 mt-0.5">{item.time_range}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDate(item.created_at)}
                      {item.total_cost_usd != null && (
                        <span className="ml-1.5 font-mono text-gray-400">· ${item.total_cost_usd.toFixed(4)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {item.has_timestamps && (
                      <>
                        <VideoDownloadBtn api={api} id={item.id} lang="arabic" />
                        <VideoDownloadBtn api={api} id={item.id} lang="french" />
                      </>
                    )}
                    <button
                      onClick={e => handleDelete(e, item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {deletingId === item.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {loadingItemId === item.id && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-indigo-600">
                    <Spinner className="w-3 h-3" />
                    Chargement...
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => fetchHistory(page + 1, false)}
              disabled={loading}
              className="w-full mt-4 py-2 text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Chargement...' : `Charger plus (${total - items.length} restants)`}
            </button>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-400 text-center">
          {total} analyse(s) enregistrée(s)
        </div>
      </div>
    </>
  )
}
