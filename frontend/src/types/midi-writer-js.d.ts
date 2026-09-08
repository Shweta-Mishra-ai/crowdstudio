// midi-writer-js ships real .d.ts files, but its package.json "exports"
// map doesn't include a "types" condition, and TypeScript's "bundler"
// moduleResolution mode (required by Vite) only trusts the top-level
// "types" field when there's no "exports" map at all — so with "exports"
// present but typeless, TS falls back to `any` and errors under
// noUnusedLocals-style strict settings. This shim declares just the
// surface area this project actually calls, so the import stays type-safe
// without needing to patch the third-party package.
declare module "midi-writer-js" {
  interface NoteEventOptions {
    pitch: string[];
    duration: string;
    velocity?: number;
  }

  class NoteEvent {
    constructor(options: NoteEventOptions);
  }

  class Track {
    setTempo(bpm: number): Track;
    addInstrumentName(text: string): Track;
    addEvent(event: NoteEvent): Track;
  }

  class Writer {
    constructor(tracks: Track[]);
    buildFile(): Uint8Array;
  }

  const MidiWriter: {
    Track: typeof Track;
    Writer: typeof Writer;
    NoteEvent: typeof NoteEvent;
  };

  export default MidiWriter;
}
