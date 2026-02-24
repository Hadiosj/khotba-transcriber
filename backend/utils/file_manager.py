import os
import uuid
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
TMP_DIR = os.path.join(BASE_DIR, "tmp")
LOG_DIR = os.path.join(BASE_DIR, "logs")
VIDEOS_DIR = os.path.join(BASE_DIR, "videos")


def ensure_dirs():
    os.makedirs(TMP_DIR, exist_ok=True)
    os.makedirs(LOG_DIR, exist_ok=True)
    os.makedirs(VIDEOS_DIR, exist_ok=True)


def get_video_path(analysis_id: str, lang: str) -> str:
    return os.path.join(VIDEOS_DIR, f"{analysis_id}_{lang}.mp4")


def clear_tmp() -> int:
    count = 0
    if not os.path.isdir(TMP_DIR):
        return 0
    for name in os.listdir(TMP_DIR):
        path = os.path.join(TMP_DIR, name)
        try:
            if os.path.isfile(path) or os.path.islink(path):
                os.unlink(path)
            elif os.path.isdir(path):
                shutil.rmtree(path)
            count += 1
        except Exception:
            pass
    return count


def tmp_path(suffix: str = "") -> str:
    return os.path.join(TMP_DIR, f"{uuid.uuid4()}{suffix}")


def safe_remove(path: str):
    try:
        if path and os.path.exists(path):
            os.unlink(path)
    except Exception:
        pass
