import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { Request, Response } from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(apiVersion?: string, timeoutMs = 18000): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi pada environment server.');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getWavDurationSeconds(base64Wav: string): number {
  try {
    const buf = Buffer.from(base64Wav, 'base64');
    if (buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF') {
      const byteRate = buf.readUInt32LE(28) || 48000;
      let dataSize = buf.length - 44;
      const dataIdx = buf.indexOf('data');
      if (dataIdx !== -1 && dataIdx + 8 <= buf.length) {
        const chunkSize = buf.readUInt32LE(dataIdx + 4);
        if (chunkSize > 0 && chunkSize <= buf.length - (dataIdx + 8)) {
          dataSize = chunkSize;
        }
      }
      const sec = dataSize / byteRate;
      return Math.max(1.8, Math.round(sec * 10) / 10);
    }
  } catch {
    // Fallback below
  }
  return 4.5;
}

function parseErrorInfo(err: unknown): { code: number; rawMessage: string } {
  const rawMessage = err instanceof Error ? err.message : String(err || 'Unknown error');
  let code = 500;

  if (typeof err === 'object' && err !== null && 'status' in err) {
    const st = Number((err as { status?: unknown }).status);
    if (!Number.isNaN(st) && st >= 400) code = st;
  }

  // Try extracting nested JSON error code from SDK error message
  try {
    const match = rawMessage.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { error?: { code?: number; message?: string } };
      if (parsed?.error?.code) code = Number(parsed.error.code);
      if (parsed?.error?.message) return { code, rawMessage: parsed.error.message };
    }
  } catch {
    // Ignore JSON parse fallback
  }

  if (rawMessage.includes('503') || rawMessage.includes('UNAVAILABLE')) code = 503;
  else if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) code = 429;
  else if (rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED')) code = 403;
  else if (rawMessage.includes('400') || rawMessage.includes('API_KEY_INVALID')) code = 400;

  return { code, rawMessage };
}

function isTransientError(code: number, rawMessage: string): boolean {
  return (
    code === 503 ||
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 504 ||
    /high demand|unavailable|overloaded|timeout|timed out|abort|econnreset/i.test(rawMessage)
  );
}

function formatFriendlyError(err: unknown): { statusCode: number; message: string } {
  const { code, rawMessage } = parseErrorInfo(err);
  if (/timeout|timed out|abort/i.test(rawMessage)) {
    return {
      statusCode: 504,
      message:
        'Server suara AI sedang lambat merespons (timeout). Foto animasi Anda sudah siap diputar/ekspor tanpa suara, atau coba buat suara lagi beberapa saat lagi.',
    };
  }
  if (code === 503 || /high demand|unavailable/i.test(rawMessage)) {
    return {
      statusCode: 503,
      message:
        'Server model AI sedang mengalami lonjakan trafik sementara (503). Silakan klik ulang beberapa detik lagi, atau gunakan tombol "Animasikan Tanpa Suara AI (0 Detik)".',
    };
  }
  if (code === 429) {
    return {
      statusCode: 429,
      message: 'Batas permintaan AI sementara tercapai (429). Tunggu sebentar lalu coba lagi.',
    };
  }
  if (code === 403 || /api_key_invalid|api key not valid/i.test(rawMessage)) {
    return {
      statusCode: code,
      message: `Permintaan ditolak oleh Gemini API (${code}). Periksa GEMINI_API_KEY pada Settings > Secrets.`,
    };
  }
  if (code === 400) {
    return { statusCode: 400, message: `Gemini API 400: ${rawMessage}` };
  }
  return { statusCode: 500, message: rawMessage };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) saat menghubungi ${label}`)), ms);
    }),
  ]);
}

async function callWithRetryAndFallback<T>(
  models: string[],
  executor: (model: string) => Promise<T>,
  maxAttemptsPerModel = 2
): Promise<T> {
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < maxAttemptsPerModel; attempt++) {
      try {
        return await executor(model);
      } catch (err) {
        lastError = err;
        const { code, rawMessage } = parseErrorInfo(err);
        if (!isTransientError(code, rawMessage)) {
          throw err;
        }
        // On 429 or timeout, immediately switch to the next fallback model
        if (code === 429 || /timeout|timed out|abort/i.test(rawMessage)) {
          console.warn(`Rate limit/timeout (${code}) on "${model}". Switching to fallback model...`);
          await new Promise((r) => setTimeout(r, 400));
          break;
        }
        const delayMs = attempt === 0 ? 900 : 1500;
        console.warn(
          `Transient error (${code}) on model "${model}", attempt ${attempt + 1}. Waiting ${delayMs}ms...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

