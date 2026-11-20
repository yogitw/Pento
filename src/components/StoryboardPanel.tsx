import { Plus, Trash2, Upload, Volume2, Play, Shuffle } from 'lucide-react';
import { BUILTIN_VISUAL_ASSETS } from '../data/presets';
import type { CameraMotion, SceneItem, StoryboardProject, VisualMode } from '../types/studio';

interface StoryboardPanelProps {
  project: StoryboardProject;
  activeSceneIndex: number;
  onSelectSceneTime: (sceneIndex: number) => void;
  onUpdateProjectField: (field: 'title' | 'hookText' | 'bikeLabel', value: string) => void;
  onUpdateScene: (sceneId: string, patch: Partial<SceneItem>) => void;
  onAddScene: () => void;
  onRandomizeMotions: () => void;
  onRemoveScene: (sceneId: string) => void;
  onRegenerateSceneAudio: (sceneId: string) => void;
  onPreviewSceneAudio: (scene: SceneItem) => void;
  onUploadSceneMedia: (sceneId: string, file: File) => void;
}

const VISUAL_MODE_OPTIONS: { value: VisualMode; label: string }[] = [
  { value: 'photo-rxking', label: 'Foto Studio: Yamaha RX-King 135' },
  { value: 'photo-ninjarr', label: 'Foto Studio: Kawasaki Ninja 150 RR' },
  { value: 'photo-satria', label: 'Foto Studio: Underbone 2-Tak Bengkel' },
  { value: 'photo-engine', label: 'Foto Makro: Blok Silinder & Karbu' },
  { value: 'diagram-2t', label: 'Animasi Cutaway Mesin 2-Tak (Live)' },
  { value: 'tachometer-rev', label: 'Animasi Tachometer 12.000 RPM (Live)' },
  { value: 'custom-media', label: 'Foto / Video Upload Sendiri' },
];

const CAMERA_MOTION_OPTIONS: { value: CameraMotion; label: string }[] = [
  { value: 'ken-burns-drift', label: 'Putar & Zoom Sinematik' },
  { value: 'dolly-swing', label: 'Ayun 3D Handheld' },
  { value: 'zoom-in', label: 'Zoom In Sinematik' },
  { value: 'zoom-out', label: 'Zoom Out Reveal' },
  { value: 'tilt-up', label: 'Dongak Atas (Tilt Up)' },
  { value: 'tilt-down', label: 'Turun Bawah (Tilt Down)' },
  { value: 'pan-left', label: 'Geser Kiri' },
  { value: 'pan-right', label: 'Geser Kanan' },
  { value: 'pulse-rev', label: 'Getar RPM + Beat' },
];

