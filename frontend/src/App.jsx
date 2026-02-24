import { useState } from 'react'
import UrlInput from './components/UrlInput'
import TimeRangePicker from './components/TimeRangePicker'
import ResultsPanel from './components/ResultsPanel'
import HistoryPanel from './components/HistoryPanel'

const API = import.meta.env.VITE_API_BASE_URL || ''

const STEPS = {
  URL: 'url',
  TIME: 'time',
  PROCESSING: 'processing',
  RESULTS: 'results',
}

const PIPELINE_STEPS = [
  { id: 'extract', label: 'Extraction audio' },
  { id: 'whisper', label: 'Transcription Whisper' },
  { id: 'translate', label: 'Traduction en français' },
  { id: 'article', label: 'Génération article' },
]

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  if (seconds === 0) return `${minutes}min`
  return `${minutes}min ${seconds}s`
}

function fmtCost(usd) {
  if (usd == null) return null
  if (usd === 0) return '$0.00'
  if (usd < 0.0001) return `$${usd.toFixed(6)}`
  return `$${usd.toFixed(4)}`
}

export default function App() {
  const [step, setStep] = useState(STEPS.URL)
  const [videoInfo, setVideoInfo] = useState(null)
  const [url, setUrl] = useState('')
  const [range, setRange] = useState({ start: 0, end: 0 })
  const [processingSteps, setProcessingSteps] = useState(
    PIPELINE_STEPS.map(s => ({ ...s, status: 'pending', duration: null, cost: null }))
  )
  const [results, setResults] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [processingError, setProcessingError] = useState(null)
  const [includeTimestamps, setIncludeTimestamps] = useState(true)

  async function handleTranscribeAndTranslate() {
    setStep(STEPS.PROCESSING)
    setProcessingSteps(PIPELINE_STEPS.map(s => ({ ...s, status: 'pending', duration: null, cost: null })))
    setProcessingError(null)
    setResults(null)

    try {
      // Step 1: Extract audio + Whisper transcription (combined backend call)
      setProcessingSteps(prev => prev.map(s => s.id === 'extract' ? { ...s, status: 'active' } : s))
      const extractStart = Date.now()
      const transcribeRes = await fetch(`${API}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          start_seconds: range.start,
          end_seconds: range.end,
          include_timestamps: includeTimestamps,
        }),
      })

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json()
        throw new Error(err.detail || 'Transcription failed')
      }

      const extractDuration = Date.now() - extractStart

      // Step 2: Parse transcription JSON
      setProcessingSteps(prev => prev.map(s => {
        if (s.id === 'extract') return { ...s, status: 'done', duration: extractDuration }
        if (s.id === 'whisper') return { ...s, status: 'active' }
        return s
      }))
      const whisperStart = Date.now()
      const transcribeData = await transcribeRes.json()
      const whisperDuration = Date.now() - whisperStart

      // Step 3: Translate (send whisper cost so it can be stored in DB)
      setProcessingSteps(prev => prev.map(s => {
        if (s.id === 'whisper') return { ...s, status: 'done', duration: whisperDuration, cost: transcribeData.whisper_cost_usd ?? null }
        if (s.id === 'translate') return { ...s, status: 'active' }
        return s
      }))
      const translateStart = Date.now()
      const translateRes = await fetch(`${API}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: transcribeData.segments,
          arabic_text: transcribeData.full_text,
          youtube_url: url,
          video_title: videoInfo.title,
          thumbnail_url: videoInfo.thumbnail_url,
          start_seconds: range.start,
          end_seconds: range.end,
          include_timestamps: includeTimestamps,
          whisper_audio_seconds: transcribeData.whisper_audio_seconds ?? 0,
          whisper_cost_usd: transcribeData.whisper_cost_usd ?? 0,
        }),
      })

      if (!translateRes.ok) {
        const err = await translateRes.json()
        throw new Error(err.detail || 'Translation failed')
      }

      const translateDuration = Date.now() - translateStart

      // Step 4: Parse translate response (includes article + costs)
      setProcessingSteps(prev => prev.map(s => {
        if (s.id === 'translate') return { ...s, status: 'done', duration: translateDuration, cost: null }
        if (s.id === 'article') return { ...s, status: 'active' }
        return s
      }))
      const articleStart = Date.now()
      const translateData = await translateRes.json()
      const articleDuration = Date.now() - articleStart

      setProcessingSteps(prev => prev.map(s => {
        if (s.id === 'translate') return {
          ...s,
          cost: translateData.costs?.translation_cost_usd ?? null,
        }
        if (s.id === 'article') return {
          ...s,
          status: 'done',
          duration: articleDuration,
          cost: translateData.costs?.article_cost_usd ?? null,
        }
        return s
      }))

      setResults({
        arabicSegments: transcribeData.segments,
        arabicText: transcribeData.full_text,
        frenchSegments: translateData.translated_segments,
        frenchText: translateData.french_text,
        articleMarkdown: translateData.article_markdown,
        analysisId: translateData.analysis_id,
        includeTimestamps,
        costs: translateData.costs ?? null,
      })
      setStep(STEPS.RESULTS)
    } catch (err) {
      setProcessingError(err.message)
    }
  }

  function loadHistoryItem(item) {
    const hasSegments = (item.arabic_segments || []).length > 0
    setVideoInfo({
      title: item.video_title,
      thumbnail_url: item.thumbnail_url,
      duration: item.end_seconds,
    })
    setUrl(item.youtube_url)
    setRange({ start: item.start_seconds, end: item.end_seconds })
    setIncludeTimestamps(hasSegments)
    setResults({
      arabicSegments: item.arabic_segments || [],
      arabicText: item.arabic_text,
      frenchSegments: item.french_segments || [],
      frenchText: item.french_text,
      articleMarkdown: item.article_markdown,
      analysisId: item.id,
      includeTimestamps: hasSegments,
      costs: item.costs ?? null,
    })
    setStep(STEPS.RESULTS)
    setHistoryOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">Khotba Transcriber</h1>
            <p className="text-sm text-gray-500">Transcription et traduction de conférences islamiques</p>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Historique
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {step === STEPS.URL && (
          <UrlInput
            api={API}
            onSuccess={(info, videoUrl) => {
              setVideoInfo(info)
              setUrl(videoUrl)
              setRange({ start: 0, end: Math.min(info.duration, 300) })
              setStep(STEPS.TIME)
            }}
          />
        )}

        {step === STEPS.TIME && videoInfo && (
          <TimeRangePicker
            videoInfo={videoInfo}
            url={url}
            range={range}
            setRange={setRange}
            includeTimestamps={includeTimestamps}
            setIncludeTimestamps={setIncludeTimestamps}
            onTranscribe={handleTranscribeAndTranslate}
            onBack={() => setStep(STEPS.URL)}
          />
        )}

        {step === STEPS.PROCESSING && (
          <div className="bg-white rounded-xl shadow-md p-8 max-w-lg mx-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Traitement en cours...</h2>
            <div className="space-y-3">
              {processingSteps.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className={`text-lg ${s.status === 'active' ? 'animate-pulse' : ''}`}>
                    {s.status === 'done' ? '✅' : '⏳'}
                  </span>
                  <span className={`text-sm ${s.status === 'done' ? 'text-gray-500' : s.status === 'active' ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                    {s.label}
                    {s.status === 'done' && (
                      <span className="ml-2 text-gray-400 font-normal">
                        {s.duration != null && `(${formatDuration(s.duration)})`}
                        {s.cost != null && ` — ${fmtCost(s.cost)}`}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {processingError && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-red-600">❌ {processingError}</p>
                  <button
                    onClick={() => setStep(STEPS.TIME)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === STEPS.RESULTS && results && (
          <ResultsPanel
            results={results}
            videoInfo={videoInfo}
            range={range}
            onReset={() => {
              setStep(STEPS.URL)
              setVideoInfo(null)
              setUrl('')
              setResults(null)
            }}
          />
        )}
      </main>

      <HistoryPanel
        api={API}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={loadHistoryItem}
      />
    </div>
  )
}
