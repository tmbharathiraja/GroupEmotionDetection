import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    model_dir: Path = Path(os.getenv("MODEL_DIR", Path(__file__).resolve().parents[2] / ".models"))
    max_upload_bytes: int = 10 * 1024 * 1024
    max_pixels: int = 25_000_000
    max_dimension: int = 1920
    max_faces: int = 64
    detection_threshold: float = 0.3
    cors_origins: tuple[str, ...] = tuple(
        os.getenv("CORS_ORIGINS", "http://localhost:3001,http://127.0.0.1:3001").split(",")
    )
