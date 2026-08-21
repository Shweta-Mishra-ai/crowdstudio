import * as Tone from "tone";
import { SCALES, buildTriad, type JamParams, type MixerState } from "../hooks/useJamEngine";
import { encodeWav, type PcmSource } from "./wavEncoder";

const PROGRESSIONS: Record<JamParams["scale"], number[]> = {
  major: [0, 4, 5, 3],
  minor: [0, 5, 2, 6],
  pentatonic: [0, 3, 4, 2],
};

/**
 * Renders the arrangement offline (faster than real-time, deterministic)
 * and returns a downloadable WAV blob — this is the "real audio file a
 * producer can drag into any DAW" export. Deliberately a separate,
 * self-contained build of the instrument graph rather than sharing
 * useJamEngine's live nodes: Tone.Offline runs in its own isolated audio
 * context, so live-context nodes can't be reused here anyway, and keeping
 * this standalone avoids risking the already-tested live playback path.
 * The chord/scale logic (SCALES, buildTriad, PROGRESSIONS shape) matches
 * the live engine exactly, so the export sounds like what you heard.
 */
export async function renderJamToWav(params: JamParams, mixer: MixerState, bars = 8): Promise<Blob> {
  const secondsPerBar = (60 / params.tempo) * 4;
  const durationSeconds = secondsPerBar * bars;

  const buffer = await Tone.Offline(() => {
    const compressor = new Tone.Compressor(-18, 3).toDestination();
    const masterFilter = new Tone.Filter(params.filterCutoff, "lowpass").connect(compressor);
    const reverb = new Tone.Reverb({ decay: 3.2, wet: params.reverbWet }).connect(masterFilter);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.25, wet: 0.18 }).connect(reverb);

    const drumBus = new Tone.Filter(8000, "lowpass");
    const drumChannel = new Tone.Volume(mixer.muted.drums ? -Infinity : mixer.volume.drums).connect(compressor);
    drumBus.connect(drumChannel);
    const kick = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.05 }).connect(drumBus);
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).connect(drumBus);
    hat.volume.value = -12;

    const bassChannel = new Tone.Volume(mixer.muted.bass ? -Infinity : mixer.volume.bass).connect(reverb);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.4 },
    }).connect(bassChannel);

    const padChannel = new Tone.Volume(mixer.muted.pads ? -Infinity : mixer.volume.pads).connect(reverb);
    const pad = new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.6, decay: 0.3, sustain: 0.6, release: 1.5 },
    }).connect(padChannel);

    const leadChannel = new Tone.Volume(mixer.muted.lead ? -Infinity : mixer.volume.lead).connect(delay);
    const lead = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.4 },
    }).connect(leadChannel);

    Tone.Transport.bpm.value = params.tempo;
    const progression = PROGRESSIONS[params.scale];
    const scaleIntervals = SCALES[params.scale];
    let barIndex = 0;
    let currentChord: string[] = [];

    new Tone.Loop((time) => {
      const degree = progression[barIndex % progression.length];
      currentChord = buildTriad(scaleIntervals, params.rootNote, degree);
      pad.triggerAttackRelease(currentChord, "1m", time);
      bass.triggerAttackRelease(currentChord[0], "2n", time);
      barIndex += 1;
    }, "1m").start(0);

    new Tone.Sequence(
      (time, step: number) => {
        if (step === 0 || step === 8) kick.triggerAttackRelease("C1", "8n", time);
        if (Math.random() < 0.25 + params.energy * 0.5) hat.triggerAttackRelease("16n", time);
      },
      Array.from({ length: 16 }, (_, i) => i),
      "16n"
    ).start(0);

    new Tone.Sequence(
      (time) => {
        if (Math.random() > 0.35 + params.energy * 0.35) return;
        if (currentChord.length === 0) return;
        const note = currentChord[Math.floor(Math.random() * currentChord.length)];
        const octaveUp = Tone.Frequency(note).transpose(12).toNote();
        lead.triggerAttackRelease(Math.random() < 0.5 ? note : octaveUp, "8n", time);
      },
      ["8n"],
      "8n"
    ).start(0);

    Tone.Transport.start();
  }, durationSeconds);

  return encodeWav(buffer.get() as unknown as PcmSource);
}
