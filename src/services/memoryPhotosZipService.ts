import { firebaseService } from './firebaseService';

type ZipEntry = {
  name: string;
  data: Uint8Array;
  crc: number;
};

const SECTION_LABELS: Record<string, string> = {
  NAPS: 'NAPS',
  MUFA: 'MUFA',
  PUNTAS_FIBRA: 'PUNTAS DE FIBRA',
  RESERVA: 'RESERVAS',
  ACEROS: 'ACEROS',
  DESECHOS: 'DESECHOS',
  ALTAS: 'ALTAS',
  MEJORAS: 'MEJORAS',
};

const sanitizeName = (value: unknown, fallback: string): string => {
  const text = String(value ?? '').trim();
  const cleaned = text
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned || fallback;
};

const normalizeCategory = (value: unknown): string => {
  const category = String(value || '').trim().toUpperCase();
  if (category === 'PUNTAS_FIBRA_INICIAL' || category === 'PUNTAS_FIBRA_FINAL') {
    return 'PUNTAS_FIBRA';
  }
  return category || 'SIN CATEGORIA';
};

const getPhotoSourceUrls = (ev: any): string[] => {
  const values = [
    ev?.photoUrl,
    ev?.photo?.uri,
    ev?.photo?.url,
    ev?.imageUrl,
    ev?.image?.url,
    ev?.storageUrl,
    ev?.url,
    ev?.photoPath,
  ];
  return Array.from(new Set(
    values
      .map(value => String(value || '').trim())
      .filter(Boolean)
  ));
};

const hasPhoto = (ev: any): boolean =>
  getPhotoSourceUrls(ev).length > 0 || Boolean(String(ev?.photoStoragePath || '').trim());

const getGroupKey = (ev: any, category: string, index: number): string => {
  if (category === 'NAPS') return String(ev?.napId || ('nap_' + (ev?.napNumber ?? 0) + '_' + (ev?.napName || '')) || index);
  if (category === 'MUFA') {
    const number = Number(ev?.mufaNumber || 0);
    const name = String(ev?.mufaName || '').trim().toUpperCase();
    const legacy = number === 0 && (!name || name === 'MUFA');
    return legacy ? 'mufa_legacy_placeholder' : String(ev?.mufaId || ('mufa_' + number + '_' + name));
  }
  if (category === 'PUNTAS_FIBRA') return String(ev?.fiberPairId || ('fiber_' + (ev?.fiberPairNumber ?? 0)) || index);
  if (category === 'RESERVA') return String(ev?.reserveId || ('reserve_' + (ev?.reserveNumber ?? 0)) || index);
  if (category === 'ACEROS') return String(ev?.aceroId || ('acero_' + (ev?.aceroNumber ?? 0)) || index);
  if (category === 'DESECHOS') return String(ev?.desechoId || ('desecho_' + (ev?.desechoNumber ?? 0)) || index);
  if (category === 'ALTAS') return String(ev?.altaId || ('alta_' + (ev?.altaNumber ?? 0)) || index);
  if (category === 'MEJORAS') return String(ev?.mejoraId || ('mejora_' + (ev?.mejoraNumber ?? 0)) || index);
  return String(ev?.uuid || ('item_' + index));
};

const getGroupNumber = (ev: any): number => Number(
  ev?.napNumber ??
  ev?.mufaNumber ??
  ev?.fiberPairNumber ??
  ev?.reserveNumber ??
  ev?.aceroNumber ??
  ev?.desechoNumber ??
  ev?.altaNumber ??
  ev?.mejoraNumber ??
  0
);

const getGroupName = (ev: any, category: string): string => {
  if (category === 'NAPS') return String(ev?.napName || '').trim();
  if (category === 'MUFA') return String(ev?.mufaName || '').trim();
  return '';
};

const getPhotoNumber = (ev: any, fallback: number): number => Number(
  ev?.napPhotoNumber ??
  ev?.mufaPhotoNumber ??
  ev?.photoNumber ??
  fallback
);

