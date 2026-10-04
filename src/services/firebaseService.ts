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

// Authenticate anonymously so Firestore security rules (request.auth != null) pass successfully
export async function ensureAuthenticated(): Promise<string | null> {
  try {
    if (auth.currentUser) {
      return auth.currentUser.uid;
    }
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (error) {
    console.error('[Firebase] Error en autenticación anónima:', error);
    return null;
  }
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
    const safeName = (fileName || `FT_${evidenceUuid}`).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\\.(jpeg|jpg|png)$/i, '');
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

    if (evidence?.photoStoragePath) {
      await deleteObject(ref(storage, evidence.photoStoragePath));
    }

    const projectUuid = evidence?.projectUuid || `legacy_project_${evidence?.projectId || 'default'}`;
    const evidenceUuid = evidence?.uuid;
    if (evidenceUuid) {
      await deleteDoc(doc(db, 'projects', String(projectUuid), 'evidences', evidenceUuid));
    }
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

      // La nube usa UUID permanentes, no los IDs numéricos locales del dispositivo.
      // Esto permite que varios dispositivos puedan referirse al mismo proyecto.
      // projects/{projectUuid}/evidences/{evidenceUuid}
      const docRef = doc(db, 'projects', String(projectUuid), 'evidences', evidenceUuid);

      // Copia limpia sin objetos binarios ni datos pesados de foto
      const cloudPayload = {
        uuid: evidenceUuid,
        projectId: evidence.projectId,
        projectUuid,
        projectName: evidence.projectName || '',
        fecha: evidence.fecha || '',
        hora: evidence.hora || '',
        timestamp: evidence.timestamp || Date.now(),
        latitude: evidence.latitude || 0,
        longitude: evidence.longitude || 0,
        gpsAccuracy: evidence.gpsAccuracy || null,
        gpsCapturedAt: evidence.gpsCapturedAt ? new Date(evidence.gpsCapturedAt).toISOString() : null,
        ubicacion: evidence.ubicacion || '',
        tecnico: evidence.baseFields?.tecnico || '',
        posteId: evidence.baseFields?.posteId || '',
        observaciones: evidence.baseFields?.observaciones || '',
        materiales: evidence.baseFields?.materiales || '',
        customFields: evidence.customFields || [],
        photoPath: evidence.photoPath || '',
        photoStoragePath: evidence.photoStoragePath || '',
        photoUrl: evidence.photoUrl || '',
        category: evidence.category || 'OTROS',
        categoryLabel: evidence.categoryLabel || 'Otros',
        createdAt: evidence.createdAt ? new Date(evidence.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
        schemaVersion: 2
      };

      await setDoc(docRef, cloudPayload, { merge: true });
      console.log(`[Firebase] ✓ Evidencia ${evidenceUuid} sincronizada exitosamente a Firestore.`);
      return true;
    } catch (error) {
      console.error('[Firebase] ✗ Error sincronizando evidencia a Firestore:', error);
      return false;
    }
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
        uuid: projectUuid,
        id: project.id || null,
        name: project.name || '',
        client: project.client || '',
        description: project.description || '',
        techName: project.techName || '',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
        schemaVersion: 2
      };

      await setDoc(docRef, projectPayload, { merge: true });
      return true;
    } catch (e) {
      console.error('[Firebase] Error sincronizando proyecto:', e);
      return false;
    }
  }
};

export { db, auth };
