import os
import asyncio
import time
import json

import google.generativeai as genai

from utils.logger import get_logger
from utils.models_config import (
    GEMINI_MODEL, GEMINI_ARTICLE_MODEL,
    GEMINI_FLASH_INPUT_COST_PER_M, GEMINI_FLASH_OUTPUT_COST_PER_M,
    GEMINI_ARTICLE_INPUT_COST_PER_M, GEMINI_ARTICLE_OUTPUT_COST_PER_M,
)

logger = get_logger(__name__)

ARTICLE_PROMPT_TEMPLATE = """Tu es un rédacteur islamique expert. À partir de la transcription complète d'une khotba (sermon) en arabe d'un sheikh, rédige un **article complet en français**, au format Notion, que quelqu'un qui n'a pas assisté à la khotba puisse lire et ne rien manquer.

⚠️ RÈGLES ABSOLUES :
- **Aucune information ne doit être omise ou résumée.** Tout ce que le sheikh a dit doit se retrouver dans l'article.
- Ne résume pas. Développe, reformule, structure — mais conserve l'intégralité du contenu.
- Le ton doit être académique, fluide et engageant, comme un article de qualité dans une revue islamique.

---

📐 FORMAT DE L'ARTICLE (Notion-style Markdown) :

```
# [Titre principal accrocheur de la khotba]

> *[Citation d'ouverture extraite du discours du sheikh — verset coranique ou hadith si mentionné]*

---

## Introduction

[Paragraphe d'introduction expliquant le contexte général de la khotba, son thème central et son importance.]

---

## [Titre de la première section thématique]

[Développement complet et fidèle de tous les points abordés dans cette partie. Utilise des paragraphes bien structurés. N'omets aucun argument, aucune preuve coranique, aucun hadith, aucun exemple.]

> **"[Citation traduite exacte du sheikh entre guillemets]"**

### [Sous-point si nécessaire]

[Détail du sous-point avec toute la richesse du discours original.]

---

## [Titre de la deuxième section thématique]

[Même principe — développement intégral.]

---

[... autant de sections que nécessaire pour couvrir l'intégralité de la khotba ...]

---

## Conclusion

[Reformulation des enseignements finaux du sheikh, ses recommandations, ses appels à l'action ou ses invocations finales.]

---

*📖 Article rédigé d'après la khotba intégrale du sheikh. Aucun enseignement n'a été omis.*
```

---

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


def _get_client(model: str = GEMINI_MODEL):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(model)


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


async def _call_gemini(model, prompt: str) -> tuple[str, dict]:
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None, lambda: model.generate_content(prompt)
    )
    return response.text, _extract_usage(response)


async def translate_and_summarize(
    segments: list[dict], arabic_text: str, include_timestamps: bool = True
) -> dict:
    """Run translation and article generation in parallel via Gemini.
    When include_timestamps is False, translates the full text directly instead of segment-by-segment."""
    logger.info(f"Starting translation and article generation with Gemini (timestamps: {include_timestamps})")
    t0 = time.perf_counter()

    translation_model = _get_client(GEMINI_MODEL)
    article_model = _get_client(GEMINI_ARTICLE_MODEL)

    article_prompt = ARTICLE_PROMPT_TEMPLATE.format(arabic_text=arabic_text)

    t_trans = time.perf_counter()

    if include_timestamps:
        segments_json = json.dumps(segments, ensure_ascii=False)
        translation_prompt = TRANSLATION_PROMPT_TEMPLATE.format(segments_json=segments_json)
    else:
        translation_prompt = PLAIN_TRANSLATION_PROMPT_TEMPLATE.format(arabic_text=arabic_text)

    translation_task = asyncio.create_task(_call_gemini(translation_model, translation_prompt))
    article_task = asyncio.create_task(_call_gemini(article_model, article_prompt))

    (translation_raw, translation_usage), (article_raw, article_usage) = await asyncio.gather(
        translation_task, article_task
    )

    t_trans_elapsed = time.perf_counter() - t_trans
    logger.info(f"Translation and article generation completed in {t_trans_elapsed:.2f}s")

    if include_timestamps:
        translated_segments = _parse_segments(translation_raw, segments)
        french_text = " ".join(s["text"] for s in translated_segments)
    else:
        translated_segments = []
        french_text = translation_raw.strip()

    translation_cost = _gemini_cost(translation_usage, GEMINI_FLASH_INPUT_COST_PER_M, GEMINI_FLASH_OUTPUT_COST_PER_M)
    article_cost = _gemini_cost(article_usage, GEMINI_ARTICLE_INPUT_COST_PER_M, GEMINI_ARTICLE_OUTPUT_COST_PER_M)

    elapsed = time.perf_counter() - t0
    logger.info(
        f"Full translation pipeline completed in {elapsed:.2f}s — "
        f"translation: {translation_usage['input_tokens']}in/{translation_usage['output_tokens']}out tokens "
        f"(${translation_cost:.5f}), article: {article_usage['input_tokens']}in/{article_usage['output_tokens']}out "
        f"tokens (${article_cost:.5f})"
    )

    return {
        "french_text": french_text,
        "article_markdown": article_raw.strip(),
        "translated_segments": translated_segments,
        "gemini_costs": {
            "translation_input_tokens": translation_usage["input_tokens"],
            "translation_output_tokens": translation_usage["output_tokens"],
            "translation_cost_usd": round(translation_cost, 6),
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
