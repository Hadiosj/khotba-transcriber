function extractVideoId(url) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([^&?/]{11})/
  )
  return match ? match[1] : null
}

export default function VideoPreview({ url, start, end, autoplay = false }) {
  const videoId = extractVideoId(url)

  if (!videoId) {
    return (
      <p className="text-sm text-red-500 mt-2">
        Impossible d'extraire l'ID de la vidéo YouTube.
      </p>
    )
  }

  const params = new URLSearchParams({ start: String(start) })
  if (end > start) params.set('end', String(end))
  if (autoplay) params.set('autoplay', '1')

  const src = `https://www.youtube.com/embed/${videoId}?${params}`

  return (
    <div className="rounded-lg overflow-hidden bg-black aspect-video">
      <iframe
        key={src}
        src={src}
        title="YouTube preview"
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
