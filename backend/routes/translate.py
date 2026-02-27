import json
import time
import traceback

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from services.translator import translate_and_summarize
from database.db import get_db
from database.crud import create_analysis
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


class Segment(BaseModel):
    start: float
    end: float
    text: str


class TranslateRequest(BaseModel):
    segments: list[Segment]
    arabic_text: str
    youtube_url: str = ""
    video_title: str
    thumbnail_url: str | None = None
    start_seconds: int
    end_seconds: int
    include_timestamps: bool = True
    whisper_audio_seconds: float = 0.0
    whisper_cost_usd: float = 0.0
    source_type: str = "youtube"
    upload_id: str | None = None
    upload_filename: str | None = None


@router.post("/translate")
async def translate(body: TranslateRequest, db: Session = Depends(get_db)):
    logger.info(f"Starting translation for: {body.video_title}")
    t0 = time.perf_counter()

    try:
        result = await translate_and_summarize(
            segments=[s.model_dump() for s in body.segments],
            arabic_text=body.arabic_text,
            include_timestamps=body.include_timestamps,
        )
    except RuntimeError as e:
        msg = str(e)
        logger.error(f"Translation failed: {msg}")
        if "GEMINI_API_KEY" in msg:
            raise HTTPException(status_code=500, detail="Gemini API key is not configured")
        raise HTTPException(status_code=500, detail="Translation or article generation failed")
    except Exception as e:
        logger.error(f"Unexpected translation error: {type(e).__name__}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Translation failed unexpectedly")

    total_elapsed = time.perf_counter() - t0
    logger.info(f"Translation completed in {total_elapsed:.2f}s")

    # Assemble full cost breakdown
    gc = result.get("gemini_costs", {})
    total_cost = round(
        body.whisper_cost_usd
        + gc.get("translation_cost_usd", 0.0)
        + gc.get("article_cost_usd", 0.0),
        6,
    )
    costs = {
        "whisper_audio_seconds": body.whisper_audio_seconds,
        "whisper_cost_usd": body.whisper_cost_usd,
        "translation_input_tokens": gc.get("translation_input_tokens", 0),
        "translation_output_tokens": gc.get("translation_output_tokens", 0),
        "translation_cost_usd": gc.get("translation_cost_usd", 0.0),
        "article_input_tokens": gc.get("article_input_tokens", 0),
        "article_output_tokens": gc.get("article_output_tokens", 0),
        "article_cost_usd": gc.get("article_cost_usd", 0.0),
        "total_cost_usd": total_cost,
    }

    # Best-effort DB save — errors should not fail the response
    analysis_id = None
    try:
        record = create_analysis(
            db=db,
            youtube_url=body.youtube_url,
            video_title=body.video_title,
            thumbnail_url=body.thumbnail_url,
            start_seconds=body.start_seconds,
            end_seconds=body.end_seconds,
            arabic_text=body.arabic_text,
            french_text=result["french_text"],
            article_markdown=result["article_markdown"],
            segments_json=json.dumps(
                {
                    "arabic": [s.model_dump() for s in body.segments],
                    "french": result["translated_segments"],
                },
                ensure_ascii=False,
            ),
            cost_json=json.dumps(costs),
            processing_time_seconds=round(total_elapsed, 2),
            source_type=body.source_type,
            upload_id=body.upload_id,
            upload_filename=body.upload_filename,
        )
        analysis_id = record.id
        logger.info(f"Analysis saved to DB with id={analysis_id} total_cost=${total_cost:.5f}")
    except Exception as e:
        logger.error(f"DB save failed (non-fatal): {type(e).__name__}: {e}")

    return {
        "french_text": result["french_text"],
        "article_markdown": result["article_markdown"],
        "translated_segments": result["translated_segments"],
        "analysis_id": analysis_id,
        "costs": costs,
    }
