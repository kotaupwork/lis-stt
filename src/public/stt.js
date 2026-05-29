// public/stt.js — Browser-side STT initialization
// Entry point for browser; imported by index.ejs

import { createSTTManager, STTMode } from "./stt-manager.js";
import { AudioRecorder } from "./audio-recorder.js";

// ────────────────────────────────────────────────
// Global state
// ────────────────────────────────────────────────

let sttManager = null;
let audioRecorder = null;
let isRecording = false;
let sessionId = null;
let voskWs = null;
let voskPingTimer = null;
let isStopping = false;

const VOSK_BACKEND_BASE = window.STT_BACKEND_URL || "http://localhost:8000";
const MAX_UPLOAD_RETRIES = 3;

// ────────────────────────────────────────────────
// Initialize on DOM ready
// ────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[STT] Initializing...");

  // Initialize STT manager
  sttManager = await createSTTManager({
    language: "en-US",
    verbose: true,
  });

  // Initialize audio recorder
  audioRecorder = new AudioRecorder({
    targetSampleRate: 16000,
    chunkIntervalMs: 160,
  });

  // Wire up audio recorder events
  audioRecorder.on("chunk", async (chunk) => {
    console.log(
      `[STT] Audio chunk: ${chunk.data.length} samples, seq=${chunk.sequence}`
    );

    if (!sttManager || sttManager.getMode() !== STTMode.VOSK) {
      return;
    }

    await uploadChunkToVosk(chunk);
  });

  audioRecorder.on("start", () => {
    console.log("[STT] Recording started");
    updateRecordButtonUI();
  });

  audioRecorder.on("stop", () => {
    console.log("[STT] Recording stopped");
    updateRecordButtonUI();
  });

  // Wire up STT manager events
  sttManager.on("result", (result) => {
    console.log("[STT] Result:", {
      interim: result.interim,
      final: result.final,
      confidence: result.confidence,
      isFinal: result.isFinal,
      source: result.source,
    });
    updateTranscriptUI(result);
  });

  sttManager.on("error", (err) => {
    console.error("[STT] Error:", err.message);
    updateTranscriptUI({
      interim: `Error: ${err.message}`,
      final: "",
      confidence: 0,
      isFinal: false,
      source: "web-speech-api",
    });
  });

  sttManager.on("start", () => {
    console.log("[STT] STT started");
  });

  sttManager.on("end", () => {
    console.log("[STT] STT ended");
  });

  // Log STT mode
  const mode = sttManager.getMode();
  console.log(`[STT] Using mode: ${mode}`);
  const modeEl = document.getElementById("stt-mode");
  if (modeEl) {
    modeEl.textContent = mode;
    modeEl.className = mode === STTMode.WEB_SPEECH_API
      ? "badge-primary"
      : "badge-warning";
  }

  console.log("[STT] Ready!");
});

// ────────────────────────────────────────────────
// Record button handlers
// ────────────────────────────────────────────────

async function toggleRecording() {
  if (isRecording) {
    await stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    console.log("[STT] Starting recording...");
    isStopping = false;
    clearTranscriptUI();
    setStatus("", "info");

    if (sttManager.getMode() === STTMode.VOSK) {
      sessionId = crypto.randomUUID();
      openVoskSocket(sessionId);
    }

    // Start audio recorder
    await audioRecorder.start();

    // Start STT
    await sttManager.start();

    isRecording = true;
    updateRecordButtonUI();
    setStatus("Recording in progress...", "info");

    console.log("[STT] Recording and STT started");
  } catch (err) {
    console.error("[STT] Failed to start recording:", err);
    setStatus(`Failed to start recording: ${err.message}`, "error");
    isRecording = false;
    updateRecordButtonUI();
    closeVoskSocket();
    sessionId = null;
  }
}

async function stopRecording() {
  try {
    console.log("[STT] Stopping recording...");
    isStopping = true;

    // Stop audio recorder
    await audioRecorder.stop();

    // Stop STT
    await sttManager.stop();

    if (sttManager.getMode() === STTMode.VOSK && sessionId) {
      await finalizeVoskSession(sessionId);
      closeVoskSocket();
      sessionId = null;
    }

    isRecording = false;
    updateRecordButtonUI();
    setStatus("Recording stopped.", "info");

    console.log("[STT] Recording and STT stopped");
  } catch (err) {
    console.error("[STT] Failed to stop recording:", err);
    setStatus(`Failed to stop recording: ${err.message}`, "error");
    closeVoskSocket();
    sessionId = null;
    isRecording = false;
    updateRecordButtonUI();
  } finally {
    isStopping = false;
  }
}

