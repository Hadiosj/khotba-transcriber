import { useState } from 'react'

export default function UrlInput({ api, onSuccess }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmed = url.trim()
    if (!trimmed) {
      setError('Veuillez entrer une URL YouTube.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${api}/api/video/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Impossible de charger la vidéo.')
        return
      }
      onSuccess(data, trimmed)
    } catch (err) {
      setError('Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL YouTube
        </label>
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Chargement...
          </>
        ) : (
          'Charger la vidéo'
        )}
      </button>
    </form>
  )
}
