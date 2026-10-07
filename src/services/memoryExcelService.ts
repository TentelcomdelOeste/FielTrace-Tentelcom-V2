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

const getGroupName = (ev: MemoryEvidence, category: string) => {
  const value = ev.napName || ev.mufaName || ev.fiberPairName || ev.reserveName || ev.categoryLabel || category;
  return String(value ?? '').trim() || '—';
};

const getPhotoUrl = (ev: MemoryEvidence) =>
  String(
    ev.photoUrl ||
    ev.photo?.uri ||
    ev.photo?.url ||
    ev.imageUrl ||
    ev.image?.url ||
    ev.storageUrl ||
    ev.url ||
    ev.photoPath ||
    ''
  ).trim();

// Las puntas se guardan en Firebase como dos subcategorías (INICIAL/FINAL),
// pero en Memoria Fotográfica representan un único set de 2 fotografías.
const normalizeMemoryCategory = (category: unknown) => {
  const value = String(category || '').toUpperCase();
  return value === 'PUNTAS_FIBRA_INICIAL' || value === 'PUNTAS_FIBRA_FINAL'
    ? 'PUNTAS_FIBRA'
    : value;
};

const NAPS_PHOTO_TITLES = [
  'FUSIÓN REALIZADA',
  'RESERVA DE HILOS',
  'ETIQUETAS INTERNAS',
  'ETIQUETA ORIGEN',
  'ETIQUETA EXTREMO',
  'RESERVA DE BUFFER',
  'DETALLADO',
  'PUNTA INICIO',
  'PUNTA FINAL',
] as const;

const getNapsPhotoTitle = (ev: MemoryEvidence, index: number) => {
  const slot = Number(ev.napPhotoNumber ?? ev.photoNumber ?? index + 1);
  const title = NAPS_PHOTO_TITLES[slot - 1] || ('FOTO ' + slot);
  const napName = String(ev.napName ?? '').trim();
  return napName
    ? title + ' NAP ' + napName.toUpperCase()
    : title + ' NAP';
};

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

// Excel no necesita la resolución completa de una foto de cámara.
// Las imágenes se optimizan individualmente antes de entrar al workbook.
// Esto evita mantener en memoria los archivos originales gigantes y reduce
// drásticamente el peso final del XLSX sin modificar las fotos originales
// almacenadas en Firebase.
const EXCEL_MAX_IMAGE_WIDTH = 2000;
const EXCEL_MAX_IMAGE_HEIGHT = 1500;
const EXCEL_JPEG_QUALITY = 0.90;
// Excel drawing units: 9,525 EMU por píxel a 96 DPI.
const EMU_PER_PIXEL = 9525;
const EXCEL_DEFAULT_COL_WIDTH = 9.14285714285714;
const EXCEL_DEFAULT_ROW_HEIGHT_PT = 15;
const EXCEL_DEFAULT_COL_EMU = 640000;
const EXCEL_DEFAULT_ROW_EMU = 180000;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo convertir la fotografía optimizada.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Error leyendo la fotografía optimizada.'));
    reader.readAsDataURL(blob);
  });

async function imageToBase64(
  url: string,
): Promise<{ base64: string; extension: 'jpeg'; width: number; height: number }> {
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

  const sourceBlob = await response.blob();

  let source: CanvasImageSource | null = null;
  let sourceWidth = 0;
  let sourceHeight = 0;
  let objectUrl = '';

  try {
    if (typeof createImageBitmap !== 'undefined') {
      const bitmap = await createImageBitmap(sourceBlob);
      source = bitmap;
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
    } else if (typeof document !== 'undefined') {
      objectUrl = URL.createObjectURL(sourceBlob);
      const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('No se pudo decodificar la fotografía.'));
        image.src = objectUrl;
      });
      source = imageElement;
      sourceWidth = imageElement.naturalWidth;
      sourceHeight = imageElement.naturalHeight;
    }
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }

  if (!source || !sourceWidth || !sourceHeight) {
    throw new Error('El navegador no pudo procesar la fotografía.');
  }

  const scale = Math.min(
    1,
    EXCEL_MAX_IMAGE_WIDTH / sourceWidth,
    EXCEL_MAX_IMAGE_HEIGHT / sourceHeight,
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      source.close();
    }
    throw new Error('El navegador no pudo crear el procesador de imágenes.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    source.close();
  }

  const optimizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('No se pudo comprimir la fotografía para Excel.')),
      'image/jpeg',
      EXCEL_JPEG_QUALITY,
    );
  });

  // Liberar la memoria del canvas inmediatamente. El Blob optimizado es mucho
  // menor que el original y es el único recurso que necesitamos convertir.
  canvas.width = 1;
  canvas.height = 1;

  const base64 = await blobToDataUrl(optimizedBlob);

  return {
    base64,
    extension: 'jpeg',
    width,
    height,
  };
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

const DATA_SHEET_LABELS = [
  'País/Div:',
  'Área/Cd:',
  'Nom. Proy.:',
  'Producto:',
  'Nombre del Supervisor/Insp.:',
  'Nombre del Contratista:',
  'Fecha Inicio:',
  'Fecha Fin:',
  'Identificación (OB; DTTO; ID; OT; SISA):',
] as const;

const normalizeKey = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const getCustomProjectValue = (project: any, aliases: string[]) => {
  const fields = Array.isArray(project?.customFields) ? project.customFields : [];
  const wanted = aliases.map(normalizeKey);
  const field = fields.find((item: any) => wanted.includes(normalizeKey(item?.name)));
  return field?.value ?? '';
};

