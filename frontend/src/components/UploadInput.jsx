import { useState, useRef, useEffect } from 'react'

// Fallback values used while the limits are being fetched
const FALLBACK_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} Go`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  return `${(bytes / 1024).toFixed(0)} Ko`
}

export default function UploadInput({ api, onSuccess }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(null) // 0–100 or null
  const [error, setError] = useState('')
  const [limits, setLimits] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch(`${api}/api/upload/limits`)
      .then(r => r.json())
      .then(setLimits)
      .catch(() => {})
  }, [api])

  const allowedExts = limits
    ? limits.allowed_extensions.map(e => e.replace('.', ''))
    : FALLBACK_EXTS
  const maxSizeBytes = limits?.max_file_size_bytes ?? null
  const maxSizeMb = maxSizeBytes != null ? Math.round(maxSizeBytes / 1024 / 1024) : null
  const maxDurMin = limits != null ? Math.round(limits.max_duration_seconds / 60) : null

  function validate(file) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!allowedExts.includes(ext)) {
      return `Format non supporté (.${ext}). Formats acceptés : ${allowedExts.map(e => '.' + e).join(', ')}`
    }
    if (maxSizeBytes != null && file.size > maxSizeBytes) {
      return `Fichier trop volumineux (${formatBytes(file.size)}). Maximum : ${maxSizeMb} Mo.`
    }
    return null
  }

  async function handleFile(file) {
    if (!file) return
    setError('')

    const validationError = validate(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    // Use XHR for upload progress tracking
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data)
          } else {
            reject(new Error(data.detail || 'Erreur lors du téléversement'))
          }
        } catch {
          reject(new Error('Réponse inattendue du serveur'))
        }
      }

      xhr.onerror = () => reject(new Error('Erreur réseau. Vérifiez votre connexion.'))

      xhr.open('POST', `${api}/api/upload`)
      xhr.send(formData)
    })
      .then((data) => {
        onSuccess(
          { title: data.title, duration: data.duration, thumbnail_url: null },
          data.upload_id,
          data.ext,
          data.filename,
        )
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setUploading(false)
        setProgress(null)
      })
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}
          ${uploading ? 'cursor-not-allowed opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={allowedExts.map(e => '.' + e).join(',')}
          className="hidden"
          disabled={uploading}
          onChange={e => handleFile(e.target.files[0])}
        />

        {uploading ? (
          <div className="space-y-3">
            <svg className="w-10 h-10 text-indigo-400 mx-auto animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Téléversement en cours...</p>
            {progress !== null && (
              <div className="w-full bg-gray-200 rounded-full h-2 mx-auto max-w-xs">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {progress !== null && (
              <p className="text-xs text-gray-400">{progress}%</p>
            )}
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-700 mb-1">
              Glissez-déposez une vidéo ici
            </p>
            <p className="text-xs text-gray-400 mb-3">ou cliquez pour parcourir</p>
            <p className="text-xs text-gray-400">
              Formats : {allowedExts.map(e => '.' + e).join(', ')} · {maxSizeMb != null ? `Max ${maxSizeMb} Mo` : ''} · {maxDurMin != null ? `Max ${maxDurMin} min` : ''}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
