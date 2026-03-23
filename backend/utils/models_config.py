TRANSCRIPTION_MODELS = {
    "whisper-large-v3-turbo": {
        "id": "whisper-large-v3-turbo",
        "name": "Whisper Large v3 Turbo",
        "description": "Transcription rapide et précise",
        "cost_per_second": 0.04 / 3600,
        "free_tier": True,
        "free_tier_note": "Disponible sur le tier gratuit de Groq",
    },
    "whisper-large-v3": {
        "id": "whisper-large-v3",
        "name": "Whisper Large v3",
        "description": "Plus haute précision, légèrement plus lent",
        "cost_per_second": 0.111 / 3600,
        "free_tier": True,
        "free_tier_note": "Disponible sur le tier gratuit de Groq avec des limites de taux strictes",
    },
}

TRANSLATION_MODELS = {
    "gemini-3.1-flash-lite-preview": {
        "id": "gemini-3.1-flash-lite-preview",
        "name": "Gemini 3.1 Flash Lite Preview",
        "description": "Rapide et cost-effective",
        "input_cost_per_m": 0.25,
        "output_cost_per_m": 1.5,
        "free_tier": True,
        "free_tier_note": "Disponible sur le tier gratuit de Gemini",
    },
    "gemini-3.1-pro-preview": {
        "id": "gemini-3.1-pro-preview",
        "name": "Gemini 3.1 Pro",
        "description": "Qualité supérieure, plus précise",
        "input_cost_per_m": 2.0,
        "output_cost_per_m": 12.0,
        "free_tier": False,
        "free_tier_note": None,
    },
}

DEFAULT_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo"
DEFAULT_TRANSLATION_MODEL = "gemini-3.1-flash-lite-preview"
