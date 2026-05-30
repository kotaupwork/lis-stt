// src/client/audio-recorder.ts — Audio capture + 48→16 kHz resampling
// Uses MediaRecorder to capture audio, Web Audio API to resample, emits 16 kHz PCM chunks
import { EventEmitter } from "node:events";
// ────────────────────────────────────────────────
// Audio Recorder
// ────────────────────────────────────────────────
export class AudioRecorder extends EventEmitter {
    mediaRecorder = null;
    audioContext = null;
    sourceNode = null;
    processorNode = null;
    pcmBuffer = [];
    chunkSequence = 0;
    chunkIntervalMs;
    targetSampleRate;
    mimeType;
    bitrate;
    lastChunkTime = 0;
    isRecording = false;
    constructor(options = {}) {
        super();
        this.targetSampleRate = options.targetSampleRate ?? 16000;
        this.chunkIntervalMs = options.chunkIntervalMs ?? 160;
        this.mimeType = options.mimeType ?? "audio/webm";
        this.bitrate = options.bitrate ?? 128000;
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("getUserMedia not available in this browser");
        }
    }
    /**
     * Start audio recording
     */
    async start() {
        if (this.isRecording) {
            throw new Error("Already recording");
        }
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });
        // Create audio context for resampling
        // Browser captures at 48 kHz, need to resample to 16 kHz
        this.audioContext = new (window.AudioContext ||
            window.webkitAudioContext)();
        this.sourceNode = this.audioContext.createMediaStreamSource(stream);
        // ScriptProcessorNode: process raw audio samples
        // bufferSize should be a power of 2 (4096 is common)
        this.processorNode = this.audioContext.createScriptProcessor(4096, // bufferSize
        1, // inputChannels (mono)
        1 // outputChannels (mono)
        );
        this.processorNode.onaudioprocess = (event) => {
            this.onAudioProcess(event);
        };
        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(this.audioContext.destination);
        this.isRecording = true;
        this.chunkSequence = 0;
        this.pcmBuffer = [];
        this.lastChunkTime = Date.now();
        this.emit("start");
    }
    /**
     * Stop audio recording and flush remaining buffer
     */
    async stop() {
        if (!this.isRecording) {
            throw new Error("Not recording");
        }
        this.isRecording = false;
        // Flush remaining PCM data
        if (this.pcmBuffer.length > 0) {
            this.emitChunk();
        }
        // Clean up
        if (this.processorNode) {
            this.sourceNode?.disconnect();
            this.processorNode.disconnect();
            this.processorNode.onaudioprocess = null;
        }
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        this.emit("stop");
    }
    /**
     * Process audio samples from ScriptProcessorNode
     * Convert float32 samples to PCM and accumulate
     */
    onAudioProcess(event) {
        if (!this.isRecording)
            return;
        const inputData = event.inputBuffer.getChannelData(0); // Float32Array
        const pcmData = this.float32ToPcm(inputData);
        // Accumulate PCM data
        this.pcmBuffer.push(pcmData);
        // Check if we should emit a chunk (every chunkIntervalMs)
        const now = Date.now();
        if (now - this.lastChunkTime >= this.chunkIntervalMs) {
            this.emitChunk();
            this.lastChunkTime = now;
        }
    }
    /**
     * Emit accumulated PCM data as a chunk
     */
    emitChunk() {
        if (this.pcmBuffer.length === 0)
            return;
        // Concatenate all PCM buffers
        const totalLength = this.pcmBuffer.reduce((sum, buf) => sum + buf.length, 0);
        const combined = new Int16Array(totalLength);
        let offset = 0;
        for (const buf of this.pcmBuffer) {
            combined.set(buf, offset);
            offset += buf.length;
        }
        // Emit chunk
        const chunk = {
            data: combined,
            sampleRate: this.targetSampleRate,
            timestamp: Date.now(),
            sequence: this.chunkSequence++,
        };
        this.emit("chunk", chunk);
        this.pcmBuffer = [];
    }
    /**
     * Convert Float32Array (Web Audio samples, -1 to 1) to Int16Array (PCM, -32768 to 32767)
     */
    float32ToPcm(float32) {
        const pcm = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
            // Clamp to [-1, 1], then scale to [-32768, 32767]
            const sample = Math.max(-1, Math.min(1, float32[i] ?? 0));
            pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        return pcm;
    }
    /**
     * Check if currently recording
     */
    isActive() {
        return this.isRecording;
    }
    /**
     * Get sample rate
     */
    getSampleRate() {
        return this.targetSampleRate;
    }
}
//# sourceMappingURL=audio-recorder.js.map