import { useState, useEffect, useRef } from 'react'
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

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.icon && opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function sanitizeFilename(name) {
  return (name || 'khotba')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'khotba'
}

function fmtCost(usd) {
  if (usd == null || usd === 0) return '$0.00'
  if (usd < 0.0001) return `$${usd.toFixed(6)}`
  return `$${usd.toFixed(4)}`
}

function CostBadge({ costs }) {
  const [show, setShow] = useState(false)
  if (!costs) return null

  const rows = [
    {
      label: 'Whisper',
      detail: costs.whisper_audio_seconds ? `${Math.round(costs.whisper_audio_seconds)}s` : null,
      cost: costs.whisper_cost_usd,
    },
    {
      label: 'Gemini (traduction)',
      detail: costs.translation_input_tokens
        ? `${costs.translation_input_tokens.toLocaleString()}↑ ${costs.translation_output_tokens.toLocaleString()}↓`
        : null,
      cost: costs.translation_cost_usd,
    },
  ]
  if (costs.article_cost_usd > 0 || costs.article_input_tokens > 0) {
    rows.push({
      label: 'Gemini (article)',
      detail: costs.article_input_tokens
        ? `${costs.article_input_tokens.toLocaleString()}↑ ${costs.article_output_tokens.toLocaleString()}↓`
        : null,
      cost: costs.article_cost_usd,
    })
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="flex items-center gap-1 text-xs text-gray-400 cursor-help border-b border-dashed border-gray-300 select-none">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {fmtCost(costs.total_cost_usd)}
      </span>
      {show && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50">
          <p className="text-xs font-semibold text-gray-600 mb-2">Coût estimé de l'analyse</p>
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
            <div className="pt-1.5 mt-1.5 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Total</span>
              <span className="font-mono tabular-nums">{fmtCost(costs.total_cost_usd)}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400 italic">Estimations basées sur les tarifs publics des APIs.</p>
        </div>
      )}
    </div>
  )
}

