import { useState } from 'react';
import {
  Volume2,
  Flame,
  Upload,
  X,
  ArrowLeft,
  ArrowRight,
  Zap,
  Images,
  Sparkles,
} from 'lucide-react';
import { VOICE_OPTIONS } from '../data/presets';
import type { MotionFxMode, TransitionStyle, VoiceId } from '../types/studio';
import type { UploadedBatchItem } from '../utils/imageResize';

export type MotionPresetStyle = 'cinematic-mix' | 'dolly-handheld' | 'zoom-pan' | 'aggressive-rev';

interface PromptPanelProps {
  selectedVoice: VoiceId;
  onVoiceChange: (val: VoiceId) => void;
  enableEngineSfx: boolean;
  onToggleEngineSfx: (val: boolean) => void;
  motionPreset: MotionPresetStyle;
  onMotionPresetChange: (val: MotionPresetStyle) => void;
  transitionStyle: TransitionStyle;
  onTransitionStyleChange: (val: TransitionStyle) => void;
  motionFx: MotionFxMode;
  onMotionFxChange: (val: MotionFxMode) => void;
  batchItems: UploadedBatchItem[];
  onAddBatchFiles: (files: FileList | File[]) => void;
  onLoadSamplePhotos: () => void;
  onRemoveBatchItem: (id: string) => void;
  onMoveBatchItem: (id: string, dir: -1 | 1) => void;
  onClearBatchItems: () => void;
  batchNarrationInput: string;
  onBatchNarrationChange: (val: string) => void;
  onAssembleAndSpeak: () => void;
  onAssembleDirectOnly: () => void;
  onGenerateVoiceOnly: () => void;
  isGeneratingAudio: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
}

