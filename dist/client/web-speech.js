// src/client/web-speech.ts — Web Speech API wrapper + detection
// Provides unified interface for browser's native speech recognition
import { EventEmitter } from "node:events";
// ────────────────────────────────────────────────
// Web Speech API Wrapper
// ────────────────────────────────────────────────
export class WebSpeechRecognizer extends EventEmitter {
    recognition = null;
    isListening = false;
    interimTranscript = "";
    finalTranscript = "";
    language;
    continuous;
    interimResults;
    maxAlternatives;
    constructor(options = {}) {
        super();
        this.language = options.language ?? "en-US";
        this.continuous = options.continuous ?? true;
        this.interimResults = options.interimResults ?? true;
        this.maxAlternatives = options.maxAlternatives ?? 1;
        // Initialize Web Speech API
        const SpeechRecognition = window.SpeechRecognition ||
            window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error("Web Speech API not available in this browser");
        }
        this.recognition = new SpeechRecognition();
        this.setupRecognition();
    }
    /**
     * Setup Web Speech API event handlers
     */
    setupRecognition() {
        if (!this.recognition)
            return;
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
        this.recognition.onresult = (event) => {
            this.interimTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                const confidence = event.results[i][0].confidence;
                if (event.results[i].isFinal) {
                    this.finalTranscript += transcript + " ";
                }
                else {
                    this.interimTranscript += transcript;
                }
                // Emit result
                const result = {
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
        this.recognition.onerror = (event) => {
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
    async start() {
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
    async stop() {
        if (!this.recognition || !this.isListening) {
            throw new Error("Not listening");
        }
        this.recognition.stop();
    }
    /**
     * Abort listening
     */
    abort() {
        if (this.recognition) {
            this.recognition.abort();
            this.isListening = false;
        }
    }
    /**
     * Check if currently listening
     */
    isActive() {
        return this.isListening;
    }
    /**
     * Get language
     */
    getLanguage() {
        return this.language;
    }
    /**
     * Set language
     */
    setLanguage(language) {
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
export function isWebSpeechAPIAvailable() {
    const SpeechRecognition = window.SpeechRecognition ||
        window.webkitSpeechRecognition;
    return !!SpeechRecognition;
}
/**
 * Check if Web Speech API is actually usable
 * (availability may vary by browser, OS, or user settings)
 */
export async function canUseWebSpeechAPI() {
    if (!isWebSpeechAPIAvailable()) {
        return false;
    }
    // Try to instantiate; some browsers may throw
    try {
        const recognizer = new WebSpeechRecognizer();
        // If we got here, it's available
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get browser name for diagnostics
 */
export function getBrowserInfo() {
    const ua = navigator.userAgent;
    let name = "Unknown";
    if (ua.includes("Chrome") && !ua.includes("Edge"))
        name = "Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome"))
        name = "Safari";
    else if (ua.includes("Firefox"))
        name = "Firefox";
    else if (ua.includes("Edge"))
        name = "Edge";
    else if (ua.includes("Opera") || ua.includes("OPR"))
        name = "Opera";
    return {
        name,
        webSpeechSupport: isWebSpeechAPIAvailable(),
    };
}
//# sourceMappingURL=web-speech.js.map