import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Download, Copy, Check, Film } from 'lucide-react';
import { BUILTIN_VISUAL_ASSETS } from '../data/presets';
import type { CaptionTheme, StoryboardProject } from '../types/studio';
import { renderShortsFrame, type RenderContextAssets } from '../utils/canvasRenderer';
import {
  decodeSceneAudioBuffers,
  mergeSceneWavsToBlob,
  synthesizeTwoStrokeIntroSfx,
} from '../utils/twoStrokeAudio';

interface ShortsPreviewPanelProps {
  project: StoryboardProject;
  currentTimeSec: number;
  onTimeChange: (t: number) => void;
  captionTheme: CaptionTheme;
  onCaptionThemeChange: (theme: CaptionTheme) => void;
  enableEngineSfx: boolean;
  isExporting: boolean;
  onExportStateChange: (val: boolean) => void;
  exportTriggerCounter: number;
}

export function ShortsPreviewPanel({
  project,
  currentTimeSec,
  onTimeChange,
  captionTheme,
  onCaptionThemeChange,
  enableEngineSfx,
  isExporting,
  onExportStateChange,
  exportTriggerCounter,
}: ShortsPreviewPanelProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetsRef = useRef<RenderContextAssets>({
    images: new Map(),
    videos: new Map(),
  });
  const [assetsTick, setAssetsTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedFileExt, setExportedFileExt] = useState<'webm' | 'mp4'>('webm');
  const [exportError, setExportError] = useState<string | null>(null);
  const [copiedMeta, setCopiedMeta] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeAudioNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const rafRef = useRef<number | null>(null);
  const playStartWallRef = useRef<number>(0);
  const playStartTimelineRef = useRef<number>(0);

  const totalDuration = Math.max(
    1,
    project.scenes.reduce((acc, s) => acc + Math.max(1, s.durationSec), 0)
  );

  // Preload built-in 2T images + any custom scene images/videos
  useEffect(() => {
    const assets = assetsRef.current;

    Object.entries(BUILTIN_VISUAL_ASSETS).forEach(([key, item]) => {
      if (!assets.images.has(key)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setAssetsTick((t) => t + 1);
        img.src = item.src;
        assets.images.set(key, img);
      }
    });

    project.scenes.forEach((scene) => {
      if (scene.customMedia) {
        const { url, kind } = scene.customMedia;
        if (kind === 'image' && !assets.images.has(url)) {
          const img = new Image();
          img.onload = () => setAssetsTick((t) => t + 1);
          img.src = url;
          assets.images.set(url, img);
        } else if (kind === 'video' && !assets.videos.has(url)) {
          const vid = document.createElement('video');
          vid.src = url;
          vid.muted = true;
          vid.loop = true;
          vid.playsInline = true;
          vid.onloadeddata = () => setAssetsTick((t) => t + 1);
          assets.videos.set(url, vid);
        }
      }
    });
  }, [project.scenes]);

  // Draw current frame whenever time, project, theme, or loaded assets change
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderShortsFrame({
      ctx,
      width: canvas.width,
      height: canvas.height,
      project,
      currentTimeSec,
      captionTheme,
      assets: assetsRef.current,
    });
  }, [project, currentTimeSec, captionTheme, assetsTick]);

  const stopAllAudio = () => {
    activeAudioNodesRef.current.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // ignore already stopped
      }
    });
    activeAudioNodesRef.current = [];
    assetsRef.current.videos.forEach((v) => {
      try {
        v.pause();
      } catch {
        // ignore
      }
    });
  };

  const scheduleTimelineAudio = async (
    ctx: AudioContext,
    destination: AudioNode,
    startOffsetSec: number
  ) => {
    const decodedMap = await decodeSceneAudioBuffers(ctx, project.scenes);
    const now = ctx.currentTime + 0.04;

    if (enableEngineSfx && startOffsetSec < 2.2) {
      const sfxBuffer = synthesizeTwoStrokeIntroSfx(ctx, 2.4);
      const sfxSource = ctx.createBufferSource();
      sfxSource.buffer = sfxBuffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.42;
      sfxSource.connect(gain);
      gain.connect(destination);
      sfxSource.start(now, startOffsetSec);
      activeAudioNodesRef.current.push(sfxSource);
    }

    let accum = 0;
    for (const scene of project.scenes) {
      const dur = Math.max(1, scene.durationSec);
      const sceneStart = accum;
      const sceneEnd = accum + dur;
      const buf = decodedMap.get(scene.id);

      if (buf && sceneEnd > startOffsetSec) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        src.connect(gain);
        gain.connect(destination);

        if (startOffsetSec <= sceneStart) {
          src.start(now + (sceneStart - startOffsetSec));
        } else {
          const offsetWithinClip = startOffsetSec - sceneStart;
          if (offsetWithinClip < buf.duration) {
            src.start(now, offsetWithinClip);
          }
        }
        activeAudioNodesRef.current.push(src);
      }
      accum += dur;
    }
  };

  const stopPlayback = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopAllAudio();
    setIsPlaying(false);
  };

  const togglePlay = async () => {
    if (isExporting) return;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    const startFrom = currentTimeSec >= totalDuration - 0.08 ? 0 : currentTimeSec;
    if (startFrom === 0) onTimeChange(0);

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    await scheduleTimelineAudio(audioCtxRef.current, audioCtxRef.current.destination, startFrom);

    // Start any custom videos
    assetsRef.current.videos.forEach((v) => {
      v.play().catch(() => {});
    });

    playStartWallRef.current = performance.now();
    playStartTimelineRef.current = startFrom;
    setIsPlaying(true);

    const tick = (nowMs: number) => {
      const elapsed = (nowMs - playStartWallRef.current) / 1000;
      const nextT = playStartTimelineRef.current + elapsed;
      if (nextT >= totalDuration) {
        onTimeChange(totalDuration);
        stopPlayback();
        return;
      }
      onTimeChange(nextT);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stopAllAudio();
    };
  }, []);

  // Real-time 1080x1920 Video Export using Canvas.captureStream + AudioContext + MediaRecorder
  const handleExportVideo = async () => {
    if (isExporting) return;
    stopPlayback();
    setExportError(null);
    setExportProgress(0);
    onExportStateChange(true);

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 1080;
      exportCanvas.height = 1920;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) throw new Error('Browser tidak mendukung Canvas 2D untuk ekspor video.');

      const exportAudioCtx = new AudioContext();
      if (exportAudioCtx.state === 'suspended') {
        await exportAudioCtx.resume();
      }
      const streamDest = exportAudioCtx.createMediaStreamDestination();

      // Determine best supported MIME type
      const candidates = [
        { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' as const },
        { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' as const },
        { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' as const },
        { mime: 'video/webm', ext: 'webm' as const },
      ];
      const chosen = candidates.find((c) => MediaRecorder.isTypeSupported(c.mime));
      if (!chosen) {
        throw new Error('Browser ini tidak mendukung MediaRecorder untuk merekam video.');
      }

      const canvasStream = exportCanvas.captureStream(30);
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...streamDest.stream.getAudioTracks(),
      ];
      const combinedStream = new MediaStream(combinedTracks);

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: chosen.mime,
        videoBitsPerSecond: 6_000_000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: chosen.mime }));
        };
      });

      // Play custom videos silently for frame capture
      assetsRef.current.videos.forEach((v) => {
        v.currentTime = 0;
        v.play().catch(() => {});
      });

      await scheduleTimelineAudio(exportAudioCtx, streamDest, 0);
      recorder.start(250);

      const startWall = performance.now();
      await new Promise<void>((resolve) => {
        const renderStep = (nowMs: number) => {
          const t = (nowMs - startWall) / 1000;
          renderShortsFrame({
            ctx: exportCtx,
            width: exportCanvas.width,
            height: exportCanvas.height,
            project,
            currentTimeSec: Math.min(t, totalDuration),
            captionTheme,
            assets: assetsRef.current,
          });
          onTimeChange(Math.min(t, totalDuration));
          setExportProgress(Math.min(100, Math.round((t / totalDuration) * 100)));

          if (t >= totalDuration) {
            resolve();
            return;
          }
          requestAnimationFrame(renderStep);
        };
        requestAnimationFrame(renderStep);
      });

      recorder.stop();
      stopAllAudio();
      const videoBlob = await recordingDone;
      await exportAudioCtx.close();

      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
      const url = URL.createObjectURL(videoBlob);
      setExportedVideoUrl(url);
      setExportedFileExt(chosen.ext);

      // Auto-trigger download
      const a = document.createElement('a');
      a.href = url;
      const slug = (project.bikeLabel || 'motor-2tak').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `shorts-${slug}.${chosen.ext}`;
      a.click();
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Gagal mengekspor video.');
    } finally {
      onExportStateChange(false);
    }
  };

  // Trigger export from top bar CTA
  const lastExportTriggerRef = useRef(0);
  useEffect(() => {
    if (exportTriggerCounter > lastExportTriggerRef.current) {
      lastExportTriggerRef.current = exportTriggerCounter;
      handleExportVideo();
    }
  }, [exportTriggerCounter]);

  const handleDownloadWav = () => {
    const clips = project.scenes.map((s) => s.audioBase64 || '').filter(Boolean);
    const wavBlob = mergeSceneWavsToBlob(clips);
    if (!wavBlob) return;
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voiceover-2tak.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleCopyMeta = async () => {
    const text = `${project.title}\n\n${project.description}\n\n${project.tags.join(' ')}`;
    await navigator.clipboard.writeText(text);
    setCopiedMeta(true);
    setTimeout(() => setCopiedMeta(false), 2000);
  };

  const hasAnyVoice = project.scenes.some((s) => Boolean(s.audioBase64));

  return (
    <aside id="preview-export" className="flex flex-col gap-4 lg:sticky lg:top-20">
      <div className="rounded-xl border border-[#262B36] bg-[#161A22] p-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#232833]">
          <h2 className="font-display text-sm font-bold text-zinc-100">Pratinjau Shorts 9:16</h2>
          <span className="font-mono text-xs tabular-nums text-zinc-400">
            {currentTimeSec.toFixed(1)}s / {totalDuration.toFixed(1)}s
          </span>
        </div>

        {/* 9:16 Vertical Canvas Frame */}
        <div className="mt-3 mx-auto w-full max-w-[280px] overflow-hidden rounded-xl border border-[#2B313E] bg-black">
          <canvas
            ref={previewCanvasRef}
            width={540}
            height={960}
            className="block w-full aspect-[9/16]"
          />
        </div>

        {/* Scrubber & Playback Controls */}
        <div className="mt-3 flex flex-col gap-2.5">
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.05}
            value={Math.min(currentTimeSec, totalDuration)}
            disabled={isExporting}
            onChange={(e) => {
              if (isPlaying) stopPlayback();
              onTimeChange(Number(e.target.value));
            }}
            className="w-full accent-orange-500 cursor-pointer"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                disabled={isExporting}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-50 cursor-pointer"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isPlaying ? 'Jeda' : 'Putar'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  onTimeChange(0);
                }}
                disabled={isExporting}
                title="Ulang dari awal"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2B313E] bg-[#1D222D] text-zinc-300 hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            <span className="font-mono text-[11px] text-zinc-400">1080×1920 HD</span>
          </div>
        </div>

        {/* Caption Theme Switcher */}
        <div className="mt-4 border-t border-[#232833] pt-3">
          <span className="text-[11px] font-medium text-zinc-400">Gaya Subtitle</span>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg border border-[#2B313E] bg-[#0E1014] p-1">
            {(
              [
                { id: 'viral-yellow', label: 'Kuning Viral' },
                { id: 'clean-white', label: 'Putih Bersih' },
                { id: 'racing-red', label: 'Merah Balap' },
              ] as const
            ).map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => onCaptionThemeChange(theme.id)}
                className={`rounded-md py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  captionTheme === theme.id
                    ? 'bg-[#232936] text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export Actions */}
        <div className="mt-4 flex flex-col gap-2 border-t border-[#232833] pt-3">
          <button
            type="button"
            onClick={handleExportVideo}
            disabled={isExporting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-orange-400 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Film className="h-4 w-4" />
            <span>
              {isExporting
                ? `Merender Video (${exportProgress}%)...`
                : 'Ekspor Video 9:16 (HD + Audio)'}
            </span>
          </button>

          {exportedVideoUrl && !isExporting && (
            <a
              href={exportedVideoUrl}
              download={`shorts-${(project.bikeLabel || '2tak').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${exportedFileExt}`}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-950/50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Ulang Video (.{exportedFileExt.toUpperCase()})</span>
            </a>
          )}

          {hasAnyVoice && (
            <button
              type="button"
              onClick={handleDownloadWav}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2B313E] bg-[#1D222D] px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Audio Voiceover (.WAV)</span>
            </button>
          )}

          {exportError && (
            <p className="text-[11px] text-red-400">{exportError}</p>
          )}
        </div>
      </div>

      {/* Ready-to-upload YouTube Shorts Metadata */}
      <div className="rounded-xl border border-[#262B36] bg-[#161A22] p-4">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#232833]">
          <h3 className="font-display text-xs font-bold text-zinc-200">Siap Upload YouTube Shorts</h3>
          <button
            type="button"
            onClick={handleCopyMeta}
            className="flex items-center gap-1 text-[11px] font-medium text-orange-400 hover:text-orange-300 cursor-pointer"
          >
            {copiedMeta ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copiedMeta ? 'Tersalin' : 'Salin Semua'}</span>
          </button>
        </div>
        <p className="mt-2.5 text-xs font-semibold text-zinc-100">{project.title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{project.description}</p>
        <p className="mt-2 font-mono text-[11px] text-zinc-400">{project.tags.join(' ')}</p>
      </div>
    </aside>
  );
}