export function PromptPanel({
  selectedVoice,
  onVoiceChange,
  enableEngineSfx,
  onToggleEngineSfx,
  motionPreset,
  onMotionPresetChange,
  transitionStyle,
  onTransitionStyleChange,
  motionFx,
  onMotionFxChange,
  batchItems,
  onAddBatchFiles,
  onLoadSamplePhotos,
  onRemoveBatchItem,
  onMoveBatchItem,
  onClearBatchItems,
  batchNarrationInput,
  onBatchNarrationChange,
  onAssembleAndSpeak,
  onAssembleDirectOnly,
  onGenerateVoiceOnly,
  isGeneratingAudio,
  statusMessage,
  errorMessage,
}: PromptPanelProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <section
      id="photo-studio"
      className="flex flex-col gap-5 rounded-xl border border-[#262B36] bg-[#161A22] p-5"
    >
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-zinc-100">
          Foto ke Video 2-Tak
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          Unggah hingga 10 foto motor dan tulis teks adegannya. Foto otomatis bergerak dinamis
          (ayun 3D, tilt, zoom, transisi, &amp; efek asap) menjadi Shorts 9:16.
        </p>
      </div>

      {/* Multi-Image Dropzone (10 Photos) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-300">
            Foto / Klip ({batchItems.length} / 10 Foto)
          </span>
          {batchItems.length > 0 ? (
            <button
              type="button"
              onClick={onClearBatchItems}
              className="text-[11px] font-medium text-zinc-400 hover:text-red-400 cursor-pointer"
            >
              Hapus Semua
            </button>
          ) : (
            <button
              type="button"
              onClick={onLoadSamplePhotos}
              className="flex items-center gap-1 text-[11px] font-medium text-orange-400 hover:text-orange-300 cursor-pointer"
            >
              <Images className="h-3 w-3" />
              <span>Muat 4 Foto Contoh</span>
            </button>
          )}
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.length) {
              onAddBatchFiles(e.dataTransfer.files);
            }
          }}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-4 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-orange-400 bg-orange-500/10'
              : 'border-[#333A48] bg-[#0E1014] hover:border-orange-500/60'
          }`}
        >
          <Upload className="h-5 w-5 text-orange-400" />
          <span className="text-xs font-medium text-zinc-200">
            Pilih atau tarik hingga 10 foto motor sekaligus
          </span>
          <span className="text-[11px] text-zinc-500">
            JPG, PNG, WEBP, atau MP4 · Urutan slot 01 sampai 10
          </span>
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                onAddBatchFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </label>

        {/* 5x2 Grid for 10 Photo Slots */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {Array.from({ length: 10 }).map((_, idx) => {
            const item = batchItems[idx];
            if (!item) {
              return (
                <div
                  key={`empty-slot-${idx}`}
                  className="flex aspect-[9/12] flex-col items-center justify-center rounded-md border border-dashed border-[#262B36] bg-[#0E1014]/60 text-zinc-600"
                >
                  <span className="font-mono text-[10px] font-semibold">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={item.id}
                className="group relative aspect-[9/12] overflow-hidden rounded-md border border-[#2B313E] bg-[#0E1014]"
              >
                {item.kind === 'video' ? (
                  <video src={item.url} muted className="h-full w-full object-cover" />
                ) : (
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-black/75 px-1 py-0.5">
                  <span className="font-mono text-[10px] font-bold text-orange-300">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveBatchItem(item.id)}
                    className="text-zinc-300 hover:text-red-400 cursor-pointer"
                    title="Hapus foto ini"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/80 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveBatchItem(item.id, -1)}
                    className="text-zinc-200 disabled:opacity-30 cursor-pointer"
                    title="Geser kiri"
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === batchItems.length - 1}
                    onClick={() => onMoveBatchItem(item.id, 1)}
                    className="text-zinc-200 disabled:opacity-30 cursor-pointer"
                    title="Geser kanan"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Narration Text for Uploaded Photos */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="batch-narration" className="text-xs font-medium text-zinc-300">
          Teks Narasi / Adegan (1 Baris = 1 Foto)
        </label>
        <textarea
          id="batch-narration"
          rows={5}
          value={batchNarrationInput}
          onChange={(e) => onBatchNarrationChange(e.target.value)}
          placeholder={
            'Tulis 1 baris per foto atau paragraf yang akan dibagi otomatis.\nContoh:\n1. Ini Kawasaki Ninja 150 RR restorasi full ori.\n2. Blok silinder masih standar kode 1855.\n3. Karburator sudah upgrade PWK 28.\n4. Knalpot kolong stainless suara garing treng-teng-teng!'
          }
          className="w-full rounded-lg border border-[#2B313E] bg-[#0E1014] px-3.5 py-2.5 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {/* Photo Motion, Transition & Atmosphere FX Controls */}
      <div className="flex flex-col gap-3 border-t border-[#232833] pt-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
          <Sparkles className="h-3.5 w-3.5 text-orange-400" />
          <span>Animasi Gerak &amp; Efek Foto</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="motion-preset" className="text-[11px] font-medium text-zinc-400">
              Gaya Gerak Foto
            </label>
            <select
              id="motion-preset"
              value={motionPreset}
              onChange={(e) => onMotionPresetChange(e.target.value as MotionPresetStyle)}
              className="w-full rounded-lg border border-[#2B313E] bg-[#0E1014] px-2.5 py-2 text-xs text-zinc-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="cinematic-mix">Variasi Sinematik Lengkap</option>
              <option value="dolly-handheld">Ayun 3D Handheld (Gimbal)</option>
              <option value="zoom-pan">Zoom, Tilt &amp; Geser Halus</option>
              <option value="aggressive-rev">Beat Zoom + Getar RPM</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="transition-style" className="text-[11px] font-medium text-zinc-400">
              Transisi Antar Foto
            </label>
            <select
              id="transition-style"
              value={transitionStyle}
              onChange={(e) => onTransitionStyleChange(e.target.value as TransitionStyle)}
              className="w-full rounded-lg border border-[#2B313E] bg-[#0E1014] px-2.5 py-2 text-xs text-zinc-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="slide-left">Geser Cepat (Whip Slide)</option>
              <option value="zoom-punch">Zoom Punch (Beat Cut)</option>
              <option value="flash-beat">Kilat Flash Kamera</option>
              <option value="crossfade">Crossfade Halus</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-400">Efek Atmosfer Bergerak</span>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#2B313E] bg-[#0E1014] p-1">
            {(
              [
                { id: 'embers-smoke', label: 'Asap 2T & Bara' },
                { id: 'speed-flare', label: 'Kilau & Speed' },
                { id: 'clean', label: 'Bersih' },
              ] as const
            ).map((fx) => (
              <button
                key={fx.id}
                type="button"
                onClick={() => onMotionFxChange(fx.id)}
                className={`rounded-md py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  motionFx === fx.id
                    ? 'bg-orange-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {fx.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Narrator Voice & 2T Exhaust Intro SFX */}
      <div className="flex flex-col gap-3 border-t border-[#232833] pt-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="voice-select"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-300"
          >
            <Volume2 className="h-3.5 w-3.5 text-zinc-400" />
            <span>Suara Narator AI (Bahasa Indonesia)</span>
          </label>
          <select
            id="voice-select"
            value={selectedVoice}
            onChange={(e) => onVoiceChange(e.target.value as VoiceId)}
            className="w-full rounded-lg border border-[#2B313E] bg-[#0E1014] px-3 py-2 text-xs text-zinc-100 focus:border-orange-500 focus:outline-none"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} — {v.tone}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-[#262B36] bg-[#0E1014] px-3 py-2.5 cursor-pointer">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-zinc-200">Efek Suara Knalpot 2-Tak Intro</p>
              <p className="text-[11px] text-zinc-500">Suara garing treng-teng-teng di awal video</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={enableEngineSfx}
            onChange={(e) => onToggleEngineSfx(e.target.checked)}
            className="h-4 w-4 accent-orange-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Status & Error feedback */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200"
        >
          {errorMessage}
        </div>
      )}

      {statusMessage && !errorMessage && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-950/25 px-3.5 py-2.5 text-xs text-orange-200">
          {statusMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={onAssembleAndSpeak}
          disabled={isGeneratingAudio || batchItems.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-orange-400 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Zap className="h-4 w-4" />
          <span>
            {isGeneratingAudio
              ? 'Merekam Voiceover AI...'
              : `Animasikan ${batchItems.length || ''} Foto & Buat Suara`}
          </span>
        </button>

        <button
          type="button"
          onClick={onAssembleDirectOnly}
          disabled={isGeneratingAudio || batchItems.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-500/40 bg-[#1D222D] px-4 py-2 text-xs font-medium text-orange-200 hover:border-orange-400 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <span>Animasikan Tanpa Suara AI (0 Detik)</span>
        </button>

        <button
          type="button"
          onClick={onGenerateVoiceOnly}
          disabled={isGeneratingAudio}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2B313E] bg-[#1D222D] px-4 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Volume2 className="h-3.5 w-3.5" />
          <span>Buat Suara untuk Storyboard Saat Ini</span>
        </button>
      </div>
    </section>
  );
}
