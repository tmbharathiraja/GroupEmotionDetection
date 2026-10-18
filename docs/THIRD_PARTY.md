# Model and asset sources

| Component | Source | Notes |
| --- | --- | --- |
| YOLOv8n-face weights | [deepghs/yolo-face](https://huggingface.co/deepghs/yolo-face) | The downloader pins repository revision `e3662574830c534dfcc9c3b7ea4d89272f8aae4e`. See the model repository for its license and provenance. |
| YOLO runtime | [Ultralytics](https://github.com/ultralytics/ultralytics) | AGPL-3.0; see upstream license and model terms. |
| Emotion model | [DeepFace model release](https://github.com/serengil/deepface_models/releases/tag/v1.0) | `facial_expression_model_weights.h5`, used by DeepFace Emotion. |
| DeepFace runtime | [serengil/deepface](https://github.com/serengil/deepface) | MIT; upstream documentation describes model attribution. |
| Icons | [Lucide](https://lucide.dev/) | ISC license. |
| Fonts | [DM Sans](https://fonts.google.com/specimen/DM+Sans), [Manrope](https://fonts.google.com/specimen/Manrope) | SIL Open Font License. Loaded from Google Fonts with system fallbacks. |
| Sample crew photo | [NASA, Crew-9 portrait](https://www.nasa.gov/image-article/nasas-spacex-crew-9-members-pose-for-portrait/) | Credit: NASA/Nick Hague; image `iss072e645464`. Resized copy included for the demo. See [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). No endorsement is implied. |

Model binaries are downloaded into the ignored `.models/` directory rather than committed to Git. The downloader checks a pinned SHA-256 for each weight file and records the digest and source URL in `.models/manifest.json`. Upstream components retain their own terms.
