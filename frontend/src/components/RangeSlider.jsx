import { useRef } from 'react'
import { fmtTime } from '../utils/time'

export default function RangeSlider({ min = 0, max, start, end, onChange }) {
  const trackRef = useRef(null)

  function getValueFromClientX(clientX) {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * (max - min) + min)
  }

  function startDrag(onMove) {
    const move = (ev) => {
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX
      onMove(getValueFromClientX(clientX))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', up)
  }

  function handleStartDrag(e) {
    e.preventDefault()
    startDrag((val) => {
      const newStart = Math.max(min, Math.min(val, end - 1))
      onChange({ start: newStart, end })
    })
  }

  function handleEndDrag(e) {
    e.preventDefault()
    startDrag((val) => {
      const newEnd = Math.min(max, Math.max(val, start + 1))
      onChange({ start, end: newEnd })
    })
  }

  // Clicking the track itself sets the nearest handle
  function handleTrackClick(e) {
    if (e.target !== trackRef.current && !e.target.classList.contains('range-track-bg')) return
    const val = getValueFromClientX(e.clientX)
    const distToStart = Math.abs(val - start)
    const distToEnd = Math.abs(val - end)
    if (distToStart <= distToEnd) {
      const newStart = Math.max(min, Math.min(val, end - 1))
      onChange({ start: newStart, end })
    } else {
      const newEnd = Math.min(max, Math.max(val, start + 1))
      onChange({ start, end: newEnd })
    }
  }

  const startPct = max > min ? ((start - min) / (max - min)) * 100 : 0
  const endPct = max > min ? ((end - min) / (max - min)) * 100 : 0

  return (
    <div className="px-2 py-1">
      {/* Time labels above thumbs */}
      <div className="relative h-5 mb-1 text-xs text-indigo-700 font-medium select-none">
        <span
          className="absolute -translate-x-1/2 bg-indigo-50 border border-indigo-200 rounded px-1"
          style={{ left: `${startPct}%` }}
        >
          {fmtTime(start)}
        </span>
        <span
          className="absolute -translate-x-1/2 bg-indigo-50 border border-indigo-200 rounded px-1"
          style={{ left: `${endPct}%` }}
        >
          {fmtTime(end)}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-8 flex items-center cursor-pointer"
        onClick={handleTrackClick}
      >
        {/* Background track */}
        <div className="range-track-bg absolute w-full h-2 bg-gray-200 rounded-full" />
        {/* Selected range highlight */}
        <div
          className="absolute h-2 bg-indigo-400 rounded-full pointer-events-none"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
        {/* Start thumb */}
        <div
          className="absolute w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-grab active:cursor-grabbing z-10 hover:scale-110 transition-transform"
          style={{ left: `${startPct}%`, transform: 'translateX(-50%)' }}
          onMouseDown={handleStartDrag}
          onTouchStart={handleStartDrag}
        />
        {/* End thumb */}
        <div
          className="absolute w-5 h-5 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-grab active:cursor-grabbing z-10 hover:scale-110 transition-transform"
          style={{ left: `${endPct}%`, transform: 'translateX(-50%)' }}
          onMouseDown={handleEndDrag}
          onTouchStart={handleEndDrag}
        />
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between text-xs text-gray-400 mt-1 select-none">
        <span>{fmtTime(min)}</span>
        <span>{fmtTime(max)}</span>
      </div>
    </div>
  )
}
