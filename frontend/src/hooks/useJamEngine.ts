import { useCallback, useRef, useState } from "react";
import * as Tone from "tone";

export interface JamParams {
  scale: "major" | "minor" | "pentatonic";
  rootNote: string; // e.g. "C3"
  tempo: number; // BPM
  filterCutoff: number; // Hz
  reverbWet: number; // 0-1
  energy: number; // 0-1 — drum density, lead note frequency, brightness
}

export const SCALES: Record<JamParams["scale"], number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

// Diatonic chord progressions expressed as scale-degree indices (0-based),
// chosen to sound like a real, recognizable progression rather than random
// notes: major = I-V-vi-IV (the most common pop progression), minor =
// i-VI-III-VII, pentatonic has no thirds/sevenths in the usual sense so we
// just cycle root movements that stay consonant against every other degree.
const PROGRESSIONS: Record<JamParams["scale"], number[]> = {
  major: [0, 4, 5, 3],
  minor: [0, 5, 2, 6],
  pentatonic: [0, 3, 4, 2],
};

export const DEFAULT_JAM_PARAMS: JamParams = {
  scale: "pentatonic",
  rootNote: "C3",
  tempo: 90,
  filterCutoff: 2000,
  reverbWet: 0.35,
  energy: 0.6,
};

export const SOUND_PRESETS: Record<string, Partial<JamParams>> = {
  "Lo-Fi Sunset": { scale: "minor", rootNote: "D3", tempo: 82, filterCutoff: 1400, reverbWet: 0.55, energy: 0.50 },
  "Synthwave Pulse": { scale: "minor", rootNote: "A2", tempo: 118, filterCutoff: 3800, reverbWet: 0.40, energy: 0.85 },
  "Funk Groove": { scale: "major", rootNote: "G2", tempo: 105, filterCutoff: 2600, reverbWet: 0.20, energy: 0.75 },
  "Ambient Drift": { scale: "pentatonic", rootNote: "C3", tempo: 75, filterCutoff: 900, reverbWet: 0.70, energy: 0.35 },
  "Cyber EDM": { scale: "minor", rootNote: "F2", tempo: 128, filterCutoff: 4500, reverbWet: 0.30, energy: 0.95 },
};

export type MixerChannel = "drums" | "bass" | "pads" | "lead";

export interface MixerState {
  volume: Record<MixerChannel, number>; // dB, roughly -40 (near-silent) to 0 (unity)
  muted: Record<MixerChannel, boolean>;
}

export const DEFAULT_MIXER: MixerState = {
  volume: { drums: -6, bass: -6, pads: -14, lead: -8 },
  muted: { drums: false, bass: false, pads: false, lead: false },
};

/** Resolves a scale-degree index (can exceed the scale length, wrapping up
 * an octave) to an absolute note, staying diatonic instead of using fixed
 * semitone intervals — this is what keeps chords in key. */
export function degreeToNote(scaleIntervals: number[], root: string, degree: number): string {
  const len = scaleIntervals.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return Tone.Frequency(root).transpose(scaleIntervals[idx] + octave * 12).toNote();
}

export function buildTriad(scaleIntervals: number[], root: string, degree: number): string[] {
  return [
    degreeToNote(scaleIntervals, root, degree),
    degreeToNote(scaleIntervals, root, degree + 2),
    degreeToNote(scaleIntervals, root, degree + 4),
  ];
}

interface EngineNodes {
  drumBus: Tone.Filter;
  kick: Tone.MembraneSynth;
  hat: Tone.NoiseSynth;
  bass: Tone.MonoSynth;
  pad: Tone.PolySynth;
  lead: Tone.PolySynth;
  masterFilter: Tone.Filter;
  reverb: Tone.Freeverb;
  delay: Tone.FeedbackDelay;
  compressor: Tone.Compressor;
  analyser: Tone.Analyser;
  drumSeq: Tone.Sequence;
  chordLoop: Tone.Loop;
  leadSeq: Tone.Sequence;
  // One Tone.Volume per mixer channel — this is what the Studio's mixing
  // dashboard actually controls (fader + mute), kept separate from each
  // synth's own internal `.volume` (used only for fixed internal balance,
  // e.g. hats sitting quieter than the kick within the "drums" channel).
  channels: Record<MixerChannel, Tone.Volume>;
}

