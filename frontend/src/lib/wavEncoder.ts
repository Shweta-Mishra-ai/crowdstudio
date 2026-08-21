/**
 * Minimal interface matching the parts of AudioBuffer this encoder needs —
 * accepting this instead of the real `AudioBuffer` type lets the encoding
 * logic be unit tested with a plain object, since jsdom (used in tests)
 * doesn't implement the Web Audio API at all.
 */
export interface PcmSource {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * Encodes a rendered audio buffer as raw 16-bit PCM WAV bytes. Returns an
 * ArrayBuffer (not a Blob) so this core logic is directly unit-testable —
 * jsdom's Blob polyfill doesn't implement `.arrayBuffer()`, so tests read
 * bytes from this function directly rather than round-tripping through a
 * Blob just to get them back out.
 */
export function encodeWavBytes(buffer: PcmSource): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels and convert float32 (-1..1) samples to int16.
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][frame]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

/**
 * Encodes a rendered audio buffer as a standard 16-bit PCM WAV file — the
 * one audio format every DAW (Ableton, FL Studio, Logic, Pro Tools,
 * Reaper, Audacity) opens natively with no plugin or conversion step.
 */
export function encodeWav(buffer: PcmSource): Blob {
  return new Blob([encodeWavBytes(buffer)], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
