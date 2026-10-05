/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id?: number;
  uuid?: string;
  name: string;
  client: string;
  description?: string;
  type?: string;
  templateId?: number;
  // Default Visibility
  showDateTime: boolean;
  dateTimeFormat: 'format1' | 'format2';
  showGps: boolean;
  showLocation: boolean;
  showTech: boolean;
  // Technical customization
  techName: string;
  customFields: CustomField[];
  // Location settings
  locationFormat: 'completa' | 'distrito-canton' | 'ciudad-provincia' | 'personalizado';
  customLocationFormat: {
    road: boolean;
    suburb: boolean;
    city: boolean;
    state: boolean;
  };
  // Export Settings
  allowPdf: boolean;
  allowExcel: boolean;
  overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  fontSizeScale: 'small' | 'medium' | 'large';
  fontSizeValue?: number;
  overlayColor: string;
  logoImage?: string | null;
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoSize?: number;
  logoOpacity?: number;
  createdAt: Date;
  updatedAt?: Date;
  syncStatus?: 'pending' | 'synced' | 'failed';
  syncCreatedAt?: Date;
  syncUpdatedAt?: Date;
  lastSyncedAt?: Date;
  syncError?: string;
  retryCount?: number;
  // Versionado de esquema de sincronización remota. Permite migrar una vez los registros antiguos.
  syncSchemaVersion?: number;
}

export interface CustomField {
  name: string;
  value: string;
  showInPhoto: boolean;
  active?: boolean;
}

export interface BaseFields {
  posteId?: string;
  tecnico?: string;
  observaciones?: string;
  materiales?: string;
}

export enum SyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

export type EvidenceCategory =
  | 'PUNTAS_FIBRA'
  | 'PUNTAS_FIBRA_INICIAL'
  | 'PUNTAS_FIBRA_FINAL'
  | 'ACEROS'
  | 'DESECHOS'
  | 'NAPS'
  | 'MUFA'
  | 'RESERVA'
  | 'CABLEADO'
  | 'MEDICION'
  | 'ALTAS'
  | 'OTROS';

export const EVIDENCE_CATEGORIES: Array<{ id: EvidenceCategory; label: string }> = [
  { id: 'PUNTAS_FIBRA', label: 'Puntas de fibra' },
  { id: 'ACEROS', label: 'Aceros' },
  { id: 'DESECHOS', label: 'Desechos' },
  { id: 'NAPS', label: 'NAPS' },
  { id: 'MUFA', label: 'MUFA' },
  { id: 'RESERVA', label: 'Reservas' },
  { id: 'ALTAS', label: 'Altas' },
  { id: 'OTROS', label: 'Otros' },
];

export interface Evidence {
  id?: number;
  uuid: string;
  projectId: number;
  // UUID permanente del proyecto en Firebase; independiente del ID numérico local.
  projectUuid?: string;
  projectName?: string;
  photoPath: string; // Referencia robusta: FT_<uuid>.jpg
  /** Referencias remotas de la fotografía en Firebase Storage. */
  photoStoragePath?: string;
  photoUrl?: string;
  /** Categoría seleccionada por el técnico para preparar la memoria fotográfica. */
  category?: EvidenceCategory;
  /** Texto visible de la categoría al momento de la captura. */
  categoryLabel?: string;
  /** Identificador de la pareja de punta de fibra (Inicial + Final). */
  fiberPairId?: string;
  /** Número visible de la punta dentro del proyecto. */
  fiberPairNumber?: number;
  /** Metraje digitado por el técnico para esta punta. */
  fiberMeterage?: number;
  /** Número de carrete compartido por la punta inicial y final. */
  fiberReelNumber?: string;
  /** Cantidad de fibras del cable documentado (12, 24, 48, etc.). */
  fiberCount?: number;
  /** Lado de la pareja documentado por esta evidencia. */
  fiberSide?: 'initial' | 'final';
  /** Identificador de la reserva fotográfica (Inicio + Final + Rollo). */
  reserveId?: string;
  /** Número visible de la reserva dentro del proyecto. */
  reserveNumber?: number;
  /** Parte de la reserva documentada por esta evidencia. */
  reserveSide?: 'initial' | 'final' | 'roll';
  /** Número de carrete compartido por las 3 fotos de la reserva. */
  reserveReelNumber?: string;
  /** Cantidad de fibras de la reserva (12, 24, 48, etc.). */
  reserveFiberCount?: number;
  /** Metraje registrado para PUNTA INICIAL o PUNTA FINAL de la reserva. */
  reserveMeterage?: number;
  /** Identificador del grupo de fotografías del NAP (9 fotos). */
  napId?: string;
  /** Número visible del NAP dentro del proyecto. */
  napNumber?: number;
  /** Nombre/código del NAP, por ejemplo GT069/072. */
  napName?: string;
  /** Número de fotografía dentro del set del NAP (1 a 9). */
  napPhotoNumber?: number;
  /** Identificador del set de ACEROS (Foto 1 + Foto 2). */
  aceroId?: string;
  /** Número visible del set de ACEROS dentro del proyecto. */
  aceroNumber?: number;
  /** Foto dentro del set de ACEROS. */
  aceroSide?: 'photo1' | 'photo2';
  /** Tipo visual seleccionado para la foto de ACEROS. */
  aceroPhotoType?: 'panoramic' | 'meterage';
  /** Metraje ingresado cuando la foto de ACEROS es de tipo METRAJE. */
  aceroMeterage?: number;
  /** Identificador del set de ALTA (Panorámica + Metraje). */
  altaId?: string;
  /** Número visible del set de ALTA dentro del proyecto. */
  altaNumber?: number;
  /** Tipo de ALTA documentada. */
  altaType?: 'FIBRA DE DESCARTE' | 'FIBRA DE DESECHO' | 'ALTAS EN ACERO';
  /** Parte del set de ALTA documentada. */
  altaSide?: 'panoramic' | 'meterage';

  photo?: {
    fileName: string;
    uri?: string;
    mimeType?: string;
    createdAt: Date;
  };
  capturedAt: Date;
  fecha: string;
  hora: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  gpsAccuracy?: number;
  gpsCapturedAt?: Date;
  ubicacion: string;
  baseFields: BaseFields;
  customFields: CustomField[];
  sharedWhatsApp: boolean;
  createdAt: Date;
  updatedAt?: Date;
  locked: boolean;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncCreatedAt?: Date;
  syncUpdatedAt?: Date;
  lastSyncedAt?: Date;
  syncError?: string;
  retryCount: number;
  // Versionado de esquema de sincronización remota.
  syncSchemaVersion?: number;
}

export interface Template {
  id?: number;
  uuid?: string;
  name: string;
  fields: CustomField[];
}

export interface SyncQueue {
  id?: number;
  uuid?: string;
  entityType: 'project' | 'evidence';
  entityId: number | string;
  operation: SyncOperation;
  timestamp: Date;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount?: number;
  error?: string;
}