function SubtitleEditor({ analysisId, videoTitle }) {
  const [lang, setLang] = useState('arabic')
  const [textColor, setTextColor] = useState('white')
  const [background, setBackground] = useState(false)
  const [state, setState] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [generatedLang, setGeneratedLang] = useState(null)
  const [generatedSettings, setGeneratedSettings] = useState(null)
  const prevUrlRef = useRef(null)

  useEffect(() => {
    return () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current) }
  }, [])

  const settingsChanged = state === 'ready' && generatedSettings && (
    lang !== generatedSettings.lang ||
    textColor !== generatedSettings.textColor ||
    background !== generatedSettings.background
  )

  async function handleGenerate() {
    setState('loading')
    setError('')
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current)
      prevUrlRef.current = null
      setPreviewUrl(null)
    }
    try {
      const params = new URLSearchParams({
        lang,
        text_color: textColor,
        background: background.toString(),
        inline: 'true',
      })
      const res = await fetch(`${API}/api/subtitle-video/${analysisId}?${params}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Échec de la génération vidéo')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      prevUrlRef.current = url
      setPreviewUrl(url)
      setGeneratedLang(lang)
      setGeneratedSettings({ lang, textColor, background })
      setState('ready')
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  function handleDownload() {
    if (!previewUrl) return
    const langLabel = (generatedLang || lang) === 'arabic' ? 'arabe' : 'francais'
    const safeTitle = sanitizeFilename(videoTitle)
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `${safeTitle}-${langLabel}.mp4`
    a.click()
  }

  function handleDownloadSrt() {
    const langLabel = lang === 'arabic' ? 'arabe' : 'francais'
    const safeTitle = sanitizeFilename(videoTitle)
    const a = document.createElement('a')
    a.href = `${API}/api/subtitle-srt/${analysisId}?lang=${lang}`
    a.download = `${safeTitle}-${langLabel}.srt`
    a.click()
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Vidéo sous-titrée</p>
            <p className="text-xs text-gray-400">Personnalisez le style et prévisualisez avant de télécharger</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state === 'ready' && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Télécharger
            </button>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Langue</p>
            <SegmentedControl
              value={lang}
              onChange={setLang}
              options={[
                { value: 'arabic', label: 'Arabe' },
                { value: 'french', label: 'Français' },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Couleur du texte</p>
            <SegmentedControl
              value={textColor}
              onChange={setTextColor}
              options={[
                {
                  value: 'white',
                  label: 'Blanc',
                  icon: <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300 flex-shrink-0" />,
                },
                {
                  value: 'black',
                  label: 'Noir',
                  icon: <span className="w-2.5 h-2.5 rounded-full bg-gray-900 flex-shrink-0" />,
                },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Fond</p>
            <SegmentedControl
              value={background ? 'on' : 'off'}
              onChange={v => setBackground(v === 'on')}
              options={[
                { value: 'off', label: 'Sans fond' },
                { value: 'on', label: 'Avec fond' },
              ]}
            />
          </div>
        </div>

        {/* Action row */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={state === 'loading'}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors shadow-sm"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {state === 'ready' ? "Régénérer l'aperçu" : "Générer l'aperçu"}
              </>
            )}
          </button>

          {state === 'loading' && (
            <p className="text-xs text-gray-400">Cela peut prendre quelques minutes...</p>
          )}
          {state === 'error' && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          )}
          {settingsChanged && (
            <p className="text-xs text-amber-500 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Paramètres modifiés — régénérez pour mettre à jour
            </p>
          )}
        </div>
      </div>

      {/* Video preview */}
      {previewUrl && (
        <div className="border-t">
          <div className="px-5 py-2.5 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Aperçu</span>
            {generatedSettings && (
              <span className="text-xs text-gray-400">
                {generatedSettings.lang === 'arabic' ? 'Arabe' : 'Français'} · texte {generatedSettings.textColor === 'white' ? 'blanc' : 'noir'} · {generatedSettings.background ? 'avec fond' : 'sans fond'}
              </span>
            )}
          </div>
          <div className="bg-black">
            <video src={previewUrl} controls className="w-full max-h-[28rem]" />
          </div>
        </div>
      )}
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

  const videoTitle = videoInfo?.title || 'khotba'
  const safeTitle = sanitizeFilename(videoTitle)

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
      if (!res.ok) throw new Error("Échec de l'enregistrement")
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

  async function downloadSrtForLang(lang) {
    const langLabel = lang === 'arabic' ? 'arabe' : 'francais'
    const res = await fetch(`${API}/api/subtitle-srt/${results.analysisId}?lang=${lang}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeTitle}-${langLabel}.srt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function downloadTxtForLang(lang) {
    const text = lang === 'arabic'
      ? (results.includeTimestamps ? arabicSegs.map(s => s.text).join('\n') : arabicText)
      : (results.includeTimestamps ? frenchSegs.map(s => s.text).join('\n') : frenchText)
    const langLabel = lang === 'arabic' ? 'arabe' : 'francais'
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeTitle}-${langLabel}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

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
      <div className="flex items-center gap-1.5">
        {status === 'saved' && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Enregistré
          </span>
        )}
        <button
          onClick={() => downloadTxtForLang(lang)}
          title="Télécharger .txt"
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          .txt
        </button>
        {results.includeTimestamps && results.analysisId && (
          <button
            onClick={() => downloadSrtForLang(lang)}
            title="Télécharger .srt"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            .srt
          </button>
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
              Segment : {fmtTime(range.start)} – {fmtTime(range.end)}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <CostBadge costs={costs} />
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Nouvelle analyse
            </button>
          </div>
        </div>
      )}

      {/* Subtitle video editor — only for fresh analyses (not history) */}
      {results.includeTimestamps && results.analysisId && !results.fromHistory && (
        <SubtitleEditor analysisId={results.analysisId} videoTitle={videoTitle} />
      )}
      {results.includeTimestamps && results.fromHistory && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-gray-500">
          <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          La génération de vidéo sous-titrée n'est disponible que lors d'une analyse en cours. Les sous-titres (.srt) restent téléchargeables ci-dessous.
        </div>
      )}

      {/* Side-by-side transcription + translation */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b flex items-center bg-gray-50">
          <span className="text-sm text-gray-500">
            {results.includeTimestamps ? `${arabicSegs.length} segment(s)` : 'Texte intégral'}
          </span>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 border-b">
          <div className="px-4 py-2 border-r flex items-center justify-between gap-2 bg-gray-50/50">
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
              <DownloadButton text={articleMarkdown} filename={`${safeTitle}-article.md`} label="↓ .md" />
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
