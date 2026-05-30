import { EventEmitter } from "node:events";
export declare enum STTMode {
    /**
     * Using Web Speech API (browser-native)
     */
    WEB_SPEECH_API = "web-speech-api",
    /**
     * Using Vosk fallback (HTTP + WebSocket to backend)
     */
    VOSK = "vosk",
    /**
     * Not initialized yet
     */
    UNINITIALIZED = "uninitialized"
}
export interface STTManagerOptions {
    /**
     * Language code (default: \"en-US\")
     */
    language?: string;
    /**
     * Vosk backend URL (default: \"http://localhost:3000\")
     */
    voskUrl?: string;
    /**
     * Force fallback to Vosk (useful for testing)
     */
    forceVosk?: boolean;
    /**
     * Log diagnostic info
     */
    verbose?: boolean;
}
export declare class STTManager extends EventEmitter {
    private mode;
    private webSpeech;
    private language;
    private voskUrl;
    private forceVosk;
    private verbose;
    private isActive;
    constructor(options?: STTManagerOptions);
    /**
     * Initialize STT (detect capability, prepare for use)
     */
    initialize(): Promise<STTMode>;
    /**
     * Start STT
     */
    start(): Promise<void>;
    /**
     * Stop STT
     */
    stop(): Promise<void>;
    /**
     * Abort STT
     */
    abort(): void;
    /**
     * Get current mode
     */
    getMode(): STTMode;
    /**
     * Check if STT is active
     */
    isRunning(): boolean;
    /**
     * Get language
     */
    getLanguage(): string;
    /**
     * Set language
     */
    setLanguage(language: string): void;
    /**
     * Log message (if verbose)
     */
    private log;
}
/**
 * Factory function: create and initialize STT manager
 */
export declare function createSTTManager(options?: STTManagerOptions): Promise<STTManager>;
//# sourceMappingURL=stt-manager.d.ts.map