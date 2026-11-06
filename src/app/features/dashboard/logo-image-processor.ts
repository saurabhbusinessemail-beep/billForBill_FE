const MAX_EDGE_PIXELS = 1600;
const MAX_UPLOAD_BYTES = 900 * 1024;
const MAX_PRODUCT_IMAGE_BYTES = 500 * 1024;
const LOSSY_QUALITIES = [0.92, 0.84, 0.76, 0.68, 0.60];
type DecodedImage = { source: CanvasImageSource; width: number; height: number; close: () => void };

/** Resize and encode a logo for crisp dashboard and bill rendering under the API limit. */
export async function prepareBusinessLogo(file: File): Promise<File> {
  return prepareImage(file, MAX_UPLOAD_BYTES, 'logo');
}

export async function prepareProductImage(file: File): Promise<File> {
  return prepareImage(file, MAX_PRODUCT_IMAGE_BYTES, 'product image');
}

async function prepareImage(file: File, maxUploadBytes: number, label: string): Promise<File> {
  const image = await decodeImage(file);
  try {
    let scale = Math.min(1, MAX_EDGE_PIXELS / Math.max(image.width, image.height));
    let qualityIndex = 0;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, file.type, file.type === 'image/png' ? undefined : LOSSY_QUALITIES[qualityIndex]);
      if (blob.size <= maxUploadBytes) {
        const extension = extensionFor(blob.type);
        const name = file.name.replace(/\.[^.]+$/, '');
        return new File([blob], `${name}${extension}`, { type: blob.type, lastModified: file.lastModified });
      }

      if (file.type !== 'image/png' && qualityIndex < LOSSY_QUALITIES.length - 1 && blob.type !== 'image/png') {
        qualityIndex += 1;
      } else {
        const byteScale = Math.sqrt(maxUploadBytes / blob.size) * 0.92;
        scale *= Math.min(0.82, Math.max(0.5, byteScale));
        qualityIndex = 0;
      }
    }

    throw new Error(`Unable to optimize this ${label} to the upload limit`);
  } finally {
    image.close();
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode this logo')), type, quality);
  });
}

function extensionFor(type: string): string {
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/webp') return '.webp';
  return '.png';
}
