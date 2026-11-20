export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function createWavBlobUrl(base64: string, mimeType = 'audio/wav'): string {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Synthesizes an authentic 2-stroke motorcycle exhaust intro ("ting-ting-ting-BRAAAP!")
 * using Web Audio API oscillators, waveshaping, and bandpass resonance.
 */
export function synthesizeTwoStrokeIntroSfx(ctx: BaseAudioContext, durationSec = 2.4): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // RPM curve: crisp idle blip -> high rev sweep -> drop
  let phase = 0;
  let lastSeed = 0.42;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let rpm = 1800;
    let amp = 0.25;

    if (t < 0.55) {
      // Idle "ting-ting-ting"
      rpm = 1900 + Math.sin(t * 14) * 180;
      amp = 0.22;
    } else if (t < 1.35) {
      // Aggressive throttle blip up to 10,500 RPM!
      const p = (t - 0.55) / 0.8;
      rpm = 1900 + Math.pow(p, 0.75) * 8600;
      amp = 0.42;
    } else {
      // Deceleration ring ("treng-teng-teng") fading out under voiceover
      const p = (t - 1.35) / (durationSec - 1.35);
      rpm = 10500 * Math.exp(-p * 2.1) + 1600;
      amp = 0.36 * Math.max(0, 1 - p);
    }

    // 2-stroke fires once per crankshaft revolution: f = RPM / 60
    const freq = rpm / 60;
    phase += (freq / sampleRate);
    if (phase >= 1) phase -= 1;

    // Pseudo-random metallic crackle
    lastSeed = (lastSeed * 16807) % 2147483647;
    const noise = ((lastSeed / 2147483647) * 2 - 1) * 0.25;

    // Sharp metallic expansion chamber pulse + harmonic ping
    const pulse = phase < 0.14 ? Math.sin((phase / 0.14) * Math.PI) : -0.15 * Math.exp(-(phase - 0.14) * 6);
    const chamberRing = Math.sin(phase * Math.PI * 6) * Math.exp(-phase * 5) * 0.45;
    const raw = (pulse + chamberRing + noise * 0.35) * amp;

    // Soft clip
    data[i] = Math.tanh(raw * 1.6) * 0.65;
  }

  return buffer;
}

/**
 * Decodes multiple scene base64 WAV clips into AudioBuffers using an AudioContext.
 */
export async function decodeSceneAudioBuffers(
  ctx: AudioContext,
  scenes: { id: string; audioBase64?: string }[]
): Promise<Map<string, AudioBuffer>> {
  const map = new Map<string, AudioBuffer>();
  for (const scene of scenes) {
    if (!scene.audioBase64) continue;
    try {
      const bytes = base64ToUint8Array(scene.audioBase64);
      const copy = new Uint8Array(bytes).buffer;
      const decoded = await ctx.decodeAudioData(copy);
      map.set(scene.id, decoded);
    } catch (err) {
      console.warn(`Failed to decode audio for ${scene.id}:`, err);
    }
  }
  return map;
}

/**
 * Concatenates multiple 24kHz mono 16-bit WAV clips (stripping 44-byte RIFF headers after the first)
 * into a single downloadable WAV Blob.
 */
export function mergeSceneWavsToBlob(base64Clips: string[]): Blob | null {
  const valid = base64Clips.filter(Boolean).map(base64ToUint8Array);
  if (valid.length === 0) return null;
  if (valid.length === 1) {
    return new Blob([valid[0].buffer as ArrayBuffer], { type: 'audio/wav' });
  }

  const header = new Uint8Array(valid[0].slice(0, 44));
  const pcmChunks = valid.map((clip, idx) => (idx === 0 ? clip.slice(44) : clip.slice(44)));
  const totalDataBytes = pcmChunks.reduce((acc, c) => acc + c.byteLength, 0);

  const out = new Uint8Array(44 + totalDataBytes);
  out.set(header, 0);

  let offset = 44;
  for (const chunk of pcmChunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const view = new DataView(out.buffer);
  view.setUint32(4, 36 + totalDataBytes, true); // RIFF chunk size
  view.setUint32(40, totalDataBytes, true); // data subchunk size

  return new Blob([out.buffer], { type: 'audio/wav' });
}
