FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    MODEL_DIR=/app/.models DEEPFACE_HOME=/app/.models \
    TF_USE_LEGACY_KERAS=1 TF_CPP_MIN_LOG_LEVEL=2 YOLO_CONFIG_DIR=/tmp/ultralytics YOLO_AUTOINSTALL=false
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt /app/requirements.txt
# CPU wheels avoid pulling CUDA runtimes on Linux.
RUN pip install --no-cache-dir torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt
COPY backend/app /app/app
COPY scripts/download_models.py /app/scripts/download_models.py
COPY scripts/start_backend.sh /app/start_backend.sh
RUN useradd --create-home --uid 10001 appuser && mkdir -p /app/.models && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=4 \
  CMD python -c "import json,urllib.request; d=json.load(urllib.request.urlopen('http://127.0.0.1:8000/api/health')); assert d['status']=='ready'"
CMD ["sh", "/app/start_backend.sh"]