function createWavBufferFromPcm(
  pcmData: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);
  return Buffer.concat([header, pcmData]);
}

function sliceWavByScenes(
  base64Wav: string,
  scenes: { id: string; text: string }[]
): { id: string; audioBase64: string; mimeType: string; durationSec: number }[] {
  if (scenes.length <= 1) {
    return [
      {
        id: scenes[0]?.id || 'scene-0',
        audioBase64: base64Wav,
        mimeType: 'audio/wav',
        durationSec: getWavDurationSeconds(base64Wav),
      },
    ];
  }

  const buf = Buffer.from(base64Wav, 'base64');
  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let pcmStart = 44;
  let pcmLength = Math.max(0, buf.length - 44);

  if (buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF') {
    numChannels = buf.readUInt16LE(22) || 1;
    sampleRate = buf.readUInt32LE(24) || 24000;
    bitsPerSample = buf.readUInt16LE(34) || 16;
    const dataIdx = buf.indexOf('data');
    if (dataIdx !== -1 && dataIdx + 8 <= buf.length) {
      pcmStart = dataIdx + 8;
      const declaredSize = buf.readUInt32LE(dataIdx + 4);
      pcmLength =
        declaredSize > 0 && declaredSize <= buf.length - pcmStart
          ? declaredSize
          : buf.length - pcmStart;
    }
  }

  const bytesPerSample = numChannels * (bitsPerSample / 8);
  const totalSamples = Math.floor(pcmLength / bytesPerSample);
  const pcmBuf = buf.subarray(pcmStart, pcmStart + totalSamples * bytesPerSample);

  // Word-count proportional weights (slight extra weight for sentence punctuation)
  const weights = scenes.map((s) => {
    const words = s.text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(2, words + 1.2);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const splitSamples: number[] = [0];
  let cumWeight = 0;
  const minSliceSamples = Math.min(
    Math.floor(sampleRate * 0.65),
    Math.max(1, Math.floor(totalSamples / (scenes.length + 1)))
  );
  const searchRadius = Math.floor(sampleRate * 0.55);
  const frameSamples = Math.floor(sampleRate * 0.025); // 25ms window

  for (let i = 0; i < scenes.length - 1; i++) {
    cumWeight += weights[i];
    const ideal = Math.floor((cumWeight / totalWeight) * totalSamples);
    const prevSplit = splitSamples[splitSamples.length - 1];
    const remainingScenes = scenes.length - 1 - i;

    const upperCap = Math.max(prevSplit, totalSamples - remainingScenes * minSliceSamples);
    const minBound = Math.max(0, Math.min(upperCap, prevSplit + minSliceSamples));
    const maxBound = Math.min(totalSamples, Math.max(minBound, upperCap));

    const winStart = Math.max(minBound, ideal - searchRadius);
    const winEnd = Math.min(maxBound, ideal + searchRadius);

    let bestPos = Math.max(minBound, Math.min(maxBound, ideal));
    let lowestEnergy = Number.POSITIVE_INFINITY;

    if (bitsPerSample === 16 && winEnd > winStart + frameSamples) {
      for (let pos = winStart; pos <= winEnd - frameSamples; pos += Math.max(1, Math.floor(frameSamples / 2))) {
        let energy = 0;
        for (let k = 0; k < frameSamples; k++) {
          const byteOffset = (pos + k) * bytesPerSample;
          if (byteOffset + 1 < pcmBuf.length) {
            energy += Math.abs(pcmBuf.readInt16LE(byteOffset));
          }
        }
        if (energy < lowestEnergy) {
          lowestEnergy = energy;
          bestPos = pos + Math.floor(frameSamples / 2);
        }
      }
    }

    splitSamples.push(bestPos);
  }
  splitSamples.push(totalSamples);

  const fadeSamples = Math.min(Math.floor(sampleRate * 0.008), 200);

  return scenes.map((scene, idx) => {
    const sStart = splitSamples[idx];
    const sEnd = splitSamples[idx + 1];
    const slicePcm = Buffer.from(
      pcmBuf.subarray(sStart * bytesPerSample, sEnd * bytesPerSample)
    );

    // Smooth 8ms fade-in/out on slice boundaries to avoid clicks
    if (bitsPerSample === 16) {
      const sliceCount = Math.floor(slicePcm.length / bytesPerSample);
      for (let f = 0; f < Math.min(fadeSamples, Math.floor(sliceCount / 2)); f++) {
        const gain = f / fadeSamples;
        const headOff = f * bytesPerSample;
        const tailOff = (sliceCount - 1 - f) * bytesPerSample;
        slicePcm.writeInt16LE(Math.round(slicePcm.readInt16LE(headOff) * gain), headOff);
        slicePcm.writeInt16LE(Math.round(slicePcm.readInt16LE(tailOff) * gain), tailOff);
      }
    }

    const wav = createWavBufferFromPcm(slicePcm, sampleRate, numChannels, bitsPerSample);
    const durationSec = Math.max(1.8, Math.round(((sEnd - sStart) / sampleRate) * 10) / 10);
    return {
      id: scene.id,
      audioBase64: wav.toString('base64'),
      mimeType: 'audio/wav',
      durationSec,
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Generate 2-Stroke YouTube Shorts storyboard & Indonesian script
  app.post('/api/generate-storyboard', async (req: Request, res: Response) => {
    try {
      const { prompt, styleMode, durationTarget, referenceUrl } = req.body as {
        prompt?: string;
        styleMode?: string;
        durationTarget?: number;
        referenceUrl?: string;
      };

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 4) {
        res.status(400).json({ error: 'Masukkan topik atau prompt video motor 2-tak terlebih dahulu.' });
        return;
      }

      const ai = getAiClient();
      const targetSec = Number(durationTarget) || 25;
      const sceneCount = targetSec <= 18 ? 3 : targetSec <= 28 ? 4 : targetSec <= 38 ? 5 : 10;

      const systemInstruction = `Kamu adalah sutradara dan penulis naskah YouTube Shorts otomotif spesialis motor 2-tak di Indonesia.
Tugasmu mengubah prompt user menjadi paket produksi video Shorts vertikal 9:16 yang padat, informatif, teknis namun asyik didengar (gaya kreator otomotif viral di YouTube Shorts).
Aturan ketat:
1. Bahasa Indonesia yang natural, lugas, dan bertenaga khas konten otomotif motor 2-tak (hindari kata klise kaku).
2. Scene pertama WAJIB menjadi hook kuat (0-3 detik pertama) yang bikin penonton berhenti scroll.
3. Gunakan istilah mekanis 2-tak yang akurat sesuai topik: misalnya YCLS, Super KIPS, YPVS, RC Valve, Reed Valve/Membran, Karburator PWK/PE, Knalpot Chamber/Kolong, Oli Samping, Transfer Port, RPM Redline, Kompresi Primer.
4. Pilih visualMode paling cocok untuk setiap adegan dari daftar EXACT berikut:
   - "photo-rxking" (cocok untuk Yamaha RX-King, motor naked 2-tak klasik, jambret, 135cc)
   - "photo-ninjarr" (cocok untuk Kawasaki Ninja 150 R/RR, KRR, sport fairing 2-tak, Super KIPS)
   - "photo-satria" (cocok untuk bebek 2-tak underbone seperti Satria 120R, F1ZR, 125Z, Tiara)
   - "photo-engine" (cocok untuk pembahasan blok silinder, karburator, porting, knalpot chamber, oli samping)
   - "diagram-2t" (WAJIB dipakai minimal 1x jika membahas cara kerja mesin, kompresi, membran, katup KIPS/YPVS, atau pembakaran 2 langkah)
   - "tachometer-rev" (cocok untuk pembahasan RPM tinggi, tenaga puncak, akselerasi, suara melengking)
5. Buat TEPAT ${sceneCount} adegan berurutan. Setiap adegan berdurasi ${sceneCount === 10 ? '3.5 hingga 5.5' : '4 hingga 8'} detik agar total mendekati ${targetSec} detik.
6. "caption" harus singkat maksimal 6-9 kata per adegan agar terbaca jelas di layar HP 9:16.
7. "narration" harus kalimat lisan alami tanpa simbol aneh, emoji, atau tanda kurung panggung.`;

      const userContent = [
        `Prompt topik: ${prompt.trim()}`,
        `Gaya penyajian: ${styleMode || 'Edukasi Teknis & Fakta Cepat'}`,
        `Target durasi total: ${targetSec} detik (${sceneCount} adegan)`,
        referenceUrl
          ? `Referensi format video Shorts: ${referenceUrl} (adaptasi ritme cepat, hook pembuka kuat, teks penjelas singkat & spesifikasi di layar)`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await callWithRetryAndFallback(
        ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
        (model) =>
          ai.models.generateContent({
            model,
            contents: userContent,
            config: {
              systemInstruction,
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Judul video YouTube Shorts yang menarik klik' },
                  hookText: { type: Type.STRING, description: 'Teks hook singkat 2-4 kata untuk 3 detik awal' },
                  bikeLabel: { type: Type.STRING, description: 'Nama motor atau topik utama, misal Yamaha RX-King 135' },
                  specs: {
                    type: Type.ARRAY,
                    description: '3 spesifikasi kunci singkat',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        value: { type: Type.STRING },
                      },
                      required: ['label', 'value'],
                    },
                  },
                  scenes: {
                    type: Type.ARRAY,
                    description: `Daftar ${sceneCount} adegan video berurutan`,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING, description: 'Label singkat adegan, misal Hook Pembuka' },
                        durationSec: { type: Type.NUMBER, description: 'Estimasi durasi detik (4-8)' },
                        narration: { type: Type.STRING, description: 'Teks narasi voiceover Bahasa Indonesia' },
                        caption: { type: Type.STRING, description: 'Teks subtitle besar di layar (maks 9 kata)' },
                        techBadge: { type: Type.STRING, description: 'Fakta teknis 1 baris di sudut layar' },
                        visualMode: {
                          type: Type.STRING,
                          description:
                            'Salah satu dari: photo-rxking, photo-ninjarr, photo-satria, photo-engine, diagram-2t, tachometer-rev',
                        },
                        cameraMotion: {
                          type: Type.STRING,
                          description: 'Salah satu dari: zoom-in, pan-left, pan-right, pulse-rev',
                        },
                        accentHex: {
                          type: Type.STRING,
                          description:
                            'Warna aksen hex yang kontras seperti #F97316, #EF4444, #22C55E, #EAB308, #38BDF8',
                        },
                      },
                      required: [
                        'title',
                        'durationSec',
                        'narration',
                        'caption',
                        'techBadge',
                        'visualMode',
                        'cameraMotion',
                        'accentHex',
                      ],
                    },
                  },
                  tags: {
                    type: Type.ARRAY,
                    description: '5-7 hashtag relevan untuk YouTube Shorts',
                    items: { type: Type.STRING },
                  },
                  description: { type: Type.STRING, description: 'Deskripsi singkat siap unggah untuk YouTube Shorts' },
                },
                required: ['title', 'hookText', 'bikeLabel', 'specs', 'scenes', 'tags', 'description'],
              },
            },
          })
      );

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Model tidak mengembalikan storyboard. Silakan coba lagi.' });
        return;
      }

      res.json(JSON.parse(rawText));
    } catch (err: unknown) {
      console.error('Error /api/generate-storyboard:', err);
      const { statusCode, message } = formatFriendlyError(err);
      res.status(statusCode).json({ error: message });
    }
  });

  // Turn batch-uploaded user photos + narration text into an animated 9:16 storyboard
  app.post('/api/images-to-storyboard', async (req: Request, res: Response) => {
    try {
      const { images, narrationInput, keepOrder, keepExactLines, styleMode } = req.body as {
        images?: { index: number; name: string; thumbnailBase64?: string; mimeType?: string }[];
        narrationInput?: string;
        keepOrder?: boolean;
        keepExactLines?: boolean;
        styleMode?: string;
      };

      if (!Array.isArray(images) || images.length === 0) {
        res.status(400).json({ error: 'Unggah minimal 1 foto atau klip video terlebih dahulu.' });
        return;
      }

      if (images.length > 10) {
        res.status(400).json({ error: 'Maksimal 10 foto dalam satu kali proses.' });
        return;
      }

      const ai = getAiClient();
      const count = images.length;

      const systemInstruction = `Kamu adalah sutradara video YouTube Shorts otomotif motor 2-tak.
User telah mengunggah ${count} foto/klip (indeks 0 sampai ${count - 1}) dan memberikan teks narasi/topik.
Tugasmu:
1. Buat TEPAT ${count} adegan — setiap gambar (indeks 0 sampai ${count - 1}) WAJIB digunakan tepat SATU kali dalam properti "imageIndex".
2. ${
        keepOrder !== false
          ? `Pertahankan urutan gambar persis berurutan: adegan 0 pakai imageIndex 0, adegan 1 pakai imageIndex 1, dst sampai ${count - 1}.`
          : `Urutkan imageIndex dari 0..${count - 1} secara sinematik mengikuti alur narasi (hook paling menarik di awal).`
      }
3. ${
        keepExactLines
          ? 'Jika user menulis beberapa baris/kalimat narasi, BAGI dan PERTAHANKAN kata-kata narasi asli user agar sesuai di tiap adegan tanpa mengubah maksud aslinya.'
          : 'Pecah atau kembangkan teks narasi user menjadi kalimat lisan Bahasa Indonesia yang mengalir alami, padat, dan cocok dengan visual masing-masing foto yang kamu lihat.'
      }
4. Untuk setiap adegan, buat "caption" singkat (maksimal 8 kata) untuk subtitle kinetik besar di layar 9:16, "techBadge" info teknis singkat, dan pilih variasi "cameraMotion" secara bergantian ("zoom-in", "pan-left", "pan-right", "pulse-rev") agar animasi slideshow terasa dinamis dan hidup.
5. Jangan gunakan emoji atau simbol kurung panggung di dalam "narration".`;

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [
        {
          text: [
            `Jumlah gambar: ${count}`,
            `Gaya video: ${styleMode || 'Review & Edukasi Otomotif 2-Tak'}`,
            `Teks narasi / topik dari user:\n${narrationInput?.trim() || 'Bahas detail motor 2-tak pada foto-foto berikut secara menarik.'}`,
            'Berikut daftar foto berdasarkan indeksnya:',
          ].join('\n\n'),
        },
      ];

      for (const img of images) {
        parts.push({ text: `Foto #${img.index} (nama file: ${img.name})` });
        if (img.thumbnailBase64) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: img.thumbnailBase64,
            },
          });
        }
      }

      const response = await callWithRetryAndFallback(
        ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
        (model) =>
          ai.models.generateContent({
            model,
            contents: { parts },
            config: {
              systemInstruction,
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  hookText: { type: Type.STRING },
                  bikeLabel: { type: Type.STRING },
                  specs: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        value: { type: Type.STRING },
                      },
                      required: ['label', 'value'],
                    },
                  },
                  scenes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        imageIndex: { type: Type.INTEGER },
                        title: { type: Type.STRING },
                        durationSec: { type: Type.NUMBER },
                        narration: { type: Type.STRING },
                        caption: { type: Type.STRING },
                        techBadge: { type: Type.STRING },
                        cameraMotion: { type: Type.STRING },
                        accentHex: { type: Type.STRING },
                      },
                      required: [
                        'imageIndex',
                        'title',
                        'durationSec',
                        'narration',
                        'caption',
                        'techBadge',
                        'cameraMotion',
                        'accentHex',
                      ],
                    },
                  },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  description: { type: Type.STRING },
                },
                required: ['title', 'hookText', 'bikeLabel', 'specs', 'scenes', 'tags', 'description'],
              },
            },
          })
      );

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Model tidak mengembalikan storyboard gambar.' });
        return;
      }

      res.json(JSON.parse(rawText));
    } catch (err: unknown) {
      console.error('Error /api/images-to-storyboard:', err);
      const { statusCode, message } = formatFriendlyError(err);
      res.status(statusCode).json({ error: message });
    }
  });

  async function synthesizeTtsAudio(
    text: string,
    chosenVoice: string,
    _styleHint: string,
    perAttemptMs = 12000
  ): Promise<{ audioBase64: string; mimeType: string }> {
    const models = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
    let lastErr: unknown = new Error('Model TTS tidak menghasilkan audio.');

    for (const model of models) {
      try {
        const aiBeta = getAiClient('v1beta', perAttemptMs);
        const interaction = await withTimeout(
          aiBeta.interactions.create({
            model,
            input: text.trim(),
            response_format: { type: 'audio' },
            generation_config: {
              speech_config: [{ voice: chosenVoice }],
            },
          }),
          perAttemptMs,
          model
        );

        if (interaction.output_audio?.data) {
          return {
            audioBase64: interaction.output_audio.data,
            mimeType: interaction.output_audio.mime_type || 'audio/wav',
          };
        }
      } catch (err) {
        lastErr = err;
        const { code, rawMessage } = parseErrorInfo(err);
        console.warn(`TTS "${model}" failed (${code}): ${rawMessage}`);
      }
    }

    throw lastErr;
  }

  // Generate Indonesian TTS voiceover per scene using gemini-3.8-flash-lite-tts (with fallback)
  app.post('/api/generate-tts', async (req: Request, res: Response) => {
    try {
      const { text, voiceName, styleHint } = req.body as {
        text?: string;
        voiceName?: string;
        styleHint?: string;
      };

      if (!text || typeof text !== 'string' || text.trim().length < 2) {
        res.status(400).json({ error: 'Teks narasi tidak boleh kosong.' });
        return;
      }

      const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const chosenVoice = allowedVoices.includes(voiceName || '') ? voiceName! : 'Puck';

      const { audioBase64, mimeType } = await synthesizeTtsAudio(
        text.trim(),
        chosenVoice,
        styleHint ||
          'Energetic, articulate Indonesian automotive YouTube Shorts creator speaking clearly with natural pacing and punchy emphasis',
        11500
      );

      const durationSec = getWavDurationSeconds(audioBase64);
      res.json({
        audioBase64,
        mimeType,
        durationSec,
      });
    } catch (err: unknown) {
      console.error('Error /api/generate-tts:', err);
      const { statusCode, message } = formatFriendlyError(err);
      res.status(statusCode).json({ error: message });
    }
  });

  // Batch TTS: generates voiceover for ALL scenes in 1 single Gemini TTS request to avoid 429 RPM limits
  app.post('/api/generate-tts-batch', async (req: Request, res: Response) => {
    try {
      const { scenes, voiceName, styleHint } = req.body as {
        scenes?: { id: string; text: string }[];
        voiceName?: string;
        styleHint?: string;
      };

      if (!Array.isArray(scenes) || scenes.length === 0) {
        res.status(400).json({ error: 'Daftar adegan tidak boleh kosong.' });
        return;
      }

      const validScenes = scenes.filter((s) => s && s.id && typeof s.text === 'string' && s.text.trim().length > 0);
      if (validScenes.length === 0) {
        res.status(400).json({ error: 'Semua teks narasi adegan kosong.' });
        return;
      }

      const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const chosenVoice = allowedVoices.includes(voiceName || '') ? voiceName! : 'Puck';

      const combinedNarration = validScenes
        .map((s) => {
          const clean = s.text.trim();
          return /[.!?]$/.test(clean) ? clean : `${clean}.`;
        })
        .join(' ... ');

      const { audioBase64 } = await synthesizeTtsAudio(
        combinedNarration,
        chosenVoice,
        styleHint ||
          'Energetic, articulate Indonesian automotive YouTube Shorts creator speaking clearly with brief natural pauses between sentences',
        12000
      );

      const clips = sliceWavByScenes(audioBase64, validScenes);
      res.json({ clips });
    } catch (err: unknown) {
      console.error('Error /api/generate-tts-batch:', err);
      const { statusCode, message } = formatFriendlyError(err);
      res.status(statusCode).json({ error: message });
    }
  });

  // Ensure unknown /api/* routes and middleware errors always return JSON (never HTML)
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    const { statusCode, message } = formatFriendlyError(err);
    res.status(statusCode).json({ error: message });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`2T Shorts Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
