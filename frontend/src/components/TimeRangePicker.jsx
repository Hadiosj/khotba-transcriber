import { useState } from 'react'
import VideoPreview from './VideoPreview'
import RangeSlider from './RangeSlider'
import { fmtTime } from '../utils/time'

const MAX_SEGMENT = 30 * 60

function parseTime(str) {
  const parts = str.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export default function TimeRangePicker({
  videoInfo,
  url,
  range,
  setRange,
  includeTimestamps,
  setIncludeTimestamps,
  onTranscribe,
  onBack,
}) {
  const [startInput, setStartInput] = useState(fmtTime(range.start))
  const [endInput, setEndInput] = useState(fmtTime(range.end))
  const [timeError, setTimeError] = useState('')
  // previewRange drives the iframe; autoplay: false = static preview, true = plays from start
  const [previewRange, setPreviewRange] = useState({ start: 0, end: 0, autoplay: false })
  const duration = videoInfo.duration

  function handleStartBlur() {
    const val = parseTime(startInput)
    if (val === null || val < 0) {
      setStartInput(fmtTime(range.start))
      return
    }
    const newStart = Math.min(val, range.end - 1, duration - 1)
    setRange(r => ({ ...r, start: newStart }))
    setStartInput(fmtTime(newStart))
    setTimeError('')
  }

  function handleEndBlur() {
    const val = parseTime(endInput)
    if (val === null || val <= 0) {
      setEndInput(fmtTime(range.end))
      return
    }
    const newEnd = Math.min(val, duration)
    if (newEnd <= range.start) {
      setTimeError('La fin doit être après le début.')
      setEndInput(fmtTime(range.end))
      return
    }
    setRange(r => ({ ...r, end: newEnd }))
    setEndInput(fmtTime(newEnd))
    setTimeError('')
  }

  function handleSliderChange({ start, end }) {
    setRange({ start, end })
    setStartInput(fmtTime(start))
    setEndInput(fmtTime(end))
    setTimeError('')
  }

  function handlePreviewSelection() {
    setPreviewRange({ start: range.start, end: range.end, autoplay: true })
  }

  const selectedDuration = range.end - range.start
  const exceedsMax = selectedDuration > MAX_SEGMENT
  const canTranscribe = range.end > range.start && !exceedsMax

  return (
    <div className="space-y-6">
      {/* Video player — shown immediately so user can navigate to find timestamps */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0 flex-1 mr-4">
            <p className="font-semibold text-gray-800 truncate">{videoInfo.title}</p>
            <p className="text-xs text-gray-500">Durée totale: {fmtTime(duration)}</p>
          </div>
          <button onClick={onBack} className="text-sm text-indigo-600 hover:text-indigo-800 flex-shrink-0">
            ← Changer
          </button>
        </div>
        <VideoPreview
          url={url}
          start={previewRange.start}
          end={previewRange.end}
          autoplay={previewRange.autoplay}
        />
      </div>

      {/* Time range controls */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Sélectionner la plage de temps</h3>

        {/* Dual-handle range slider */}
        <div className="mb-4">
          <RangeSlider
            min={0}
            max={duration}
            start={range.start}
            end={range.end}
            onChange={handleSliderChange}
          />
        </div>

        {/* Text inputs for precise control */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Début</label>
            <input
              type="text"
              value={startInput}
              onChange={e => setStartInput(e.target.value)}
              onBlur={handleStartBlur}
              placeholder="MM:SS"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
            <input
              type="text"
              value={endInput}
              onChange={e => setEndInput(e.target.value)}
              onBlur={handleEndBlur}
              placeholder="MM:SS"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className={`text-sm font-medium mb-4 ${exceedsMax ? 'text-amber-600' : 'text-indigo-700'}`}>
          Sélectionné: {fmtTime(selectedDuration)}
          {exceedsMax && (
            <span className="ml-2 font-normal">— max 30 min par transcription</span>
          )}
        </div>

        {timeError && (
          <p className="text-red-600 text-sm mb-3 bg-red-50 border border-red-200 rounded px-3 py-2">
            {timeError}
          </p>
        )}

        {exceedsMax && (
          <p className="text-amber-700 text-sm mb-3 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            La sélection dépasse 30 minutes. Réduisez la plage pour pouvoir transcrire.
          </p>
        )}

        {/* Timestamps toggle */}
        <label className="flex items-center gap-3 mb-4 cursor-pointer select-none">
          <div
            onClick={() => setIncludeTimestamps(v => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors ${includeTimestamps ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeTimestamps ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Inclure les horodatages</span>
            <p className="text-xs text-gray-400">
              {includeTimestamps
                ? 'Segments avec timestamps — utile pour les sous-titres'
                : 'Texte uniquement — plus rapide, sans découpage par segment'}
            </p>
          </div>
        </label>

        <div className="flex gap-3">
          <button
            onClick={handlePreviewSelection}
            disabled={!canTranscribe}
            className="flex-1 py-2.5 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium rounded-lg transition-colors"
          >
            Prévisualiser la sélection
          </button>
          <button
            onClick={onTranscribe}
            disabled={!canTranscribe}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            Transcrire ce segment
          </button>
        </div>
      </div>
    </div>
  )
}