const getExtension = (response: Response, url: string): string => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('heic')) return 'heic';
  const match = url.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
  return match?.[1]?.toLowerCase() || 'jpg';
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeU16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const writeU32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value >>> 0, true);

const dosDateTime = (date = new Date()) => ({
  time: ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | Math.floor(date.getSeconds() / 2),
  date: (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f),
});

const utf8 = new TextEncoder();

const makeLocalHeader = (entry: ZipEntry, offset: number): Uint8Array => {
  const name = utf8.encode(entry.name);
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  writeU32(view, 0, 0x04034b50);
  writeU16(view, 4, 20);
  writeU16(view, 6, 0x0800);
  writeU16(view, 8, 0);
  const dt = dosDateTime();
  writeU16(view, 10, dt.time);
  writeU16(view, 12, dt.date);
  writeU32(view, 14, entry.crc);
  writeU32(view, 18, entry.data.length);
  writeU32(view, 22, entry.data.length);
  writeU16(view, 26, name.length);
  writeU16(view, 28, 0);
  header.set(name, 30);
  void offset;
  return header;
};

const makeCentralHeader = (entry: ZipEntry, localOffset: number): Uint8Array => {
  const name = utf8.encode(entry.name);
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);
  writeU32(view, 0, 0x02014b50);
  writeU16(view, 4, 20);
  writeU16(view, 6, 20);
  writeU16(view, 8, 0x0800);
  writeU16(view, 10, 0);
  const dt = dosDateTime();
  writeU16(view, 12, dt.time);
  writeU16(view, 14, dt.date);
  writeU32(view, 16, entry.crc);
  writeU32(view, 20, entry.data.length);
  writeU32(view, 24, entry.data.length);
  writeU16(view, 28, name.length);
  writeU16(view, 30, 0);
  writeU16(view, 32, 0);
  writeU16(view, 34, 0);
  writeU16(view, 36, 0);
  writeU32(view, 38, 0);
  writeU32(view, 42, localOffset);
  header.set(name, 46);
  return header;
};

const makeEndRecord = (entryCount: number, centralSize: number, centralOffset: number): Uint8Array => {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  writeU32(view, 0, 0x06054b50);
  writeU16(view, 4, 0);
  writeU16(view, 6, 0);
  writeU16(view, 8, entryCount);
  writeU16(view, 10, entryCount);
  writeU32(view, 12, centralSize);
  writeU32(view, 16, centralOffset);
  writeU16(view, 20, 0);
  return end;
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const resolvePhotoUrls = async (ev: any): Promise<string[]> => {
  const urls: string[] = [];
  const add = (value: unknown) => {
    const url = String(value || '').trim();
    if (url && !urls.includes(url)) urls.push(url);
  };

  // Usar exactamente las mismas fuentes que el exportador de Excel.
  // Algunas evidencias históricas no tienen photoUrl, pero sí imageUrl,
  // storageUrl, url o photoPath con la URL real.
  getPhotoSourceUrls(ev).forEach(add);

  const storagePath = String(ev?.photoStoragePath || '').trim();
  if (storagePath && !storagePath.startsWith('http')) {
    try {
      add(await firebaseService.getEvidencePhotoUrl(storagePath));
    } catch (error) {
      console.warn('[Memory ZIP] No se pudo renovar la URL de Storage:', {
        storagePath,
        error,
      });
    }
  }

  if (!urls.length) {
    throw new Error('La fotografía no tiene una URL ni una ruta de Storage válida.');
  }

  return urls;
};

const extractStoragePathFromUrl = (value: unknown): string[] => {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const candidates: string[] = [];

  // Firebase Storage download URLs use:
  // .../o/<URL-encoded-storage-path>?alt=media&token=...
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/o\/(.+)$/);
    if (match?.[1]) {
      candidates.push(decodeURIComponent(match[1]));
    }
  } catch {
    // Puede ser una URL antigua/mal formada; seguimos con los formatos conocidos.
  }

  // Compatibilidad con referencias gs://bucket/path.
  if (raw.startsWith('gs://')) {
    const withoutScheme = raw.slice(5);
    const slash = withoutScheme.indexOf('/');
    if (slash > 0) candidates.push(withoutScheme.slice(slash + 1));
  }

  return candidates.filter(Boolean);
};

