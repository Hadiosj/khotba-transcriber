import os
import asyncio
import time
import json

from google import genai

from utils.logger import get_logger
from utils.models_config import (
    GEMINI_MODEL, GEMINI_ARTICLE_MODEL,
    GEMINI_FLASH_INPUT_COST_PER_M, GEMINI_FLASH_OUTPUT_COST_PER_M,
    GEMINI_ARTICLE_INPUT_COST_PER_M, GEMINI_ARTICLE_OUTPUT_COST_PER_M,
)

logger = get_logger(__name__)

ARTICLE_PROMPT_TEMPLATE = """Tu vas recevoir la transcription complète d'un contenu audio en arabe. Traduis-la intégralement en français, mot pour mot, sans rien omettre ni résumer.

La seule mise en forme autorisée :
- Un titre principal (# ...) qui reflète le sujet du contenu
- Des titres de sections (## ...) pour découper naturellement le contenu en parties cohérentes

Le texte sous chaque section doit être la traduction directe et fidèle de ce qui est dit, dans les propres mots de l'orateur, comme si le lecteur entendait le contenu lui-même. Ne reformule pas, ne commente pas, ne résume pas. Ne commence pas par une phrase d'introduction sur le contenu.

Transcription arabe complète :
{arabic_text}"""

TRANSLATION_PROMPT_TEMPLATE = """Traduis les segments suivants d'arabe en français.
Retourne UNIQUEMENT un tableau JSON valide avec cette structure exacte (sans markdown, sans explication):
[{{"start": 0.0, "end": 5.2, "text": "traduction française"}}]

Segments à traduire:
{segments_json}"""

PLAIN_TRANSLATION_PROMPT_TEMPLATE = """Traduis le texte suivant de l'arabe en français. Retourne UNIQUEMENT la traduction française, sans explication ni commentaire.

Texte arabe:
{arabic_text}"""


def _get_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=api_key)


def _extract_usage(response) -> dict:
    """Extract token counts from a Gemini response."""
    meta = getattr(response, "usage_metadata", None)
    if meta is None:
        return {"input_tokens": 0, "output_tokens": 0}
    return {
        "input_tokens": getattr(meta, "prompt_token_count", 0) or 0,
        "output_tokens": getattr(meta, "candidates_token_count", 0) or 0,
    }


def _gemini_cost(usage: dict, input_cost_per_m: float, output_cost_per_m: float) -> float:
    return (
        usage["input_tokens"] * input_cost_per_m
        + usage["output_tokens"] * output_cost_per_m
    ) / 1_000_000


async def _call_gemini(client, model: str, prompt: str) -> tuple[str, dict]:
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None, lambda: client.models.generate_content(model=model, contents=prompt)
    )
    return response.text, _extract_usage(response)


async def translate_segments(
    segments: list[dict], arabic_text: str, include_timestamps: bool = True
) -> dict:
    """Translate Arabic segments/text to French using Gemini."""
    logger.info(f"Starting translation with Gemini (timestamps: {include_timestamps})")
    t0 = time.perf_counter()

    client = _get_client()

    if include_timestamps:
        segments_json = json.dumps(segments, ensure_ascii=False)
        translation_prompt = TRANSLATION_PROMPT_TEMPLATE.format(segments_json=segments_json)
    else:
        translation_prompt = PLAIN_TRANSLATION_PROMPT_TEMPLATE.format(arabic_text=arabic_text)

    translation_raw, translation_usage = await _call_gemini(client, GEMINI_MODEL, translation_prompt)

    if include_timestamps:
        translated_segments = _parse_segments(translation_raw, segments)
        french_text = " ".join(s["text"] for s in translated_segments)
    else:
        translated_segments = []
        french_text = translation_raw.strip()

    translation_cost = _gemini_cost(translation_usage, GEMINI_FLASH_INPUT_COST_PER_M, GEMINI_FLASH_OUTPUT_COST_PER_M)

    elapsed = time.perf_counter() - t0
    logger.info(
        f"Translation completed in {elapsed:.2f}s — "
        f"{translation_usage['input_tokens']}in/{translation_usage['output_tokens']}out tokens "
        f"(${translation_cost:.5f})"
    )

    return {
        "french_text": french_text,
        "translated_segments": translated_segments,
        "gemini_costs": {
            "translation_input_tokens": translation_usage["input_tokens"],
            "translation_output_tokens": translation_usage["output_tokens"],
            "translation_cost_usd": round(translation_cost, 6),
        },
    }


async def generate_article(arabic_text: str) -> dict:
    """Generate a French article from Arabic text using Gemini."""
    logger.info("Starting article generation with Gemini")
    t0 = time.perf_counter()

    client = _get_client()
    article_prompt = ARTICLE_PROMPT_TEMPLATE.format(arabic_text=arabic_text)
    article_raw, article_usage = await _call_gemini(client, GEMINI_ARTICLE_MODEL, article_prompt)

    article_cost = _gemini_cost(article_usage, GEMINI_ARTICLE_INPUT_COST_PER_M, GEMINI_ARTICLE_OUTPUT_COST_PER_M)

    elapsed = time.perf_counter() - t0
    logger.info(
        f"Article generation completed in {elapsed:.2f}s — "
        f"{article_usage['input_tokens']}in/{article_usage['output_tokens']}out tokens "
        f"(${article_cost:.5f})"
    )

    return {
        "article_markdown": article_raw.strip(),
        "costs": {
            "article_input_tokens": article_usage["input_tokens"],
            "article_output_tokens": article_usage["output_tokens"],
            "article_cost_usd": round(article_cost, 6),
        },
    }


def _parse_segments(raw: str, fallback_segments: list[dict]) -> list[dict]:
    """Try to extract JSON from Gemini response; fall back gracefully."""
    raw = raw.strip()

    # Strip possible markdown code fence
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [
                {
                    "start": seg.get("start", 0.0),
                    "end": seg.get("end", 0.0),
                    "text": seg.get("text", ""),
                }
                for seg in data
            ]
    except Exception as e:
        logger.warning(f"Could not parse translated segments JSON: {e}. Using raw text as single segment.")

    # Fallback: return raw text as single segment
    return [{"start": 0.0, "end": 0.0, "text": raw}]
