export default function ModelSelector({ transcriptionModels, translationModels, selectedTranscription, selectedTranslation, onSelectTranscription, onSelectTranslation }) {
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Modèles</h3>

      <div className="space-y-4">
        <ModelGroup
          label="Transcription (Whisper)"
          models={transcriptionModels}
          selected={selectedTranscription}
          onSelect={onSelectTranscription}
        />
        <ModelGroup
          label="Traduction (Gemini)"
          models={translationModels}
          selected={selectedTranslation}
          onSelect={onSelectTranslation}
        />
      </div>
    </div>
  )
}

function ModelGroup({ label, models, selected, onSelect }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="grid grid-cols-1 gap-1.5">
        {models.map(model => {
          const isSelected = selected === model.id
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onSelect(model.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                isSelected
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                    isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                  }`} />
                  <span className="font-medium truncate">{model.name}</span>
                </div>
                {model.free_tier && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium flex-shrink-0">
                    Gratuit
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 ml-5.5 pl-5">{model.description}</p>
              {!model.free_tier && isSelected && (
                <div className="mt-1.5 ml-5 flex items-start gap-1.5 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-xs text-amber-800">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  Ce modèle nécessite un compte payant.
                </div>
              )}
              {model.free_tier && model.free_tier_note && isSelected && (
                <div className="mt-1.5 ml-5 flex items-start gap-1.5 rounded bg-green-50 border border-green-200 px-2 py-1 text-xs text-green-800">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {model.free_tier_note}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
