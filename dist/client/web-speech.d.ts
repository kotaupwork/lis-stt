import { EventEmitter } from "node:events";
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
export declare class WebSpeechRecognizer extends EventEmitter {
    private recognition;
    private isListening;
    private interimTranscript;
    private finalTranscript;
    private language;
    private continuous;
    private interimResults;
    private maxAlternatives;
    constructor(options?: WebSpeechOptions);
    /**
     * Setup Web Speech API event handlers
     */
    private setupRecognition;
    /**
     * Start listening
     */
    start(): Promise<void>;
    /**
     * Stop listening
     */
    stop(): Promise<void>;
    /**
     * Abort listening
     */
    abort(): void;
    /**
     * Check if currently listening
     */
    isActive(): boolean;
    /**
     * Get language
     */
    getLanguage(): string;
    /**
     * Set language
     */
    setLanguage(language: string): void;
}
/**
 * Check if Web Speech API is available in this browser
 */
export declare function isWebSpeechAPIAvailable(): boolean;
/**
 * Check if Web Speech API is actually usable
 * (availability may vary by browser, OS, or user settings)
 */
export declare function canUseWebSpeechAPI(): Promise<boolean>;
/**
 * Get browser name for diagnostics
 */
export declare function getBrowserInfo(): {
    name: string;
    webSpeechSupport: boolean;
};
//# sourceMappingURL=web-speech.d.ts.map