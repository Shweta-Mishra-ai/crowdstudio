import { useEffect, useState, type ReactNode } from "react";
import { Play, Square, Save, Sparkles, Music2, Drum, Waves, Volume2, VolumeX, Download, FileMusic, PlayCircle, Zap } from "lucide-react";
import { useJamEngine, SOUND_PRESETS, type MixerChannel } from "../hooks/useJamEngine";
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
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
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
  const [wavPreviewUrl, setWavPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-jam-room");
    return () => {
      socket.emit("leave-jam-room");
    };
  }, []);

  // Revoke the rendered-audio object URL when navigating away from the
  // Studio — otherwise it stays alive in memory for the rest of the tab's
  // life even though nothing can play it anymore.
  useEffect(() => {
    return () => {
      if (wavPreviewUrl) URL.revokeObjectURL(wavPreviewUrl);
    };
  }, [wavPreviewUrl]);

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

  async function handleRenderWav() {
    setWavRendering(true);
    setWavError(null);
    try {
      const blob = await renderJamToWav(params, mixer, 8);
      // Revoke the previous preview URL before creating a new one, so
      // re-rendering repeatedly doesn't leak object URLs for the life of
      // the tab.
      setWavPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setWavError(err instanceof Error ? err.message : "Could not render audio");
    } finally {
      setWavRendering(false);
    }
  }

  function handleDownloadWav() {
    if (!wavPreviewUrl) return;
    const a = document.createElement("a");
    a.href = wavPreviewUrl;
    a.download = `${title || "crowdstudio-jam"}.wav`;
    a.click();
  }

  function handleDownloadMidi() {
    const blob = buildJamMidi(params, 8);
    downloadBlob(blob, `${title || "crowdstudio-jam"}.mid`);
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
          className={`flex items-center gap-2 rounded-lg px-6 py-3 font-display text-base font-semibold text-white transition-shadow ${
            isPlaying ? "bg-accent shadow-glow-cyan" : "neon-button"
          }`}
        >
          {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          {isPlaying ? "Stop" : "Start Jam"}
        </button>
      </div>

      {/* 1-Click Instant Sound Presets */}
      <div className="glass-card mb-6 p-4 rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-muted flex items-center gap-1.5 font-semibold">
            <Zap size={14} className="text-accent" /> DAW Sound Presets
          </span>
          <span className="text-xs text-muted font-mono">1-click switch</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SOUND_PRESETS).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => {
                setParams(preset);
                setSelectedPreset(name);
              }}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                selectedPreset === name
                  ? "bg-accent text-bg shadow-glow-cyan font-bold scale-105"
                  : "border border-white/15 bg-white/5 text-muted hover:border-accent/40 hover:text-white"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card mb-6 p-3 rounded-2xl overflow-hidden">
        <AudioVisualizer getAnalyser={getAnalyser} active={isPlaying} />
      </div>

      {/* Real mixing dashboard */}
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
        <div className="glass-card p-6 rounded-2xl">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">Groove Engine</h2>
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
              className="w-full rounded-xl border border-white/15 bg-bg/80 px-3.5 py-2.5 text-sm transition-colors focus:border-accent focus:outline-none"
              value={params.scale}
              onChange={(e) => setParams({ scale: e.target.value as typeof params.scale })}
            >
              <option value="pentatonic">Pentatonic</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">Filter &amp; Space</h2>
          <Slider
            label="Filter cutoff"
            value={params.filterCutoff}
            min={200}
            max={8000}
            onChange={(v) => setParams({ filterCutoff: v })}
            suffix=" Hz"
          />
          <Slider
            label="Reverb Space"
            value={Math.round(params.reverbWet * 100)}
            min={0}
            max={100}
            onChange={(v) => setParams({ reverbWet: v / 100 })}
            suffix="%"
          />
        </div>
      </div>

      <div className="glass-card mb-6 p-6 rounded-2xl">
        <h2 className="mb-1 font-display text-lg font-bold text-white flex items-center gap-2">
          <Download size={18} className="text-accent" /> DAW Master Render &amp; Multi-Track Export
        </h2>
        <p className="mb-4 text-xs text-muted">
          Renders 8 bars of the active generative arrangement into an uncompressed 16-bit PCM WAV file — preview directly in-browser, or import WAV/MIDI files into Ableton Live, FL Studio, Logic Pro, or any DAW.
        </p>
        {wavError && <p className="mb-3 text-sm text-alert bg-alert/15 p-3 rounded-xl" role="alert">{wavError}</p>}

        <button
          onClick={handleRenderWav}
          disabled={wavRendering}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-bg shadow-glow-cyan hover:brightness-110 active:scale-98 transition-all disabled:opacity-50"
        >
          <PlayCircle size={17} />
          {wavRendering ? "Rendering Tone.js Audio…" : wavPreviewUrl ? "Re-render Audio WAV" : "Render 8-Bar Audio WAV"}
        </button>

        {wavPreviewUrl && (
          <div className="mb-4 rounded-xl bg-bg/80 border border-white/10 p-3">
            <span className="text-[11px] font-mono text-muted uppercase tracking-wider block mb-1">In-Browser Master Preview</span>
            <audio controls src={wavPreviewUrl} className="w-full" />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleDownloadWav}
            disabled={!wavPreviewUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white transition-all hover:border-accent hover:text-accent hover:bg-accent/10 disabled:opacity-40"
          >
            <Download size={15} />
            Download WAV
          </button>
          <button
            onClick={handleDownloadMidi}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white transition-all hover:border-primary hover:text-primary hover:bg-primary/10"
          >
            <FileMusic size={15} />
            Download MIDI (4 Tracks)
          </button>
        </div>
      </div>

      <div className="mb-6">
        <ChatPanel />
      </div>

      <div className="glass-card p-6 rounded-2xl">
        <h2 className="mb-1 text-lg font-bold text-white">Save Jam to Global Feed</h2>
        <p className="mb-4 text-xs text-muted">Publish your live synth arrangement to the community leaderboard for feedback and live voting.</p>
        <label htmlFor="track-title" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Track title</label>
        <input
          id="track-title"
          name="title"
          className="mb-4 w-full rounded-xl border border-white/15 bg-bg/80 px-4 py-2.5 text-sm text-white transition-colors focus:border-accent focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Midnight Cyber Synthwave"
          maxLength={100}
        />
        {saveError && <p className="mb-3 text-sm text-alert bg-alert/15 p-3 rounded-xl" role="alert">{saveError}</p>}
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary via-neon to-accent py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-98 disabled:opacity-50 shadow-glow"
        >
          <Save size={16} />
          {saveState === "saving" ? "Saving Track…" : saveState === "saved" ? "Saved to Feed ✓" : "Publish to Community Feed"}
        </button>
      </div>

      {savedTrackId && (
        <div className="glass-card mt-6 p-6 rounded-2xl">
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Sparkles size={18} className="text-neon" /> AI Cloud Model Export
          </h2>
          <p className="mb-3 text-xs text-muted">
            Renders this jam into an AI audio master track using configured cloud provider models.
          </p>
          <label htmlFor="export-prompt" className="sr-only">Describe the vibe for AI export</label>
          <input
            id="export-prompt"
            name="exportPrompt"
            className="mb-3 w-full rounded-xl border border-white/15 bg-bg/80 px-4 py-2.5 text-sm text-white transition-colors focus:border-neon focus:outline-none"
            placeholder="Describe the vibe, e.g. 'dreamy lo-fi with tape saturation and vinyl crackle'"
            maxLength={500}
            value={exportPrompt}
            onChange={(e) => setExportPrompt(e.target.value)}
          />
          {exportError && <p className="mb-3 text-sm text-alert bg-alert/15 p-3 rounded-xl" role="alert">{exportError}</p>}
          {exportState === "done" && exportUrl && (
            <audio controls src={exportUrl} className="mb-3 w-full" />
          )}
          <button
            onClick={handleExport}
            disabled={exportState === "exporting" || !exportPrompt.trim()}
            className="w-full rounded-xl bg-neon py-3 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50 shadow-glow"
          >
            {exportState === "exporting" ? "Rendering AI Track…" : "Render with AI"}
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
    <div className="glass-card flex flex-col items-center gap-3 p-4 rounded-2xl transition-all hover:border-accent/40">
      <span className={isAudible ? "text-accent" : "text-muted"}>{icon}</span>
      <VUMeter active={isAudible} bars={5} />
      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-paper">{label}</span>
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
        className="w-full accent-accent disabled:opacity-30"
      />
      <div className="flex items-center justify-between w-full text-[10px] font-mono text-muted px-1">
        <span>-40dB</span>
        <span className={isAudible ? "text-accent font-semibold" : "text-muted"}>{db}dB</span>
        <span>0dB</span>
      </div>
      <button
        onClick={() => onToggleMute(channel)}
        title={muted ? `Unmute ${label}` : `Mute ${label}`}
        className={`flex items-center gap-1.5 w-full justify-center rounded-xl py-1.5 text-xs font-bold transition-all ${
          muted
            ? "bg-alert/20 text-alert border border-alert/40 shadow-sm"
            : "bg-white/5 text-muted border border-white/10 hover:text-accent hover:border-accent"
        }`}
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        <span>{muted ? "MUTED" : "MUTE"}</span>
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
      <div className="mb-1.5 flex justify-between text-sm text-muted">
        <span className="font-semibold text-paper/90">{label}</span>
        <span className="font-mono font-bold text-accent">
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
        className="w-full accent-accent"
      />
      {hint && <p className="mt-1 text-xs text-muted/70 font-mono">{hint}</p>}
    </div>
  );
}
