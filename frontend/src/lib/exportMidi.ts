import MidiWriter from "midi-writer-js";
import { SCALES, buildTriad, type JamParams } from "../hooks/useJamEngine";

const PROGRESSIONS: Record<JamParams["scale"], number[]> = {
  major: [0, 4, 5, 3],
  minor: [0, 5, 2, 6],
  pentatonic: [0, 3, 4, 2],
};

export function buildJamMidiBytes(params: JamParams, bars = 8): ArrayBuffer {
  const progression = PROGRESSIONS[params.scale];
  const scaleIntervals = SCALES[params.scale];

  const padTrack = new MidiWriter.Track();
  const bassTrack = new MidiWriter.Track();
  const leadTrack = new MidiWriter.Track();

  padTrack.setTempo(params.tempo);
  padTrack.addInstrumentName("CrowdJam Pads");
  bassTrack.addInstrumentName("CrowdJam Bass");
  leadTrack.addInstrumentName("CrowdJam Lead");

  for (let bar = 0; bar < bars; bar++) {
    const degree = progression[bar % progression.length];
    const chord = buildTriad(scaleIntervals, params.rootNote, degree);

    padTrack.addEvent(
      new MidiWriter.NoteEvent({ pitch: chord, duration: "1", velocity: 70 })
    );
    bassTrack.addEvent(
      new MidiWriter.NoteEvent({ pitch: [chord[0].replace(/\d+$/, (m) => String(Number(m) - 1))], duration: "2", velocity: 90 })
    );
    // Simple deterministic up-down arpeggio across the chord tones, one
    // 8th note per step, eight steps per bar — a real, editable melodic
    // guide rather than an attempt to "capture" the live random lead.
    const arpNotes = [chord[0], chord[1], chord[2], chord[1], chord[0], chord[1], chord[2], chord[1]];
    for (const note of arpNotes) {
      leadTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [note], duration: "8", velocity: 60 }));
    }
  }

  const writer = new MidiWriter.Writer([padTrack, bassTrack, leadTrack]);
  const bytes = writer.buildFile();
  // Copy into a plain ArrayBuffer — buildFile()'s Uint8Array is typed
  // against the generic ArrayBufferLike (which includes SharedArrayBuffer),
  // and Blob's constructor type requires a concrete ArrayBuffer.
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return arrayBuffer;
}

/**
 * Builds a standard General MIDI file (chords + bass + a deterministic
 * arpeggiated melody guide, all on separate tracks) that opens directly in
 * any DAW as editable notes — not audio, actual MIDI note events a
 * producer can rewrite, quantize, or reassign instruments to.
 *
 * Deliberately deterministic: the live engine's lead/hat parts are
 * randomized per-step for a human, evolving feel, which has no meaningful
 * translation into a fixed MIDI file. Instead of trying to "record" one
 * random performance, this generates a clean, predictable arpeggio over
 * the same chord tones — a more useful starting point for editing than a
 * frozen snapshot of randomness would be.
 */
export function buildJamMidi(params: JamParams, bars = 8): Blob {
  return new Blob([buildJamMidiBytes(params, bars)], { type: "audio/midi" });
}