export function StoryboardPanel({
  project,
  activeSceneIndex,
  onSelectSceneTime,
  onUpdateProjectField,
  onUpdateScene,
  onAddScene,
  onRandomizeMotions,
  onRemoveScene,
  onRegenerateSceneAudio,
  onPreviewSceneAudio,
  onUploadSceneMedia,
}: StoryboardPanelProps) {
  const totalSec = project.scenes.reduce((acc, s) => acc + s.durationSec, 0);

  return (
    <section id="storyboard-editor" className="flex flex-col gap-4">
      {/* Top Project Metadata Editor */}
      <div className="rounded-xl border border-[#262B36] bg-[#161A22] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232833] pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-100">Storyboard & Adegan</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {project.scenes.length} adegan · Total durasi{' '}
              <span className="font-mono tabular-nums text-zinc-200">{totalSec.toFixed(1)}s</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRandomizeMotions}
              className="flex items-center gap-1.5 rounded-lg border border-[#2B313E] bg-[#1D222D] px-3 py-1.5 text-xs font-medium text-orange-300 hover:border-orange-500/60 transition-colors cursor-pointer"
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>Variasikan Gerak</span>
            </button>
            <button
              type="button"
              onClick={onAddScene}
              className="flex items-center gap-1.5 rounded-lg border border-[#2B313E] bg-[#1D222D] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-orange-500/60 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Adegan</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-medium text-zinc-400">Judul Shorts</label>
            <input
              type="text"
              value={project.title}
              onChange={(e) => onUpdateProjectField('title', e.target.value)}
              className="rounded-lg border border-[#2B313E] bg-[#0E1014] px-3 py-2 text-xs font-medium text-zinc-100 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-zinc-400">Teks Hook 3 Detik Awal</label>
            <input
              type="text"
              value={project.hookText}
              onChange={(e) => onUpdateProjectField('hookText', e.target.value)}
              className="rounded-lg border border-[#2B313E] bg-[#0E1014] px-3 py-2 text-xs font-semibold text-orange-300 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Scene List */}
      <div className="flex flex-col gap-3">
        {project.scenes.map((scene, idx) => {
          const isActive = idx === activeSceneIndex;
          const builtInAsset =
            scene.visualMode !== 'diagram-2t' &&
            scene.visualMode !== 'tachometer-rev' &&
            scene.visualMode !== 'custom-media'
              ? BUILTIN_VISUAL_ASSETS[scene.visualMode]
              : null;

          return (
            <article
              key={scene.id}
              className={`rounded-xl border bg-[#161A22] p-4 transition-colors ${
                isActive ? 'border-orange-500/70' : 'border-[#262B36]'
              }`}
            >
              {/* Scene Header Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#232833]">
                <button
                  type="button"
                  onClick={() => onSelectSceneTime(idx)}
                  className="flex items-center gap-2 text-left cursor-pointer group"
                >
                  <span className="font-mono text-xs font-bold tabular-nums text-orange-400">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-100 group-hover:text-orange-300 transition-colors">
                    {scene.title}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-zinc-500">
                    · {scene.durationSec.toFixed(1)}s
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-zinc-400">
                    {scene.audioStatus === 'ready'
                      ? 'Suara Siap'
                      : scene.audioStatus === 'generating'
                        ? 'Merekam...'
                        : scene.audioStatus === 'error'
                          ? 'Suara Gagal'
                          : 'Belum Ada Suara'}
                  </span>

                  {scene.audioBase64 && (
                    <button
                      type="button"
                      onClick={() => onPreviewSceneAudio(scene)}
                      title="Putar suara adegan ini"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2B313E] bg-[#1D222D] text-zinc-200 hover:border-orange-500/60 cursor-pointer"
                    >
                      <Play className="h-3 w-3" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRegenerateSceneAudio(scene.id)}
                    disabled={scene.audioStatus === 'generating'}
                    className="flex items-center gap-1 rounded-md border border-[#2B313E] bg-[#1D222D] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:border-orange-500/60 disabled:opacity-50 cursor-pointer"
                  >
                    <Volume2 className="h-3 w-3" />
                    <span>{scene.audioBase64 ? 'Buat Ulang Suara' : 'Buat Suara'}</span>
                  </button>

                  {project.scenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveScene(scene.id)}
                      title="Hapus adegan"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2B313E] bg-[#1D222D] text-zinc-400 hover:border-red-500/60 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {scene.audioError && (
                <p className="mt-2 text-[11px] text-red-400">{scene.audioError}</p>
              )}

              {/* Body Grid */}
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[92px_1fr]">
                {/* Miniature 9:16 Visual Thumbnail */}
                <div
                  onClick={() => onSelectSceneTime(idx)}
                  className="relative aspect-[9/16] w-[92px] overflow-hidden rounded-lg border border-[#2B313E] bg-[#0E1014] cursor-pointer shrink-0"
                >
                  {builtInAsset ? (
                    <img
                      src={builtInAsset.src}
                      alt={builtInAsset.label}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : scene.visualMode === 'custom-media' && scene.customMedia ? (
                    scene.customMedia.kind === 'video' ? (
                      <video
                        src={scene.customMedia.url}
                        muted
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={scene.customMedia.url}
                        alt={scene.customMedia.name}
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center bg-gradient-to-b from-[#171C26] to-[#0E1014]">
                      <span className="font-mono text-[10px] font-bold text-orange-400">
                        {scene.visualMode === 'diagram-2t' ? '2T CUTAWAY' : '12K RPM'}
                      </span>
                      <span className="mt-1 text-[10px] leading-tight text-zinc-400">
                        {scene.visualMode === 'diagram-2t' ? 'Animasi Mesin' : 'Tachometer'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Scene Controls */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-zinc-400">
                      Naskah Voiceover (Diucapkan AI)
                    </label>
                    <textarea
                      rows={2}
                      value={scene.narration}
                      onChange={(e) => onUpdateScene(scene.id, { narration: e.target.value })}
                      className="w-full rounded-lg border border-[#2B313E] bg-[#0E1014] px-3 py-1.5 text-xs leading-relaxed text-zinc-100 focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-zinc-400">
                        Subtitle Kinetik di Layar
                      </label>
                      <input
                        type="text"
                        value={scene.caption}
                        onChange={(e) => onUpdateScene(scene.id, { caption: e.target.value })}
                        className="rounded-lg border border-[#2B313E] bg-[#0E1014] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-zinc-400">
                        Info Teknis (Callout)
                      </label>
                      <input
                        type="text"
                        value={scene.techBadge}
                        onChange={(e) => onUpdateScene(scene.id, { techBadge: e.target.value })}
                        className="rounded-lg border border-[#2B313E] bg-[#0E1014] px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_76px]">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-zinc-400">Visual Adegan</label>
                      <select
                        value={scene.visualMode}
                        onChange={(e) =>
                          onUpdateScene(scene.id, { visualMode: e.target.value as VisualMode })
                        }
                        className="rounded-lg border border-[#2B313E] bg-[#0E1014] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-orange-500 focus:outline-none"
                      >
                        {VISUAL_MODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-zinc-400">Gerak Kamera</label>
                      <select
                        value={scene.cameraMotion}
                        onChange={(e) =>
                          onUpdateScene(scene.id, { cameraMotion: e.target.value as CameraMotion })
                        }
                        className="rounded-lg border border-[#2B313E] bg-[#0E1014] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-orange-500 focus:outline-none"
                      >
                        {CAMERA_MOTION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-zinc-400">Durasi (d)</label>
                      <input
                        type="number"
                        min={2}
                        max={15}
                        step={0.5}
                        value={scene.durationSec}
                        onChange={(e) =>
                          onUpdateScene(scene.id, {
                            durationSec: Math.max(2, Math.min(15, Number(e.target.value) || 4)),
                          })
                        }
                        className="rounded-lg border border-[#2B313E] bg-[#0E1014] px-2 py-1.5 text-xs font-mono tabular-nums text-zinc-100 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Custom Foto / Video Upload per Scene */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 rounded-md border border-[#2B313E] bg-[#1D222D] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-orange-500/60 hover:text-zinc-100 cursor-pointer">
                      <Upload className="h-3 w-3" />
                      <span>
                        {scene.customMedia
                          ? `Ganti Media (${scene.customMedia.name})`
                          : 'Pakai Foto / Klip Video Sendiri'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUploadSceneMedia(scene.id, file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
