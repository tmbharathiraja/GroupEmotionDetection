import io
from dataclasses import replace

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.aggregation import summarize
from app.config import Settings
from app.images import InvalidImage, decode_image
from app.main import create_app
from app.inference import EmotionEngine
from app.schemas import EMOTIONS, FacePrediction, Prediction


def face(emotion="happy", **scores):
    values = {key: 0.0 for key in EMOTIONS}
    values.update({emotion: 0.8, **scores})
    return FacePrediction(id=1, box=(1, 2, 30, 40), emotion=emotion, score=values[emotion], detection_score=0.9, scores=values)


def image_bytes(size=(80, 60), fmt="PNG", **kwargs):
    output = io.BytesIO()
    Image.new("RGB", size, "white").save(output, format=fmt, **kwargs)
    return output.getvalue()


class Engine:
    status = "ready"

    def load(self):
        pass

    def predict(self, rgb):
        return Prediction(image={"width": rgb.shape[1], "height": rgb.shape[0]}, group=summarize([]), faces=[], elapsed_ms=1, warnings=[])


@pytest.fixture
def client():
    with TestClient(create_app(engine=Engine())) as client:
        yield client


def test_majority_vote_reports_share_instead_of_model_confidence():
    summary = summarize([face(), face(), face("sad")])
    assert summary.emotion == "happy"
    assert summary.agreement == pytest.approx(2 / 3)
    assert summary.counts["happy"] == 2
    assert summary.tied is False


def test_tie_uses_combined_scores_and_is_reported():
    summary = summarize([face("happy", sad=0.1), face("sad", sad=0.95, happy=0.01)])
    assert summary.emotion == "sad"
    assert summary.tied is True
    assert summary.agreement == 0.5


def test_no_faces_does_not_invent_a_neutral_prediction():
    summary = summarize([])
    assert summary.emotion == "no_faces"
    assert summary.agreement == 0
    assert sum(summary.counts.values()) == 0


def test_missing_weights_have_an_explicit_setup_state(tmp_path):
    engine = EmotionEngine(replace(Settings(), model_dir=tmp_path))
    engine.load()
    assert engine.status == "setup_required"


def test_api_accepts_a_real_image_and_preserves_no_faces(client):
    response = client.post("/api/predict", files={"file": ("photo.png", image_bytes(), "image/png")})
    assert response.status_code == 200
    assert response.json()["group"]["emotion"] == "no_faces"
    assert response.json()["image"] == {"width": 80, "height": 60}


def test_invalid_bytes_are_rejected_even_with_an_image_extension(client):
    response = client.post("/api/predict", files={"file": ("photo.jpg", b"not a photo", "image/jpeg")})
    assert response.status_code == 422


def test_unsupported_image_format_is_rejected(client):
    response = client.post("/api/predict", files={"file": ("photo.gif", image_bytes(fmt="GIF"), "image/gif")})
    assert response.status_code == 422


def test_upload_limit_is_enforced():
    with TestClient(create_app(settings=replace(Settings(), max_upload_bytes=128), engine=Engine())) as client:
        response = client.post("/api/predict", files={"file": ("big.jpg", b"x" * 129, "image/jpeg")})
    assert response.status_code == 413


def test_streaming_body_without_content_length_is_bounded():
    settings = replace(Settings(), max_upload_bytes=128)
    body = (
        b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\n'
        b'Content-Type: image/png\r\n\r\n' + b"x" * 70000 + b"\r\n--boundary--\r\n"
    )
    with TestClient(create_app(settings=settings, engine=Engine())) as client:
        response = client.post(
            "/api/predict", content=iter([body]),
            headers={"Content-Type": "multipart/form-data; boundary=boundary"},
        )
    assert response.status_code == 413


def test_unready_models_are_reported_with_503():
    engine = Engine()
    engine.status = "loading"
    with TestClient(create_app(engine=engine)) as client:
        assert client.get("/api/health").json()["status"] == "loading"
        response = client.post("/api/predict", files={"file": ("photo.png", image_bytes(), "image/png")})
    assert response.status_code == 503


def test_backend_failure_returns_actionable_error_without_internal_details():
    engine = Engine()
    def fail(_):
        raise RuntimeError("private model path")
    engine.predict = fail
    with TestClient(create_app(engine=engine)) as client:
        response = client.post("/api/predict", files={"file": ("photo.png", image_bytes(), "image/png")})
        assert client.app.state.busy is False
    assert response.status_code == 500
    assert "private model path" not in response.text


def test_busy_service_does_not_queue_unbounded_inference(client):
    client.app.state.busy = True
    response = client.post("/api/predict", files={"file": ("photo.png", image_bytes(), "image/png")})
    assert response.status_code == 429


def test_decode_rotates_using_exif_and_limits_resolution():
    exif = Image.Exif()
    exif[274] = 6
    rgb = decode_image(image_bytes((100, 50), "JPEG", exif=exif), replace(Settings(), max_dimension=80))
    assert rgb.shape == (80, 40, 3)
    assert rgb.dtype == np.uint8


def test_decode_rejects_decompressed_size_limit():
    with pytest.raises(InvalidImage, match="too large"):
        decode_image(image_bytes(), replace(Settings(), max_pixels=100))
