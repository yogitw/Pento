import type { CaptionTheme, MotionFxMode, SceneItem, StoryboardProject } from '../types/studio';

export interface RenderContextAssets {
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
}

interface RenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  project: StoryboardProject;
  currentTimeSec: number;
  captionTheme: CaptionTheme;
  assets: RenderContextAssets;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  naturalW: number,
  naturalH: number,
  canvasW: number,
  canvasH: number,
  motion: SceneItem['cameraMotion'],
  progress: number,
  elapsedSec: number
) {
  if (!naturalW || !naturalH) return;

  const targetRatio = canvasW / canvasH;
  const mediaRatio = naturalW / naturalH;

  let baseW = canvasW;
  let baseH = canvasH;
  if (mediaRatio > targetRatio) {
    baseH = canvasH;
    baseW = canvasH * mediaRatio;
  } else {
    baseW = canvasW;
    baseH = canvasW / mediaRatio;
  }

  const eased = easeInOutCubic(progress);
  let scale = 1.08;
  let offsetX = 0;
  let offsetY = 0;
  let angleRad = 0;

  if (motion === 'zoom-in') {
    scale = 1.03 + eased * 0.2;
  } else if (motion === 'zoom-out') {
    scale = 1.24 - eased * 0.2;
  } else if (motion === 'pan-left') {
    scale = 1.16;
    offsetX = (0.5 - eased) * (canvasW * 0.11);
  } else if (motion === 'pan-right') {
    scale = 1.16;
    offsetX = (eased - 0.5) * (canvasW * 0.11);
  } else if (motion === 'tilt-up') {
    scale = 1.18;
    offsetY = (0.5 - eased) * (canvasH * 0.1);
  } else if (motion === 'tilt-down') {
    scale = 1.18;
    offsetY = (eased - 0.5) * (canvasH * 0.1);
  } else if (motion === 'ken-burns-drift') {
    scale = 1.14 + eased * 0.14;
    offsetX = (eased - 0.5) * (canvasW * 0.06);
    offsetY = (0.5 - eased) * (canvasH * 0.05);
    angleRad = (eased - 0.5) * 0.048; // ~ +/-1.4 deg cinematic drift
  } else if (motion === 'dolly-swing') {
    // Handheld gimbal floating figure-8 sway + subtle breathing zoom
    scale = 1.16 + Math.sin(elapsedSec * 1.4) * 0.035 + eased * 0.05;
    offsetX = Math.sin(elapsedSec * 1.6) * (canvasW * 0.038);
    offsetY = Math.cos(elapsedSec * 1.25) * (canvasH * 0.025);
    angleRad = Math.sin(elapsedSec * 1.1) * 0.022;
  } else if (motion === 'pulse-rev') {
    const beat = Math.pow(Math.max(0, Math.sin(elapsedSec * 6.5)), 4);
    const microVibeX = Math.sin(elapsedSec * 42) * 2.5;
    const microVibeY = Math.cos(elapsedSec * 37) * 3.0;
    scale = 1.11 + eased * 0.08 + beat * 0.045;
    offsetX = microVibeX;
    offsetY = microVibeY;
    angleRad = Math.sin(elapsedSec * 18) * 0.008;
  }

  const drawW = baseW * scale;
  const drawH = baseH * scale;

  ctx.save();
  ctx.translate(canvasW / 2 + offsetX, canvasH / 2 + offsetY);
  if (angleRad !== 0) {
    ctx.rotate(angleRad);
  }
  ctx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

function drawMotionAtmosphere(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsedSec: number,
  mode: MotionFxMode,
  accentHex: string
) {
  if (mode === 'clean') return;

  ctx.save();
  if (mode === 'embers-smoke') {
    // Soft rising 2-stroke exhaust smoke wisps along bottom third
    for (let i = 0; i < 6; i++) {
      const cycle = ((elapsedSec * (0.22 + i * 0.03) + i * 0.19) % 1);
      const x = w * (0.12 + ((i * 0.17) % 0.8)) + Math.sin(elapsedSec * 1.3 + i * 2) * (w * 0.06);
      const y = h * (0.95 - cycle * 0.45);
      const radius = w * (0.14 + cycle * 0.18);
      const alpha = Math.sin(cycle * Math.PI) * 0.12;

      const puff = ctx.createRadialGradient(x, y, 2, x, y, radius);
      puff.addColorStop(0, `rgba(203, 213, 225, ${alpha})`);
      puff.addColorStop(1, 'rgba(203, 213, 225, 0)');
      ctx.fillStyle = puff;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating warm garage embers
    for (let j = 0; j < 14; j++) {
      const cycle = ((elapsedSec * (0.28 + (j % 4) * 0.07) + j * 0.11) % 1);
      const ex = w * ((j * 0.19 + 0.07) % 0.94) + Math.sin(elapsedSec * 2.1 + j) * (w * 0.03);
      const ey = h * (0.96 - cycle * 0.65);
      const r = w * (0.003 + (j % 3) * 0.0018);
      const alpha = Math.sin(cycle * Math.PI) * 0.68;

      ctx.fillStyle = j % 3 === 0 ? `rgba(251, 146, 60, ${alpha})` : `rgba(253, 224, 71, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mode === 'speed-flare') {
    // Sweeping warm anamorphic automotive lens flare across upper-mid frame
    const sweep = (Math.sin(elapsedSec * 0.85) + 1) * 0.5;
    const fx = w * (0.15 + sweep * 0.7);
    const fy = h * (0.22 + Math.cos(elapsedSec * 0.65) * 0.05);
    const flare = ctx.createRadialGradient(fx, fy, 4, fx, fy, w * 0.52);
    flare.addColorStop(0, 'rgba(255, 237, 213, 0.24)');
    flare.addColorStop(0.35, 'rgba(249, 115, 22, 0.12)');
    flare.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal anamorphic streak
    const streakGrad = ctx.createLinearGradient(0, fy, w, fy);
    streakGrad.addColorStop(0, 'rgba(249, 115, 22, 0)');
    streakGrad.addColorStop(0.5, 'rgba(253, 186, 116, 0.22)');
    streakGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = streakGrad;
    ctx.fillRect(0, fy - h * 0.004, w, h * 0.008);

    // Edge speed streaks
    ctx.strokeStyle = accentHex === '#EF4444' ? 'rgba(248, 113, 113, 0.16)' : 'rgba(251, 146, 60, 0.14)';
    ctx.lineWidth = 2;
    for (let s = 0; s < 10; s++) {
      const ang = (s / 10) * Math.PI * 2 + Math.floor(elapsedSec * 12) * 0.35;
      const r1 = w * 0.44;
      const r2 = w * (0.58 + (s % 2) * 0.1);
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(ang) * r1, h / 2 + Math.sin(ang) * r1 * 1.4);
      ctx.lineTo(w / 2 + Math.cos(ang) * r2, h / 2 + Math.sin(ang) * r2 * 1.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Animated 2-Stroke Engine Cutaway Diagram rendered procedurally on Canvas 2D.
 * Shows crankshaft, connecting rod, reciprocating piston, intake reed valve,
 * transfer port, spark flash at TDC, expansion chamber exhaust, and 2T blue smoke.
 */
function drawTwoStrokeCutaway(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsedSec: number,
  accentHex: string
) {
  // Deep workshop blueprint backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#0D1017');
  bgGrad.addColorStop(0.5, '#131822');
  bgGrad.addColorStop(1, '#090B0F');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle technical grid
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  const gridStep = w * 0.06;
  for (let gx = 0; gx < w; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 0; gy < h; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  const cx = w * 0.5;
  const crankY = h * 0.57;
  const crankRadius = w * 0.095;
  const conrodLen = w * 0.23;
  const boreW = w * 0.25;
  const cylTop = crankY - conrodLen - crankRadius - w * 0.14;
  const cylBottom = crankY - conrodLen + crankRadius + w * 0.04;

  // Cycle angle (2-stroke fires once per revolution!)
  const theta = elapsedSec * 5.2; // rad/s
  const normAngle = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // Crankpin position (0 = TDC)
  const pinX = cx + Math.sin(theta) * crankRadius;
  const pinY = crankY - Math.cos(theta) * crankRadius;

  // Piston wrist pin Y (exact slider-crank)
  const dx = pinX - cx;
  const dy = Math.sqrt(Math.max(1, conrodLen * conrodLen - dx * dx));
  const pistonPinY = pinY - dy;
  const pistonH = w * 0.135;
  const pistonTop = pistonPinY - pistonH * 0.52;

  // Exhaust expansion chamber (right side)
  ctx.save();
  ctx.fillStyle = '#181E29';
  ctx.strokeStyle = '#3A4354';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + boreW / 2, cylTop + w * 0.16);
  ctx.quadraticCurveTo(cx + boreW * 1.1, cylTop + w * 0.15, cx + boreW * 1.45, cylTop + w * 0.22);
  ctx.lineTo(cx + boreW * 1.45, cylTop + w * 0.34);
  ctx.quadraticCurveTo(cx + boreW * 1.05, cylTop + w * 0.27, cx + boreW / 2, cylTop + w * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Intake + Reed Valve (left side into crankcase)
  const intakeY = crankY - crankRadius * 0.65;
  ctx.save();
  ctx.fillStyle = '#171C26';
  ctx.strokeStyle = '#3A4354';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(cx - boreW * 1.45, intakeY - w * 0.045, boreW * 0.9, w * 0.09);
  ctx.fill();
  ctx.stroke();

  // Reed valve petals opening during upstroke (compression/primary intake)
  const reedOpen = Math.max(0, Math.sin(normAngle)) * (w * 0.025);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - boreW * 0.72, intakeY - w * 0.03);
  ctx.lineTo(cx - boreW * 0.56, intakeY - reedOpen);
  ctx.moveTo(cx - boreW * 0.72, intakeY + w * 0.03);
  ctx.lineTo(cx - boreW * 0.56, intakeY + reedOpen);
  ctx.stroke();
  ctx.restore();

  // Crankcase housing
  ctx.save();
  ctx.fillStyle = '#151A24';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, crankY, crankRadius * 1.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cylinder walls + cooling fins
  ctx.fillStyle = '#121620';
  ctx.fillRect(cx - boreW / 2, cylTop, boreW, cylBottom - cylTop);

  // Cooling fins left & right
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  for (let fy = cylTop + w * 0.02; fy < cylTop + w * 0.26; fy += w * 0.032) {
    ctx.beginPath();
    ctx.moveTo(cx - boreW / 2 - w * 0.05, fy);
    ctx.lineTo(cx - boreW / 2, fy);
    ctx.moveTo(cx + boreW / 2, fy);
    ctx.lineTo(cx + boreW / 2 + w * 0.05, fy);
    ctx.stroke();
  }

  // Cylinder bore outline
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 4;
  ctx.strokeRect(cx - boreW / 2, cylTop, boreW, cylBottom - cylTop);
  ctx.restore();

  // Combustion chamber glow (peaks right after TDC: normAngle 0..1.4 rad)
  const isCombustion = normAngle < 1.35 || normAngle > Math.PI * 2 - 0.25;
  const combIntensity =
    normAngle < 1.35
      ? Math.max(0, 1 - normAngle / 1.35)
      : Math.max(0, (normAngle - (Math.PI * 2 - 0.25)) / 0.25);

  if (combIntensity > 0.02) {
    const flameGrad = ctx.createRadialGradient(
      cx,
      cylTop + w * 0.04,
      4,
      cx,
      cylTop + w * 0.06,
      boreW * 0.75
    );
    flameGrad.addColorStop(0, `rgba(255, 245, 190, ${combIntensity * 0.95})`);
    flameGrad.addColorStop(0.45, `rgba(249, 115, 22, ${combIntensity * 0.75})`);
    flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = flameGrad;
    ctx.fillRect(cx - boreW / 2 + 2, cylTop + 2, boreW - 4, Math.max(10, pistonTop - cylTop));
  }

  // Fuel-air mist swirling in transfer port during BDC scavenge (normAngle ~2.1..4.2)
  const isScavenge = normAngle > 2.0 && normAngle < 4.3;
  if (isScavenge) {
    const scavAlpha = Math.sin(((normAngle - 2.0) / 2.3) * Math.PI);
    ctx.save();
    ctx.strokeStyle = `rgba(56, 189, 248, ${scavAlpha * 0.85})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -elapsedSec * 90;
    ctx.beginPath();
    ctx.moveTo(cx - boreW * 0.35, crankY);
    ctx.quadraticCurveTo(cx - boreW * 0.62, cylBottom, cx - boreW * 0.15, pistonTop - w * 0.04);
    ctx.stroke();

    // Exhaust smoke pulses shooting out expansion chamber
    for (let s = 0; s < 5; s++) {
      const sx = cx + boreW * 0.6 + s * (w * 0.06) + ((elapsedSec * 80) % 24);
      const sy = cylTop + w * 0.22 + Math.sin(elapsedSec * 6 + s) * 8;
      ctx.fillStyle = `rgba(148, 163, 184, ${scavAlpha * (0.45 - s * 0.07)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, w * (0.018 + s * 0.004), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Spark Plug at cylinder head
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(cx - w * 0.015, cylTop - w * 0.065, w * 0.03, w * 0.065);
  ctx.fillStyle = isCombustion && combIntensity > 0.7 ? '#FEF08A' : '#94A3B8';
  ctx.beginPath();
  ctx.arc(cx, cylTop + 4, w * 0.012, 0, Math.PI * 2);
  ctx.fill();

  // Connecting Rod
  ctx.save();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = w * 0.024;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pinX, pinY);
  ctx.lineTo(cx, pistonPinY);
  ctx.stroke();
  ctx.restore();

  // Crankshaft counterweight
  ctx.save();
  ctx.translate(cx, crankY);
  ctx.rotate(theta);
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, crankRadius * 1.15, 0.3, Math.PI - 0.3);
  ctx.lineTo(0, -crankRadius * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Crankpin & Center journal
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.arc(pinX, pinY, w * 0.016, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.arc(cx, crankY, w * 0.02, 0, Math.PI * 2);
  ctx.fill();

  // Piston body + rings
  ctx.save();
  const pistonGrad = ctx.createLinearGradient(cx - boreW / 2, pistonTop, cx + boreW / 2, pistonTop);
  pistonGrad.addColorStop(0, '#64748B');
  pistonGrad.addColorStop(0.5, '#E2E8F0');
  pistonGrad.addColorStop(1, '#475569');
  ctx.fillStyle = pistonGrad;
  drawRoundedRect(ctx, cx - boreW / 2 + 4, pistonTop, boreW - 8, pistonH, 8);
  ctx.fill();

  // Piston rings
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - boreW / 2 + 4, pistonTop + pistonH * 0.18);
  ctx.lineTo(cx + boreW / 2 - 4, pistonTop + pistonH * 0.18);
  ctx.moveTo(cx - boreW / 2 + 4, pistonTop + pistonH * 0.3);
  ctx.lineTo(cx + boreW / 2 - 4, pistonTop + pistonH * 0.3);
  ctx.stroke();

  // Wrist pin
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, pistonPinY, w * 0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Phase Readout Label above cylinder
  const phaseLabel =
    normAngle < 1.5
      ? 'LANGKAH 1 · PEMBAKARAN & EKSPANSI'
      : normAngle < 4.1
        ? 'LANGKAH 2 · BUANG & BILAS TRANSFER'
        : 'KOMPRESI + HISAP MEMBRAN';

  ctx.save();
  ctx.font = `700 ${Math.round(w * 0.028)}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = normAngle < 1.5 ? '#F97316' : normAngle < 4.1 ? '#38BDF8' : '#E2E8F0';
  ctx.fillText(phaseLabel, cx, cylTop - w * 0.11);
  ctx.restore();
}

/**
 * Animated 12,000 RPM 2-Stroke Racing Tachometer rendered procedurally on Canvas 2D.
 */
function drawTachometerGauge(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
  elapsedSec: number,
  accentHex: string
) {
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.44, w * 0.05, w * 0.5, h * 0.44, w * 0.75);
  bg.addColorStop(0, '#1B202C');
  bg.addColorStop(1, '#090B0F');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.44;
  const radius = w * 0.34;

  // Sweep RPM from 2,200 up to 11,400 RPM with realistic gear shift dip
  let rpm = 2200;
  if (progress < 0.45) {
    rpm = 2200 + (progress / 0.45) * 8400;
  } else if (progress < 0.55) {
    // Gear upshift drop
    rpm = 10600 - ((progress - 0.45) / 0.1) * 2800;
  } else {
    rpm = 7800 + ((progress - 0.55) / 0.45) * 3800;
  }
  rpm += Math.sin(elapsedSec * 28) * 110;

  const startAng = Math.PI * 0.75;
  const endAng = Math.PI * 2.25;
  const maxRpm = 12000;

  // Outer metallic bezel
  ctx.save();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0D1017';
  ctx.beginPath();
  ctx.arc(cx, cy, radius - w * 0.01, 0, Math.PI * 2);
  ctx.fill();

  // Redline arc (9,000 - 12,000 RPM)
  const redStart = startAng + (9000 / maxRpm) * (endAng - startAng);
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = w * 0.026;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.84, redStart, endAng);
  ctx.stroke();

  // Active RPM progress glow arc
  const rpmAng = startAng + Math.min(1, rpm / maxRpm) * (endAng - startAng);
  ctx.strokeStyle = rpm > 9000 ? '#EF4444' : accentHex;
  ctx.lineWidth = w * 0.016;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.76, startAng, rpmAng);
  ctx.stroke();

  // Tick marks 0..12
  for (let i = 0; i <= 12; i++) {
    const ang = startAng + (i / 12) * (endAng - startAng);
    const isRed = i >= 9;
    const inner = radius * 0.79;
    const outer = radius * 0.89;
    ctx.strokeStyle = isRed ? '#EF4444' : '#CBD5E1';
    ctx.lineWidth = i % 2 === 0 ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
    ctx.stroke();

    ctx.font = `700 ${Math.round(w * 0.032)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = isRed ? '#FCA5A5' : '#E2E8F0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lx = cx + Math.cos(ang) * (radius * 0.64);
    const ly = cy + Math.sin(ang) * (radius * 0.64);
    ctx.fillText(String(i), lx, ly);
  }

  // Needle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rpmAng);
  ctx.fillStyle = '#F97316';
  ctx.beginPath();
  ctx.moveTo(-w * 0.04, -w * 0.008);
  ctx.lineTo(radius * 0.78, 0);
  ctx.lineTo(-w * 0.04, w * 0.008);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Center cap
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.036, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Digital RPM + Power Valve Indicator
  ctx.font = `700 ${Math.round(w * 0.056)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = rpm > 9000 ? '#F87171' : '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(rpm).toLocaleString('id-ID')}`, cx, cy + radius * 0.42);

  ctx.font = `600 ${Math.round(w * 0.022)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('RPM · x1000', cx, cy + radius * 0.56);

  // Power Valve active indicator above dial
  const valveOpen = rpm >= 7000;
  ctx.font = `700 ${Math.round(w * 0.026)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = valveOpen ? '#22C55E' : '#64748B';
  ctx.fillText(
    valveOpen ? 'POWER VALVE TERBUKA · PEAK TORQUE' : 'KATUP TERTUTUP · TORSI BAWAH',
    cx,
    cy - radius - w * 0.05
  );

  ctx.restore();
}

function drawSceneBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: SceneItem,
  sceneProgress: number,
  currentTimeSec: number,
  assets: RenderContextAssets
) {
  if (scene.visualMode === 'diagram-2t') {
    drawTwoStrokeCutaway(ctx, width, height, currentTimeSec, scene.accentHex || '#F97316');
  } else if (scene.visualMode === 'tachometer-rev') {
    drawTachometerGauge(ctx, width, height, sceneProgress, currentTimeSec, scene.accentHex || '#F97316');
  } else if (scene.visualMode === 'custom-media' && scene.customMedia) {
    if (scene.customMedia.kind === 'video') {
      const vid = assets.videos.get(scene.customMedia.url);
      if (vid && vid.readyState >= 2) {
        drawCoverImage(
          ctx,
          vid,
          vid.videoWidth,
          vid.videoHeight,
          width,
          height,
          scene.cameraMotion,
          sceneProgress,
          currentTimeSec
        );
      } else {
        ctx.fillStyle = '#0F131A';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      const img = assets.images.get(scene.customMedia.url);
      if (img && img.complete && img.naturalWidth > 0) {
        drawCoverImage(
          ctx,
          img,
          img.naturalWidth,
          img.naturalHeight,
          width,
          height,
          scene.cameraMotion,
          sceneProgress,
          currentTimeSec
        );
      } else {
        ctx.fillStyle = '#0F131A';
        ctx.fillRect(0, 0, width, height);
      }
    }
  } else {
    const img = assets.images.get(scene.visualMode);
    if (img && img.complete && img.naturalWidth > 0) {
      drawCoverImage(
        ctx,
        img,
        img.naturalWidth,
        img.naturalHeight,
        width,
        height,
        scene.cameraMotion,
        sceneProgress,
        currentTimeSec
      );
    } else {
      ctx.fillStyle = '#0F131A';
      ctx.fillRect(0, 0, width, height);
    }
  }
}

export function renderShortsFrame({
  ctx,
  width,
  height,
  project,
  currentTimeSec,
  captionTheme,
  assets,
}: RenderParams) {
  ctx.clearRect(0, 0, width, height);

  // Locate active scene
  const scenes = project.scenes;
  if (!scenes.length) return;

  let accum = 0;
  let activeIndex = 0;
  let sceneElapsed = 0;
  for (let i = 0; i < scenes.length; i++) {
    const dur = Math.max(1, scenes[i].durationSec);
    if (currentTimeSec < accum + dur || i === scenes.length - 1) {
      activeIndex = i;
      sceneElapsed = Math.max(0, currentTimeSec - accum);
      break;
    }
    accum += dur;
  }

  const scene = scenes[activeIndex];
  const sceneDur = Math.max(1, scene.durationSec);
  const sceneProgress = Math.min(1, sceneElapsed / sceneDur);
  const transitionStyle = project.transitionStyle || 'slide-left';
  const motionFx = project.motionFx || 'embers-smoke';

  // 1. Background Visual Layer with dynamic transitions between scenes
  const transitionSec = 0.38;
  if (activeIndex > 0 && sceneElapsed < transitionSec) {
    const prevScene = scenes[activeIndex - 1];
    const tNorm = Math.min(1, sceneElapsed / transitionSec);
    const tEase = easeOutCubic(tNorm);

    if (transitionStyle === 'slide-left') {
      ctx.save();
      ctx.translate(-width * tEase, 0);
      drawSceneBackground(ctx, width, height, prevScene, 1, currentTimeSec, assets);
      ctx.restore();

      ctx.save();
      ctx.translate(width * (1 - tEase), 0);
      drawSceneBackground(ctx, width, height, scene, sceneProgress, currentTimeSec, assets);
      ctx.restore();
    } else if (transitionStyle === 'zoom-punch') {
      ctx.save();
      const outScale = 1 + tEase * 0.16;
      ctx.translate(width / 2, height / 2);
      ctx.scale(outScale, outScale);
      ctx.translate(-width / 2, -height / 2);
      drawSceneBackground(ctx, width, height, prevScene, 1, currentTimeSec, assets);
      ctx.restore();

      ctx.save();
      const inScale = 1.2 - tEase * 0.2;
      ctx.globalAlpha = tEase;
      ctx.translate(width / 2, height / 2);
      ctx.scale(inScale, inScale);
      ctx.translate(-width / 2, -height / 2);
      drawSceneBackground(ctx, width, height, scene, sceneProgress, currentTimeSec, assets);
      ctx.restore();
    } else if (transitionStyle === 'flash-beat') {
      if (tNorm < 0.35) {
        drawSceneBackground(ctx, width, height, prevScene, 1, currentTimeSec, assets);
      } else {
        drawSceneBackground(ctx, width, height, scene, sceneProgress, currentTimeSec, assets);
      }
      const flashAlpha = tNorm < 0.35 ? (tNorm / 0.35) * 0.85 : (1 - (tNorm - 0.35) / 0.65) * 0.85;
      if (flashAlpha > 0.01) {
        ctx.fillStyle = `rgba(255, 247, 237, ${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      drawSceneBackground(ctx, width, height, prevScene, 1, currentTimeSec, assets);
      ctx.save();
      ctx.globalAlpha = tNorm;
      drawSceneBackground(ctx, width, height, scene, sceneProgress, currentTimeSec, assets);
      ctx.restore();
    }
  } else {
    drawSceneBackground(ctx, width, height, scene, sceneProgress, currentTimeSec, assets);
  }

  // Atmospheric Motion Overlay (smoke/embers or flare/speed streaks)
  if (scene.visualMode !== 'diagram-2t' && scene.visualMode !== 'tachometer-rev') {
    drawMotionAtmosphere(ctx, width, height, currentTimeSec, motionFx, scene.accentHex || '#F97316');
  }

  // 2. Measured Contrast Scrims (top & lower-third readability)
  const topScrim = ctx.createLinearGradient(0, 0, 0, height * 0.25);
  topScrim.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
  topScrim.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, width, height * 0.25);

  const bottomScrim = ctx.createLinearGradient(0, height * 0.56, 0, height);
  bottomScrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  bottomScrim.addColorStop(0.55, 'rgba(0, 0, 0, 0.76)');
  bottomScrim.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
  ctx.fillStyle = bottomScrim;
  ctx.fillRect(0, height * 0.56, width, height * 0.44);

  // 3. Top Shorts Progress Bars (1 per scene)
  const padX = width * 0.055;
  const barGap = width * 0.014;
  const totalBarW = width - padX * 2 - barGap * (scenes.length - 1);
  const singleBarW = totalBarW / scenes.length;
  const barY = height * 0.028;
  const barH = Math.max(3, height * 0.0035);

  for (let i = 0; i < scenes.length; i++) {
    const bx = padX + i * (singleBarW + barGap);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    drawRoundedRect(ctx, bx, barY, singleBarW, barH, barH / 2);
    ctx.fill();

    let fillFrac = 0;
    if (i < activeIndex) fillFrac = 1;
    else if (i === activeIndex) fillFrac = sceneProgress;

    if (fillFrac > 0) {
      ctx.fillStyle = scene.accentHex || '#F97316';
      drawRoundedRect(ctx, bx, barY, singleBarW * fillFrac, barH, barH / 2);
      ctx.fill();
    }
  }

  // 4. Top Bike Header + Hook Banner (in first 3.5 seconds or compact label after)
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = `700 ${Math.round(width * 0.036)}px "Outfit", sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(project.bikeLabel || 'Otomotif 2-Tak', padX, height * 0.068);

  if (project.specs && project.specs.length > 0) {
    const specLine = project.specs.map((s) => `${s.value}`).join('  ·  ');
    ctx.font = `500 ${Math.round(width * 0.024)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(specLine, padX, height * 0.095);
  }
  ctx.restore();

  // Hook punch banner during Scene 0
  if (activeIndex === 0 && project.hookText) {
    const hookAlpha = Math.min(1, sceneElapsed * 3);
    ctx.save();
    ctx.globalAlpha = hookAlpha;
    ctx.font = `800 ${Math.round(width * 0.056)}px "Outfit", sans-serif`;
    const hookText = project.hookText.toUpperCase();
    const tw = ctx.measureText(hookText).width;
    const boxW = Math.min(width - padX * 2, tw + width * 0.08);
    const boxH = height * 0.056;
    const boxX = (width - boxW) / 2;
    const boxY = height * 0.135;

    ctx.fillStyle = scene.accentHex || '#F97316';
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 10);
    ctx.fill();

    ctx.fillStyle = '#090B0F';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hookText, width / 2, boxY + boxH / 2 + 2, boxW - 20);
    ctx.restore();
  }

  // 5. Technical Callout Line above captions
  if (scene.techBadge) {
    ctx.save();
    const badgeY = height * 0.675;
    ctx.font = `600 ${Math.round(width * 0.026)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    const badgeW = Math.min(width - padX * 2, ctx.measureText(scene.techBadge).width + width * 0.07);
    const badgeH = height * 0.036;
    drawRoundedRect(ctx, (width - badgeW) / 2, badgeY - badgeH / 2, badgeW, badgeH, 8);
    ctx.fill();

    ctx.strokeStyle = scene.accentHex || '#F97316';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.textBaseline = 'middle';
    ctx.fillText(scene.techBadge, width / 2, badgeY + 1, badgeW - 24);
    ctx.restore();
  }

  // 6. Kinetic Word-by-Word Highlighted YouTube Shorts Captions (Safe Zone: 73%-86% height)
  const captionText = scene.caption || scene.narration;
  if (captionText) {
    ctx.save();
    const fontSize = Math.round(width * 0.056);
    ctx.font = `800 ${fontSize}px "Outfit", sans-serif`;
    const maxLineW = width - padX * 2.2;
    const lines = wrapLines(ctx, captionText, maxLineW);
    const wordsAll = captionText.trim().split(/\s+/);
    const activeWordIdx = Math.min(
      wordsAll.length - 1,
      Math.floor(sceneProgress * wordsAll.length)
    );

    const lineHeight = fontSize * 1.24;
    const startY = height * 0.745;

    let wordCursor = 0;
    for (let li = 0; li < lines.length; li++) {
      const lineWords = lines[li].split(/\s+/);
      const totalLineW = ctx.measureText(lines[li]).width;
      let cursorX = (width - totalLineW) / 2;
      const ly = startY + li * lineHeight;

      for (let wi = 0; wi < lineWords.length; wi++) {
        const wText = lineWords[wi];
        const isCurrent = wordCursor === activeWordIdx;
        const isSpoken = wordCursor < activeWordIdx;

        const wWidth = ctx.measureText(wText + (wi < lineWords.length - 1 ? ' ' : '')).width;

        // Crisp dark outline for high contrast over any video frame
        ctx.lineWidth = Math.max(5, fontSize * 0.16);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.lineJoin = 'round';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.strokeText(wText, cursorX, ly);

        if (captionTheme === 'viral-yellow') {
          ctx.fillStyle = isCurrent ? '#FACC15' : isSpoken ? '#FFFFFF' : '#CBD5E1';
        } else if (captionTheme === 'racing-red') {
          ctx.fillStyle = isCurrent ? '#FB7185' : isSpoken ? '#FFFFFF' : '#E2E8F0';
        } else {
          ctx.fillStyle = isCurrent ? '#38BDF8' : '#FFFFFF';
        }

        ctx.fillText(wText, cursorX, ly);
        cursorX += wWidth;
        wordCursor++;
      }
    }
    ctx.restore();
  }
}
