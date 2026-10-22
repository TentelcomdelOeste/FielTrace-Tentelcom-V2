/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Field Trace - Almacenamiento Local Robusto (Offline-First)
 * Separa metadatos de evidencias (IndexedDB con índices) y referencias a fotos (Galería Nativa / Web Fallback).
 */

import type { Project, Evidence, Template, SyncQueue } from '../types';
import { firebaseService } from './firebaseService';

const DB_NAME = 'FieldTraceDB';
const DB_VERSION = 2;
const STORE_PROJECTS = 'projects';
const STORE_EVIDENCES = 'evidences';
const STORE_PHOTOS = 'photos'; // Web preview fallback only
const STORE_TEMPLATES = 'templates';
const STORE_SYNC_QUEUE = 'syncQueue';
const CURRENT_SYNC_SCHEMA_VERSION = 4;

// Evita ciclos de sincronización concurrentes al iniciar la app y al recuperar conexión.
let syncInProgress = false;

function makeLegacyUuid(prefix: string, id: number | undefined): string {
  if (id != null) return `legacy_${prefix}_${id}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

class StorageManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Projects Store
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const projStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id', autoIncrement: true });
          projStore.createIndex('uuid', 'uuid', { unique: true });
          projStore.createIndex('createdAt', 'createdAt', { unique: false });
          projStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        } else {
          const tx = (event.currentTarget as IDBOpenDBRequest).transaction!;
          const projStore = tx.objectStore(STORE_PROJECTS);
          if (!projStore.indexNames.contains('uuid')) projStore.createIndex('uuid', 'uuid', { unique: true });
          if (!projStore.indexNames.contains('createdAt')) projStore.createIndex('createdAt', 'createdAt', { unique: false });
          if (!projStore.indexNames.contains('syncStatus')) projStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Evidences Store with Indices for robust querying without in-memory filtering
        if (!db.objectStoreNames.contains(STORE_EVIDENCES)) {
          const evStore = db.createObjectStore(STORE_EVIDENCES, { keyPath: 'id', autoIncrement: true });
          evStore.createIndex('uuid', 'uuid', { unique: true });
          evStore.createIndex('projectId', 'projectId', { unique: false });
          evStore.createIndex('createdAt', 'createdAt', { unique: false });
          evStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          evStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          evStore.createIndex('photoPath', 'photoPath', { unique: false });
        } else {
          const tx = (event.currentTarget as IDBOpenDBRequest).transaction!;
          const evStore = tx.objectStore(STORE_EVIDENCES);
          if (!evStore.indexNames.contains('uuid')) evStore.createIndex('uuid', 'uuid', { unique: true });
          if (!evStore.indexNames.contains('projectId')) evStore.createIndex('projectId', 'projectId', { unique: false });
          if (!evStore.indexNames.contains('createdAt')) evStore.createIndex('createdAt', 'createdAt', { unique: false });
          if (!evStore.indexNames.contains('updatedAt')) evStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          if (!evStore.indexNames.contains('syncStatus')) evStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          if (!evStore.indexNames.contains('photoPath')) evStore.createIndex('photoPath', 'photoPath', { unique: false });
        }

        // Photos Store (Web Fallback Only)
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        }

        // Templates Store
        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
          db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id', autoIncrement: true });
        }

        // Sync Queue Store
        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('syncStatus', 'status', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, id: number | string): Promise<T> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName: string, item: any): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Persiste evidencia + copia temporal de la fotografía en una sola transacción.
   * Esto elimina la ventana en la que una evidencia podría existir localmente
   * sin su foto de respaldo si la app se cierra inesperadamente.
   */
  async addEvidenceAtomically(evidence: any, photoBlob?: Blob): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_EVIDENCES, STORE_PHOTOS], 'readwrite');
      const evidenceStore = transaction.objectStore(STORE_EVIDENCES);
      const photoStore = transaction.objectStore(STORE_PHOTOS);
      let evidenceId: number | undefined;

      if (photoBlob && evidence.photoPath) {
        photoStore.put({
          id: evidence.photoPath,
          blob: photoBlob,
          createdAt: new Date()
        });
      }

      const request = evidenceStore.add(evidence);
      request.onsuccess = () => {
        evidenceId = request.result as number;
      };
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => {
        if (evidenceId == null) {
          reject(new Error('No se pudo obtener el ID local de la evidencia.'));
          return;
        }
        resolve(evidenceId);
      };
      transaction.onerror = () => reject(transaction.error || new Error('Error guardando evidencia y fotografía local.'));
      transaction.onabort = () => reject(transaction.error || new Error('Transacción local abortada.'));
    });
  }

  async put(storeName: string, item: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: number | string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const manager = new StorageManager();

async function syncProjectImmediately(project: Project): Promise<boolean> {
  if (!navigator.onLine || project.id == null || !project.uuid) return false;

  try {
    const success = await firebaseService.syncProjectToCloud(project);
    if (success) {
      const syncedProject: Project = {
        ...project,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        syncError: undefined,
        retryCount: 0,
        syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION
      };
      await manager.put(STORE_PROJECTS, syncedProject);
      return true;
    }

    await manager.put(STORE_PROJECTS, {
      ...project,
      syncStatus: 'pending',
      syncError: 'Sincronización inmediata pendiente; se reintentará automáticamente.'
    });
  } catch (error) {
    console.warn('[StorageService] Sincronización inmediata del proyecto pendiente:', error);
    await manager.put(STORE_PROJECTS, {
      ...project,
      syncStatus: 'pending',
      syncError: 'Sincronización inmediata pendiente; se reintentará automáticamente.'
    });
  }

  return false;
}

export const storageService = {
  async createProject(project: Project): Promise<number> {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'proj_' + Date.now() + Math.random().toString(36).substr(2, 9);
    const projectToSave: Project = {
      ...project,
      uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'pending',
      retryCount: 0,
      syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION
    };

    const id = await manager.add(STORE_PROJECTS, projectToSave);
    const savedProject = await manager.get<Project>(STORE_PROJECTS, id);

    // El guardado local ya está confirmado. La sincronización remota no debe
    // bloquear la navegación ni impedir que el usuario continúe trabajando offline.
    void syncProjectImmediately(savedProject).catch(error => {
      console.warn('[StorageService] Proyecto guardado localmente; sincronización pendiente:', error);
    });
    return id;
  },

  async getAllProjects(): Promise<Project[]> {
    const projects = await manager.getAll<Project>(STORE_PROJECTS);
    // La lista principal es local por usuario/dispositivo. Un proyecto oculto
    // permanece almacenado localmente para poder recuperarlo desde "Proyectos compartidos"
    // sin tocar Firestore ni Firebase Storage.
    return projects
      .filter(project => project.hiddenFromHome !== true)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getProject(id: number): Promise<Project> {
    return manager.get<Project>(STORE_PROJECTS, id);
  },

  async updateProject(id: number, project: Project): Promise<void> {
    const existing = await this.getProject(id);
    const updated: Project = {
      ...existing,
      ...project,
      id,
      uuid: project.uuid || existing.uuid,
      updatedAt: new Date(),
      syncStatus: 'pending',
      retryCount: existing.retryCount ?? 0,
      syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION
    };
    await manager.put(STORE_PROJECTS, updated);

    // Persistir localmente es la operación crítica. La sincronización remota
    // se ejecuta en segundo plano para evitar que editar/guardar quede bloqueado.
    void syncProjectImmediately(updated).catch(error => {
      console.warn('[StorageService] Cambios del proyecto guardados localmente; sincronización pendiente:', error);
    });
  },

  /**
   * Guarda la evidencia en IndexedDB (solo metadatos y referencia robusta a la foto de la galería).
   * En plataformas móviles (Android/iOS), la foto está en la galería nativa.
   * La fotografía NO se persiste en IndexedDB como almacenamiento permanente; en Web,
   * solo se conserva un respaldo temporal en STORE_PHOTOS cuando Firebase Storage no está disponible.
   */
  async addEvidence(evidence: Evidence, imageBase64: string): Promise<number> {
    const project = await this.getProject(evidence.projectId);

    // Nunca esperar a Firebase antes de guardar la evidencia localmente.
    // La sincronización del proyecto padre se realizará en segundo plano después
    // de confirmar el archivo y sus metadatos en IndexedDB.
    const evidenceToSave: Evidence = {
      ...evidence,
      projectUuid: evidence.projectUuid || project?.uuid,
      updatedAt: new Date(),
      syncStatus: 'pending',
      retryCount: evidence.retryCount ?? 0,
      syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION
    };

    // PRIMERO: persistimos localmente la evidencia y una copia de la foto
    // en una sola transacción. Así, un cierre/crash no puede dejar la evidencia
    // sin su respaldo local mientras todavía está pendiente de Firebase.
    let photoBlob: Blob | undefined;
    if (imageBase64) {
      try {
        // En Android WebView, fetch(data:image/...) puede fallar para capturas grandes.
        // Decodificamos explícitamente los data URL para asegurar que IndexedDB reciba el Blob.
        if (imageBase64.startsWith('data:')) {
          const comma = imageBase64.indexOf(',');
          if (comma < 0) throw new Error('Data URL sin separador de contenido.');
          const header = imageBase64.slice(0, comma);
          const payload = imageBase64.slice(comma + 1);
          const mime = header.match(/^data:([^;]+)/i)?.[1] || 'image/jpeg';
          if (/;base64/i.test(header)) {
            const binary = atob(payload);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            photoBlob = new Blob([bytes], { type: mime });
          } else {
            photoBlob = new Blob([decodeURIComponent(payload)], { type: mime });
          }
        } else {
          photoBlob = await (await fetch(imageBase64)).blob();
        }
        if (!photoBlob || photoBlob.size <= 0) throw new Error('La fotografía convertida está vacía.');
      } catch (error) {
        console.error('[StorageService] No se pudo preparar la copia local de la fotografía:', error);
        throw new Error('No se pudo preparar la fotografía para guardarla de forma segura.');
      }
    }

    // Si el registro tiene referencia a una foto, no permitir guardarlo sin su Blob local.
    if (evidenceToSave.photoPath && !photoBlob) {
      throw new Error('La fotografía no contiene datos locales para guardarse. Vuelve a tomarla.');
    }

    const evidenceId = await manager.addEvidenceAtomically(evidenceToSave, photoBlob);

    // La evidencia y su Blob ya están persistidos localmente. Desde este punto
    // toda operación remota es de fondo: un timeout/permisos/red no puede bloquear
    // la cámara ni provocar la pérdida de la fotografía.
    if (navigator.onLine) {
      void (async () => {
        try {
          if (project) await syncProjectImmediately(project);

          if (evidenceToSave.projectUuid && photoBlob) {
            const remote = await firebaseService.uploadEvidencePhoto(
              photoBlob,
              evidenceToSave.projectUuid,
              evidenceToSave.uuid,
              evidenceToSave.photoPath
            );
            evidenceToSave.photoStoragePath = remote.storagePath;
            evidenceToSave.photoUrl = remote.downloadUrl;
            await manager.put(STORE_EVIDENCES, { ...evidenceToSave, id: evidenceId });
          }

          // Solo se declara sincronizada si los metadatos se aceptan en Firestore
          // y, cuando hay foto, existe URL confirmada de Storage.
          const photoReady = !evidenceToSave.photoPath || Boolean(evidenceToSave.photoUrl);
          if (photoReady) {
            const success = await firebaseService.syncEvidenceToCloud(evidenceToSave);
            if (success) {
              evidenceToSave.syncStatus = 'synced';
              evidenceToSave.lastSyncedAt = new Date();
              evidenceToSave.syncError = undefined;
              evidenceToSave.retryCount = 0;
              await manager.put(STORE_EVIDENCES, { ...evidenceToSave, id: evidenceId });
              // Mantener el Blob local permite abrir la foto dentro de la app incluso
              // si la URL remota falla o el dispositivo está sin conexión.
            }
          }
        } catch (syncError) {
          console.warn('[StorageService] Evidencia guardada localmente; sincronización pendiente:', syncError);
          try {
            const latest = await manager.get<Evidence>(STORE_EVIDENCES, evidenceId);
            if (latest) {
              latest.syncStatus = 'pending';
              latest.syncError = String((syncError as any)?.message || syncError);
              await manager.put(STORE_EVIDENCES, latest);
            }
          } catch (persistError) {
            console.error('[StorageService] No se pudo actualizar el estado pendiente:', persistError);
          }
        }
      })();
    }

    return evidenceId;
  },


  /**
   * Prepara registros antiguos para sincronización sin borrar ni recrear datos.
   * Los registros existentes conservan su ID local; únicamente se agregan los
   * metadatos de sincronización que les falten.
   */
  prepareLocalDataForSync: async (): Promise<void> => {
    const projects = await manager.getAll<Project>(STORE_PROJECTS);
    const normalizedProjects: Project[] = [];

    for (const project of projects) {
      const normalized: Project = {
        ...project,
        uuid: project.uuid || makeLegacyUuid('project', project.id),
        syncStatus: project.syncStatus || 'pending',
        updatedAt: project.updatedAt || project.createdAt || new Date(),
        retryCount: project.retryCount ?? 0,
        syncSchemaVersion: project.syncSchemaVersion ?? 0
      };
      normalizedProjects.push(normalized);

      if (JSON.stringify(normalized) !== JSON.stringify(project)) {
        await manager.put(STORE_PROJECTS, normalized);
      }
    }

    const projectById = new Map(normalizedProjects.map(project => [project.id, project]));
    const evidences = await manager.getAll<Evidence>(STORE_EVIDENCES);

    for (const evidence of evidences) {
      const project = projectById.get(evidence.projectId);
      const normalized: Evidence = {
        ...evidence,
        uuid: evidence.uuid || makeLegacyUuid('evidence', evidence.id),
        syncStatus: evidence.syncStatus || 'pending',
        createdAt: evidence.createdAt || evidence.capturedAt || new Date(),
        updatedAt: evidence.updatedAt || evidence.createdAt || new Date(),
        retryCount: evidence.retryCount ?? 0,
        projectUuid: evidence.projectUuid || project?.uuid,
        syncSchemaVersion: evidence.syncSchemaVersion ?? 0
      };

      if (JSON.stringify(normalized) !== JSON.stringify(evidence)) {
        await manager.put(STORE_EVIDENCES, normalized);
      }
    }
  },

  /**
   * Sincroniza proyectos y evidencias locales. Los registros antiguos y los
   * registros de versiones anteriores también entran aquí. Las fotos se suben
   * primero a Firebase Storage cuando existe una copia local pendiente.
   */
  async syncAllLocalData(): Promise<{ projects: number; evidences: number }> {
    if (!navigator.onLine || syncInProgress) return { projects: 0, evidences: 0 };
    syncInProgress = true;

    try {
      await this.prepareLocalDataForSync();

      let projectsSynced = 0;
      let evidencesSynced = 0;

      const projects = await manager.getAll<Project>(STORE_PROJECTS);
      for (const project of projects) {
        if (project.syncStatus === 'synced' && project.syncSchemaVersion === CURRENT_SYNC_SCHEMA_VERSION) continue;
        const success = await firebaseService.syncProjectToCloud(project);
        if (success) {
          project.syncStatus = 'synced';
          project.lastSyncedAt = new Date();
          project.syncError = undefined;
          project.retryCount = 0;
          project.syncSchemaVersion = CURRENT_SYNC_SCHEMA_VERSION;
          if (project.id != null) await manager.put(STORE_PROJECTS, project);
          projectsSynced++;
        } else {
          project.syncStatus = 'failed';
          project.retryCount = (project.retryCount ?? 0) + 1;
          project.syncError = 'No se pudo sincronizar con Firebase.';
          if (project.id != null) await manager.put(STORE_PROJECTS, project);
        }
      }

      const evidences = await manager.getAll<Evidence>(STORE_EVIDENCES);
      const projectById = new Map(projects.map(project => [project.id, project]));

      for (const evidence of evidences) {
        const evidenceRequiresPhoto = Boolean(
          evidence.photoPath || evidence.photoUrl || evidence.photoStoragePath || evidence.photo?.uri
        );
        const evidencePhotoConfirmed = !evidenceRequiresPhoto || Boolean(evidence.photoUrl);
        if (
          evidence.syncStatus === 'synced' &&
          evidence.syncSchemaVersion === CURRENT_SYNC_SCHEMA_VERSION &&
          evidencePhotoConfirmed
        ) continue;
        const project = projectById.get(evidence.projectId);
        const evidenceForCloud: Evidence = {
          ...evidence,
          projectUuid: evidence.projectUuid || project?.uuid
        };

        // La foto debe quedar confirmada en Storage antes de considerar
        // sincronizada la evidencia. Primero intentamos recuperar una URL
        // existente y, si no existe, usamos la copia local pendiente.
        if (!evidenceForCloud.photoUrl && evidenceForCloud.photoPath && evidenceForCloud.projectUuid) {
          if (evidenceForCloud.photoStoragePath) {
            try {
              evidenceForCloud.photoUrl = await firebaseService.getEvidencePhotoUrl(
                evidenceForCloud.photoStoragePath
              );
              evidence.photoUrl = evidenceForCloud.photoUrl;
              await manager.put(STORE_EVIDENCES, evidence);
            } catch (storageLookupError) {
              console.warn('[StorageService] No se pudo verificar la fotografía existente en Storage:', storageLookupError);
            }
          }

          if (!evidenceForCloud.photoUrl) {
            const pendingPhoto = await manager.get<{ id: string; blob: Blob }>(STORE_PHOTOS, evidenceForCloud.photoPath);
            if (pendingPhoto?.blob) {
              try {
                const remote = await firebaseService.uploadEvidencePhoto(
                  pendingPhoto.blob,
                  evidenceForCloud.projectUuid,
                  evidenceForCloud.uuid,
                  evidenceForCloud.photoPath
                );
                evidenceForCloud.photoStoragePath = remote.storagePath;
                evidenceForCloud.photoUrl = remote.downloadUrl;
                evidence.photoStoragePath = remote.storagePath;
                evidence.photoUrl = remote.downloadUrl;
                await manager.put(STORE_EVIDENCES, evidence);
              } catch (uploadError) {
                console.warn('[StorageService] Reintento de foto fallido:', uploadError);
              }
            } else {
              evidenceForCloud.syncError = 'Fotografía pendiente: no existe una copia local disponible para reintentar la subida.';
            }
          }
        }

        // No sincronizar metadatos ni marcar como completada una evidencia
        // mientras su archivo fotográfico siga sin URL confirmada en Storage.
        if (evidenceRequiresPhoto && !evidenceForCloud.photoUrl) {
          evidence.syncStatus = 'pending';
          evidence.retryCount = (evidence.retryCount ?? 0) + 1;
          evidence.syncError = evidenceForCloud.syncError ||
            'Fotografía pendiente: falta confirmar su subida a Firebase Storage.';
          if (evidence.id != null) await manager.put(STORE_EVIDENCES, evidence);
          continue;
        }

        const success = await firebaseService.syncEvidenceToCloud(evidenceForCloud);
        if (success) {
          evidence.syncStatus = 'synced';
          evidence.lastSyncedAt = new Date();
          evidence.syncError = undefined;
          evidence.photoStoragePath = evidenceForCloud.photoStoragePath || evidence.photoStoragePath;
          evidence.photoUrl = evidenceForCloud.photoUrl || evidence.photoUrl;
          evidence.retryCount = 0;
          evidence.syncSchemaVersion = CURRENT_SYNC_SCHEMA_VERSION;
          if (evidence.id != null) await manager.put(STORE_EVIDENCES, evidence);
          // No borrar STORE_PHOTOS al sincronizar: es la copia persistente
          // que permite visualizar evidencias desde Field Trace sin depender de la red.
          evidencesSynced++;
        } else {
          evidence.syncStatus = 'failed';
          evidence.retryCount = (evidence.retryCount ?? 0) + 1;
          evidence.syncError = evidenceForCloud.syncError || 'No se pudo sincronizar con Firebase.';
          if (evidence.id != null) await manager.put(STORE_EVIDENCES, evidence);
        }
      }

      console.log(`[StorageService] Sync completa: ${projectsSynced} proyectos, ${evidencesSynced} evidencias.`);
      return { projects: projectsSynced, evidences: evidencesSynced };
    } catch (e) {
      console.error('[StorageService] Error en sincronización completa:', e);
      return { projects: 0, evidences: 0 };
    } finally {
      syncInProgress = false;
    }
  },

  async syncPendingEvidences(): Promise<number> {
    const result = await this.syncAllLocalData();
    return result.evidences;
  },

  /**
   * Fuerza el reintento de una evidencia concreta sin afectar las demás.
   * El registro vuelve a quedar pendiente localmente y luego se procesa con la
   * misma ruta de sincronización normal.
   */
  async retryEvidenceSync(id: number): Promise<boolean> {
    const existing = await manager.get<Evidence>(STORE_EVIDENCES, id);
    if (!existing) return false;

    const pending: Evidence = {
      ...existing,
      syncStatus: 'pending',
      syncError: undefined,
      updatedAt: new Date(),
      retryCount: existing.retryCount ?? 0
    };

    await manager.put(STORE_EVIDENCES, pending);

    if (!navigator.onLine) return false;

    await this.syncAllLocalData();
    const updated = await manager.get<Evidence>(STORE_EVIDENCES, id);
    return updated?.syncStatus === 'synced';
  },

  /**
   * Consulta optimizada usando índice IDBIndex 'projectId' (sin filtrado en memoria).
   */
  async getAllEvidences(): Promise<Evidence[]> {
    return manager.getAll<Evidence>(STORE_EVIDENCES);
  },

  async getEvidencesByProject(projectId: number): Promise<Evidence[]> {
    const db = await manager.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_EVIDENCES, 'readonly');
      const store = transaction.objectStore(STORE_EVIDENCES);
      const index = store.index('projectId');
      const request = index.getAll(projectId);
      request.onsuccess = () => {
        const list = (request.result as Evidence[]).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getPhotoBlob(photoId: string): Promise<string | null> {
    // 1. Buscar en respaldo web (STORE_PHOTOS)
    const data = await manager.get<{ blob: Blob }>(STORE_PHOTOS, photoId);
    if (data && data.blob) {
      return URL.createObjectURL(data.blob);
    }
    // 2. Si es una URL o path directo
    if (photoId && (photoId.startsWith('data:') || photoId.startsWith('blob:') || photoId.startsWith('http') || photoId.startsWith('file:'))) {
      return photoId;
    }
    return null;
  },

  async getEvidencesBySyncStatus(status: string): Promise<Evidence[]> {
    const db = await manager.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_EVIDENCES, 'readonly');
      const store = transaction.objectStore(STORE_EVIDENCES);
      const index = store.index('syncStatus');
      const request = index.getAll(status);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },


  async updateEvidence(id: number, updates: Partial<Evidence>): Promise<void> {
    const existing = await manager.get<Evidence>(STORE_EVIDENCES, id);
    if (!existing) throw new Error('Evidence not found');
    const updated: Evidence = { ...existing, ...updates, id, updatedAt: new Date(), syncStatus: 'pending' };
    await manager.put(STORE_EVIDENCES, updated);
    if (navigator.onLine) {
      firebaseService.syncEvidenceToCloud(updated).then(async (success) => {
        if (success) {
          updated.syncStatus = 'synced';
          updated.lastSyncedAt = new Date();
          updated.syncSchemaVersion = CURRENT_SYNC_SCHEMA_VERSION;
          await manager.put(STORE_EVIDENCES, updated);
        }
      }).catch(() => {});
    }
  },

  async deleteEvidence(id: number): Promise<void> {
    const existing = await manager.get<Evidence>(STORE_EVIDENCES, id);
    if (!existing) throw new Error('Evidence not found');

    // La eliminación definitiva requiere borrar primero la foto remota y su metadata.
    // Si Firebase falla, conservamos el registro local para no perder la referencia.
    if (navigator.onLine && (existing.photoStoragePath || existing.uuid)) {
      await firebaseService.deleteEvidenceFromCloud(existing);
    } else if (!navigator.onLine) {
      throw new Error('Se necesita conexión a Internet para eliminar definitivamente la evidencia de Firebase Storage.');
    }

    await manager.delete(STORE_EVIDENCES, id);
    if (existing.photoPath) {
      try { await manager.delete(STORE_PHOTOS, existing.photoPath); } catch (_) {}
    }
  },

  async deleteAllEvidencesByProject(projectId: number): Promise<number> {
    const list = await this.getEvidencesByProject(projectId);
    let n = 0;
    for (const ev of list) {
      if (ev.id != null) {
        await manager.delete(STORE_EVIDENCES, ev.id);
        n += 1;
      }
    }
    return n;
  },

  async deleteProject(projectId: number): Promise<void> {
    await this.deleteAllEvidencesByProject(projectId);
    await manager.delete(STORE_PROJECTS, projectId);
  },

  /**
   * Oculta proyectos únicamente de la lista principal de este dispositivo.
   * NO elimina el proyecto, evidencias ni fotografías de Firebase.
   */
  async hideProjects(projectIds: number[]): Promise<number> {
    let n = 0;
    for (const id of projectIds) {
      if (id == null) continue;
      const project = await manager.get<Project>(STORE_PROJECTS, id);
      if (!project) continue;

      await manager.put(STORE_PROJECTS, {
        ...project,
        hiddenFromHome: true
      });
      n += 1;
    }
    return n;
  },

  async deleteProjects(projectIds: number[]): Promise<number> {
    let n = 0;
    for (const id of projectIds) {
      if (id == null) continue;
      await this.deleteProject(id);
      n += 1;
    }
    return n;
  },

  /**
   * Importa un proyecto compartido desde Firebase al almacenamiento local.
   * Conserva el UUID de nube para que nuevas fotos sigan en el mismo proyecto.
   * revealInHome=true se usa únicamente cuando el usuario abre explícitamente
   * el proyecto desde "Proyectos compartidos".
   */
  async importCloudProject(cloudProject: any, cloudEvidences: any[] = [], revealInHome = false): Promise<Project> {
    const cloudUuid = String(cloudProject.uuid || cloudProject.id);
    const existingProjects = await manager.getAll<Project>(STORE_PROJECTS);
    const existing = existingProjects.find(project => project.uuid === cloudUuid);

    const toDate = (value: any, fallback = new Date()) => {
      const date = value ? new Date(value) : fallback;
      return Number.isNaN(date.getTime()) ? fallback : date;
    };

    let localProject: Project;
    if (existing?.id != null) {
      localProject = {
        ...existing,
        ...cloudProject,
        id: existing.id,
        uuid: cloudUuid,
        hiddenFromHome: revealInHome ? false : existing.hiddenFromHome === true,
        createdAt: toDate(cloudProject.createdAt, existing.createdAt),
        updatedAt: toDate(cloudProject.updatedAt, new Date()),
        syncStatus: 'synced',
        syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION
      } as Project;
      await manager.put(STORE_PROJECTS, localProject);
    } else {
      const { id: _remoteId, ...cloudData } = cloudProject;
      localProject = {
        ...cloudData,
        uuid: cloudUuid,
        hiddenFromHome: false,
        createdAt: toDate(cloudProject.createdAt),
        updatedAt: toDate(cloudProject.updatedAt),
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        retryCount: 0,
        syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION
      } as Project;
      const localId = await manager.add(STORE_PROJECTS, localProject);
      localProject = await manager.get<Project>(STORE_PROJECTS, localId);
    }

    const localEvidences = await manager.getAll<Evidence>(STORE_EVIDENCES);
    for (const remote of cloudEvidences) {
      const uuid = String(remote.uuid || remote.id || ('ev_' + Date.now()));
      const existingEvidence = localEvidences.find(ev => ev.uuid === uuid && ev.projectUuid === cloudUuid);
      const normalized: any = {
        ...remote,
        uuid,
        projectId: localProject.id,
        projectUuid: cloudUuid,
        projectName: remote.projectName || localProject.name || '',
        createdAt: toDate(remote.createdAt || remote.capturedAt),
        updatedAt: toDate(remote.updatedAt || remote.createdAt || remote.capturedAt),
        capturedAt: remote.capturedAt ? toDate(remote.capturedAt) : undefined,
        gpsCapturedAt: remote.gpsCapturedAt ? toDate(remote.gpsCapturedAt) : undefined,
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
        syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION,
        syncError: undefined
      };
      delete normalized.id;
      if (existingEvidence?.id != null) {
        await manager.put(STORE_EVIDENCES, { ...existingEvidence, ...normalized, id: existingEvidence.id });
      } else {
        await manager.add(STORE_EVIDENCES, normalized);
      }
    }
    return localProject;
  },

  /**
   * Aplica el estado canónico de Firebase al almacenamiento local compartido.
   * Solo reemplaza registros ya sincronizados; las capturas locales pendientes
   * nunca se pisan con datos remotos.
   */
  async reconcileCloudProjectEvidences(projectUuid: string, remoteEvidences: any[]): Promise<Evidence[]> {
    const canonicalProjectUuid = String(projectUuid || '').trim();
    if (!canonicalProjectUuid) return [];
    const [projects, allLocal] = await Promise.all([
      manager.getAll<Project>(STORE_PROJECTS),
      manager.getAll<Evidence>(STORE_EVIDENCES)
    ]);
    const localProject = projects.find(project => String(project.uuid || '') === canonicalProjectUuid);
    const localProjectId = localProject?.id;
    const localForProject = allLocal.filter(item =>
      String((item as any).projectUuid || '') === canonicalProjectUuid ||
      (localProjectId != null && item.projectId === localProjectId)
    );
    const remoteByUuid = new Map<string, any>();
    const remotelyDeletedUuids = new Set<string>();
    for (const remote of remoteEvidences || []) {
      const uuid = String(remote?.uuid || '').trim();
      if (!uuid) continue;
      if (remote?.isDeleted === true) {
        remotelyDeletedUuids.add(uuid);
        continue;
      }
      remoteByUuid.set(uuid, remote);
    }

    for (const [uuid, remote] of remoteByUuid) {
      const existing = allLocal.find(item => String((item as any).uuid || '') === uuid);
      // No destruir una captura o sustitución local que aún no llegó a la nube.
      if (existing && existing.syncStatus !== 'synced') continue;
      const normalized: any = {
        ...(existing || {}),
        ...remote,
        uuid,
        projectUuid: canonicalProjectUuid,
        projectId: existing?.projectId ?? localProjectId ?? remote.projectId ?? null,
        // Conservar la clave local de IndexedDB si esta evidencia ya existe.
        photoPath: existing?.photoPath || remote.photoPath || '',
        photoUrl: remote.photoUrl || existing?.photoUrl || '',
        photoStoragePath: remote.photoStoragePath || existing?.photoStoragePath || '',
        syncStatus: 'synced',
        retryCount: 0,
        syncError: undefined,
        updatedAt: remote.updatedAt || new Date().toISOString()
      };
      if (existing?.id != null) {
        normalized.id = existing.id;
        await manager.put(STORE_EVIDENCES, normalized);
      } else {
        // Nunca reutilizar el ID numérico local de otro dispositivo.
        delete normalized.id;
        await manager.add(STORE_EVIDENCES, normalized);
      }
    }

    // Si Firebase ya no tiene un registro que localmente se consideraba
    // sincronizado, fue eliminado desde otro dispositivo: retirarlo también aquí.
    for (const local of localForProject) {
      const uuid = String((local as any).uuid || '').trim();
      if (!uuid || local.id == null) continue;
      const deletedByAnotherDevice = remotelyDeletedUuids.has(uuid);
      if (!deletedByAnotherDevice && (local.syncStatus !== 'synced' || remoteByUuid.has(uuid))) continue;
      await manager.delete(STORE_EVIDENCES, local.id);
      if (local.photoPath) {
        try { await manager.delete(STORE_PHOTOS, local.photoPath); } catch (_) {}
      }
    }

    return localProjectId != null
      ? this.getEvidencesByProject(localProjectId)
      : (Array.from(remoteByUuid.values()) as Evidence[]);
  },

  async getCloudProjectEvidences(projectUuid: string): Promise<Evidence[]> {
    const remoteEvidences = await firebaseService.getCloudProjectEvidences(projectUuid);
    // Al abrir/actualizar Memoria Fotográfica también reconciliamos IndexedDB:
    // evita que una eliminación remota permanezca como registro local obsoleto.
    await this.reconcileCloudProjectEvidences(projectUuid, remoteEvidences);
    return remoteEvidences as Evidence[];
  },

  async saveTemplate(template: Template): Promise<number> {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'tpl_' + Date.now();
    return manager.add(STORE_TEMPLATES, { ...template, uuid });
  },

  async getTemplates(): Promise<Template[]> {
    return manager.getAll<Template>(STORE_TEMPLATES);
  }
};







