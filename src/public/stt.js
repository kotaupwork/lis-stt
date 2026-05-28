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
  audioRecorder.on("chunk", (chunk) => {
    console.log(
      `[STT] Audio chunk: ${chunk.data.length} samples, seq=${chunk.sequence}`
    );
    // In Phase 2, will upload to backend here
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

    // Start audio recorder
    await audioRecorder.start();

    // Start STT
    await sttManager.start();

    isRecording = true;
    updateRecordButtonUI();

    console.log("[STT] Recording and STT started");
  } catch (err) {
    console.error("[STT] Failed to start recording:", err);
    alert(`Error: ${err.message}`);
  }
}

async function stopRecording() {
  try {
    console.log("[STT] Stopping recording...");

    // Stop audio recorder
    await audioRecorder.stop();

    // Stop STT
    await sttManager.stop();

    isRecording = false;
    updateRecordButtonUI();

    console.log("[STT] Recording and STT stopped");
  } catch (err) {
    console.error("[STT] Failed to stop recording:", err);
    alert(`Error: ${err.message}`);
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

// ────────────────────────────────────────────────
// Export for use in HTML
// ────────────────────────────────────────────────

window.sttAPI = {
  toggleRecording,
  startRecording,
  stopRecording,
};
