import ExcelJS from 'exceljs';

type MemoryEvidence = Record<string, any>;

const CATEGORY_CONFIG = [
  { id: 'NAPS', label: 'NAPS', required: 9 },
  { id: 'MUFA', label: 'MUFA', required: 9 },
  { id: 'PUNTAS_FIBRA', label: 'PUNTAS DE FIBRA', required: 2 },
  { id: 'RESERVA', label: 'RESERVAS', required: 3 },
  { id: 'ACEROS', label: 'ACEROS', required: 2 },
  { id: 'DESECHOS', label: 'DESECHOS', required: 2 },
  { id: 'ALTAS', label: 'ALTAS', required: 2 },
  { id: 'MEJORAS', label: 'MEJORAS', required: 2 },
] as const;

const clean = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || '—';
};

const safeFileName = (value: unknown) =>
  String(value || 'Proyecto')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Proyecto';

const getGroupId = (ev: MemoryEvidence, category: string) => {
  const keys: Record<string, string[]> = {
    NAPS: ['napId'],
    MUFA: ['mufaId'],
    PUNTAS_FIBRA: ['fiberPairId'],
    RESERVA: ['reserveId'],
    ACEROS: ['aceroId'],
    DESECHOS: ['desechoId'],
    ALTAS: ['altaId'],
    MEJORAS: ['mejoraId'],
  };
  const key = (keys[category] || []).find(k => ev[k]);
  return key ? String(ev[key]) : String(ev.uuid || ev.id || Math.random());
};

const getGroupNumber = (ev: MemoryEvidence, category: string) => {
  const keys: Record<string, string[]> = {
    NAPS: ['napNumber'],
    MUFA: ['mufaNumber'],
    PUNTAS_FIBRA: ['fiberPairNumber'],
    RESERVA: ['reserveNumber'],
    ACEROS: ['aceroNumber'],
    DESECHOS: ['desechoNumber'],
    ALTAS: ['altaNumber'],
    MEJORAS: ['mejoraNumber'],
  };
  const key = (keys[category] || []).find(k => ev[k] !== undefined && ev[k] !== null && ev[k] !== '');
  return Number(ev[key || '']) || 0;
};

const getGroupName = (ev: MemoryEvidence, category: string) =>
  String(
    ev.napName ||
    ev.mufaName ||
    ev.fiberPairName ||
    ev.reserveName ||
    ev.categoryLabel ||
    category
  ).trim();

const getPhotoUrl = (ev: MemoryEvidence) =>
  String(ev.photoUrl || ev.photo?.uri || '').trim();

const getDescription = (ev: MemoryEvidence, index: number, category: string) => {
  const explicit =
    ev.photoDescription ||
    ev.description ||
    ev.photo?.description ||
    ev.observacion ||
    ev.observaciones;
  return String(explicit || `${category} · FOTO ${index + 1}`).trim();
};

const STORAGE_IMAGE_PROXY_PATH = '/.netlify/functions/storage-image';

