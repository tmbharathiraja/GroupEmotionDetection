"""Exercise real pretrained inference through the running API."""
import argparse
import json
import math
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument("--image", type=Path, default=Path(__file__).resolve().parents[1] / "react-frontend/public/sample-crew.jpg")
    parser.add_argument("--save", type=Path)
    args = parser.parse_args()
    started = time.monotonic()
    while time.monotonic() - started < 240:
        try:
            with urlopen(args.base_url + "/api/health", timeout=10) as response:
                health = json.load(response)
            if health["status"] == "ready":
                break
            if health["status"] in {"setup_required", "error"}:
                raise RuntimeError(f"Model initialization needs attention: {health['status']}")
        except (URLError, TimeoutError):
            pass
        time.sleep(2)
    else:
        raise RuntimeError("Timed out waiting for the models to become ready.")
    boundary = "GroupEmotionSmokeBoundary"
    data = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.jpg"\r\n'
        'Content-Type: image/jpeg\r\n\r\n'
    ).encode() + args.image.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    request = Request(args.base_url + "/api/predict", data=data, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urlopen(request, timeout=120) as response:
        result = json.load(response)
    assert result["faces"], "The sample should yield at least one detected face."
    assert sum(result["group"]["counts"].values()) == len(result["faces"])
    assert 0 < result["group"]["agreement"] <= 1
    for face in result["faces"]:
        assert len(face["scores"]) == 7
        assert all(math.isfinite(score) and 0 <= score <= 1 for score in face["scores"].values())
        assert math.isclose(sum(face["scores"].values()), 1, abs_tol=1e-5)
        x1, y1, x2, y2 = face["box"]
        assert 0 <= x1 < x2 <= result["image"]["width"]
        assert 0 <= y1 < y2 <= result["image"]["height"]
    if args.save:
        args.save.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"faces": len(result["faces"]), "group": result["group"], "elapsed_ms": result["elapsed_ms"]}, indent=2))


if __name__ == "__main__":
    main()
