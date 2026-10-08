/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Firebase Initialization and Firestore service for Field Trace (Phase 3)
 * Cloud persistence: evidence deletion can remove the remote photo and metadata.
 * Evidence photos are stored in Firebase Storage; Firestore stores metadata and references.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId || '(default)');
const auth = getAuth(app);
const storage = getStorage(app);

// Authenticate anonymously so Firestore security rules (request.auth != null) pass successfully.
// Reutilizamos la misma promesa mientras la autenticación inicial está en curso.
// Esto evita varias llamadas concurrentes a signInAnonymously al arrancar la app.
let authenticationPromise: Promise<string | null> | null = null;

export async function ensureAuthenticated(): Promise<string | null> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  if (authenticationPromise) {
    return authenticationPromise;
  }

  authenticationPromise = (async () => {
    try {
      if (auth.currentUser) {
        return auth.currentUser.uid;
      }
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    } catch (error) {
      console.error('[Firebase] Error en autenticación anónima:', error);
      return null;
    } finally {
      authenticationPromise = null;
    }
  })();

  return authenticationPromise;
}

// Auto sign in on load
ensureAuthenticated().catch(console.error);

export const firebaseService = {
  /** Sube la fotografía original a Firebase Storage y devuelve su URL pública/autenticada. */
  async uploadEvidencePhoto(image: string | Blob, projectUuid: string, evidenceUuid: string, fileName: string): Promise<{ storagePath: string; downloadUrl: string }> {
    if (!image) throw new Error('No hay imagen para subir.');
    const uid = await ensureAuthenticated();
    if (!uid) throw new Error('No fue posible autenticar la sesión para subir la fotografía.');

    const blob = image instanceof Blob ? image : await (await fetch(image)).blob();
    const extension = blob.type === 'image/png' ? 'png' : 'jpg';
    // Normalizar la extensión correctamente para no generar nombres como
    // "FT_uuid.jpg.jpg" ni referencias inconsistentes al eliminar.
    const safeName = (fileName || `FT_${evidenceUuid}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\\.(jpeg|jpg|png)$/i, '');
    const storagePath = `projects/${projectUuid}/evidences/${evidenceUuid}/${safeName}.${extension}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg', cacheControl: 'public,max-age=31536000,immutable' });
    const downloadUrl = await getDownloadURL(storageRef);
    console.log(`[Firebase Storage] ✓ Fotografía ${evidenceUuid} subida: ${storagePath}`);
    return { storagePath, downloadUrl };
  },

  isOnline(): boolean {
    return navigator.onLine;
  },

  /**
   * Sincroniza una evidencia a Firestore.
   * NO sube ni almacena fotografías. Solo metadatos.
   */
  /** Elimina definitivamente la fotografía de Storage y su metadata de Firestore. */
  async deleteEvidenceFromCloud(evidence: any): Promise<void> {
    const uid = await ensureAuthenticated();
    if (!uid) throw new Error('No fue posible autenticar la sesión para eliminar la evidencia.');

    // Algunas evidencias históricas pueden conservar una photoStoragePath
    // antigua/mal formada. Intentamos primero la ruta persistida, luego la
    // URL real de Storage y finalmente variantes conocidas de la extensión.
    // Así la eliminación no queda bloqueada por una referencia antigua.
    const storageCandidates: string[] = [];
    const addCandidate = (value: unknown) => {
      const candidate = String(value || '').trim();
      if (candidate && !storageCandidates.includes(candidate)) storageCandidates.push(candidate);
    };

    addCandidate(evidence?.photoStoragePath);
    addCandidate(evidence?.photoUrl);

    const originalPath = String(evidence?.photoStoragePath || '').trim();
    if (originalPath) {
      const variants = [
        originalPath.replace(/\\.(jpeg|jpg|png)\\1$/i, '.$1'),
        originalPath.replace(/\\.(jpeg|jpg|png)\\.(jpeg|jpg|png)$/i, '.$2'),
        originalPath.replace(/(jpeg|jpg|png)\\1$/i, '.$1'),
        originalPath.replace(/\\.(jpeg|jpg|png)\\.(jpeg|jpg|png)$/i, '.$1'),
      ];
      variants.forEach(addCandidate);
    }

    let storageDeleted = false;
    let lastStorageError: any = null;

    for (const candidate of storageCandidates) {
      try {
        await deleteObject(ref(storage, candidate));
        storageDeleted = true;
        console.log(`[Firebase Storage] ✓ Fotografía eliminada: ${candidate}`);
        break;
      } catch (error: any) {
        lastStorageError = error;
        if (error?.code === 'storage/object-not-found') {
          continue;
        }
        throw error;
      }
    }

    // Si ninguna referencia apunta ya a un objeto, no bloqueamos la eliminación
    // del registro: object-not-found significa precisamente que ese objeto no
    // existe en la referencia consultada.
    if (!storageDeleted && lastStorageError && lastStorageError?.code !== 'storage/object-not-found') {
      throw lastStorageError;
    }

    const projectUuid = evidence?.projectUuid || `legacy_project_${evidence?.projectId || 'default'}`;
    const evidenceUuid = evidence?.uuid;
    if (evidenceUuid) {
      await deleteDoc(doc(db, 'projects', String(projectUuid), 'evidences', evidenceUuid));
    }
  },

  /**
   * Verifica que una fotografía ya subida a Storage siga disponible y recupera
   * su download URL. Sirve para recuperar el caso en que Storage terminó la
   * subida pero la app se cerró antes de guardar la URL localmente.
   */
  async getEvidencePhotoUrl(storagePath: string): Promise<string> {
    const uid = await ensureAuthenticated();
    if (!uid) throw new Error('No fue posible autenticar la sesión para consultar la fotografía.');
    if (!storagePath) throw new Error('No hay ruta de Storage para verificar.');
    return getDownloadURL(ref(storage, storagePath));
  },

  async syncEvidenceToCloud(evidence: any): Promise<boolean> {
    try {
      if (!navigator.onLine) {
        console.log('[Firebase] Sin conexión. La evidencia queda pendiente.');
        return false;
      }

      const uid = await ensureAuthenticated();
      if (!uid) {
        console.warn('[Firebase] No fue posible autenticar la sesión anónima.');
        return false;
      }

      const evidenceUuid = evidence.uuid || `ev_${Date.now()}`;
      const projectUuid = evidence.projectUuid || `legacy_project_${evidence.projectId || 'default'}`;
      const evidenceRequiresPhoto = Boolean(
        evidence.photoPath || evidence.photoUrl || evidence.photoStoragePath || evidence.photo?.uri
      );

      // Una evidencia fotográfica NO puede declararse sincronizada si no existe
      // una referencia verificable a Firebase Storage.
      if (evidenceRequiresPhoto && !evidence.photoUrl && !evidence.photoStoragePath) {
        console.warn(
          `[Firebase] Evidencia ${evidenceUuid} pendiente: no existe referencia confirmada a Storage.`
        );
        return false;
      }

      let verifiedPhotoUrl = evidence.photoUrl || '';
      if (evidenceRequiresPhoto && !verifiedPhotoUrl && evidence.photoStoragePath) {
        try {
          verifiedPhotoUrl = await getDownloadURL(ref(storage, evidence.photoStoragePath));
        } catch (storageError) {
          console.warn(
            `[Firebase] La fotografía ${evidenceUuid} no está disponible en Storage; no se marcará como sincronizada.`,
            storageError
          );
          return false;
        }
      }

      // La nube usa UUID permanentes, no los IDs numéricos locales del dispositivo.
      // projects/{projectUuid}/evidences/{evidenceUuid}
      const docRef = doc(db, 'projects', String(projectUuid), 'evidences', evidenceUuid);

      // Copia limpia sin objetos binarios ni datos pesados de foto
      const cloudPayload = {
        id: evidence.id ?? null,
        uuid: evidenceUuid,
        projectId: evidence.projectId ?? null,
        projectUuid,
        projectName: evidence.projectName || '',
        photoPath: evidence.photoPath || '',
        photoStoragePath: evidence.photoStoragePath || '',
        photoUrl: verifiedPhotoUrl || evidence.photoUrl || '',

        category: evidence.category || 'OTROS',
        categoryLabel: evidence.categoryLabel || 'Otros',

        capturedAt: evidence.capturedAt ? new Date(evidence.capturedAt).toISOString() : null,
        fecha: evidence.fecha || '',
        hora: evidence.hora || '',
        timestamp: evidence.timestamp ?? Date.now(),
        latitude: evidence.latitude ?? 0,
        longitude: evidence.longitude ?? 0,
        gpsAccuracy: evidence.gpsAccuracy ?? null,
        gpsCapturedAt: evidence.gpsCapturedAt ? new Date(evidence.gpsCapturedAt).toISOString() : null,
        ubicacion: evidence.ubicacion || '',

        baseFields: {
          posteId: evidence.baseFields?.posteId || '',
          tecnico: evidence.baseFields?.tecnico || '',
          observaciones: evidence.baseFields?.observaciones || '',
          materiales: evidence.baseFields?.materiales || ''
        },
        tecnico: evidence.baseFields?.tecnico || '',
        posteId: evidence.baseFields?.posteId || '',
        observaciones: evidence.baseFields?.observaciones || '',
        materiales: evidence.baseFields?.materiales || '',
        customFields: evidence.customFields || [],
        sharedWhatsApp: evidence.sharedWhatsApp ?? false,
        locked: evidence.locked ?? false,

        photo: evidence.photo ? {
          fileName: evidence.photo.fileName || '',
          uri: evidence.photo.uri || '',
          mimeType: evidence.photo.mimeType || '',
          createdAt: evidence.photo.createdAt ? new Date(evidence.photo.createdAt).toISOString() : null
        } : null,

        fiberPairId: evidence.fiberPairId || '',
        fiberPairNumber: evidence.fiberPairNumber ?? null,
        fiberMeterage: evidence.fiberMeterage ?? null,
        fiberReelNumber: evidence.fiberReelNumber || '',
        fiberCount: evidence.fiberCount ?? null,
        fiberSide: evidence.fiberSide || null,

        reserveId: evidence.reserveId || '',
        reserveNumber: evidence.reserveNumber ?? null,
        reserveSide: evidence.reserveSide || null,
        reserveReelNumber: evidence.reserveReelNumber || '',
        reserveFiberCount: evidence.reserveFiberCount ?? null,
        reserveMeterage: evidence.reserveMeterage ?? null,

        napId: evidence.napId || '',
        napNumber: evidence.napNumber ?? null,
        napName: evidence.napName || '',
        napPhotoNumber: evidence.napPhotoNumber ?? null,

        mufaId: evidence.mufaId || '',
        mufaNumber: evidence.mufaNumber ?? null,
        mufaName: evidence.mufaName || '',
        mufaPhotoNumber: evidence.mufaPhotoNumber ?? null,

        aceroId: evidence.aceroId || '',
        aceroNumber: evidence.aceroNumber ?? null,
        aceroSide: evidence.aceroSide || null,
        aceroPhotoType: evidence.aceroPhotoType || null,
        aceroMeterage: evidence.aceroMeterage ?? null,

        desechoId: evidence.desechoId || '',
        desechoNumber: evidence.desechoNumber ?? null,
        desechoSide: evidence.desechoSide || null,
        desechoPhotoType: evidence.desechoPhotoType || null,
        desechoMeterage: evidence.desechoMeterage ?? null,

        mejoraId: evidence.mejoraId || '',
        mejoraNumber: evidence.mejoraNumber ?? null,
        mejoraType: evidence.mejoraType || null,
        mejoraSide: evidence.mejoraSide || null,

        altaId: evidence.altaId || '',
        altaNumber: evidence.altaNumber ?? null,
        altaType: evidence.altaType || null,
        altaSide: evidence.altaSide || null,
        altaMeterage: evidence.altaMeterage ?? null,
        altaReelNumber: evidence.altaReelNumber || '',
        altaFiberCount: evidence.altaFiberCount ?? null,

        createdAt: evidence.createdAt ? new Date(evidence.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncCreatedAt: evidence.syncCreatedAt ? new Date(evidence.syncCreatedAt).toISOString() : null,
        syncUpdatedAt: evidence.syncUpdatedAt ? new Date(evidence.syncUpdatedAt).toISOString() : null,
        lastSyncedAt: new Date().toISOString(),
        retryCount: evidence.retryCount ?? 0,
        syncStatus: 'synced',
        schemaVersion: 3
      };

      await setDoc(docRef, cloudPayload, { merge: true });

      // Confirmación de lectura: no consideramos el registro "sincronizado"
      // hasta comprobar que Firestore realmente contiene el documento.
      const confirmation = await getDoc(docRef);
      if (!confirmation.exists()) {
        console.error(`[Firebase] ✗ Firestore no confirmó la evidencia ${evidenceUuid}.`);
        return false;
      }

      console.log(`[Firebase] ✓ Evidencia ${evidenceUuid} confirmada en Firestore + Storage.`);
      return true;
    } catch (error) {
      console.error('[Firebase] ✗ Error sincronizando evidencia a Firestore:', error);
      return false;
    }
  },

  /** Elimina definitivamente un proyecto compartido, sus evidencias y sus fotografías de Firebase. */
  async deleteCloudProject(projectUuid: string): Promise<void> {
    const uid = await ensureAuthenticated();
    if (!uid) throw new Error('No fue posible autenticar la sesión anónima.');
    if (!navigator.onLine) throw new Error('Se necesita conexión a Internet para eliminar un proyecto compartido.');

    const normalizedUuid = String(projectUuid);
    const evidenceSnapshot = await getDocs(collection(db, 'projects', normalizedUuid, 'evidences'));

    for (const evidenceDoc of evidenceSnapshot.docs) {
      const evidence: any = evidenceDoc.data();
      if (evidence?.photoStoragePath) {
        try {
          await deleteObject(ref(storage, evidence.photoStoragePath));
        } catch (error: any) {
          if (error?.code !== 'storage/object-not-found') throw error;
        }
      }
    }

    for (const evidenceDoc of evidenceSnapshot.docs) {
      await deleteDoc(evidenceDoc.ref);
    }
    await deleteDoc(doc(db, 'projects', normalizedUuid));
    console.log('[Firebase] Proyecto compartido ' + normalizedUuid + ' eliminado completamente.');
  },

  /** Obtiene los proyectos compartidos disponibles en Firebase para trabajar desde otro dispositivo. */
  async getCloudProjects(): Promise<any[]> {
    const uid = await ensureAuthenticated();
    if (!uid) throw new Error('No fue posible autenticar la sesión anónima.');
    const snapshot = await getDocs(collection(db, 'projects'));
    return snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter((project: any) => project.uuid || project.id)
      .sort((a: any, b: any) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
  },

  /** Obtiene todas las evidencias de un proyecto compartido desde Firestore. */
  async getCloudProjectEvidences(projectUuid: string): Promise<any[]> {
    const uid = await ensureAuthenticated();
    if (!uid) throw new Error('No fue posible autenticar la sesión anónima.');
    const snapshot = await getDocs(collection(db, 'projects', String(projectUuid), 'evidences'));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  },

  /**
   * Sincroniza un proyecto a Firestore (metadatos)
   */
  async syncProjectToCloud(project: any): Promise<boolean> {
    try {
      if (!navigator.onLine) return false;
      const uid = await ensureAuthenticated();
      if (!uid) {
        console.warn('[Firebase] No fue posible autenticar la sesión anónima.');
        return false;
      }

      const projectUuid = project.uuid || `proj_${Date.now()}`;
      // La ruta canónica del proyecto es su UUID permanente.
      const docRef = doc(db, 'projects', String(projectUuid));

      const projectPayload = {
        id: project.id ?? null,
        uuid: projectUuid,
        name: project.name || '',
        client: project.client || '',
        description: project.description || '',
        type: project.type || '',
        templateId: project.templateId ?? null,

        showDateTime: project.showDateTime ?? true,
        dateTimeFormat: project.dateTimeFormat || 'format1',
        showGps: project.showGps ?? true,
        showLocation: project.showLocation ?? true,
        showTech: project.showTech ?? true,

        techName: project.techName || '',
        customFields: project.customFields || [],
        locationFormat: project.locationFormat || 'completa',
        customLocationFormat: project.customLocationFormat || {
          road: false,
          suburb: false,
          city: false,
          state: false
        },

        allowPdf: project.allowPdf ?? true,
        allowExcel: project.allowExcel ?? true,
        overlayPosition: project.overlayPosition || 'top-left',
        fontSizeScale: project.fontSizeScale || 'medium',
        fontSizeValue: project.fontSizeValue ?? null,
        overlayColor: project.overlayColor || '',
        logoImage: project.logoImage || null,
        logoPosition: project.logoPosition || null,
        logoSize: project.logoSize ?? null,
        logoOpacity: project.logoOpacity ?? null,

        createdAt: project.createdAt ? new Date(project.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncCreatedAt: project.syncCreatedAt ? new Date(project.syncCreatedAt).toISOString() : null,
        syncUpdatedAt: project.syncUpdatedAt ? new Date(project.syncUpdatedAt).toISOString() : null,
        lastSyncedAt: new Date().toISOString(),
        retryCount: project.retryCount ?? 0,
        syncStatus: 'synced',
        schemaVersion: 3
      };

      await setDoc(docRef, projectPayload, { merge: true });

      // Confirmación de lectura para que el estado local "synced" solo se
      // establezca después de comprobar que el proyecto existe en Firestore.
      const confirmation = await getDoc(docRef);
      if (!confirmation.exists()) {
        console.error(`[Firebase] ✗ Firestore no confirmó el proyecto ${projectUuid}.`);
        return false;
      }

      console.log(`[Firebase] ✓ Proyecto ${projectUuid} confirmado en Firestore.`);
      return true;
    } catch (e) {
      console.error('[Firebase] Error sincronizando proyecto:', e);
      return false;
    }
  }
};

export { db, auth };