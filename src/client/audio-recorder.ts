// src/client/audio-recorder.ts — Audio capture + 48→16 kHz resampling
// Uses MediaRecorder to capture audio, Web Audio API to resample, emits 16 kHz PCM chunks

import { EventEmitter } from "node:events";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

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

// ────────────────────────────────────────────────
// Audio Recorder
// ────────────────────────────────────────────────

export class AudioRecorder extends EventEmitter {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaAudioAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  private pcmBuffer: Int16Array[] = [];
  private chunkSequence = 0;
  private chunkIntervalMs: number;
  private targetSampleRate: number;
  private mimeType: string;
  private bitrate: number;

  private lastChunkTime = 0;
  private isRecording = false;

  constructor(options: AudioRecorderOptions = {}) {
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
  async start(): Promise<void> {
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
      (window as any).webkitAudioContext)();

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // ScriptProcessorNode: process raw audio samples
    // bufferSize should be a power of 2 (4096 is common)
    this.processorNode = this.audioContext.createScriptProcessor(
      4096, // bufferSize
      1, // inputChannels (mono)
      1 // outputChannels (mono)
    );

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
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
  async stop(): Promise<void> {
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
  private onAudioProcess(event: AudioProcessingEvent): void {
    if (!this.isRecording) return;

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
  private emitChunk(): void {
    if (this.pcmBuffer.length === 0) return;

    // Concatenate all PCM buffers
    const totalLength = this.pcmBuffer.reduce(
      (sum, buf) => sum + buf.length,
      0
    );
    const combined = new Int16Array(totalLength);

    let offset = 0;
    for (const buf of this.pcmBuffer) {
      combined.set(buf, offset);
      offset += buf.length;
    }

    // Emit chunk
    const chunk: AudioChunk = {
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
  private float32ToPcm(float32: Float32Array): Int16Array {
    const pcm = new Int16Array(float32.length);

    for (let i = 0; i < float32.length; i++) {
      // Clamp to [-1, 1], then scale to [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, float32[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return pcm;
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get sample rate
   */
  getSampleRate(): number {
    return this.targetSampleRate;
  }
}
