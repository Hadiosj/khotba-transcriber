import { useState } from 'react'
import UrlInput from './components/UrlInput'
import UploadInput from './components/UploadInput'
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
  const [sourceMode, setSourceMode] = useState('youtube') // 'youtube' | 'upload'
  const [videoInfo, setVideoInfo] = useState(null)
  const [url, setUrl] = useState('')
  const [uploadId, setUploadId] = useState(null)
  const [uploadExt, setUploadExt] = useState(null)
  const [uploadFilename, setUploadFilename] = useState(null)
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
      // Step 1: Extract audio + Whisper transcription
      setProcessingSteps(prev => prev.map(s => s.id === 'extract' ? { ...s, status: 'active' } : s))
      const extractStart = Date.now()

      const transcribeBody = sourceMode === 'upload'
        ? { upload_id: uploadId, start_seconds: range.start, end_seconds: range.end, include_timestamps: includeTimestamps }
        : { url, start_seconds: range.start, end_seconds: range.end, include_timestamps: includeTimestamps }

      const transcribeRes = await fetch(`${API}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transcribeBody),
      })

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json()
        throw new Error(err.detail || 'Transcription failed')
      }

      const extractDuration = Date.now() - extractStart

      setProcessingSteps(prev => prev.map(s => {
        if (s.id === 'extract') return { ...s, status: 'done', duration: extractDuration }
        if (s.id === 'whisper') return { ...s, status: 'active' }
        return s
      }))
      const whisperStart = Date.now()
      const transcribeData = await transcribeRes.json()
      const whisperDuration = Date.now() - whisperStart

      // Step 3: Translate
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
          youtube_url: sourceMode === 'youtube' ? url : '',
          video_title: videoInfo.title,
          thumbnail_url: videoInfo.thumbnail_url,
          start_seconds: range.start,
          end_seconds: range.end,
          include_timestamps: includeTimestamps,
          whisper_audio_seconds: transcribeData.whisper_audio_seconds ?? 0,
          whisper_cost_usd: transcribeData.whisper_cost_usd ?? 0,
          source_type: sourceMode,
          upload_id: sourceMode === 'upload' ? uploadId : null,
          upload_filename: sourceMode === 'upload' ? uploadFilename : null,
        }),
      })

      if (!translateRes.ok) {
        const err = await translateRes.json()
        throw new Error(err.detail || 'Translation failed')
      }

      const translateDuration = Date.now() - translateStart

      const translateData = await translateRes.json()

      setProcessingSteps(prev => prev.map(s => {
        if (s.id === 'translate') return {
          ...s,
          status: 'done',
          duration: translateDuration,
          cost: translateData.costs?.translation_cost_usd ?? null,
        }
        return s
      }))

      setResults({
        arabicSegments: transcribeData.segments,
        arabicText: transcribeData.full_text,
        frenchSegments: translateData.translated_segments,
        frenchText: translateData.french_text,
        articleMarkdown: null,
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
    setUrl(item.youtube_url || '')
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

  function handleReset() {
    setStep(STEPS.URL)
    setVideoInfo(null)
    setUrl('')
    setUploadId(null)
    setUploadExt(null)
    setUploadFilename(null)
    setResults(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-indigo-600 cursor-pointer hover:text-indigo-500 transition-colors"
              onClick={handleReset}
            >
              Transcripteur Vidéo
            </h1>
            <p className="text-sm text-gray-500">Transcription et traduction de vidéos arabes en français</p>
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
          <div className="flex items-start justify-center pt-12">
            <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-lg">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Transcription Vidéo</h2>
                <p className="text-gray-500 mt-1 text-sm">Choisissez votre source vidéo</p>
              </div>

              {/* Source mode toggle */}
              <div className="flex rounded-lg border border-gray-200 p-1 mb-6 bg-gray-50">
                <button
                  onClick={() => setSourceMode('youtube')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors
                    ${sourceMode === 'youtube' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z"/>
                  </svg>
                  URL YouTube
                </button>
                <button
                  onClick={() => setSourceMode('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors
                    ${sourceMode === 'upload' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Téléverser
                </button>
              </div>

              {sourceMode === 'youtube' ? (
                <UrlInput
                  api={API}
                  onSuccess={(info, videoUrl) => {
                    setVideoInfo(info)
                    setUrl(videoUrl)
                    setRange({ start: 0, end: Math.min(info.duration, 300) })
                    setStep(STEPS.TIME)
                  }}
                />
              ) : (
                <UploadInput
                  api={API}
                  onSuccess={(info, id, ext, filename) => {
                    setVideoInfo(info)
                    setUploadId(id)
                    setUploadExt(ext)
                    setUploadFilename(filename)
                    setRange({ start: 0, end: Math.min(info.duration, 300) })
                    setStep(STEPS.TIME)
                  }}
                />
              )}
            </div>
          </div>
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
            isUpload={sourceMode === 'upload'}
            uploadFilename={uploadFilename}
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
            onReset={handleReset}
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
