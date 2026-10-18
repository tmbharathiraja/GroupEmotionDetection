import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from .config import Settings
from .images import InvalidImage, decode_image
from .inference import EmotionEngine, ModelUnavailable
from .limits import BodyLimitMiddleware
from .schemas import Prediction

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, engine=None) -> FastAPI:
    settings = settings or Settings()
    engine = engine or EmotionEngine(settings)

    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(asyncio.to_thread(engine.load))
        yield
        await task

    app = FastAPI(title="GroupEmotion API", version="1.0.0", lifespan=lifespan)
    app.state.engine = engine
    # One model invocation at a time; excess concurrent requests get an actionable response.
    app.state.busy = False
    app.add_middleware(
        CORSMiddleware, allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
    )

    app.add_middleware(BodyLimitMiddleware, max_bytes=settings.max_upload_bytes + 65536)

    @app.get("/api/health")
    def health():
        return {
            "status": engine.status,
            "model": "YOLOv8n-face + DeepFace Emotion",
            "setup": "python scripts/download_models.py" if engine.status == "setup_required" else None,
        }

    @app.post("/api/predict", response_model=Prediction)
    async def predict(file: UploadFile = File(...)):
        try:
            data = await file.read(settings.max_upload_bytes + 1)
        finally:
            await file.close()
        if len(data) > settings.max_upload_bytes:
            raise HTTPException(413, "Choose a photo smaller than 10 MB.")
        try:
            image = await run_in_threadpool(decode_image, data, settings)
        except InvalidImage as exc:
            raise HTTPException(422, str(exc)) from exc
        if engine.status != "ready":
            raise HTTPException(503, "The models are not ready yet. Wait for model setup to finish, then try again.")
        if app.state.busy:
            raise HTTPException(429, "Another photo is being analyzed. Please try again in a moment.")
        app.state.busy = True
        try:
            return await run_in_threadpool(engine.predict, image)
        except ModelUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc
        except Exception as exc:
            logger.exception("Photo inference failed")
            raise HTTPException(500, "Analysis failed. Try a clearer photo or check the backend logs.") from exc
        finally:
            app.state.busy = False

    return app


app = create_app()
