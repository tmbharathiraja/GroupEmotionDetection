.PHONY: setup models backend frontend test build
setup:
	uv venv --python 3.12 --allow-existing
	uv pip install --python .venv/bin/python -r backend/requirements-dev.txt
	cd react-frontend && npm ci
models:
	.venv/bin/python scripts/download_models.py
backend:
	.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8001
frontend:
	cd react-frontend && npm run dev
test:
	.venv/bin/pytest
	cd react-frontend && npm test
build:
	cd react-frontend && npm run build
