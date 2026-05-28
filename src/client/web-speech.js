// src/client/web-speech.js — Web Speech API wrapper
// Provides unified interface for browser's native speech recognition

import { EventEmitter } from "./events.js";

/**
 * Unified STT result format
 */
export class STTResult {
  constructor(interim, final_, confidence, isFinal, source) {
    this.interim = interim;
    this.final = final_;
    this.confidence = confidence;
    this.isFinal = isFinal;
    this.source = source;
  }
}

/**
 * Web Speech API wrapper
 */
export class WebSpeechRecognizer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.language = options.language ?? "en-US";
    this.continuous = options.continuous ?? true;
    this.interimResults = options.interimResults ?? true;
    this.maxAlternatives = options.maxAlternatives ?? 1;

    this.isListening = false;
    this.interimTranscript = "";
    this.finalTranscript = "";

    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Web Speech API not available in this browser");
    }

    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }

  setupRecognition() {
    this.recognition.language = this.language;
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.maxAlternatives = this.maxAlternatives;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.interimTranscript = "";
      this.finalTranscript = "";
      this.emit("start");
    };

    this.recognition.onresult = (event) => {
      this.interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;

        if (event.results[i].isFinal) {
          this.finalTranscript += transcript + " ";
        } else {
          this.interimTranscript += transcript;
        }

        const result = new STTResult(
          this.interimTranscript,
          this.finalTranscript.trim(),
          confidence,
          event.results[i].isFinal,
          "web-speech-api"
        );

        this.emit("result", result);
      }
    };

    this.recognition.onerror = (event) => {
      this.emit("error", new Error(`Web Speech API error: ${event.error}`));
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.emit("end");
    };
  }

  async start() {
    if (!this.recognition) {
      throw new Error("Web Speech API not initialized");
    }

    if (this.isListening) {
      throw new Error("Already listening");
    }

    this.recognition.start();
  }

  async stop() {
    if (!this.recognition || !this.isListening) {
      throw new Error("Not listening");
    }

    this.recognition.stop();
  }

  abort() {
    if (this.recognition) {
      this.recognition.abort();
      this.isListening = false;
    }
  }

  isActive() {
    return this.isListening;
  }

  getLanguage() {
    return this.language;
  }

  setLanguage(language) {
    this.language = language;
    if (this.recognition) {
      this.recognition.language = language;
    }
  }
}

/**
 * Check if Web Speech API is available
 */
export function isWebSpeechAPIAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Check if Web Speech API is usable
 */
export async function canUseWebSpeechAPI() {
  if (!isWebSpeechAPIAvailable()) {
    return false;
  }

  try {
    const recognizer = new WebSpeechRecognizer();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get browser info
 */
export function getBrowserInfo() {
  const ua = navigator.userAgent;

  let name = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edge")) name = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) name = "Safari";
  else if (ua.includes("Firefox")) name = "Firefox";
  else if (ua.includes("Edge")) name = "Edge";
  else if (ua.includes("Opera") || ua.includes("OPR")) name = "Opera";

  return {
    name,
    webSpeechSupport: isWebSpeechAPIAvailable(),
  };
}