const getProjectDataValue = (project: any, key: typeof DATA_SHEET_LABELS[number]) => {
  // Valores fijos solicitados para la plantilla ESPH.
  // Se resuelven antes de customFields para que ningún dato anterior
  // sobrescriba estos valores por accidente.
  if (key === 'País/Div:') return 'COSTA RICA';
  if (key === 'Producto:') return 'REDES FO';
  if (key === 'Nombre del Supervisor/Insp.:') return '';
  if (key === 'Nombre del Contratista:') return 'ESPH';

  const aliases: Record<string, string[]> = {
    'País/Div:': ['pais', 'paisdiv', 'paisdivision', 'country'],
    'Área/Cd:': ['area', 'areacd', 'areaciudad', 'canton', 'distrito', 'areacd'],
    'Nom. Proy.:': ['nomproy', 'nombreproyecto', 'proyecto', 'projectname'],
    'Producto:': ['producto', 'product', 'tipo'],
    'Nombre del Supervisor/Insp.:': ['supervisor', 'inspectorsupervisor', 'inspector', 'nombredelsupervisorinsp', 'nombredelsupervisor', 'nombre del inspector'],
    'Nombre del Contratista:': ['contratista', 'cliente', 'contractor', 'nombredelcontratista'],
    'Fecha Inicio:': ['fechainicio', 'inicio', 'startdate', 'fechadeinicio'],
    'Fecha Fin:': ['fechafin', 'fin', 'enddate', 'fechadefin'],
    'Identificación (OB; DTTO; ID; OT; SISA):': ['identificacion', 'identificacionobdtt oidotsisa', 'identificacionobdtt oidotsisa', 'identificacionobdttoidotsisa', 'ob', 'dtto', 'id', 'ot', 'sisa'],
  };

  const custom = getCustomProjectValue(project, aliases[key] || [key]);
  if (String(custom).trim()) return String(custom).trim();

  switch (key) {
    case 'Nom. Proy.':
      return String(project?.name ?? '').trim();
    case 'Nombre del Supervisor/Insp.:':
      return '';
    default:
      return '';
  }
};

const addDataSheet = (workbook: ExcelJS.Workbook, project: any) => {
  const sheet = workbook.addWorksheet('Datos');
  sheet.views = [{ showGridLines: false }];

  sheet.columns = [
    { width: 3 },
    { width: 48 },
    { width: 72 },
  ];

  sheet.mergeCells('B1:C1');
  const title = sheet.getCell('D1');
  title.value = 'MEMORIA FOTOGRÁFICA — ESPH';
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '102033' } };
  title.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFF' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell('D1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getCell('E1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getCell('F1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getCell('G1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getCell('H1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getRow(1).height = 42;

  sheet.mergeCells('B2:C2');
  const subtitle = sheet.getCell('B2');
  subtitle.value = 'DATOS DEL PROYECTO  ·  FR-PE-15  REV. 02';
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '102033' } };
  subtitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFF' } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell('D2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getCell('E2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getCell('F2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getCell('G2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getCell('H2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  sheet.getRow(2).height = 34;

  sheet.getRow(3).height = 18;

  sheet.mergeCells('B4:C4');
  const section = sheet.getCell('B4');
  section.value = 'DATOS:';
  section.font = { name: 'Arial', size: 16, bold: true, color: { argb: '000000' } };
  section.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(4).height = 30;

  sheet.getRow(5).height = 18;

  DATA_SHEET_LABELS.forEach((label, index) => {
    const row = 6 + index;
    const labelCell = sheet.getCell(row, 2);
    const valueCell = sheet.getCell(row, 3);
    const value = getProjectDataValue(project, label);

    labelCell.value = label;
    labelCell.font = { name: 'Arial', size: 11, color: { argb: '222222' } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'right' };

    valueCell.value = value;
    valueCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: '000000' } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF3F7' } };

    sheet.getRow(row).height = row === 14 ? 34 : 27;
  });

  for (let row = 6; row <= 14; row++) {
    sheet.getCell(row, 2).border = {
      bottom: { style: 'hair', color: { argb: 'D9DEE5' } },
    };
    sheet.getCell(row, 3).border = {
      bottom: { style: 'hair', color: { argb: 'D9DEE5' } },
    };
  }

  return sheet;
};

const getFiberGroupEvidence = (items: MemoryEvidence[]) => {
  const rank = (ev: MemoryEvidence) =>
    ev.fiberSide === 'initial' ? 1 : ev.fiberSide === 'final' ? 2 : Number(ev.photoNumber) || 99;
  const sorted = [...items].sort((a, b) => rank(a) - rank(b));
  return {
    initial: sorted.find(ev => ev.fiberSide === 'initial') || sorted[0],
    final: sorted.find(ev => ev.fiberSide === 'final') || sorted[1],
  };
};

