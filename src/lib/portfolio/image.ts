// V0.7 step 9 — 스크린샷 캔버스 다운스케일 + JPEG 인코딩.
//
// design v2.3: 1600px 폭 + quality 85 JPEG (PNG → JPEG 변환으로 storage 절약).
// retina 5120x2880 → 1600px JPEG. dogfood 결과 안 좋으면 비율 조정.

export interface DownscaleResult {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export async function downscaleToJpeg(
  file: File | Blob,
  options: { maxWidth?: number; quality?: number } = {},
): Promise<DownscaleResult> {
  const maxWidth = options.maxWidth ?? 1600;
  const quality = options.quality ?? 0.85;

  const bitmap = await createImageBitmap(file);
  try {
    const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
    const targetW = Math.round(bitmap.width * ratio);
    const targetH = Math.round(bitmap.height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context 못 얻음");
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    if (!blob) throw new Error("canvas toBlob 실패");
    const buffer = await blob.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      width: targetW,
      height: targetH,
    };
  } finally {
    bitmap.close();
  }
}
