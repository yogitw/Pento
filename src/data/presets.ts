import type { PromptPreset, StoryboardProject, StyleMode, VisualMode, VoiceId } from '../types/studio';

export const BUILTIN_VISUAL_ASSETS: Record<
  Exclude<VisualMode, 'diagram-2t' | 'tachometer-rev' | 'custom-media'>,
  { label: string; src: string; captionHint: string }
> = {
  'photo-rxking': {
    label: 'Yamaha RX-King 135 Studio',
    src: '/src/assets/images/rx_king_studio_1795169136726.jpg',
    captionHint: 'Motor sport naked 2-tak legendaris',
  },
  'photo-ninjarr': {
    label: 'Kawasaki Ninja 150 RR Pit',
    src: '/src/assets/images/ninja_rr_150_1795169136514.jpg',
    captionHint: 'Sport fairing 150cc Super KIPS',
  },
  'photo-satria': {
    label: 'Underbone 2-Tak Bengkel',
    src: '/src/assets/images/satria_2tak_underbone_1795169135061.jpg',
    captionHint: 'Bebek sport 2-tak lincah & ringan',
  },
  'photo-engine': {
    label: 'Blok Silinder & Karburator 2-Tak',
    src: '/src/assets/images/two_stroke_engine_macro_1795169136076.jpg',
    captionHint: 'Detail sirip blok, karbu, & leher knalpot',
  },
};

export const VOICE_OPTIONS: { id: VoiceId; label: string; tone: string }[] = [
  { id: 'Puck', label: 'Puck · Kreator Cepat & Viral', tone: 'Energik, tempo cepat ala Shorts' },
  { id: 'Fenrir', label: 'Fenrir · Host Otomotif Tegas', tone: 'Berwibawa, maskulin, bertenaga' },
  { id: 'Charon', label: 'Charon · Narator Bengkel Santai', tone: 'Berat, tenang, dokumenter otomotif' },
  { id: 'Kore', label: 'Kore · Eksplainer Jelas', tone: 'Artikulasi tajam untuk bahasan teknis' },
];

export const STYLE_MODES: StyleMode[] = [
  'Edukasi Teknis & Cara Kerja',
  'Review Legenda 2-Tak',
  'Adu Spek & Karakter Suara',
  'Mitos vs Fakta Bengkel',
];

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'rx-king-ycls',
    label: 'RX-King & YCLS',
    bikeLabel: 'Yamaha RX-King 135',
    styleMode: 'Review Legenda 2-Tak',
    durationTarget: 25,
    prompt:
      'Kenapa Yamaha RX-King 135 dijuluki Raja Jalanan? Bahas tarikan bawah yang jambak, sistem pelumasan YCLS, suara knalpot treng-teng-teng khas, dan alasan harganya makin mahal.',
  },
  {
    id: 'ninja-super-kips',
    label: 'Ninja 150 RR Super KIPS',
    bikeLabel: 'Kawasaki Ninja 150 RR',
    styleMode: 'Edukasi Teknis & Cara Kerja',
    durationTarget: 25,
    prompt:
      'Cara kerja teknologi Super KIPS di Kawasaki Ninja 150 RR. Jelaskan apa yang terjadi di bawah 7.000 RPM versus saat katup membuka penuh di atas 7.000 RPM hingga tembus 30 HP.',
  },
  {
    id: 'cara-kerja-2t',
    label: 'Siklus Mesin & Membran 2-Tak',
    bikeLabel: 'Prinsip Kerja Mesin 2-Tak',
    styleMode: 'Edukasi Teknis & Cara Kerja',
    durationTarget: 25,
    prompt:
      'Kenapa motor 2-tak tenaganya bisa jauh lebih buas dari 4-tak di cc yang sama? Jelaskan peran reed valve atau membran, kompresi primer kruk as, dan knalpot chamber perut buncit.',
  },
  {
    id: 'oli-samping',
    label: 'Rahasia Oli Samping & Asap',
    bikeLabel: 'Pelumasan 2-Tak',
    styleMode: 'Mitos vs Fakta Bengkel',
    durationTarget: 20,
    prompt:
      'Mitos vs fakta oli samping motor 2-tak: apakah asap tebal selalu bagus, beda oli mineral vs full synthetic ester, dan efek salah setel pompa oli samping.',
  },
  {
    id: 'bebek-2t',
    label: 'Satria 120R vs F1ZR',
    bikeLabel: 'Underbone 2-Tak Era 2000an',
    styleMode: 'Adu Spek & Karakter Suara',
    durationTarget: 25,
    prompt:
      'Duel bebek 2-tak legendaris Indonesia: Suzuki Satria 120R 6-speed kopling manual melawan Yamaha F1ZR. Bandingkan karakter mesin, sasis, dan suara knalpotnya.',
  },
];

