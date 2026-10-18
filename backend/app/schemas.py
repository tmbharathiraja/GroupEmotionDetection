from typing import Literal

from pydantic import BaseModel, Field

Emotion = Literal["happy", "neutral", "sad", "angry", "fear", "surprise", "disgust"]
EMOTIONS: tuple[Emotion, ...] = ("happy", "neutral", "sad", "angry", "fear", "surprise", "disgust")


class FacePrediction(BaseModel):
    id: int
    box: tuple[int, int, int, int]
    emotion: Emotion
    score: float = Field(ge=0, le=1)
    detection_score: float = Field(ge=0, le=1)
    scores: dict[Emotion, float]


class GroupSummary(BaseModel):
    emotion: Emotion | Literal["no_faces"]
    agreement: float = Field(ge=0, le=1)
    counts: dict[Emotion, int]
    tied: bool
    method: str = "majority_vote"


class Prediction(BaseModel):
    image: dict[str, int]
    group: GroupSummary
    faces: list[FacePrediction]
    elapsed_ms: float
    warnings: list[str]
    model: str = "YOLOv8n-face + DeepFace Emotion"
