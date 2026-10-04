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
const CURRENT_SYNC_SCHEMA_VERSION = 2;

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

export const storageService = {
  async createProject(project: Project): Promise<number> {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'proj_' + Date.now() + Math.random().toString(36).substr(2, 9);
    const projectToSave: Project = {
      ...project,
      uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'pending'
    };
    return manager.add(STORE_PROJECTS, projectToSave);
  },

  async getAllProjects(): Promise<Project[]> {
    const projects = await manager.getAll<Project>(STORE_PROJECTS);
    return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getProject(id: number): Promise<Project> {
    return manager.get<Project>(STORE_PROJECTS, id);
  },

  async updateProject(id: number, project: Project): Promise<void> {
    const existing = await this.getProject(id);
    const updated = {
      ...existing,
      ...project,
      id,
      updatedAt: new Date(),
      syncStatus: 'pending'
    };
    await manager.put(STORE_PROJECTS, updated);
  },

  /**
   * Guarda la evidencia en IndexedDB (solo metadatos y referencia robusta a la foto de la galería).
   * En plataformas móviles (Android/iOS), la foto está en la galería nativa.
   * En Web, se guarda un respaldo temporal en STORE_PHOTOS para la vista previa de la app.
   */
  async addEvidence(evidence: Evidence, imageBase64: string): Promise<number> {
    const project = await this.getProject(evidence.projectId);
    const evidenceToSave: Evidence = {
      ...evidence,
      projectUuid: evidence.projectUuid || project?.uuid,
      updatedAt: new Date(),
      syncStatus: 'pending',
      retryCount: evidence.retryCount ?? 0,
      syncSchemaVersion: CURRENT_SYNC_SCHEMA_VERSION
    };

    // La fotografía se sube a Firebase Storage cuando hay conexión.
    // Si falla o estamos offline, queda temporalmente en IndexedDB para reintentar;
    // después de una subida exitosa se elimina esa copia temporal.
    if (imageBase64 && navigator.onLine && evidenceToSave.projectUuid) {
      try {
        const remote = await firebaseService.uploadEvidencePhoto(
          imageBase64,
          evidenceToSave.projectUuid,
          evidenceToSave.uuid,
          evidenceToSave.photoPath
        );
        evidenceToSave.photoStoragePath = remote.storagePath;
        evidenceToSave.photoUrl = remote.downloadUrl;
      } catch (uploadError) {
        console.warn('[StorageService] Foto pendiente de subida a Firebase Storage:', uploadError);
        const response = await fetch(imageBase64);
        const blob = await response.blob();
        await manager.put(STORE_PHOTOS, { id: evidenceToSave.photoPath, blob, createdAt: new Date() });
      }
    } else if (imageBase64) {
      const response = await fetch(imageBase64);
      const blob = await response.blob();
      await manager.put(STORE_PHOTOS, { id: evidenceToSave.photoPath, blob, createdAt: new Date() });
    }

    const evidenceId = await manager.add(STORE_EVIDENCES, evidenceToSave);

    // Sincroniza metadatos y referencias de la fotografía.
    if (navigator.onLine) {
      firebaseService.syncEvidenceToCloud(evidenceToSave).then(async (success) => {
        if (success) {
          evidenceToSave.syncStatus = 'synced';
          evidenceToSave.lastSyncedAt = new Date();
          if (evidenceId) {
            await manager.put(STORE_EVIDENCES, { ...evidenceToSave, id: evidenceId });
          }
          // Si ya existe en Storage, no necesitamos conservar la copia temporal local.
          if (evidenceToSave.photoUrl) {
            await manager.delete(STORE_PHOTOS, evidenceToSave.photoPath);
          }
        }
      }).catch(err => {
        console.error('[StorageService] Background sync failed:', err);
      });
    }

    return evidenceId;
  },

  /**
   * Prepara registros antiguos para sincronización sin borrar ni recrear datos.
   * Los registros existentes conservan su ID local; únicamente se agregan los
   * metadatos de sincronización que les falten.
   */
  async prepareLocalDataForSync(): Promise<void> {
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
   * Sincroniza proyectos y evidencias locales. Los registros antiguos sin estado
   * de sincronización también entran aquí. Las fotos nunca se suben.
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
        if (evidence.syncStatus === 'synced' && evidence.syncSchemaVersion === CURRENT_SYNC_SCHEMA_VERSION) continue;
        const project = projectById.get(evidence.projectId);
        const evidenceForCloud: Evidence = {
          ...evidence,
          projectUuid: evidence.projectUuid || project?.uuid
        };

        // Si la foto quedó temporalmente en IndexedDB por estar offline,
        // súbela primero y luego sincroniza sus metadatos.
        if (!evidenceForCloud.photoUrl && evidenceForCloud.photoPath && evidenceForCloud.projectUuid) {
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
          }
        }

        const success = await firebaseService.syncEvidenceToCloud(evidenceForCloud);
        if (success) {
          evidence.syncStatus = 'synced';
          evidence.lastSyncedAt = new Date();
          evidence.syncError = undefined;
          evidence.retryCount = 0;
          evidence.syncSchemaVersion = CURRENT_SYNC_SCHEMA_VERSION;
          if (evidence.id != null) await manager.put(STORE_EVIDENCES, evidence);
          if (evidence.photoUrl && evidence.photoPath) {
            await manager.delete(STORE_PHOTOS, evidence.photoPath);
          }
          evidencesSynced++;
        } else {
          evidence.syncStatus = 'failed';
          evidence.retryCount = (evidence.retryCount ?? 0) + 1;
          evidence.syncError = 'No se pudo sincronizar con Firebase.';
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

  async deleteProjects(projectIds: number[]): Promise<number> {
    let n = 0;
    for (const id of projectIds) {
      if (id == null) continue;
      await this.deleteProject(id);
      n += 1;
    }
    return n;
  },

  async saveTemplate(template: Template): Promise<number> {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : 'tpl_' + Date.now();
    return manager.add(STORE_TEMPLATES, { ...template, uuid });
  },

  async getTemplates(): Promise<Template[]> {
    return manager.getAll<Template>(STORE_TEMPLATES);
  }
};
