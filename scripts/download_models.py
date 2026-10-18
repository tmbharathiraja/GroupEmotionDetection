"""Download the two pretrained models. No dataset or user photos are downloaded."""
import hashlib
import json
import os
from pathlib import Path
from urllib.request import urlopen

MODEL_DIR = Path(os.environ.get("MODEL_DIR", Path(__file__).resolve().parents[1] / ".models"))
REVISION = "e3662574830c534dfcc9c3b7ea4d89272f8aae4e"
MODELS = [
    ("yolov8n-face.pt", f"https://huggingface.co/deepghs/yolo-face/resolve/{REVISION}/yolov8n-face/model.pt", "6217b2550b792b789b3e42a55453c6c4326d6293d27f1a6ae56da715c9fbc668"),
    (".deepface/weights/facial_expression_model_weights.h5", "https://github.com/serengil/deepface_models/releases/download/v1.0/facial_expression_model_weights.h5", "e8e8851d3fa05c001b1c27fd8841dfe08d7f82bb786a53ad8776725b7a1e824c"),
]


def download_models():
    manifest = []
    for name, url, expected_sha256 in MODELS:
        target = MODEL_DIR / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.is_file():
            print(f"Downloading {target.name}…", flush=True)
            temporary = target.with_suffix(target.suffix + ".part")
            try:
                with urlopen(url, timeout=120) as response, temporary.open("wb") as output:
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if digest != expected_sha256:
            raise RuntimeError(f"Checksum mismatch for {target.name}. Remove it and rerun the downloader.")
        manifest.append({"file": name, "source": url, "sha256": digest})
        print(f"Ready: {target.name} ({target.stat().st_size:,} bytes)", flush=True)
    (MODEL_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    download_models()
