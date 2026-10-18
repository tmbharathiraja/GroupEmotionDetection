import logging
import os
import threading
from time import perf_counter

import numpy as np

from .aggregation import summarize
from .config import Settings
from .schemas import EMOTIONS, FacePrediction, Prediction

logger = logging.getLogger(__name__)


class ModelUnavailable(RuntimeError):
    pass


class EmotionEngine:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.status = "loading"
        self.detector = None
        self.deepface = None
        self._lock = threading.Lock()

    def load(self) -> None:
        """Load once at startup. Keep liveness available if setup needs attention."""
        with self._lock:
            try:
                weights = self.settings.model_dir / "yolov8n-face.pt"
                if not weights.is_file():
                    self.status = "setup_required"
                    return
                os.environ.setdefault("DEEPFACE_HOME", str(self.settings.model_dir))
                os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
                os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
                os.environ["YOLO_AUTOINSTALL"] = "false"
                from deepface import DeepFace
                from ultralytics import YOLO

                self.detector = YOLO(str(weights))
                DeepFace.build_model(model_name="Emotion", task="facial_attribute")
                self.deepface = DeepFace
                self.status = "ready"
                logger.info("Emotion models ready")
            except Exception:
                self.status = "error"
                logger.exception("Model initialization failed")

    def predict(self, rgb: np.ndarray) -> Prediction:
        if self.status != "ready":
            raise ModelUnavailable("The models are not ready. Check /api/health for setup status.")
        start = perf_counter()
        # Serialize CPU model calls; TensorFlow and YOLO objects are shared between requests.
        with self._lock:
            bgr = np.ascontiguousarray(rgb[:, :, ::-1])
            result = self.detector.predict(
                bgr, conf=self.settings.detection_threshold, imgsz=640,
                max_det=self.settings.max_faces + 1, device="cpu", verbose=False,
            )[0]
            height, width = bgr.shape[:2]
            boxes = result.boxes.xyxy.cpu().numpy()
            confidences = result.boxes.conf.cpu().numpy()
            messages = []
            if len(boxes) > self.settings.max_faces:
                messages.append(f"Only the first {self.settings.max_faces} detected faces were analyzed.")
            # Spatial order gives stable person numbers in the photo and results list.
            detections = sorted(zip(boxes[:self.settings.max_faces], confidences), key=lambda d: (d[0][0], d[0][1]))
            faces = []
            for box, detection_score in detections:
                x1, y1, x2, y2 = map(int, box)
                x1, x2 = max(0, x1), min(width, x2)
                y1, y2 = max(0, y1), min(height, y2)
                if x2 <= x1 or y2 <= y1:
                    continue
                crop = bgr[y1:y2, x1:x2]
                # YOLO already isolated the face. Skip a second face detector on the crop.
                analysis = self.deepface.analyze(
                    crop, actions=["emotion"], detector_backend="skip",
                    enforce_detection=False, align=False, silent=True,
                )[0]
                raw = {emotion: max(0.0, float(analysis["emotion"][emotion])) for emotion in EMOTIONS}
                total = sum(raw.values())
                if total <= 0 or not np.isfinite(list(raw.values())).all():
                    raise RuntimeError("The emotion model returned invalid scores.")
                scores = {emotion: value / total for emotion, value in raw.items()}
                emotion = max(scores, key=scores.get)
                faces.append(FacePrediction(
                    id=len(faces) + 1, box=(x1, y1, x2, y2), emotion=emotion,
                    score=scores[emotion], detection_score=float(detection_score), scores=scores,
                ))
        return Prediction(
            image={"width": width, "height": height}, group=summarize(faces), faces=faces,
            elapsed_ms=round((perf_counter() - start) * 1000, 1), warnings=messages,
        )
