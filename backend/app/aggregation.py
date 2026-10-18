from collections import Counter

from .schemas import EMOTIONS, FacePrediction, GroupSummary


def summarize(faces: list[FacePrediction]) -> GroupSummary:
    """Vote over face labels. Break ties by mean model score, then label order."""
    counts = {emotion: 0 for emotion in EMOTIONS}
    counts.update(Counter(face.emotion for face in faces))
    if not faces:
        return GroupSummary(emotion="no_faces", agreement=0, counts=counts, tied=False)
    highest = max(counts.values())
    candidates = [emotion for emotion in EMOTIONS if counts[emotion] == highest]
    winner = max(candidates, key=lambda e: sum(face.scores[e] for face in faces))
    return GroupSummary(
        emotion=winner, agreement=highest / len(faces), counts=counts, tied=len(candidates) > 1
    )
