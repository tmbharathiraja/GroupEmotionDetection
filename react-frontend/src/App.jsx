import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Focus,
  ImagePlus,
  LoaderCircle,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";

const EMOTIONS = [
  "happy",
  "neutral",
  "sad",
  "angry",
  "fear",
  "surprise",
  "disgust",
];
const LABELS = {
  happy: "Happy",
  neutral: "Neutral",
  sad: "Sad",
  angry: "Angry",
  fear: "Fear",
  surprise: "Surprise",
  disgust: "Disgust",
};
const COLORS = {
  happy: "#70a548",
  neutral: "#7c91a3",
  sad: "#678bc8",
  angry: "#cf785e",
  fear: "#a48ab8",
  surprise: "#d6ac4d",
  disgust: "#799481",
};
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const INITIAL = { status: "connecting" };

export function validateFile(file) {
  if (!ACCEPTED.includes(file.type))
    return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > 10 * 1024 * 1024) return "Choose a photo smaller than 10 MB.";
  return null;
}

function Expression({ emotion, className = "" }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={`expression ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="16" r="1.5" fill="currentColor" />
      <circle cx="26" cy="16" r="1.5" fill="currentColor" />
      {emotion === "happy" ? (
        <path
          d="M12 24Q20 34 28 24"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : emotion === "sad" ? (
        <path
          d="M13 29Q20 22 27 29"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : ["surprise", "fear"].includes(emotion) ? (
        <ellipse
          cx="20"
          cy="27"
          rx="3"
          ry="4"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="M14 26H26"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function Pipeline() {
  return (
    <section className="pipeline" id="how-it-works">
      <div className="section-heading">
        <div>
          <span className="eyebrow">BEHIND THE PREDICTION</span>
          <h2>From faces to a group expression.</h2>
        </div>
        <span className="muted">Three steps. One transparent pipeline.</span>
      </div>
      <div className="pipeline-steps">
        {[
          [
            ScanFace,
            "01",
            "Find the faces",
            "YOLOv8n-face locates individual faces in your photo, even when there’s more than one person.",
          ],
          [
            Sparkles,
            "02",
            "Read each expression",
            "DeepFace classifies each face across seven expression labels and returns its model scores.",
          ],
          [
            Users,
            "03",
            "Bring it together",
            "A majority vote gives the group label. Explore every face to see where the result comes from.",
          ],
        ].map(([Icon, number, title, text]) => (
          <article className="pipeline-step" key={number}>
            <div className="step-top">
              <Icon size={24} strokeWidth={1.4} />
              <span>{number}</span>
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [health, setHealth] = useState(INITIAL);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [selectedFace, setSelectedFace] = useState(null);
  const [phase, setPhase] = useState(0);
  const [sampleLoading, setSampleLoading] = useState(false);
  const input = useRef(null);
  const request = useRef(null);
  const currentFile = useRef(0);

  useEffect(() => {
    let active = true;
    let timer;
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (active) setHealth(body);
      } catch {
        if (active) setHealth({ status: "offline" });
      }
      if (active) timer = setTimeout(check, 5000);
    }
    check();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!busy) {
      setPhase(0);
      return;
    }
    const timer = setInterval(() => setPhase((p) => Math.min(p + 1, 2)), 1800);
    return () => clearInterval(timer);
  }, [busy]);

  const ready = health.status === "ready";
  const healthLabel =
    {
      ready: "Models ready",
      connecting: "Connecting to API",
      loading: "Models warming up",
      setup_required: "Model setup needed",
      offline: "API offline",
      error: "Model load failed",
    }[health.status] || "Checking models";

  function choose(next) {
    if (!next) return;
    const issue = validateFile(next);
    if (issue) {
      setError(issue);
      return;
    }
    request.current?.abort();
    currentFile.current += 1;
    setFile(next);
    setResult(null);
    setError("");
    setBusy(false);
    setSelectedFace(null);
  }

  function reset() {
    request.current?.abort();
    currentFile.current += 1;
    setFile(null);
    setResult(null);
    setError("");
    setBusy(false);
    setSelectedFace(null);
    if (input.current) input.current.value = "";
  }

  async function loadSample() {
    setSampleLoading(true);
    const generation = currentFile.current;
    try {
      const response = await fetch("/sample-crew.jpg");
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (generation === currentFile.current)
        choose(
          new File([blob], "NASA-crew-sample.jpg", { type: "image/jpeg" }),
        );
    } catch {
      setError(
        "The sample photo could not be loaded. Try uploading your own photo.",
      );
    } finally {
      setSampleLoading(false);
    }
  }

  async function analyze() {
    if (!file || busy) return;
    const generation = currentFile.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    setSelectedFace(null);
    const body = new FormData();
    body.append("file", file);
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Analysis failed. Please try again.",
        );
      if (generation === currentFile.current) setResult(data);
    } catch (exception) {
      if (generation === currentFile.current)
        setError(
          exception.name === "AbortError"
            ? "Analysis took too long. Try a smaller photo with fewer faces."
            : exception.message ||
                "Could not reach the API. Check that the backend is running.",
        );
    } finally {
      clearTimeout(timeout);
      if (generation === currentFile.current) setBusy(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "groupemotion-result.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <header className="header shell">
        <a className="brand" href="#" aria-label="GroupEmotion home">
          <span className="brand-icon">
            <Focus size={25} strokeWidth={1.6} />
          </span>
          group<span className="brand-light">emotion</span>
          <span className="brand-dot">.</span>
        </a>
        <nav>
          <a href="#how-it-works">
            How it works <ArrowUpRight size={14} />
          </a>
          <span className="project-tag">A COMPUTER VISION PROJECT</span>
        </nav>
      </header>
      <main className="shell">
        <section className="hero">
          <div>
            <div className="eyebrow hero-eyebrow">
              <span className="tiny-line" /> A PICTURE OF THE ROOM
            </div>
            <h1>
              One photo.
              <br />A shared <span>expression.</span>
            </h1>
            <p>
              Find the faces. Explore the expressions.
              <br className="desktop-break" /> See how individual moments add up
              to a group emotion.
            </p>
            <a className="text-link" href="#workspace">
              Give your photo a closer look <ArrowDown size={16} />
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-grid" />
            <span className="art-label">
              EVERY FACE TELLS PART OF THE STORY
            </span>
            <div className="art-face face-one">
              <i className="corner c1" />
              <i className="corner c2" />
              <i className="corner c3" />
              <i className="corner c4" />
              <Expression emotion="happy" />
              <span>01 / HAPPY</span>
            </div>
            <div className="art-face face-two">
              <i className="corner c1" />
              <i className="corner c2" />
              <i className="corner c3" />
              <i className="corner c4" />
              <Expression emotion="neutral" />
              <span>02 / NEUTRAL</span>
            </div>
            <div className="art-face face-three">
              <i className="corner c1" />
              <i className="corner c2" />
              <i className="corner c3" />
              <i className="corner c4" />
              <Expression emotion="happy" />
              <span>03 / HAPPY</span>
            </div>
            <span className="art-footnote">
              INDIVIDUAL SIGNALS → SHARED EXPRESSION
            </span>
          </div>
        </section>

        <section
          className="workspace"
          id="workspace"
          aria-label="Photo analysis workspace"
        >
          <div className="workspace-header">
            <div className="workspace-title">
              <span className="live-dot" />
              <h2>The expression lab</h2>
              <span className="version">01</span>
            </div>
            <span
              className={`model-status ${ready ? "is-ready" : ""}`}
              role="status"
            >
              <span />
              {healthLabel}
            </span>
          </div>
          <div className="workspace-body">
            <div className="photo-panel">
              <div className="panel-label">
                <span>
                  01 <b>YOUR PHOTO</b>
                </span>
                <span>JPEG, PNG, WEBP · UP TO 10 MB</span>
              </div>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="visually-hidden"
                aria-label="Upload a group photo"
                onChange={(event) => {
                  choose(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {!file ? (
                <button
                  className={`dropzone ${dragging ? "dragging" : ""}`}
                  onClick={() => input.current.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    choose(event.dataTransfer.files?.[0]);
                  }}
                >
                  <div className="upload-illustration">
                    <span />
                    <ImagePlus size={37} strokeWidth={1.2} />
                    <span />
                  </div>
                  <h3>A group photo goes here.</h3>
                  <p>Drag and drop your image, or browse to upload.</p>
                  <span className="upload-cta">
                    <Upload size={16} /> Choose a photo <ArrowRight size={16} />
                  </span>
                  <span className="drop-hint">
                    Clear, front-facing photos work best.
                  </span>
                </button>
              ) : (
                <div className="selected-photo">
                  <div className={`image-stage ${busy ? "scanning" : ""}`}>
                    <div className="image-relative">
                      <img
                        src={preview}
                        alt="Uploaded photo for expression analysis"
                        onError={() =>
                          setError(
                            "Your browser could not preview this image. Try another photo.",
                          )
                        }
                      />
                      {result &&
                        showBoxes &&
                        result.faces.map((face) => (
                          <button
                            key={face.id}
                            className={`face-box ${selectedFace === face.id ? "active" : ""}`}
                            style={{
                              left: `${(face.box[0] / result.image.width) * 100}%`,
                              top: `${(face.box[1] / result.image.height) * 100}%`,
                              width: `${((face.box[2] - face.box[0]) / result.image.width) * 100}%`,
                              height: `${((face.box[3] - face.box[1]) / result.image.height) * 100}%`,
                              "--face-color": COLORS[face.emotion],
                            }}
                            onClick={() => setSelectedFace(face.id)}
                            aria-label={`Person ${face.id}: ${LABELS[face.emotion]}`}
                          >
                            <span>
                              {face.id} · {LABELS[face.emotion]}
                            </span>
                          </button>
                        ))}
                    </div>
                    {busy && <div className="scan-line" />}
                  </div>
                  <div className="file-bar">
                    <div>
                      <Check size={15} />
                      <span title={file.name}>{file.name}</span>
                      <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
                    </div>
                    <button
                      className="icon-button"
                      onClick={reset}
                      aria-label="Remove photo"
                    >
                      <X size={17} />
                    </button>
                  </div>
                </div>
              )}
              <div className="photo-actions">
                <span>
                  <ShieldCheck size={15} /> Your photo isn’t kept after
                  analysis.
                </span>
                {file ? (
                  <button
                    className="subtle-button"
                    onClick={() => input.current.click()}
                    disabled={busy}
                  >
                    Change photo
                  </button>
                ) : (
                  <button
                    className="subtle-button"
                    onClick={loadSample}
                    disabled={sampleLoading}
                  >
                    {sampleLoading ? "Loading sample…" : "Try a sample"}{" "}
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
              {file?.name === "NASA-crew-sample.jpg" && (
                <p className="sample-credit">
                  Sample: NASA/Nick Hague ·{" "}
                  <a
                    href="https://www.nasa.gov/image-article/nasas-spacex-crew-9-members-pose-for-portrait/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Photo source <ArrowUpRight size={10} />
                  </a>
                </p>
              )}
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              {!ready && (
                <div className="connection-note">
                  {health.status === "loading" || health.status === "connecting"
                    ? "The inference service is starting. This can take a minute on the first run."
                    : health.status === "setup_required"
                      ? "Download the pretrained models, then restart the backend. See the project README for setup."
                      : "Start the backend to enable analysis. See the project README for local setup."}
                </div>
              )}
              <button
                className="analyze-button"
                onClick={analyze}
                disabled={!file || !ready || busy}
              >
                {busy ? (
                  <>
                    <LoaderCircle size={19} className="spin" /> Analyzing
                    expressions…
                  </>
                ) : (
                  <>
                    <ScanFace size={19} /> Analyze group emotion{" "}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              <p className="processing-note">
                YOLOv8n-face <ChevronRight size={12} /> DeepFace{" "}
                <ChevronRight size={12} /> Majority vote
              </p>
            </div>

            <div className="results-panel" aria-live="polite" aria-busy={busy}>
              <div className="panel-label">
                <span>
                  02 <b>THE GROUP PICTURE</b>
                </span>
                {result ? (
                  <button className="download-button" onClick={download}>
                    <Download size={14} /> Export JSON
                  </button>
                ) : (
                  <span>
                    {busy
                      ? "ANALYZING PHOTO"
                      : file
                        ? "READY FOR ANALYSIS"
                        : "WAITING FOR YOUR PHOTO"}
                  </span>
                )}
              </div>
              {busy ? (
                <div className="results-empty">
                  <div className="empty-radar">
                    <ScanFace size={41} strokeWidth={1} className="pulse" />
                  </div>
                  <h3>
                    {
                      [
                        "Finding the faces…",
                        "Reading individual expressions…",
                        "Putting the group picture together…",
                      ][phase]
                    }
                  </h3>
                  <p>
                    Running the models on your photo.
                    <br />
                    Larger groups may take a little longer.
                  </p>
                  <div className="progress-steps">
                    {[0, 1, 2].map((step) => (
                      <span
                        key={step}
                        className={step <= phase ? "done" : ""}
                      />
                    ))}
                  </div>
                </div>
              ) : !result ? (
                <div className="results-empty">
                  <div className="empty-radar">
                    <Users size={39} strokeWidth={1} />
                  </div>
                  <h3>Meet your group’s expression.</h3>
                  <p>
                    Upload a photo to uncover the individual
                    <br />
                    expressions that make up the group.
                  </p>
                  <span className="empty-caption">
                    SEVEN EXPRESSIONS. A LITTLE MORE PERSPECTIVE.
                  </span>
                  <div className="emotion-dots">
                    {EMOTIONS.map((emotion) => (
                      <span
                        key={emotion}
                        style={{ background: COLORS[emotion] }}
                        title={LABELS[emotion]}
                      />
                    ))}
                  </div>
                </div>
              ) : result.faces.length === 0 ? (
                <div className="results-empty">
                  <div className="empty-radar">
                    <Focus size={40} strokeWidth={1} />
                  </div>
                  <h3>No faces found this time.</h3>
                  <p>
                    Try a brighter photo with larger,
                    <br />
                    front-facing faces.
                  </p>
                  <button
                    className="subtle-button"
                    onClick={() => input.current.click()}
                  >
                    Choose another photo <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="prediction-content">
                  <div className="group-result">
                    <div
                      className="result-emotion"
                      style={{ color: COLORS[result.group.emotion] }}
                    >
                      <Expression emotion={result.group.emotion} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        PREDICTED GROUP EXPRESSION
                      </span>
                      <h3>
                        {LABELS[result.group.emotion]}
                        <span>.</span>
                      </h3>
                      <p>
                        {Math.round(result.group.agreement * 100)}% of detected
                        faces share this label
                      </p>
                    </div>
                  </div>
                  <div className="result-stats">
                    <span>
                      <Users size={15} />
                      <b>{result.faces.length}</b>{" "}
                      {result.faces.length === 1 ? "face" : "faces"} detected
                    </span>
                    <span>
                      {(result.elapsed_ms / 1000).toFixed(2)}s{" "}
                      <span className="muted">inference</span>
                    </span>
                  </div>
                  {result.group.tied && (
                    <p className="tie-note">
                      The vote was tied. Combined model scores chose the final
                      label.
                    </p>
                  )}
                  <div className="distribution">
                    <div className="small-heading">
                      EXPRESSION BREAKDOWN <span>Share of faces</span>
                    </div>
                    {EMOTIONS.map((emotion) => {
                      const count = result.group.counts[emotion];
                      return (
                        <div className="distribution-row" key={emotion}>
                          <span>
                            <i style={{ background: COLORS[emotion] }} />
                            {LABELS[emotion]}
                          </span>
                          <div className="distribution-track">
                            <div
                              style={{
                                width: `${(count / result.faces.length) * 100}%`,
                                background: COLORS[emotion],
                              }}
                            />
                          </div>
                          <b>{count}</b>
                          <small>
                            {Math.round((count / result.faces.length) * 100)}%
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  <div className="face-section">
                    <div className="small-heading">
                      A FACE-BY-FACE LOOK{" "}
                      <label>
                        <input
                          type="checkbox"
                          checked={showBoxes}
                          onChange={(event) =>
                            setShowBoxes(event.target.checked)
                          }
                        />{" "}
                        Show boxes
                      </label>
                    </div>
                    <div className="face-list">
                      {result.faces.map((face) => (
                        <button
                          key={face.id}
                          className={`face-card ${selectedFace === face.id ? "selected" : ""}`}
                          onClick={() =>
                            setSelectedFace(
                              selectedFace === face.id ? null : face.id,
                            )
                          }
                          aria-pressed={selectedFace === face.id}
                        >
                          <span
                            className="person-number"
                            style={{ color: COLORS[face.emotion] }}
                          >
                            {String(face.id).padStart(2, "0")}
                          </span>
                          <span>
                            Person {face.id}
                            <strong>{LABELS[face.emotion]}</strong>
                          </span>
                          <span className="face-score">
                            {Math.round(face.score * 100)}%
                            <small>model score</small>
                          </span>
                        </button>
                      ))}
                    </div>
                    {selectedFace && (
                      <div className="person-detail">
                        <span>Person {selectedFace} · all model scores</span>
                        {EMOTIONS.map((emotion) => (
                          <span key={emotion}>
                            {LABELS[emotion]}{" "}
                            <b>
                              {Math.round(
                                result.faces.find(
                                  (face) => face.id === selectedFace,
                                ).scores[emotion] * 100,
                              )}
                              %
                            </b>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {result?.warnings.map((message) => (
                <p className="tie-note" key={message}>
                  {message}
                </p>
              ))}
              <div className="result-footnote">
                <CircleHelp size={15} />
                <p>
                  Expressions are visual cues, not a window into someone’s
                  feelings. Model scores and vote share are not certainty.
                </p>
              </div>
            </div>
          </div>
        </section>
        <Pipeline />
        <section className="project-note">
          <span className="note-icon">
            <Focus size={24} strokeWidth={1.2} />
          </span>
          <div>
            <h3>An experiment in seeing the bigger picture.</h3>
            <p>
              Built from a research project comparing face detectors, annotating
              group photos, and evaluating facial expression predictions. This
              demo makes that pipeline explorable, one photo at a time.
            </p>
          </div>
          <span className="note-tag">RESEARCH → INTERACTIVE DEMO</span>
        </section>
      </main>
      <footer className="shell footer">
        <span>
          groupemotion<span className="brand-dot">.</span>{" "}
          <span className="footer-divider">/</span> Built by Raj Muniraju
        </span>
        <span>
          Computer vision, with a human perspective. <ArrowUpRight size={14} />
        </span>
      </footer>
    </>
  );
}