const getStoragePathCandidates = (ev: any): string[] => {
  const candidates: string[] = [];
  const add = (value: unknown) => {
    const path = String(value || '').trim();
    if (path && !candidates.includes(path)) candidates.push(path);
  };

  // PRIORIDAD MÁXIMA: si cualquier campo contiene la URL real que utiliza
  // Memoria Fotográfica/Excel, extraemos de ella la ruta exacta del objeto.
  // Esto cubre también evidencias históricas con imageUrl/storageUrl/url.
  for (const url of getPhotoSourceUrls(ev)) {
    extractStoragePathFromUrl(url).forEach(add);
  }

  add(ev?.photoStoragePath);

  const projectUuid = String(ev?.projectUuid || '').trim();
  const evidenceUuid = String(ev?.uuid || '').trim();
  const rawFileName = String(
    ev?.photoPath ||
    ev?.photo?.fileName ||
    (evidenceUuid ? `FT_${evidenceUuid}` : '')
  ).trim();

  if (projectUuid && evidenceUuid && rawFileName) {
    // Mismo saneamiento usado por uploadEvidencePhoto().
    const safeName = rawFileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.(jpeg|jpg|png)$/i, '');

    const mime = String(ev?.photo?.mimeType || '').toLowerCase();
    const preferredExtension = mime.includes('png') ? 'png' : 'jpg';

    add(`projects/${projectUuid}/evidences/${evidenceUuid}/${safeName}.${preferredExtension}`);
    add(`projects/${projectUuid}/evidences/${evidenceUuid}/${safeName}.jpg`);
    add(`projects/${projectUuid}/evidences/${evidenceUuid}/${safeName}.png`);

    // Compatibilidad con fotografías históricas que pudieron quedar con
    // extensión duplicada por la normalización anterior.
    add(`projects/${projectUuid}/evidences/${evidenceUuid}/${safeName}.${preferredExtension}${preferredExtension}`);
    add(`projects/${projectUuid}/evidences/${evidenceUuid}/${safeName}.${preferredExtension}.${preferredExtension}`);
  }

  return candidates;
};

