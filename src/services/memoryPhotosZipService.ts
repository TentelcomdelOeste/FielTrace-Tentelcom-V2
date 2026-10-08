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

const hasPhoto = (ev: any): boolean =>
  Boolean(String(ev?.photoUrl || ev?.photo?.uri || ev?.photo?.url || ev?.photoStoragePath || '').trim());

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
  const match = url.match(/\\.([a-z0-9]{2,5})(?:[?#]|$)/i);
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

const resolvePhotoUrl = async (ev: any): Promise<string> => {
  const direct = String(ev?.photoUrl || ev?.photo?.uri || ev?.photo?.url || '').trim();
  if (direct) return direct;
  const storagePath = String(ev?.photoStoragePath || '').trim();
  if (storagePath) return firebaseService.getEvidencePhotoUrl(storagePath);
  throw new Error('La fotografía no tiene una URL ni una ruta de Storage válida.');
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
    const folder = `${section}/${groupFolder}`;

    for (let index = 0; index < group.items.length; index++) {
      const ev = group.items[index];
      const url = await resolvePhotoUrl(ev);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`No se pudo descargar una fotografía (${response.status}).`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const extension = getExtension(response, url);
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
