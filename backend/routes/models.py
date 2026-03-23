from fastapi import APIRouter
from utils.models_config import TRANSCRIPTION_MODELS, TRANSLATION_MODELS

router = APIRouter()


@router.get("/models")
def get_models():
    return {
        "transcription": list(TRANSCRIPTION_MODELS.values()),
        "translation": list(TRANSLATION_MODELS.values()),
    }
