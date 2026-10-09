import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Delivers generated files in a way that works in Android/iOS WebViews as well
 * as regular mobile and desktop browsers. Native downloads use the OS share
 * sheet instead of relying on an <a download> click inside a WebView.
 */
export async function deliverGeneratedFile(blob: Blob, fileName: string): Promise<void> {
  if (!blob || blob.size === 0) {
    throw new Error('El archivo generado está vacío. Inténtelo nuevamente.');
  }

  if (Capacitor.isNativePlatform()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    const base64 = btoa(binary);
    const saved = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: fileName,
      dialogTitle: 'Guardar o compartir archivo',
      files: [saved.uri],
    });
    return;
  }

  // On mobile browsers, prefer the native share sheet when sharing files is
  // supported; it is more reliable than synthetic downloads in some browsers.
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function') {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return;
      }
    } catch (error) {
      // User cancellation is not a download failure; otherwise try normal download.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.warn('[FileDownload] Compartir archivo no disponible; usando descarga web.', error);
    }
  }

  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Este dispositivo no permite descargar el archivo desde este entorno.');
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Keep the Blob URL alive longer for slower mobile download managers.
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }
}
