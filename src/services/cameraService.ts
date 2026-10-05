/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Gallery save via @capacitor-community/media -> album Field Trace
 * Thumbnail / album open via FieldTraceNative MediaStore bridge (Android)
 */

import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';

let _cachedAlbumIdentifier: string | null = null;
let _lastSavedPath: string | null = null;
const ALBUM_NAME = 'Field Trace';
const LS_LAST_PATH = 'ft_last_photo_path';

function getNative(): any {
  return (window as any).FieldTraceNative || null;
}

function loadPersistedPath(): string | null {
  try {
    const v = localStorage.getItem(LS_LAST_PATH);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

function persistPath(path: string | null) {
  try {
    if (path) localStorage.setItem(LS_LAST_PATH, path);
  } catch {
    /* ignore */
  }
}

// Restore last path from previous session
_lastSavedPath = loadPersistedPath();

export const cameraService = {
  async drawOverlay(imageSrc: string, metadata: any): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('drawOverlay timed out, returning original image');
        resolve(imageSrc);
      }, 5000);

      const img = new Image();
      img.onerror = () => {
        clearTimeout(timeout);
        console.error('Error loading image for overlay');
        resolve(imageSrc);
      };
      img.onload = () => {
        clearTimeout(timeout);
        try {
          let targetWidth = img.width;
          let targetHeight = img.height;

          const vfRatio = metadata.viewfinder?.ratio
            || (metadata.viewfinder?.width && metadata.viewfinder?.height ? metadata.viewfinder.width / metadata.viewfinder.height : null)
            || (metadata.settings?.viewfinder?.ratio)
            || (window.innerWidth / Math.max(1, window.innerHeight - 76));
          const screenRatio = vfRatio && !isNaN(vfRatio) && vfRatio > 0 ? vfRatio : (window.innerWidth / window.innerHeight);
          const imageRatio = targetWidth / targetHeight;

          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = targetWidth;
          let sourceHeight = targetHeight;

          if (imageRatio > screenRatio) {
            sourceWidth = targetHeight * screenRatio;
            sourceX = (targetWidth - sourceWidth) / 2;
          } else if (imageRatio < screenRatio) {
            sourceHeight = targetWidth / screenRatio;
            sourceY = (targetHeight - sourceHeight) / 2;
          }

          let drawWidth = sourceWidth;
          let drawHeight = sourceHeight;

          // Preserve the high-resolution capture while keeping a safe WebView canvas ceiling.
          // The final image is cropped to the camera viewfinder ratio but is no longer forced down to 2048px.
          const MAX_DIM = 4096;
          if (drawWidth > MAX_DIM || drawHeight > MAX_DIM) {
            if (drawWidth > drawHeight) {
              drawHeight = Math.round((drawHeight * MAX_DIM) / drawWidth);
              drawWidth = MAX_DIM;
            } else {
              drawWidth = Math.round((drawWidth * MAX_DIM) / drawHeight);
              drawHeight = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = drawWidth;
          canvas.height = drawHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(imageSrc);

          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, drawWidth, drawHeight
          );

          const position = metadata.settings?.overlayPosition || 'top-left';
          const fontSizeScale = metadata.settings?.fontSizeScale || 'medium';
          const fontSizeValue = metadata.settings?.fontSizeValue;
          const overlayColor = metadata.settings?.overlayColor || '#FFFFFF';

          const baseSize = Math.max(24, Math.floor(canvas.width / 40));
          let fontSize = baseSize;

          if (fontSizeValue) {
            fontSize = (fontSizeValue / 100) * (canvas.width / 10);
          } else {
            if (fontSizeScale === 'small') fontSize = baseSize * 0.7;
            if (fontSizeScale === 'large') fontSize = baseSize * 1.5;
          }

          const margin = canvas.width * 0.04;
          const lineHeight = fontSize * 1.4;

          ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
          ctx.textBaseline = 'top';

          const rawLines: string[] = [];
          if (metadata.projectName) rawLines.push(`${metadata.projectName.toUpperCase()}`);
          if (metadata.settings?.showDateTime && metadata.dateTimeFormatted) rawLines.push(`${metadata.dateTimeFormatted}`);
          if (metadata.settings?.showGps) {
            const gpsText = metadata.gpsLabel
              || (metadata.latitude && metadata.longitude
                  ? `${Number(metadata.latitude).toFixed(6)}, ${Number(metadata.longitude).toFixed(6)}`
                  : 'SIN GPS');
            rawLines.push(gpsText);
          }
          if (metadata.settings?.showLocation && metadata.ubicacion) rawLines.push(`${metadata.ubicacion.toUpperCase()}`);
          if (metadata.settings?.showTech) rawLines.push(`${metadata.baseFields?.tecnico || 'N/A'}`);

          const isFiberCapture = metadata.category === 'PUNTAS_FIBRA_INICIAL' || metadata.category === 'PUNTAS_FIBRA_FINAL';
          const fiberFieldNames = new Set(['PUNTA', 'TIPO', 'METRAJE', 'NÚMERO DE CARRETE', 'CANTIDAD DE FIBRAS']);

          // Mantener el mismo orden que se ve en vivo:
          // PUNTA INICIAL/FINAL + metraje, luego carrete y cantidad de fibras.
          if (isFiberCapture) {
            (metadata.customFields || []).forEach((cf: any) => {
              if (cf.active === false || !cf.showInPhoto || fiberFieldNames.has(String(cf.name || '').trim().toUpperCase())) return;
              if (cf.value && String(cf.value).trim() !== '') {
                rawLines.push(`${cf.name.toUpperCase()}: ${String(cf.value).toUpperCase()}`);
              } else {
                rawLines.push(`${cf.name.toUpperCase()}`);
              }
            });

            const sideLabel = metadata.fiberSide === 'initial' ? 'INICIAL' : 'FINAL';
            const pairNumber = metadata.fiberPairNumber ?? '';
            const meterage = Number(metadata.fiberMeterage || 0);
            rawLines.push(`PUNTA ${sideLabel} ${pairNumber}: ${meterage > 0 ? `${meterage} M` : '—'}`);

            const reelNumber = String(metadata.fiberReelNumber || '').trim();
            const fiberCount = Number(metadata.fiberCount || 0);
            if (reelNumber) rawLines.push(`NÚMERO DE CARRETE: ${reelNumber.toUpperCase()}`);
            if (fiberCount > 0) rawLines.push(`CANTIDAD DE FIBRAS: ${fiberCount}`);
          } else {
            (metadata.customFields || []).forEach((cf: any) => {
              if (cf.active !== false && cf.showInPhoto) {
                if (cf.value && String(cf.value).trim() !== '') {
                  rawLines.push(`${cf.name.toUpperCase()}: ${String(cf.value).toUpperCase()}`);
                } else {
                  rawLines.push(`${cf.name.toUpperCase()}`);
                }
              }
            });
          }


          if (metadata.category === 'ACEROS') {
            const aceroNumber = metadata.aceroNumber ?? '';
            const photoType = metadata.aceroPhotoType || (metadata.aceroSide === 'photo2' ? 'meterage' : 'panoramic');
            if (photoType === 'meterage') {
              const meterage = Number(metadata.aceroMeterage || 0);
              rawLines.push(`METRAJE ${aceroNumber}: ${meterage > 0 ? `${meterage} M` : '—'}`);
            } else {
              rawLines.push(`PANORÁMICA ACERO ${aceroNumber}`);
            }
          }

          if (metadata.category === 'ALTAS') {
            const altaNumber = metadata.altaNumber ?? '';
            const altaType = String(metadata.altaType || '').trim();
            const side = metadata.altaSide;
            if (side === 'meterage') {
              const meterage = Number(metadata.altaMeterage || 0);
              rawLines.push(`METRAJE ALTA ${altaNumber}: ${meterage > 0 ? `${meterage} M` : '—'}`);
            } else {
              rawLines.push(`PANORÁMICA ALTA ${altaNumber}`);
            }
            if (altaType) rawLines.push(altaType.toUpperCase());
            if (altaType === 'FIBRA DE DESCARTE' || altaType === 'FIBRA DE DESECHO') {
              const reel = String(metadata.altaReelNumber || '').trim();
              const fibers = Number(metadata.altaFiberCount || 0);
              if (reel) rawLines.push(`CARRETE: ${reel.toUpperCase()}`);
              if (fibers > 0) rawLines.push(`CANTIDAD DE FIBRAS: ${fibers}`);
            }
          }

          if (metadata.category === 'RESERVA') {
            const reserveNumber = metadata.reserveNumber ?? '';
            const side = metadata.reserveSide;
            if (side === 'roll') {
              rawLines.push(`RESERVA DETALLADO ${reserveNumber}`);
            } else {
              const label = side === 'initial' ? 'PUNTA INICIAL' : 'PUNTA FINAL';
              const meterage = Number(metadata.reserveMeterage || 0);
              rawLines.push(`${label} ${reserveNumber}: ${meterage > 0 ? `${meterage} M` : '—'}`);
              const reel = String(metadata.reserveReelNumber || '').trim();
              const fibers = Number(metadata.reserveFiberCount || 0);
              if (reel) rawLines.push(`CARRETE: ${reel.toUpperCase()}`);
              if (fibers > 0) rawLines.push(`CANTIDAD DE FIBRAS: ${fibers}`);
            }
          }

          if (metadata.category === 'NAPS' && String(metadata.napName || '').trim()) {
            rawLines.push(`NAP: ${String(metadata.napName).trim().toUpperCase()}`);
          }

          if (rawLines.length === 0) return resolve(imageSrc);

          const p_overlayPos = metadata.settings?.overlayPosition || 'top-left';
          const p_logoPos = metadata.settings?.logoPosition || 'top-left';
          const hasLogo = !!metadata.settings?.logoImage;
          const logoSizeSetting = metadata.settings?.logoSize || 20;
          const logoCanvasWidth = (canvas.width * logoSizeSetting) / 100;

          const isSameYAndDifferentX =
            (p_overlayPos.includes('top') && p_logoPos.includes('top') && p_overlayPos !== p_logoPos) ||
            (p_overlayPos.includes('bottom') && p_logoPos.includes('bottom') && p_overlayPos !== p_logoPos);

          const maxTextWidth = (hasLogo && isSameYAndDifferentX)
            ? canvas.width - (3 * margin) - logoCanvasWidth
            : canvas.width - (2 * margin);

          const lines: string[] = [];

          for (const rawLine of rawLines) {
            const subLines = rawLine.split('\n');
            for (const subLine of subLines) {
              const words = subLine.split(' ');
              let currentLine = '';
              let subLineCount = 0;

              for (const word of words) {
                const candidate = currentLine ? currentLine + ' ' + word : word;

                if (ctx.measureText(candidate).width <= maxTextWidth) {
                  currentLine = candidate;
                  continue;
                }

                // Si una palabra sola supera el ancho disponible (por ejemplo,
                // un nombre de NAP muy largo), también la partimos por caracteres
                // para que todo el texto quede visible en la fotografía.
                if (ctx.measureText(word).width > maxTextWidth) {
                  if (currentLine) {
                    lines.push(currentLine);
                    currentLine = '';
                    subLineCount++;
                  }

                  let chunk = '';
                  for (const char of word) {
                    const testChunk = chunk + char;
                    if (ctx.measureText(testChunk).width > maxTextWidth) {
                      if (chunk) {
                        lines.push(chunk);
                        subLineCount++;
                      }
                      chunk = char;
                    } else {
                      chunk = testChunk;
                    }
                  }
                  currentLine = chunk;
                } else {
                  if (currentLine) {
                    lines.push(currentLine);
                    subLineCount++;
                  }
                  currentLine = word;
                }
              }

              if (currentLine) lines.push(currentLine);
            }
          }

          let maxWidth = 0;
          lines.forEach(line => {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
          });
          const totalHeight = lines.length * lineHeight;

          let startX = margin;
          let startY = margin;

          if (position === 'top-right' || position === 'bottom-right') {
            ctx.textAlign = 'right';
            startX = canvas.width - margin;
            if (position === 'bottom-right') {
              startY = canvas.height - totalHeight - margin;
            }
          } else {
            ctx.textAlign = 'left';
            if (position === 'bottom-left') {
              startY = canvas.height - totalHeight - margin;
            }
          }

          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;

          ctx.fillStyle = overlayColor;
          lines.forEach((line, index) => {
            ctx.fillText(line, startX, startY + (index * lineHeight));
          });

          ctx.textAlign = 'left';

          if (metadata.settings?.logoImage) {
            const logoImg = new Image();
            logoImg.onload = () => {
              try {
                const logoSizeSetting = metadata.settings?.logoSize || 20;
                const logoOpacity = metadata.settings?.logoOpacity !== undefined ? metadata.settings.logoOpacity / 100 : 0.8;
                const logoPosition = metadata.settings?.logoPosition || 'top-left';

                const targetWidth = (canvas.width * logoSizeSetting) / 100;
                const ratio = logoImg.height / logoImg.width;
                const targetHeight = targetWidth * ratio;

                let logoX = margin;
                let logoY = margin;

                if (logoPosition === 'top-right') {
                  logoX = canvas.width - targetWidth - margin;
                } else if (logoPosition === 'bottom-left') {
                  logoY = canvas.height - targetHeight - margin;
                } else if (logoPosition === 'bottom-right') {
                  logoX = canvas.width - targetWidth - margin;
                  logoY = canvas.height - targetHeight - margin;
                }

                ctx.save();
                ctx.globalAlpha = logoOpacity;
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.drawImage(logoImg, logoX, logoY, targetWidth, targetHeight);
                ctx.restore();

                resolve(canvas.toDataURL('image/jpeg', 0.95));
              } catch (err) {
                resolve(canvas.toDataURL('image/jpeg', 0.95));
              }
            };
            logoImg.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.95));
            logoImg.src = metadata.settings.logoImage;
          } else {
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          }
        } catch (err) {
          console.error('Error drawing overlay:', err);
          resolve(imageSrc);
        }
      };
      img.src = imageSrc;
    });
  },

  async saveToGallery(dataUrl: string, fileName: string): Promise<boolean> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      console.warn('[Gallery] Native gallery is unavailable on web.');
      return false;
    }

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      console.error('[Gallery] Invalid data URL for savePhoto');
      return false;
    }

    const baseName = (fileName || 'FT_photo').replace(/\.[^/.]+$/, '');

    try {
      const albumIdentifier = await this.ensureFieldTraceAlbum();
      const result = await Media.savePhoto({
        path: dataUrl,
        albumIdentifier,
        fileName: baseName,
      } as any);
      console.log('[Gallery] Saved to Field Trace album:', result);
      const path = (result as any)?.filePath || (result as any)?.path || (result as any)?.identifier || null;
      if (path) {
        _lastSavedPath = String(path);
        persistPath(_lastSavedPath);
      }
      return true;
    } catch (error: any) {
      console.error('[Gallery] Album save failed:', error?.code || error?.message || error);
    }

    try {
      _cachedAlbumIdentifier = null;
      const albumIdentifier = await this.ensureFieldTraceAlbum();
      const result = await Media.savePhoto({
        path: dataUrl,
        albumIdentifier,
        fileName: baseName,
      } as any);
      console.log('[Gallery] Saved to Field Trace on retry:', result);
      const path2 = (result as any)?.filePath || (result as any)?.path || (result as any)?.identifier || null;
      if (path2) {
        _lastSavedPath = String(path2);
        persistPath(_lastSavedPath);
      }
      return true;
    } catch (error: any) {
      console.error('[Gallery] Retry album save failed:', error?.code || error?.message || error);
    }

    try {
      const result = await Media.savePhoto({
        path: dataUrl,
        fileName: baseName,
      } as any);
      console.warn('[Gallery] Saved WITHOUT album (fallback):', result);
      const path3 = (result as any)?.filePath || (result as any)?.path || (result as any)?.identifier || null;
      if (path3) {
        _lastSavedPath = String(path3);
        persistPath(_lastSavedPath);
      }
      return true;
    } catch (error: any) {
      console.error('[Gallery] Fallback save failed:', error?.code || error?.message || error);
      return false;
    }
  },

  async ensureFieldTraceAlbum(): Promise<string> {
    if (_cachedAlbumIdentifier) {
      return _cachedAlbumIdentifier;
    }

    let albumsPath = '';
    try {
      if (Capacitor.getPlatform() === 'android') {
        const pathRes = await (Media as any).getAlbumsPath?.();
        albumsPath = pathRes?.path || '';
      }
    } catch (e) {
      console.warn('[Gallery] getAlbumsPath not available:', e);
    }

    const isOurAlbum = (a: { name: string; identifier: string }) => {
      const nameOk =
        a.name === ALBUM_NAME ||
        a.name === 'FieldTrace' ||
        a.name === 'Field_Trace' ||
        (a.name || '').toLowerCase().includes('field trace') ||
        (a.name || '').toLowerCase().includes('fieldtrace');
      if (!nameOk) return false;
      if (albumsPath && a.identifier) {
        return a.identifier.startsWith(albumsPath) || a.identifier.includes(ALBUM_NAME.replace(/\s/g, ''));
      }
      return true;
    };

    const findAlbum = (albums: { name: string; identifier: string }[]) =>
      albums.find(isOurAlbum) ||
      albums.find((a) => a.name === ALBUM_NAME || a.name === 'FieldTrace' || a.name === 'Field_Trace');

    let albums = (await Media.getAlbums()).albums || [];
    let album = findAlbum(albums);

    if (!album) {
      try {
        await Media.createAlbum({ name: ALBUM_NAME });
      } catch (error: any) {
        console.warn('[Gallery] createAlbum:', error?.code || error?.message || error);
      }
      await new Promise((r) => setTimeout(r, 350));
      albums = (await Media.getAlbums()).albums || [];
      album = findAlbum(albums);
    }

    if (!album) {
      await new Promise((r) => setTimeout(r, 500));
      albums = (await Media.getAlbums()).albums || [];
      album = findAlbum(albums);
    }

    if (!album) {
      throw new Error('FIELD_TRACE_ALBUM_NOT_FOUND');
    }

    _cachedAlbumIdentifier = album.identifier;
    return album.identifier;
  },

  getLastSavedPath(): string | null {
    return _lastSavedPath || loadPersistedPath();
  },

  /**
   * Load a small data-URL of the latest Field Trace album photo (survives app restart).
   * Never throws; returns null if album empty / native unavailable.
   */
  async getLastThumbnail(maxSide = 256): Promise<string | null> {
    try {
      const native = getNative();
      if (native && typeof native.getLatestFieldTraceThumbnailBase64 === 'function') {
        const thumb = native.getLatestFieldTraceThumbnailBase64(maxSide);
        if (thumb && String(thumb).startsWith('data:image')) {
          return String(thumb);
        }
      }
      // Fallback: thumbnail from last known path
      const path = this.getLastSavedPath();
      if (path && native && typeof native.getPhotoThumbnailBase64 === 'function') {
        const thumb2 = native.getPhotoThumbnailBase64(path, maxSide);
        if (thumb2 && String(thumb2).startsWith('data:image')) {
          return String(thumb2);
        }
      }
    } catch (e) {
      console.warn('[Gallery] getLastThumbnail failed', e);
    }
    return null;
  },

  /**
   * List photos in Field Trace album (newest first).
   * Returns { uri, id, thumb? }[]
   */
  async listAlbumPhotos(limit = 60): Promise<Array<{ uri: string; id?: number; thumb?: string }>> {
    try {
      const native = getNative();
      if (!native || typeof native.listFieldTracePhotos !== 'function') {
        return [];
      }
      const raw = native.listFieldTracePhotos(limit);
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((p: any) => ({
        uri: String(p.uri || ''),
        id: p.id != null ? Number(p.id) : undefined,
      })).filter((p: { uri: string }) => !!p.uri);
    } catch (e) {
      console.warn('[Gallery] listAlbumPhotos failed', e);
      return [];
    }
  },

  async getPhotoThumbnail(uri: string, maxSide = 256): Promise<string | null> {
    try {
      const native = getNative();
      if (!native || typeof native.getPhotoThumbnailBase64 !== 'function') return null;
      const thumb = native.getPhotoThumbnailBase64(uri, maxSide);
      if (thumb && String(thumb).startsWith('data:image')) return String(thumb);
    } catch (e) {
      console.warn('[Gallery] getPhotoThumbnail failed', e);
    }
    return null;
  },

  /**
   * Open Field Trace album / last photo in system viewer (swipe between album photos on most OEMs).
   * Never opens an invalid URI alone (avoids broken-image screen).
   */
  async openFieldTraceAlbum(preferLastPhoto = true): Promise<boolean> {
    try {
      const native = getNative();

      if (native && typeof native.openFieldTraceAlbum === 'function') {
        try {
          native.openFieldTraceAlbum();
          return true;
        } catch (e) {
          console.warn('[Gallery] openFieldTraceAlbum native failed', e);
        }
      }

      if (preferLastPhoto && native) {
        let uri = '';
        if (typeof native.getLatestFieldTracePhotoUri === 'function') {
          uri = String(native.getLatestFieldTracePhotoUri() || '');
        }
        if (!uri && _lastSavedPath) uri = _lastSavedPath;
        if (uri && typeof native.openUri === 'function') {
          try {
            native.openUri(uri);
            return true;
          } catch (e) {
            console.warn('[Gallery] openUri failed', e);
          }
        }
      }

      if (native && typeof native.openGallery === 'function') {
        try {
          native.openGallery();
          return true;
        } catch (e) {
          console.warn('[Gallery] openGallery failed', e);
        }
      }

      try {
        const CapApp = (window as any).Capacitor?.Plugins?.App;
        if (CapApp?.openUrl) {
          await CapApp.openUrl({ url: 'content://media/external/images/media' });
          return true;
        }
      } catch (e) {
        console.warn('[Gallery] Cap App.openUrl failed', e);
      }

      if (Capacitor.getPlatform() === 'android') {
        const intents = [
          'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_GALLERY;end',
          'intent:#Intent;action=android.intent.action.VIEW;type=image/*;end',
        ];
        for (const url of intents) {
          try {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_system';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return true;
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('[Gallery] open failed', e);
    }
    return false;
  },
};
