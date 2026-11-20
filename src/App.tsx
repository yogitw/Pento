import { useMemo, useRef, useState } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { PromptPanel, type MotionPresetStyle } from './components/PromptPanel';
import { ShortsPreviewPanel } from './components/ShortsPreviewPanel';
import { StoryboardPanel } from './components/StoryboardPanel';
import { BUILTIN_VISUAL_ASSETS, INITIAL_PROJECT } from './data/presets';
import type {
  CameraMotion,
  CaptionTheme,
  MotionFxMode,
  SceneItem,
  StoryboardProject,
  TransitionStyle,
  VoiceId,
} from './types/studio';
import type { UploadedBatchItem } from './utils/imageResize';
import { createWavBlobUrl } from './utils/twoStrokeAudio';

const MOTION_SEQUENCES: Record<MotionPresetStyle, CameraMotion[]> = {
  'cinematic-mix': [
    'ken-burns-drift',
    'tilt-up',
    'dolly-swing',
    'zoom-in',
    'pan-left',
    'zoom-out',
    'tilt-down',
    'pan-right',
    'pulse-rev',
    'dolly-swing',
  ],
  'dolly-handheld': ['dolly-swing', 'ken-burns-drift', 'dolly-swing', 'tilt-up'],
  'zoom-pan': ['zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'tilt-up', 'tilt-down'],
  'aggressive-rev': ['pulse-rev', 'zoom-in', 'pulse-rev', 'ken-burns-drift'],
};

function splitNarrationAcrossPhotos(rawText: string, count: number): string[] {
  if (count <= 0) return [];

  let segments = rawText
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\d+[\.\)\-:]\s*/, '').trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return Array.from(
      { length: count },
      (_, i) => `Detail tampilan motor dua tak pada foto nomor ${i + 1}.`
    );
  }

  if (segments.length < count) {
    const bySentence = segments
      .flatMap((seg) => seg.split(/(?<=[.!?])\s+/))
      .map((s) => s.trim())
      .filter(Boolean);
    if (bySentence.length > segments.length) {
      segments = bySentence;
    }
  }

  if (segments.length < count && segments.length === 1) {
    const words = segments[0].split(/\s+/).filter(Boolean);
    if (words.length >= count * 3) {
      const chunked: string[] = [];
      for (let i = 0; i < count; i++) {
        const start = Math.floor((i * words.length) / count);
        const end = Math.floor(((i + 1) * words.length) / count);
        const chunk = words.slice(start, end).join(' ').trim();
        if (chunk) chunked.push(chunk);
      }
      if (chunked.length > 0) {
        segments = chunked;
      }
    }
  }

  return Array.from({ length: count }, (_, i) => segments[i] || segments[i % segments.length]);
}

async function parseJsonSafe<T>(res: Response): Promise<T & { error?: string }> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as T & { error?: string };
  } catch {
    if (raw.trim().startsWith('<')) {
      if (res.status === 200) {
        throw new Error(
          'Endpoint suara (/api) mengembalikan halaman HTML (HTTP 200) — biasanya terjadi jika dibuka dari link static/shared preview tanpa backend aktif atau sesi login perlu di-refresh. Video animasi foto tetap bisa langsung diputar & diekspor dengan tombol "Animasikan Tanpa Suara AI (0 Detik)".'
        );
      }
      throw new Error(
        `Server suara AI sibuk atau melewati batas waktu (HTTP ${res.status}). Klik "Animasikan Tanpa Suara AI (0 Detik)" agar video langsung jadi, atau coba rekam suara lagi sebentar lagi.`
      );
    }
    throw new Error(`Respons server tidak valid (HTTP ${res.status}).`);
  }
}