async function uploadChunkToVosk(chunk) {
  if (!sessionId || isStopping) {
    return;
  }

  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append(
    "audio",
    new Blob([chunk.data.buffer], { type: "application/octet-stream" }),
    `chunk-${chunk.sequence}.pcm`
  );

  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_UPLOAD_RETRIES) {
    attempt += 1;
    try {
      const response = await fetch(`${VOSK_BACKEND_BASE}/api/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Vosk upload failed (${response.status}): ${body}`);
      }

      if (attempt > 1) {
        setStatus("Connection restored.", "success");
      }
      return;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_UPLOAD_RETRIES) {
        setStatus(`Upload issue, retrying (${attempt}/${MAX_UPLOAD_RETRIES - 1})...`, "warn");
        await delay(250 * attempt);
      }
    }
  }

  if (lastError) {
    setStatus(`Upload failed after retries: ${lastError.message}`, "error");
  }
}

async function finalizeVoskSession(id) {
  const formData = new FormData();
  formData.append("session_id", id);

  const response = await fetch(`${VOSK_BACKEND_BASE}/api/transcribe/finalize`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vosk finalize failed (${response.status}): ${body}`);
  }
}

function openVoskSocket(id) {
  const wsUrl = VOSK_BACKEND_BASE.replace("http://", "ws://").replace(
    "https://",
    "wss://"
  );

  voskWs = new WebSocket(`${wsUrl}/ws/transcribe/${id}`);

  voskWs.onopen = () => {
    console.log("[STT] Connected to Vosk result stream");
    setStatus("Connected to Vosk result stream.", "success");
    voskPingTimer = setInterval(() => {
      if (voskWs && voskWs.readyState === WebSocket.OPEN) {
        voskWs.send("ping");
      }
    }, 10000);
  };

  voskWs.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      updateTranscriptUI(payload);
    } catch (err) {
      console.warn("[STT] Could not parse Vosk payload", err);
    }
  };

  voskWs.onerror = (event) => {
    console.error("[STT] Vosk websocket error", event);
    setStatus("WebSocket error while receiving transcripts.", "error");
  };

  voskWs.onclose = () => {
    if (isRecording && !isStopping) {
      setStatus("WebSocket closed unexpectedly. Stop and restart recording.", "warn");
    }
  };
}

function closeVoskSocket() {
  if (voskPingTimer) {
    clearInterval(voskPingTimer);
    voskPingTimer = null;
  }

  if (voskWs) {
    voskWs.close();
    voskWs = null;
  }
}

// ────────────────────────────────────────────────
// UI Updates
// ────────────────────────────────────────────────

function updateRecordButtonUI() {
  const btn = document.getElementById("record-btn");
  if (!btn) return;

  if (isRecording) {
    btn.classList.add("recording");
    btn.textContent = "🔴 Stop Recording";
  } else {
    btn.classList.remove("recording");
    btn.textContent = "🎤 Start Recording";
  }
}

function updateTranscriptUI(result) {
  const interimEl = document.getElementById("transcript-interim");
  const finalEl = document.getElementById("transcript-final");

  if (interimEl) {
    interimEl.textContent = result.interim;
  }

  if (finalEl && result.isFinal) {
    // Append final result
    const p = document.createElement("p");
    p.className = "transcript-final-line";
    p.textContent = result.final;
    finalEl.appendChild(p);

    // Clear interim when final arrives
    if (interimEl) {
      interimEl.textContent = "";
    }
  }
}

function clearTranscriptUI() {
  const interimEl = document.getElementById("transcript-interim");
  const finalEl = document.getElementById("transcript-final");

  if (interimEl) {
    interimEl.textContent = "";
  }

  if (finalEl) {
    finalEl.innerHTML = "";
  }
}

function setStatus(message, level = "info") {
  const statusEl = document.getElementById("stt-status");
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `stt-status stt-status-${level}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────
// Export for use in HTML
// ────────────────────────────────────────────────

window.sttAPI = {
  toggleRecording,
  startRecording,
  stopRecording,
};