const getPhotoExtensionFromEvidence = (ev: any): 'jpg' | 'png' | 'webp' | 'heic' => {
  const mime = String(ev?.photo?.mimeType || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic')) return 'heic';

  const name = String(ev?.photoPath || ev?.photo?.fileName || '').toLowerCase();
  if (/\.png$/i.test(name)) return 'png';
  if (/\.webp$/i.test(name)) return 'webp';
  if (/\.heic$/i.test(name)) return 'heic';
  return 'jpg';
};

const describeFirebaseError = (error: any): string => {
  if (!error) return 'Error desconocido';
  const code = String(error?.code || '').trim();
  const message = String(error?.message || error || '').trim();
  return [code, message].filter(Boolean).join(' | ') || 'Error desconocido';
};

const getEvidenceDiagnosticLabel = (ev: any): string => {
  const category = normalizeCategory(ev?.category);
  const number = getGroupNumber(ev);
  const photoNumber = getPhotoNumber(ev, 0);
  const name = getGroupName(ev, category);
  return [
    category,
    number ? `SET ${String(number).padStart(2, '0')}` : '',
    name ? `NOMBRE: ${name}` : '',
    photoNumber ? `FOTO ${String(photoNumber).padStart(2, '0')}` : '',
    ev?.uuid ? `EVIDENCIA: ${ev.uuid}` : '',
  ].filter(Boolean).join(' · ');
};

const downloadPhotoBytes = async (ev: any): Promise<{ bytes: Uint8Array; extension: string }> => {
  const storagePaths = getStoragePathCandidates(ev);
  const storageErrors: string[] = [];

  // Primera opción: SDK autenticado. Esto evita CORS y URLs de descarga
  // antiguas que pueden responder 403.
  for (const storagePath of storagePaths) {
    try {
      const bytes = await firebaseService.getEvidencePhotoBytes(storagePath);
      console.log('[Memory ZIP] Storage OK:', {
        evidence: ev?.uuid || '',
        path: storagePath,
        bytes: bytes.byteLength,
      });
      return { bytes, extension: getPhotoExtensionFromEvidence(ev) };
    } catch (error: any) {
      const detail = `${storagePath} => ${describeFirebaseError(error)}`;
      storageErrors.push(detail);
      console.warn('[Memory ZIP] Falló getBytes():', detail);
    }
  }

  // Compatibilidad con evidencias que solo conservan photoUrl.
  try {
    const response = await fetchPhotoResponse(ev);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, extension: getExtension(response, response.url) };
  } catch (error: any) {
    const urlError = describeFirebaseError(error);
    const diagnostic = [
      'No se pudo descargar una fotografía para el ZIP.',
      getEvidenceDiagnosticLabel(ev),
      `URLS DE FOTO DETECTADAS: ${getPhotoSourceUrls(ev).length ? getPhotoSourceUrls(ev).join(' || ') : 'NINGUNA'}`,
      `RUTAS STORAGE PROBADAS: ${storagePaths.length ? storagePaths.join(' || ') : 'NINGUNA'}`,
      `ERRORES STORAGE: ${storageErrors.length ? storageErrors.join(' || ') : 'NINGUNO'}`,
      `URL/PROXY: ${urlError}`,
    ].join(' | ');

    console.error('[Memory ZIP] DIAGNÓSTICO DE DESCARGA:', {
      label: getEvidenceDiagnosticLabel(ev),
      storagePaths,
      storageErrors,
      urlError,
      photoUrl: ev?.photoUrl || '',
      photoStoragePath: ev?.photoStoragePath || '',
      projectUuid: ev?.projectUuid || '',
      evidenceUuid: ev?.uuid || '',
    });

    throw new Error(diagnostic);
  }
};

const fetchPhotoResponse = async (ev: any): Promise<Response> => {
  const urls = await resolvePhotoUrls(ev);
  let lastStatus = 0;
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const direct = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (direct.ok) return direct;
      lastStatus = direct.status;

      // Igual que el exportador de Excel: si Firebase bloquea la descarga
      // directa (por ejemplo 403), usamos el proxy de Storage de Netlify.
      if (typeof window !== 'undefined') {
        const proxyUrl = `${window.location.origin}/.netlify/functions/storage-image?url=${encodeURIComponent(url)}`;
        const proxied = await fetch(proxyUrl, { cache: 'no-store' });
        if (proxied.ok) return proxied;
        lastStatus = proxied.status;
      }
    } catch (error) {
      lastError = error;

      if (typeof window !== 'undefined') {
        try {
          const proxyUrl = `${window.location.origin}/.netlify/functions/storage-image?url=${encodeURIComponent(url)}`;
          const proxied = await fetch(proxyUrl, { cache: 'no-store' });
          if (proxied.ok) return proxied;
          lastStatus = proxied.status;
        } catch (proxyError) {
          lastError = proxyError;
        }
      }
    }
  }

  if (lastStatus) {
    throw new Error(`HTTP ${lastStatus} en descarga directa/proxy${lastError instanceof Error ? ` | ${lastError.message}` : ''}`);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('No se pudo descargar una fotografía: error de red desconocido.');
};

