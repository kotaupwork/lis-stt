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
let finalTranscriptText = "";
let selectedModel = "en";
let activeModel = "en";
let selectedSensitivity = "balanced";
let activeSensitivity = "balanced";

const VOSK_BACKEND_BASE = window.STT_BACKEND_URL || "http://localhost:8000";
const MAX_UPLOAD_RETRIES = 3;
const SAMPLE_RATE = 16000;
const CHUNK_MS = 160;
const BACKEND_TIMEOUT_MS = 2500;

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

  const readiness = await ensureBackendAvailable();
  initializeModelSelector(readiness);
  initializeSensitivitySelector();

  if (mode === STTMode.VOSK) {
    if (!readiness.ok) {
      setStatus(
        "Vosk mode selected, but backend is unreachable on " +
          `${VOSK_BACKEND_BASE}. Start backend-dev or docker-up.`,
        "warn"
      );
    } else if (!readiness.voskReady) {
      setStatus(
        `Backend is up but Vosk is not reachable at ${readiness.voskUrl || "ws://localhost:2700"}. Start Vosk (docker-up).`,
        "warn"
      );
    } else if (!isModelReady(readiness, selectedModel)) {
      setStatus(
        `Selected model '${selectedModel}' is not reachable. Start make docker-up or choose a different model.`,
        "warn"
      );
    }
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
      const readiness = await ensureBackendAvailable();
      if (!readiness.ok) {
        throw new Error(
          `Backend unavailable at ${VOSK_BACKEND_BASE}. Run make backend-dev or make docker-up.`
        );
      }
      if (!readiness.voskReady) {
        throw new Error(
          `Backend is up but Vosk is unavailable at ${readiness.voskUrl || "ws://localhost:2700"}. Start make docker-up.`
        );
      }

      activeModel = getSelectedModel();
      activeSensitivity = getSelectedSensitivity();
      if (!isModelReady(readiness, activeModel)) {
        throw new Error(
          `Model '${activeModel}' is unavailable. Start make docker-up or select a model that is ready.`
        );
      }

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
      try {
        await finalizeVoskSession(sessionId);
      } catch (err) {
        setStatus(`Finalize warning: ${err.message}`, "warn");
      }
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
  formData.append("model", activeModel);
  formData.append("sensitivity", activeSensitivity);
  formData.append(
    "audio",
    new Blob([chunk.data.buffer.slice(0)], { type: "application/octet-stream" }),
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

async function runSample(url, label = "sample") {
  if (isRecording) {
    setStatus("Stop live recording before running a sample.", "warn");
    return;
  }

  try {
    const readiness = await ensureBackendAvailable();
    if (!readiness.ok) {
      throw new Error(
        `Backend unavailable at ${VOSK_BACKEND_BASE}. Run make backend-dev or make docker-up.`
      );
    }
    if (!readiness.voskReady) {
      throw new Error(
        `Backend is up but Vosk is unavailable at ${readiness.voskUrl || "ws://localhost:2700"}. Start make docker-up.`
      );
    }

    activeModel = getSelectedModel();
    activeSensitivity = getSelectedSensitivity();
    if (!isModelReady(readiness, activeModel)) {
      throw new Error(
        `Model '${activeModel}' is unavailable. Start make docker-up or select a model that is ready.`
      );
    }

    if (isSerbianSample(url, label) && activeModel === "en") {
      throw new Error(
        "Serbian sample selected while English model is active. Choose 'sr' or 'sh' in the model dropdown first."
      );
    }

    clearTranscriptUI();
    setStatus(`Loading ${label}...`, "info");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load sample: ${response.status}`);
    }

    const audioBuffer = await decodeAudio(await response.arrayBuffer());
    const pcm = resampleTo16kMono(audioBuffer);
    const chunks = splitPcmChunks(pcm, SAMPLE_RATE, CHUNK_MS);

    sessionId = crypto.randomUUID();
    openVoskSocket(sessionId);
    setStatus(`Streaming ${label} (${chunks.length} chunks)...`, "info");

    for (let i = 0; i < chunks.length; i++) {
      await uploadPcmChunk(chunks[i], i);
      await delay(90);
    }

    try {
      await finalizeVoskSession(sessionId);
    } catch (err) {
      setStatus(`Finalize warning: ${err.message}`, "warn");
    }
    closeVoskSocket();
    sessionId = null;

    setStatus(`Finished ${label}.`, "success");
  } catch (err) {
    closeVoskSocket();
    sessionId = null;
    setStatus(`Sample run failed: ${err.message}`, "error");
  }
}

async function uploadPcmChunk(pcm, index) {
  if (!sessionId) return;

  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("model", activeModel);
  formData.append("sensitivity", activeSensitivity);
  formData.append(
    "audio",
    new Blob([pcm.buffer.slice(0)], { type: "application/octet-stream" }),
    `sample-${index}.pcm`
  );

  const response = await fetch(`${VOSK_BACKEND_BASE}/api/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sample upload failed (${response.status}): ${body}`);
  }
}

async function decodeAudio(arrayBuffer) {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await context.close();
  }
}

function resampleTo16kMono(audioBuffer) {
  const sourceData = audioBuffer.getChannelData(0);
  const sourceRate = audioBuffer.sampleRate;
  const targetLength = Math.floor(sourceData.length * SAMPLE_RATE / sourceRate);
  const result = new Int16Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = i * sourceRate / SAMPLE_RATE;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, sourceData.length - 1);
    const weight = sourceIndex - left;
    const sample = (sourceData[left] * (1 - weight)) + (sourceData[right] * weight);
    const clamped = Math.max(-1, Math.min(1, sample));
    result[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return result;
}

function splitPcmChunks(pcm, sampleRate, chunkMs) {
  const samplesPerChunk = Math.floor(sampleRate * (chunkMs / 1000));
  const chunks = [];

  for (let i = 0; i < pcm.length; i += samplesPerChunk) {
    chunks.push(pcm.slice(i, i + samplesPerChunk));
  }

  return chunks;
}

async function finalizeVoskSession(id) {
  const formData = new FormData();
  formData.append("session_id", id);
  formData.append("model", activeModel);
  formData.append("sensitivity", activeSensitivity);

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
    setStatus(
      `WebSocket error while receiving transcripts from ${VOSK_BACKEND_BASE}. ` +
        "Check backend-dev/docker-up and STT_BACKEND_URL.",
      "error"
    );
  };

  voskWs.onclose = () => {
    if (isRecording && !isStopping) {
      setStatus("WebSocket closed unexpectedly. Stop and restart recording.", "warn");
    }
  };
}

async function ensureBackendAvailable() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const response = await fetch(`${VOSK_BACKEND_BASE}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, voskReady: false, voskUrl: null };
    }

    const data = await response.json();
    const modelMap = data.vosk_models || {};
    const defaultModel = data.vosk_default_model || data.vosk_language || "en";
    const selectedMeta = modelMap[selectedModel] || modelMap[defaultModel] || null;
    return {
      ok: true,
      voskReady: Boolean(data.vosk_ready),
      voskUrl: data.vosk_ws_url || selectedMeta?.url || null,
      voskLanguage: data.vosk_language || defaultModel,
      defaultModel,
      models: modelMap,
    };
  } catch {
    return {
      ok: false,
      voskReady: false,
      voskUrl: null,
      voskLanguage: null,
      defaultModel: "en",
      models: {},
    };
  } finally {
    clearTimeout(timer);
  }
}

