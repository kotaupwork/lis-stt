import { EventEmitter } from "node:events";
export interface AudioRecorderOptions {
    /**
     * Sample rate for output PCM (default: 16000 Hz)
     * Vosk expects 16 kHz mono
     */
    targetSampleRate?: number;
    /**
     * Chunk emission interval in milliseconds (default: 160ms)
     * At 16 kHz, 160ms = 2560 samples = 5120 bytes (16-bit mono)
     */
    chunkIntervalMs?: number;
    /**
     * Audio format for MediaRecorder (default: "audio/webm")
     * Supported: "audio/webm", "audio/wav", "audio/mp4", etc.
     */
    mimeType?: string;
    /**
     * Bitrate for recording (default: 128000 bps = 128 kbps)
     */
    bitrate?: number;
}
export interface AudioChunk {
    /**
     * PCM data (16-bit little-endian mono at targetSampleRate)
     */
    data: Int16Array;
    /**
     * Sample rate (e.g., 16000)
     */
    sampleRate: number;
    /**
     * Timestamp when chunk was emitted
     */
    timestamp: number;
    /**
     * Sequence number (0, 1, 2, ...)
     */
    sequence: number;
}
export declare class AudioRecorder extends EventEmitter {
    private mediaRecorder;
    private audioContext;
    private sourceNode;
    private processorNode;
    private pcmBuffer;
    private chunkSequence;
    private chunkIntervalMs;
    private targetSampleRate;
    private mimeType;
    private bitrate;
    private lastChunkTime;
    private isRecording;
    constructor(options?: AudioRecorderOptions);
    /**
     * Start audio recording
     */
    start(): Promise<void>;
    /**
     * Stop audio recording and flush remaining buffer
     */
    stop(): Promise<void>;
    /**
     * Process audio samples from ScriptProcessorNode
     * Convert float32 samples to PCM and accumulate
     */
    private onAudioProcess;
    /**
     * Emit accumulated PCM data as a chunk
     */
    private emitChunk;
    /**
     * Convert Float32Array (Web Audio samples, -1 to 1) to Int16Array (PCM, -32768 to 32767)
     */
    private float32ToPcm;
    /**
     * Check if currently recording
     */
    isActive(): boolean;
    /**
     * Get sample rate
     */
    getSampleRate(): number;
}
//# sourceMappingURL=audio-recorder.d.ts.map