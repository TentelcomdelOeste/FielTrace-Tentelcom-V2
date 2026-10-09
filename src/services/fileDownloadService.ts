import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Delivers generated files in a way that works in Android/iOS WebViews as well
 * as regular mobile and desktop browsers. Native downloads use the OS share
 * sheet instead of relying on an <a download> click inside a WebView.
 */
/**
 * Opens a same-origin download surface synchronously from the user's tap.
 * Mobile browsers can discard transient user activation while a large Excel
 * or ZIP is being generated; a new tab opened here remains available when the
 * Blob is finally ready.
 */
export function prepareMobileDownloadTarget(): Window | null {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return null;
  const isMobile = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
  if (!isMobile) return null;

  try {
    const target = window.open('', '_blank');
    if (target && !target.closed) {
      target.document.open();
      target.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Field Trace</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#172033"><h2>Preparando archivo…</h2><p>No cierre esta pestaña mientras se prepara la descarga.</p></body></html>`);
      target.document.close();
      return target;
    }
  } catch (error) {
    console.warn('[FileDownload] No se pudo abrir el destino móvil de descarga.', error);
  }
  return null;
}

export async function deliverGeneratedFile(blob: Blob, fileName: string, downloadTarget?: Window | null): Promise<void> {
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
      const bytes = new Uint8Array(await blob.arrayBuffer());
      // 48 KiB is divisible by 3, so chunks encode independently without padding
      // corrupting the concatenated byte stream.
      const chunkSize = 48 * 1024;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, bytes.length);
        let binary = '';
        for (let i = offset; i < end; i += 1) binary += String.fromCharCode(bytes[i]);
        const result = nativeBridge.appendDocumentSaveChunk(btoa(binary));
        if (!result) throw new Error(`Android no pudo guardar el archivo (bloque ${Math.floor(offset / chunkSize) + 1}).`);
        if (end < bytes.length && Math.floor(end / (1024 * 1024)) !== Math.floor(offset / (1024 * 1024))) {
          await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        }
      }
      const savedPath = nativeBridge.finishDocumentSave();
      if (!savedPath) throw new Error('Android no pudo finalizar el archivo en Descargas. Revise el espacio disponible.');
      console.info('[FileDownload] Archivo guardado por Android:', savedPath, 'bytes:', bytes.byteLength);
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
      // In mobile browsers, Web Share can reject after the lengthy file generation
      // has outlived the original tap's transient user activation. Some WebViews
      // also report AbortError without showing a visible share sheet. Never treat
      // that as a successful download: fall through to the browser download path.
      console.warn('[FileDownload] Compartir archivo no completado; usando descarga web.', error);
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
