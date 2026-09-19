import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  ImagePlus,
  ArrowRight,
  ShieldCheck,
  LockKeyhole,
  ScanText,
  RotateCcw,
  AlertTriangle,
  Check,
  FileText,
} from "lucide-react";
import { useAuth } from "../app/AuthContext.jsx";
import {
  call,
  errorMessage,
  emulator,
  freeDeployment,
} from "../services/firebase.js";
import {
  ASSESSMENTS,
  INTERACTIONS,
  actionsFor,
  SOURCES,
} from "../../shared/catalog.js";
import {
  textSchema,
  codePoints,
  validateReport,
} from "../../shared/contracts.js";
export function Report({ report, interaction, onInteraction, onClear }) {
  const heading = useRef();
  useEffect(() => heading.current?.focus(), [report.requestId]);
  const actions = actionsFor(
    report.warnings.map((w) => w.ruleId),
    interaction,
  );
  const sources = [
    ...new Set([...report.warnings, ...actions].flatMap((w) => w.sourceIds)),
  ].map((id) => SOURCES[id]);
  return (
    <section
      className={`card report ${report.assessment}`}
      aria-label="Check results"
    >
      <div className="report-top">
        <span className="eyebrow">YOUR CHECK RESULTS</span>
        <span className="version">{report.rulesVersion}</span>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        {ASSESSMENTS[report.assessment]}
      </h2>
      <p>{report.summary}</p>
      <div className="first-action">
        <span className="eyebrow">YOUR FIRST STEP</span>
        <h3>{actions[0].title}</h3>
        <p>{actions[0].detail}</p>
      </div>
      <label className="context-edit">
        Already responded?
        <select
          value={interaction}
          onChange={(e) => onInteraction(e.target.value)}
        >
          {Object.entries(INTERACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <h3>
        What stood out <span className="count">{report.warnings.length}</span>
      </h3>
      {report.warnings.length === 0 ? (
        <p>
          No warning signs are listed. Limited patterns were checked;
          independently verify the request.
        </p>
      ) : (
        report.warnings.map((w) => (
          <article className="warning" key={w.ruleId}>
            <h4>
              <AlertTriangle size={17} />
              {w.title}
            </h4>
            {w.evidence.map((e, i) => (
              <blockquote key={i}>{e.quote}</blockquote>
            ))}
            <p>{w.explanation}</p>
            <div className="source-inline">
              {w.sourceIds.map((id) => (
                <a
                  key={id}
                  href={SOURCES[id].url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {SOURCES[id].title} ↗
                </a>
              ))}
            </div>
          </article>
        ))
      )}
      <h3>Next steps</h3>
      <ol className="steps">
        {actions.slice(1).map((a) => (
          <li key={a.id}>
            <strong>{a.title}</strong>
            <p>{a.detail}</p>
          </li>
        ))}
      </ol>
      <div className="limitations">
        <h3>What was not checked</h3>
        <ul>
          {report.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <h3>Trusted guidance</h3>
      <ul className="source-list">
        {sources.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title} ↗
            </a>
          </li>
        ))}
      </ul>
      <button className="secondary" onClick={onClear}>
        <RotateCcw size={16} />
        New check
      </button>
      <small className="request-id">Reference: {report.requestId}</small>
    </section>
  );
}
export function Checker() {
  const { user, clearSession, logout } = useAuth();
  const [mode, setMode] = useState("message"),
    [text, setText] = useState(""),
    [language, setLanguage] = useState("en"),
    [interaction, setInteraction] = useState("none"),
    [incomplete, setIncomplete] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(""),
    [report, setReport] = useState(null),
    [phase, setPhase] = useState("idle"),
    [error, setError] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  const op = useRef(0),
    input = useRef(),
    picker = useRef(),
    urls = useRef(new Set());
  const busy = ["extracting", "analyzing"].includes(phase);
  const allowed = user?.emailVerified;
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      op.current++;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  function invalidate() {
    op.current++;
    setReport(null);
    setError("");
    setPhase("editing");
  }
  function clear() {
    invalidate();
    setText("");
    setFile(null);
    setConfirmed(false);
    setLanguage("en");
    setInteraction("none");
    setIncomplete(false);
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    setPreview("");
    if (picker.current) picker.current.value = "";
    setPhase("idle");
  }
  function switchMode(next) {
    if (next === mode) return;
    if (
      (text || file) &&
      !window.confirm("Discard this draft and switch input type?")
    )
      return;
    clear();
    setMode(next);
  }
  async function selectFile(e) {
    const f = e.target.files?.[0];
    clear();
    if (!f) return;
    const token = op.current;
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
        f.size > 4 * 1024 * 1024
      )
        throw Error();
      const bitmap = await createImageBitmap(f);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 20000000) throw Error();
      if (token !== op.current) return;
      const url = URL.createObjectURL(f);
      urls.current.add(url);
      setFile(f);
      setPreview(url);
      setPhase("editing");
    } catch {
      if (token === op.current) {
        setError(
          "Choose one JPEG, PNG or WebP, up to 4 MiB and 20 megapixels.",
        );
        setPhase("recoverableError");
      }
    }
  }
  async function perform(kind) {
    if (!allowed || busy) return;
    if (!online) {
      setError("You are offline. Keep this tab open, reconnect and retry.");
      return;
    }
    if (
      kind === "analysis" &&
      (!textSchema.safeParse(text).success ||
        (mode === "screenshot" && !confirmed))
    ) {
      setError(
        "Enter 20–10,000 characters and confirm extracted text before checking.",
      );
      input.current?.focus();
      return;
    }
    const current = ++op.current;
    setReport(null);
    setError("");
    setPhase(kind === "ocr" ? "extracting" : "analyzing");
    try {
      if (kind === "ocr") {
        let result;
        if (freeDeployment) {
          const { extractLocal } = await import("../services/ocr.js");
          result = { extractedText: await extractLocal(file) };
        } else {
          const imageBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          if (current !== op.current) return;
          result = await call("extractScreenshot", {
            requestId: crypto.randomUUID(),
            imageBase64,
            mimeType: file.type,
          });
        }
        if (current !== op.current) return;
        setText(result.extractedText);
        setConfirmed(false);
        setPhase("reviewing");
        if (!result.extractedText.trim())
          setError(
            "No readable text was extracted. Try a clearer crop or paste the message.",
          );
        input.current?.focus();
      } else {
        const exact = text.trim();
        const result = await call("analyzeMessage", {
          requestId: crypto.randomUUID(),
          text: exact,
          source: mode,
          language,
          interaction,
          confirmed: true,
          incomplete,
        });
        if (current !== op.current) return;
        validateReport(result, exact);
        setText(exact);
        setReport(result);
        setPhase("complete");
      }
    } catch (e) {
      if (current !== op.current) return;
      if (e.details?.code === "UNAUTHENTICATED") {
        clearSession();
        await logout();
        return;
      }
      setError(errorMessage(e));
      setPhase("recoverableError");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />A LITTLE PAUSE. A CLEARER NEXT STEP.
          </div>
          <h1>
            Something feel <em>off?</em>
          </h1>
          <p>
            Check the message. Understand the warning signs.
            <br className="desktop-break" /> Decide what to do next with a
            little more clarity.
          </p>
        </div>
        <div className="private-badge">
          <LockKeyhole size={18} />
          <span>
            Your message stays private
            <small>No saved scans. No scan history.</small>
          </span>
        </div>
      </div>
      {emulator && (
        <div className="emulator-note">
          Local development · Firebase emulators · screenshot extraction returns
          a fixed test message, not image recognition.
        </div>
      )}
      <div className="checker-grid">
        <section className="card input-card" aria-label="Message checker">
          <div className="card-heading">
            <div className="step-number">01</div>
            <div>
              <h2>Let’s take a closer look</h2>
              <p>Choose what you’d like to check.</p>
            </div>
          </div>
          <div className="mode-tabs" role="tablist" aria-label="Input type">
            {[
              ["message", MessageSquare, "Paste a message"],
              ["screenshot", ImagePlus, "Upload screenshot"],
            ].map(([id, Icon, label]) => (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-controls="input-panel"
                aria-selected={mode === id}
                tabIndex={mode === id ? 0 : -1}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                    e.preventDefault();
                    const next = mode === "message" ? "screenshot" : "message";
                    document.getElementById(`tab-${next}`).focus();
                    switchMode(next);
                  }
                }}
                onClick={() => switchMode(id)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
          <div id="input-panel" role="tabpanel" aria-labelledby={`tab-${mode}`}>
            {!allowed && (
              <div className="auth-notice">
                <LockKeyhole size={18} />
                <div>
                  <strong>
                    {user
                      ? "Verify your email to check"
                      : "A verified account is required"}
                  </strong>
                  <p>
                    You can prepare your message below.{" "}
                    {user ? (
                      <Link to="/verify-email">Verify email</Link>
                    ) : (
                      <>
                        <Link to="/sign-in">Sign in</Link> or{" "}
                        <Link to="/sign-up">create an account</Link>
                      </>
                    )}{" "}
                    before submitting.
                  </p>
                </div>
              </div>
            )}
            {mode === "screenshot" && (
              <>
                <label className="upload-box">
                  <ImagePlus size={28} />
                  <strong>Choose a screenshot</strong>
                  <span>JPEG, PNG or WebP · up to 4 MiB / 20 MP</span>
                  <input
                    ref={picker}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose screenshot"
                    onChange={selectFile}
                  />
                </label>
                {preview && (
                  <img
                    className="preview"
                    src={preview}
                    alt="Your selected screenshot"
                  />
                )}
                <p className="processing-notice">
                  {freeDeployment
                    ? "Text is extracted on your device. Your screenshot is not uploaded. The first extraction downloads the OCR engine; on slower devices it can take a minute. Reviewed text is checked locally too. "
                    : "When you choose Extract text, this image is sent through our server to Google Cloud Vision. We do not save the image or extracted text. "}
                  <Link to="/privacy">How your data is handled</Link>
                </p>
                <button
                  className="secondary"
                  disabled={!file || !allowed || busy || !online}
                  onClick={() => perform("ocr")}
                >
                  <ScanText size={18} />
                  {phase === "extracting" ? "Extracting text…" : "Extract text"}
                </button>
              </>
            )}
            <label className="message-label" htmlFor="message">
              {mode === "message"
                ? "Suspicious message"
                : "Review and edit the extracted text"}
              <span>English only</span>
            </label>
            <textarea
              ref={input}
              id="message"
              value={text}
              aria-invalid={Boolean(error)}
              aria-describedby="input-help input-error"
              placeholder={
                mode === "message"
                  ? "Paste an email, text message, or chat that you’re unsure about…"
                  : "Extract text from your image, then correct any mistakes here…"
              }
              onChange={(e) => {
                invalidate();
                setText(e.target.value);
                setConfirmed(false);
              }}
              rows={7}
            />
            <div className="input-meta">
              <span id="input-help">
                Remove names or personal details if you prefer.
              </span>
              <span>{codePoints(text.trim()).toLocaleString()} / 10,000</span>
            </div>
            <div className="form-row">
              <label>
                Message language
                <select
                  value={language}
                  onChange={(e) => {
                    invalidate();
                    setLanguage(e.target.value);
                  }}
                >
                  <option value="en">English</option>
                  <option value="other">Another language</option>
                  <option value="unsure">I’m not sure</option>
                </select>
              </label>
              <label>
                Have you responded?
                <select
                  value={interaction}
                  onChange={(e) => {
                    invalidate();
                    setInteraction(e.target.value);
                  }}
                >
                  {Object.entries(INTERACTIONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="checkline">
              <input
                type="checkbox"
                checked={incomplete}
                onChange={(e) => {
                  invalidate();
                  setIncomplete(e.target.checked);
                }}
              />
              This text is incomplete or partly unreadable.
            </label>
            {mode === "screenshot" && (
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => {
                    invalidate();
                    setConfirmed(e.target.checked);
                  }}
                />
                I reviewed this text and confirmed its language.
              </label>
            )}
            {!online && (
              <p className="notice" role="status">
                You’re offline. Your draft stays in this tab; reconnect to
                retry.
              </p>
            )}
            <p className="error" id="input-error" role="alert">
              {error}
            </p>
            <div className="submit-row">
              <button
                className="primary"
                onClick={() => perform("analysis")}
                disabled={
                  !allowed ||
                  busy ||
                  !online ||
                  (mode === "screenshot" && !confirmed)
                }
              >
                {phase === "analyzing" ? "Checking message…" : "Check message"}
                <ArrowRight size={18} />
              </button>
              <button className="text-button" onClick={clear}>
                Clear
              </button>
            </div>
            <p className="under-button">
              <LockKeyhole size={13} />
              Your text is processed for this check and isn’t saved.
            </p>
            <div className="sr-only" aria-live="polite">
              {busy
                ? phase === "extracting"
                  ? "Extracting text"
                  : "Checking message"
                : ""}
            </div>
          </div>
        </section>
        {report ? (
          <Report
            report={report}
            interaction={interaction}
            onInteraction={setInteraction}
            onClear={clear}
          />
        ) : (
          <aside className="right-column">
            <section className="card how-card">
              <div className="outline-icon">
                <ShieldCheck size={27} />
              </div>
              <span className="eyebrow">CLARITY, NOT GUESSWORK</span>
              <h2>
                A second look
                <br />
                before your next move.
              </h2>
              <p>
                We look for common warning patterns and show you exactly what
                stood out.
              </p>
              <ol className="how-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Share the message</strong>
                    <p>Paste text or review a screenshot.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>See the warning signs</strong>
                    <p>Clear explanations, with matched evidence.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Choose your next step</strong>
                    <p>Practical guidance for your situation.</p>
                  </div>
                </li>
              </ol>
              <div className="honest-note">
                <AlertTriangle size={18} />
                <p>
                  A check can’t prove a message is genuine. Always verify
                  important requests independently.
                </p>
              </div>
            </section>
            <div className="support-note">
              <FileText size={20} />
              <div>
                <strong>Already clicked or sent money?</strong>
                <p>
                  Select what happened above. We’ll put recovery steps first.
                </p>
                <Link to="/help">
                  Find guidance now <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </aside>
        )}
      </div>
      <div className="trust-row">
        <span>
          <Check size={15} />
          Evidence you can read
        </span>
        <span>
          <Check size={15} />
          No links opened
        </span>
        <span>
          <Check size={15} />
          No saved message history
        </span>
      </div>
    </>
  );
}