/**
 * Real-time generative arrangement engine — not a single lonely melody
 * loop. Layers four parts through a shared filter/reverb/compressor bus:
 *  - drums: kick on the downbeats, hi-hats whose density scales with `energy`
 *  - bass: root note of the current chord, one hit per bar
 *  - pads: full sustained diatonic triad per bar (this is what makes it
 *    sound harmonically "real" instead of a single note wandering a scale)
 *  - lead: sparse arpeggiated notes drawn from the current chord tones,
 *    with a feedback delay so it doesn't sound dry/robotic
 * The four-chord progression repeats every 4 bars and is chosen per scale
 * to be a recognizable, resolved progression (see PROGRESSIONS above).
 */
export function useJamEngine() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [params, setParamsState] = useState<JamParams>(DEFAULT_JAM_PARAMS);
  const [mixer, setMixerState] = useState<MixerState>(DEFAULT_MIXER);
  const nodesRef = useRef<EngineNodes | null>(null);
  const barIndexRef = useRef(0);
  const currentChordRef = useRef<string[]>([]);
  // Running Tone.Sequence/Loop callbacks close over whatever this ref
  // points to *at call time* (not at creation time), so live slider changes
  // to scale/rootNote/energy actually affect the next bar/step instead of
  // being silently ignored until the jam is stopped and restarted.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  // Read at start() time to set each channel's initial volume/mute — kept
  // as a ref (not read from state directly in start's closure) so mixer
  // adjustments made *before* pressing Start still take effect.
  const mixerRef = useRef(mixer);
  mixerRef.current = mixer;

  const start = useCallback(async () => {
    if (isPlaying) return;
    await Tone.start(); // requires a user gesture — call this from a click handler

    const compressor = new Tone.Compressor(-18, 3).toDestination();
    // Real-time waveform tap on the actual mixed output — this is what
    // powers the Studio visualizer, so what's drawn on screen is the
    // genuine audio signal, not a decorative animation.
    const analyser = new Tone.Analyser("waveform", 256);
    compressor.connect(analyser);
    const masterFilter = new Tone.Filter(params.filterCutoff, "lowpass").connect(compressor);
    const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: params.reverbWet }).connect(masterFilter);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.25, wet: 0.18 }).connect(reverb);

    const drumBus = new Tone.Filter(8000, "lowpass");
    const drumChannel = new Tone.Volume(mixerRef.current.volume.drums).connect(compressor);
    drumBus.connect(drumChannel);
    const kick = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.05 }).connect(drumBus);
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).connect(drumBus);
    hat.volume.value = -12; // balance relative to kick, within the shared drums channel

    const bassChannel = new Tone.Volume(mixerRef.current.volume.bass).connect(reverb);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.4 },
    }).connect(bassChannel);

    const padChannel = new Tone.Volume(mixerRef.current.volume.pads).connect(reverb);
    const pad = new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.6, decay: 0.3, sustain: 0.6, release: 1.5 },
    }).connect(padChannel);

    const leadChannel = new Tone.Volume(mixerRef.current.volume.lead).connect(delay);
    const lead = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.4 },
    }).connect(leadChannel);

    const channels: Record<MixerChannel, Tone.Volume> = {
      drums: drumChannel,
      bass: bassChannel,
      pads: padChannel,
      lead: leadChannel,
    };
    for (const ch of Object.keys(channels) as MixerChannel[]) {
      channels[ch].mute = mixerRef.current.muted[ch];
    }

    Tone.Transport.bpm.value = params.tempo;
    barIndexRef.current = 0;

    // One chord change per bar, cycling through the 4-chord progression for
    // whichever scale is currently selected — reads paramsRef live so
    // switching scale mid-jam changes the progression on the next bar.
    const chordLoop = new Tone.Loop((time) => {
      const p = paramsRef.current;
      const progression = PROGRESSIONS[p.scale];
      const scaleIntervals = SCALES[p.scale];
      const degree = progression[barIndexRef.current % progression.length];
      const chord = buildTriad(scaleIntervals, p.rootNote, degree);
      currentChordRef.current = chord;
      pad.triggerAttackRelease(chord, "1m", time);
      bass.triggerAttackRelease(chord[0], "2n", time);
      barIndexRef.current += 1;
    }, "1m").start(0);

    // 16-step drum pattern per bar: kick on 1 and 3, hats fill in based on
    // `energy` (higher energy = denser hat pattern instead of a fixed grid).
    const drumSeq = new Tone.Sequence(
      (time, step: number) => {
        if (step === 0 || step === 8) kick.triggerAttackRelease("C1", "8n", time);
        const hatProbability = 0.25 + paramsRef.current.energy * 0.5;
        if (Math.random() < hatProbability) hat.triggerAttackRelease("16n", time);
      },
      Array.from({ length: 16 }, (_, i) => i),
      "16n"
    ).start(0);

    // Sparse arpeggiated lead drawn from the current chord — probability of
    // playing a note each 8th-note step scales with `energy`, so low energy
    // gives a lot of open space and high energy feels busier/more excited.
    const leadSeq = new Tone.Sequence(
      (time) => {
        if (Math.random() > 0.35 + paramsRef.current.energy * 0.35) return;
        const chord = currentChordRef.current;
        if (chord.length === 0) return;
        const note = chord[Math.floor(Math.random() * chord.length)];
        const octaveUp = Tone.Frequency(note).transpose(12).toNote();
        lead.triggerAttackRelease(Math.random() < 0.5 ? note : octaveUp, "8n", time);
      },
      ["8n"],
      "8n"
    ).start(0);

    nodesRef.current = {
      drumBus,
      kick,
      hat,
      bass,
      pad,
      lead,
      masterFilter,
      reverb,
      delay,
      compressor,
      analyser,
      drumSeq,
      chordLoop,
      leadSeq,
      channels,
    };

    Tone.Transport.start();
    setIsPlaying(true);
  }, [isPlaying, params]);

  const stop = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    const n = nodesRef.current;
    if (n) {
      [
        n.drumSeq,
        n.chordLoop,
        n.leadSeq,
        n.kick,
        n.hat,
        n.bass,
        n.pad,
        n.lead,
        n.delay,
        n.reverb,
        n.masterFilter,
        n.drumBus,
        n.compressor,
        n.analyser, // was missing — leaked an AnalyserNode on every stop/restart cycle
        ...Object.values(n.channels),
      ].forEach((node) => node.dispose());
    }
    nodesRef.current = null;
    barIndexRef.current = 0;
    setIsPlaying(false);
  }, []);

  const setParams = useCallback((next: Partial<JamParams>) => {
    setParamsState((prev) => {
      const merged = { ...prev, ...next };
      const n = nodesRef.current;
      if (n) {
        if (next.filterCutoff !== undefined) n.masterFilter.frequency.rampTo(next.filterCutoff, 0.15);
        if (next.reverbWet !== undefined) n.reverb.wet.rampTo(next.reverbWet, 0.15);
        if (next.tempo !== undefined) Tone.Transport.bpm.rampTo(next.tempo, 0.3);
      }
      // scale/rootNote/energy changes are picked up by the running
      // sequences via paramsRef (synced above on every render) on their
      // next tick — no node rebuild needed, so parameter changes are
      // glitch-free instead of requiring a stop/restart.
      return merged;
    });
  }, []);

  // Exposes the live analyser node (or null when stopped) for a visualizer
  // component to read each animation frame — not stored in React state
  // since it updates ~60x/sec and would cause a re-render storm.
  const getAnalyser = useCallback(() => nodesRef.current?.analyser ?? null, []);

  const setChannelVolume = useCallback((channel: MixerChannel, db: number) => {
    setMixerState((prev) => {
      const n = nodesRef.current;
      if (n) n.channels[channel].volume.rampTo(db, 0.1);
      return { ...prev, volume: { ...prev.volume, [channel]: db } };
    });
  }, []);

  const toggleChannelMute = useCallback((channel: MixerChannel) => {
    setMixerState((prev) => {
      const next = !prev.muted[channel];
      const n = nodesRef.current;
      if (n) n.channels[channel].mute = next;
      return { ...prev, muted: { ...prev.muted, [channel]: next } };
    });
  }, []);

  return {
    isPlaying,
    params,
    start,
    stop,
    setParams,
    getAnalyser,
    mixer,
    setChannelVolume,
    toggleChannelMute,
  };
}