export async function generateMemoryPhotosZip(
  project: any,
  evidences: any[],
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  const projectName = sanitizeName(project?.name, 'PROYECTO');
  const photoEvidences = evidences.filter(hasPhoto);

  if (!photoEvidences.length) {
    throw new Error('Este proyecto no tiene fotografías disponibles para descargar.');
  }

  const groups = new Map<string, any[]>();
  photoEvidences.forEach((ev, index) => {
    const category = normalizeCategory(ev?.category);
    const key = category + '::' + getGroupKey(ev, category, index);
    const list = groups.get(key) || [];
    list.push(ev);
    groups.set(key, list);
  });

  const orderedGroups = Array.from(groups.entries())
    .map(([key, items]) => {
      const category = key.split('::', 1)[0];
      return {
        key,
        category,
        items: [...items].sort((a, b) => getPhotoNumber(a, 0) - getPhotoNumber(b, 0)),
        number: getGroupNumber(items[0]),
        name: getGroupName(items[0], category),
      };
    })
    .sort((a, b) => {
      const categoryCompare = a.category.localeCompare(b.category);
      return categoryCompare || a.number - b.number || a.key.localeCompare(b.key);
    });

  const entries: ZipEntry[] = [];
  const usedNames = new Set<string>();
  let completed = 0;

  // Las fotografías se descargan como bytes originales. No se redimensionan,
  // recomprimen ni convierten; el ZIP conserva exactamente el archivo remoto.
  for (const group of orderedGroups) {
    const section = sanitizeName(SECTION_LABELS[group.category] || group.category, 'SIN CATEGORIA');
    const groupLabel = group.category === 'NAPS'
      ? `NAP ${String(group.number || 0).padStart(2, '0')}${group.name ? ' - ' + sanitizeName(group.name, '') : ''}`
      : group.category === 'MUFA'
        ? `MUFA ${String(group.number || 0).padStart(2, '0')}${group.name ? ' - ' + sanitizeName(group.name, '') : ''}`
        : `SET ${String(group.number || 0).padStart(2, '0')}`;

    const groupFolder = sanitizeName(groupLabel, 'SET');
    // Estructura: SECCIÓN / NOMBRE DEL SET (o NAP/MUFA) / SET XX / fotografías.
    // Esto evita mezclar sets cuando un proyecto contiene múltiples registros.
    const setFolder = `SET ${String(group.number || 0).padStart(2, '0')}`;
    const folder = `${section}/${groupFolder}/${setFolder}`;

    for (let index = 0; index < group.items.length; index++) {
      const ev = group.items[index];
      const downloaded = await downloadPhotoBytes(ev);
      const bytes = downloaded.bytes;
      const extension = downloaded.extension;
      const photoNumber = getPhotoNumber(ev, index + 1);
      const fileBase = `${String(photoNumber).padStart(2, '0')}`;
      const photoName = `${folder}/${fileBase}.${extension}`;

      let uniqueName = photoName;
      let suffix = 2;
      while (usedNames.has(uniqueName)) {
        uniqueName = `${folder}/${fileBase} (${suffix++}).${extension}`;
      }
      usedNames.add(uniqueName);

      entries.push({ name: uniqueName, data: bytes, crc: crc32(bytes) });
      completed++;
      onProgress?.(completed, photoEvidences.length);
    }
  }

  // Se usa ZIP sin compresión: las fotos ya están comprimidas (JPG/WEBP),
  // por lo que recomprimirlas solo consumiría CPU y memoria sin mejorar
  // significativamente el tamaño. La calidad/bytes originales se conservan.
  const parts: BlobPart[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const localHeader = makeLocalHeader(entry, offset);
    parts.push(localHeader, entry.data);
    centralParts.push(makeCentralHeader(entry, offset));
    offset += localHeader.length + entry.data.length;
  }

  let centralOffset = offset;
  let centralSize = 0;
  for (const central of centralParts) {
    parts.push(central);
    centralSize += central.length;
  }

  parts.push(makeEndRecord(entries.length, centralSize, centralOffset));
  const blob = new Blob(parts, { type: 'application/zip' });
  triggerDownload(blob, `${projectName} - FOTOS.zip`);
}
