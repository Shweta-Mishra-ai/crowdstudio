import { describe, it, expect } from "vitest";
import { buildJamMidi, buildJamMidiBytes } from "../lib/exportMidi";
import { encodeWav, encodeWavBytes, type PcmSource } from "../lib/wavEncoder";
import { DEFAULT_JAM_PARAMS } from "../hooks/useJamEngine";

describe("buildJamMidi", () => {
  it("produces a blob with the correct MIDI type", () => {
    const blob = buildJamMidi(DEFAULT_JAM_PARAMS, 4);
    expect(blob.type).toBe("audio/midi");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("starts with a valid MIDI file header (MThd)", () => {
    const bytes = new Uint8Array(buildJamMidiBytes(DEFAULT_JAM_PARAMS, 4));
    const header = String.fromCharCode(...bytes.slice(0, 4));
    expect(header).toBe("MThd");
  });

  it("produces a larger file for more bars (more note events)", () => {
    const short = buildJamMidiBytes(DEFAULT_JAM_PARAMS, 2);
    const long = buildJamMidiBytes(DEFAULT_JAM_PARAMS, 16);
    expect(long.byteLength).toBeGreaterThan(short.byteLength);
  });

  it("doesn't throw for every supported scale", () => {
    for (const scale of ["major", "minor", "pentatonic"] as const) {
      expect(() => buildJamMidiBytes({ ...DEFAULT_JAM_PARAMS, scale }, 4)).not.toThrow();
    }
  });
});

describe("encodeWav", () => {
  function makeFakeBuffer(numFrames: number, numChannels = 2): PcmSource {
    const channels = Array.from({ length: numChannels }, () => new Float32Array(numFrames).fill(0.5));
    return {
      numberOfChannels: numChannels,
      sampleRate: 44100,
      length: numFrames,
      getChannelData: (ch: number) => channels[ch],
    };
  }

  it("produces a blob with the correct WAV type", () => {
    const blob = encodeWav(makeFakeBuffer(100));
    expect(blob.type).toBe("audio/wav");
  });

  it("writes a valid RIFF/WAVE header", () => {
    const bytes = new Uint8Array(encodeWavBytes(makeFakeBuffer(100)));
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
  });

  it("produces exactly 44 header bytes plus 2 bytes per sample per channel", () => {
    const numFrames = 1000;
    const numChannels = 2;
    const bytes = encodeWavBytes(makeFakeBuffer(numFrames, numChannels));
    const expectedSize = 44 + numFrames * numChannels * 2;
    expect(bytes.byteLength).toBe(expectedSize);
  });

  it("clips out-of-range samples instead of wrapping/corrupting the file", () => {
    const channels = [new Float32Array([2.5, -3.0, 0])]; // deliberately out of the -1..1 range
    const buffer: PcmSource = {
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 3,
      getChannelData: () => channels[0],
    };
    const bytes = encodeWavBytes(buffer);
    const view = new DataView(bytes);
    const first = view.getInt16(44, true);
    const second = view.getInt16(46, true);
    expect(first).toBe(0x7fff); // clipped to max instead of overflowing
    expect(second).toBe(-0x8000); // clipped to min instead of overflowing
  });
});
