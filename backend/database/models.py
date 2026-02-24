import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Float, Text, DateTime
from database.db import Base


def generate_uuid():
    return str(uuid.uuid4())


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=generate_uuid)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    youtube_url = Column(String, nullable=False)
    video_title = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    start_seconds = Column(Integer, nullable=False)
    end_seconds = Column(Integer, nullable=False)
    arabic_text = Column(Text, nullable=True)
    french_text = Column(Text, nullable=True)
    article_markdown = Column(Text, nullable=True)
    segments_json = Column(Text, nullable=True)
    cost_json = Column(Text, nullable=True)
    status = Column(String, default="completed")
    processing_time_seconds = Column(Float, nullable=True)
