/**
 * Fast barcode decoding for the phone camera.
 *
 * Uses the browser's native BarcodeDetector where available (Android Chrome) and falls back to
 * ZXing elsewhere (iOS Safari). ZXing's QR finder is fragile: whether it locks onto a code depends
 * a lot on the image scale, and full HD frames are slow. So every frame it gets a small,
 * downscaled image, cycling through different crops and sizes. Each attempt only takes a few
 * milliseconds, and within a fraction of a second one of them matches the code in view.
 */
export interface BarcodeDecoder {
  readonly name: string;
  /** Returns the decoded text or null when nothing was found in this frame. */
  decode(video: HTMLVideoElement): Promise<string | null>;
}

const NATIVE_FORMATS = [
  'qr_code',
  'code_128',
  'code_39',
  'data_matrix',
  'pdf417',
  'aztec',
  'ean_13',
];
/**
 * Variants tried one after another: share of the shorter video edge to crop around the centre
 * (1 = whole frame), longest edge of the downscaled image, and whether to use TRY_HARDER (slower,
 * but helps with rotated 1D barcodes).
 */
const VARIANTS: [crop: number, edge: number, tryHarder: boolean][] = [
  [1, 540, false],
  [0.7, 300, false],
  [0.7, 480, false],
  [1, 720, false],
  [0.5, 300, false],
  [0.7, 640, true],
  [1, 400, false],
  [0.5, 420, false],
  [0.7, 360, false],
  [1, 960, true],
];

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface NativeDetectorConstructor {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
}

export async function createDecoder(): Promise<BarcodeDecoder> {
  return (await createNativeDecoder()) ?? (await createZxingDecoder());
}

async function createNativeDecoder(): Promise<BarcodeDecoder | null> {
  const Detector = (window as unknown as { BarcodeDetector?: NativeDetectorConstructor })
    .BarcodeDetector;
  if (!Detector) return null;
  try {
    const supported = await Detector.getSupportedFormats();
    const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
    if (!formats.includes('qr_code')) return null;
    const detector = new Detector({ formats });
    return {
      name: 'native',
      async decode(video) {
        const codes = await detector.detect(video);
        return codes.find((c) => c.rawValue)?.rawValue ?? null;
      },
    };
  } catch {
    return null;
  }
}

async function createZxingDecoder(): Promise<BarcodeDecoder> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const formats = [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.PDF_417,
    BarcodeFormat.AZTEC,
    BarcodeFormat.EAN_13,
  ];
  const reader = (tryHarder: boolean) =>
    new BrowserMultiFormatReader(
      new Map<number, unknown>([
        [DecodeHintType.POSSIBLE_FORMATS, formats],
        [DecodeHintType.TRY_HARDER, tryHarder],
      ]) as Map<never, unknown>,
    );
  const fast = reader(false);
  const hard = reader(true);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let frame = 0;

  return {
    name: 'zxing',
    async decode(video) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return null;
      const [crop, edge, tryHarder] = VARIANTS[frame++ % VARIANTS.length];
      const size = Math.min(w, h) * crop;
      const [sx, sy, sw, sh] =
        crop === 1 ? [0, 0, w, h] : [(w - size) / 2, (h - size) / 2, size, size];
      const scale = Math.min(1, edge / Math.max(sw, sh));
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      try {
        return (tryHarder ? hard : fast).decodeFromCanvas(canvas).getText();
      } catch {
        return null; // nothing found in this frame
      }
    },
  };
}
