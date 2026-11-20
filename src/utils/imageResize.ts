export interface UploadedBatchItem {
  id: string;
  file: File;
  url: string;
  kind: 'image' | 'video';
  name: string;
  thumbnailBase64?: string;
  thumbnailMimeType?: string;
}

/**
 * Downscales an uploaded image (or captures a video frame) to a lightweight max-384px JPEG
 * base64 string so multiple photos can be analyzed quickly by Gemini multimodal models.
 */
export async function createThumbnailBase64(
  file: File,
  objectUrl: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const maxDim = 384;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video frame timeout')), 4000);
        video.onloadeddata = () => {
          video.currentTime = Math.min(0.25, video.duration || 0);
        };
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Video load error'));
        };
      });

      const scale = Math.min(1, maxDim / Math.max(video.videoWidth || 1, video.videoHeight || 1));
      canvas.width = Math.max(64, Math.round((video.videoWidth || 384) * scale));
      canvas.height = Math.max(64, Math.round((video.videoHeight || 384) * scale));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      const img = new Image();
      img.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load error'));
      });

      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      canvas.width = Math.max(64, Math.round((img.naturalWidth || 384) * scale));
      canvas.height = Math.max(64, Math.round((img.naturalHeight || 384) * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    const base64 = dataUrl.split(',')[1];
    return base64 ? { base64, mimeType: 'image/jpeg' } : null;
  } catch {
    return null;
  }
}
