import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fmtTime } from '../utils/time'

const API = import.meta.env.VITE_API_BASE_URL || ''

function DownloadButton({ text, filename, label }) {
  function handleDownload() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </button>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copié !
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copier
        </>
      )}
    </button>
  )
}

function VideoDownloadButton({ analysisId, lang, label }) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  async function handleDownload() {
    setState('loading')
    setError('')
    try {
      const res = await fetch(`${API}/api/subtitle-video/${analysisId}?lang=${lang}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Échec de la génération vidéo')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `khotba-${lang === 'arabic' ? 'arabe' : 'francais'}-${analysisId.slice(0, 8)}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      setState('idle')
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleDownload}
        disabled={state === 'loading'}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors"
      >
        {state === 'loading' ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Génération en cours...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            {label}
          </>
        )}
      </button>
      {state === 'error' && <p className="text-xs text-red-600">{error}</p>}
      {state === 'loading' && <p className="text-xs text-gray-400">Cela peut prendre plusieurs minutes...</p>}
    </div>
  )
}

function fmtCost(usd) {
  if (usd == null || usd === 0) return '$0.00'
  if (usd < 0.0001) return `$${usd.toFixed(6)}`
  return `$${usd.toFixed(4)}`
}

function CostBreakdown({ costs }) {
  if (!costs) return null

  const rows = [
    {
      label: 'Whisper (transcription)',
      detail: costs.whisper_audio_seconds ? `${Math.round(costs.whisper_audio_seconds)}s audio` : null,
      cost: costs.whisper_cost_usd,
    },
    {
      label: 'Gemini (traduction)',
      detail: costs.translation_input_tokens
        ? `${costs.translation_input_tokens.toLocaleString()}↑ ${costs.translation_output_tokens.toLocaleString()}↓ tokens`
        : null,
      cost: costs.translation_cost_usd,
    },
  ]

  // Only show article cost row when the article has been generated
  if (costs.article_cost_usd > 0 || costs.article_input_tokens > 0) {
    rows.push({
      label: 'Gemini (article)',
      detail: costs.article_input_tokens
        ? `${costs.article_input_tokens.toLocaleString()}↑ ${costs.article_output_tokens.toLocaleString()}↓ tokens`
        : null,
      cost: costs.article_cost_usd,
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium text-gray-700">Coût estimé de l'analyse</span>
        <span className="ml-auto text-sm font-semibold text-gray-800">{fmtCost(costs.total_cost_usd)}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              {row.label}
              {row.detail && <span className="text-gray-400 font-mono">{row.detail}</span>}
            </span>
            <span className="font-mono tabular-nums">{fmtCost(row.cost)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400 italic">Estimations basées sur les tarifs publics des APIs.</p>
    </div>
  )
}

export default function ResultsPanel({ results, videoInfo, range, onReset }) {
  const [arabicSegs, setArabicSegs] = useState(() => results.arabicSegments || [])
  const [frenchSegs, setFrenchSegs] = useState(() => results.frenchSegments || [])
  const [arabicText, setArabicText] = useState(() => results.arabicText || '')
  const [frenchText, setFrenchText] = useState(() => results.frenchText || '')

  // Edit mode: null | 'arabic' | 'french'
  const [editMode, setEditMode] = useState(null)
  const [cancelSnapshot, setCancelSnapshot] = useState(null)
  const [saveStatus, setSaveStatus] = useState({ arabic: 'idle', french: 'idle' })

  // Article state
  const [articleMarkdown, setArticleMarkdown] = useState(() => results.articleMarkdown || null)
  const [articleState, setArticleState] = useState('idle') // 'idle' | 'loading' | 'error'
  const [articleError, setArticleError] = useState('')

  // Costs state (updated when article is generated)
  const [costs, setCosts] = useState(() => results.costs || null)

  function enterEdit(lang) {
    setCancelSnapshot({ arabicSegs: [...arabicSegs], frenchSegs: [...frenchSegs], arabicText, frenchText })
    setEditMode(lang)
    setSaveStatus(s => ({ ...s, [lang]: 'idle' }))
  }

  function cancelEdit() {
    if (cancelSnapshot) {
      setArabicSegs(cancelSnapshot.arabicSegs)
      setFrenchSegs(cancelSnapshot.frenchSegs)
      setArabicText(cancelSnapshot.arabicText)
      setFrenchText(cancelSnapshot.frenchText)
    }
    setEditMode(null)
  }

  async function saveEdits(lang) {
    setSaveStatus(s => ({ ...s, [lang]: 'saving' }))
    const body = {}
    if (results.includeTimestamps) {
      if (lang === 'arabic') body.arabic_segments = arabicSegs
      else body.french_segments = frenchSegs
    } else {
      if (lang === 'arabic') body.arabic_text = arabicText
      else body.french_text = frenchText
    }
    try {
      const res = await fetch(`${API}/api/history/${results.analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Échec de l\'enregistrement')
      const data = await res.json()
      // When Arabic was saved, the backend retranslated — update French state
      if (lang === 'arabic') {
        if (data.french_segments) setFrenchSegs(data.french_segments)
        if (data.french_text) setFrenchText(data.french_text)
      }
      setSaveStatus(s => ({ ...s, [lang]: 'saved' }))
      setEditMode(null)
      setTimeout(() => setSaveStatus(s => ({ ...s, [lang]: 'idle' })), 3000)
    } catch {
      setSaveStatus(s => ({ ...s, [lang]: 'error' }))
    }
  }

  async function handleGenerateArticle() {
    setArticleState('loading')
    setArticleError('')
    try {
      const sourceText = results.includeTimestamps
        ? arabicSegs.map(s => s.text).join(' ')
        : arabicText
      const res = await fetch(`${API}/api/generate-article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arabic_text: sourceText,
          analysis_id: results.analysisId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Échec de la génération')
      }
      const data = await res.json()
      setArticleMarkdown(data.article_markdown)
      if (data.costs) {
        setCosts(prev => prev ? {
          ...prev,
          article_input_tokens: data.costs.article_input_tokens,
          article_output_tokens: data.costs.article_output_tokens,
          article_cost_usd: data.costs.article_cost_usd,
          total_cost_usd: (prev.total_cost_usd || 0) + (data.costs.article_cost_usd || 0),
        } : null)
      }
      setArticleState('idle')
    } catch (err) {
      setArticleError(err.message)
      setArticleState('error')
    }
  }

  const downloadArabicText = results.includeTimestamps
    ? arabicSegs.map(s => s.text).join('\n')
    : arabicText
  const downloadFrenchText = results.includeTimestamps
    ? frenchSegs.map(s => s.text).join('\n')
    : frenchText

  function EditControls({ lang }) {
    const isEditing = editMode === lang
    const otherEditing = editMode !== null && editMode !== lang
    const status = saveStatus[lang]

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={cancelEdit}
            className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => saveEdits(lang)}
            disabled={status === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors"
          >
            {status === 'saving' ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {lang === 'arabic' ? 'Traduction...' : 'Enregistrement...'}
              </>
            ) : 'Enregistrer'}
          </button>
          {status === 'error' && <span className="text-xs text-red-600">Erreur</span>}
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        {status === 'saved' && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Enregistré
          </span>
        )}
        {results.analysisId && !otherEditing && (
          <button
            onClick={() => enterEdit(lang)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Modifier
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Video info strip */}
      {videoInfo && (
        <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4">
          {videoInfo.thumbnail_url && (
            <img src={videoInfo.thumbnail_url} alt="" className="w-20 h-12 object-cover rounded" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 truncate">{videoInfo.title}</p>
            <p className="text-xs text-gray-500">
              Segment: {fmtTime(range.start)} – {fmtTime(range.end)}
            </p>
          </div>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Nouvelle analyse
          </button>
        </div>
      )}

      {/* Subtitle video download — only when timestamps were included */}
      {results.includeTimestamps && results.analysisId && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Télécharger la vidéo avec sous-titres</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <VideoDownloadButton analysisId={results.analysisId} lang="arabic" label="Sous-titres arabes" />
            <VideoDownloadButton analysisId={results.analysisId} lang="french" label="Sous-titres français" />
          </div>
        </div>
      )}

      {/* Cost breakdown */}
      <CostBreakdown costs={costs} />

      {/* Side-by-side transcription + translation */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-gray-50">
          <span className="text-sm text-gray-500">
            {results.includeTimestamps ? `${arabicSegs.length} segment(s)` : 'Texte intégral'}
          </span>
          <div className="flex items-center gap-2">
            <DownloadButton text={downloadArabicText} filename="transcription-arabe.txt" label="↓ Arabe .txt" />
            <DownloadButton text={downloadFrenchText} filename="traduction-francaise.txt" label="↓ Français .txt" />
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 border-b">
          <div className="px-4 py-2 border-r flex items-center justify-between gap-2 bg-gray-50/50" dir="rtl">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">عربي</span>
            <EditControls lang="arabic" />
          </div>
          <div className="px-4 py-2 flex items-center justify-between gap-2 bg-gray-50/50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Français</span>
            <EditControls lang="french" />
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {results.includeTimestamps ? (
            <div className="space-y-2">
              {arabicSegs.map((seg, i) => (
                <div key={i} className="rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden">
                  <div className="px-3 pt-2">
                    <span className="text-xs text-gray-400 font-mono">{fmtTime(seg.start)}</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x">
                    <div className="p-3">
                      {editMode === 'arabic' ? (
                        <textarea
                          value={seg.text}
                          onChange={e => {
                            const updated = arabicSegs.map((s, j) => j === i ? { ...s, text: e.target.value } : s)
                            setArabicSegs(updated)
                          }}
                          className="w-full text-sm text-gray-800 leading-relaxed font-arabic border border-indigo-300 rounded px-2 py-1 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          dir="rtl"
                          rows={2}
                        />
                      ) : (
                        <p className="text-sm text-gray-800 leading-relaxed font-arabic text-right" dir="rtl">
                          {seg.text}
                        </p>
                      )}
                    </div>
                    <div className="p-3">
                      {editMode === 'french' ? (
                        <textarea
                          value={frenchSegs[i]?.text || ''}
                          onChange={e => {
                            const updated = frenchSegs.map((s, j) => j === i ? { ...s, text: e.target.value } : s)
                            setFrenchSegs(updated)
                          }}
                          className="w-full text-sm text-gray-800 leading-relaxed border border-indigo-300 rounded px-2 py-1 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          rows={2}
                        />
                      ) : (
                        <p className="text-sm text-gray-800 leading-relaxed">
                          {frenchSegs[i]?.text || ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {arabicSegs.length === 0 && (
                <p className="text-center text-gray-400 py-8">Aucun contenu disponible</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-0 divide-x rounded-lg bg-gray-50 overflow-hidden">
              <div className="p-4">
                {editMode === 'arabic' ? (
                  <textarea
                    value={arabicText}
                    onChange={e => setArabicText(e.target.value)}
                    className="w-full text-sm text-gray-800 leading-relaxed font-arabic border border-indigo-300 rounded px-3 py-2 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    dir="rtl"
                    rows={10}
                  />
                ) : (
                  <p className="text-sm text-gray-800 leading-relaxed font-arabic text-right" dir="rtl">
                    {arabicText}
                  </p>
                )}
              </div>
              <div className="p-4">
                {editMode === 'french' ? (
                  <textarea
                    value={frenchText}
                    onChange={e => setFrenchText(e.target.value)}
                    className="w-full text-sm text-gray-800 leading-relaxed border border-indigo-300 rounded px-3 py-2 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    rows={10}
                  />
                ) : (
                  <p className="text-sm text-gray-800 leading-relaxed">{frenchText}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Article section */}
      {!articleMarkdown ? (
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-500">Générer un article structuré en français à partir de la transcription</p>
          <button
            onClick={handleGenerateArticle}
            disabled={articleState === 'loading'}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors"
          >
            {articleState === 'loading' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Génération en cours...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Générer l'article
              </>
            )}
          </button>
          {articleState === 'error' && (
            <p className="text-xs text-red-600">{articleError}</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Article</span>
            <div className="flex gap-2">
              <CopyButton text={articleMarkdown} />
              <DownloadButton text={articleMarkdown} filename="article.md" label="↓ .md" />
            </div>
          </div>
          <div className="p-6 prose prose-sm max-w-none prose-headings:text-gray-800 prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-blockquote:border-indigo-300 prose-blockquote:text-gray-600">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {articleMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
