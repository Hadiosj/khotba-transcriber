import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Tabs from './Tabs'
import { fmtTime } from '../utils/time'

const API = import.meta.env.VITE_API_BASE_URL || ''

function SegmentList({ segments, isRTL }) {
  return (
    <div className="space-y-2">
      {segments.map((seg, i) => (
        <div
          key={i}
          className={`flex gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <span className="text-xs text-gray-400 font-mono mt-0.5 flex-shrink-0 whitespace-nowrap">
            {fmtTime(seg.start)}
          </span>
          <p
            className={`text-sm text-gray-800 leading-relaxed flex-1 ${isRTL ? 'text-right font-arabic' : ''}`}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {seg.text}
          </p>
        </div>
      ))}
    </div>
  )
}

function DownloadButton({ text, filename }) {
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
      Télécharger .txt
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
  const [state, setState] = useState('idle') // idle | loading | error
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
      {state === 'error' && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {state === 'loading' && (
        <p className="text-xs text-gray-400">Cela peut prendre plusieurs minutes...</p>
      )}
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
    {
      label: 'Gemini (article)',
      detail: costs.article_input_tokens
        ? `${costs.article_input_tokens.toLocaleString()}↑ ${costs.article_output_tokens.toLocaleString()}↓ tokens`
        : null,
      cost: costs.article_cost_usd,
    },
  ]

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
              {row.detail && (
                <span className="text-gray-400 font-mono">{row.detail}</span>
              )}
            </span>
            <span className="font-mono tabular-nums">{fmtCost(row.cost)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400 italic">Estimations basées sur les tarifs publics des APIs.</p>
    </div>
  )
}

const TABS = [
  { id: 'arabic', label: 'Transcription arabe' },
  { id: 'french', label: 'Traduction française' },
  { id: 'article', label: 'Article' },
]

export default function ResultsPanel({ results, videoInfo, range, onReset }) {
  const [activeTab, setActiveTab] = useState('arabic')

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

      {/* Video download with subtitles — only when timestamps were included */}
      {results.includeTimestamps && results.analysisId && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Télécharger la vidéo avec sous-titres</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <VideoDownloadButton
              analysisId={results.analysisId}
              lang="arabic"
              label="Sous-titres arabes"
            />
            <VideoDownloadButton
              analysisId={results.analysisId}
              lang="french"
              label="Sous-titres français"
            />
          </div>
        </div>
      )}

      {/* Cost breakdown */}
      <CostBreakdown costs={results.costs} />

      {/* Results tabs */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div className="p-6">
          {activeTab === 'arabic' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-500">
                  {results.includeTimestamps
                    ? `${results.arabicSegments.length} segment(s)`
                    : 'Texte intégral'}
                </span>
                <DownloadButton text={results.arabicText} filename="transcription-arabe.txt" />
              </div>
              {results.includeTimestamps ? (
                <>
                  <SegmentList segments={results.arabicSegments} isRTL={true} />
                  {results.arabicSegments.length === 0 && (
                    <p className="text-center text-gray-400 py-8" dir="rtl">لا توجد نصوص</p>
                  )}
                </>
              ) : (
                <p
                  className="text-sm text-gray-800 leading-relaxed font-arabic text-right"
                  dir="rtl"
                >
                  {results.arabicText}
                </p>
              )}
            </div>
          )}

          {activeTab === 'french' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-500">
                  {results.includeTimestamps
                    ? `${results.frenchSegments.length} segment(s)`
                    : 'Texte intégral'}
                </span>
                <DownloadButton text={results.frenchText} filename="traduction-francaise.txt" />
              </div>
              {results.includeTimestamps ? (
                <>
                  <SegmentList segments={results.frenchSegments} isRTL={false} />
                  {results.frenchSegments.length === 0 && (
                    <p className="text-center text-gray-400 py-8">Aucune traduction disponible</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-800 leading-relaxed">
                  {results.frenchText}
                </p>
              )}
            </div>
          )}

          {activeTab === 'article' && (
            <div>
              <div className="flex justify-end gap-2 mb-4">
                <CopyButton text={results.articleMarkdown} />
                <DownloadButton text={results.articleMarkdown} filename="article.md" />
              </div>
              <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-blockquote:border-indigo-300 prose-blockquote:text-gray-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {results.articleMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
