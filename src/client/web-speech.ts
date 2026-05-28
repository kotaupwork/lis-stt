// src/client/web-speech.ts — Web Speech API wrapper + detection
// Provides unified interface for browser's native speech recognition

import { EventEmitter } from "node:events";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

/**
 * Unified STT result format (shared with Vosk)
 */
export interface STTResult {
  /**
   * Interim transcript (being transcribed)
   */
  interim: string;

  /**
   * Final transcript (confidence > threshold)
   */
  final: string;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Is this result final (not subject to change)?
   */
  isFinal: boolean;

  /**
   * Result type: \"web-speech-api\" | \"vosk\"
   */
  source: "web-speech-api" | "vosk";
}

export interface WebSpeechOptions {
  /**
   * Language code (default: \"en-US\")
   */
  language?: string;

  /**
   * Continuous recognition (default: true)
   */
  continuous?: boolean;

  /**
   * Interim results (default: true)
   */
  interimResults?: boolean;

  /**
   * Max alternatives per result (default: 1)
   */
  maxAlternatives?: number;
}

// ────────────────────────────────────────────────
// Web Speech API Wrapper
// ────────────────────────────────────────────────

export class WebSpeechRecognizer extends EventEmitter {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private interimTranscript = "";
  private finalTranscript = "";

  private language: string;
  private continuous: boolean;
  private interimResults: boolean;
  private maxAlternatives: number;

  constructor(options: WebSpeechOptions = {}) {
    super();

    this.language = options.language ?? "en-US";
    this.continuous = options.continuous ?? true;
    this.interimResults = options.interimResults ?? true;
    this.maxAlternatives = options.maxAlternatives ?? 1;

    // Initialize Web Speech API
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Web Speech API not available in this browser");
    }

    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }

  /**
   * Setup Web Speech API event handlers
   */
  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.language = this.language;
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.maxAlternatives = this.maxAlternatives;

    // On start
    this.recognition.onstart = () => {
      this.isListening = true;
      this.interimTranscript = "";
      this.finalTranscript = "";
      this.emit("start");
    };

    // On result (interim + final)
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;

        if (event.results[i].isFinal) {
          this.finalTranscript += transcript + " ";
        } else {
          this.interimTranscript += transcript;
        }

        // Emit result
        const result: STTResult = {
          interim: this.interimTranscript,
          final: this.finalTranscript.trim(),
          confidence,
          isFinal: event.results[i].isFinal,
          source: "web-speech-api",
        };

        this.emit("result", result);
      }
    };

    // On error
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.emit("error", new Error(`Web Speech API error: ${event.error}`));
    };

    // On end
    this.recognition.onend = () => {
      this.isListening = false;
      this.emit("end");
    };
  }

  /**
   * Start listening
   */
  async start(): Promise<void> {
    if (!this.recognition) {
      throw new Error("Web Speech API not initialized");
    }

    if (this.isListening) {
      throw new Error("Already listening");
    }

    this.recognition.start();
  }

  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    if (!this.recognition || !this.isListening) {
      throw new Error("Not listening");
    }

    this.recognition.stop();
  }

  /**
   * Abort listening
   */
  abort(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.isListening = false;
    }
  }

  /**
   * Check if currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Get language
   */
  getLanguage(): string {
    return this.language;
  }

  /**
   * Set language
   */
  setLanguage(language: string): void {
    this.language = language;
    if (this.recognition) {
      this.recognition.language = language;
    }
  }
}

// ────────────────────────────────────────────────
// Browser Capability Detection
// ────────────────────────────────────────────────

/**
 * Check if Web Speech API is available in this browser
 */
export function isWebSpeechAPIAvailable(): boolean {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  return !!SpeechRecognition;
}

/**
 * Check if Web Speech API is actually usable
 * (availability may vary by browser, OS, or user settings)
 */
export async function canUseWebSpeechAPI(): Promise<boolean> {
  if (!isWebSpeechAPIAvailable()) {
    return false;
  }

  // Try to instantiate; some browsers may throw
  try {
    const recognizer = new WebSpeechRecognizer();
    // If we got here, it's available
    return true;
  } catch {
    return false;
  }
}

/**
 * Get browser name for diagnostics
 */
export function getBrowserInfo(): {
  name: string;
  webSpeechSupport: boolean;
} {
  const ua = navigator.userAgent;

  let name = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edge")) name = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome"))
    name = "Safari";
  else if (ua.includes("Firefox")) name = "Firefox";
  else if (ua.includes("Edge")) name = "Edge";
  else if (ua.includes("Opera") || ua.includes("OPR")) name = "Opera";

  return {
    name,
    webSpeechSupport: isWebSpeechAPIAvailable(),
  };
}