function initializeModelSelector(readiness) {
  const select = document.getElementById("model-select");
  if (!select) return;

  selectedModel = select.value || readiness.defaultModel || "en";
  activeModel = selectedModel;
  updateModelReadinessHint(readiness, selectedModel);
  applyWebSpeechLanguageForModel(selectedModel);

  select.addEventListener("change", async () => {
    selectedModel = select.value || "en";
    activeModel = selectedModel;
    applyWebSpeechLanguageForModel(selectedModel);
    const fresh = await ensureBackendAvailable();
    updateModelReadinessHint(fresh, selectedModel);
  });
}

function getSelectedModel() {
  const select = document.getElementById("model-select");
  return (select?.value || selectedModel || "en").toLowerCase();
}

function initializeSensitivitySelector() {
  const select = document.getElementById("sensitivity-select");
  if (!select) return;

  selectedSensitivity = (select.value || "balanced").toLowerCase();
  activeSensitivity = selectedSensitivity;

  select.addEventListener("change", () => {
    selectedSensitivity = (select.value || "balanced").toLowerCase();
    activeSensitivity = selectedSensitivity;
    updateSensitivityHint(selectedSensitivity);
  });

  updateSensitivityHint(selectedSensitivity);
}

function getSelectedSensitivity() {
  const select = document.getElementById("sensitivity-select");
  return (select?.value || selectedSensitivity || "balanced").toLowerCase();
}

function isModelReady(readiness, model) {
  if (!readiness?.ok) return false;
  const meta = readiness.models?.[model];
  if (meta && typeof meta.ready === "boolean") {
    return meta.ready;
  }
  return model === readiness.defaultModel ? Boolean(readiness.voskReady) : false;
}

function updateModelReadinessHint(readiness, model) {
  const hint = document.getElementById("model-hint");
  if (!hint) return;

  if (!readiness.ok) {
    hint.textContent = "Backend unavailable.";
    return;
  }

  const meta = readiness.models?.[model];
  if (!meta) {
    hint.textContent = `Model '${model}' is not advertised by backend.`;
    return;
  }

  hint.textContent = meta.ready
    ? `Model '${model}' ready at ${meta.url}.`
    : `Model '${model}' is currently unreachable (${meta.url}).`;
}

function applyWebSpeechLanguageForModel(model) {
  if (!sttManager || sttManager.getMode() !== STTMode.WEB_SPEECH_API) {
    return;
  }

  const language = model.startsWith("en") ? "en-US" : "sr-RS";
  sttManager.setLanguage(language);
}

function updateSensitivityHint(sensitivity) {
  const hint = document.getElementById("sensitivity-hint");
  if (!hint) return;

  if (sensitivity === "high") {
    hint.textContent = "High sensitivity: captures quieter speech, may include more background noise.";
    return;
  }

  if (sensitivity === "low") {
    hint.textContent = "Low sensitivity: filters noise more aggressively, requires louder speech.";
    return;
  }

  hint.textContent = "Balanced sensitivity: recommended default for most microphones.";
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
    finalTranscriptText = mergeFinalText(finalTranscriptText, result.final || "");
    finalEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "transcript-final-line";
    p.textContent = finalTranscriptText;
    finalEl.appendChild(p);

    // Clear interim when final arrives
    if (interimEl) {
      interimEl.textContent = "";
    }
  }
}

function isSerbianSample(url, label) {
  const input = `${url} ${label}`.toLowerCase();
  return input.includes("sr_") || input.includes("serbian") || input.includes("sr-");
}

function mergeFinalText(existing, incoming) {
  const a = (existing || "").trim();
  const b = (incoming || "").trim();
  if (!b) return a;
  if (!a) return b;

  if (b.startsWith(a)) {
    return b;
  }
  if (a.endsWith(b)) {
    return a;
  }

  return `${a} ${b}`.replace(/\s+/g, " ").trim();
}

function clearTranscriptUI() {
  const interimEl = document.getElementById("transcript-interim");
  const finalEl = document.getElementById("transcript-final");
  finalTranscriptText = "";

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
  runSample,
};
