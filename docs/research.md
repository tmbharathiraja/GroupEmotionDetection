# Research foundation

The web application is derived from Raj Muniraju's GroupEmotion research in May 2025. The cleaned [notebook](../research/EmotionRecognition.ipynb) retains the original experiments, with outputs and Colab execution metadata removed. It is a research record, not the application entrypoint.

Original sources: [GroupEmotion Drive folder](https://drive.google.com/drive/folders/1DvlJ8Wro3RFtMAYAjnX-L8-_ok_KGOfb), [project report](https://docs.google.com/document/d/1skD0War6RksUvDlpj6g8gHU5qrcxgD56vK1MYvdTDys/edit). Access to these links follows the owner's Drive sharing settings.

## Dataset and labeling

The report describes 3,083 scraped group photos. SHA-1 deduplication removed 144 exact duplicates, retaining 2,939 unique images. An approximately 5% subset was pre-annotated with RetinaFace and DeepFace, then manually corrected in Label Studio. Dataset photos and personal annotations are not distributed in this repository.

## Original reported evaluation

| Level | Accuracy | Weighted precision | Weighted recall | Weighted F1 |
| --- | --- | --- | --- | --- |
| Individual faces | 0.597 | 0.615 | 0.597 | 0.602 |
| Group label | 0.537 | 0.681 | 0.537 | 0.584 |

These are historical research results from the report, not a fresh benchmark of the web application. The notebook greedily matches predictions to ground truth at IoU ≥ 0.5. **Only matched faces enter classification metrics; unmatched detections and missed faces are excluded.** The group evaluation also votes over these matched faces, and includes only images with a match. Consequently, these figures do not measure end-to-end detection accuracy or group classification across every original image.

The report's 49-image exploratory timing comparison measured YOLOv8n-face + DeepFace at 0.528 seconds/image and RetinaFace + DeepFace at 9.024 seconds/image in its original environment. Those times depend on hardware and image content; the app displays its own measured request inference time.

## What carries into the app

- The chosen pipeline: YOLOv8n-face with confidence threshold 0.3 and detector input size 640, followed by DeepFace Emotion and majority voting.
- The same seven expression labels: happy, neutral, sad, angry, fear, surprise, and disgust.
- DeepFace 0.0.93 to align with the original experiment's environment.

## Changes for serving

- YOLO crops are passed to DeepFace with `detector_backend="skip"`, avoiding a second face detector inside each already isolated face crop. The notebook used DeepFace's default detector on crops, so application outputs need not exactly reproduce the historical metrics.
- Image orientation is corrected from EXIF; images are bounded to 1,920 pixels on the longest edge before detection. Bounding boxes refer to this processed image.
- Majority ties are broken using summed class scores across analyzed faces, then fixed label order for exact score ties. The response marks ties explicitly. The notebook selected the first label encountered in a vote tie.
- No detected face produces `no_faces`, never a fabricated neutral label.
- Up to 64 faces are classified per image. Larger detections generate an explicit warning.

## Limits of the result

Facial expression labels are model predictions about visible cues. They do not establish a person's actual feelings. Group majority vote compresses differences between people and does not account for scene context. A score of 90% is not a calibrated 90% probability of a person's emotional state.

The original review found difficulties with small faces, steep viewing angles, children, low light, darker skin tones in low-contrast conditions, posters/screens, happy–fear confusion, and sad–neutral ambiguity. The demo is intended for exploration and portfolio demonstration, not decisions about people.

## Useful next experiments

Evaluate on a separate holdout set with detection precision/recall, count unmatched faces, compute group accuracy over all images, and stratify errors by lighting, face size, and pose. Compare majority voting against confidence weighting without presenting softmax scores as calibrated certainty.
