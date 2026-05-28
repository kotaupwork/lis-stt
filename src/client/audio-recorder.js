// src/client/audio-recorder.js — Audio capture + 48→16 kHz resampling
// Uses Web Audio API to capture and resample audio

import { EventEmitter } from "./events.js";

/**
 * Audio recorder that captures microphone input and resamples to target sample rate
 */
export class AudioRecorder extends EventEmitter {
  constructor(options = {}) {
    super();

    this.targetSampleRate = options.targetSampleRate ?? 16000;
    this.chunkIntervalMs = options.chunkIntervalMs ?? 160;
    this.mimeType = options.mimeType ?? "audio/webm";
    this.bitrate = options.bitrate ?? 128000;

    this.mediaRecorder = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;

    this.pcmBuffer = [];
    this.chunkSequence = 0;
    this.lastChunkTime = 0;
    this.isRecording = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia not available in this browser");
    }
  }

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

    // Create audio context
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // ScriptProcessorNode for raw audio processing
    this.processorNode = this.audioContext.createScriptProcessor(
      4096, // bufferSize
      1,    // inputChannels (mono)
      1     // outputChannels (mono)
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

  onAudioProcess(event) {
    if (!this.isRecording) return;

    const inputData = event.inputBuffer.getChannelData(0);
    const pcmData = this.float32ToPcm(inputData);

    this.pcmBuffer.push(pcmData);

    // Check if we should emit a chunk
    const now = Date.now();
    if (now - this.lastChunkTime >= this.chunkIntervalMs) {
      this.emitChunk();
      this.lastChunkTime = now;
    }
  }

  emitChunk() {
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
    const chunk = {
      data: combined,
      sampleRate: this.targetSampleRate,
      timestamp: Date.now(),
      sequence: this.chunkSequence++,
    };

    this.emit("chunk", chunk);
    this.pcmBuffer = [];
  }

  float32ToPcm(float32) {
    const pcm = new Int16Array(float32.length);

    for (let i = 0; i < float32.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return pcm;
  }

  isActive() {
    return this.isRecording;
  }

  getSampleRate() {
    return this.targetSampleRate;
  }
}
