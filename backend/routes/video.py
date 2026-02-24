from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.downloader import validate_youtube_url, get_video_info
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


class VideoInfoRequest(BaseModel):
    url: str


@router.post("/info")
async def video_info(body: VideoInfoRequest):
    url = body.url.strip()
    logger.info(f"Starting video info request for URL: {url}")

    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    try:
        info = get_video_info(url)
        return info
    except RuntimeError as e:
        logger.error(f"Video info failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except FileNotFoundError:
        logger.error("yt-dlp executable not found")
        raise HTTPException(
            status_code=500,
            detail="yt-dlp is not installed. Install it with: pip install yt-dlp",
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching video info: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to fetch video information")
