// src/client/stt-manager.ts — Unified STT interface
// Routes to Web Speech API or Vosk fallback, emits unified results
import { EventEmitter } from "node:events";
import { WebSpeechRecognizer, isWebSpeechAPIAvailable, } from "./web-speech.js";
// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
export var STTMode;
(function (STTMode) {
    /**
     * Using Web Speech API (browser-native)
     */
    STTMode["WEB_SPEECH_API"] = "web-speech-api";
    /**
     * Using Vosk fallback (HTTP + WebSocket to backend)
     */
    STTMode["VOSK"] = "vosk";
    /**
     * Not initialized yet
     */
    STTMode["UNINITIALIZED"] = "uninitialized";
})(STTMode || (STTMode = {}));
// ────────────────────────────────────────────────
// STT Manager
// ────────────────────────────────────────────────
export class STTManager extends EventEmitter {
    mode = STTMode.UNINITIALIZED;
    webSpeech = null;
    language;
    voskUrl;
    forceVosk;
    verbose;
    isActive = false;
    constructor(options = {}) {
        super();
        this.language = options.language ?? "en-US";
        this.voskUrl = options.voskUrl ?? "http://localhost:3000";
        this.forceVosk = options.forceVosk ?? false;
        this.verbose = options.verbose ?? false;
    }
    /**
     * Initialize STT (detect capability, prepare for use)
     */
    async initialize() {
        this.log("Initializing STT...");
        // If forcing Vosk, skip Web Speech API
        if (this.forceVosk) {
            this.log("Forcing Vosk fallback (forceVosk=true)");
            this.mode = STTMode.VOSK;
            this.emit("initialized", this.mode);
            return this.mode;
        }
        // Try Web Speech API first
        if (isWebSpeechAPIAvailable()) {
            try {
                this.log("Web Speech API available, initializing...");
                this.webSpeech = new WebSpeechRecognizer({ language: this.language });
                // Forward events from Web Speech API
                this.webSpeech.on("result", (result) => {
                    this.emit("result", result);
                });
                this.webSpeech.on("error", (err) => {
                    this.log(`Web Speech API error: ${err.message}`);
                    this.emit("error", err);
                });
                this.webSpeech.on("start", () => {
                    this.emit("start");
                });
                this.webSpeech.on("end", () => {
                    this.emit("end");
                });
                this.mode = STTMode.WEB_SPEECH_API;
                this.log("Using Web Speech API");
            }
            catch (err) {
                this.log(`Web Speech API init failed: ${err instanceof Error ? err.message : String(err)}`);
                this.log("Falling back to Vosk...");
                this.mode = STTMode.VOSK;
            }
        }
        else {
            this.log("Web Speech API not available, using Vosk");
            this.mode = STTMode.VOSK;
        }
        this.emit("initialized", this.mode);
        return this.mode;
    }
    /**
     * Start STT
     */
    async start() {
        if (this.isActive) {
            throw new Error("STT already active");
        }
        if (this.mode === STTMode.UNINITIALIZED) {
            throw new Error("STT not initialized. Call initialize() first.");
        }
        this.isActive = true;
        if (this.mode === STTMode.WEB_SPEECH_API) {
            if (!this.webSpeech) {
                throw new Error("Web Speech API not initialized");
            }
            await this.webSpeech.start();
        }
        else if (this.mode === STTMode.VOSK) {
            this.log("Starting Vosk STT (not implemented in Phase 1)");
            this.emit("start");
        }
    }
    /**
     * Stop STT
     */
    async stop() {
        if (!this.isActive) {
            throw new Error("STT not active");
        }
        this.isActive = false;
        if (this.mode === STTMode.WEB_SPEECH_API && this.webSpeech) {
            await this.webSpeech.stop();
        }
        else if (this.mode === STTMode.VOSK) {
            this.log("Stopping Vosk STT (not implemented in Phase 1)");
            this.emit("end");
        }
    }
    /**
     * Abort STT
     */
    abort() {
        this.isActive = false;
        if (this.mode === STTMode.WEB_SPEECH_API && this.webSpeech) {
            this.webSpeech.abort();
        }
    }
    /**
     * Get current mode
     */
    getMode() {
        return this.mode;
    }
    /**
     * Check if STT is active
     */
    isRunning() {
        return this.isActive;
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
        if (this.webSpeech) {
            this.webSpeech.setLanguage(language);
        }
    }
    /**
     * Log message (if verbose)
     */
    log(message) {
        if (this.verbose) {
            console.log(`[STTManager] ${message}`);
        }
    }
}
/**
 * Factory function: create and initialize STT manager
 */
export async function createSTTManager(options = {}) {
    const manager = new STTManager(options);
    await manager.initialize();
    return manager;
}
//# sourceMappingURL=stt-manager.js.map