/**
 * Utilidad de optimización y compresión automática de imágenes en el cliente (Navegador).
 * Utiliza la API de HTML5 Canvas para:
 * 1. Redimensionar imágenes grandes a un ancho máximo estándar (1200px máx) conservando la relación de aspecto.
 * 2. Convertir automáticamente cualquier formato (JPG, PNG, HEIC, WebP) a WebP nativo con calidad 0.8 (80%).
 * 3. Lograr una reducción drástica de peso (de 4MB-8MB a 70KB-150KB) sin pérdida perceptible de calidad visual.
 */

export interface ImageOptimizationResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatioPercent: number;
}

export async function compressImageToWebP(
  inputFile: File | Blob,
  maxWidth = 1200,
  quality = 0.8
): Promise<ImageOptimizationResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('compressImageToWebP solo puede ejecutarse en el cliente.'));
    }

    const originalSizeBytes = inputFile.size;
    const objectUrl = URL.createObjectURL(inputFile);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;

      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (targetWidth > maxWidth) {
        targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
        targetWidth = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('No se pudo inicializar el contexto 2D de canvas.'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Error al generar blob WebP desde canvas.'));
          }

          const compressedSizeBytes = blob.size;
          const compressionRatioPercent = originalSizeBytes > 0
            ? Number((((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100).toFixed(1))
            : 0;

          const originalName = (inputFile as File).name || 'product-image.jpg';
          const baseName = originalName.replace(/\.[^/.]+$/, '');
          const webpFileName = `${baseName}.webp`;
          const webpFile = new File([blob], webpFileName, { type: 'image/webp' });

          const dataUrl = canvas.toDataURL('image/webp', quality);

          resolve({
            file: webpFile,
            blob,
            dataUrl,
            originalWidth,
            originalHeight,
            width: targetWidth,
            height: targetHeight,
            originalSizeBytes,
            compressedSizeBytes,
            compressionRatioPercent,
          });
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar el archivo de imagen para su procesamiento.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Formatear bytes a formato legible (KB, MB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