export const INITIAL_PROJECT: StoryboardProject = {
  title: 'Rahasia Tarikan Buas Yamaha RX-King 135!',
  hookText: 'RAJA JALANAN 135CC',
  bikeLabel: 'Yamaha RX-King 135',
  specs: [
    { label: 'Kapasitas', value: '132 cc 2-Tak' },
    { label: 'Tenaga Puncak', value: '18,5 PS @ 9.000 RPM' },
    { label: 'Sistem Intake', value: 'Reed Valve + YEIS' },
  ],
  scenes: [
    {
      id: 'scene-1',
      title: '01. Hook Pembuka',
      durationSec: 5.5,
      narration:
        'Kenapa motor tua seratus tiga puluh lima cc ini masih ditakuti di lampu merah? Ini dia rahasia buasnya RX-King!',
      caption: 'Kenapa motor 135cc ini masih ditakuti di jalan?',
      techBadge: 'Rasio Bobot 100 kg · Akselerasi Instan',
      visualMode: 'photo-rxking',
      cameraMotion: 'zoom-in',
      accentHex: '#F97316',
      audioStatus: 'idle',
    },
    {
      id: 'scene-2',
      title: '02. Prinsip 2 Langkah',
      durationSec: 6.5,
      narration:
        'Berbeda dengan empat tak, mesin dua tak menghasilkan ledakan tenaga di setiap satu putaran penuh kruk as. Ditambah katup membran dan tabung YEIS yang bikin torsi bawah langsung ngejambak.',
      caption: 'Setiap 1 putaran kruk as langsung menghasilkan tenaga!',
      techBadge: 'Kompresi Primer + Reed Valve + YEIS',
      visualMode: 'diagram-2t',
      cameraMotion: 'zoom-in',
      accentHex: '#EF4444',
      audioStatus: 'idle',
    },
    {
      id: 'scene-3',
      title: '03. Karakter RPM & Knalpot',
      durationSec: 6.0,
      narration:
        'Saat jarum tachometer menembus delapan ribu RPM, gelombang balik knalpot chamber mendorong gas bakar kembali masuk ke silinder dengan suara treng teng teng yang ikonik.',
      caption: 'Gelombang balik knalpot chamber bikin tenaga meledak di RPM tinggi',
      techBadge: 'Redline 9.500 RPM · Suara Ikonik',
      visualMode: 'tachometer-rev',
      cameraMotion: 'pulse-rev',
      accentHex: '#F59E0B',
      audioStatus: 'idle',
    },
    {
      id: 'scene-4',
      title: '04. Penutup & CTA',
      durationSec: 5.0,
      narration:
        'Perawatan simpel, torsi brutal, dan nostalgia tak tergantikan. Menurut kalian, motor dua tak mana lagi yang wajib dibahas?',
      caption: 'Motor 2-tak favorit kalian apa? Tulis di komentar!',
      techBadge: 'Legenda 2-Tak Indonesia',
      visualMode: 'photo-engine',
      cameraMotion: 'pan-right',
      accentHex: '#F97316',
      audioStatus: 'idle',
    },
  ],
  tags: ['#2tak', '#rxking', '#otomotif', '#motor2tak', '#youtubeshorts', '#bengkel2tak'],
  description:
    'Bongkar rahasia kenapa Yamaha RX-King 135 masih jadi raja tarikan di jalanan! Dari siklus mesin 2-tak, teknologi YEIS, sampai suara khas knalpotnya.',
};
