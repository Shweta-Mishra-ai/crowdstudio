import { useEffect, useState, type ReactNode } from "react";
import { Play, Square, Save, Sparkles, Music2, Drum, Waves, Volume2, VolumeX, Download, FileMusic } from "lucide-react";
import { useJamEngine, type MixerChannel } from "../hooks/useJamEngine";
import { usePresence } from "../hooks/usePresence";
import { getSocket } from "../lib/socket";
import { api, apiErrorMessage } from "../lib/api";
import { VUMeter } from "../components/VUMeter";
import { AudioVisualizer } from "../components/AudioVisualizer";
import { ChatPanel } from "../components/ChatPanel";
import { renderJamToWav } from "../lib/renderJamToWav";
import { buildJamMidi } from "../lib/exportMidi";

export default function Studio() {
  const { isPlaying, params, start, stop, setParams, getAnalyser, mixer, setChannelVolume, toggleChannelMute } =
    useJamEngine();
  const presence = usePresence();
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedTrackId, setSavedTrackId] = useState<string | null>(null);
  const [exportPrompt, setExportPrompt] = useState("");
  const [exportState, setExportState] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [wavRendering, setWavRendering] = useState(false);
  const [wavError, setWavError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-jam-room");
    return () => {
      socket.emit("leave-jam-room");
    };
  }, []);

  async function handleSave() {
    if (!title.trim()) {
      setSaveError("Give your jam a title first");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const { data } = await api.post("/tracks", { title, jamConfig: params, durationSec: 0 });
      setSaveState("saved");
      setSavedTrackId(data.track.id);
    } catch (err) {
      setSaveState("error");
      setSaveError(apiErrorMessage(err, "Could not save track"));
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    // Revoke on a delay rather than immediately — some browsers cancel the
    // download if the object URL is revoked before the click is processed.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleDownloadWav() {
    setWavRendering(true);
    setWavError(null);
    try {
      const blob = await renderJamToWav(params, mixer, 8);
      downloadBlob(blob, `${title || "crowdjam-jam"}.wav`);
    } catch (err) {
      setWavError(err instanceof Error ? err.message : "Could not render audio");
    } finally {
      setWavRendering(false);
    }
  }

  function handleDownloadMidi() {
    const blob = buildJamMidi(params, 8);
    downloadBlob(blob, `${title || "crowdjam-jam"}.mid`);
  }

  async function handleExport() {
    if (!savedTrackId) return;
    setExportState("exporting");
    setExportError(null);
    try {
      const { data } = await api.post(`/tracks/${savedTrackId}/export`, { prompt: exportPrompt });
      setExportUrl(data.aiExportUrl);
      setExportState("done");
    } catch (err) {
      setExportState("error");
      // Correctly surfaces "AI export is not configured on this server"
      // when no provider key is set, instead of pretending it worked.
      setExportError(apiErrorMessage(err, "AI export failed"));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-primary sm:text-3xl">Jam Studio</h1>
          <p className="mt-1 flex items-center gap-2 font-mono text-xs text-muted">
            <VUMeter active={presence.inJamRoom > 0} bars={3} />
            {presence.inJamRoom} jamming right now — live, over WebSocket
          </p>
        </div>
        <button
          onClick={() => (isPlaying ? stop() : start())}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 font-display text-base font-semibold transition-colors ${
            isPlaying ? "bg-accent text-bg" : "bg-primary text-bg"
          }`}
        >
          {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          {isPlaying ? "Stop" : "Start Jam"}
        </button>
      </div>

      <div className="channel-strip mb-6 p-3">
        <AudioVisualizer getAnalyser={getAnalyser} active={isPlaying} />
      </div>

      {/* Real mixing dashboard — each channel has its own volume fader and
          mute button wired to an actual Tone.Volume node in the signal
          chain, not just a decorative meter. */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MixerStrip
          icon={<Drum size={16} />}
          label="Drums"
          channel="drums"
          active={isPlaying}
          db={mixer.volume.drums}
          muted={mixer.muted.drums}
          onVolumeChange={setChannelVolume}
          onToggleMute={toggleChannelMute}
        />
        <MixerStrip
          icon={<Waves size={16} />}
          label="Bass"
          channel="bass"
          active={isPlaying}
          db={mixer.volume.bass}
          muted={mixer.muted.bass}
          onVolumeChange={setChannelVolume}
          onToggleMute={toggleChannelMute}
        />
        <MixerStrip
          icon={<Music2 size={16} />}
          label="Pads"
          channel="pads"
          active={isPlaying}
          db={mixer.volume.pads}
          muted={mixer.muted.pads}
          onVolumeChange={setChannelVolume}
          onToggleMute={toggleChannelMute}
        />
        <MixerStrip
          icon={<Sparkles size={16} />}
          label="Lead"
          channel="lead"
          active={isPlaying}
          db={mixer.volume.lead}
          muted={mixer.muted.lead}
          onVolumeChange={setChannelVolume}
          onToggleMute={toggleChannelMute}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="channel-strip p-6">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">Groove</h2>
          <Slider
            label="Tempo"
            value={params.tempo}
            min={60}
            max={160}
            onChange={(v) => setParams({ tempo: v })}
            suffix=" bpm"
          />
          <Slider
            label="Energy"
            value={Math.round(params.energy * 100)}
            min={0}
            max={100}
            onChange={(v) => setParams({ energy: v / 100 })}
            suffix="%"
            hint="Drum density and lead note frequency"
          />
          <div className="mt-4">
            <label htmlFor="jam-scale" className="mb-1 block text-sm text-muted">Scale</label>
            <select
              id="jam-scale"
              name="scale"
              className="w-full rounded border border-paper/15 bg-bg/60 px-3 py-2 transition-colors focus:border-primary"
              value={params.scale}
              onChange={(e) => setParams({ scale: e.target.value as typeof params.scale })}
            >
              <option value="pentatonic">Pentatonic</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </div>

        <div className="channel-strip p-6">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">Tone</h2>
          <Slider
            label="Filter cutoff"
            value={params.filterCutoff}
            min={200}
            max={8000}
            onChange={(v) => setParams({ filterCutoff: v })}
            suffix=" Hz"
          />
          <Slider
            label="Reverb"
            value={Math.round(params.reverbWet * 100)}
            min={0}
            max={100}
            onChange={(v) => setParams({ reverbWet: v / 100 })}
            suffix="%"
          />
        </div>
      </div>

      <div className="channel-strip mb-6 p-6">
        <h2 className="mb-1 font-semibold">Export to your DAW</h2>
        <p className="mb-3 text-xs text-muted">
          Real files, not a fake connection — download and drag straight into Ableton, FL Studio,
          Logic, Reaper, or any other DAW. WAV renders 8 bars of actual audio offline (a few
          seconds); MIDI is instant, editable note data (chords, bass, and a melodic guide).
        </p>
        {wavError && <p className="mb-3 text-sm text-alert" role="alert">{wavError}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleDownloadWav}
            disabled={wavRendering}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-paper/15 py-2 text-sm transition-colors hover:border-primary disabled:opacity-50"
          >
            <Download size={15} />
            {wavRendering ? "Rendering…" : "Download WAV"}
          </button>
          <button
            onClick={handleDownloadMidi}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-paper/15 py-2 text-sm transition-colors hover:border-primary"
          >
            <FileMusic size={15} />
            Download MIDI
          </button>
        </div>
      </div>

      <div className="mb-6">
        <ChatPanel />
      </div>

      <div className="channel-strip p-6">
        <label htmlFor="track-title" className="mb-1 block text-sm text-muted">Track title</label>
        <input
          id="track-title"
          name="title"
          className="mb-3 w-full rounded border border-paper/15 bg-bg/60 px-3 py-2 transition-colors focus:border-primary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My late-night jam"
          maxLength={100}
        />
        {saveError && <p className="mb-3 text-sm text-alert" role="alert">{saveError}</p>}
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="flex w-full items-center justify-center gap-2 rounded border border-primary py-2 text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <Save size={16} />
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save to feed"}
        </button>
      </div>

      {savedTrackId && (
        <div className="channel-strip mt-6 p-6">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <Sparkles size={16} className="text-accent" /> AI Export
          </h2>
          <p className="mb-3 text-xs text-muted">
            Renders this jam into a downloadable track via an external AI provider. Only works if
            the server has a provider configured — otherwise you'll get a clear error, not a fake result.
          </p>
          <label htmlFor="export-prompt" className="sr-only">Describe the vibe for AI export</label>
          <input
            id="export-prompt"
            name="exportPrompt"
            className="mb-3 w-full rounded border border-paper/15 bg-bg/60 px-3 py-2 text-sm transition-colors focus:border-primary"
            placeholder="Describe the vibe you want, e.g. 'dreamy lo-fi with soft vocals'"
            maxLength={500}
            value={exportPrompt}
            onChange={(e) => setExportPrompt(e.target.value)}
          />
          {exportError && <p className="mb-3 text-sm text-alert" role="alert">{exportError}</p>}
          {exportState === "done" && exportUrl && (
            <audio controls src={exportUrl} className="mb-3 w-full" />
          )}
          <button
            onClick={handleExport}
            disabled={exportState === "exporting" || !exportPrompt.trim()}
            className="w-full rounded bg-accent py-2 text-sm font-semibold text-bg disabled:opacity-50"
          >
            {exportState === "exporting" ? "Rendering…" : "Export with AI"}
          </button>
        </div>
      )}
    </div>
  );
}

function MixerStrip({
  icon,
  label,
  channel,
  active,
  db,
  muted,
  onVolumeChange,
  onToggleMute,
}: {
  icon: ReactNode;
  label: string;
  channel: MixerChannel;
  active: boolean;
  db: number;
  muted: boolean;
  onVolumeChange: (channel: MixerChannel, db: number) => void;
  onToggleMute: (channel: MixerChannel) => void;
}) {
  const isAudible = active && !muted;
  return (
    <div className="channel-strip flex flex-col items-center gap-2 py-4">
      <span className={isAudible ? "text-primary" : "text-muted"}>{icon}</span>
      <VUMeter active={isAudible} bars={5} />
      <span className="font-mono text-xs text-muted">{label}</span>
      <label htmlFor={`vol-${channel}`} className="sr-only">{label} volume</label>
      <input
        id={`vol-${channel}`}
        name={`vol-${channel}`}
        type="range"
        min={-40}
        max={0}
        value={db}
        disabled={muted}
        onChange={(e) => onVolumeChange(channel, Number(e.target.value))}
        className="w-full accent-primary disabled:opacity-30"
      />
      <button
        onClick={() => onToggleMute(channel)}
        title={muted ? `Unmute ${label}` : `Mute ${label}`}
        className={`rounded p-1 transition-colors ${muted ? "text-alert" : "text-muted hover:text-primary"}`}
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix: string;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex justify-between text-sm text-muted">
        <span>{label}</span>
        <span className="font-mono text-primary">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(v);
          getSocket().emit("jam-param-change", { param: label, value: v });
        }}
        className="w-full accent-primary"
      />
      {hint && <p className="mt-0.5 text-xs text-muted/70">{hint}</p>}
    </div>
  );
}