async function imageToBase64(url: string): Promise<{ base64: string; extension: 'jpeg' | 'png' }> {
  const proxyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${STORAGE_IMAGE_PROXY_PATH}?url=${encodeURIComponent(url)}`
    : url;

  let response: Response;
  try {
    response = await fetch(proxyUrl);
  } catch {
    response = await fetch(url, { mode: 'cors' });
  }

  if (!response.ok && proxyUrl !== url) {
    response = await fetch(url, { mode: 'cors' });
  }
  if (!response.ok) throw new Error(`No se pudo descargar la fotografía (${response.status})`);
  const blob = await response.blob();
  const extension = blob.type.includes('png') ? 'png' : 'jpeg';
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return { base64: `data:image/${extension};base64,${btoa(binary)}`, extension };
}

const styleHeader = (cell: ExcelJS.Cell, fill: string = '102033') => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFF' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
};

const styleLabel = (cell: ExcelJS.Cell) => {
  cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: '102033' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
};

const styleBody = (cell: ExcelJS.Cell) => {
  cell.font = { name: 'Arial', size: 8, color: { argb: '303A46' } };
  cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
};

async function addEvidenceSheet(
  workbook: ExcelJS.Workbook,
  category: typeof CATEGORY_CONFIG[number],
  project: any,
  evidences: MemoryEvidence[],
) {
  const sheet = workbook.addWorksheet(category.label);
  sheet.views = [{ showGridLines: false }];
  sheet.columns = [
    { width: 3 }, { width: 27 }, { width: 27 }, { width: 27 },
    { width: 3 },
  ];

  const groups = new Map<string, MemoryEvidence[]>();
  evidences
    .filter(ev => String(ev.category || '').toUpperCase() === category.id)
    .forEach(ev => {
      const id = getGroupId(ev, category.id);
      const list = groups.get(id) || [];
      list.push(ev);
      groups.set(id, list);
    });

  const orderedGroups = Array.from(groups.entries())
    .map(([id, items]) => ({
      id,
      items: [...items].sort((a, b) => Number(a.photoNumber ?? a.napPhotoNumber ?? a.mufaPhotoNumber ?? 0) - Number(b.photoNumber ?? b.napPhotoNumber ?? b.mufaPhotoNumber ?? 0)),
      number: getGroupNumber(items[0], category.id),
      name: getGroupName(items[0], category.id),
    }))
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));

  let row = 1;
  sheet.mergeCells(row, 2, row, 4);
  const title = sheet.getCell(row, 2);
  title.value = `MEMORIA FOTOGRÁFICA — ${category.label}`;
  styleHeader(title, '102033');
  title.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFF' } };
  sheet.getRow(row).height = 24;
  row += 1;

  sheet.mergeCells(row, 2, row, 4);
  const projectCell = sheet.getCell(row, 2);
  projectCell.value = `PROYECTO: ${clean(project?.name)}`;
  styleHeader(projectCell, '1D4E89');
  row += 1;

  if (orderedGroups.length === 0) {
    sheet.mergeCells(row, 2, row + 1, 4);
    const empty = sheet.getCell(row, 2);
    empty.value = 'NO HAY FOTOGRAFÍAS REGISTRADAS EN ESTA SECCIÓN.';
    empty.font = { name: 'Arial', size: 10, bold: true, color: { argb: '6B7280' } };
    empty.alignment = { vertical: 'middle', horizontal: 'center' };
    return;
  }

  for (const group of orderedGroups) {
    const startRow = row;
    const groupTitle = category.id === 'NAPS'
      ? `NAP ${String(group.number).padStart(2, '0')}`
      : category.id === 'MUFA'
        ? `MUFA ${String(group.number).padStart(2, '0')}`
        : `${category.label} · ${String(group.number || '').padStart(2, '0')}`;

    sheet.mergeCells(row, 2, row, 4);
    const groupCell = sheet.getCell(row, 2);
    groupCell.value = group.name && group.name !== category.label
      ? `${groupTitle} · ${group.name}`
      : groupTitle;
    styleHeader(groupCell, '3D5A80');
    row += 1;

    sheet.mergeCells(row, 2, row, 4);
    const status = sheet.getCell(row, 2);
    status.value = `${group.items.length}/${category.required} FOTOS · ${group.items.length >= category.required ? 'COMPLETO' : `FALTAN ${category.required - group.items.length}`}`;
    status.font = { name: 'Arial', size: 8, bold: true, color: { argb: group.items.length >= category.required ? '188038' : 'B7791F' } };
    row += 1;

    const imageRowStart = row;
    const imageRows = Math.ceil(category.required / 3);
    for (let r = 0; r < imageRows; r++) sheet.getRow(imageRowStart + r * 3).height = 125;
    for (let r = 0; r < imageRows; r++) sheet.getRow(imageRowStart + r * 3 + 1).height = 22;
    for (let r = 0; r < imageRows; r++) sheet.getRow(imageRowStart + r * 3 + 2).height = 5;

    for (let index = 0; index < category.required; index++) {
      const col = 2 + (index % 3);
      const blockRow = imageRowStart + Math.floor(index / 3) * 3;
      const ev = category.id === 'NAPS'
        ? group.items.find(item => Number(item.napPhotoNumber) === index + 1) || group.items[index]
        : category.id === 'MUFA'
          ? group.items.find(item => Number(item.mufaPhotoNumber) === index + 1) || group.items[index]
          : group.items[index];
      const imageCell = sheet.getCell(blockRow, col);
      imageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F5F7' } };
      imageCell.border = { top: { style: 'thin', color: { argb: 'D9DEE5' } }, left: { style: 'thin', color: { argb: 'D9DEE5' } }, bottom: { style: 'thin', color: { argb: 'D9DEE5' } }, right: { style: 'thin', color: { argb: 'D9DEE5' } } };
      imageCell.alignment = { vertical: 'middle', horizontal: 'center' };

      if (ev) {
        const url = getPhotoUrl(ev);
        if (url) {
          try {
            const image = await imageToBase64(url);
            const imageId = workbook.addImage({ base64: image.base64, extension: image.extension });
            sheet.addImage(imageId, {
              tl: { col: col - 1 + 0.04, row: blockRow - 1 + 0.04 },
              br: { col: col + 0.96, row: blockRow + 1.96 },
              editAs: 'oneCell',
            });
          } catch (error) {
            imageCell.value = 'NO SE PUDO CARGAR LA FOTO';
            imageCell.font = { name: 'Arial', size: 7, bold: true, color: { argb: 'B91C1C' } };
          }
        } else {
          imageCell.value = 'SIN FOTO';
          imageCell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'B7791F' } };
        }
      } else {
        imageCell.value = `FALTA FOTO ${index + 1}/${category.required}`;
        imageCell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'B7791F' } };
      }

      const desc = sheet.getCell(blockRow + 1, col);
      desc.value = ev ? getDescription(ev, index, category.label) : `FALTA FOTO ${index + 1}/${category.required}`;
      styleBody(desc);
      desc.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }

    row = imageRowStart + imageRows * 3 + 1;
    sheet.mergeCells(row, 2, row, 4);
    const separator = sheet.getCell(row, 2);
    separator.value = '';
    separator.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EDF2' } };
    row += 2;

    // Ensure each set starts on a fresh, predictable block.
    if (row <= startRow) row = startRow + 3;
  }
}

export async function generateMemoryExcel(project: any, evidences: MemoryEvidence[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FielTrace';
  workbook.company = 'Tentelcom del Oeste S.A.';
  workbook.created = new Date();

  for (const category of CATEGORY_CONFIG) {
    await addEvidenceSheet(workbook, category, project, evidences);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const fileName = `Memoria_Fotografica_${safeFileName(project?.name)}_${Date.now()}.xlsx`;

  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return fileName;
}
