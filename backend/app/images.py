import io
import warnings

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import Settings


class InvalidImage(ValueError):
    pass


def decode_image(data: bytes, settings: Settings) -> np.ndarray:
    """Decode verified bytes, apply EXIF rotation, and return bounded RGB pixels."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as original:
                if original.format not in {"JPEG", "PNG", "WEBP"}:
                    raise InvalidImage("Choose a JPEG, PNG, or WebP image.")
                if original.width * original.height > settings.max_pixels:
                    raise InvalidImage("This image is too large. Use a photo under 25 megapixels.")
                if min(original.size) < 32:
                    raise InvalidImage("This image is too small. Both dimensions must be at least 32 pixels.")
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.thumbnail((settings.max_dimension, settings.max_dimension))
                return np.asarray(image)
    except InvalidImage:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise InvalidImage("This image is too large to process.") from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImage("That file could not be read as a photo. Try a different image.") from exc