const applyFiberStyleHeaderToSheet = (sheet: ExcelJS.Worksheet, project: any) => {
  // Copia visual exacta del encabezado actualmente utilizado por PUNTAS DE FIBRA.
  sheet.columns = [
    { width: 3 }, { width: 15 }, { width: 15 }, { width: 15 },
    { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
    { width: 15 }, { width: 15 }, { width: 11 },
  ];

  const data = (key: typeof DATA_SHEET_LABELS[number]) => getProjectDataValue(project, key);

  sheet.mergeCells('D1:H1');
  const title = sheet.getCell('D1');
  title.value = 'MEMORIA FOTOGRÁFICA';
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  title.font = { name: 'Arial', size: 18, color: { argb: 'FFFFFF' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 30;

  sheet.mergeCells('D2:H2');
  const product = sheet.getCell('D2');
  product.value = 'Redes FO';
  product.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  product.font = { name: 'Arial', size: 13, color: { argb: 'FFFFFF' } };
  product.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 30;

  for (let r = 1; r <= 2; r++) {
    for (let col = 9; col <= 10; col++) {
      sheet.getCell(r, col).border = {
        top: r === 1 ? { style: 'thin', color: { argb: '222222' } } : undefined,
        bottom: r === 2 ? { style: 'thin', color: { argb: '222222' } } : undefined,
        left: col === 9 ? { style: 'thin', color: { argb: '222222' } } : undefined,
        right: col === 10 ? { style: 'thin', color: { argb: '222222' } } : undefined,
      };
    }
  }
  sheet.getCell('I1').value = 'FR-PE-15';
  sheet.getCell('I1').font = { name: 'Arial', size: 12, bold: true };
  sheet.getCell('I1').alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell('J1').value = 'REV. 02';
  sheet.getCell('J1').font = { name: 'Arial', size: 12, bold: true };
  sheet.getCell('J1').alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.mergeCells('I1:I2');
  sheet.mergeCells('J1:J2');
  sheet.getCell('I1').alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell('J1').alignment = { vertical: 'middle', horizontal: 'center' };

  for (let row = 1; row <= 2; row++) {
    sheet.getCell(row, 9).border = {
      ...sheet.getCell(row, 9).border,
      left: { style: 'thin', color: { argb: '222222' } },
    };
    sheet.getCell(row, 10).border = {
      ...sheet.getCell(row, 10).border,
      right: { style: 'thin', color: { argb: '222222' } },
    };
  }
  sheet.getCell('B1').border = {
    ...sheet.getCell('B1').border,
    left: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('B2').border = {
    ...sheet.getCell('B2').border,
    left: { style: 'thin', color: { argb: '222222' } },
    bottom: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('C2').border = {
    ...sheet.getCell('C2').border,
    bottom: { style: 'thin', color: { argb: '222222' } },
  };

  for (let col = 4; col <= 10; col++) {
    sheet.getCell(1, col).border = {
      ...sheet.getCell(1, col).border,
      top: { style: 'thin', color: { argb: '222222' } },
    };
    sheet.getCell(2, col).border = {
      ...sheet.getCell(2, col).border,
      bottom: { style: 'thin', color: { argb: '222222' } },
    };
  }
  sheet.getRow(3).height = 8;

  sheet.mergeCells('B5:D5');
  const section = sheet.getCell('B5');
  section.value = 'DATOS DE LA OBRA:';
  section.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  section.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  section.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(5).height = 24;

  for (let col = 2; col <= 10; col++) {
    sheet.getCell(5, col).border = {
      ...sheet.getCell(5, col).border,
      top: { style: 'thin', color: { argb: '222222' } },
    };
    sheet.getCell(9, col).border = {
      ...sheet.getCell(9, col).border,
      bottom: { style: 'thin', color: { argb: '222222' } },
    };
  }
  for (let row = 5; row <= 9; row++) {
    sheet.getCell(row, 2).border = {
      ...sheet.getCell(row, 2).border,
      left: { style: 'thin', color: { argb: '222222' } },
    };
    sheet.getCell(row, 10).border = {
      ...sheet.getCell(row, 10).border,
      right: { style: 'thin', color: { argb: '222222' } },
    };
  }

  const topRows: Array<{
    labelRange: string;
    label: string;
    valueRange: string;
    dataLabel: typeof DATA_SHEET_LABELS[number];
  }> = [
    { labelRange: 'B6:B6', label: 'País/Div:', valueRange: 'C6:C6', dataLabel: 'País/Div:' },
    { labelRange: 'B7:C7', label: 'Nombre del Supervisor/Insp.:', valueRange: 'D7:E7', dataLabel: 'Nombre del Supervisor/Insp.:' },
    { labelRange: 'B8:C8', label: 'Nombre del Contratista:', valueRange: 'D8:E8', dataLabel: 'Nombre del Contratista:' },
    { labelRange: 'D6:D6', label: 'Área/Cd:', valueRange: 'E6:E6', dataLabel: 'Área/Cd:' },
    { labelRange: 'F6:F6', label: 'Nom. Proy.:', valueRange: 'G6:G6', dataLabel: 'Nom. Proy.:' },
    { labelRange: 'H6:H6', label: 'Producto:', valueRange: 'I6:I6', dataLabel: 'Producto:' },
    { labelRange: 'H7:H7', label: 'Fecha Inicio:', valueRange: 'I7:J7', dataLabel: 'Fecha Inicio:' },
    { labelRange: 'H8:H8', label: 'Fecha Fin:', valueRange: 'I8:J8', dataLabel: 'Fecha Fin:' },
  ];

  sheet.mergeCells('F5:H5');
  const identificationLabel = sheet.getCell('F5');
  identificationLabel.value = 'Identificación (OB; DTTO; ID; OT; SISA):';
  identificationLabel.font = { name: 'Calibri', size: 11, color: { argb: '222222' } };
  identificationLabel.alignment = { vertical: 'middle', horizontal: 'right' };

  sheet.mergeCells('I5:J5');
  const identificationValue = sheet.getCell('I5');
  identificationValue.value = { formula: 'Datos!C14', result: data('Identificación (OB; DTTO; ID; OT; SISA:') };
  identificationValue.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '111111' } };
  identificationValue.alignment = { vertical: 'middle', horizontal: 'left' };
  identificationValue.border = { bottom: { style: 'thin', color: { argb: '444444' } } };

  for (const item of topRows) {
    sheet.mergeCells(item.labelRange);
    sheet.mergeCells(item.valueRange);
    const labelCell = sheet.getCell(item.labelRange.split(':')[0]);
    labelCell.value = item.label;
    labelCell.font = { name: 'Calibri', size: 11, color: { argb: '222222' } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    const dataIndex = DATA_SHEET_LABELS.indexOf(item.dataLabel);
    const dataRow = dataIndex >= 0 ? dataIndex + 6 : 6;
    const valueCell = sheet.getCell(item.valueRange.split(':')[0]);
    valueCell.value = { formula: 'Datos!C' + dataRow, result: data(item.dataLabel) };
    valueCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '111111' } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
    valueCell.border = { bottom: { style: 'thin', color: { argb: '444444' } } };
  }

  sheet.getCell('I5').border = {
    ...sheet.getCell('I5').border,
    top: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('J5').border = {
    ...sheet.getCell('J5').border,
    top: { style: 'thin', color: { argb: '222222' } },
    right: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('J7').border = {
    ...sheet.getCell('J7').border,
    right: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('J8').border = {
    ...sheet.getCell('J8').border,
    right: { style: 'thin', color: { argb: '222222' } },
  };

  for (let r = 5; r <= 8; r++) sheet.getRow(r).height = 21;
  sheet.getRow(9).height = 8;
  sheet.getRow(10).height = 8;
};

const addFiberTipsSheet = async (
  workbook: ExcelJS.Workbook,
  project: any,
  evidences: MemoryEvidence[],
) => {
  const sheet = workbook.addWorksheet('PUNTAS DE FIBRA');
  sheet.views = [{ showGridLines: false }];

  // Plantilla compacta: no se reservan columnas completas como separadores.
  // B:D = datos de fibra, E:G = punta inicial, H:J = punta final.
  sheet.columns = [
    { width: 3 }, { width: 15 }, { width: 15 }, { width: 15 },
    { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 },
    { width: 15 }, { width: 15 }, { width: 11 },
  ];

  const data = (key: typeof DATA_SHEET_LABELS[number]) => getProjectDataValue(project, key);

  sheet.mergeCells('D1:H1');
  const title = sheet.getCell('D1');
  title.value = 'MEMORIA FOTOGRÁFICA';
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  title.font = { name: 'Arial', size: 18, color: { argb: 'FFFFFF' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 30;

  sheet.mergeCells('D2:H2');
  const product = sheet.getCell('D2');
  product.value = 'Redes FO';
  product.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  product.font = { name: 'Arial', size: 13, color: { argb: 'FFFFFF' } };
  product.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 30;

  // Recuadro superior derecho de la plantilla: I:J.
  for (let r = 1; r <= 2; r++) {
    for (let col = 9; col <= 10; col++) {
      sheet.getCell(r, col).border = {
        top: r === 1 ? { style: 'thin', color: { argb: '222222' } } : undefined,
        bottom: r === 2 ? { style: 'thin', color: { argb: '222222' } } : undefined,
        left: col === 9 ? { style: 'thin', color: { argb: '222222' } } : undefined,
        right: col === 10 ? { style: 'thin', color: { argb: '222222' } } : undefined,
      };
    }
  }
  sheet.getCell('I1').value = 'FR-PE-15';
  sheet.getCell('I1').font = { name: 'Arial', size: 12, bold: true };
  sheet.getCell('I1').alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell('J1').value = 'REV. 02';
  sheet.getCell('J1').font = { name: 'Arial', size: 12, bold: true };
  sheet.getCell('J1').alignment = { vertical: 'middle', horizontal: 'center' };
  // En PUNTAS DE FIBRA, cada código ocupa una sola casilla vertical:
  // I1:I2 y J1:J2.
  sheet.mergeCells('I1:I2');
  sheet.mergeCells('J1:J2');
  sheet.getCell('I1').alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell('J1').alignment = { vertical: 'middle', horizontal: 'center' };


  // Marco del bloque vertical I1:I2 y J1:J2 después de combinar las celdas.
  for (let row = 1; row <= 2; row++) {
    sheet.getCell(row, 9).border = {
      ...sheet.getCell(row, 9).border,
      left: { style: 'thin', color: { argb: '222222' } },
    };
    sheet.getCell(row, 10).border = {
      ...sheet.getCell(row, 10).border,
      right: { style: 'thin', color: { argb: '222222' } },
    };
  }
  // Bordes del tramo izquierdo del encabezado, según la plantilla:
  // B1 y B2 forman el lateral izquierdo; B2:C2 forman el borde inferior
  // del espacio en blanco que precede al bloque D:H.
  sheet.getCell('B1').border = {
    ...sheet.getCell('B1').border,
    left: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('B2').border = {
    ...sheet.getCell('B2').border,
    left: { style: 'thin', color: { argb: '222222' } },
    bottom: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('C2').border = {
    ...sheet.getCell('C2').border,
    bottom: { style: 'thin', color: { argb: '222222' } },
  };

  // Marco superior de referencia: D:H (título) + I:J (código/revisión).
  for (let col = 4; col <= 10; col++) {
    sheet.getCell(1, col).border = {
      ...sheet.getCell(1, col).border,
      top: { style: 'thin', color: { argb: '222222' } },
    };
    sheet.getCell(2, col).border = {
      ...sheet.getCell(2, col).border,
      bottom: { style: 'thin', color: { argb: '222222' } },
    };
  }
  sheet.getRow(3).height = 8;

  sheet.mergeCells('B5:D5');
  const section = sheet.getCell('B5');
  section.value = 'DATOS DE LA OBRA:';
  section.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
  section.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  section.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(5).height = 24;
  // Marco exterior completo del bloque DATOS DE LA OBRA.
  // Se dibuja sobre las celdas perimetrales para que el borde también
  // atraviese correctamente las zonas combinadas F5:H5 e I5:J5.
  for (let col = 2; col <= 10; col++) {
    sheet.getCell(5, col).border = {
      ...sheet.getCell(5, col).border,
      top: { style: 'thin', color: { argb: '222222' } },
    };
    sheet.getCell(9, col).border = {
      ...sheet.getCell(9, col).border,
      bottom: { style: 'thin', color: { argb: '222222' } },
    };
  }
  for (let row = 5; row <= 9; row++) {
    sheet.getCell(row, 2).border = {
      ...sheet.getCell(row, 2).border,
      left: { style: 'thin', color: { argb: '222222' } },
    };
    sheet.getCell(row, 10).border = {
      ...sheet.getCell(row, 10).border,
      right: { style: 'thin', color: { argb: '222222' } },
    };
  }

  // Encabezado de datos de obra con la misma distribución visual de la plantilla:
  // B:D = datos de la izquierda, E:G = datos centrales, H:J/K:M = datos de la derecha.
  // Los espacios de valor permanecen vinculados a la pestaña "Datos"; no se
  // rellenan manualmente aquí.
  const topRows: Array<{
    labelRange: string;
    label: string;
    valueRange: string;
    dataLabel: typeof DATA_SHEET_LABELS[number];
  }> = [
    { labelRange: 'B6:B6', label: 'País/Div:', valueRange: 'C6:C6', dataLabel: 'País/Div:' },
    { labelRange: 'B7:C7', label: 'Nombre del Supervisor/Insp.:', valueRange: 'D7:E7', dataLabel: 'Nombre del Supervisor/Insp.:' },
    { labelRange: 'B8:C8', label: 'Nombre del Contratista:', valueRange: 'D8:E8', dataLabel: 'Nombre del Contratista:' },
    { labelRange: 'D6:D6', label: 'Área/Cd:', valueRange: 'E6:E6', dataLabel: 'Área/Cd:' },
    { labelRange: 'F6:F6', label: 'Nom. Proy.:', valueRange: 'G6:G6', dataLabel: 'Nom. Proy.:' },
    { labelRange: 'H6:H6', label: 'Producto:', valueRange: 'I6:I6', dataLabel: 'Producto:' },
    { labelRange: 'H7:H7', label: 'Fecha Inicio:', valueRange: 'I7:J7', dataLabel: 'Fecha Inicio:' },
    { labelRange: 'H8:H8', label: 'Fecha Fin:', valueRange: 'I8:J8', dataLabel: 'Fecha Fin:' },
  ];

  // Identificación en la fila superior derecha, siguiendo la plantilla de referencia.
  sheet.mergeCells('F5:H5');
  const identificationLabel = sheet.getCell('F5');
  identificationLabel.value = 'Identificación (OB; DTTO; ID; OT; SISA):';
  identificationLabel.font = { name: 'Calibri', size: 11, color: { argb: '222222' } };
  identificationLabel.alignment = { vertical: 'middle', horizontal: 'right' };

  sheet.mergeCells('I5:J5');
  const identificationValue = sheet.getCell('I5');
  identificationValue.value = { formula: 'Datos!C14', result: data('Identificación (OB; DTTO; ID; OT; SISA:') };
  identificationValue.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '111111' } };
  identificationValue.alignment = { vertical: 'middle', horizontal: 'left' };
  identificationValue.border = { bottom: { style: 'thin', color: { argb: '444444' } } };

  for (const item of topRows) {
    sheet.mergeCells(item.labelRange);
    sheet.mergeCells(item.valueRange);

    const labelCell = sheet.getCell(item.labelRange.split(':')[0]);
    labelCell.value = item.label;
    labelCell.font = { name: 'Calibri', size: 11, color: { argb: '222222' } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const dataIndex = DATA_SHEET_LABELS.indexOf(item.dataLabel);
    const dataRow = dataIndex >= 0 ? dataIndex + 6 : 6;
    const valueCell = sheet.getCell(item.valueRange.split(':')[0]);
    valueCell.value = { formula: 'Datos!C' + dataRow, result: data(item.dataLabel) };
    valueCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '111111' } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
    valueCell.border = { bottom: { style: 'thin', color: { argb: '444444' } } };
  }

  // Bordes específicos de la plantilla: parte superior de I5:J5 y
  // laterales derechos de J5, J7 y J8.
  sheet.getCell('I5').border = {
    ...sheet.getCell('I5').border,
    top: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('J5').border = {
    ...sheet.getCell('J5').border,
    top: { style: 'thin', color: { argb: '222222' } },
    right: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('J7').border = {
    ...sheet.getCell('J7').border,
    right: { style: 'thin', color: { argb: '222222' } },
  };
  sheet.getCell('J8').border = {
    ...sheet.getCell('J8').border,
    right: { style: 'thin', color: { argb: '222222' } },
  };

  for (let r = 5; r <= 8; r++) sheet.getRow(r).height = 21;
  sheet.getRow(9).height = 8;
  sheet.getRow(10).height = 8;

  const groups = new Map<string, MemoryEvidence[]>();
  evidences
    .filter(ev => normalizeMemoryCategory(ev.category) === 'PUNTAS_FIBRA')
    .forEach(ev => {
      const id = getGroupId(ev, 'PUNTAS_FIBRA');
      const list = groups.get(id) || [];
      list.push(ev);
      groups.set(id, list);
    });

  const orderedGroups = Array.from(groups.entries())
    .map(([id, items]) => ({ id, items, number: getGroupNumber(items[0], 'PUNTAS_FIBRA') }))
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));

  let row = 12;

  if (orderedGroups.length === 0) {
    sheet.mergeCells(row, 2, row + 1, 10);
    const empty = sheet.getCell(row, 2);
    empty.value = 'NO HAY FOTOGRAFÍAS DE PUNTAS DE FIBRA REGISTRADAS.';
    empty.alignment = { vertical: 'middle', horizontal: 'center' };
    empty.font = { name: 'Arial', size: 10, bold: true, color: { argb: '6B7280' } };
    return;
  }

  for (const group of orderedGroups) {
    const pair = getFiberGroupEvidence(group.items);
    const first = pair.initial || pair.final || {};
    const fiberCount = first.fiberCount != null && String(first.fiberCount).trim() !== ''
      ? String(first.fiberCount) + ' hilos'
      : '';
    const reel = String(first.fiberReelNumber ?? '').trim();

    // RUTA queda deliberadamente en blanco hasta definir de dónde debe provenir.
    const route = '';

    const boxTop = row;
    const boxBottom = row + 7;

    // El recuadro de metadatos NO se fusiona: así los tres valores
    // (ruta, tipo de fibra y carrete) pueden ocupar sus propias celdas.
    for (let r = boxTop; r <= boxBottom; r++) {
      for (let col = 2; col <= 4; col++) {
        sheet.getCell(r, col).border = {
          top: r === boxTop ? { style: 'medium', color: { argb: '222222' } } : undefined,
          bottom: r === boxBottom ? { style: 'medium', color: { argb: '222222' } } : undefined,
          left: col === 2 ? { style: 'medium', color: { argb: '222222' } } : undefined,
          right: col === 4 ? { style: 'medium', color: { argb: '222222' } } : undefined,
        };
      }
    }

    const metaRows: Array<[number, string, string]> = [
      [boxTop + 2, 'RUTA', route],
      [boxTop + 4, 'TIPO DE FIBRA', fiberCount],
      [boxTop + 6, '# CARRETE', reel],
    ];

    for (const [r, label, value] of metaRows) {
      const labelCell = sheet.getCell(r, 2);
      labelCell.value = label;
      labelCell.font = { name: 'Calibri', size: 11, bold: true };
      labelCell.alignment = { vertical: 'middle', horizontal: 'right' };

      const valueCell = sheet.getCell(r, 3);
      valueCell.value = value;
      valueCell.font = { name: 'Calibri', size: 11, bold: true };
      valueCell.alignment = { vertical: 'middle', horizontal: 'center' };
      valueCell.border = {
        top: { style: 'thin', color: { argb: '222222' } },
        left: { style: 'thin', color: { argb: '222222' } },
        bottom: { style: 'thin', color: { argb: '222222' } },
        right: { style: 'thin', color: { argb: '222222' } },
      };
    }

    const photoCells = [
      { ev: pair.initial, startCol: 5, label: 'PUNTA INICIO' },
      { ev: pair.final, startCol: 8, label: 'PUNTA FINAL' },
    ];

    for (const item of photoCells) {
      const { ev, startCol, label } = item;
      sheet.mergeCells(boxTop, startCol, boxBottom - 1, startCol + 2);
      const imageCell = sheet.getCell(boxTop, startCol);
      imageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F5F7' } };
      imageCell.border = {
        top: { style: 'medium', color: { argb: '222222' } },
        left: { style: 'medium', color: { argb: '222222' } },
        bottom: { style: 'thin', color: { argb: '222222' } },
        right: { style: 'medium', color: { argb: '222222' } },
      };
      imageCell.alignment = { vertical: 'middle', horizontal: 'center' };

      if (ev) {
        const url = getPhotoUrl(ev);
        if (url) {
          try {
            const image = await imageToBase64(url);
            const photoBoxWidthPx = 600;
            const photoBoxHeightPx = 450;
            const scale = Math.min(photoBoxWidthPx / image.width, photoBoxHeightPx / image.height);
            const imageWidth = Math.max(1, Math.round(image.width * scale));
            const imageHeight = Math.max(1, Math.round(image.height * scale));
            const imageId = workbook.addImage({ base64: image.base64, extension: image.extension });

            const totalCellWidthEmu = [startCol, startCol + 1, startCol + 2].reduce((sum, col) => {
              const width = sheet.getColumn(col).width || EXCEL_DEFAULT_COL_WIDTH;
              return sum + Math.floor((width / EXCEL_DEFAULT_COL_WIDTH) * EXCEL_DEFAULT_COL_EMU);
            }, 0);
            const totalCellHeightEmu = Array.from({ length: boxBottom - boxTop }, (_, i) => {
              const heightPt = sheet.getRow(boxTop + i).height || EXCEL_DEFAULT_ROW_HEIGHT_PT;
              return Math.floor((heightPt / EXCEL_DEFAULT_ROW_HEIGHT_PT) * EXCEL_DEFAULT_ROW_EMU);
            }).reduce((sum, value) => sum + value, 0);

            const imageWidthEmu = Math.round(imageWidth * EMU_PER_PIXEL);
            const imageHeightEmu = Math.round(imageHeight * EMU_PER_PIXEL);
            const offsetXEmu = Math.max(0, Math.floor((totalCellWidthEmu - imageWidthEmu) / 2));
            const offsetYEmu = Math.max(0, Math.floor((totalCellHeightEmu - imageHeightEmu) / 2));

            sheet.addImage(imageId, {
              tl: {
                col: startCol - 1,
                row: boxTop - 1,
                nativeCol: startCol - 1,
                nativeColOff: offsetXEmu,
                nativeRow: boxTop - 1,
                nativeRowOff: offsetYEmu,
              },
              ext: { width: imageWidth, height: imageHeight },
            } as any);
          } catch {
            imageCell.value = 'NO SE PUDO CARGAR LA FOTO';
          }
        } else {
          imageCell.value = 'SIN FOTO';
        }
      } else {
        imageCell.value = 'FALTA FOTO';
      }

      sheet.mergeCells(boxBottom, startCol, boxBottom, startCol + 2);
      const caption = sheet.getCell(boxBottom, startCol);
      caption.value = label;
      caption.font = { name: 'Arial', size: 10, bold: true };
      caption.alignment = { vertical: 'middle', horizontal: 'center' };
      caption.border = {
        left: { style: 'medium', color: { argb: '222222' } },
        bottom: { style: 'medium', color: { argb: '222222' } },
        right: { style: 'medium', color: { argb: '222222' } },
      };
    }

    for (let r = boxTop; r <= boxBottom; r++) {
      sheet.getRow(r).height = r === boxBottom ? 24 : 50;
    }

    row = boxBottom + 3;
  }
};
async function addEvidenceSheet(
  workbook: ExcelJS.Workbook,
  category: typeof CATEGORY_CONFIG[number],
  project: any,
  evidences: MemoryEvidence[],
) {
  const sheet = workbook.addWorksheet(category.label);
  sheet.views = [{ showGridLines: false }];

  const useFiberHeader = category.id === 'RESERVA';
  if (useFiberHeader) {
    applyFiberStyleHeaderToSheet(sheet, project);
  } else {
    sheet.columns = [
      { width: 3 }, { width: 27 }, { width: 27 }, { width: 27 },
      { width: 3 },
    ];
  }

  // Calculamos el tamaño real de la celda en EMU, igual que ExcelJS.
  // Esto evita depender de aproximaciones de píxeles y de fracciones de columna.
  const columnWidth = sheet.getColumn(2).width || EXCEL_DEFAULT_COL_WIDTH;
  const photoRowHeightPt = sheet.getRow(3).height || 125;
  const PHOTO_CELL_WIDTH_EMU = Math.floor(
    (columnWidth / EXCEL_DEFAULT_COL_WIDTH) * EXCEL_DEFAULT_COL_EMU
  );
  const PHOTO_CELL_HEIGHT_EMU = Math.floor(
    (photoRowHeightPt / EXCEL_DEFAULT_ROW_HEIGHT_PT) * EXCEL_DEFAULT_ROW_EMU
  );
  const PHOTO_CELL_WIDTH_PX = PHOTO_CELL_WIDTH_EMU / EMU_PER_PIXEL;
  const PHOTO_CELL_HEIGHT_PX = PHOTO_CELL_HEIGHT_EMU / EMU_PER_PIXEL;
  const PHOTO_SIDE_MARGIN_PX = 12;
  const PHOTO_VERTICAL_MARGIN_PX = 8;
  const PHOTO_BOX_WIDTH_PX = PHOTO_CELL_WIDTH_PX - PHOTO_SIDE_MARGIN_PX * 2;
  const PHOTO_BOX_HEIGHT_PX = PHOTO_CELL_HEIGHT_PX - PHOTO_VERTICAL_MARGIN_PX * 2;

  const groups = new Map<string, MemoryEvidence[]>();
  evidences
    .filter(ev => normalizeMemoryCategory(ev.category) === category.id)
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

  let row = useFiberHeader ? 12 : 1;
  if (!useFiberHeader) {
    sheet.mergeCells(row, 2, row, 4);
    const title = sheet.getCell(row, 2);
    title.value = `MEMORIA FOTOGRÁFICA — ${category.label}`;
    styleHeader(title, '102033');
    title.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFF' } };
    sheet.getRow(row).height = 24;
    row += 1;

    sheet.mergeCells(row, 2, row, 4);
    const projectCell = sheet.getCell(row, 2);
    projectCell.value = `PROYECTO: ${String(project?.name ?? '').trim().toUpperCase() || 'PROYECTO'}`;
    styleHeader(projectCell, '1D4E89');
    row += 1;
  }
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
    if (category.id !== 'RESERVA') {
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
    }

    // ALTAS siempre se presenta en orden semántico: panorámica primero y metraje después,
    // aunque el orden de guardado en Firebase sea diferente.
    if (category.id === 'ALTAS') {
      group.items.sort((a, b) => {
        const rank = (ev: MemoryEvidence) => ev.altaSide === 'panoramic' ? 0 : ev.altaSide === 'meterage' ? 1 : 2;
        return rank(a) - rank(b);
      });
    }

    // ACEROS usa el mismo flujo de dos evidencias: panorámica primero y metraje después.
    if (category.id === 'ACEROS') {
      group.items.sort((a, b) => {
        const rank = (ev: MemoryEvidence) => ev.aceroSide === 'photo1' ? 0 : ev.aceroSide === 'photo2' ? 1 : 2;
        return rank(a) - rank(b);
      });
    }

    // DESECHOS sigue el mismo flujo de dos evidencias: panorámica primero y metraje después.
    if (category.id === 'DESECHOS') {
      group.items.sort((a, b) => {
        const rank = (ev: MemoryEvidence) => ev.desechoSide === 'photo1' ? 0 : ev.desechoSide === 'photo2' ? 1 : 2;
        return rank(a) - rank(b);
      });
    }

    const imageRowStart = row;
    const imageRows = Math.ceil(category.required / 3);
    const reservationLayout = category.id === 'RESERVA';
    for (let r = 0; r < imageRows; r++) sheet.getRow(imageRowStart + r * 3).height = reservationLayout ? 210 : 125;
    for (let r = 0; r < imageRows; r++) sheet.getRow(imageRowStart + r * 3 + 1).height = 24;
    for (let r = 0; r < imageRows; r++) sheet.getRow(imageRowStart + r * 3 + 2).height = reservationLayout ? 8 : 5;

    for (let index = 0; index < category.required; index++) {
      const col = reservationLayout ? 2 + (index * 3) : 2 + (index % 3);
      const blockRow = imageRowStart + Math.floor(index / 3) * 3;
      const ev = category.id === 'NAPS'
        ? group.items.find(item => Number(item.napPhotoNumber) === index + 1) || group.items[index]
        : category.id === 'MUFA'
          ? group.items.find(item => Number(item.mufaPhotoNumber) === index + 1) || group.items[index]
          : group.items[index];

      if (reservationLayout) {
        sheet.mergeCells(blockRow, col, blockRow, col + 2);
      }
      const imageCell = sheet.getCell(blockRow, col);
      imageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F5F7' } };
      imageCell.border = {
        top: { style: 'thin', color: { argb: 'D9DEE5' } },
        left: { style: 'thin', color: { argb: 'D9DEE5' } },
        bottom: { style: 'thin', color: { argb: 'D9DEE5' } },
        right: { style: 'thin', color: { argb: 'D9DEE5' } },
      };
      imageCell.alignment = { vertical: 'middle', horizontal: 'center' };

      if (ev) {
        const url = getPhotoUrl(ev);
        if (url) {
          try {
            // Cada fotografía se descarga, reduce y agrega individualmente.
            // No se acumulan las fotos originales en memoria.
            const image = await imageToBase64(url);
            const sourceWidth = image.width || 4;
            const sourceHeight = image.height || 3;
            const scale = Math.min(
              PHOTO_BOX_WIDTH_PX / sourceWidth,
              PHOTO_BOX_HEIGHT_PX / sourceHeight,
            );
            const imageWidth = Math.max(1, Math.round(sourceWidth * scale));
            const imageHeight = Math.max(1, Math.round(sourceHeight * scale));

            // Insertar ÚNICAMENTE la fotografía. No se crea un lienzo gris
            // intermedio: la imagen conserva toda la nitidez de la versión optimizada.
            const imageId = workbook.addImage({
              base64: image.base64,
              extension: image.extension,
            });

            // Centrado con offsets NATIVOS de Excel (EMU). No usamos
            // col/row fraccionarios porque ExcelJS tiene reportes de diferencias
            // en cómo esas fracciones se traducen a offsets visuales.
            const rowHeightPt = sheet.getRow(blockRow).height || 125;
            const imageColumns = reservationLayout ? [col, col + 1, col + 2] : [col];
            const cellWidthEmu = imageColumns.reduce((sum, currentCol) => {
              const width = sheet.getColumn(currentCol).width || EXCEL_DEFAULT_COL_WIDTH;
              return sum + Math.floor((width / EXCEL_DEFAULT_COL_WIDTH) * EXCEL_DEFAULT_COL_EMU);
            }, 0);
            const cellHeightEmu = Math.floor(
              (rowHeightPt / EXCEL_DEFAULT_ROW_HEIGHT_PT) * EXCEL_DEFAULT_ROW_EMU
            );
            const imageWidthEmu = Math.round(imageWidth * EMU_PER_PIXEL);
            const imageHeightEmu = Math.round(imageHeight * EMU_PER_PIXEL);
            const offsetXEmu = Math.max(0, Math.floor((cellWidthEmu - imageWidthEmu) / 2));
            const offsetYEmu = Math.max(0, Math.floor((cellHeightEmu - imageHeightEmu) / 2));

            sheet.addImage(imageId, {
              tl: {
                col: col - 1,
                row: blockRow - 1,
                nativeCol: col - 1,
                nativeColOff: offsetXEmu,
                nativeRow: blockRow - 1,
                nativeRowOff: offsetYEmu,
              },
              ext: {
                width: imageWidth,
                height: imageHeight,
              },
            } as any);
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

      if (reservationLayout) {
        sheet.mergeCells(blockRow + 1, col, blockRow + 1, col + 2);
      }
      const desc = sheet.getCell(blockRow + 1, col);
      if (category.id === 'ALTAS') {
        desc.value = ev
          ? (ev.altaSide === 'meterage'
            ? 'Metraje: ' + clean(ev.altaMeterage)
            : 'Panorámica')
          : (index === 0 ? 'Panorámica' : 'Metraje:');
      } else if (category.id === 'ACEROS') {
        desc.value = ev
          ? (ev.aceroSide === 'photo2'
            ? 'Metraje: ' + clean(ev.aceroMeterage)
            : 'Panorámica')
          : (index === 0 ? 'Panorámica' : 'Metraje:');
      } else if (category.id === 'DESECHOS') {
        desc.value = ev
          ? (ev.desechoSide === 'photo2'
            ? 'Metraje: ' + clean(ev.desechoMeterage)
            : 'Panorámica')
          : (index === 0 ? 'Panorámica' : 'Metraje:');
      } else {
        if (category.id === 'RESERVA') {
          desc.value = ['PUNTA INICIO', 'PUNTA FINAL', 'ROLLO DETALLADO'][index] || `RESERVA - FOTO ${index + 1}`;
        } else {
          desc.value = ev
            ? (category.id === 'NAPS'
              ? getNapsPhotoTitle(ev, index)
              : getDescription(ev, index, category.label))
            : (category.id === 'NAPS'
              ? getNapsPhotoTitle({ napName: group.name } as MemoryEvidence, index)
              : ('FALTA FOTO ' + (index + 1) + '/' + category.required));
        }
      }
      styleBody(desc);
      desc.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      if (ev && category.id === 'NAPS') {
        desc.font = { name: 'Arial', size: 8, bold: true, color: { argb: '102033' } };
      }
    }

    row = imageRowStart + imageRows * 3 + 1;
    sheet.mergeCells(row, 2, row, 4);
    const separator = sheet.getCell(row, 2);
    separator.value = '';
    separator.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EDF2' } };
    row += 2;

    if (row <= startRow) row = startRow + 3;
  }
}

export async function generateMemoryExcel(project: any, evidences: MemoryEvidence[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FielTrace';
  workbook.company = 'Tentelcom del Oeste S.A.';
  workbook.created = new Date();

  // La hoja Datos debe ser siempre la primera pestaña del Excel.
  // Los valores variables de la columna C se dejan vacíos hasta integrar
  // los datos específicos del proyecto/sitio.
  addDataSheet(workbook, project);

  for (const category of CATEGORY_CONFIG) {
    if (category.id === 'PUNTAS_FIBRA') {
      await addFiberTipsSheet(workbook, project, evidences);
      continue;
    }
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