export default function App() {
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>('Puck');
  const [enableEngineSfx, setEnableEngineSfx] = useState(true);
  const [captionTheme, setCaptionTheme] = useState<CaptionTheme>('viral-yellow');
  const [motionPreset, setMotionPreset] = useState<MotionPresetStyle>('cinematic-mix');
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>('slide-left');
  const [motionFx, setMotionFx] = useState<MotionFxMode>('embers-smoke');

  // Batch photo upload state (up to 10 photos)
  const [batchItems, setBatchItems] = useState<UploadedBatchItem[]>([]);
  const [batchNarrationInput, setBatchNarrationInput] = useState('');

  const [project, setProject] = useState<StoryboardProject>({
    ...INITIAL_PROJECT,
    transitionStyle: 'slide-left',
    motionFx: 'embers-smoke',
  });
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportTriggerCounter, setExportTriggerCounter] = useState(0);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const singleAudioRef = useRef<AudioContext | HTMLAudioElement | null>(null);

  const activeSceneIndex = useMemo(() => {
    let accum = 0;
    for (let i = 0; i < project.scenes.length; i++) {
      const dur = Math.max(1, project.scenes[i].durationSec);
      if (currentTimeSec < accum + dur || i === project.scenes.length - 1) {
        return i;
      }
      accum += dur;
    }
    return 0;
  }, [project.scenes, currentTimeSec]);

  const handleNavigateSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleMotionPresetChange = (preset: MotionPresetStyle) => {
    setMotionPreset(preset);
    const seq = MOTION_SEQUENCES[preset];
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, idx) => ({
        ...s,
        cameraMotion: seq[idx % seq.length],
      })),
    }));
  };

  const handleTransitionStyleChange = (style: TransitionStyle) => {
    setTransitionStyle(style);
    setProject((prev) => ({ ...prev, transitionStyle: style }));
  };

  const handleMotionFxChange = (fx: MotionFxMode) => {
    setMotionFx(fx);
    setProject((prev) => ({ ...prev, motionFx: fx }));
  };

  const handleRandomizeMotions = () => {
    const allMotions: CameraMotion[] = [
      'ken-burns-drift',
      'dolly-swing',
      'zoom-in',
      'zoom-out',
      'tilt-up',
      'tilt-down',
      'pan-left',
      'pan-right',
      'pulse-rev',
    ];
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s, idx) => {
        const pick = allMotions[(idx * 3 + Math.floor(Math.random() * allMotions.length)) % allMotions.length];
        return { ...s, cameraMotion: pick };
      }),
    }));
    setStatusMessage('Variasi gerak tiap foto berhasil diacak agar animasi lebih dinamis.');
  };

  const generateAudioForScenes = async (scenesToProcess: SceneItem[], voice: VoiceId) => {
    if (scenesToProcess.length === 0) return;
    setIsGeneratingAudio(true);
    setErrorMessage(null);

    const idsToProcess = new Set(scenesToProcess.map((s) => s.id));
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) =>
        idsToProcess.has(s.id) ? { ...s, audioStatus: 'generating', audioError: undefined } : s
      ),
    }));

    try {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 28000);

      if (scenesToProcess.length === 1) {
        const scene = scenesToProcess[0];
        setStatusMessage(`Merekam suara AI untuk ${scene.title}...`);

        const res = await fetch('/api/generate-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            text: scene.narration,
            voiceName: voice,
          }),
        }).finally(() => clearTimeout(abortTimer));

        const data = await parseJsonSafe<{
          audioBase64?: string;
          mimeType?: string;
          durationSec?: number;
        }>(res);
        if (!res.ok || !data.audioBase64) {
          throw new Error(data.error || 'Gagal merekam suara adegan.');
        }

        const durSec = Number(data.durationSec) || 4.0;
        const syncedDuration = Math.max(2.5, Math.round((durSec + 0.35) * 10) / 10);
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === scene.id
              ? {
                  ...s,
                  audioBase64: data.audioBase64,
                  audioMimeType: data.mimeType || 'audio/wav',
                  durationSec: syncedDuration,
                  audioStatus: 'ready',
                  audioError: undefined,
                }
              : s
          ),
        }));
      } else {
        setStatusMessage(
          `Merekam voiceover AI untuk ${scenesToProcess.length} foto sekaligus (1 permintaan hemat kuota)...`
        );

        const res = await fetch('/api/generate-tts-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            scenes: scenesToProcess.map((s) => ({ id: s.id, text: s.narration })),
            voiceName: voice,
          }),
        }).finally(() => clearTimeout(abortTimer));

        const data = await parseJsonSafe<{
          clips?: { id: string; audioBase64: string; mimeType: string; durationSec: number }[];
        }>(res);

        if (!res.ok || !data.clips) {
          throw new Error(data.error || 'Gagal merekam voiceover batch AI.');
        }

        const clipMap = new Map(data.clips.map((c) => [c.id, c]));
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => {
            const clip = clipMap.get(s.id);
            if (!clip) return s;
            const syncedDuration = Math.max(2.2, Math.round((clip.durationSec + 0.25) * 10) / 10);
            return {
              ...s,
              audioBase64: clip.audioBase64,
              audioMimeType: clip.mimeType,
              durationSec: syncedDuration,
              audioStatus: 'ready',
              audioError: undefined,
            };
          }),
        }));
      }

      setStatusMessage(
        'Animasi foto dan suara AI selesai! Klik Putar untuk pratinjau atau Ekspor Video.'
      );
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const msg = isAbort
        ? 'Koneksi suara AI terlalu lama (timeout). Video animasi foto Anda sudah siap diputar/ekspor tanpa suara, atau coba lagi sebentar.'
        : err instanceof Error
          ? err.message
          : 'Gagal merekam voiceover AI.';
      setErrorMessage(msg);
      setStatusMessage(null);
      setProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.audioStatus === 'generating' ? { ...s, audioStatus: 'error', audioError: msg } : s
        ),
      }));
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleAddBatchFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (files.length === 0) return;

    const remainingSlots = Math.max(0, 10 - batchItems.length);
    const sliced = files.slice(0, remainingSlots);

    const created: UploadedBatchItem[] = sliced.map((file, idx) => ({
      id: `batch-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith('video/') ? 'video' : 'image',
      name: file.name,
    }));

    setBatchItems((prev) => [...prev, ...created]);
    setErrorMessage(null);
  };

  const handleLoadSamplePhotos = () => {
    const assets = Object.values(BUILTIN_VISUAL_ASSETS);
    const created: UploadedBatchItem[] = assets.map((asset, idx) => ({
      id: `sample-${Date.now()}-${idx}`,
      file: new File([], `${asset.label}.jpg`, { type: 'image/jpeg' }),
      url: asset.src,
      kind: 'image',
      name: asset.label,
    }));

    setBatchItems(created);
    if (!batchNarrationInput.trim()) {
      setBatchNarrationInput(
        [
          '1. Yamaha RX-King 135, sang raja jalanan dengan tarikan bawah paling jambak.',
          '2. Kawasaki Ninja 150 RR dengan katup Super KIPS yang meledak di atas tujuh ribu RPM.',
          '3. Bebek 2-tak underbone yang ringan, lincah, dan penuh nostalgia balap.',
          '4. Rahasia tenaga buasnya ada di blok silinder simpel, membran, dan knalpot chamber.',
        ].join('\n')
      );
    }
    setErrorMessage(null);
    setStatusMessage('4 foto contoh 2-tak dimuat. Klik Animasikan Foto untuk langsung mencobanya.');
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMoveBatchItem = (id: string, dir: -1 | 1) => {
    setBatchItems((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleClearBatchItems = () => {
    setBatchItems([]);
  };

  const assembleBatchScenes = (): SceneItem[] => {
    const narrations = splitNarrationAcrossPhotos(batchNarrationInput, batchItems.length);
    const motions = MOTION_SEQUENCES[motionPreset];

    const mappedScenes: SceneItem[] = batchItems.map((item, idx) => {
      const lineText = narrations[idx];
      const wordCount = lineText.split(/\s+/).filter(Boolean).length;
      const estimatedDur = Math.max(
        3.2,
        Math.min(8, Math.round((wordCount / 2.6 + 1.1) * 10) / 10)
      );

      return {
        id: `scene-${Date.now()}-${idx}`,
        title: `Foto ${String(idx + 1).padStart(2, '0')}`,
        durationSec: estimatedDur,
        narration: lineText,
        caption: lineText.split(/\s+/).slice(0, 9).join(' '),
        techBadge: `Foto ${idx + 1} dari ${batchItems.length}`,
        visualMode: 'custom-media',
        cameraMotion: motions[idx % motions.length],
        accentHex: '#F97316',
        audioStatus: 'idle',
        customMedia: {
          url: item.url,
          kind: item.kind,
          name: item.name,
        },
      };
    });

    setProject((prev) => ({
      ...prev,
      title: `Shorts ${batchItems.length} Foto Motor 2-Tak`,
      hookText: 'DETAIL MOTOR 2-TAK',
      bikeLabel: 'Motor 2-Tak',
      transitionStyle,
      motionFx,
      scenes: mappedScenes,
    }));
    setCurrentTimeSec(0);
    return mappedScenes;
  };

  const handleAssembleAndSpeak = async () => {
    if (batchItems.length === 0) return;
    setErrorMessage(null);
    const createdScenes = assembleBatchScenes();
    await generateAudioForScenes(createdScenes, selectedVoice);
  };

  const handleAssembleDirectOnly = () => {
    if (batchItems.length === 0) return;
    setErrorMessage(null);
    const createdScenes = assembleBatchScenes();
    setStatusMessage(
      `${createdScenes.length} foto langsung dianimasikan menjadi Shorts 9:16! Klik Putar atau Ekspor Video.`
    );
  };

  const handleGenerateVoiceOnly = async () => {
    await generateAudioForScenes(project.scenes, selectedVoice);
  };

  const handleRegenerateSceneAudio = async (sceneId: string) => {
    const target = project.scenes.find((s) => s.id === sceneId);
    if (!target) return;
    await generateAudioForScenes([target], selectedVoice);
  };

  const handlePreviewSceneAudio = (scene: SceneItem) => {
    if (!scene.audioBase64) return;
    if (singleAudioRef.current && singleAudioRef.current instanceof HTMLAudioElement) {
      singleAudioRef.current.pause();
    }
    const url = createWavBlobUrl(scene.audioBase64, scene.audioMimeType || 'audio/wav');
    const audio = new Audio(url);
    singleAudioRef.current = audio;
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(() => {});
  };

  const handleSelectSceneTime = (sceneIndex: number) => {
    let t = 0;
    for (let i = 0; i < sceneIndex && i < project.scenes.length; i++) {
      t += Math.max(1, project.scenes[i].durationSec);
    }
    setCurrentTimeSec(t + 0.05);
  };

  const handleUpdateProjectField = (field: 'title' | 'hookText' | 'bikeLabel', value: string) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdateScene = (sceneId: string, patch: Partial<SceneItem>) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
    }));
  };

  const handleAddScene = () => {
    const num = project.scenes.length + 1;
    const newScene: SceneItem = {
      id: `scene-${Date.now()}`,
      title: `${String(num).padStart(2, '0')}. Adegan Tambahan`,
      durationSec: 5,
      narration: 'Putaran atas mesin dua tak memang tidak ada obatnya, ringan tapi bertenaga.',
      caption: 'Putaran atas 2-tak selalu bikin nagih!',
      techBadge: 'Karakter Mesin 2-Tak',
      visualMode: 'photo-engine',
      cameraMotion: 'ken-burns-drift',
      accentHex: '#F97316',
      audioStatus: 'idle',
    };
    setProject((prev) => ({ ...prev, scenes: [...prev.scenes, newScene] }));
  };

  const handleRemoveScene = (sceneId: string) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.filter((s) => s.id !== sceneId),
    }));
    setCurrentTimeSec(0);
  };

  const handleUploadSceneMedia = (sceneId: string, file: File) => {
    const url = URL.createObjectURL(file);
    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    handleUpdateScene(sceneId, {
      visualMode: 'custom-media',
      customMedia: {
        url,
        kind,
        name: file.name,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0E1014] text-zinc-100">
      <HeaderBar
        onNavigateSection={handleNavigateSection}
        onTriggerExport={() => setExportTriggerCounter((c) => c + 1)}
        isExporting={isExporting}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr_320px] xl:grid-cols-[400px_1fr_340px] items-start">
          <PromptPanel
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            enableEngineSfx={enableEngineSfx}
            onToggleEngineSfx={setEnableEngineSfx}
            motionPreset={motionPreset}
            onMotionPresetChange={handleMotionPresetChange}
            transitionStyle={transitionStyle}
            onTransitionStyleChange={handleTransitionStyleChange}
            motionFx={motionFx}
            onMotionFxChange={handleMotionFxChange}
            batchItems={batchItems}
            onAddBatchFiles={handleAddBatchFiles}
            onLoadSamplePhotos={handleLoadSamplePhotos}
            onRemoveBatchItem={handleRemoveBatchItem}
            onMoveBatchItem={handleMoveBatchItem}
            onClearBatchItems={handleClearBatchItems}
            batchNarrationInput={batchNarrationInput}
            onBatchNarrationChange={setBatchNarrationInput}
            onAssembleAndSpeak={handleAssembleAndSpeak}
            onAssembleDirectOnly={handleAssembleDirectOnly}
            onGenerateVoiceOnly={handleGenerateVoiceOnly}
            isGeneratingAudio={isGeneratingAudio}
            statusMessage={statusMessage}
            errorMessage={errorMessage}
          />

          <StoryboardPanel
            project={project}
            activeSceneIndex={activeSceneIndex}
            onSelectSceneTime={handleSelectSceneTime}
            onUpdateProjectField={handleUpdateProjectField}
            onUpdateScene={handleUpdateScene}
            onAddScene={handleAddScene}
            onRandomizeMotions={handleRandomizeMotions}
            onRemoveScene={handleRemoveScene}
            onRegenerateSceneAudio={handleRegenerateSceneAudio}
            onPreviewSceneAudio={handlePreviewSceneAudio}
            onUploadSceneMedia={handleUploadSceneMedia}
          />

          <ShortsPreviewPanel
            project={project}
            currentTimeSec={currentTimeSec}
            onTimeChange={setCurrentTimeSec}
            captionTheme={captionTheme}
            onCaptionThemeChange={setCaptionTheme}
            enableEngineSfx={enableEngineSfx}
            isExporting={isExporting}
            onExportStateChange={setIsExporting}
            exportTriggerCounter={exportTriggerCounter}
          />
        </div>
      </main>
    </div>
  );
}
