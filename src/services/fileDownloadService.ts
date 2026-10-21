import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Delivers generated files in a way that works in Android/iOS WebViews as well
 * as regular mobile and desktop browsers. Native downloads use the OS share
 * sheet instead of relying on an <a download> click inside a WebView.
 */
/**
 * Kept for compatibility with existing export buttons.
 * Downloads are delivered from the current page; never open an auxiliary tab.
 */
export function prepareMobileDownloadTarget(): Window | null {
  return null;
}

export async function deliverGeneratedFile(blob: Blob, fileName: string, downloadTarget?: Window | null): Promise<void> {
  const deliveryStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const metricNow = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!blob || blob.size === 0) {
    throw new Error('El archivo generado está vacío. Inténtelo nuevamente.');
  }

  // APK Android: stream large files to the native bridge in small chunks.
  // Passing a full ZIP/XLSX as one Base64 string can allocate several copies
  // of a huge file in the WebView and leave both download buttons apparently stuck.
  const nativeBridge = typeof window !== 'undefined'
    ? (window as Window & { FieldTraceNative?: {
        saveExcelToDownloads?: (base64: string, name: string) => string;
        saveZipToDownloads?: (base64: string, name: string) => string;
        beginDocumentSave?: (name: string, mime: string) => string;
        appendDocumentSaveChunk?: (base64: string) => string;
        finishDocumentSave?: () => string;
        cancelDocumentSave?: () => void;
      } }).FieldTraceNative
    : undefined;

  if (Capacitor.isNativePlatform() && nativeBridge &&
      typeof nativeBridge.beginDocumentSave === 'function' &&
      typeof nativeBridge.appendDocumentSaveChunk === 'function' &&
      typeof nativeBridge.finishDocumentSave === 'function') {
    const mimeType = blob.type || (/\\.zip$/i.test(fileName) ? 'application/zip' :
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const started = nativeBridge.beginDocumentSave(fileName, mimeType);
    if (!started) throw new Error('Android no pudo iniciar el guardado. Libere espacio e inténtelo nuevamente.');

    try {
      const byteConversionStart = metricNow();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const byteConversionMs = metricNow() - byteConversionStart;
      let base64EncodingMs = 0;
      let nativeBridgeMs = 0;
      // 48 KiB is divisible by 3, so chunks encode independently without padding
      // corrupting the concatenated byte stream.
      const chunkSize = 48 * 1024;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, bytes.length);
        const encodeStart = metricNow();
        let binary = '';
        for (let i = offset; i < end; i += 1) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        base64EncodingMs += metricNow() - encodeStart;
        const bridgeStart = metricNow();
        const result = nativeBridge.appendDocumentSaveChunk(base64);
        nativeBridgeMs += metricNow() - bridgeStart;
        if (!result) throw new Error(`Android no pudo guardar el archivo (bloque ${Math.floor(offset / chunkSize) + 1}).`);
        if (end < bytes.length && Math.floor(end / (1024 * 1024)) !== Math.floor(offset / (1024 * 1024))) {
          await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        }
      }
      const finishStart = metricNow();
      const savedPath = nativeBridge.finishDocumentSave();
      const nativeFinalizeMs = metricNow() - finishStart;
      if (!savedPath) throw new Error('Android no pudo finalizar el archivo en Descargas. Revise el espacio disponible.');
      console.info('[FileDownload] Diagnóstico de entrega Android:', {
        fileSizeMB: Number((bytes.byteLength / (1024 * 1024)).toFixed(2)),
        byteConversionSeconds: Number((byteConversionMs / 1000).toFixed(3)),
        base64EncodingSeconds: Number((base64EncodingMs / 1000).toFixed(3)),
        nativeBridgeTransferSeconds: Number((nativeBridgeMs / 1000).toFixed(3)),
        nativeFinalizeSeconds: Number((nativeFinalizeMs / 1000).toFixed(3)),
        totalDeliverySeconds: Number(((metricNow() - deliveryStart) / 1000).toFixed(3)),
      });
      console.info('[FileDownload] Archivo guardado por Android; bytes:', bytes.byteLength);
      return;
    } catch (error) {
      try { nativeBridge.cancelDocumentSave?.(); } catch {}
      throw error;
    }
  }

  // Compatibility with APK builds that have the older native bridge.
  if (Capacitor.isNativePlatform() && nativeBridge) {
    const legacySave = /\\.zip$/i.test(fileName) || blob.type.toLowerCase().includes('zip')
      ? nativeBridge.saveZipToDownloads
      : nativeBridge.saveExcelToDownloads;
    if (typeof legacySave === 'function') {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
      }
      const savedPath = legacySave.call(nativeBridge, btoa(binary), fileName);
      if (!savedPath) throw new Error('Android no pudo guardar el archivo. Actualice Field Trace e inténtelo nuevamente.');
      return;
    }
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

  // Prefer a browsing context opened synchronously by the original tap.
  // This avoids relying on transient activation after long Excel/ZIP generation.
  if (downloadTarget && !downloadTarget.closed) {
    const url = URL.createObjectURL(blob);
    try {
      const anchor = downloadTarget.document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.textContent = `Descargar ${fileName}`;
      anchor.style.cssText = 'display:inline-block;margin-top:16px;padding:12px 16px;background:#215df5;color:white;border-radius:10px;text-decoration:none;font-weight:700';
      downloadTarget.document.body.replaceChildren();
      const heading = downloadTarget.document.createElement('h2');
      heading.textContent = 'Archivo listo';
      const message = downloadTarget.document.createElement('p');
      message.textContent = 'Si la descarga no comenzó automáticamente, toque el botón siguiente.';
      downloadTarget.document.body.append(heading, message, anchor);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      return;
    } catch (error) {
      URL.revokeObjectURL(url);
      console.warn('[FileDownload] Descarga en pestaña preparada falló; usando alternativa.', error);
    }
  }

  // En navegadores, descargar directamente desde la página actual.
  // No abrir pestañas auxiliares ni mostrar una hoja de compartir inesperada.

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
