/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Plus, 
  MapPin, 
  Camera as CameraIcon, 
  Share2, 
  FileText, 
  ArrowLeft, 
  Settings, 
  LayoutGrid, 
  History,
  CheckCircle2,
  FileSpreadsheet,
  Archive,
  Search,
  Filter,
  Trash2,
  Save,
  RefreshCcw,
  UserCircle,
  ShieldCheck,
  CloudUpload,
  Calendar,
  X,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  Eye,
  BarChart3,
  ArrowUpRight,
  Lock,
  Unlock,
  Pencil,
  Zap,
  ZapOff,
  ZoomIn,
  Video,
  Square
} from 'lucide-react';
import { AutoResizingTextarea } from './components/AutoResizingTextarea';
import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';

function getFormattedLocationText(loc: any, selectedProject: any): string {
  if (!loc) return "Buscando...";
  let text = "";
  const format = selectedProject?.locationFormat || 'completa';

  if (format === 'completa') {
    const parts = loc.completa.split(',');
    text = parts.slice(0, 3).join(',').trim();
  } else if (format === 'distrito-canton') {
    text = `${loc.suburb || ''}, ${loc.city || ''}`.replace(/^, |, $/g, '').trim();
  } else if (format === 'ciudad-provincia') {
    text = `${loc.city || ''}, ${loc.state || ''}`.replace(/^, |, $/g, '').trim();
  } else if (format === 'personalizado') {
    const p = selectedProject.customLocationFormat || { road: true, suburb: true, city: true, state: true };
    const parts = [];
    if (p.road && loc.road) parts.push(loc.road);
    if (p.suburb && loc.suburb) parts.push(loc.suburb);
    if (p.city && loc.city) parts.push(loc.city);
    if (p.state && loc.state) parts.push(loc.state);
    text = parts.join(', ');
  }

  return text || "Ubicación detectada";
}

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

const getNapsPhotoTitle = (photoNumber?: number) =>
  NAPS_PHOTO_TITLES[(Number(photoNumber || 1) || 1) - 1] || ('FOTO ' + String(photoNumber || 1));

const formatDateTime = (format: 'format1' | 'format2') => {
  const now = new Date();
  if (format === 'format2') {
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
};

const LiveLocationOverlay = memo(({ selectedProject }: { selectedProject: any }) => {
  const [locState, setLocState] = useState(locationService.getCurrentState());

  useEffect(() => {
    return locationService.subscribe(() => {
      setLocState(locationService.getCurrentState());
    });
  }, []);

  const { gps, isLive, diagnostic, locationData } = locState;
  const formattedLocation = getFormattedLocationText(locationData, selectedProject);

  let gpsLabel = 'SIN GPS';
  let gpsColor = 'text-yellow-400 animate-pulse';

  // Prioridad: si el GPS del teléfono está apagado o sin permiso, NO mostrar caché
  if (diagnostic?.status === 'location_disabled' || diagnostic?.locationServicesEnabled === false) {
    gpsLabel = 'SIN GPS (GPS DESACTIVADO)';
    gpsColor = 'text-red-400';
  } else if (diagnostic?.status === 'permission_denied') {
    gpsLabel = 'SIN GPS (PERMISOS DENEGADOS)';
    gpsColor = 'text-red-400';
  } else if (gps) {
    if (isLive) {
      gpsLabel = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
      gpsColor = 'text-green-400';
    } else {
      gpsLabel = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} (CACHÉ)`;
      gpsColor = 'text-amber-300';
    }
  } else if (diagnostic?.status === 'acquiring') {
    gpsLabel = 'BUSCANDO GPS...';
    gpsColor = 'text-yellow-400 animate-pulse';
  }

  return (
    <>
      {selectedProject.showGps && (
        <p className={`line-clamp-4 break-words whitespace-pre-wrap ${gpsColor}`}>
          {gpsLabel}
        </p>
      )}
      {selectedProject.showLocation && formattedLocation && formattedLocation !== "Buscando..." && (
        <p className="line-clamp-4 break-words whitespace-pre-wrap">{formattedLocation.toUpperCase()}</p>
      )}
    </>
  );
});

// Inside App.tsx
// I will replace the state variables later.

/** Metadata-only card - photos live only in native gallery Field Trace */
const EvidenceCard = memo(({ evidence }: { evidence: any }) => {
  const hasGps = evidence.latitude && evidence.longitude && !(evidence.latitude === 0 && evidence.longitude === 0);
  const gpsText = evidence.gpsLabel || (hasGps
    ? `${Number(evidence.latitude).toFixed(5)}, ${Number(evidence.longitude).toFixed(5)}`
    : 'SIN GPS');
  const tech = evidence.baseFields?.tecnico || '-';
  const fields = (evidence.customFields || [])
    .filter((f: any) => f.active !== false && f.showInPhoto)
    .slice(0, 3);

  return (
    <div className="aspect-[4/5] rounded-[2rem] overflow-hidden border border-gray-100 relative group shadow-sm bg-white flex flex-col p-4">
      <div className="absolute top-3 left-3 flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
      </div>
      <div className="mt-4 space-y-1.5 flex-1 min-h-0 overflow-hidden">
        <p className="text-[10px] font-black uppercase text-gray-950 tracking-tight line-clamp-2">
          {evidence.projectName || 'Evidencia'}
        </p>
        <p className="text-[9px] font-mono text-gray-500">{evidence.fecha} {evidence.hora || ''}</p>
        <p className={`text-[9px] font-mono ${hasGps ? 'text-green-600' : 'text-amber-600'}`}>{gpsText}</p>
        {evidence.ubicacion && evidence.ubicacion !== 'Pendiente de geocodificación' && evidence.ubicacion !== '' && (
          <p className="text-[8px] text-gray-400 line-clamp-2 uppercase">{evidence.ubicacion}</p>
        )}
        <p className="text-[9px] font-bold text-gray-700 uppercase">{tech}</p>
        {fields.map((f: any, i: number) => (
          <p key={i} className="text-[8px] text-gray-500 uppercase truncate">
            {f.value ? `${f.name}: ${f.value}` : f.name}
          </p>
        ))}
      </div>
      <div className="mt-auto pt-2 border-t border-gray-50">
        <p className="text-[7px] text-gray-300 font-mono truncate" title={evidence.photoPath}>
          ref: {evidence.photoPath || evidence.uuid || '-'}
        </p>
      </div>
    </div>
  );
});

const EvidenceImage = memo(({ photoId, className }: { photoId: string, className?: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    let observer: IntersectionObserver | null = null;

    const load = async () => {
      const blobUrl = await storageService.getPhotoBlob(photoId);
      if (active && blobUrl) {
        objectUrl = blobUrl;
        setUrl(blobUrl);
      }
    };

    if (imgRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          load();
          observer?.disconnect();
        }
      }, { rootMargin: '100px' });
      observer.observe(imgRef.current);
    }

    return () => {
      active = false;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (url && url !== objectUrl) URL.revokeObjectURL(url);
    };
  }, [photoId]);

  if (!url) return <div ref={imgRef} className={`${className} bg-gray-100 flex items-center justify-center`}><RefreshCcw className="w-5 h-5 text-gray-300 animate-spin" /></div>;
  return <img ref={imgRef as any} src={url} className={className} alt="Evidencia" />;
});
import { CameraPreview } from '@capgo/camera-preview';
import { Capacitor } from '@capacitor/core';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { storageService } from './services/storageService';
import { firebaseService } from './services/firebaseService';
import { exportService } from './services/exportService';
import { generateMemoryExcel } from './services/memoryExcelService';
import { generateMemoryPhotosZip } from './services/memoryPhotosZipService';
import { cameraService } from './services/cameraService';
import { locationService } from './services/locationService';
import { shareService } from './services/shareService';
import { EVIDENCE_CATEGORIES, type EvidenceCategory, type Project, type Evidence, type CustomField, type Template } from './types';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cloudProjects, setCloudProjects] = useState<any[]>([]);
  const [cloudSearchTerm, setCloudSearchTerm] = useState("");
  const [showCloudProjects, setShowCloudProjects] = useState(false);
  const [cloudProjectsLoading, setCloudProjectsLoading] = useState(false);
  const [cloudImportingUuid, setCloudImportingUuid] = useState<string | null>(null);
  const [memoryProjects, setMemoryProjects] = useState<any[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memorySelectedProject, setMemorySelectedProject] = useState<any | null>(null);
  const [memoryProjectSearch, setMemoryProjectSearch] = useState("");
  const [memorySelectedCategory, setMemorySelectedCategory] = useState<string | null>(null);
  const [memorySelectedPhoto, setMemorySelectedPhoto] = useState<any | null>(null);
  const [memoryExcelLoading, setMemoryExcelLoading] = useState(false);\n  const [memoryZipLoading, setMemoryZipLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  // Categoría seleccionada por el técnico antes de capturar la evidencia.
  const [evidenceCategory, setEvidenceCategory] = useState<EvidenceCategory | null>(null);
  const [fiberCaptureDraft, setFiberCaptureDraft] = useState<{
    side: 'initial' | 'final';
    pairId: string;
    pairNumber: number;
    metraje: string;
    reelNumber: string;
    fiberCount: string;
  } | null>(null);
  const [showFiberCaptureModal, setShowFiberCaptureModal] = useState(false);
  const [showFiberPairSelector, setShowFiberPairSelector] = useState(false);
  const [reserveCaptureDraft, setReserveCaptureDraft] = useState<{
    side: 'initial' | 'final' | 'roll';
    reserveId: string;
    reserveNumber: number;
    reelNumber: string;
    fiberCount: string;
    metraje: string;
  } | null>(null);
  const [showReserveCaptureModal, setShowReserveCaptureModal] = useState(false);
  const [napCaptureDraft, setNapCaptureDraft] = useState<{
    napId: string;
    napNumber: number;
    napName: string;
    photoNumber: number;
    remainingPhotos: number;
  } | null>(null);
  const [showNapCaptureModal, setShowNapCaptureModal] = useState(false);
  const [mufaCaptureDraft, setMufaCaptureDraft] = useState<{
    mufaId: string;
    mufaNumber: number;
    mufaName: string;
    photoNumber: number;
    remainingPhotos: number;
  } | null>(null);
  const [showMufaCaptureModal, setShowMufaCaptureModal] = useState(false);
  const [altaCaptureDraft, setAltaCaptureDraft] = useState<{
    altaId: string;
    altaNumber: number;
    altaType: 'FIBRA DE DESCARTE' | 'FIBRA DE DESECHO' | 'ALTAS EN ACERO';
    side: 'panoramic' | 'meterage';
  } | null>(null);
  const [showAltaCaptureModal, setShowAltaCaptureModal] = useState(false);
  const [altaPromptMode, setAltaPromptMode] = useState<'type' | 'meterage' | null>(null);
  const [altaMeterageDraft, setAltaMeterageDraft] = useState('');
  const [altaReelDraft, setAltaReelDraft] = useState('');
  const [altaFiberCountDraft, setAltaFiberCountDraft] = useState('');
  const [aceroCaptureDraft, setAceroCaptureDraft] = useState<{
    aceroId: string;
    aceroNumber: number;
    side: 'photo1' | 'photo2';
  } | null>(null);
  const [aceroSetChoice, setAceroSetChoice] = useState<{
    aceroId: string;
    aceroNumber: number;
    missingSide: 'photo1' | 'photo2';
  } | null>(null);
  const [showAceroCaptureModal, setShowAceroCaptureModal] = useState(false);
  const [aceroPromptMode, setAceroPromptMode] = useState<'type' | 'meterage' | null>(null);
  const [aceroMeterageDraft, setAceroMeterageDraft] = useState('');

  const [desechoCaptureDraft, setDesechoCaptureDraft] = useState<{
    desechoId: string;
    desechoNumber: number;
    side: 'photo1' | 'photo2';
  } | null>(null);
  const [desechoSetChoice, setDesechoSetChoice] = useState<{
    desechoId: string;
    desechoNumber: number;
    missingSide: 'photo1' | 'photo2';
  } | null>(null);
  const [showDesechoCaptureModal, setShowDesechoCaptureModal] = useState(false);
  const [desechoPromptMode, setDesechoPromptMode] = useState<'type' | 'meterage' | null>(null);
  const [desechoMeterageDraft, setDesechoMeterageDraft] = useState('');
  const [mejoraCaptureDraft, setMejoraCaptureDraft] = useState<{
    mejoraId: string;
    mejoraNumber: number;
    mejoraType: 'SUBIDA DE BANDAS' | 'PODAS' | 'SUBIDA DE RETENIDAS';
    side: 'before' | 'after';
  } | null>(null);
  const [mejoraSetChoice, setMejoraSetChoice] = useState<{
    mejoraId: string;
    mejoraNumber: number;
    mejoraType: 'SUBIDA DE BANDAS' | 'PODAS' | 'SUBIDA DE RETENIDAS';
    missingSide: 'before' | 'after';
  } | null>(null);
  const [showMejoraCaptureModal, setShowMejoraCaptureModal] = useState(false);
  const [mejoraPromptMode, setMejoraPromptMode] = useState<'type' | 'side' | null>(null);
  const [currentStep, setCurrentStep] = useState<'home' | 'history' | 'setup' | 'camera' | 'summary' | 'memory'>('home');
  const [cameraPermissionTick, setCameraPermissionTick] = useState(0);
  const [webCameraRetryTick, setWebCameraRetryTick] = useState(0);
  const [webCameraError, setWebCameraError] = useState<string | null>(null);
  const [nativeCameraError, setNativeCameraError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  // Anti doble-tap sin bloquear UI: ref no re-renderiza ni muestra spinner
  const capturingRef = useRef(false);
  // NAPS se procesa de forma secuencial para impedir una décima captura
  // mientras la evidencia anterior todavía está guardándose.
  const napCaptureInFlightRef = useRef(false);
  const mufaCaptureInFlightRef = useRef(false);
  const activeSetCaptureLockRef = useRef<string | null>(null);
  // MEJORAS: bloqueo lógico de un solo disparo por lado (ANTES/DESPUÉS).
  // Impide duplicados por doble toque mientras la evidencia se procesa.
  const mejoraCaptureInFlightRef = useRef(false);
  const [unlockedSettings, setUnlockedSettings] = useState<Record<string, boolean>>({});
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [showLastImage, setShowLastImage] = useState(false);
  const [showGalleryGrid, setShowGalleryGrid] = useState(false);
  const [galleryThumbs, setGalleryThumbs] = useState<Array<{ uri: string; thumb: string }>>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [gallerySelectMode, setGallerySelectMode] = useState(false);
  const [selectedGalleryUris, setSelectedGalleryUris] = useState<string[]>([]);
  const [confirmDeleteGalleryStep, setConfirmDeleteGalleryStep] = useState<0 | 1 | 2>(0);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerFullImages, setViewerFullImages] = useState<Record<string, string>>({});
  const [showEvidenceList, setShowEvidenceList] = useState(false);
  const [showStorageEvidenceViewer, setShowStorageEvidenceViewer] = useState(false);
  const [storageEvidenceCategory, setStorageEvidenceCategory] = useState<EvidenceCategory | null>(null);
  const [pendingMemoryUpload, setPendingMemoryUpload] = useState<{ category: EvidenceCategory; napId: string; napNumber: number; napName: string; photoNumber: number } | null>(null);
  const memoryUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [memoryUploadLoading, setMemoryUploadLoading] = useState(false);
  const [showQuickConfig, setShowQuickConfig] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'project' | 'field' | 'evidence', id?: number, index?: number } | null>(null);
  const [confirmClearAllStep, setConfirmClearAllStep] = useState<0 | 1 | 2>(0);
  const [projectSelectMode, setProjectSelectMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [confirmDeleteProjectsStep, setConfirmDeleteProjectsStep] = useState<0 | 1 | 2>(0);
  const [pendingDeleteProjectIds, setPendingDeleteProjectIds] = useState<number[]>([]);
  const [pendingCloudDeleteProject, setPendingCloudDeleteProject] = useState<{ uuid: string; name: string } | null>(null);
  const [cloudDeleteStep, setCloudDeleteStep] = useState<0 | 1 | 2>(0);
  const [cloudDeleteRunning, setCloudDeleteRunning] = useState(false);
  const [viewingEvidence, setViewingEvidence] = useState<any | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<any | null>(null);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEditSave, setPendingEditSave] = useState<any | null>(null);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [cameraFacing, setCameraFacing] = useState<'rear' | 'front'>('rear');
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoProcessing, setVideoProcessing] = useState(false);
  const videoStartedAtRef = useRef<number | null>(null);
  const videoRecordingPathRef = useRef<string | null>(null);
  const webCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const webCameraStreamRef = useRef<MediaStream | null>(null);
  const isNativeCamera = Capacitor.isNativePlatform();

  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    void CameraPreview.addListener('recordingFinished', (event: { videoFilePath?: string; reason?: string }) => {
      if (event?.videoFilePath) {
        videoRecordingPathRef.current = event.videoFilePath;
        console.log('[Video] recordingFinished:', event.videoFilePath, event.reason || 'manual');
      }
    }).then(handle => {
      listenerHandle = handle;
    }).catch(error => {
      console.warn('[Video] recordingFinished listener unavailable:', error);
    });
    return () => {
      if (listenerHandle) void listenerHandle.remove().catch(() => {});
    };
  }, []);

  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);


  // Filters for Summary View
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterTech, setFilterTech] = useState<string>("");
  const [filterField, setFilterField] = useState<string>("");

  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [syncSummary, setSyncSummary] = useState({
    total: 0, synced: 0, pending: 0, failed: 0,
    projectsSynced: 0, projectsPending: 0, projectsFailed: 0,
    lastSyncedAt: null as Date | null
  });
  const [syncProjectDetails, setSyncProjectDetails] = useState<Array<{
    id: number;
    name: string;
    client: string;
    status: 'synced' | 'pending' | 'failed';
    total: number;
    synced: number;
    pending: number;
    failed: number;
    lastSyncedAt: Date | null;
  }>>([]);
  const [syncProblemRecords, setSyncProblemRecords] = useState<Evidence[]>([]);
  const [syncRunning, setSyncRunning] = useState(false);
  const [retryingEvidenceId, setRetryingEvidenceId] = useState<number | null>(null);

  const applyNativeZoom = async (level: number) => {
    const next = Math.max(1, Math.min(8, Math.round(level * 10) / 10));
    setCameraZoom(next);
    if (!isNativeCamera) return;
    try { await CameraPreview.setZoom({ level: next }); } catch (error) { console.warn('[Camera] zoom:', error); }
  };
  const cycleZoom = () => { const next = cameraZoom >= 3 ? 1 : cameraZoom >= 2 ? 3 : 2; void applyNativeZoom(next); };
  const onCameraTouchStart = (e: TouchEvent) => { if (e.touches.length===2) { const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY; pinchStartDist.current=Math.hypot(dx,dy); pinchStartZoom.current=cameraZoom; } };
  const onCameraTouchMove = (e: TouchEvent) => { if (e.touches.length===2 && pinchStartDist.current) { const dx=e.touches[0].clientX-e.touches[1].clientX, dy=e.touches[0].clientY-e.touches[1].clientY; void applyNativeZoom(Math.max(1,Math.min(8,pinchStartZoom.current*(Math.hypot(dx,dy)/pinchStartDist.current)))); } };
  const onCameraTouchEnd = () => { pinchStartDist.current=null; };

  const switchCameraFacing = async () => {
    if (capturingRef.current) return;
    const nextFacing = cameraFacing === 'rear' ? 'front' : 'rear';
    try {
      // En Android reiniciamos el preview nativo; en navegador el efecto reinicia getUserMedia.
      if (isNativeCamera) await CameraPreview.stop({ force: true }).catch(() => {});
      setCameraFacing(nextFacing);
    } catch (error) {
      console.warn('[Camera] switch facing:', error);
    }
  };

  const ensureFlashArmed = async (targetMode: 'off' | 'on') => {
    try {
      if (targetMode === 'on') {
        // En Android CameraX / CameraPreview, tras takePicture() el hardware requiere
        // que el estado se re-arme explícitamente en el pipeline nativo para que cada
        // fotografía consecutiva dispare el flash físico sin reiniciar la cámara.
        await CameraPreview.setFlashMode({ flashMode: 'off' }).catch(() => {});
        await CameraPreview.setFlashMode({ flashMode: 'on' });
        const check = await CameraPreview.getFlashMode().catch(() => null);
        if (check && check.flashMode !== 'on') {
          await CameraPreview.setFlashMode({ flashMode: 'on' });
        }
      } else {
        await CameraPreview.setFlashMode({ flashMode: 'off' });
      }
    } catch (err) {
      console.warn('[Camera] ensureFlashArmed error:', err);
    }
  };

  useEffect(() => {
    if (currentStep !== 'camera') return;
    const onCameraPermission = () => setCameraPermissionTick(v => v + 1);
    window.addEventListener('fieldtrace-camera-permission', onCameraPermission);
    return () => window.removeEventListener('fieldtrace-camera-permission', onCameraPermission);
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 'camera') return;
    let active = true;
    void locationService.startWatching();
    void locationService.getCurrentPosition();

    if (!isNativeCamera) {
      setWebCameraError(null);

      const startWebCamera = async () => {
        const stopExistingStream = () => {
          const existing = webCameraStreamRef.current;
          if (existing) {
            existing.getTracks().forEach(track => {
              try { track.stop(); } catch {}
            });
          }
          webCameraStreamRef.current = null;
          const currentVideo = webCameraVideoRef.current;
          if (currentVideo) {
            try { currentVideo.pause(); } catch {}
            currentVideo.srcObject = null;
          }
        };

        try {
          if (!window.isSecureContext) throw new Error('SECURE_CONTEXT');
          if (!navigator.mediaDevices?.getUserMedia) throw new Error('NO_GET_USER_MEDIA');

          stopExistingStream();

          // Mantener el flujo web sencillo y compatible con Brave/Chrome Android.
          // Mantener el flujo web sencillo y compatible con Brave/Chrome Android.
          // Las restricciones "ideal" no deben impedir que el preview entregue frames.
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: cameraFacing === 'rear' ? { ideal: 'environment' } : { ideal: 'user' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },              audio: false
            });
          } catch (firstError: any) {
            const name = String(firstError?.name || '');
            if (!['OverconstrainedError', 'NotFoundError', 'AbortError'].includes(name)) throw firstError;
            console.warn('[WebCamera] retrying with basic video:', firstError);
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }

          if (!active) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }

          const tracks = stream.getVideoTracks();
          if (!tracks.length || tracks[0].readyState !== 'live') {
            stream.getTracks().forEach(track => track.stop());
            throw new Error('NO_LIVE_VIDEO_TRACK');
          }

          webCameraStreamRef.current = stream;

          // En móviles el ref puede tardar un frame en quedar montado. Esperamos explícitamente
          // el elemento en lugar de fallar y dejar una pantalla negra.
          let video: HTMLVideoElement | null = null;
          for (let i = 0; i < 40 && active; i++) {
            video = webCameraVideoRef.current;
            if (video) break;
            await new Promise(resolve => window.setTimeout(resolve, 50));
          }
          if (!video) throw new Error('VIDEO_ELEMENT_NOT_READY');

          video.autoplay = true;
          video.muted = true;
          video.defaultMuted = true;
          video.playsInline = true;
          video.setAttribute('autoplay', 'true');
          video.setAttribute('muted', 'true');
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.style.display = 'block';
          video.style.visibility = 'visible';
          video.style.opacity = '1';

          // No llamar video.load() después de asignar MediaStream: load() reinicia
          // el elemento y puede abortar el flujo recién asociado.
          video.srcObject = stream;

          try {
            await video.play();
          } catch (playError) {
            console.warn('[WebCamera] play() retry:', playError);
            await new Promise(resolve => window.setTimeout(resolve, 250));
            if (!active) return;
            await video.play();
          }

          if (!active) return;

          // Esperar realmente a que Chromium entregue dimensiones/frame.
          const deadline = Date.now() + 6000;
          while (active && Date.now() < deadline) {
            if (video.videoWidth > 0 && video.videoHeight > 0 && tracks[0].readyState === 'live') break;
            await new Promise(resolve => window.setTimeout(resolve, 100));
          }

          if (video.videoWidth <= 0 || video.videoHeight <= 0 || tracks[0].readyState !== 'live') {
            throw new Error('VIDEO_NO_FRAMES');
          }

          try { await video.play(); } catch {}
          if (!active) return;

          setWebCameraError(null);
          console.log('[WebCamera] ready:', {
            facing: cameraFacing,
            width: video.videoWidth,
            height: video.videoHeight,
            track: tracks[0].getSettings?.() || {}
          });
        } catch (error: any) {
          if (!active) return;
          const name = String(error?.name || '');
          const detail = String(error?.message || '');
          console.error('[WebCamera] start:', { name, message: detail, error });

          const friendly =
            error?.message === 'SECURE_CONTEXT'
              ? 'El navegador no considera esta página segura para usar la cámara.'
              : error?.message === 'NO_GET_USER_MEDIA'
                ? 'Este navegador no permite acceso a la cámara desde esta página.'
                : error?.message === 'VIDEO_ELEMENT_NOT_READY'
                  ? 'La vista de cámara todavía no está lista. Intente nuevamente.'
                  : error?.message === 'VIDEO_NO_FRAMES' || error?.message === 'NO_LIVE_VIDEO_TRACK'
                    ? 'La cámara abrió, pero el navegador no está entregando imagen.'
                    : name === 'NotAllowedError' || name === 'SecurityError'
                      ? 'El permiso de cámara está bloqueado. Permita la cámara para este sitio y pulse REINTENTAR.'
                      : name === 'NotFoundError'
                        ? 'No se encontró una cámara disponible en el navegador.'
                        : name === 'NotReadableError'
                          ? 'La cámara está siendo utilizada por otra aplicación o el navegador no puede acceder al hardware.'
                          : name === 'AbortError'
                            ? 'El navegador interrumpió el acceso a la cámara. Pulse REINTENTAR.'
                            : 'No se pudo abrir la cámara' + (detail ? ': ' + detail : '.');

          setWebCameraError(friendly);
        }
      };

      void startWebCamera();

      return () => {
        active = false;
        const stream = webCameraStreamRef.current;
        if (stream) stream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
        webCameraStreamRef.current = null;
        if (webCameraVideoRef.current) {
          try { webCameraVideoRef.current.pause(); } catch {}
          webCameraVideoRef.current.srcObject = null;
        }
      };
    }

    document.documentElement.classList.add('native-camera-active');
    setNativeCameraError(null);

    (async () => {
      try {
        const permission = await CameraPreview.checkPermissions({ disableAudio: true });
        let cameraPermission = permission?.camera;
        if (cameraPermission !== 'granted') {
          const requested = await CameraPreview.requestPermissions({
            disableAudio: true,
            showSettingsAlert: true,
            title: 'Permiso de cámara',
            message: 'Field Trace necesita la cámara para tomar fotografías de evidencia.'
          });
          cameraPermission = requested?.camera;
        }
        if (cameraPermission !== 'granted') {
          throw new Error('CAMERA_PERMISSION_DENIED');
        }

        await CameraPreview.stop({ force: true }).catch(() => {});

        // Preview fotográfico estable. No activamos el modo de video aquí:
        // la captura de fotos usa CameraPreview.capture().
        const started = await CameraPreview.start({
          position: cameraFacing,
          toBack: true,
          aspectRatio: '16:9',
          aspectMode: 'cover',
          storeToFile: false,
          disableAudio: true,
          initialZoomLevel: 1,
          rotateWhenOrientationChanged: true
        });

        if (!active) return;

        const previewWidth = Math.max(1, Math.round(window.innerWidth));
        const previewHeight = Math.max(1, Math.round(window.innerHeight));
        await CameraPreview.setPreviewSize({
          x: 0,
          y: 0,
          width: previewWidth,
          height: previewHeight
        }).catch(() => {});

        console.log('[Camera] native preview ready:', started);
        await CameraPreview.setZoom({ level: cameraZoom });
        await ensureFlashArmed(flashMode);
        setNativeCameraError(null);
      } catch (error: any) {
        if (!active) return;
        console.error('[Camera] start:', error);
        const name = String(error?.name || '');
        const message = String(error?.message || '');
        const detail = name || message ? ' (' + (name || message) + ')' : '.';
        setNativeCameraError(
          message === 'CAMERA_PERMISSION_DENIED'
            ? 'El permiso de cámara está bloqueado. Permita la cámara para Field Trace y vuelva a intentarlo.'
            : 'No se pudo iniciar la cámara nativa' + detail
        );
      }
    })();

    return () => {
      active = false;
      void CameraPreview.setFlashMode({ flashMode: 'off' }).catch(() => {});
      void CameraPreview.stop({ force: true }).catch((error) => console.warn('[Camera] stop:', error));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, cameraFacing, isNativeCamera, cameraPermissionTick, webCameraRetryTick]);

  useEffect(() => {
    if (currentStep !== 'camera') return;
    void ensureFlashArmed(flashMode);
  }, [flashMode, currentStep]);


  useEffect(() => {
    document.documentElement.classList.toggle('native-camera-active', currentStep === 'camera');
    return () => document.documentElement.classList.remove('native-camera-active');
  }, [currentStep]);

  // Load last Field Trace album thumbnail when entering camera (survives app restart)
  useEffect(() => {
    if (currentStep !== 'camera') return;
    let cancelled = false;
    (async () => {
      try {
        const thumb = await cameraService.getLastThumbnail(256);
        if (!cancelled && thumb) setLastImage(thumb);
      } catch (e) {
        console.warn('[Gallery] load last thumb:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentStep]);

  useEffect(() => {
    loadData();
    void locationService.checkAndRequestPermissions().then(() => {
      void locationService.startWatching();
    });
    return () => {
      void locationService.stopWatching();
    };
  }, []);

  const refreshSyncSummary = useCallback(async () => {
    try {
      const [allEvidences, allProjects] = await Promise.all([
        storageService.getAllEvidences(),
        storageService.getAllProjects()
      ]);

      const evidenceSynced = allEvidences.filter(e => e.syncStatus === 'synced').length;
      const evidencePending = allEvidences.filter(e => e.syncStatus === 'pending').length;
      const evidenceFailed = allEvidences.filter(e => e.syncStatus === 'failed').length;
      const projectSynced = allProjects.filter(p => p.syncStatus === 'synced').length;
      const projectPending = allProjects.filter(p => p.syncStatus === 'pending').length;
      const projectFailed = allProjects.filter(p => p.syncStatus === 'failed').length;

      const dates = [
        ...allEvidences.map(e => e.lastSyncedAt).filter(Boolean),
        ...allProjects.map(p => p.lastSyncedAt).filter(Boolean)
      ].map(d => new Date(d as any)).filter(d => !Number.isNaN(d.getTime()));

      const details = allProjects.map(project => {
        const projectEvidences = allEvidences.filter(e => e.projectId === project.id);
        const synced = projectEvidences.filter(e => e.syncStatus === 'synced').length;
        const pending = projectEvidences.filter(e => e.syncStatus === 'pending').length;
        const failed = projectEvidences.filter(e => e.syncStatus === 'failed').length;
        const projectDates = [
          project.lastSyncedAt,
          ...projectEvidences.map(e => e.lastSyncedAt)
        ]
          .filter(Boolean)
          .map(d => new Date(d as any))
          .filter(d => !Number.isNaN(d.getTime()));

        const status: 'synced' | 'pending' | 'failed' =
          failed > 0 ? 'failed' : pending > 0 ? 'pending' : 'synced';

        return {
          id: project.id!,
          name: project.name || 'Proyecto sin nombre',
          client: project.client || 'Sin cliente',
          status,
          total: projectEvidences.length,
          synced,
          pending,
          failed,
          lastSyncedAt: projectDates.length
            ? new Date(Math.max(...projectDates.map(d => d.getTime())))
            : null
        };
      }).sort((a, b) => {
        const priority = { failed: 0, pending: 1, synced: 2 };
        return priority[a.status] - priority[b.status] || b.total - a.total;
      });

      setSyncSummary({
        total: allEvidences.length,
        synced: evidenceSynced,
        pending: evidencePending,
        failed: evidenceFailed,
        projectsSynced: projectSynced,
        projectsPending: projectPending,
        projectsFailed: projectFailed,
        lastSyncedAt: dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null
      });
      setSyncProjectDetails(details);
      setSyncProblemRecords(allEvidences.filter(e => e.syncStatus === 'pending' || e.syncStatus === 'failed'));
    } catch (error) {
      console.warn('[Sync UI] No se pudo actualizar el resumen:', error);
    }
  }, []);

  const runSyncNow = useCallback(async () => {
    if (syncRunning) return;
    setSyncRunning(true);
    try {
      await storageService.syncAllLocalData();
    } finally {
      await refreshSyncSummary();
      setSyncRunning(false);
    }
  }, [refreshSyncSummary, syncRunning]);

  const retrySyncEvidence = useCallback(async (id: number) => {
    if (retryingEvidenceId != null) return;
    setRetryingEvidenceId(id);
    try {
      await storageService.retryEvidenceSync(id);
    } finally {
      await refreshSyncSummary();
      setRetryingEvidenceId(null);
    }
  }, [refreshSyncSummary, retryingEvidenceId]);

  useEffect(() => {
    const syncNow = async () => {
      await storageService.syncAllLocalData();
      await refreshSyncSummary();
    };
    void syncNow();
    window.addEventListener('online', syncNow);
    const interval = window.setInterval(() => { void refreshSyncSummary(); }, 2500);
    return () => {
      window.removeEventListener('online', syncNow);
      window.clearInterval(interval);
    };
  }, [refreshSyncSummary]);

  const loadData = async () => {
    // OFFLINE-FIRST REAL:
    // 1) Los proyectos locales se muestran inmediatamente.
    // 2) Firebase se consulta en segundo plano y actualiza la lista cuando termina.
    // Nunca hacemos que la pantalla inicial dependa de la latencia de Firebase.
    const sortProjects = (items: Project[]) => [...items].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    const restoreSession = (items: Project[]) => {
      const storedStep = sessionStorage.getItem('activeStep');
      const storedProjectId = sessionStorage.getItem('activeProjectId');
      if (!storedProjectId) return;

      const foundProject = items.find(p => p.id === Number(storedProjectId));
      if (foundProject) {
        setSelectedProject(foundProject);
        if (storedStep) {
          setCurrentStep(storedStep as 'home' | 'history' | 'setup' | 'camera' | 'summary' | 'memory');
        }
      }
    };

    const createDemoProject = async () => {
      const demoId = await storageService.createProject({
        name: "PROYECTO DEMO",
        client: "CLIENTE EJEMPLO",
        showDateTime: true,
        dateTimeFormat: "format1",
        showGps: true,
        showLocation: true,
        showTech: true,
        techName: "TÉCNICO DEMO",
        customFields: [
          { name: "Material", value: "Cable FO", showInPhoto: true, active: true },
          { name: "Cantidad", value: "02 UNID", showInPhoto: true, active: true },
        ],
        locationFormat: 'completa',
        customLocationFormat: { road: true, suburb: true, city: true, state: true },
        allowPdf: true,
        allowExcel: true,
        overlayPosition: 'top-left',
        fontSizeScale: 'medium',
        overlayColor: '#FFFFFF',
        createdAt: new Date()
      } as any);

      const now = new Date();
      const baseDemo = {
        projectId: demoId,
        projectName: "PROYECTO DEMO",
        latitude: 9.9281,
        longitude: -84.0907,
        gpsLabel: "9.92810, -84.09070",
        locationText: "San José, Costa Rica (ejemplo)",
        baseFields: { tecnico: "TÉCNICO DEMO" },
        sharedWhatsApp: false,
        syncStatus: "pending" as const,
      };

      await storageService.addEvidence({
        ...baseDemo,
        customFields: [
          { name: "Material", value: "Cable FO", showInPhoto: true, active: true },
          { name: "Cantidad", value: "02 UNID", showInPhoto: true, active: true },
        ],
        createdAt: new Date(now.getTime() - 5 * 60 * 1000),
        timestamp: now.getTime() - 5 * 60 * 1000,
      } as any, "");

      await storageService.addEvidence({
        ...baseDemo,
        customFields: [
          { name: "Material", value: "Conector SC/APC", showInPhoto: true, active: true },
          { name: "Cantidad", value: "04 UNID", showInPhoto: true, active: true },
        ],
        createdAt: now,
        timestamp: now.getTime(),
      } as any, "");

      await storageService.syncAllLocalData();
      const demoProjects = sortProjects(await storageService.getAllProjects());
      setProjects(demoProjects);
      restoreSession(demoProjects);
    };

    // Primera lectura: IndexedDB/LocalDB no depende de Internet.
    let localProjects = await storageService.getAllProjects();
    let sortedProjects = sortProjects(localProjects);
    setProjects(sortedProjects);
    restoreSession(sortedProjects);

    // Si ya existen proyectos locales, el usuario puede trabajar inmediatamente.
    // Firebase solo refresca la caché en segundo plano.
    const refreshFromFirebase = async () => {
      if (!navigator.onLine) {
        if (sortedProjects.length === 0) {
          await createDemoProject();
        }
        return;
      }

      try {
        const remoteProjects = await firebaseService.getCloudProjects();

        // Importación en segundo plano. No bloquea la primera pintura de proyectos.
        await Promise.all(
          remoteProjects.map(async remoteProject => {
            try {
              await storageService.importCloudProject(remoteProject);
            } catch (error) {
              console.warn(
                '[Projects] No se pudo importar proyecto de Firebase:',
                remoteProject?.uuid || remoteProject?.id,
                error
              );
            }
          })
        );

        localProjects = await storageService.getAllProjects();
        sortedProjects = sortProjects(localProjects);
        setProjects(sortedProjects);
        restoreSession(sortedProjects);

        // Solo crear DEMO cuando Firebase confirmó que realmente no hay proyectos.
        if (sortedProjects.length === 0 && remoteProjects.length === 0) {
          await createDemoProject();
        }
      } catch (error) {
        // Un fallo/lentitud de Firebase nunca debe ocultar los proyectos locales.
        console.warn('[Projects] Firebase no disponible; usando proyectos locales:', error);

        // En una instalación completamente nueva y sin Internet, dejamos que
        // el usuario tenga una pantalla funcional sin depender de una recarga.
        if (sortedProjects.length === 0 && !navigator.onLine) {
          await createDemoProject();
        }
      }
    };

    // No esperamos este proceso. El listado local ya está visible.
    void refreshFromFirebase();
  };
  // Keep sessionStorage in sync
  useEffect(() => {
    sessionStorage.setItem('activeStep', currentStep);
    if (selectedProject?.id) {
       sessionStorage.setItem('activeProjectId', String(selectedProject.id));
    } else {       sessionStorage.removeItem('activeProjectId');    }  }, [currentStep, selectedProject]);

  const handleCreateProject = () => {
    setEditingProject({
      name: '',
      client: '',
      type: 'General',
      showDateTime: true,
      dateTimeFormat: 'format1',
      showGps: true,
      showLocation: true,
      showTech: true,
      techName: '',
      customFields: [],
      locationFormat: 'completa',
      customLocationFormat: { road: true, suburb: true, city: true, state: true },
      allowPdf: true,
      allowExcel: true,
      overlayPosition: 'top-left',
      fontSizeScale: 'medium',
      overlayColor: '#FFFFFF',
    });
    setCurrentStep('setup');
  };

  const handleEditProject = (p: Project) => {
    setEditingProject(p);
    setCurrentStep('setup');
  };

  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => {
      return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
  };

  const handleSaveProject = async () => {
    if (!editingProject?.name?.trim()) {
      alert('El Nombre del Proyecto es obligatorio.');
      return;
    }
    if (!editingProject?.client?.trim()) {
      alert('El Cliente es obligatorio.');
      return;
    }
    if (!editingProject?.techName?.trim()) {
      alert('El Técnico Responsable es obligatorio.');
      return;
    }
    
    // Normalize data
    const normalizedProject = {
      ...editingProject,
      name: editingProject.name.toUpperCase(),
      client: editingProject.client.toUpperCase(),
      techName: toTitleCase(editingProject.techName),      createdAt: editingProject.createdAt || new Date()
    } as Project;

    let id;
    if (editingProject.id) {
      await storageService.updateProject(editingProject.id, normalizedProject);
      id = editingProject.id;    } else {
      id = await storageService.createProject(normalizedProject);
    }
    
    const savedProject = await storageService.getProject(id);
    setSelectedProject(savedProject);
    loadData();
    // After saving, go directly to camera
    setCurrentStep('camera');
  };

  const handleSelectProject = async (p: Project) => {
    setSelectedProject(p);
    setCurrentStep('history');

    // Al entrar a un proyecto desde el listado principal, no debemos depender
    // únicamente de IndexedDB/local. Las evidencias ya sincronizadas pueden
    // existir en Firebase y ser visibles desde Memoria Fotográfica, pero no
    // estar todavía materializadas localmente en este dispositivo.
    // Primero mostramos lo local para no bloquear la navegación y, si existe
    // UUID + conexión, actualizamos las evidencias desde Firestore.
    let evs = await storageService.getEvidencesByProject(p.id!);
    setEvidences(evs);

    const projectUuid = String(p.uuid || '');
    if (projectUuid && navigator.onLine) {
      try {
        const remoteEvidences = await firebaseService.getCloudProjectEvidences(projectUuid);
        if (remoteEvidences.length > 0) {
          const localProject = await storageService.importCloudProject(p, remoteEvidences);
          evs = await storageService.getEvidencesByProject(localProject.id!);
          setSelectedProject(localProject);
          setEvidences(evs);
        }
      } catch (error) {
        // La vista local sigue funcionando aunque Firebase no esté disponible.
        console.warn('[Project Evidence] No se pudieron actualizar las evidencias desde Firebase:', error);
      }
    }
  };

  const openCloudProjects = async () => {
    setShowCloudProjects(true);
    setCloudProjectsLoading(true);
    try {
      const remoteProjects = await firebaseService.getCloudProjects();
      setCloudProjects(remoteProjects);
    } catch (error) {
      console.error('[Cloud Projects] Error:', error);
      alert('No se pudieron cargar los proyectos compartidos desde Firebase.');
    } finally {
      setCloudProjectsLoading(false);
    }
  };

  const uploadMissingMemoryPhoto = (slot: { category: EvidenceCategory; napId: string; napNumber: number; napName: string; photoNumber: number }) => {
    setPendingMemoryUpload(slot);
    memoryUploadInputRef.current?.click();
  };

  const handleMemoryUploadFile = async (file: File | undefined) => {
    const slot = pendingMemoryUpload;
    if (!file || !slot || !file.type.startsWith('image/')) {
      if (file) alert('Selecciona una fotografía válida.');
      return;
    }
    setMemoryUploadLoading(true);
    try {
      const project = memorySelectedProject;
      const projectUuid = String(project?.uuid || project?.id || '');
      if (!projectUuid) throw new Error('No se encontró el identificador del proyecto.');

      const uuid = crypto.randomUUID ? crypto.randomUUID() : ('ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
      const now = new Date();
      const remote = await firebaseService.uploadEvidencePhoto(file, projectUuid, uuid, file.name);

      const evidence = {
        id: null, uuid, projectId: project?.id ?? null, projectUuid, projectName: project?.name || '',
        photoPath: file.name, photoStoragePath: remote.storagePath, photoUrl: remote.downloadUrl,
        category: slot.category, categoryLabel: 'NAPS',
        capturedAt: now.toISOString(), fecha: now.toLocaleDateString('es-ES'),
        hora: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(), latitude: 0, longitude: 0, gpsAccuracy: null, ubicacion: '',
        baseFields: { posteId: '', tecnico: '', observaciones: 'Fotografía subida desde Memoria Fotográfica.', materiales: '' },
        tecnico: '', posteId: '', observaciones: 'Fotografía subida desde Memoria Fotográfica.', materiales: '',
        customFields: [], sharedWhatsApp: false, locked: false,
        napId: slot.napId, napNumber: slot.napNumber, napName: slot.napName, napPhotoNumber: slot.photoNumber,
        createdAt: now.toISOString(), updatedAt: now.toISOString(), syncStatus: 'synced', retryCount: 0, schemaVersion: 3
      };

      if (!(await firebaseService.syncEvidenceToCloud(evidence))) {
        throw new Error('La fotografía se subió a Storage, pero no se pudo guardar su registro en Firestore.');
      }

      const append = (projectItem: any) => {
        if (!projectItem) return projectItem;
        const current = Array.isArray(projectItem._evidences) ? projectItem._evidences : [];
        return { ...projectItem, _evidences: [...current.filter((ev: any) => ev.uuid !== uuid), evidence] };
      };
      setMemoryProjects(prev => prev.map(p => String(p.uuid || p.id) === projectUuid ? append(p) : p));
      setMemorySelectedProject((prev: any) => append(prev));
      setPendingMemoryUpload(null);
      if (memoryUploadInputRef.current) memoryUploadInputRef.current.value = '';
      alert('Fotografía subida correctamente y asociada a la posición seleccionada.');
    } catch (error: any) {
      console.error('[Memory Upload] Error:', error);
      alert(error?.message || 'No se pudo subir la fotografía.');
    } finally {
      setMemoryUploadLoading(false);
    }
  };

  const loadMemoryDashboard = async () => {
    setCurrentStep('memory');
    setMemoryLoading(true);
    setMemorySelectedProject(null);
    try {
      const remoteProjects = await firebaseService.getCloudProjects();
      const summaries = await Promise.all(remoteProjects.map(async (project: any) => {
        const uuid = String(project.uuid || project.id);
        try {
          const remoteEvidences = await firebaseService.getCloudProjectEvidences(uuid);
          return { ...project, _evidences: remoteEvidences };
        } catch (error) {
          console.error('[Memory Dashboard] Error cargando evidencias:', uuid, error);
          return { ...project, _evidences: [] };
        }
      }));
      setMemoryProjects(summaries);
    } catch (error) {
      console.error('[Memory Dashboard] Error:', error);
      alert('No se pudieron cargar los proyectos de Firebase.');
      setCurrentStep('home');
    } finally {
      setMemoryLoading(false);
    }
  };

  const memoryCategorySummary = (project: any, category: string) => {
    const evidences = (project?._evidences || []).filter((ev: any) => {
      const evCategory = String(ev.category || '').toUpperCase();
      const normalizedCategory =
        evCategory === 'PUNTAS_FIBRA_INICIAL' || evCategory === 'PUNTAS_FIBRA_FINAL'
          ? 'PUNTAS_FIBRA'
          : evCategory;
      return normalizedCategory === category;
    });
    const hasPhoto = (ev: any) => Boolean(
      String(ev.photoUrl || ev.photo?.uri || ev.photo?.url || '').trim()
    );
    const groups = new Map<string, any[]>();

    evidences.forEach((ev: any) => {
      let key = ev.uuid || String(evidences.indexOf(ev));
      if (category === 'NAPS') key = ev.napId || key;
      if (category === 'MUFA') {
        const mufaNumber = Number(ev.mufaNumber || 0);
        const mufaName = String(ev.mufaName || '').trim().toUpperCase();
        const isLegacyPlaceholder = mufaNumber === 0 && (!mufaName || mufaName === 'MUFA');
        key = isLegacyPlaceholder
          ? 'mufa_legacy_placeholder'
          : (ev.mufaId || 'mufa_' + mufaNumber + '_' + mufaName);
      }
      if (category === 'PUNTAS_FIBRA') key = ev.fiberPairId || key;
      if (category === 'RESERVA') key = ev.reserveId || key;
      if (category === 'ACEROS') key = ev.aceroId || key;
      if (category === 'DESECHOS') key = ev.desechoId || key;
      if (category === 'ALTAS') key = ev.altaId || key;
      if (category === 'MEJORAS') key = ev.mejoraId || key;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    });

    const required = category === 'NAPS' || category === 'MUFA' ? 9
      : category === 'PUNTAS_FIBRA' ? 2
      : category === 'RESERVA' ? 3
      : category === 'ACEROS' || category === 'DESECHOS' || category === 'ALTAS' || category === 'MEJORAS' ? 2
      : 1;

    const groupList = Array.from(groups.entries()).map(([id, items]) => {
      let normalizedItems = items;
      if (category === 'MUFA') {
        // MUFA es un set fijo de 9 fotografías. La existencia de la foto se
        // determina por su URL, NO por mufaPhotoNumber. En registros históricos
        // ese metadato puede faltar, pero la fotografía sigue siendo válida.
        // El visor trabaja con las fotografías reales y las presenta 1/9 ... 9/9.
        normalizedItems = [...items]
          .filter(hasPhoto)
          .sort((a, b) => {
            const slotA = Number(a.mufaPhotoNumber ?? a.photoNumber ?? 0);
            const slotB = Number(b.mufaPhotoNumber ?? b.photoNumber ?? 0);
            if (slotA > 0 && slotB === 0) return -1;
            if (slotA === 0 && slotB > 0) return 1;
            return slotA - slotB;
          })
          .slice(0, 9);
      }
      return {
        id,
        items: normalizedItems,
        number: Number(
          items[0]?.napNumber ?? items[0]?.mufaNumber ?? items[0]?.fiberPairNumber ??
          items[0]?.reserveNumber ?? items[0]?.aceroNumber ?? items[0]?.desechoNumber ??
          items[0]?.altaNumber ?? items[0]?.mejoraNumber ?? 0
        ),
        name: items[0]?.napName || items[0]?.mufaName || items[0]?.categoryLabel || '',
        count: normalizedItems.filter(hasPhoto).length,
        required
      };
    }).sort((a, b) => a.number - b.number);

    const captured = evidences.filter(hasPhoto).length;
    const requiredTotal = groupList.length * required;
    const complete = groupList.filter(group => group.count >= required).length;
    return {
      category,
      groups: groupList,
      groupCount: groupList.length,
      complete,
      captured,
      requiredTotal,
      missing: Math.max(0, requiredTotal - captured),
      completeAll: groupList.length > 0 && complete === groupList.length
    };
  };

  const handleGenerateMemoryExcel = async () => {
    if (!memorySelectedProject || memoryExcelLoading) return;
    setMemoryExcelLoading(true);
    try {
      await generateMemoryExcel(memorySelectedProject, memorySelectedProject._evidences || []);
    } catch (error: any) {
      console.error('[Memory Excel] Error generando:', error);
      alert(error?.message || 'No se pudo generar el Excel de memoria fotográfica.');
    } finally {
      setMemoryExcelLoading(false);
    }
  };

  const handleGenerateMemoryPhotosZip = async () => {
    if (!memorySelectedProject || memoryExcelLoading || memoryZipLoading) return;
    setMemoryZipLoading(true);
    try {
      const evidences = memorySelectedProject._evidences || [];
      await generateMemoryPhotosZip(
        memorySelectedProject,
        evidences,
        (completed, total) => {
          console.log(`[Memory ZIP] ${completed}/${total} fotografías preparadas`);
        },
      );
    } catch (error: any) {
      console.error('[Memory ZIP] Error generando:', error);
      alert(error?.message || 'No se pudo generar el ZIP de fotografías.');
    } finally {
      setMemoryZipLoading(false);
    }
  };

  const memoryCategories = [
    { id: 'NAPS', label: 'NAPS', required: 9 },
    { id: 'MUFA', label: 'MUFA', required: 9 },
    { id: 'PUNTAS_FIBRA', label: 'PUNTAS DE FIBRA', required: 2 },
    { id: 'RESERVA', label: 'RESERVAS', required: 3 },
    { id: 'ACEROS', label: 'ACEROS', required: 2 },
    { id: 'DESECHOS', label: 'DESECHOS', required: 2 },
    { id: 'ALTAS', label: 'ALTAS', required: 2 },
    { id: 'MEJORAS', label: 'MEJORAS', required: 2 }
  ];

  const importAndOpenCloudProject = async (cloudProject: any) => {
    const uuid = String(cloudProject.uuid || cloudProject.id);
    setCloudImportingUuid(uuid);
    try {
      const remoteEvidences = await firebaseService.getCloudProjectEvidences(uuid);
      // Al abrir explícitamente desde "Proyectos compartidos", el proyecto
      // vuelve a la lista principal de este dispositivo.
      const localProject = await storageService.importCloudProject(cloudProject, remoteEvidences, true);
      const evs = await storageService.getEvidencesByProject(localProject.id!);
      setProjects(prev => {
        const without = prev.filter(p => p.uuid !== localProject.uuid);
        return [localProject, ...without];
      });
      setSelectedProject(localProject);
      setEvidences(evs);
      setShowCloudProjects(false);
      setCloudSearchTerm('');
      setCurrentStep('history');
    } catch (error) {
      console.error('[Cloud Projects] Error importando:', error);
      alert('No se pudo abrir el proyecto compartido.');
    } finally {
      setCloudImportingUuid(null);
    }
  };

  const requestDeleteCloudProject = (cloudProject: any) => {
    const uuid = String(cloudProject?.uuid || cloudProject?.id || '');
    if (!uuid) return;
    setPendingCloudDeleteProject({ uuid, name: String(cloudProject?.name || 'Proyecto sin nombre') });
    setCloudDeleteStep(1);
  };

  const executeDeleteCloudProject = async () => {
    const target = pendingCloudDeleteProject;
    if (!target || cloudDeleteRunning) return;
    setCloudDeleteRunning(true);
    try {
      await firebaseService.deleteCloudProject(target.uuid);
      setCloudProjects(prev => prev.filter(p => String(p.uuid || p.id) !== target.uuid));
      const localMatch = projects.find(p => String(p.uuid || '') === target.uuid);
      if (localMatch?.id != null) {
        await storageService.deleteProject(localMatch.id);
        setProjects(prev => prev.filter(p => p.id !== localMatch.id));
        if (selectedProject?.id === localMatch.id) {
          setSelectedProject(null);
          setEvidences([]);
          setCurrentStep('home');
        }
      }
      setCloudDeleteStep(0);
      setPendingCloudDeleteProject(null);
    } catch (error: any) {
      console.error('[Cloud Projects] Error eliminando proyecto compartido:', error);
      alert(error?.message || 'No se pudo eliminar el proyecto compartido. Verifique la conexión y los permisos de Firebase.');
    } finally {
      setCloudDeleteRunning(false);
    }
  };

  const isFiberCategory = (category: EvidenceCategory) =>
    category === 'PUNTAS_FIBRA' || category === 'PUNTAS_FIBRA_INICIAL' || category === 'PUNTAS_FIBRA_FINAL';

  const openEvidenceCapture = (category: EvidenceCategory) => {
    setEvidenceCategory(category);

    if (category === 'NAPS') {
      setFiberCaptureDraft(null);
      setReserveCaptureDraft(null);

      const napGroups = Array.from(new Set(
        evidences.filter(ev => ev.category === 'NAPS' && ev.napId).map(ev => ev.napId as string)
      ))
        .map(napId => {
          const group = evidences.filter(ev => ev.category === 'NAPS' && ev.napId === napId);
          const first = group[0];
          const capturedSlots = new Set(
            group
              .map(ev => Number(ev.napPhotoNumber))
              .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
          );
          const nextPhotoNumber = Array.from({ length: 9 }, (_, i) => i + 1)
            .find(n => !capturedSlots.has(n)) || 10;

          return {
            napId,
            napNumber: Number(first?.napNumber || 0),
            napName: first?.napName || '',
            count: capturedSlots.size,
            nextPhotoNumber
          };
        })
        .filter(group => group.nextPhotoNumber <= 9)
        .sort((a, b) => a.napNumber - b.napNumber);

      if (napGroups.length > 0) {
        const nap = napGroups[0];
        const draft = {
          napId: nap.napId,
          napNumber: nap.napNumber,
          napName: nap.napName,
          photoNumber: nap.nextPhotoNumber,
          remainingPhotos: 9 - nap.count
        };
        setNapCaptureDraft(draft);

        // Si el NAP ya tiene nombre guardado, no volvemos a pedirlo.
        // Al pulsar TOMAR FOTO se entra directamente a la cámara.
        if (nap.napName.trim()) {
          setShowNapCaptureModal(false);
          setCurrentStep('camera');
        } else {
          setShowNapCaptureModal(true);
        }
      } else {
        const usedNumbers = evidences.filter(ev => ev.category === 'NAPS' && ev.napNumber != null)
          .map(ev => Number(ev.napNumber)).filter(Number.isFinite);
        const napNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
        const napId = crypto.randomUUID ? crypto.randomUUID() : `nap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setNapCaptureDraft({ napId, napNumber, napName: '', photoNumber: 1, remainingPhotos: 9 });
        setShowNapCaptureModal(true);
      }
      return;
    }

    if (category === 'MUFA') {
      setFiberCaptureDraft(null);
      setReserveCaptureDraft(null);

      const mufaGroups = Array.from(new Set(
        evidences
          .filter(ev => ev.category === 'MUFA' && (ev.mufaId || ev.mufaNumber != null))
          .map(ev => ev.mufaId || `mufa_${ev.mufaNumber || 0}_${String(ev.mufaName || '').trim().toUpperCase()}`)
      ))
        .map(mufaKey => {
          const group = evidences.filter(ev => {
            if (ev.category !== 'MUFA') return false;
            const key = ev.mufaId || `mufa_${ev.mufaNumber || 0}_${String(ev.mufaName || '').trim().toUpperCase()}`;
            return key === mufaKey;
          });
          const first = group[0];
          const capturedSlots = new Set(
            group
              .map(ev => Number(ev.mufaPhotoNumber ?? ev.photoNumber))
              .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
          );
          const nextPhotoNumber = Array.from({ length: 9 }, (_, i) => i + 1)
            .find(n => !capturedSlots.has(n)) || 10;
          return {
            mufaId: first?.mufaId || String(mufaKey),
            mufaNumber: Number(first?.mufaNumber || 0),
            mufaName: first?.mufaName || '',
            count: capturedSlots.size,
            nextPhotoNumber
          };
        })
        .filter(group => group.nextPhotoNumber <= 9)
        .sort((a, b) => a.mufaNumber - b.mufaNumber);

      if (mufaGroups.length > 0) {
        const mufa = mufaGroups[0];
        setMufaCaptureDraft({
          mufaId: mufa.mufaId,
          mufaNumber: mufa.mufaNumber,
          mufaName: mufa.mufaName,
          photoNumber: mufa.nextPhotoNumber,
          remainingPhotos: 9 - mufa.count
        });
        if (mufa.mufaName.trim()) {
          setShowMufaCaptureModal(false);
          setCurrentStep('camera');
        } else {
          setShowMufaCaptureModal(true);
        }
      } else {
        const usedNumbers = evidences.filter(ev => ev.category === 'MUFA' && ev.mufaNumber != null)
          .map(ev => Number(ev.mufaNumber)).filter(Number.isFinite);
        const mufaNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
        const mufaId = crypto.randomUUID ? crypto.randomUUID() : `mufa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setMufaCaptureDraft({ mufaId, mufaNumber, mufaName: '', photoNumber: 1, remainingPhotos: 9 });
        setShowMufaCaptureModal(true);
      }
      return;
    }
    if (category === 'ALTAS') {
      setFiberCaptureDraft(null);
      setReserveCaptureDraft(null);
      setNapCaptureDraft(null);
      setAltaCaptureDraft({
        altaId: '',
        altaNumber: 0,
        altaType: 'FIBRA DE DESCARTE',
        side: 'panoramic'
      });
      setAltaMeterageDraft('');
      setAltaPromptMode('type');
      setShowAltaCaptureModal(true);
      return;
    }

    if (category === 'ACEROS') {
      setFiberCaptureDraft(null);
      setReserveCaptureDraft(null);
      setNapCaptureDraft(null);
      setAltaCaptureDraft(null);

      const aceroGroups = Array.from(new Set(
        evidences
          .filter(ev => ev.category === 'ACEROS' && ev.aceroId)
          .map(ev => ev.aceroId as string)
      ))
        .map(aceroId => {
          const group = evidences.filter(ev => ev.category === 'ACEROS' && ev.aceroId === aceroId);
          const first = group[0];
          const aceroNumber = Number(first?.aceroNumber || 0);
          const hasPhoto1 = group.some(ev => ev.aceroSide === 'photo1');
          const hasPhoto2 = group.some(ev => ev.aceroSide === 'photo2');
          return { aceroId, aceroNumber, hasPhoto1, hasPhoto2 };
        })
        .filter(group => !(group.hasPhoto1 && group.hasPhoto2))
        .sort((a, b) => a.aceroNumber - b.aceroNumber);

      // Si existe un set incompleto, preguntamos antes de decidir si se completa
      // o si el usuario quiere iniciar un ACERO completamente nuevo.
      if (aceroGroups.length > 0) {
        const group = aceroGroups[0];
        setAceroSetChoice({
          aceroId: group.aceroId,
          aceroNumber: group.aceroNumber,
          missingSide: group.hasPhoto1 ? 'photo2' : 'photo1'
        });
        return;
      }

      const usedNumbers = evidences
        .filter(ev => ev.category === 'ACEROS' && ev.aceroNumber != null)
        .map(ev => Number(ev.aceroNumber))
        .filter(Number.isFinite);
      const aceroNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
      const aceroId = crypto.randomUUID
        ? crypto.randomUUID()
        : `acero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      setAceroCaptureDraft({
        aceroId,
        aceroNumber,
        side: 'photo1'
      });
      setAceroMeterageDraft('');
      setAceroPromptMode('type');
      setShowAceroCaptureModal(true);
      return;
    }

    if (category === 'DESECHOS') {
      setFiberCaptureDraft(null);
      setReserveCaptureDraft(null);
      setNapCaptureDraft(null);
      setAltaCaptureDraft(null);
      setAceroCaptureDraft(null);
      setAceroSetChoice(null);

      const desechoGroups = Array.from(new Set(
        evidences
          .filter(ev => ev.category === 'DESECHOS' && ev.desechoId)
          .map(ev => ev.desechoId as string)
      ))
        .map(desechoId => {
          const group = evidences.filter(ev => ev.category === 'DESECHOS' && ev.desechoId === desechoId);
          const first = group[0];
          const desechoNumber = Number(first?.desechoNumber || 0);
          const hasPhoto1 = group.some(ev => ev.desechoSide === 'photo1');
          const hasPhoto2 = group.some(ev => ev.desechoSide === 'photo2');
          return { desechoId, desechoNumber, hasPhoto1, hasPhoto2 };
        })
        .filter(group => !(group.hasPhoto1 && group.hasPhoto2))
        .sort((a, b) => a.desechoNumber - b.desechoNumber);

      if (desechoGroups.length > 0) {
        const group = desechoGroups[0];
        setDesechoSetChoice({
          desechoId: group.desechoId,
          desechoNumber: group.desechoNumber,
          missingSide: group.hasPhoto1 ? 'photo2' : 'photo1'
        });
        return;
      }

      const usedNumbers = evidences
        .filter(ev => ev.category === 'DESECHOS' && ev.desechoNumber != null)
        .map(ev => Number(ev.desechoNumber))
        .filter(Number.isFinite);
      const desechoNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
      const desechoId = crypto.randomUUID
        ? crypto.randomUUID()
        : `desecho_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      setDesechoCaptureDraft({
        desechoId,
        desechoNumber,
        side: 'photo1'
      });
      setDesechoMeterageDraft('');
      setDesechoPromptMode('type');
      setShowDesechoCaptureModal(true);
      return;
    }

    if (category === 'MEJORAS') {
      setFiberCaptureDraft(null);
      setReserveCaptureDraft(null);
      setNapCaptureDraft(null);
      setAltaCaptureDraft(null);
      setAceroCaptureDraft(null);
      setAceroSetChoice(null);
      setDesechoCaptureDraft(null);
      setDesechoSetChoice(null);

      const mejoraGroups = Array.from(new Set(
        evidences
          .filter(ev => ev.category === 'MEJORAS' && ev.mejoraId)
          .map(ev => ev.mejoraId as string)
      ))
        .map(mejoraId => {
          const group = evidences.filter(ev => ev.category === 'MEJORAS' && ev.mejoraId === mejoraId);
          const first = group[0];
          const mejoraNumber = Number(first?.mejoraNumber || 0);
          const mejoraType = (first?.mejoraType || 'PODAS') as 'SUBIDA DE BANDAS' | 'PODAS' | 'SUBIDA DE RETENIDAS';
          const hasBefore = group.some(ev => ev.mejoraSide === 'before');
          const hasAfter = group.some(ev => ev.mejoraSide === 'after');
          return { mejoraId, mejoraNumber, mejoraType, hasBefore, hasAfter };
        })
        .filter(group => !(group.hasBefore && group.hasAfter))
        .sort((a, b) => a.mejoraNumber - b.mejoraNumber);

      if (mejoraGroups.length > 0) {
        const group = mejoraGroups[0];
        setMejoraSetChoice({
          mejoraId: group.mejoraId,
          mejoraNumber: group.mejoraNumber,
          mejoraType: group.mejoraType,
          missingSide: group.hasBefore ? 'after' : 'before'
        });
        return;
      }

      const usedNumbers = evidences
        .filter(ev => ev.category === 'MEJORAS' && ev.mejoraNumber != null)
        .map(ev => Number(ev.mejoraNumber))
        .filter(Number.isFinite);
      const mejoraNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
      const mejoraId = crypto.randomUUID
        ? crypto.randomUUID()
        : `mejora_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      setMejoraCaptureDraft({
        mejoraId,
        mejoraNumber,
        mejoraType: 'SUBIDA DE BANDAS',
        side: 'before'
      });
      setMejoraPromptMode('type');
      setShowMejoraCaptureModal(true);
      return;
    }

    if (category === 'RESERVA') {
      setFiberCaptureDraft(null);

      // Si ya existe una reserva incompleta, retomamos automáticamente
      // la primera evidencia que falta. Nunca volvemos a pedir carrete/fibras
      // si la PUNTA INICIAL ya los registró.
      const reserveGroups = Array.from(new Set(
        evidences
          .filter(ev => ev.category === 'RESERVA' && ev.reserveId)
          .map(ev => ev.reserveId as string)
      ))
        .map(reserveId => {
          const group = evidences.filter(ev => ev.category === 'RESERVA' && ev.reserveId === reserveId);
          const first = group[0];
          const reserveNumber = Number(first?.reserveNumber || 0);
          const hasInitial = group.some(ev => ev.reserveSide === 'initial');
          const hasFinal = group.some(ev => ev.reserveSide === 'final');
          const hasRoll = group.some(ev => ev.reserveSide === 'roll');
          return { reserveId, reserveNumber, hasInitial, hasFinal, hasRoll };
        })
        .filter(group => !(group.hasInitial && group.hasFinal && group.hasRoll))
        .sort((a, b) => a.reserveNumber - b.reserveNumber);

      // Determinar exactamente qué reserva continuar.
      // Nunca crear una reserva nueva si ya existe una reserva pendiente.
      if (reserveGroups.length > 1) {
        // Hay varias pendientes: el usuario elige cuál continuar.
        setReserveCaptureDraft({
          side: 'initial',
          reserveId: '',
          reserveNumber: 0,
          reelNumber: '',
          fiberCount: '', metraje: '',

});
      } else if (reserveGroups.length === 1) {
        const pending = reserveGroups[0];

        if (!pending.hasInitial) {
          setReserveCaptureDraft({
            side: 'initial',
            reserveId: pending.reserveId,
            reserveNumber: pending.reserveNumber,
            reelNumber: '',
            fiberCount: '', metraje: '',

});
        } else {
          const missingSide: 'final' | 'roll' = !pending.hasFinal ? 'final' : 'roll';
          const inheritedReel = getReserveReelNumber(pending.reserveId, pending.reserveNumber);
          const inheritedFiberCount = getReserveFiberCount(pending.reserveId, pending.reserveNumber);

          if (!inheritedReel || !inheritedFiberCount) {
            // Si la inicial existe pero sus datos no están disponibles,
            // permitimos seleccionar la reserva para revisar/recuperar sus datos.
            setReserveCaptureDraft({
              side: 'initial',
              reserveId: '',
              reserveNumber: 0,
              reelNumber: '',
              fiberCount: '', metraje: '',
            });
          } else {
            setReserveCaptureDraft({
              side: missingSide,
              reserveId: pending.reserveId,
              reserveNumber: pending.reserveNumber,
              reelNumber: inheritedReel,
              fiberCount: inheritedFiberCount, metraje: '',
});
          }
        }
      } else {
        // No hay reservas pendientes: crear una nueva.
        const usedNumbers = evidences
          .filter(ev => ev.category === 'RESERVA' && ev.reserveNumber != null)
          .map(ev => Number(ev.reserveNumber))
          .filter(Number.isFinite);

        const reserveNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
        const reserveId = crypto.randomUUID
          ? crypto.randomUUID()
          : `reserve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        setReserveCaptureDraft({
          side: 'initial',
          reserveId,
          reserveNumber,
          reelNumber: '',
          fiberCount: '', metraje: '',

});
      }

      setShowReserveCaptureModal(true);
      return;
    }

    if (category === 'PUNTAS_FIBRA') {
      setReserveCaptureDraft(null);
      setFiberCaptureDraft(null);
      setShowFiberPairSelector(true);
      return;
    }

    if (!isFiberCategory(category)) {
      setFiberCaptureDraft(null);
      setReserveCaptureDraft(null);
      setCurrentStep('camera');
      return;
    }
  };

  const openFiberSide = (side: 'initial' | 'final', pairId?: string) => {
    if (side === 'initial') {
      if (pairId) {        const existingInitial = evidences.find(ev =>
          ev.category === 'PUNTAS_FIBRA_INICIAL' && ev.fiberPairId === pairId
        );
        if (existingInitial) {
          alert('Esta punta ya tiene PUNTA INICIAL.');
          return;
        }
      }

      const fiberPairsFromEvidence = evidences
        .filter(ev => (ev.category === 'PUNTAS_FIBRA_INICIAL' || ev.category === 'PUNTAS_FIBRA_FINAL') && ev.fiberPairId)
        .map(ev => Number(ev.fiberPairNumber || 0))
        .filter(Number.isFinite);
      const nextNumber = fiberPairsFromEvidence.length ? Math.max(...fiberPairsFromEvidence) + 1 : 1;
      const id = pairId || (crypto.randomUUID ? crypto.randomUUID() : `fiber_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

      const existingPair = pairId
        ? evidences.find(ev => ev.fiberPairId === pairId)
        : undefined;

      setFiberCaptureDraft({
        side: 'initial',
        pairId: id,
        pairNumber: pairId
          ? Number(existingPair?.fiberPairNumber || nextNumber)
          : nextNumber,

        metraje: '',
        reelNumber: existingPair?.fiberReelNumber || '',
        fiberCount: existingPair?.fiberCount ? String(existingPair.fiberCount) : ''
      });
    } else {
      const pendingPairs = fiberPairs.filter(pair => !pair.hasFinal);
      const selected = pairId ? pendingPairs.find(pair => pair.pairId === pairId) : pendingPairs[0];

      if (!selected) {
        alert('Primero registre una PUNTA INICIAL para poder tomar su fotografía FINAL.');
        return;
      }

      const initialEvidence = evidences.find(ev =>
        ev.category === 'PUNTAS_FIBRA_INICIAL' && ev.fiberPairId === selected.pairId
      );

      setFiberCaptureDraft({
        side: 'final',
        pairId: selected.pairId,
        pairNumber: selected.pairNumber,
        metraje: '',
        reelNumber: initialEvidence?.fiberReelNumber || '',
        fiberCount: initialEvidence?.fiberCount ? String(initialEvidence.fiberCount) : ''
      });
    }

    setEvidenceCategory('PUNTAS_FIBRA');
    setShowFiberPairSelector(false);    setShowFiberCaptureModal(true);
  };

  const getReserveReelNumber = (reserveId: string, reserveNumber?: number) => {
    // Fuente principal: la PUNTA INICIAL de la misma reserva.
    // Compatibilidad: también acepta registros creados por versiones anteriores
    // que pudieron guardar el carrete con el campo de fibra o en localStorage.
    // Buscar en TODAS las evidencias de la misma reserva, no solamente
    // en la inicial. Esto permite recuperar reservas creadas con versiones
    // anteriores donde los metadatos pudieron quedar en otra evidencia.
    const reserveEvidence = evidences.filter(ev =>
      ev.category === 'RESERVA' && ev.reserveId === reserveId
    );

    const storedValue =
      reserveEvidence
        .map(ev => ev.reserveReelNumber?.trim() || ev.fiberReelNumber?.trim() || '')
        .find(Boolean) || '';

    if (storedValue) return storedValue;

    try {
      return (
        localStorage.getItem(`fieldtrace_reserve_reel_${reserveId}`)?.trim() ||
        (reserveNumber ? localStorage.getItem(`fieldtrace_reserve_reel_number_${reserveNumber}`)?.trim() : '') ||
        ''
      );
    } catch {
      return '';
    }
  };

  const getReserveFiberCount = (reserveId: string, reserveNumber?: number) => {
    const reserveEvidence = evidences.filter(ev =>
      ev.category === 'RESERVA' && ev.reserveId === reserveId
    );

    for (const ev of reserveEvidence) {
      const count = Number(ev.reserveFiberCount || 0) > 0
        ? Number(ev.reserveFiberCount)
        : Number(ev.fiberCount || 0);
      if (Number.isFinite(count) && count > 0) return String(count);
    }

    try {
      const storedById = Number(localStorage.getItem(`fieldtrace_reserve_fiber_count_${reserveId}`) || 0);
      if (Number.isFinite(storedById) && storedById > 0) return String(storedById);

      const storedByNumber = reserveNumber
        ? Number(localStorage.getItem(`fieldtrace_reserve_fiber_count_number_${reserveNumber}`) || 0)
        : 0;
      return Number.isFinite(storedByNumber) && storedByNumber > 0 ? String(storedByNumber) : '';
    } catch {
      return '';
    }
  };

  const openReserveSide = (side: 'initial' | 'final' | 'roll', reserveId?: string, meterage?: string) => {
    const reserves = evidences
      .filter(ev => ev.category === 'RESERVA' && ev.reserveId)
      .sort((a, b) => Number(a.reserveNumber || 0) - Number(b.reserveNumber || 0));

    if (side === 'initial') {
      const existing = reserveId ? reserves.find(ev => ev.reserveId === reserveId) : null;

      if (existing?.reserveId) {
        const hasInitial = reserves.some(ev => ev.reserveId === existing.reserveId && ev.reserveSide === 'initial');
        if (hasInitial) {
          alert('Esta reserva ya tiene una PUNTA INICIAL.');
          return;
        }
        const inheritedReel = getReserveReelNumber(existing.reserveId, Number(existing.reserveNumber || 0));
        setReserveCaptureDraft({
          side,
          reserveId: existing.reserveId,
          reserveNumber: Number(existing.reserveNumber || 1),
          reelNumber: inheritedReel,
          fiberCount: getReserveFiberCount(existing.reserveId, Number(existing.reserveNumber || 0)),
          metraje: meterage || ''
        });
      } else {
        // Para una reserva nueva, conservar los datos que el usuario acaba
        // de introducir en el formulario. Antes se generaba otro ID aquí y
        // se perdían carrete/cantidad de fibras al abrir la cámara.
        const usedNumbers = reserves.map(ev => Number(ev.reserveNumber)).filter(Number.isFinite);
        const reserveNumber = reserveId && reserveCaptureDraft?.reserveId === reserveId
          ? Number(reserveCaptureDraft.reserveNumber || 1)
          : (usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1);
        const id = reserveId || (crypto.randomUUID
          ? crypto.randomUUID()
          : `reserve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        setReserveCaptureDraft({
          side,
          reserveId: id,
          reserveNumber,
          reelNumber: reserveCaptureDraft?.reserveId === id ? reserveCaptureDraft.reelNumber : '',
          fiberCount: reserveCaptureDraft?.reserveId === id ? reserveCaptureDraft.fiberCount : '',
          metraje: meterage || (reserveCaptureDraft?.reserveId === id ? reserveCaptureDraft.metraje : '')
        });
      }

      if (side === 'initial' && reserveCaptureDraft?.reserveId) {
        try {
          if (reserveCaptureDraft.reelNumber.trim()) {
            localStorage.setItem(
              `fieldtrace_reserve_reel_${reserveCaptureDraft.reserveId}`,
              reserveCaptureDraft.reelNumber.trim()
            );
          }
          if (reserveCaptureDraft.fiberCount.trim()) {
            localStorage.setItem(
              `fieldtrace_reserve_fiber_count_${reserveCaptureDraft.reserveId}`,
              reserveCaptureDraft.fiberCount.trim()
            );
          }
        } catch {
          // IndexedDB sigue siendo la fuente principal.
        }
      }

      setShowReserveCaptureModal(false);
      setCurrentStep('camera');
      return;
    }

    const pending = reserves.filter(ev => {
      const id = ev.reserveId;
      if (!id) return false;
      const hasInitial = evidences.some(x => x.category === 'RESERVA' && x.reserveId === id && x.reserveSide === 'initial');
      const hasSide = evidences.some(x => x.category === 'RESERVA' && x.reserveId === id && x.reserveSide === side);
      return hasInitial && !hasSide;
    });

    const selected = reserveId
      ? pending.find(x => x.reserveId === reserveId)
      : pending[0];

    if (!selected?.reserveId) {
      alert(side === 'final'
        ? 'Primero registre la PUNTA INICIAL de una reserva.'
        : 'Primero registre la PUNTA INICIAL de una reserva para poder agregar el ROLLO DETALLADO.');
      return;
    }

    // FINAL y ROLLO no vuelven a pedir carrete: lo heredan de la reserva.
    // Se busca primero la PUNTA INICIAL y luego cualquier evidencia del mismo grupo.
    const inheritedReel = getReserveReelNumber(selected.reserveId, Number(selected.reserveNumber || 0));

    const inheritedFiberCount = getReserveFiberCount(selected.reserveId, Number(selected.reserveNumber || 0));
    if (!inheritedReel || !inheritedFiberCount) {
      alert('LA PUNTA INICIAL de esta reserva no tiene registrado el número de carrete y/o el valor de FIBRA ÓPTICA DE. Registre nuevamente la PUNTA INICIAL.');
      return;
    }

    setReserveCaptureDraft({
      side,
      reserveId: selected.reserveId,
      reserveNumber: Number(selected.reserveNumber || 1),
      reelNumber: inheritedReel,
      fiberCount: inheritedFiberCount, metraje: '',
});
    setShowReserveCaptureModal(true);
  };

  const handleModalFieldKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return;

    const target = event.target as HTMLElement | null;
    const modal = target?.closest('.fixed.inset-0') as HTMLElement | null;
    if (!modal) return;

    const field = target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const isField =
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement ||
      field instanceof HTMLTextAreaElement;
    if (!isField || field.disabled) return;

    // Enter advances only through editable form fields. Read-only values
    // (for example inherited reel/fiber data) are skipped automatically.
    const fields = Array.from(
      modal.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly])'
      )
    ).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    const currentIndex = fields.indexOf(field);
    if (currentIndex < 0) return;
    const nextField = fields[currentIndex + 1];    if (!nextField) return;
    event.preventDefault();
    event.stopPropagation();
    nextField.focus();

    if (nextField instanceof HTMLInputElement) {
      nextField.select();
    }
  };

  const confirmFiberCapture = () => {
    if (!fiberCaptureDraft) return;
    const parsedMeterage = Number(fiberCaptureDraft.metraje.replace(',', '.'));
    if (!Number.isFinite(parsedMeterage) || parsedMeterage < 0) {
      alert('Ingrese un metraje válido en números.');
      return;
    }
    if (!fiberCaptureDraft.reelNumber.trim()) {
      alert('Ingrese el número de carrete.');
      return;
    }
    const parsedFiberCount = Number(fiberCaptureDraft.fiberCount);
    if (!Number.isInteger(parsedFiberCount) || parsedFiberCount <= 0) {
      alert('Ingrese un valor válido de FIBRA ÓPTICA DE, por ejemplo 12, 24 o 48.');
      return;
    }

    setFiberCaptureDraft({
      ...fiberCaptureDraft,
      metraje: String(parsedMeterage),
      reelNumber: fiberCaptureDraft.reelNumber.trim(),
      fiberCount: String(parsedFiberCount)
    });
    setShowFiberCaptureModal(false);
    setCurrentStep('camera');
  };

  const toggleProjectSelect = (id: number) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearProjectSelection = () => {
    setSelectedProjectIds([]);
    setProjectSelectMode(false);
  };

  const requestDeleteProjects = (ids: number[]) => {
    const unique = Array.from(new Set(ids.filter((id) => id != null)));
    if (!unique.length) return;
    setPendingDeleteProjectIds(unique);
    setConfirmDeleteProjectsStep(1);
  };

  const executeDeleteProjects = async () => {
    const ids = pendingDeleteProjectIds;
    if (!ids.length) {
      setConfirmDeleteProjectsStep(0);
      return;
    }

    try {
      // IMPORTANTE: esta eliminación es solo visual/local.
      // No toca Firestore, Firebase Storage ni las evidencias del proyecto.
      await storageService.hideProjects(ids);

      if (selectedProject?.id != null && ids.includes(selectedProject.id)) {
        setSelectedProject(null);
        setEvidences([]);
        setCurrentStep('home');
      }

      clearProjectSelection();
      await loadData();
    } catch (e) {
      console.error('[Projects] No se pudo ocultar el proyecto de la lista principal', e);
    } finally {
      setPendingDeleteProjectIds([]);
      setConfirmDeleteProjectsStep(0);
    }
  };

  const buildVideoOverlayConfig = () => {
    if (!selectedProject) return null;
    const { gps: stateGps, locationData, isLive, diagnostic } = locationService.getCurrentState();
    const locationOff = diagnostic?.status === 'location_disabled' || diagnostic?.locationServicesEnabled === false;
    const activeGps = locationOff ? null : stateGps;
    const hasGps = !!(activeGps && activeGps.lat != null && activeGps.lon != null);
    const isActualLive = !!(hasGps && (activeGps!.source === 'live' || isLive));
    const gpsLabel = locationOff
      ? 'SIN GPS (GPS DESACTIVADO)'
      : hasGps
        ? (isActualLive ? `${activeGps!.lat.toFixed(6)}, ${activeGps!.lon.toFixed(6)}` : `${activeGps!.lat.toFixed(6)}, ${activeGps!.lon.toFixed(6)} (CACHÉ)`)
        : 'SIN GPS';
    const currentFormattedLocation = getFormattedLocationText(locationData, selectedProject);
    return { projectName: selectedProject.name, capturedAtMs: videoStartedAtRef.current || Date.now(),
      showDateTime: selectedProject.showDateTime, dateTimeFormat: selectedProject.dateTimeFormat, showGps: selectedProject.showGps,
      showLocation: selectedProject.showLocation, showTech: selectedProject.showTech, overlayPosition: selectedProject.overlayPosition,
      fontSizeScale: selectedProject.fontSizeScale, fontSizeValue: selectedProject.fontSizeValue, overlayColor: selectedProject.overlayColor,
      logoImage: selectedProject.logoImage || '', logoPosition: selectedProject.logoPosition, logoSize: selectedProject.logoSize, logoOpacity: selectedProject.logoOpacity,
      gpsLabel, ubicacion: hasGps && currentFormattedLocation && currentFormattedLocation !== 'Buscando...' ? currentFormattedLocation : '',
      tech: selectedProject.techName || 'TECNICO', customFields: selectedProject.customFields.map(f => ({ ...f })) };
  };

  const startVideoRecording = async () => {
    if (!selectedProject || capturingRef.current || videoProcessing) return;
    try {
      capturingRef.current = true;
      videoStartedAtRef.current = Date.now();

      // Video recording uses the microphone. Request both camera and microphone
      // permissions before starting the native recorder.
      const permissionStatus = await CameraPreview.requestPermissions({
        disableAudio: false,
        showSettingsAlert: true,
      });
      if (permissionStatus?.microphone === 'denied') {
        throw new Error('Permiso de micrófono denegado. Habilítalo en Ajustes > Aplicaciones > Field Trace > Permisos > Micrófono.');
      }
      videoRecordingPathRef.current = null;

      // Use the camera's real capabilities instead of assuming every device
      // accepts the same quality/codec/frame-rate combination.
      const [qualityResult, codecResult, frameRateResult] = await Promise.all([
        CameraPreview.getSupportedVideoQualities().catch(() => ({ qualities: [] as string[] })),
        CameraPreview.getSupportedVideoCodecs().catch(() => ({ codecs: [] as string[] })),
        CameraPreview.getSupportedVideoFrameRates().catch(() => ({ frameRates: [] as number[] })),
      ]);

      const qualities = Array.isArray(qualityResult?.qualities) ? qualityResult.qualities : [];
      const codecs = Array.isArray(codecResult?.codecs) ? codecResult.codecs : [];
      const frameRates = Array.isArray(frameRateResult?.frameRates) ? frameRateResult.frameRates : [];

      const quality = (['1080p', 'high', '720p', 'medium', '480p', 'low'] as string[])
        .find(q => qualities.length === 0 || qualities.includes(q)) || 'high';
      // H.264/AVC is intentionally forced because the burned-in overlay is
      // transcoded through Media3 to H.264 for maximum Android compatibility.
      // The plugin documents avc1 as a supported Android video codec.
      const codec = 'avc1';
      const frameRate = frameRates.length === 0
        ? 30
        : (frameRates.includes(30) ? 30 : [...frameRates].sort((a, b) => Math.abs(a - 30) - Math.abs(b - 30))[0]);

      console.log('[Video] native capabilities', { qualities, codecs, frameRates, selected: { quality, codec, frameRate } });

      // Explicitly set the codec on the active session before recording.
      await CameraPreview.setVideoCodec({ codec: 'avc1' }).catch((error) => {
        console.warn('[Video] setVideoCodec(avc1) fallback:', error);
      });

      await CameraPreview.startRecordVideo({
        storeToFile: true,
        enableVideoMode: true,
        position: cameraFacing,
        videoQuality: quality as any,
        videoCodec: codec as any,
        frameRate,
        disableAudio: false,
        mirrorFrontCamera: false,
      });

      const actualCodec = await CameraPreview.getVideoCodec().catch(() => ({ codec: codec }));
      console.log('[Video] recording codec:', actualCodec);
      setIsRecordingVideo(true);
      console.log('[Video] native recording STARTED');
    } catch (e) {
      console.error('[Video] start failed', e);
      videoStartedAtRef.current = null;
      videoRecordingPathRef.current = null;
      capturingRef.current = false;
    }
  };

  const stopVideoRecording = async () => {
    if (!isRecordingVideo || videoProcessing) return;
    setVideoProcessing(true);
    setIsRecordingVideo(false);

    let rawVideoPath = '';
    try {
      const stopped = await CameraPreview.stopRecordVideo();
      rawVideoPath = String(stopped?.videoFilePath || videoRecordingPathRef.current || '');
      if (!rawVideoPath) throw new Error('La cámara terminó pero no devolvió la ruta del video');

      const native = (window as any).FieldTraceNative;
      if (!native || typeof native.composeVideoWithOverlay !== 'function' || typeof native.saveVideoToGallery !== 'function') {
        throw new Error('El compositor nativo de video no está disponible');
      }

      // The camera MP4 is kept only as a temporary source. It is NOT copied
      // to the gallery, so the user receives only the final overlay video.
      if (typeof native.getVideoFileInfo === 'function') {
        const infoRaw = String(native.getVideoFileInfo(rawVideoPath) || '');
        const info = infoRaw ? JSON.parse(infoRaw) : null;
        if (!info?.exists || Number(info.size || 0) <= 0) {
          throw new Error('El archivo original de video está vacío');
        }
        if (info.audioTracks !== undefined && Number(info.audioTracks || 0) < 1) {
          throw new Error('La cámara generó el video sin pista de audio. No se publicará un video silencioso.');
        }
        console.log('[Video] raw file verified with audio:', info);
      }

      const overlayConfig = buildVideoOverlayConfig();
      if (!overlayConfig) throw new Error('No hay proyecto seleccionado para el overlay');

      console.log('[Video] composing overlay...');
      const finalVideoPath = String(native.composeVideoWithOverlay(rawVideoPath, JSON.stringify(overlayConfig)) || '');
      if (!finalVideoPath) throw new Error('No se pudo integrar el overlay al video');

      if (typeof native.getVideoFileInfo === 'function') {
        const finalInfoRaw = String(native.getVideoFileInfo(finalVideoPath) || '');
        const finalInfo = finalInfoRaw ? JSON.parse(finalInfoRaw) : null;
        if (!finalInfo?.exists || Number(finalInfo.size || 0) <= 0) {
          throw new Error('El video final con overlay está vacío');
        }
        if (finalInfo.audioTracks !== undefined && Number(finalInfo.audioTracks || 0) < 1) {
          throw new Error('El compositor eliminó la pista de audio. No se publicará un video silencioso.');
        }
        console.log('[Video] overlay file verified with audio:', finalInfo);
      }

      const uuid = crypto.randomUUID ? crypto.randomUUID() : 'vid_' + Date.now() + Math.random().toString(36).slice(2);
      const savedUri = String(native.saveVideoToGallery(finalVideoPath, `FT_${uuid}.mp4`) || '');
      if (!savedUri) throw new Error('No se pudo guardar el video en la galería Field Trace');

      // Only the final processed MP4 reaches the gallery. Remove both temporary
      // files after successful persistence.
      try { await CameraPreview.deleteFile({ path: rawVideoPath }); } catch {}
      try { await CameraPreview.deleteFile({ path: finalVideoPath }); } catch {}
      console.log('[Video] only FINAL MP4 saved with burned-in overlay:', savedUri);
    } catch (e) {
      console.error('[Video] stop/process failed:', e);
      // Keep the raw camera file as an internal fallback only; never publish it
      // to the gallery during the normal successful flow.
      try { if (rawVideoPath && (window as any).FieldTraceNative?.getVideoFileInfo) {
        console.warn('[Video] raw source retained temporarily after failure:', rawVideoPath);
      }} catch {}
      try { await CameraPreview.stopRecordVideo(); } catch {}
    } finally {
      videoStartedAtRef.current = null;
      videoRecordingPathRef.current = null;
      capturingRef.current = false;
      setVideoProcessing(false);
    }
  };

  // Resolve the best safe native photo size for the active lens.
  // We keep a 4096px safety ceiling so high-megapixel devices do not flood
  // the WebView/Capacitor bridge with an unnecessarily huge base64 payload.
  const getBestPhotoCaptureSize = async (facing: 'rear' | 'front') => {
    const SAFE_MAX_DIM = 4096;
    try {
      const result = await CameraPreview.getSupportedPictureSizes();
      const groups = Array.isArray(result?.supportedPictureSizes) ? result.supportedPictureSizes : [];
      const activeGroup = groups.find((group: any) => String(group?.facing || '').toLowerCase() === facing);
      const sizes = Array.isArray(activeGroup?.supportedPictureSizes)
        ? activeGroup.supportedPictureSizes
            .map((size: any) => ({ width: Number(size?.width), height: Number(size?.height) }))
            .filter((size: any) => Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0)
        : [];

      if (!sizes.length) {
        return { width: 4096, height: 4096 };
      }

      const largest = [...sizes].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
      const largestDimension = Math.max(largest.width, largest.height);

      if (largestDimension <= SAFE_MAX_DIM) {
        console.log('[Camera] selected native photo size:', { facing, ...largest });
        return largest;
      }

      const scale = SAFE_MAX_DIM / largestDimension;
      const safeSize = {
        width: Math.round(largest.width * scale),
        height: Math.round(largest.height * scale),
      };
      console.log('[Camera] selected safe high-resolution photo size:', { facing, source: largest, output: safeSize });
      return safeSize;
    } catch (error) {
      console.warn('[Camera] getSupportedPictureSizes unavailable; using safe fallback:', error);
      return { width: 4096, height: 4096 };
    }
  };
  /**
   * Regla única de integridad para todos los SETS fotográficos.
   * Nunca se permite capturar una posición ya existente ni agregar fotos
   * a un SET que alcanzó su cantidad máxima. La validación ocurre antes
   * de acceder a la cámara para que el bloqueo sea absoluto.
   */
  const getActiveSetCaptureKey = (): string | null => {
    switch (evidenceCategory) {
      case 'NAPS':
        return napCaptureDraft ? `NAPS|${napCaptureDraft.napId}|${napCaptureDraft.photoNumber}` : null;
      case 'MUFA':
        return mufaCaptureDraft ? `MUFA|${mufaCaptureDraft.mufaId}|${mufaCaptureDraft.photoNumber}` : null;
      case 'PUNTAS_FIBRA':
        return fiberCaptureDraft ? `PUNTAS_FIBRA|${fiberCaptureDraft.pairId}|${fiberCaptureDraft.side}` : null;
      case 'RESERVA':
        return reserveCaptureDraft ? `RESERVA|${reserveCaptureDraft.reserveId}|${reserveCaptureDraft.side}` : null;
      case 'ACEROS':
        return aceroCaptureDraft ? `ACEROS|${aceroCaptureDraft.aceroId}|${aceroCaptureDraft.side}` : null;
      case 'DESECHOS':
        return desechoCaptureDraft ? `DESECHOS|${desechoCaptureDraft.desechoId}|${desechoCaptureDraft.side}` : null;
      case 'ALTAS':
        return altaCaptureDraft ? `ALTAS|${altaCaptureDraft.altaId}|${altaCaptureDraft.side}` : null;
      case 'MEJORAS':
        return mejoraCaptureDraft ? `MEJORAS|${mejoraCaptureDraft.mejoraId}|${mejoraCaptureDraft.side}` : null;
      default:
        return null;
    }
  };

  const validateActiveSetBeforeCapture = (): { allowed: boolean; message?: string; lockKey?: string } => {
    const category = evidenceCategory;
    const setCategories = new Set([
      'NAPS', 'MUFA', 'PUNTAS_FIBRA', 'RESERVA',
      'ACEROS', 'DESECHOS', 'ALTAS', 'MEJORAS'
    ]);
    const lockKey = getActiveSetCaptureKey();

    const reject = (message: string) => {
      alert(message);
      return { allowed: false, message };
    };

    if (setCategories.has(category) && !lockKey) {
      return reject(`No se pudo identificar el SET activo de ${category}. Regrese a la sección y seleccione el SET antes de tomar la fotografía.`);
    }

    if (lockKey && activeSetCaptureLockRef.current === lockKey) {
      return reject('La fotografía de esta posición ya está siendo procesada. Espere a que termine antes de intentar otra captura.');
    }

    if (category === 'NAPS' && napCaptureDraft) {
      const group = evidences.filter(ev => ev.category === 'NAPS' && ev.napId === napCaptureDraft.napId);
      const slots = new Set(
        group.map(ev => Number(ev.napPhotoNumber))
          .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
      );
      if (slots.size >= 9 || napCaptureDraft.photoNumber > 9) {
        return reject('Este SET de NAPS ya está completo (9/9). Cree un nuevo SET para continuar.');
      }
      if (slots.has(napCaptureDraft.photoNumber)) {
        return reject(`La FOTO ${napCaptureDraft.photoNumber}/9 de este NAP ya existe. No se puede duplicar una posición.`);
      }
      return { allowed: true, lockKey: lockKey! };
    }

    if (category === 'MUFA' && mufaCaptureDraft) {
      const group = evidences.filter(ev => ev.category === 'MUFA' && (
        (ev.mufaId && ev.mufaId === mufaCaptureDraft.mufaId) ||
        (!ev.mufaId &&
          Number(ev.mufaNumber) === Number(mufaCaptureDraft.mufaNumber) &&
          String(ev.mufaName || '').trim().toUpperCase() === String(mufaCaptureDraft.mufaName || '').trim().toUpperCase())
      ));
      const slots = new Set(
        group.map(ev => Number(ev.mufaPhotoNumber ?? ev.photoNumber))
          .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
      );
      if (slots.size >= 9 || mufaCaptureDraft.photoNumber > 9) {
        return reject('Este SET de MUFA ya está completo (9/9). Cree un nuevo SET para continuar.');
      }
      if (slots.has(mufaCaptureDraft.photoNumber)) {
        return reject(`La FOTO ${mufaCaptureDraft.photoNumber}/9 de este MUFA ya existe. No se puede duplicar una posición.`);
      }
      return { allowed: true, lockKey: lockKey! };
    }

    if (category === 'PUNTAS_FIBRA' && fiberCaptureDraft) {
      const group = evidences.filter(ev =>
        (ev.category === 'PUNTAS_FIBRA_INICIAL' || ev.category === 'PUNTAS_FIBRA_FINAL') &&
        ev.fiberPairId === fiberCaptureDraft.pairId
      );
      const sides = new Set(group.map(ev => ev.category));
      const expectedCategory = fiberCaptureDraft.side === 'initial'
        ? 'PUNTAS_FIBRA_INICIAL'
        : 'PUNTAS_FIBRA_FINAL';

      if (sides.has('PUNTAS_FIBRA_INICIAL') && sides.has('PUNTAS_FIBRA_FINAL')) {
        return reject('Este SET de PUNTAS DE FIBRA ya está completo (2/2). Cree un nuevo SET para continuar.');
      }
      if (sides.has(expectedCategory)) {
        return reject(`Este SET ya tiene la PUNTA ${fiberCaptureDraft.side === 'initial' ? 'INICIAL' : 'FINAL'} registrada.`);
      }
      return { allowed: true, lockKey: lockKey! };
    }

    const sideSetConfig: Record<string, {
      id?: string;
      side?: string;
      label: string;
      max: number;
      idField: string;
      sideField: string;
    }> = {
      RESERVA: { id: reserveCaptureDraft?.reserveId, side: reserveCaptureDraft?.side, label: 'RESERVA', max: 3, idField: 'reserveId', sideField: 'reserveSide' },
      ACEROS: { id: aceroCaptureDraft?.aceroId, side: aceroCaptureDraft?.side, label: 'ACERO', max: 2, idField: 'aceroId', sideField: 'aceroSide' },
      DESECHOS: { id: desechoCaptureDraft?.desechoId, side: desechoCaptureDraft?.side, label: 'DESECHO', max: 2, idField: 'desechoId', sideField: 'desechoSide' },
      ALTAS: { id: altaCaptureDraft?.altaId, side: altaCaptureDraft?.side, label: 'ALTA', max: 2, idField: 'altaId', sideField: 'altaSide' },
      MEJORAS: { id: mejoraCaptureDraft?.mejoraId, side: mejoraCaptureDraft?.side, label: 'MEJORA', max: 2, idField: 'mejoraId', sideField: 'mejoraSide' }
    };

    const config = sideSetConfig[category];
    if (!config?.id || !config.side) return { allowed: true };

    const group = evidences.filter(
      ev => ev.category === category &&
        String((ev as any)[config.idField] || '') === String(config.id)
    );
    const sides = new Set(
      group.map(ev => String((ev as any)[config.sideField] || '')).filter(Boolean)
    );

    if (sides.size >= config.max) {
      return reject(`Este SET de ${config.label} ya está completo (${config.max}/${config.max}). Cree un nuevo SET para continuar.`);
    }
    if (sides.has(String(config.side))) {
      return reject('Esta posición del SET ya está registrada. No se puede duplicar la fotografía.');
    }

    return { allowed: true, lockKey: lockKey! };
  };


  const captureBatchPhoto = async () => {
    // Anti doble-tap con ref (sin spinner ni disabled en el botón)
    if (!selectedProject || capturingRef.current) return;

    // Bloqueo absoluto de SET antes de acceder a la cámara.
    const setValidation = validateActiveSetBeforeCapture();
    if (!setValidation.allowed) return;
    if (setValidation.lockKey) {
      activeSetCaptureLockRef.current = setValidation.lockKey;
    }

    // NAPS tiene un límite absoluto de 9 fotografías por set.
    // Además se bloquea una segunda captura mientras la anterior termina de
    // guardarse, evitando que un doble toque produzca FOTO 10/9.
    const isNapCapture = evidenceCategory === 'NAPS' && !!napCaptureDraft;
    const isMufaCapture = evidenceCategory === 'MUFA' && !!mufaCaptureDraft;
    const isMejoraCapture = evidenceCategory === 'MEJORAS' && !!mejoraCaptureDraft;

    if (isMejoraCapture) {
      if (mejoraCaptureInFlightRef.current) return;

      const { mejoraId, side } = mejoraCaptureDraft!;
      const alreadyCaptured = evidences.some(
        ev =>
          ev.category === 'MEJORAS' &&
          ev.mejoraId === mejoraId &&
          ev.mejoraSide === side &&
          !!ev.photoUrl
      );

      if (alreadyCaptured) {
        setMejoraCaptureDraft(null);
        setShowMejoraCaptureModal(false);
        setMejoraPromptMode(null);
        setCurrentStep('history');
        return;
      }

      mejoraCaptureInFlightRef.current = true;
      setIsProcessing(true);
    }

    if (isNapCapture) {
      if (napCaptureInFlightRef.current) return;

      const napId = napCaptureDraft!.napId;
      const napEvidences = evidences.filter(
        ev => ev.category === 'NAPS' && ev.napId === napId
      );
      const capturedSlots = new Set(
        napEvidences
          .map(ev => Number(ev.napPhotoNumber))
          .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
      );

      if (capturedSlots.size >= 9 || napCaptureDraft!.photoNumber > 9) {
        napCaptureInFlightRef.current = false;
        setNapCaptureDraft(null);
        setShowNapCaptureModal(false);
        setCurrentStep('history');
        return;
      }

      napCaptureInFlightRef.current = true;
    }

    if (isMufaCapture) {
      if (mufaCaptureInFlightRef.current) return;

      const mufaEvidences = evidences.filter(ev => ev.category === 'MUFA' && (
        (ev.mufaId && ev.mufaId === mufaCaptureDraft!.mufaId) ||
        (!ev.mufaId &&
          Number(ev.mufaNumber) === Number(mufaCaptureDraft!.mufaNumber) &&
          String(ev.mufaName || '').trim().toUpperCase() === String(mufaCaptureDraft!.mufaName || '').trim().toUpperCase())
      ));
      const capturedSlots = new Set(
        mufaEvidences
          .map(ev => Number(ev.mufaPhotoNumber ?? ev.photoNumber))
          .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
      );

      if (capturedSlots.size >= 9 || mufaCaptureDraft!.photoNumber > 9) {
        setMufaCaptureDraft(null);
        setShowMufaCaptureModal(false);
        setCurrentStep('history');
        return;
      }

      mufaCaptureInFlightRef.current = true;
    }

    capturingRef.current = true;

    try {
      // Captura física. Android usa CameraPreview; Chrome usa getUserMedia para probar el flujo sin APK.
      let rawImage: string | null = null;
      if (!isNativeCamera) {
        const video = webCameraVideoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
          throw new Error('La cámara web todavía no está lista.');
        }
        const canvas = document.createElement('canvas');
        const maxDim = 4096;
        const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo preparar la captura de cámara.');
        if (cameraFacing === 'front') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        rawImage = canvas.toDataURL('image/jpeg', 0.95);
      } else {
        const photoSize = await getBestPhotoCaptureSize(cameraFacing);
        const captureResult = await CameraPreview.capture({
          width: photoSize.width,
          height: photoSize.height,
          quality: 95,
          format: 'jpeg',
        });
        const capturedValue = captureResult?.value;
        rawImage = capturedValue
          ? (capturedValue.startsWith('data:') ? capturedValue : `data:image/jpeg;base64,${capturedValue}`)
          : null;
      }
      if (!rawImage) throw new Error('No se pudo capturar la imagen con la cámara');

      // MEJORAS mantiene el bloqueo hasta terminar el procesamiento y cerrar
      // la cámara. Las demás categorías conservan el comportamiento existente.
      if (!isMejoraCapture) {
        capturingRef.current = false;
      }

      // Re-armar flash en background (no bloquea siguiente disparo)
      if (flashMode === 'on') {
        void ensureFlashArmed('on');
      }

      // GPS 100% síncrono en memoria (0ms). Si GPS del teléfono está apagado → SIN GPS (no caché)
      const { gps: stateGps, locationData, isLive, diagnostic } = locationService.getCurrentState();
      const locationOff = diagnostic?.status === 'location_disabled' || diagnostic?.locationServicesEnabled === false;
      const activeGps = locationOff ? null : stateGps;
      const hasGps = !!(activeGps && activeGps.lat != null && activeGps.lon != null);      const isActualLive = !!(hasGps && (activeGps!.source === 'live' || isLive));
      const gpsLabel = locationOff
        ? 'SIN GPS (GPS DESACTIVADO)'
        : hasGps
          ? (isActualLive ? `${activeGps!.lat.toFixed(6)}, ${activeGps!.lon.toFixed(6)}` : `${activeGps!.lat.toFixed(6)}, ${activeGps!.lon.toFixed(6)} (CACHÉ)`)
          : 'SIN GPS';
      const currentFormattedLocation = getFormattedLocationText(locationData, selectedProject);
      const ubicacionText = hasGps && currentFormattedLocation && currentFormattedLocation !== "Buscando..."
        ? currentFormattedLocation
        : (hasGps ? "Pendiente de geocodificación" : "");

      const uuid = crypto.randomUUID ? crypto.randomUUID() : 'ev_' + Date.now() + Math.random().toString(36).substr(2, 9);
      const fileName = `FT_${uuid}.jpg`;
      const capturedAt = new Date();
      const timestamp = capturedAt.getTime();
      const fecha = capturedAt.toLocaleDateString('es-ES');
      const hora = capturedAt.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });

      const customFieldsSnapshot = selectedProject.customFields.map(f => ({ ...f }));
      const selectedEvidenceCategory = EVIDENCE_CATEGORIES.find(c => c.id === evidenceCategory);
      if (!selectedEvidenceCategory) throw new Error('Seleccione el tipo de evidencia antes de tomar la fotografía.');

      if (selectedEvidenceCategory.id === 'RESERVA' && reserveCaptureDraft?.reserveId && reserveCaptureDraft.reelNumber?.trim()) {
        try {
          localStorage.setItem(
            `fieldtrace_reserve_reel_${reserveCaptureDraft.reserveId}`,
            reserveCaptureDraft.reelNumber.trim()
          );
        } catch {
          // localStorage may be unavailable in restricted browser contexts; IndexedDB remains the source of truth.
        }
      }
      const captureCategoryId: EvidenceCategory =
        evidenceCategory === 'PUNTAS_FIBRA'
          ? (fiberCaptureDraft?.side === 'final' ? 'PUNTAS_FIBRA_FINAL' : 'PUNTAS_FIBRA_INICIAL')
          : selectedEvidenceCategory.id;
      const captureCategoryLabel =
        captureCategoryId === 'PUNTAS_FIBRA_FINAL'
          ? 'Puntas de fibra – Final'
          : captureCategoryId === 'PUNTAS_FIBRA_INICIAL'
            ? 'Puntas de fibra – Inicial'
            : selectedEvidenceCategory.id === 'ACEROS'
              ? `Aceros – ${aceroCaptureDraft?.side === 'photo2' ? 'Metraje' : 'Panorámica'}`
              : selectedEvidenceCategory.id === 'DESECHOS'
                ? `Desechos – ${desechoCaptureDraft?.side === 'photo2' ? 'Metraje' : 'Panorámica'}`
                : selectedEvidenceCategory.id === 'ALTAS'
                ? `Altas – ${altaCaptureDraft?.side === 'meterage' ? 'Metraje' : 'Panorámica'}`
                : selectedEvidenceCategory.id === 'MEJORAS'
                ? `Mejoras – ${mejoraCaptureDraft?.mejoraType || ''}`
                : selectedEvidenceCategory.label;

      // Las puntas de fibra llevan sus datos operativos dentro de la evidencia
      // como campos personalizados para que queden impresos en el overlay.
      if (isFiberCategory(captureCategoryId) && fiberCaptureDraft) {
        customFieldsSnapshot.push(
          { name: 'PUNTA', value: String(fiberCaptureDraft.pairNumber), showInPhoto: true, active: true },
          { name: 'TIPO', value: fiberCaptureDraft.side === 'initial' ? 'INICIAL' : 'FINAL', showInPhoto: true, active: true },
          { name: 'NÚMERO DE CARRETE', value: fiberCaptureDraft.reelNumber.trim(), showInPhoto: true, active: true },
          { name: 'CANTIDAD DE FIBRAS', value: fiberCaptureDraft.fiberCount.trim(), showInPhoto: true, active: true },
          { name: 'METRAJE', value: `${fiberCaptureDraft.metraje.trim()} M`, showInPhoto: true, active: true }
        );
      }

      const viewfinderEl = document.getElementById('camera-viewfinder');
      const vfRect = viewfinderEl ? viewfinderEl.getBoundingClientRect() : null;
      const viewfinderMetrics = vfRect && vfRect.width > 0 && vfRect.height > 0
        ? { width: vfRect.width, height: vfRect.height, ratio: vfRect.width / vfRect.height }
        : { width: window.innerWidth, height: Math.max(1, window.innerHeight - 76), ratio: window.innerWidth / Math.max(1, window.innerHeight - 76) };

      // Objeto ÚNICO de metadatos/evidencia unificado (del cual se derivan overlay y IndexedDB)
      if (selectedEvidenceCategory.id === 'MUFA' && mufaCaptureDraft) {
        const currentMufaSlots = new Set(
          evidences
            .filter(ev => ev.category === 'MUFA' && (
              (ev.mufaId && ev.mufaId === mufaCaptureDraft.mufaId) ||
              (!ev.mufaId &&
                Number(ev.mufaNumber) === Number(mufaCaptureDraft.mufaNumber) &&
                String(ev.mufaName || '').trim().toUpperCase() === String(mufaCaptureDraft.mufaName || '').trim().toUpperCase())
            ))
            .map(ev => Number(ev.mufaPhotoNumber ?? ev.photoNumber))
            .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
        );

        if (currentMufaSlots.size >= 9) {
          mufaCaptureInFlightRef.current = false;
          setMufaCaptureDraft(null);
          setShowMufaCaptureModal(false);
          setCurrentStep('history');
          return;
        }
      }

      const evidenceObject: any = {
        uuid,
        projectId: selectedProject.id!,
        projectName: selectedProject.name,
        photoPath: fileName,
        category: captureCategoryId,
        categoryLabel: captureCategoryLabel,
        fiberPairId: isFiberCategory(selectedEvidenceCategory.id) ? (fiberCaptureDraft?.pairId || '') : undefined,
        fiberPairNumber: isFiberCategory(selectedEvidenceCategory.id) ? fiberCaptureDraft?.pairNumber : undefined,
        fiberMeterage: isFiberCategory(captureCategoryId) ? Number(fiberCaptureDraft?.metraje || 0) : undefined,
        fiberReelNumber: isFiberCategory(captureCategoryId) ? (fiberCaptureDraft?.reelNumber || '').trim() : undefined,
        fiberCount: isFiberCategory(captureCategoryId) ? Number(fiberCaptureDraft?.fiberCount || 0) : undefined,
        fiberSide: isFiberCategory(captureCategoryId) ? fiberCaptureDraft?.side : undefined,
        reserveId: selectedEvidenceCategory.id === 'RESERVA' ? (reserveCaptureDraft?.reserveId || '') : undefined,
        reserveNumber: selectedEvidenceCategory.id === 'RESERVA' ? reserveCaptureDraft?.reserveNumber : undefined,
        reserveSide: selectedEvidenceCategory.id === 'RESERVA' ? reserveCaptureDraft?.side : undefined,
        reserveReelNumber: selectedEvidenceCategory.id === 'RESERVA' ? (reserveCaptureDraft?.reelNumber || '').trim() : undefined,
        reserveFiberCount: selectedEvidenceCategory.id === 'RESERVA' ? Number(reserveCaptureDraft?.fiberCount || 0) : undefined,
        reserveMeterage: selectedEvidenceCategory.id === 'RESERVA' && reserveCaptureDraft?.side !== 'roll'
          ? Number(String(reserveCaptureDraft?.metraje || '0').replace(',', '.'))
          : undefined,
        altaId: selectedEvidenceCategory.id === 'ALTAS' ? (altaCaptureDraft?.altaId || '') : undefined,
        altaNumber: selectedEvidenceCategory.id === 'ALTAS' ? altaCaptureDraft?.altaNumber : undefined,
        altaType: selectedEvidenceCategory.id === 'ALTAS' ? altaCaptureDraft?.altaType : undefined,
        altaSide: selectedEvidenceCategory.id === 'ALTAS' ? altaCaptureDraft?.side : undefined,
        altaMeterage: selectedEvidenceCategory.id === 'ALTAS' && altaCaptureDraft?.side === 'meterage'
          ? Number(altaMeterageDraft || 0)
          : undefined,
        altaReelNumber: selectedEvidenceCategory.id === 'ALTAS' && (altaCaptureDraft?.altaType === 'FIBRA DE DESCARTE' || altaCaptureDraft?.altaType === 'FIBRA DE DESECHO')
          ? altaReelDraft.trim() || undefined
          : undefined,
        altaFiberCount: selectedEvidenceCategory.id === 'ALTAS' && (altaCaptureDraft?.altaType === 'FIBRA DE DESCARTE' || altaCaptureDraft?.altaType === 'FIBRA DE DESECHO')
          ? Number(altaFiberCountDraft || 0) || undefined
          : undefined,
        aceroId: selectedEvidenceCategory.id === 'ACEROS' ? (aceroCaptureDraft?.aceroId || '') : undefined,
        aceroNumber: selectedEvidenceCategory.id === 'ACEROS' ? aceroCaptureDraft?.aceroNumber : undefined,
        aceroSide: selectedEvidenceCategory.id === 'ACEROS' ? aceroCaptureDraft?.side : undefined,
        aceroPhotoType: selectedEvidenceCategory.id === 'ACEROS'
          ? (aceroCaptureDraft?.side === 'photo2' ? 'meterage' : 'panoramic')
          : undefined,
        aceroMeterage: selectedEvidenceCategory.id === 'ACEROS' && aceroCaptureDraft?.side === 'photo2'
          ? Number(aceroMeterageDraft || 0)
          : undefined,
        desechoId: selectedEvidenceCategory.id === 'DESECHOS' ? (desechoCaptureDraft?.desechoId || '') : undefined,
        desechoNumber: selectedEvidenceCategory.id === 'DESECHOS' ? desechoCaptureDraft?.desechoNumber : undefined,
        desechoSide: selectedEvidenceCategory.id === 'DESECHOS' ? desechoCaptureDraft?.side : undefined,
        desechoPhotoType: selectedEvidenceCategory.id === 'DESECHOS'
          ? (desechoCaptureDraft?.side === 'photo2' ? 'meterage' : 'panoramic')
          : undefined,
        desechoMeterage: selectedEvidenceCategory.id === 'DESECHOS' && desechoCaptureDraft?.side === 'photo2'
          ? Number(desechoMeterageDraft || 0)
          : undefined,
        mejoraId: selectedEvidenceCategory.id === 'MEJORAS' ? (mejoraCaptureDraft?.mejoraId || '') : undefined,
        mejoraNumber: selectedEvidenceCategory.id === 'MEJORAS' ? mejoraCaptureDraft?.mejoraNumber : undefined,
        mejoraType: selectedEvidenceCategory.id === 'MEJORAS' ? mejoraCaptureDraft?.mejoraType : undefined,
        mejoraSide: selectedEvidenceCategory.id === 'MEJORAS' ? mejoraCaptureDraft?.side : undefined,
        napId: selectedEvidenceCategory.id === 'NAPS' ? (napCaptureDraft?.napId || '') : undefined,
        napNumber: selectedEvidenceCategory.id === 'NAPS' ? napCaptureDraft?.napNumber : undefined,
        napName: selectedEvidenceCategory.id === 'NAPS' ? (napCaptureDraft?.napName || '').trim() : undefined,
        napPhotoNumber: selectedEvidenceCategory.id === 'NAPS' ? napCaptureDraft?.photoNumber : undefined,
        mufaId: selectedEvidenceCategory.id === 'MUFA' ? (mufaCaptureDraft?.mufaId || '') : undefined,
        mufaNumber: selectedEvidenceCategory.id === 'MUFA' ? mufaCaptureDraft?.mufaNumber : undefined,
        mufaName: selectedEvidenceCategory.id === 'MUFA' ? (mufaCaptureDraft?.mufaName || '').trim() : undefined,
        mufaPhotoNumber: selectedEvidenceCategory.id === 'MUFA' ? mufaCaptureDraft?.photoNumber : undefined,
        photo: {
          fileName,
          createdAt: capturedAt
        },
        capturedAt,
        fecha,
        hora,
        timestamp,
        latitude: hasGps ? activeGps!.lat : null,
        longitude: hasGps ? activeGps!.lon : null,
        gpsAccuracy: hasGps ? activeGps!.accuracy : undefined,
        gpsSource: hasGps ? (isActualLive ? 'live' : 'cache') : 'none',
        gpsCapturedAt: hasGps ? capturedAt : undefined,
        gpsLabel,
        ubicacion: ubicacionText,
        baseFields: { 
          tecnico: selectedProject.techName || "TECNICO" 
        },
        customFields: customFieldsSnapshot,
        sharedWhatsApp: false,
        createdAt: capturedAt,
        locked: true,
        syncStatus: 'pending',
        retryCount: 0,
        viewfinder: viewfinderMetrics,
        // Propiedades auxiliares para el overlay
        projectNameOverlay: selectedProject.name,
        dateTimeFormatted: formatDateTime(selectedProject.dateTimeFormat),
        settings: {
          showDateTime: selectedProject.showDateTime,
          dateTimeFormat: selectedProject.dateTimeFormat,
          showGps: selectedProject.showGps,
          showLocation: selectedProject.showLocation,
          showTech: selectedProject.showTech,
          overlayPosition: selectedProject.overlayPosition,
          fontSizeScale: selectedProject.fontSizeScale,
          fontSizeValue: selectedProject.fontSizeValue,
          overlayColor: selectedProject.overlayColor,
          logoImage: selectedProject.logoImage,
          logoPosition: selectedProject.logoPosition,
          logoSize: selectedProject.logoSize,
          logoOpacity: selectedProject.logoOpacity,
          viewfinder: viewfinderMetrics
        }
      };

      // Procesamiento asíncrono atómico
      let napAsyncProcessingStarted = false;
      let mejoraAsyncProcessingStarted = false;
      let setAsyncProcessingStarted = false;
      setAsyncProcessingStarted = true;
      (async () => {
        napAsyncProcessingStarted = true;
        if (isMejoraCapture) mejoraAsyncProcessingStarted = true;
        try {
          // 1. Generar overlay utilizando el objeto unificado
          const finalImage = await cameraService.drawOverlay(rawImage, evidenceObject);
          if (!finalImage) {
             throw new Error("Error procesando overlay");
          }
          setLastImage(finalImage);
          
          // 2. En Android se guarda también en la galería Field Trace.
          // En navegador de desarrollo la evidencia se conserva en IndexedDB para probar el flujo sin APK.
          let savedToGallerySuccess = true;
          if (isNativeCamera) {
            savedToGallerySuccess = await cameraService.saveToGallery(finalImage, fileName);
          } else {
            // Chrome no puede escribir directamente en la galería del teléfono.
            // Para las pruebas web descargamos una copia local y mantenemos la evidencia en IndexedDB.
            try {
              const response = await fetch(finalImage);
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = fileName;
              link.rel = 'noopener';
              document.body.appendChild(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (downloadError) {
              console.warn('[WebCamera] No se pudo descargar la fotografía de prueba:', downloadError);
              savedToGallerySuccess = false;
            }
          }
          if (!savedToGallerySuccess) {
            console.error("[AtomicCapture] Error: No se pudo guardar la fotografía. Abortando registro de evidencia.");
            return;
          }

          // 3. Guardar Evidence en IndexedDB para que aparezca inmediatamente en el proyecto
          await storageService.addEvidence(evidenceObject, finalImage);

          // 4. Actualizar estado de UI
          const evs = await storageService.getEvidencesByProject(selectedProject.id!);
          setEvidences(evs);

          // Las reservas son fotografías individuales. Después de cada captura
          // regresamos al proyecto para evitar que el técnico tome fotos extra.
          if (selectedEvidenceCategory.id === 'RESERVA' || selectedEvidenceCategory.id === 'ALTAS' || selectedEvidenceCategory.id === 'ACEROS' || selectedEvidenceCategory.id === 'DESECHOS' || selectedEvidenceCategory.id === 'MEJORAS' || evidenceCategory === 'PUNTAS_FIBRA') {
            setShowReserveCaptureModal(false);
            setShowAltaCaptureModal(false);
            setReserveCaptureDraft(null);
            setAltaCaptureDraft(null);
            setAceroCaptureDraft(null);
            setDesechoCaptureDraft(null);
            setDesechoSetChoice(null);
            setShowDesechoCaptureModal(false);
            setDesechoPromptMode(null);
            setDesechoMeterageDraft('');
            setMejoraCaptureDraft(null);
            setMejoraSetChoice(null);
            setShowMejoraCaptureModal(false);
            setMejoraPromptMode(null);
            setFiberCaptureDraft(null);
            setCurrentStep('history');
          } else if (selectedEvidenceCategory.id === 'NAPS' && napCaptureDraft) {
            // NAPS: exactamente 9 fotos como máximo. La novena captura cierra
            // la cámara inmediatamente después de quedar guardada.
            const capturedNapCount = evs.filter(
              ev => ev.category === 'NAPS' && ev.napId === napCaptureDraft.napId
            ).length;
            const remainingAfterCapture = Math.max(0, 9 - capturedNapCount);

            if (capturedNapCount >= 9 || napCaptureDraft.photoNumber >= 9) {
              napCaptureInFlightRef.current = false;
              setNapCaptureDraft(null);
              setShowNapCaptureModal(false);
              setCurrentStep('history');
            } else {
              const capturedSlots = new Set(
                evs
                  .filter(ev => ev.category === 'NAPS' && ev.napId === napCaptureDraft.napId)
                  .map(ev => Number(ev.napPhotoNumber))
                  .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
              );
              const nextPhotoNumber = Array.from({ length: 9 }, (_, i) => i + 1)
                .find(n => !capturedSlots.has(n)) || 10;

              if (nextPhotoNumber > 9 || remainingAfterCapture <= 0) {
                napCaptureInFlightRef.current = false;
                setNapCaptureDraft(null);
                setShowNapCaptureModal(false);
                setCurrentStep('history');
              } else {
                setNapCaptureDraft(prev => prev ? {
                  ...prev,
                  photoNumber: nextPhotoNumber,
                  remainingPhotos: remainingAfterCapture
                } : prev);
                napCaptureInFlightRef.current = false;
              }
            }
          } else if (selectedEvidenceCategory.id === 'MUFA' && mufaCaptureDraft) {
            const remainingAfterCapture = Math.max(0, mufaCaptureDraft.remainingPhotos - 1);

            if (mufaCaptureDraft.photoNumber >= 9 || remainingAfterCapture <= 0) {
              mufaCaptureInFlightRef.current = false;
              setMufaCaptureDraft(null);
              setShowMufaCaptureModal(false);
              setCurrentStep('history');
            } else {
              setMufaCaptureDraft(prev => prev ? {
                ...prev,
                photoNumber: prev.photoNumber + 1,
                remainingPhotos: remainingAfterCapture
              } : prev);
              mufaCaptureInFlightRef.current = false;
            }
          }
        } catch (e: any) {
          console.error("Fallo procesamiento asíncrono en captura", e);
        } finally {
          activeSetCaptureLockRef.current = null;
          if (isNapCapture) {
            napCaptureInFlightRef.current = false;
          }
          if (isMufaCapture) {
            mufaCaptureInFlightRef.current = false;
          }
          if (isMejoraCapture) {
            mejoraCaptureInFlightRef.current = false;
            setIsProcessing(false);
          }
        }
      })();

    } catch (e: any) {
      console.error('Batch capture error', e);
      capturingRef.current = false;
    } finally {
      capturingRef.current = false;
      if (!setAsyncProcessingStarted) {
        activeSetCaptureLockRef.current = null;
      }
      // Si una captura de MEJORAS falla antes de iniciar el procesamiento
      // asíncrono, liberar el bloqueo para permitir reintentar.
      if (isMejoraCapture && !mejoraAsyncProcessingStarted) {
        mejoraCaptureInFlightRef.current = false;
        setIsProcessing(false);
      }
      // Si la captura física de NAPS falla antes de iniciar el procesamiento
      // asíncrono, liberar el bloqueo para permitir reintentar.
      if (isNapCapture && !napAsyncProcessingStarted) {
        napCaptureInFlightRef.current = false;
      }
      // Re-armar el flash en background (no bloquea)
      if (flashMode === 'on') {
        void ensureFlashArmed('on');
      }
    }
  };

  const openGalleryGrid = async () => {
    setShowGalleryGrid(true);
    setGalleryLoading(true);
    setGalleryThumbs([]);
    try {
      const photos = await cameraService.listAlbumPhotos(60);
      const withThumbs: Array<{ uri: string; thumb: string }> = [];
      for (const ph of photos) {
        const t = await cameraService.getPhotoThumbnail(ph.uri, 200);
        if (t) withThumbs.push({ uri: ph.uri, thumb: t });
      }
      setGalleryThumbs(withThumbs);
    } catch (e) {
      console.warn('[Gallery] grid load failed', e);
    } finally {
      setGalleryLoading(false);
    }
  };

  const openPhotoViewer = (index: number) => {
    if (!galleryThumbs.length) return;
    const safe = Math.max(0, Math.min(index, galleryThumbs.length - 1));
    setViewerIndex(safe);
    setShowPhotoViewer(true);
  }

  const toggleGallerySelect = (uri: string) => {
    setSelectedGalleryUris((prev) =>
      prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri]
    );
  };

  const clearGallerySelection = () => {
    setSelectedGalleryUris([]);
    setGallerySelectMode(false);
  };

  const shareSelectedGallery = (uris?: string[]) => {
    const list = uris && uris.length ? uris : selectedGalleryUris;
    if (!list.length) return;
    try {
      const native = (window as any).FieldTraceNative;
      if (native && typeof native.shareUris === 'function') {
        native.shareUris(JSON.stringify(list));
      } else {
        console.warn('[Gallery] shareUris not available');
      }
    } catch (e) {
      console.error('[Gallery] share failed', e);
    }
  };

  const requestDeleteGallery = (uris?: string[]) => {
    const list = uris && uris.length ? uris : selectedGalleryUris;
    if (!list.length) return;
    setSelectedGalleryUris(list);
    setConfirmDeleteGalleryStep(1);
  };

  const executeDeleteGallery = async () => {
    const list = [...selectedGalleryUris];
    if (!list.length) {
      setConfirmDeleteGalleryStep(0);
      return;
    }
    try {
      const native = (window as any).FieldTraceNative;
      if (native && typeof native.deleteUris === 'function') {
        native.deleteUris(JSON.stringify(list));
      }
      const remaining = galleryThumbs.filter((p) => !list.includes(p.uri));
      setGalleryThumbs(remaining);
      if (showPhotoViewer) {
        if (remaining.length === 0) {
          setShowPhotoViewer(false);
        } else {
          setViewerIndex((i) => Math.min(i, remaining.length - 1));
        }
      }
      clearGallerySelection();
      try {
        const photos = await cameraService.listAlbumPhotos(60);
        const mapped = (photos || []).map((p: any) => ({
          uri: p.uri,
          thumb: p.thumb || p.uri,
        }));
        setGalleryThumbs(mapped);
      } catch (_) {}
    } catch (e) {
      console.error('[Gallery] delete failed', e);
    } finally {
      setConfirmDeleteGalleryStep(0);
    }
  };
;

  // Cargar imagen de alta calidad al cambiar de foto en el visor in-app
  useEffect(() => {
    if (!showPhotoViewer || !galleryThumbs.length) return;
    let cancelled = false;
    const loadAround = async () => {
      const indices = [viewerIndex, viewerIndex - 1, viewerIndex + 1].filter(
        (i) => i >= 0 && i < galleryThumbs.length
      );
      for (const i of indices) {
        const uri = galleryThumbs[i].uri;
        if (viewerFullImages[uri]) continue;
        try {
          const full = await cameraService.getPhotoThumbnail(uri, 1600);
          if (!cancelled && full) {
            setViewerFullImages((prev) => (prev[uri] ? prev : { ...prev, [uri]: full }));
          }
        } catch (e) {
          console.warn('[Viewer] full image load failed', e);
        }
      }
    };
    void loadAround();
    return () => { cancelled = true; };
  }, [showPhotoViewer, viewerIndex, galleryThumbs]);

  const shareNative = async () => {
    if (!lastImage || !selectedProject) return;
    const { gps, locationData } = locationService.getCurrentState();
    const currentFormattedLocation = getFormattedLocationText(locationData, selectedProject);
    await shareService.sharePhoto(
      'Evidencia de Campo',
      `Proyecto: ${selectedProject.name}\nGPS: ${gps?.lat}, ${gps?.lon}\nUbicación: ${currentFormattedLocation}`,
      lastImage
    );
  };

  const fiberPairs = Array.from(
    new Set(
      evidences
        .filter(ev => (ev.category === 'PUNTAS_FIBRA_INICIAL' || ev.category === 'PUNTAS_FIBRA_FINAL') && ev.fiberPairId)
        .map(ev => ev.fiberPairId as string)
    )
  ).map(pairId => {
    const pairEvidences = evidences.filter(ev => ev.fiberPairId === pairId && !!ev.photoUrl);
    const initial = pairEvidences.find(ev => ev.category === 'PUNTAS_FIBRA_INICIAL');
    const final = pairEvidences.find(ev => ev.category === 'PUNTAS_FIBRA_FINAL');
    return {
      pairId,
      pairNumber: Number(initial?.fiberPairNumber || final?.fiberPairNumber || 0),
      hasInitial: !!initial,
      hasFinal: !!final,
      complete: !!initial && !!final,    };
  }).sort((a, b) => a.pairNumber - b.pairNumber);

  const completedFiberPairs = fiberPairs.filter(pair => pair.complete);
  const pendingFiberPairs = fiberPairs.filter(pair => !pair.complete);
  const fiberPendingLabels = pendingFiberPairs.map(pair =>
    `PUNTA ${String(pair.pairNumber).padStart(2, '0')}: ${!pair.hasInitial ? 'FALTA INICIAL' : 'FALTA FINAL'}`
  );

  const evidenceCategoryProgress = EVIDENCE_CATEGORIES.map(category => {
    const categoryEvidences = evidences.filter(ev => ev.category === category.id && !!ev.photoUrl);
    if (category.id === 'RESERVA') {
      const reserveIds = Array.from(new Set(categoryEvidences.map(ev => ev.reserveId).filter(Boolean)));
      const completedReserves = reserveIds.filter(id =>
        ['initial', 'final', 'roll'].every(side =>
          categoryEvidences.some(ev => ev.reserveId === id && ev.reserveSide === side)
        )
      ).length;
      const pendingReserveLabels = reserveIds
        .map(id => {
          const reserveEvidences = categoryEvidences.filter(ev => ev.reserveId === id);
          const first = reserveEvidences[0];
          const reserveNumber = Number(first?.reserveNumber || 0);
          const missingSides = (['initial', 'final', 'roll'] as const)
            .filter(side => !reserveEvidences.some(ev => ev.reserveSide === side))
            .map(side => side === 'initial' ? 'INICIAL' : side === 'final' ? 'FINAL' : 'ROLLO');
          return {
            reserveNumber,
            missingSides,
            label: missingSides.length
              ? `RESERVA ${String(reserveNumber).padStart(2, '0')}: FALTA ${missingSides.join(' Y ')}`
              : ''
          };
        })
        .filter(item => item.missingSides.length > 0)
        .sort((a, b) => a.reserveNumber - b.reserveNumber)
        .map(item => item.label);
      const pendingReserves = pendingReserveLabels.length;
      return {
        ...category,
        count: categoryEvidences.length,
        completed: reserveIds.length > 0 && pendingReserves === 0,
        reserveCompletedCount: completedReserves,
        reserveCount: reserveIds.length,
        reservePendingCount: pendingReserves,
        pendingReserveLabels,
      };
    }

    if (category.id === 'ALTAS') {
      const altaIds = Array.from(new Set(categoryEvidences.map(ev => ev.altaId).filter(Boolean))) as string[];
      const altaGroups = altaIds.map(altaId => {
        const group = categoryEvidences.filter(ev => ev.altaId === altaId);
        const first = group[0];
        const altaNumber = Number(first?.altaNumber || 0);
        const altaType = first?.altaType || 'ALTA';
        const hasPanoramic = group.some(ev => ev.altaSide === 'panoramic');
        const hasMeterage = group.some(ev => ev.altaSide === 'meterage');
        return { altaId, altaNumber, altaType, hasPanoramic, hasMeterage, count: group.length, complete: hasPanoramic && hasMeterage };
      }).sort((a, b) => a.altaNumber - b.altaNumber);
      const completedAltas = altaGroups.filter(alta => alta.complete).length;
      const pendingAltaLabels = altaGroups.filter(alta => !alta.complete).map(alta => {
        const missing = [!alta.hasPanoramic ? 'PANORÁMICA' : '', !alta.hasMeterage ? 'METRAJE' : ''].filter(Boolean).join(' Y ');
        return `ALTA ${String(alta.altaNumber).padStart(2, '0')} · ${alta.altaType}: FALTA ${missing}`;
      });
      return {
        ...category,
        count: categoryEvidences.length,
        completed: altaGroups.length > 0 && altaGroups.every(alta => alta.complete),
        altaCount: altaGroups.length,
        altaCompletedCount: completedAltas,
        altaPendingLabels: pendingAltaLabels,
        reserveCompletedCount: 0, reserveCount: 0, reservePendingCount: 0, pendingReserveLabels: [],
        fiberPairCount: 0, fiberCompleteCount: 0, fiberPendingCount: 0, fiberPendingLabels: [], fiberRole: null,
      };    }

    if (category.id === 'ACEROS') {
      const aceroIds = Array.from(new Set(categoryEvidences.map(ev => ev.aceroId).filter(Boolean))) as string[];
      const aceroGroups = aceroIds.map(aceroId => {
        const group = categoryEvidences.filter(ev => ev.aceroId === aceroId);
        const first = group[0];
        const aceroNumber = Number(first?.aceroNumber || 0);
        const hasPhoto1 = group.some(ev => ev.aceroSide === 'photo1');
        const hasPhoto2 = group.some(ev => ev.aceroSide === 'photo2');
        return { aceroId, aceroNumber, hasPhoto1, hasPhoto2, count: group.length, complete: hasPhoto1 && hasPhoto2 };
      }).sort((a, b) => a.aceroNumber - b.aceroNumber);
      const completedAceros = aceroGroups.filter(acero => acero.complete).length;
      const pendingAceroLabels = aceroGroups.filter(acero => !acero.complete).map(acero => {
        const missing = !acero.hasPhoto1 ? 'PANORÁMICA' : 'METRAJE';
        return `ACERO ${String(acero.aceroNumber).padStart(2, '0')}: FALTA ${missing}`;
      });
      return {
        ...category,
        count: categoryEvidences.length,
        completed: aceroGroups.length > 0 && aceroGroups.every(acero => acero.complete),
        aceroCount: aceroGroups.length,
        aceroCompletedCount: completedAceros,
        aceroPendingLabels: pendingAceroLabels,
        reserveCompletedCount: 0, reserveCount: 0, reservePendingCount: 0, pendingReserveLabels: [],
        fiberPairCount: 0, fiberCompleteCount: 0, fiberPendingCount: 0, fiberPendingLabels: [], fiberRole: null,
      };
    }

    if (category.id === 'DESECHOS') {
      const desechoIds = Array.from(new Set(categoryEvidences.map(ev => ev.desechoId).filter(Boolean))) as string[];
      const desechoGroups = desechoIds.map(desechoId => {
        const group = categoryEvidences.filter(ev => ev.desechoId === desechoId);        const first = group[0];
        const desechoNumber = Number(first?.desechoNumber || 0);
        const hasPhoto1 = group.some(ev => ev.desechoSide === 'photo1');        const hasPhoto2 = group.some(ev => ev.desechoSide === 'photo2');
        return { desechoId, desechoNumber, hasPhoto1, hasPhoto2, count: group.length, complete: hasPhoto1 && hasPhoto2 };
      }).sort((a, b) => a.desechoNumber - b.desechoNumber);      const completedDesechos = desechoGroups.filter(item => item.complete).length;
      const pendingDesechoLabels = desechoGroups.filter(item => !item.complete).map(item => {
        const missing = !item.hasPhoto1 ? 'PANORÁMICA' : 'METRAJE';
        return `DESECHO ${String(item.desechoNumber).padStart(2, '0')}: FALTA ${missing}`;
      });
      return {
        ...category,
        count: categoryEvidences.length,
        completed: desechoGroups.length > 0 && desechoGroups.every(item => item.complete),
        desechoCount: desechoGroups.length,
        desechoCompletedCount: completedDesechos,
        desechoPendingLabels: pendingDesechoLabels,
        reserveCompletedCount: 0, reserveCount: 0, reservePendingCount: 0, pendingReserveLabels: [],
        fiberPairCount: 0, fiberCompleteCount: 0, fiberPendingCount: 0, fiberPendingLabels: [], fiberRole: null,
      };
    }

    if (category.id === 'MEJORAS') {
      const mejoraIds = Array.from(new Set(categoryEvidences.map(ev => ev.mejoraId).filter(Boolean))) as string[];
      const mejoraGroups = mejoraIds.map(mejoraId => {
        const group = categoryEvidences.filter(ev => ev.mejoraId === mejoraId);
        const first = group[0];
        const mejoraNumber = Number(first?.mejoraNumber || 0);
        const mejoraType = first?.mejoraType || 'MEJORA';
        const hasBefore = group.some(ev => ev.mejoraSide === 'before');
        const hasAfter = group.some(ev => ev.mejoraSide === 'after');
        return { mejoraId, mejoraNumber, mejoraType, hasBefore, hasAfter, count: group.length, complete: hasBefore && hasAfter };
      }).sort((a, b) => a.mejoraNumber - b.mejoraNumber);
      const completedMejoras = mejoraGroups.filter(item => item.complete).length;
      const pendingMejoraLabels = mejoraGroups.filter(item => !item.complete).map(item => {
        const missing = !item.hasBefore ? 'ANTES' : 'DESPUÉS';
        return `MEJORA ${String(item.mejoraNumber).padStart(2, '0')} · ${item.mejoraType}: FALTA ${missing}`;
      });
      return {
        ...category,
        count: categoryEvidences.length,
        completed: mejoraGroups.length > 0 && mejoraGroups.every(item => item.complete),
        mejoraCount: mejoraGroups.length,
        mejoraCompletedCount: completedMejoras,
        mejoraPendingLabels: pendingMejoraLabels,
        reserveCompletedCount: 0, reserveCount: 0, reservePendingCount: 0, pendingReserveLabels: [],
        fiberPairCount: 0, fiberCompleteCount: 0, fiberPendingCount: 0, fiberPendingLabels: [], fiberRole: null,
      };
    }

    if (category.id === 'NAPS') {
      const napIds = Array.from(new Set(categoryEvidences.map(ev => ev.napId).filter(Boolean))) as string[];
      const napGroups = napIds.map(napId => {
        const group = categoryEvidences.filter(ev => ev.napId === napId);
        const first = group[0];
        return { napNumber: Number(first?.napNumber || 0), napName: first?.napName || '', count: group.length };
      }).sort((a, b) => a.napNumber - b.napNumber);
      const completedNaps = napGroups.filter(nap => nap.count >= 9).length;
      const pendingNapLabels = napGroups.filter(nap => nap.count < 9)
        .map(nap => 'NAP ' + String(nap.napNumber).padStart(2, '0') + ' · ' + (nap.napName || 'SIN NOMBRE') + ': ' + nap.count + '/9 FOTOS');
      return {
        ...category,
        count: categoryEvidences.length,
        completed: napGroups.length > 0 && napGroups.every(nap => nap.count >= 9),
        napCount: napGroups.length,
        napCompletedCount: completedNaps,
        pendingNapLabels,
        reserveCompletedCount: 0, reserveCount: 0, reservePendingCount: 0, pendingReserveLabels: [],
        fiberPairCount: 0, fiberCompleteCount: 0, fiberPendingCount: 0, fiberPendingLabels: [], fiberRole: null,
      };
    }
    if (category.id === 'MUFA') {
      const getMufaKey = (ev: any) => {
        const mufaNumber = Number(ev.mufaNumber || 0);
        const mufaName = String(ev.mufaName || '').trim().toUpperCase();
        const isLegacyPlaceholder = mufaNumber === 0 && (!mufaName || mufaName === 'MUFA');
        return isLegacyPlaceholder
          ? 'mufa_legacy_placeholder'
          : (ev.mufaId || 'mufa_' + mufaNumber + '_' + mufaName);
      };
      const mufaKeys = Array.from(new Set(categoryEvidences.map(getMufaKey)));
      const mufaGroups = mufaKeys.map(mufaKey => {
        const group = categoryEvidences.filter(ev => getMufaKey(ev) === mufaKey);
        const first = group[0];
        const capturedSlots = new Set(
          group
            .filter(ev => Boolean(String(ev.photoUrl || ev.photo?.uri || ev.photo?.url || '').trim()))
            .map(ev => Number(ev.mufaPhotoNumber ?? ev.photoNumber))
            .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
        );
        const firstMufaNumber = Number(first?.mufaNumber || 0);
        const firstMufaName = String(first?.mufaName || '').trim();
        const displayName = firstMufaNumber === 0 && (!firstMufaName || firstMufaName.toUpperCase() === 'MUFA')
          ? ''
          : firstMufaName;
        return {
          mufaNumber: firstMufaNumber,
          mufaName: displayName,
          count: capturedSlots.size
        };
      }).sort((a, b) => a.mufaNumber - b.mufaNumber);
      const completedMufas = mufaGroups.filter(mufa => mufa.count >= 9).length;
      const pendingMufaLabels = mufaGroups.filter(mufa => mufa.count < 9)
        .map(mufa => 'MUFA ' + String(mufa.mufaNumber).padStart(2, '0') + (mufa.mufaName ? ' · ' + mufa.mufaName : '') + ': ' + mufa.count + '/9 FOTOS');
      return {
        ...category,
        count: categoryEvidences.filter(ev => Boolean(String(ev.photoUrl || ev.photo?.uri || ev.photo?.url || '').trim())).length,
        completed: mufaGroups.length > 0 && mufaGroups.every(mufa => mufa.count >= 9),
        mufaCount: mufaGroups.length,
        mufaCompletedCount: completedMufas,
        pendingMufaLabels,
        reserveCompletedCount: 0, reserveCount: 0, reservePendingCount: 0, pendingReserveLabels: [],
        fiberPairCount: 0, fiberCompleteCount: 0, fiberPendingCount: 0, fiberPendingLabels: [], fiberRole: null,
      };
    }
    if (category.id === 'PUNTAS_FIBRA') {
      return {
        ...category,
        count: fiberPairs.reduce((total, pair) => total + (pair.hasInitial ? 1 : 0) + (pair.hasFinal ? 1 : 0), 0),
        completed: fiberPairs.length > 0 && pendingFiberPairs.length === 0,
        fiberPairCount: fiberPairs.length,
        fiberCompleteCount: completedFiberPairs.length,
        fiberPendingCount: pendingFiberPairs.length,
        fiberPendingLabels,
        fiberRole: null,
        reserveCompletedCount: 0,
        reserveCount: 0,
        reservePendingCount: 0,
        pendingReserveLabels: [],
      };
    }

    const count = categoryEvidences.length;
    return {
      ...category,
      count,
      completed: count > 0,
      reserveCompletedCount: 0,
      reserveCount: 0,
      reservePendingCount: 0,
      pendingReserveLabels: [],
      fiberPairCount: 0,
      fiberCompleteCount: 0,
      fiberPendingCount: 0,
      fiberPendingLabels: [],
      fiberRole: null,
      altaCount: 0,
      altaCompletedCount: 0,
      altaPendingLabels: [],
    };
  });
  const completedEvidenceCategories = evidenceCategoryProgress.filter(category => category.completed).length;
  const pendingEvidenceCategories = evidenceCategoryProgress.length - completedEvidenceCategories;
  const evidenceProgressPercent = evidenceCategoryProgress.length
    ? Math.round((completedEvidenceCategories / evidenceCategoryProgress.length) * 100)
    : 0;

  const reserveHasSide = (reserveId: string, side: 'initial' | 'final' | 'roll') =>
    evidences.some(ev =>
      ev.category === 'RESERVA' &&
      ev.reserveId === reserveId &&
      ev.reserveSide === side &&
      !!ev.photoUrl
    );

  return (
    <div
      onKeyDown={handleModalFieldKeyDown}
      className={`app-shell min-h-screen ${currentStep === 'camera' ? 'camera-active bg-transparent' : 'bg-white'} flex flex-col font-sans`}
    >
      {/* Main Content Viewport */}
      <div className={`flex-1 flex flex-col relative overflow-hidden ${currentStep === 'camera' ? 'hidden' : ''}`}>
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar">
          <input ref={memoryUploadInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleMemoryUploadFile(e.target.files?.[0])} />

          <AnimatePresence mode="wait">
            {/* HOME VIEW */}
            {currentStep === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-7 pt-4"
              >
                <div className="flex justify-between items-center">
                   <div>
                     <h1 className="text-3xl font-black tracking-tighter uppercase text-gray-950">Field Trace</h1>
                   </div>
                   <div className="w-12 h-12 bg-white shadow-xl rounded-2xl flex items-center justify-center border border-gray-100"><UserCircle className="w-6 h-6 text-gray-400"/></div>
                </div>

                <div className="bg-gray-900 rounded-[2.5rem] p-7 text-white shadow-2xl relative overflow-hidden">
                   <div className="relative z-10">
                     <p className="text-[10px] font-black uppercase opacity-40 mb-2 tracking-widest">Estado de Sincronización</p>
                     <h3 className="text-xl font-bold leading-tight mb-3">{syncRunning ? 'Sincronizando...' : syncSummary.failed > 0 ? 'Atención requerida' : syncSummary.pending > 0 ? 'Registros pendientes' : 'Todo sincronizado'}</h3>
                     <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-5 text-[10px] font-bold uppercase tracking-tight text-white/70">
                       <span className="text-green-400">✓ {syncSummary.synced} sincronizados</span>
                       <span className="text-amber-300">↻ {syncSummary.pending} pendientes</span>
                       <span className="text-red-300">⚠ {syncSummary.failed} con error</span>
                     </div>
                     <div className="flex gap-3">
                        <button type="button" onClick={() => setShowSyncDetails(true)} className="flex items-center gap-1.5 bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border border-white/10 active:scale-95 transition-transform">
                          <History className="w-3.5 h-3.5" /> Ver detalles
                        </button>
                        <button type="button" onClick={() => void runSyncNow()} disabled={syncRunning || !navigator.onLine} className="flex items-center gap-1.5 bg-blue-600 disabled:bg-white/10 disabled:text-white/40 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter active:scale-95 transition-transform">
                          <CloudUpload className="w-3.5 h-3.5" /> {syncRunning ? 'Sincronizando' : 'Sincronizar'}
                        </button>
                     </div>
                   </div>
                   <LayoutGrid className="absolute -right-8 -bottom-8 w-40 h-40 opacity-5" />
                </div>

                <button
                  type="button"
                  onClick={() => { void loadMemoryDashboard(); }}
                  className="w-full p-5 bg-blue-600 text-white rounded-[2rem] shadow-lg shadow-blue-600/20 flex items-center justify-between active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3 text-left">
                    <FileSpreadsheet className="w-6 h-6" />
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest">Memoria Fotográfica</p>
                      <p className="text-[9px] font-bold text-white/70 uppercase">Revisar proyectos y fotografías en Firebase</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 px-5 py-4 rounded-3xl shadow-sm focus-within:border-blue-300 transition-all relative">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="BUSCAR PROYECTO, CLIENTE O TECNICO..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent flex-1 outline-none text-xs font-black uppercase tracking-tighter placeholder:text-gray-300 pr-8"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm("")}
                        className="absolute right-4 p-1 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Proyectos Recientes</span>
                    <button
                      type="button"
                      onClick={() => { void openCloudProjects(); }}
                      className="text-blue-600 font-black text-[9px] uppercase tracking-tight bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-xl"
                    >
                      Proyectos compartidos
                    </button>
                  </div>
                    <div className="flex items-center gap-1">
                      {!projectSelectMode ? (
                        <>
                          <button
                            type="button"
                            onClick={() => { setProjectSelectMode(true); setSelectedProjectIds([]); }}
                            className="text-gray-500 font-bold text-[10px] uppercase tracking-tighter hover:bg-gray-50 px-2 py-1 rounded-lg"
                          >
                            Seleccionar
                          </button>
                          <button onClick={handleCreateProject} className="text-blue-600 font-bold text-xs uppercase tracking-tighter hover:bg-blue-50 px-3 py-1 rounded-lg">+ Nuevo Proyecto</button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const visible = projects.filter(p => {
                                const term = searchTerm.toLowerCase();
                                return (
                                  p.name.toLowerCase().includes(term) ||
                                  p.client.toLowerCase().includes(term) ||
                                  p.techName.toLowerCase().includes(term)
                                );
                              });
                              const ids = visible.map(p => p.id!).filter(Boolean) as number[];
                              if (selectedProjectIds.length === ids.length) setSelectedProjectIds([]);
                              else setSelectedProjectIds(ids);
                            }}
                            className="text-blue-600 font-bold text-[10px] uppercase tracking-tighter hover:bg-blue-50 px-2 py-1 rounded-lg"
                          >
                            {selectedProjectIds.length ? 'Ninguno' : 'Todos'}
                          </button>
                          <button
                            type="button"
                            onClick={clearProjectSelection}
                            className="text-gray-500 font-bold text-[10px] uppercase tracking-tighter hover:bg-gray-50 px-2 py-1 rounded-lg"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {projectSelectMode && selectedProjectIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => requestDeleteProjects(selectedProjectIds)}
                      className="w-full py-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                        Eliminar ({selectedProjectIds.length})
                      </span>
                    </button>
                  )}
                  {projects
                    .filter(p => {
                      const term = searchTerm.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(term) ||
                        p.client.toLowerCase().includes(term) ||
                        p.techName.toLowerCase().includes(term)
                      );
                    })
                    .map((p) => {
                    const isSelected = p.id != null && selectedProjectIds.includes(p.id);
                    return (
                    <motion.div 
                      whileTap={{ scale: 0.98 }}
                      key={p.id} 
                      onClick={() => {
                        if (projectSelectMode) {
                          if (p.id != null) toggleProjectSelect(p.id);
                        } else {
                          handleSelectProject(p);
                        }
                      }}
                      className={`p-5 bg-white border rounded-[2rem] flex justify-between items-center hover:shadow-xl hover:shadow-blue-600/5 transition-all cursor-pointer group shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'}`}
                    >
                      <div className="flex gap-4 items-center min-w-0">
                        {projectSelectMode ? (
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        ) : (
                          <div className="w-14 h-14 bg-[#F8FAFC] rounded-[1.5rem] flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
                            <MapPin className="w-6 h-6 text-gray-400 group-hover:text-blue-600"/>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[14px] font-black text-gray-950 uppercase tracking-tight truncate">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">{p.client}</p>
                        </div>
                      </div>
                      {!projectSelectMode && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (p.id != null) requestDeleteProjects([p.id]);
                            }}
                            className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 active:scale-95"
                            title="Eliminar proyecto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-6 h-6 text-gray-200 group-hover:text-blue-600"/>
                        </div>
                      )}
                    </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* MEMORY DASHBOARD VIEW */}
            {currentStep === 'memory' && (
              <motion.div
                key="memory"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 pt-4"
              >
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setCurrentStep('home')} className="w-12 h-12 bg-white shadow-lg rounded-2xl flex items-center justify-center border border-gray-100 shrink-0">
                    <ArrowLeft className="w-6 h-6 text-gray-950" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-xl font-black tracking-tighter uppercase text-gray-950">Memoria Fotográfica</h2>
                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Proyectos almacenados en Firebase</p>
                  </div>
                  <button type="button" onClick={() => { void loadMemoryDashboard(); }} className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <RefreshCcw className={"w-4 h-4 " + (memoryLoading ? 'animate-spin' : '')} />
                  </button>
                </div>

                {!memorySelectedProject ? (
                  <>
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 px-5 py-4 rounded-3xl focus-within:border-blue-300">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="BUSCAR PROYECTO..."
                        value={memoryProjectSearch}
                        onChange={(e) => setMemoryProjectSearch(e.target.value)}
                        className="bg-transparent flex-1 outline-none text-xs font-black uppercase tracking-tighter"
                      />
                    </div>

                    {memoryLoading ? (
                      <div className="py-16 text-center">
                        <RefreshCcw className="w-7 h-7 mx-auto text-blue-500 animate-spin" />
                        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Cargando proyectos y evidencias...</p>
                      </div>
                    ) : memoryProjects.filter((p: any) => {
                      const term = memoryProjectSearch.toLowerCase();
                      return String(p.name || '').toLowerCase().includes(term) ||
                        String(p.client || '').toLowerCase().includes(term);
                    }).length === 0 ? (
                      <div className="py-16 text-center bg-gray-50 rounded-[2rem] border border-gray-100">
                        <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-300" />
                        <p className="mt-3 text-xs font-black uppercase text-gray-500">No hay proyectos disponibles</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {memoryProjects.filter((p: any) => {
                          const term = memoryProjectSearch.toLowerCase();
                          return String(p.name || '').toLowerCase().includes(term) ||
                            String(p.client || '').toLowerCase().includes(term);
                        }).map((project: any) => {
                          const total = (project._evidences || []).length;
                          return (
                            <button key={String(project.uuid || project.id)} type="button" onClick={() => { setMemorySelectedProject(project); setMemorySelectedCategory(null); }}
                              className="w-full p-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm flex items-center justify-between text-left active:scale-[0.99]">
                              <div className="min-w-0">
                                <p className="text-[13px] font-black uppercase truncate">{project.name || 'PROYECTO SIN NOMBRE'}</p>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate">{project.client || 'SIN CLIENTE'}</p>
                                <p className="mt-2 text-[9px] font-black text-blue-600 uppercase">{total} fotografías registradas</p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-5">
                    {!memorySelectedCategory ? (
                      <>
                        <button type="button" onClick={() => setMemorySelectedProject(null)} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                          <ChevronLeft className="w-4 h-4" /> Volver a proyectos
                        </button>

                        <div className="bg-gray-900 text-white rounded-[2rem] p-6">
                          <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest">Proyecto seleccionado</p>
                          <h3 className="mt-1 text-xl font-black uppercase">{memorySelectedProject.name || 'SIN NOMBRE'}</h3>
                          <p className="text-[10px] text-white/50 font-bold uppercase">{memorySelectedProject.client || 'SIN CLIENTE'}</p>
                          <p className="mt-4 text-[10px] font-black uppercase">{(memorySelectedProject._evidences || []).length} fotografías registradas en Firebase</p>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                          <p className="text-[9px] font-black uppercase text-blue-700">Seleccione una sección</p>
                          <p className="text-[8px] text-blue-500 font-bold uppercase mt-1">Entre a NAPS, MUFA, RESERVAS, ACEROS, DESECHOS, ALTAS o MEJORAS para revisar sus fotografías.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => { void handleGenerateMemoryExcel(); }}
                            disabled={memoryExcelLoading || memoryZipLoading}
                            className="bg-blue-600 text-white rounded-2xl px-3 py-4 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-60 active:scale-[0.99]"
                          >
                            <FileSpreadsheet className={"w-5 h-5 shrink-0 " + (memoryExcelLoading ? 'animate-pulse' : '')} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-center">
                              {memoryExcelLoading ? 'GENERANDO...' : 'GENERAR EXCEL'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => { void handleGenerateMemoryPhotosZip(); }}
                            disabled={memoryExcelLoading || memoryZipLoading}
                            className="bg-slate-800 text-white rounded-2xl px-3 py-4 flex items-center justify-center gap-2 shadow-lg shadow-slate-800/20 disabled:opacity-60 active:scale-[0.99]"
                          >
                            <Archive className={"w-5 h-5 shrink-0 " + (memoryZipLoading ? 'animate-pulse' : '')} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-center">
                              {memoryZipLoading ? 'PREPARANDO ZIP...' : 'DESCARGAR FOTOS ZIP'}
                            </span>
                          </button>
                        </div>

                        <div className="space-y-3">
                          {memoryCategories.map((category) => {
                            const summary = memoryCategorySummary(memorySelectedProject, category.id);
                            const status = summary.groupCount === 0 ? 'SIN REGISTROS' : summary.completeAll ? 'COMPLETO' : 'FALTAN ' + summary.missing;
                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => { setMemorySelectedCategory(category.id); setMemorySelectedPhoto(null); }}
                                className="w-full text-left bg-white border border-gray-100 rounded-[1.75rem] p-5 shadow-sm active:scale-[0.99] transition-transform"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black uppercase">{category.label}</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">
                                      {summary.groupCount} SET{summary.groupCount === 1 ? '' : 'S'} · {summary.captured}/{summary.requiredTotal || 0} FOTOS
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={"px-3 py-1.5 rounded-full text-[8px] font-black uppercase " + (summary.completeAll ? 'bg-green-50 text-green-600' : summary.groupCount ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400')}>
                                      {status}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      (() => {
                        const category = memoryCategories.find((item) => item.id === memorySelectedCategory);
                        const summary = memoryCategorySummary(memorySelectedProject, memorySelectedCategory);
                        if (!category) return null;
                        return (
                          <>
                            <button type="button" onClick={() => { setMemorySelectedCategory(null); setMemorySelectedPhoto(null); }} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                              <ChevronLeft className="w-4 h-4" /> Volver a secciones
                            </button>

                            <div className="bg-gray-900 text-white rounded-[2rem] p-6">
                              <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest">Revisión de sección</p>
                              <h3 className="mt-1 text-xl font-black uppercase">{category.label}</h3>
                              <p className="text-[10px] text-white/50 font-bold uppercase">
                                {summary.groupCount} SET{summary.groupCount === 1 ? '' : 'S'} · {summary.captured}/{summary.requiredTotal || 0} FOTOS
                              </p>
                            </div>

                            {summary.groups.length === 0 ? (
                              <div className="bg-white border border-gray-100 rounded-[1.75rem] p-10 text-center shadow-sm">
                                <Eye className="w-10 h-10 mx-auto text-gray-200" />
                                <p className="mt-3 text-[10px] font-black uppercase text-gray-400">Esta sección no tiene fotografías registradas.</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {summary.groups.map((group: any) => (
                                  <section key={group.id} className="bg-white border border-gray-100 rounded-[1.75rem] p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase truncate">
                                          {category.id === 'NAPS' ? 'NAP ' + String(group.number).padStart(2, '0') :
                                           category.id === 'MUFA' ? 'MUFA ' + String(group.number).padStart(2, '0') :
                                           category.id === 'PUNTAS_FIBRA' ? 'PUNTA ' + String(group.number).padStart(2, '0') :
                                           category.id === 'RESERVA' ? 'RESERVA ' + String(group.number).padStart(2, '0') :
                                           category.label}
                                        </p>
                                        {group.name && <p className="text-[8px] text-gray-400 uppercase truncate">{group.name}</p>}
                                      </div>
                                      <span className={"text-[9px] font-black shrink-0 " + (group.count >= group.required ? 'text-green-600' : 'text-amber-600')}>
                                        {group.count}/{group.required}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 lg:gap-2">
                                      {group.items.map((ev: any, photoIndex: number) => {
                                        const imageUrl = ev.photoUrl || ev.photo?.uri || '';
                                        return (
                                          <button
                                            key={String(ev.uuid || ev.id || photoIndex)}
                                            type="button"
                                            onClick={() => imageUrl && setMemorySelectedPhoto(ev)}
                                            className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-100 border border-gray-100 text-left"
                                          >
                                            {imageUrl ? (
                                              <img src={imageUrl} alt={category.label + ' foto ' + (photoIndex + 1)} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
                                            ) : (
                                              <div className="w-full h-full flex flex-col items-center justify-center text-[8px] font-black text-gray-400 uppercase p-2 text-center">
                                                <CameraIcon className="w-5 h-5 mb-1 text-gray-300" />
                                                Sin foto
                                              </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white px-2 py-1.5 lg:px-2.5 lg:py-2">
                                              <p className="text-[7px] font-black uppercase truncate lg:text-[9px] lg:leading-tight">
                                                {category.id === 'NAPS'
                                                  ? getNapsPhotoTitle(Number(ev.napPhotoNumber || photoIndex + 1))
                                                  : 'FOTO ' + (photoIndex + 1) + '/' + group.required}
                                              </p>
                                              <p className="text-[7px] text-white/80 truncate lg:text-[8px] lg:leading-tight lg:mt-0.5">
                                                {category.id === 'NAPS'
                                                  ? 'NAP' + (group.name ? ' · ' + String(group.name).toUpperCase() : '')
                                                  : (ev.categoryLabel || ev.category || category.label)}
                                              </p>
                                            </div>
                                          </button>
                                        );
                                      })}
                                      {(() => {
                                        const slots = category.id === 'NAPS'
                                          ? Array.from({ length: 9 }, (_, i) => i + 1)
                                          : Array.from({ length: Math.max(0, group.required - group.items.length) }, (_, i) => group.items.length + i + 1);

                                        return slots
                                          .filter(photoNumber => !group.items.some((item: any) =>
                                            category.id === 'NAPS'
                                              ? Number(item.napPhotoNumber) === photoNumber
                                              : false
                                          ))
                                          .map((photoNumber) => (
                                            <div
                                              key={'missing-' + group.id + '-' + photoNumber}
                                              className="min-h-[180px] lg:min-h-[120px] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 flex flex-col items-center justify-center text-center p-3 lg:p-2 gap-2"
                                            >
                                              <CameraIcon className="w-6 h-6 text-blue-400" />
                                              <p className="text-[8px] font-black uppercase text-blue-700">FALTA FOTO</p>
                                              <p className="text-[8px] font-black uppercase text-blue-600">
                                                {category.id === 'NAPS'
                                                  ? getNapsPhotoTitle(photoNumber) + ' NAP'
                                                  : 'FOTO ' + photoNumber}
                                              </p>

                                              {category.id === 'NAPS' && (
                                                <>
                                                  <button
                                                    type="button"
                                                    disabled={memoryUploadLoading}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      uploadMissingMemoryPhoto({
                                                        category: 'NAPS',
                                                        napId: String(group.id),
                                                        napNumber: Number(group.number),
                                                        napName: String(group.name || ''),
                                                        photoNumber
                                                      });
                                                    }}
                                                    className="w-full px-2.5 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-[8px] font-black uppercase active:scale-95 disabled:opacity-50"
                                                  >
                                                    {memoryUploadLoading ? 'SUBIENDO...' : 'SUBIR FOTO DESDE EL TELÉFONO'}
                                                  </button>

                                                </>
                                              )}
                                            </div>
                                          ));
                                      })()}
                                    </div>
                                  </section>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()
                    )}
                  </div>
                )}

                {memorySelectedPhoto && (
                  <div className="fixed inset-0 z-[100] bg-black/90 p-4 md:p-8 flex items-center justify-center" onClick={() => setMemorySelectedPhoto(null)}>
                    <button type="button" onClick={() => setMemorySelectedPhoto(null)} className="absolute top-5 right-5 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center">
                      <X className="w-6 h-6" />
                    </button>
                    <div className="max-w-6xl max-h-[90vh] w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                      <img
                        src={memorySelectedPhoto.photoUrl || memorySelectedPhoto.photo?.uri}
                        alt="Evidencia"
                        className="max-h-[78vh] max-w-full object-contain rounded-2xl"
                      />
                      <div className="bg-white rounded-2xl px-5 py-3 text-center max-w-xl">
                        <p className="text-[9px] font-black uppercase">{memorySelectedPhoto.categoryLabel || memorySelectedPhoto.category || 'EVIDENCIA'}</p>
                        <p className="text-[11px] font-black uppercase">
                          {memorySelectedPhoto.napName || memorySelectedPhoto.mufaName ||
                           (memorySelectedPhoto.napNumber ? 'NAP ' + memorySelectedPhoto.napNumber : '') ||
                           (memorySelectedPhoto.mufaNumber ? 'MUFA ' + memorySelectedPhoto.mufaNumber : '') || 'FOTOGRAFÍA'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* HISTORY VIEW */}
            {currentStep === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-7 pt-4"
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => setCurrentStep('home')} className="w-12 h-12 bg-white shadow-lg rounded-2xl flex items-center justify-center border border-gray-100 shrink-0"><ArrowLeft className="w-6 h-6 text-gray-950"/></button>
                  <div className="flex-1 overflow-hidden">
                    <h2 className="text-xl font-black tracking-tighter uppercase text-gray-950 truncate">{selectedProject?.name}</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest cursor-pointer hover:text-blue-600 flex items-center gap-1 shrink-0" onClick={() => handleEditProject(selectedProject!)}>
                        Configurar <Settings className="w-3 h-3" />
                      </p>
                      <span className="text-gray-200">|</span>
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest cursor-pointer hover:text-blue-800 flex items-center gap-1 shrink-0" onClick={() => setCurrentStep('summary')}>
                        Resumen <BarChart3 className="w-3 h-3" />
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setCurrentStep('camera')}
                    disabled={isProcessing}
                    className="w-12 h-12 bg-blue-600 text-white shadow-[0_8px_20px_-4px_rgba(37,99,235,0.5)] rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <CameraIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* EVIDENCE CHECKLIST - PROJECT LEVEL */}
                <section className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CameraIcon className="w-4 h-4 text-blue-600 shrink-0" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-950">Evidencias del proyecto</h3>
                      </div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mt-1">
                        Selecciona el tipo y toma las fotografías desde aquí.
                      </p>
                    </div>
                    <span className="shrink-0 px-2.5 py-1.5 rounded-full bg-gray-50 text-[9px] font-black uppercase text-gray-500">
                      {completedEvidenceCategories}/{evidenceCategoryProgress.length}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${evidenceProgressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wide">
                    <span className="text-green-600">{completedEvidenceCategories} completadas</span>
                    <span className="text-amber-600">{pendingEvidenceCategories} pendientes</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {evidenceCategoryProgress.map(category => (
                      <div
                        key={category.id}
                        className={`rounded-2xl border p-3 flex items-center gap-3 ${
                          category.completed
                            ? 'border-green-100 bg-green-50/60'
                            : 'border-gray-100 bg-gray-50/60'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          category.completed ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400 border border-gray-100'
                        }`}>
                          {category.completed ? <CheckCircle2 className="w-4 h-4" /> : <CameraIcon className="w-4 h-4" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase text-gray-950 truncate">{category.label}</p>
                          <p className={`text-[8px] font-black uppercase tracking-wide mt-0.5 ${
                            category.completed ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {category.id === 'RESERVA'
                              ? (category.reserveCount
                                  ? (category.completed
                                      ? `✓ ${category.reserveCompletedCount || 0}/${category.reserveCount} reservas completas · ${category.count} fotos`
                                      : `⚠ ${category.reserveCompletedCount || 0}/${category.reserveCount} reservas completas · ${(category.pendingReserveLabels || []).join(' · ')}`)
                                  : 'Pendiente · 0 fotos')
                              : category.id === 'PUNTAS_FIBRA'
                                ? (category.fiberPairCount
                                    ? (category.completed
                                        ? `✓ ${category.fiberCompleteCount}/${category.fiberPairCount} puntas completas · ${category.count} fotos`
                                        : `⚠ ${category.fiberCompleteCount}/${category.fiberPairCount} puntas completas · ${category.fiberPendingLabels.join(' · ')}`)
                                    : 'Pendiente · 0 fotos')
                                : category.id === 'ACEROS'
                                  ? (category.aceroCount
                                      ? (category.completed
                                          ? '✓ ' + category.aceroCompletedCount + '/' + category.aceroCount + ' ACEROS COMPLETOS · ' + category.count + ' FOTOS'
                                          : '⚠ ' + category.aceroCompletedCount + '/' + category.aceroCount + ' ACEROS COMPLETOS · ' + (category.aceroPendingLabels || []).join(' · '))
                                      : 'PENDIENTE · 0 FOTOS')
                                : category.id === 'DESECHOS'
                                  ? (category.desechoCount
                                      ? (category.completed
                                          ? '✓ ' + category.desechoCompletedCount + '/' + category.desechoCount + ' DESECHOS COMPLETOS · ' + category.count + ' FOTOS'
                                          : '⚠ ' + category.desechoCompletedCount + '/' + category.desechoCount + ' DESECHOS COMPLETOS · ' + (category.desechoPendingLabels || []).join(' · '))
                                      : 'PENDIENTE · 0 FOTOS')
                                : category.id === 'NAPS'
                                  ? (category.napCount
                                      ? (category.completed
                                          ? '✓ ' + category.napCompletedCount + '/' + category.napCount + ' NAPS COMPLETOS · ' + category.count + ' FOTOS'
                                          : '⚠ ' + category.napCompletedCount + '/' + category.napCount + ' NAPS COMPLETOS · ' + category.pendingNapLabels.join(' · '))
                                      : 'PENDIENTE · 0 FOTOS')
                                : category.id === 'MUFA'
                                  ? (category.mufaCount
                                      ? (category.completed
                                          ? '✓ ' + category.mufaCompletedCount + '/' + category.mufaCount + ' MUFAS COMPLETAS · ' + category.count + ' FOTOS'
                                          : '⚠ ' + category.mufaCompletedCount + '/' + category.mufaCount + ' MUFAS COMPLETAS · ' + category.pendingMufaLabels.join(' · '))
                                      : 'PENDIENTE · 0 FOTOS')
                                : category.id === 'MEJORAS'
                                  ? (category.mejoraCount
                                      ? (category.completed
                                          ? '✓ ' + category.mejoraCompletedCount + '/' + category.mejoraCount + ' MEJORAS COMPLETAS · ' + category.count + ' FOTOS'
                                          : '⚠ ' + category.mejoraCompletedCount + '/' + category.mejoraCount + ' MEJORAS COMPLETAS · ' + (category.mejoraPendingLabels || []).join(' · '))
                                      : 'PENDIENTE · 0 FOTOS')
                                : category.id === 'ALTAS'
                                  ? (category.altaCount
                                      ? (category.completed
                                          ? '✓ ' + category.altaCompletedCount + '/' + category.altaCount + ' ALTAS COMPLETAS · ' + category.count + ' FOTOS'
                                          : '⚠ ' + category.altaCompletedCount + '/' + category.altaCount + ' ALTAS COMPLETAS · ' + (category.altaPendingLabels || []).join(' · '))
                                      : 'PENDIENTE · 0 FOTOS')
                                : (category.completed
                                    ? `Completada · ${category.count} foto${category.count === 1 ? '' : 's'}`
                                    : 'Pendiente · 0 fotos')}
                          </p>
                        </div>

                        <div className="shrink-0 flex flex-col items-stretch gap-1.5">
                          {(category.completed || category.count > 0) && (
                            <button
                              type="button"
                              onClick={() => {
                                setStorageEvidenceCategory(category.id);
                                setShowStorageEvidenceViewer(true);
                              }}
                              className="px-3 py-2 rounded-xl bg-blue-600 text-white shadow-sm text-[8px] font-black uppercase tracking-wide active:scale-95 transition-all"
                            >
                              {category.id === 'NAPS' ? 'Ver fotos / subir faltantes' : 'Ver fotos'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEvidenceCapture(category.id)}
                            className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-wide active:scale-95 transition-all ${
                              category.completed
                                ? 'bg-white border border-green-200 text-green-700'
                                : 'bg-blue-600 text-white shadow-sm'                            }`}
                          >
                            {category.completed ? 'Agregar' : 'Tomar foto'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <button
                  type="button"
                  onClick={() => {
                    setStorageEvidenceCategory(null);
                    setShowStorageEvidenceViewer(true);
                  }}
                  className="w-full py-4 mb-4 bg-blue-50 border border-blue-200 rounded-[1.5rem] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"
                >
                  <Eye className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <span className="block text-[10px] font-black text-blue-800 uppercase tracking-wide">Ver evidencias para Excel</span>
                    <span className="block text-[8px] font-bold text-blue-500 uppercase mt-0.5">
                      {evidences.filter((ev: any) => !!ev.photoUrl).length} fotografías en Storage
                    </span>
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-4">
                   <button 
                    onClick={() => exportService.generateExcel(selectedProject!.id!)}
                    className="py-4 bg-[#ECFDF5] border border-green-200 rounded-[1.5rem] flex flex-col items-center gap-2 group transition-all active:scale-95 shadow-sm"
                   >
                     <FileSpreadsheet className="w-6 h-6 text-green-600"/>
                     <span className="text-[9px] font-black text-green-800 uppercase">Excel (.xlsx)</span>
                   </button>
                   <button 
                    onClick={() => void exportService.generatePDF(selectedProject!.id!).catch((e) => alert(`No se pudo generar el PDF: ${e instanceof Error ? e.message : 'error desconocido'}`))}
                    className="py-4 bg-[#FEF2F2] border border-red-200 rounded-[1.5rem] flex flex-col items-center gap-2 group transition-all active:scale-95 shadow-sm"
                   >
                     <FileText className="w-6 h-6 text-red-600"/>
                     <span className="text-[9px] font-black text-red-800 uppercase">PDF Report</span>
                   </button>
                </div>

                {evidences.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAllStep(1)}
                    className="w-full py-3.5 bg-red-50 border border-red-200 rounded-[1.5rem] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Vaciar registros</span>
                  </button>
                )}

                <div className="space-y-2 pb-24">
                  {evidences.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                       <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto"><CameraIcon className="w-8 h-8 text-gray-200" /></div>
                       <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">No hay registros<br/>tecnicos capturados</p>
                    </div>
                  ) : (
                    evidences.map((ev) => {
                      const operationalFields = (ev.customFields || []).filter((f: any) => f.active !== false);
                      return (
                      <div key={ev.id || ev.uuid} className="bg-white border border-gray-100 rounded-2xl px-3.5 py-3 shadow-sm flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_6px_#22c55e]"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-black text-gray-950 tracking-tight">{ev.fecha} {ev.hora || ''}</p>
                          <div className="mt-1 space-y-0.5">
                            {operationalFields.map((field: any, index: number) => (
                              <p key={index} className="text-[9px] text-gray-500 uppercase truncate">
                                {field.name || `Campo ${index + 1}`}: {field.value || '-'}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => setViewingEvidence(ev)} className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 active:scale-95" title="Ver"><Eye className="w-4 h-4" /></button>
                          <button type="button" onClick={() => setEditingEvidence({ ...ev, customFields: (ev.customFields || []).map((f: any) => ({ ...f })) })} className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 active:scale-95" title="Editar"><Pencil className="w-4 h-4" /></button>
                          <button type="button" onClick={() => setConfirmDelete({ type: 'evidence', id: ev.id })} className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 active:scale-95" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* SUMMARY VIEW (PROJECT DASHBOARD) */}
            {currentStep === 'summary' && selectedProject && (
              <motion.div 
                key="summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6 pt-4 pb-10"
              >
                <div className="flex items-center gap-5">
                  <button onClick={() => setCurrentStep('history')} className="w-12 h-12 bg-white shadow-lg rounded-2xl flex items-center justify-center border border-gray-100"><ArrowLeft className="w-6 h-6 text-gray-950"/></button>
                  <div className="flex-1 overflow-hidden">
                    <h2 className="text-xl font-black tracking-tighter uppercase text-gray-950 truncate">Resumen de Datos</h2>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{selectedProject.name}</p>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Total Evidencias</p>
                    <h4 className="text-4xl font-black tracking-tighter text-blue-600">{evidences.filter((ev: any) => !!ev.photoUrl).length}</h4>
                    <BarChart3 className="absolute -right-4 -bottom-4 w-20 h-20 opacity-[0.03] text-blue-600" />
                  </div>
                  <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Último Registro</p>
                    <h4 className="text-lg font-black tracking-tighter text-gray-950">{evidences[evidences.length-1]?.fecha || 'N/A'}</h4>
                    <Calendar className="absolute -right-4 -bottom-4 w-20 h-20 opacity-[0.03] text-gray-950" />
                  </div>
                </div>

                {/* Filters Section */}
                <div className="bg-[#F8FAFC] p-6 rounded-[2.5rem] border border-gray-100 space-y-4">
                   <div className="flex items-center gap-2 mb-2">
                      <Filter className="w-4 h-4 text-blue-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-900">Filtros Activos</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Fecha</label>
                        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Técnico</label>
                        <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500">
                          <option value="">TODOS</option>
                          {(Array.from(new Set(evidences.map(e => e.baseFields.tecnico).filter(Boolean))) as string[]).map(t => (
                            <option key={t} value={t}>{t.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-400 pl-1">Material / Campo</label>
                      <select value={filterField} onChange={(e) => setFilterField(e.target.value)} className="w-full bg-white border border-gray-100 p-2 text-xs rounded-xl font-bold outline-none focus:border-blue-500">
                          <option value="">TODOS LOS CAMPOS</option>
                          {selectedProject.customFields.map(f => (
                            <option key={f.name} value={f.name}>{f.name.toUpperCase()}</option>
                          ))}
                      </select>
                   </div>
                </div>

                {/* Materials Summary */}
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Resumen de Materiales</h3>
                    <div className="flex gap-2">
                       <button onClick={() => exportService.generateExcel(selectedProject.id!)} className="p-2 bg-green-50 text-green-600 rounded-lg"><FileSpreadsheet className="w-4 h-4" /></button>
                       <button onClick={() => void exportService.generatePDF(selectedProject.id!).catch((e) => alert(`No se pudo generar el PDF: ${e instanceof Error ? e.message : 'error desconocido'}`))} className="p-2 bg-red-50 text-red-600 rounded-lg"><FileText className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {(() => {
                      const filteredEvidences = evidences.filter(e => {
                        if (filterDate && e.fecha !== new Date(filterDate).toLocaleDateString()) return false;
                        if (filterTech && e.baseFields.tecnico !== filterTech) return false;
                        return true;
                      });

                      const materialTotals: Record<string, number> = {};
                      filteredEvidences.forEach(e => {
                        e.customFields.forEach(f => {
                          if (filterField && f.name !== filterField) return;
                          const val = parseFloat(f.value.replace(/[^0-9.-]+/g, ""));
                          if (!isNaN(val)) {
                            materialTotals[f.name] = (materialTotals[f.name] || 0) + val;
                          }
                        });
                      });

                      const entries = Object.entries(materialTotals);
                      if (entries.length === 0) return <p className="text-center py-6 text-xs text-gray-300 font-bold uppercase">Sin datos acumulados</p>;

                      return entries.map(([name, total]) => (
                        <div key={name} className="flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-xs font-black uppercase text-gray-600 tracking-tighter">{name}</span>
                          </div>
                          <div className="flex items-center gap-2">                            <span className="text-lg font-black text-gray-950 tracking-tighter">{total}</span>
                            <ArrowUpRight className="w-4 h-4 text-gray-200 group-hover:text-green-500 transition-colors" />
                          </div>
                        </div>                      ));
                    })()}
                  </div>
                </div>
                <div className="bg-gray-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                   <p className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest">Estado del Proyecto</p>
                   <h3 className="text-xl font-bold leading-tight mb-6">{evidences.length > 0 ? 'Recolección de datos en curso' : 'Esperando primera captura'}</h3>
                   <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] font-black uppercase opacity-60">Técnico Actual</p>
                        <p className="text-sm font-bold uppercase">{selectedProject.techName || 'No asignado'}</p>
                      </div>
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                        <ShieldCheck className="w-6 h-6 text-blue-400" />
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {/* SETUP VIEW (PROJECT CONFIGURATION) */}
            {currentStep === 'setup' && editingProject && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 pt-4"
              >
                <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentStep('home')} className="p-3 bg-gray-100 rounded-2xl"><ArrowLeft className="w-5 h-5"/></button>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Configuración</h2>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Nombre del Proyecto</label>
                    <input 
                      type="text" 
                      value={editingProject.name || ''}
                      onChange={(e) => setEditingProject({...editingProject, name: e.target.value.toUpperCase()})}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-blue-500 focus:ring-0 outline-none" 
                      placeholder="Ej: Mantenimiento Sector Sur"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cliente</label>
                    <input 
                      type="text" 
                      value={editingProject.client || ''}
                      onChange={(e) => setEditingProject({...editingProject, client: e.target.value.toUpperCase()})}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:border-blue-500 focus:ring-0 outline-none" 
                      placeholder="Ej: CODENSA"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Técnico Resp.</label>
                      <input 
                        type="text" 
                        value={editingProject.techName || ''}
                        onChange={(e) => setEditingProject({...editingProject, techName: toTitleCase(e.target.value)})}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" 
                        placeholder="Nombre completo"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 p-5 rounded-[2rem] border border-blue-100">
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-4">Campos Visibles en Foto</p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        { key: 'showDateTime', label: 'Fecha y Hora' },
                        { key: 'showGps', label: 'GPS' },
                        { key: 'showLocation', label: 'Ubicación' },
                        { key: 'showTech', label: 'Técnico' },
                      ].map((field) => (
                        <label key={field.key} className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={!!(editingProject as any)[field.key]} 
                            onChange={(e) => setEditingProject({...editingProject, [field.key]: e.target.checked})}
                            className="w-4 h-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600">{field.label}</span>
                        </label>
                      ))}
                    </div>
                    {editingProject.showDateTime && (
                        <div className="space-y-1 mt-2">
                          <label className="text-[9px] font-black uppercase text-blue-400">Formato Fecha/Hora</label>
                          <select 
                            value={editingProject.dateTimeFormat || 'format1'}
                            onChange={(e) => setEditingProject({...editingProject, dateTimeFormat: e.target.value as any})}
                            className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                          >
                            <option value="format1">26 abr 2026 10:47:19 p.m.</option>
                            <option value="format2">26/4/2026 10:47 p.m.</option>
                          </select>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-blue-100">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-blue-400">Formato de Ubicación</label>
                        <select 
                          value={editingProject.locationFormat || ''}
                          onChange={(e) => setEditingProject({...editingProject, locationFormat: e.target.value as any})}
                          className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                        >
                          <option value="completa">Completa (Simplificada)</option>
                          <option value="distrito-canton">Distrito + Cantón</option>
                          <option value="ciudad-provincia">Ciudad + Provincia</option>
                          <option value="personalizado">Personalizado</option>
                        </select>
                      </div>

                      {editingProject.locationFormat === 'personalizado' && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-white/50 p-3 rounded-xl">
                          {[
                            { key: 'road', label: 'Calle' },
                            { key: 'suburb', label: 'Distrito' },
                            { key: 'city', label: 'Cantón' },
                            { key: 'state', label: 'Provincia' },
                          ].map((l) => (
                            <label key={l.key} className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={!!editingProject.customLocationFormat?.[l.key as keyof typeof editingProject.customLocationFormat]}
                                onChange={(e) => setEditingProject({
                                  ...editingProject, 
                                  customLocationFormat: {
                                    ...(editingProject.customLocationFormat || { road: true, suburb: true, city: true, state: true }),
                                    [l.key]: e.target.checked
                                  }
                                })}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                              />
                              <span className="text-[10px] font-bold text-gray-600">{l.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-blue-100">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[9px] font-black uppercase text-blue-400">Color de Texto Overlay</label>
                      </div>
                      <div className="flex gap-2">
                        {[
                          { name: 'Blanco', color: '#FFFFFF' },
                          { name: 'Amarillo', color: '#FFFF00' },
                          { name: 'Verde', color: '#00FF00' },
                          { name: 'Azul', color: '#3B82F6' },
                          { name: 'Rojo', color: '#EF4444' },
                        ].map((c) => (
                          <button
                            key={c.color}
                            onClick={() => setEditingProject({...editingProject, overlayColor: c.color})}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${editingProject.overlayColor === c.color ? 'border-blue-600 scale-110 shadow-lg' : 'border-white'}`}
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          />
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-blue-400">Posición Overlay</label>
                          <select 
                            value={editingProject.overlayPosition || ''}
                            onChange={(e) => setEditingProject({...editingProject, overlayPosition: e.target.value as any})}
                            className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                          >
                            <option value="top-left">Arriba Izq.</option>
                            <option value="top-right">Arriba Der.</option>
                            <option value="bottom-left">Abajo Izq.</option>
                            <option value="bottom-right">Abajo Der.</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-blue-400">Tamaño Letra</label>
                          <select 
                            value={editingProject.fontSizeScale || ''}
                            onChange={(e) => setEditingProject({...editingProject, fontSizeScale: e.target.value as any})}
                            className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                          >
                            <option value="small">Pequeño</option>
                            <option value="medium">Mediano</option>
                            <option value="large">Grande</option>
                          </select>
                        </div>
                        <div className="col-span-2 space-y-2 mt-1">
                           <div className="flex justify-between items-center">
                             <label className="text-[9px] font-black uppercase text-blue-400">Ajuste Manual Preciso</label>
                             <div className="flex items-center gap-2">
                               <button 
                                 onClick={() => setUnlockedSettings(prev => ({...prev, fontSize: !prev.fontSize}))}
                                 className={`p-1 rounded transition-colors ${unlockedSettings.fontSize ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                               >
                                 {unlockedSettings.fontSize ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}                               </button>
                               <span className="text-[10px] font-bold text-blue-600">{editingProject.fontSizeValue || 30}</span>
                             </div>
                           </div>
                           <input 
                             type="range"
                             disabled={!unlockedSettings.fontSize}
                             min="10"
                             max="100"
                             step="1"
                             value={editingProject.fontSizeValue || 30}
                             onChange={(e) => setEditingProject({...editingProject, fontSizeValue: parseInt(e.target.value)})}
                             className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.fontSize ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`}
                           />
                        </div>

                        <div className="space-y-1 col-span-2 mt-4 pt-4 border-t border-blue-50">
                          <label className="text-[9px] font-black uppercase text-blue-400">Logo adicional en foto</label>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setEditingProject({...editingProject, logoImage: reader.result as string, logoPosition: editingProject.logoPosition || 'top-left', logoSize: editingProject.logoSize || 20, logoOpacity: editingProject.logoOpacity !== undefined ? editingProject.logoOpacity : 80});
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="w-full text-xs font-bold text-blue-800 border p-2 rounded bg-white"
                          />
                          {editingProject.logoImage && (
                            <div className="flex items-center gap-4 mt-3">
                              <img src={editingProject.logoImage} alt="Logo" className="h-10 object-contain rounded" />
                              <button onClick={() => setEditingProject({...editingProject, logoImage: null})} className="text-white bg-red-500 px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest shadow-sm">
                                ELIMINAR LOGO
                              </button>
                            </div>
                          )}
                        </div>

                        {editingProject.logoImage && (
                          <>
                            <div className="space-y-1 col-span-2">
                              <label className="text-[9px] font-black uppercase text-blue-400">Posición Logo</label>
                              <select 
                                value={editingProject.logoPosition || 'top-left'}
                                onChange={(e) => setEditingProject({...editingProject, logoPosition: e.target.value as any})}
                                className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold"
                              >
                                <option value="top-left">Arriba Izq.</option>
                                <option value="top-right">Arriba Der.</option>
                                <option value="bottom-left">Abajo Izq.</option>
                                <option value="bottom-right">Abajo Der.</option>
                              </select>
                            </div>
                            
                            <div className="space-y-2 mt-1 col-span-2">
                               <div className="flex justify-between items-center">
                                 <label className="text-[9px] font-black uppercase text-blue-400">Tamaño Logo</label>
                                 <div className="flex items-center gap-2">
                                   <button 
                                     onClick={() => setUnlockedSettings(prev => ({...prev, logoSize: !prev.logoSize}))}
                                     className={`p-1 rounded transition-colors ${unlockedSettings.logoSize ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                                   >
                                     {unlockedSettings.logoSize ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                   </button>
                                   <span className="text-[10px] font-bold text-blue-600">{editingProject.logoSize || 20}%</span>
                                 </div>
                               </div>
                               <input 
                                 type="range"
                                 disabled={!unlockedSettings.logoSize}
                                 min="5"
                                 max="80"
                                 step="1"
                                 value={editingProject.logoSize || 20}
                                 onChange={(e) => setEditingProject({...editingProject, logoSize: parseInt(e.target.value)})}
                                 className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.logoSize ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`}
                               />
                            </div>

                            <div className="space-y-2 mt-1 col-span-2">
                               <div className="flex justify-between items-center">
                                 <label className="text-[9px] font-black uppercase text-blue-400">Opacidad Logo</label>
                                 <div className="flex items-center gap-2">
                                   <button 
                                     onClick={() => setUnlockedSettings(prev => ({...prev, logoOpacity: !prev.logoOpacity}))}
                                     className={`p-1 rounded transition-colors ${unlockedSettings.logoOpacity ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                                   >
                                     {unlockedSettings.logoOpacity ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                   </button>
                                   <span className="text-[10px] font-bold text-blue-600">{editingProject.logoOpacity ?? 80}%</span>
                                 </div>
                               </div>
                               <input 
                                 type="range"
                                 disabled={!unlockedSettings.logoOpacity}                                 min="0"
                                 max="100"
                                 step="1"
                                 value={editingProject.logoOpacity ?? 80}
                                 onChange={(e) => setEditingProject({...editingProject, logoOpacity: parseInt(e.target.value)})}
                                 className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-colors ${unlockedSettings.logoOpacity ? 'bg-blue-200 accent-blue-600' : 'bg-gray-100 accent-gray-300 opacity-60'}`}
                               />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Campos Personalizados</p>
                      <button 
                        onClick={() => setEditingProject({
                          ...editingProject, 
                          customFields: [...(editingProject.customFields || []), { name: '', value: '', showInPhoto: true, active: true }]
                        })}
                        className="text-[10px] font-black text-blue-600 uppercase"
                      >
                        + Agregar
                      </button>
                    </div>
                    {editingProject.customFields?.map((cf, idx) => (
                      <div key={idx} className={`flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-100 ${cf.active === false ? 'opacity-50' : ''}`}>
                        <div className="flex-1 flex gap-2">
                          <AutoResizingTextarea 
                            value={cf.name || ''} 
                            onChange={(e: any) => {
                              const newFields = [...(editingProject.customFields || [])];
                              newFields[idx].name = e.target.value;
                              setEditingProject({...editingProject, customFields: newFields});
                            }}
                            placeholder="Propiedad" 
                            className="bg-transparent text-[10px] font-bold outline-none w-full resize-none overflow-hidden"
                          />
                          <input 
                            type="number"
                            value={cf.value || ''} 
                            onChange={(e) => {
                              const newFields = [...(editingProject.customFields || [])];
                              newFields[idx].value = e.target.value;
                              setEditingProject({...editingProject, customFields: newFields});
                            }}
                            placeholder="Valor" 
                            className="bg-transparent text-[10px] font-bold outline-none border-l pl-2 w-16 shrink-0"
                          />
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => {
                              const newFields = [...(editingProject.customFields || [])];
                              newFields[idx].active = !newFields[idx].active;
                              setEditingProject({...editingProject, customFields: newFields});
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${cf.active !== false ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                            title="Campo Activo"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete({ type: 'field', index: idx })}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleSaveProject}
                  className="w-full py-5 bg-blue-600 text-white rounded-[2rem] text-[13px] font-black uppercase tracking-widest shadow-2xl shadow-blue-600/20 active:scale-95 transition-all"
                >
                  Guardar y Abrir Cámara
                </button>
              </motion.div>
            )}

            {/* SUCCESS VIEW - REMOVED PER INSTRUCTION, BUT KEPT PLACEHOLDER IF NEEDED */}
          
        {showSyncDetails && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex flex-col">
            <div className="flex items-center gap-3 px-5 py-5 bg-white border-b">
              <button type="button" onClick={() => setShowSyncDetails(false)} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center active:scale-95" aria-label="Volver"><ArrowLeft className="w-5 h-5 text-gray-900" /></button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-black uppercase tracking-tight text-gray-950">Sincronización</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Estado de los registros locales</p>
              </div>
              <button type="button" onClick={() => void runSyncNow()} disabled={syncRunning || !navigator.onLine} className="p-2.5 rounded-xl bg-blue-50 text-blue-600 disabled:opacity-40" aria-label="Sincronizar ahora">
                <RefreshCcw className={'w-5 h-5 ' + (syncRunning ? 'animate-spin' : '')} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total local</p><p className="text-3xl font-black text-gray-950 mt-1">{syncSummary.total}</p></div>
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sincronizados</p><p className="text-3xl font-black text-green-600 mt-1">{syncSummary.synced}</p></div>
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Pendientes</p><p className="text-3xl font-black text-amber-500 mt-1">{syncSummary.pending}</p></div>
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Con error</p><p className="text-3xl font-black text-red-500 mt-1">{syncSummary.failed}</p></div>
              </div>
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Última sincronización</p>
                <p className="text-sm font-black text-gray-950">{syncSummary.lastSyncedAt ? syncSummary.lastSyncedAt.toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' }) : 'Aún no hay registros sincronizados'}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-2">Proyectos: {syncProjectDetails.length} · {syncSummary.projectsSynced} sincronizados · {syncSummary.projectsPending} pendientes · {syncSummary.projectsFailed} con error</p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Detalle por proyecto</h3>
                  <p className="text-[10px] text-gray-400 mt-1">Consulta qué proyecto está sincronizado y cuántos registros faltan.</p>
                </div>
                {syncProjectDetails.length === 0 ? (
                  <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center">
                    <p className="text-xs font-bold text-gray-400">No hay proyectos locales registrados.</p>
                  </div>
                ) : (
                  syncProjectDetails.map(project => {
                    const statusClass =
                      project.status === 'failed'
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : project.status === 'pending'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-green-50 text-green-600 border-green-100';
                    const statusLabel =
                      project.status === 'failed' ? 'Con error' :
                      project.status === 'pending' ? 'Pendiente' : 'Sincronizado';

                    return (
                      <div key={project.id} className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black uppercase text-gray-950 truncate">{project.name}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-0.5 truncate">{project.client}</p>
                          </div>
                          <span className={'shrink-0 px-2.5 py-1 rounded-full border text-[8px] font-black uppercase ' + statusClass}>{statusLabel}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <div className="rounded-xl bg-gray-50 p-2.5">
                            <p className="text-[8px] font-black uppercase text-gray-400">Total</p>
                            <p className="text-sm font-black text-gray-950 mt-0.5">{project.total}</p>
                          </div>
                          <div className="rounded-xl bg-green-50 p-2.5">
                            <p className="text-[8px] font-black uppercase text-green-600">Listos</p>
                            <p className="text-sm font-black text-green-700 mt-0.5">{project.synced}</p>
                          </div>
                          <div className={'rounded-xl p-2.5 ' + (project.failed > 0 ? 'bg-red-50' : 'bg-amber-50')}>
                            <p className={'text-[8px] font-black uppercase ' + (project.failed > 0 ? 'text-red-600' : 'text-amber-600')}>Faltan</p>
                            <p className={'text-sm font-black mt-0.5 ' + (project.failed > 0 ? 'text-red-700' : 'text-amber-700')}>{project.pending + project.failed}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-3">
                          <p className="text-[8px] font-bold uppercase tracking-wide text-gray-400">
                            {project.pending > 0 ? project.pending + ' pendientes' : '0 pendientes'}
                            {' · '}
                            {project.failed > 0 ? project.failed + ' con error' : '0 con error'}
                          </p>
                          {project.lastSyncedAt && (
                            <p className="text-[8px] text-gray-400 shrink-0">
                              {project.lastSyncedAt.toLocaleDateString('es-CR')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {(syncSummary.pending > 0 || syncSummary.failed > 0) && (
                <div className="space-y-3">
                  <div><h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Registros pendientes o con error</h3><p className="text-[10px] text-gray-400 mt-1">Cada registro puede reintentarse de forma individual.</p></div>
                  {syncProblemRecords.map(ev => (
                    <div key={ev.id || ev.uuid} className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className={'w-9 h-9 rounded-xl flex items-center justify-center ' + (ev.syncStatus === 'failed' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500')}>
                          {ev.syncStatus === 'failed' ? <X className="w-4 h-4" /> : <CloudUpload className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase text-gray-950 truncate">{ev.projectName || 'Registro'}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{ev.fecha || ''} {ev.hora || ''}</p>
                          <p className={'text-[9px] font-black uppercase mt-1 ' + (ev.syncStatus === 'failed' ? 'text-red-500' : 'text-amber-500')}>{ev.syncStatus === 'failed' ? 'Error de sincronización' : 'Pendiente de sincronizar'}</p>
                          {ev.syncError && <p className="text-[9px] text-gray-400 mt-1 line-clamp-2">{ev.syncError}</p>}
                        </div>
                        <button type="button" disabled={retryingEvidenceId === ev.id || ev.id == null} onClick={() => ev.id != null && void retrySyncEvidence(ev.id)} className="shrink-0 px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-[9px] font-black uppercase disabled:opacity-40">
                          {retryingEvidenceId === ev.id ? 'Reintentando...' : 'Reintentar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {syncSummary.pending === 0 && syncSummary.failed === 0 && (
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="text-sm font-black uppercase text-gray-950">Todo sincronizado</p>
                  <p className="text-[10px] text-gray-400 mt-1">Los registros locales disponibles ya tienen respaldo en Firebase.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {showEvidenceList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-4 bg-white border-b">
              <h2 className="text-sm font-black uppercase tracking-tight">Evidencias del proyecto</h2>
              <button type="button" onClick={() => setShowEvidenceList(false)} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cerrar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 bg-gray-50">
              {evidences.length === 0 ? (
                <p className="col-span-2 text-center text-sm text-gray-400 py-12">Sin evidencias aun</p>
              ) : (
                evidences.map((ev: any) => (
                  <EvidenceCard key={ev.id || ev.uuid} evidence={ev} />
                ))
              )}
            </div>
            <p className="text-center text-[10px] text-white/70 py-3 bg-black">Las fotos estan en Galeria &gt; album Field Trace</p>
          </motion.div>
        )}

      </AnimatePresence>
        </div>

        {/* Global Action Bar */}
        <div className="absolute bottom-10 left-6 right-6 z-40">
           {/* Global Action Bar content can go here if needed in the future */}
        </div>
      </div>

      {/* CAMERA VIEW (OPERATIONAL FOCUS) - UNCONSTRAINED FULLSCREEN OVERLAY */}
      {currentStep === 'camera' && selectedProject && (
        <div
          key="camera"
          className="fixed inset-0 bg-transparent z-50 flex flex-col pointer-events-auto"
        >
          {/* Category selected from the project checklist */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="bg-black/25 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1 shadow-sm">
              <p className="text-[8px] font-semibold text-white/75 whitespace-nowrap">
                Evidencia: {EVIDENCE_CATEGORIES.find(c => c.id === evidenceCategory)?.label || 'Sin categoría'}
              </p>
              {evidenceCategory === 'NAPS' && napCaptureDraft && (
                <p className="text-[9px] font-black text-white whitespace-nowrap mt-0.5">
                  {getNapsPhotoTitle(napCaptureDraft.photoNumber)} NAP
                </p>
              )}
            </div>
          </div>

          {/* Real-time Camera Bridge */}
          <div id="camera-viewfinder" className="relative flex-1 bg-transparent overflow-hidden" onTouchStart={onCameraTouchStart} onTouchMove={onCameraTouchMove} onTouchEnd={onCameraTouchEnd}>
            {!isNativeCamera && (
              <>
                <video
                  ref={webCameraVideoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                {webCameraError && (
                  <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/90 p-6">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                        <CameraIcon className="h-7 w-7 text-red-600" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-red-600">CÁMARA WEB</p>
                      <p className="mt-2 text-sm font-bold leading-relaxed text-gray-800">{webCameraError}</p>
                      <button
                        type="button"
                        onClick={() => setWebCameraRetryTick(v => v + 1)}
                        className="mt-5 w-full rounded-2xl bg-blue-600 py-4 text-[11px] font-black uppercase tracking-wider text-white"
                      >
                        REINTENTAR CÁMARA
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep('history')}
                        className="mt-2 w-full py-3 text-[10px] font-black uppercase text-gray-500"
                      >
                        VOLVER
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {isNativeCamera && nativeCameraError && (
              <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/90 p-6">
                <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                    <CameraIcon className="h-7 w-7 text-red-600" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-red-600">CÁMARA NATIVA</p>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-gray-800">{nativeCameraError}</p>
                  <button
                    type="button"
                    onClick={() => setCameraPermissionTick(v => v + 1)}
                    className="mt-5 w-full rounded-2xl bg-blue-600 py-4 text-[11px] font-black uppercase tracking-wider text-white"
                  >
                    REINTENTAR CÁMARA
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('history')}
                    className="mt-2 w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    VOLVER
                  </button>
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-transparent pointer-events-none" aria-hidden="true" />
            
            {/* Flash Feedback Layer */}
            <div id="camera-pulse" className="absolute inset-0 pointer-events-none transition-colors duration-100"></div>

            {/* Real-time Metadata Overlay (Mirrors Captured Overlay) */}
            <div className={`absolute pointer-events-none flex flex-col ${
              selectedProject.overlayPosition === 'top-left' ? 'top-0 left-0 items-start' :
              selectedProject.overlayPosition === 'top-right' ? 'top-0 right-0 items-end text-right' :
              selectedProject.overlayPosition === 'bottom-left' ? 'bottom-0 left-0 items-start' :
              'bottom-0 right-0 items-end text-right'
            }`} style={{ padding: '4%', maxWidth: '100%' }}>
              {selectedProject.logoImage && ((selectedProject.logoPosition || 'top-left') === selectedProject.overlayPosition) && (
                <img 
                   src={selectedProject.logoImage} 
                   alt="Logo" 
                   className="mb-2 object-contain shrink-0" 
                   style={{ 
                     width: `${selectedProject.logoSize || 20}vw`,
                     height: 'auto',
                     opacity: selectedProject.logoOpacity !== undefined ? selectedProject.logoOpacity / 100 : 0.8
                   }}
                />
              )}

              <div className="space-y-0.5 font-mono leading-tight" style={{ 
                color: selectedProject.overlayColor || '#FFFFFF',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                fontSize: selectedProject.fontSizeValue 
                  ? `${selectedProject.fontSizeValue / 10}vw` 
                  : (selectedProject.fontSizeScale === 'small' ? '2vw' :
                     selectedProject.fontSizeScale === 'large' ? '4vw' :
                     '3vw'),
                lineHeight: '1.4',
                 maxWidth: (selectedProject.logoImage && ((selectedProject.overlayPosition?.includes('top') && (selectedProject.logoPosition || 'top-left').includes('top') && selectedProject.overlayPosition !== (selectedProject.logoPosition || 'top-left')) || (selectedProject.overlayPosition?.includes('bottom') && (selectedProject.logoPosition || 'top-left').includes('bottom') && selectedProject.overlayPosition !== (selectedProject.logoPosition || 'top-left')))) ? `calc(100vw - 8vw - ${selectedProject.logoSize || 20}vw - 4vw)` : `calc(100vw - 8vw)`
              }}>
                 <p className="line-clamp-4 break-words whitespace-pre-wrap">{selectedProject.name.toUpperCase()}</p>
                 {selectedProject.showDateTime && <p className="line-clamp-4 break-words whitespace-pre-wrap">{formatDateTime(selectedProject.dateTimeFormat)}</p>}
                 
                 <LiveLocationOverlay selectedProject={selectedProject} />
                 
                 {selectedProject.showTech && <p className="line-clamp-4 break-words whitespace-pre-wrap">{selectedProject.techName.toUpperCase()}</p>}
                 
                 {/* Dynamic Custom Fields */}
                 {selectedProject.customFields.filter(f => f.active !== false && f.showInPhoto && (f.name.trim() !== '' || f.value.trim() !== '')).map((f, i) => (
                   <p key={i} className="line-clamp-4 break-words whitespace-pre-wrap">{f.value && f.value.trim() !== '' ? `${f.name.toUpperCase()}: ${f.value.toUpperCase()}` : f.name.toUpperCase()}</p>
                 ))}
                 
                 {evidenceCategory === 'PUNTAS_FIBRA' && fiberCaptureDraft && (
                   <>
                     <p className="line-clamp-4 break-words whitespace-pre-wrap">
                       PUNTA {fiberCaptureDraft.side === 'initial' ? 'INICIAL' : 'FINAL'} {fiberCaptureDraft.pairNumber}: {fiberCaptureDraft.metraje ? `${fiberCaptureDraft.metraje} M` : '—'}
                     </p>
                     <p className="line-clamp-4 break-words whitespace-pre-wrap">NÚMERO DE CARRETE: {fiberCaptureDraft.reelNumber || '—'}</p>
                     <p className="line-clamp-4 break-words whitespace-pre-wrap">FIBRA ÓPTICA DE: {fiberCaptureDraft.fiberCount || '—'}</p>
                   </>
                 )}
 
                 {evidenceCategory === 'ACEROS' && aceroCaptureDraft && (
                   <p className="line-clamp-4 break-words whitespace-pre-wrap">
                     {aceroCaptureDraft.side === 'photo2'
                       ? `METRAJE ${aceroCaptureDraft.aceroNumber}: ${aceroMeterageDraft ? `${aceroMeterageDraft} M` : '—'}`
                       : `PANORÁMICA ACERO ${aceroCaptureDraft.aceroNumber}`}
                   </p>
                 )}

                 {evidenceCategory === 'DESECHOS' && desechoCaptureDraft && (
                   <p className="line-clamp-4 break-words whitespace-pre-wrap">
                     {desechoCaptureDraft.side === 'photo2'
                       ? `METRAJE DESECHO ${desechoCaptureDraft.desechoNumber}: ${desechoMeterageDraft ? `${desechoMeterageDraft} M` : '—'}`
                       : `PANORÁMICA DESECHO ${desechoCaptureDraft.desechoNumber}`}
                   </p>
                 )}

                 {evidenceCategory === 'MEJORAS' && mejoraCaptureDraft && (
                   <p className="line-clamp-4 break-words whitespace-pre-wrap">
                     {mejoraCaptureDraft.mejoraType === 'SUBIDA DE BANDAS'
                       ? `SUBIDA DE BANDA ${mejoraCaptureDraft.mejoraNumber}: ${mejoraCaptureDraft.side === 'before' ? 'ANTES' : 'DESPUÉS'}`
                       : `${mejoraCaptureDraft.mejoraType.slice(0, -1)} ${mejoraCaptureDraft.mejoraNumber}: ${mejoraCaptureDraft.side === 'before' ? 'ANTES' : 'DESPUÉS'}`}
                   </p>                 )}

                 {evidenceCategory === 'ALTAS' && altaCaptureDraft?.altaId && (
                   <>
                     <p className="line-clamp-4 break-words whitespace-pre-wrap">
                       {altaCaptureDraft.side === 'meterage'
                         ? `METRAJE ALTA ${altaCaptureDraft.altaNumber}: ${altaMeterageDraft ? `${altaMeterageDraft} M` : '—'}`
                         : `PANORÁMICA ALTA ${altaCaptureDraft.altaNumber}`}
                     </p>
                     <p className="line-clamp-4 break-words whitespace-pre-wrap">
                       {altaCaptureDraft.altaType}
                     </p>
                     {(altaCaptureDraft.altaType === 'FIBRA DE DESCARTE' || altaCaptureDraft.altaType === 'FIBRA DE DESECHO') && (
                       <>
                         {altaReelDraft.trim() && (
                           <p className="line-clamp-4 break-words whitespace-pre-wrap">CARRETE: {altaReelDraft}</p>
                         )}
                         {altaFiberCountDraft && (
                           <p className="line-clamp-4 break-words whitespace-pre-wrap">FIBRA ÓPTICA DE: {altaFiberCountDraft}</p>
                         )}
                       </>
                     )}
                   </>
                 )}

                 {evidenceCategory === 'NAPS' && napCaptureDraft && (
                   <>
                     <p className="line-clamp-4 break-words whitespace-pre-wrap">
                       FOTO {napCaptureDraft.photoNumber}/9
                     </p>
                     {napCaptureDraft.napName?.trim() && (
                       <p className="line-clamp-4 break-words whitespace-pre-wrap">
                         NAP: {napCaptureDraft.napName.toUpperCase()}
                       </p>
                     )}
                   </>
                 )}
 
                 {evidenceCategory === 'MUFA' && mufaCaptureDraft && (
                   <>
                     <p className="line-clamp-4 break-words whitespace-pre-wrap">
                       FOTO {mufaCaptureDraft.photoNumber}/9
                     </p>
                     {mufaCaptureDraft.mufaName?.trim() && (
                       <p className="line-clamp-4 break-words whitespace-pre-wrap">
                         MUFA: {mufaCaptureDraft.mufaName.toUpperCase()}
                       </p>
                     )}
                   </>
                 )}
 
                 {evidenceCategory === 'RESERVA' && reserveCaptureDraft && (
                   <>
                     {reserveCaptureDraft.side === 'roll' ? (
                       <p className="line-clamp-4 break-words whitespace-pre-wrap">
                         RESERVA DETALLADO {reserveCaptureDraft.reserveNumber}
                       </p>
                     ) : (
                       <>
                         <p className="line-clamp-4 break-words whitespace-pre-wrap">
                           {reserveCaptureDraft.side === 'initial' ? 'PUNTA INICIAL' : 'PUNTA FINAL'} {reserveCaptureDraft.reserveNumber}: {reserveCaptureDraft.metraje ? reserveCaptureDraft.metraje + ' M' : '—'}
                         </p>
                         <p className="line-clamp-4 break-words whitespace-pre-wrap">CARRETE: {reserveCaptureDraft.reelNumber || '—'}</p>
                         <p className="line-clamp-4 break-words whitespace-pre-wrap">FIBRA ÓPTICA DE: {reserveCaptureDraft.fiberCount || '—'}</p>
                       </>
                     )}
                   </>
                 )}
              </div>
            </div>

            {/* Handle logo when it's NOT in the same corner as text */}
            {selectedProject.logoImage && (selectedProject.logoPosition || 'top-left') !== selectedProject.overlayPosition && (
               <div className={`absolute pointer-events-none ${
                  (selectedProject.logoPosition || 'top-left') === 'top-left' ? 'top-0 left-0' :
                  (selectedProject.logoPosition || 'top-left') === 'top-right' ? 'top-0 right-0' :
                  (selectedProject.logoPosition || 'top-left') === 'bottom-left' ? 'bottom-0 left-0' :
                  'bottom-0 right-0'
               }`} style={{ padding: '4%', maxWidth: '100%' }}>
                  <img 
                     src={selectedProject.logoImage} 
                     alt="Logo" 
                     className="object-contain" 
                     style={{ 
                       width: `${selectedProject.logoSize || 20}vw`,
                       height: 'auto',
                       opacity: selectedProject.logoOpacity !== undefined ? selectedProject.logoOpacity / 100 : 0.8
                     }}
                  />
               </div>
            )}

            {/* Quick Config Float (Draggable) */}
            <motion.button 
              drag
              dragMomentum={false}
              onClick={() => setShowQuickConfig(true)}
              className="absolute top-[168px] right-6 w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white z-50 transition-colors hover:bg-black/50 shadow-2xl touch-none"
            >
              <Settings className="w-5 h-5 pointer-events-none" />
            </motion.button>

            {/* Camera controls */}
            <div className="absolute top-6 right-6 z-50 flex flex-col gap-2 items-end">
              <button
                type="button"
                onClick={() => void switchCameraFacing()}
                className="w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white active:scale-95"
                title={cameraFacing === 'rear' ? 'Cambiar a cámara frontal' : 'Cambiar a cámara trasera'}
                aria-label={cameraFacing === 'rear' ? 'Cambiar a cámara frontal' : 'Cambiar a cámara trasera'}
              >
                <RefreshCcw className="w-5 h-5" />              </button>
              <button
                type="button"
                onClick={async () => {
                  const next = flashMode === 'off' ? 'on' : 'off';
                  setFlashMode(next);
                  await ensureFlashArmed(next);
                }}
                className="w-10 h-10 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white active:scale-95"
                title="Flash"
              >
                {flashMode === 'on' ? <Zap className="w-5 h-5 text-yellow-300" /> : <ZapOff className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={cycleZoom}
                className="min-w-10 h-10 px-2 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white text-[11px] font-black active:scale-95 gap-1"
                title="Zoom"
              >
                <ZoomIn className="w-4 h-4" />
                {cameraZoom % 1 === 0 ? `${cameraZoom}x` : `${cameraZoom.toFixed(1)}x`}
              </button>
            </div>
          </div>

          {/* Shutter Bar */}
          <div className="grid grid-cols-7 items-center h-[76px] bg-black border-t border-white/10 shrink-0 px-2">
            <div className="col-start-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => { setCameraZoom(1); setFlashMode('off'); setCameraFacing('rear'); setCurrentStep('history'); }}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 text-white active:scale-95"
                aria-label="Volver"
              >
                <ArrowLeft className="w-6 h-6"/>
              </button>
            </div>

            <div className="col-start-2 flex items-center justify-center">
              <button
                type="button"
                onClick={() => void (isRecordingVideo ? stopVideoRecording() : startVideoRecording())}
                disabled={videoProcessing}
                className={`w-12 h-12 rounded-full border-2 border-white/80 active:scale-95 transition-all flex items-center justify-center ${isRecordingVideo ? 'bg-red-600 text-white' : 'bg-red-500 text-white'} disabled:opacity-50`}
                title={isRecordingVideo ? 'DETENER VIDEO' : 'GRABAR VIDEO'}
                aria-label={isRecordingVideo ? 'DETENER VIDEO' : 'GRABAR VIDEO'}
              >
                {isRecordingVideo ? <Square className="w-5 h-5 fill-white" /> : <Video className="w-6 h-6" />}
              </button>
            </div>

            <div className="col-start-4 flex items-center justify-center">
              <button
                type="button"
                onClick={captureBatchPhoto}
                disabled={!evidenceCategory || isRecordingVideo || videoProcessing || (evidenceCategory === 'MEJORAS' && (isProcessing || mejoraCaptureInFlightRef.current))}
                className="w-16 h-16 bg-white rounded-full p-1 border-[6px] border-white/20 active:scale-95 transition-transform disabled:opacity-40"
                title={evidenceCategory ? 'Capturar fotografía' : 'Seleccione primero el tipo de evidencia'}
                aria-label={evidenceCategory ? 'Capturar fotografía' : 'Seleccione primero el tipo de evidencia'}
              >
                <div className="w-full h-full bg-white rounded-full shadow-inner flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-gray-100 rounded-full"></div>
                </div>
              </button>
            </div>

            <div className="col-start-7 flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const photos = await cameraService.listAlbumPhotos(1);
                    if (photos.length > 0) {
                      await openGalleryGrid();
                    } else if (lastImage) {
                      setShowLastImage(true);
                    } else {
                      void cameraService.openFieldTraceAlbum(true);
                    }
                  })();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  void openGalleryGrid();
                }}
                className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden border border-white/20 flex items-center justify-center text-white active:scale-95"
                aria-label="Abrir galería"
              >
                {lastImage ? (
                  <img src={lastImage} className="w-full h-full object-cover" alt="Última foto" />
                ) : (
                  <History className="w-7 h-7 opacity-40"/>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showLastImage && lastImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl"
            onClick={() => setShowLastImage(false)}
          >
              <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 200 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setShowLastImage(false);
              }}
              className="relative w-full max-w-4xl h-full flex items-center justify-center rounded-3xl overflow-hidden shadow-2xl md:border-4 md:border-white/10 bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={lastImage} className="w-full h-full object-contain" alt="Last Preview" />
              <button 
                onClick={() => setShowLastImage(false)}
                className="absolute top-6 right-6 w-12 h-12 bg-black/40 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 active:scale-90 transition-transform z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="absolute bottom-6 left-6 right-6 text-center pointer-events-auto space-y-3">
                 <p className="text-[10px] text-white/50 font-black uppercase tracking-widest shadow-sm">Ultima foto capturada</p>
                 <button
                   type="button"
                   onClick={() => { void cameraService.openFieldTraceAlbum(); }}
                   className="w-full py-3.5 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95"
                 >
                   Abrir galeria / album Field Trace
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGalleryGrid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => { clearGallerySelection(); setShowGalleryGrid(false); }}
                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-black uppercase tracking-tight text-white">
                {gallerySelectMode
                  ? (selectedGalleryUris.length ? `${selectedGalleryUris.length} seleccionada(s)` : 'Seleccionar')
                  : 'Field Trace'}
              </h2>
              <div className="flex items-center gap-1">
                {!gallerySelectMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setGallerySelectMode(true); setSelectedGalleryUris([]); }}
                      className="text-[10px] font-black uppercase text-blue-400 px-2 py-2"
                    >
                      Seleccionar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGalleryGrid(false);                        void cameraService.openFieldTraceAlbum(true);
                      }}
                      className="text-[10px] font-black uppercase text-white/50 px-2 py-2"
                    >
                      Galeria                    </button>
                  </>
                ) : (
                  <button
                    type="button"                    onClick={clearGallerySelection}
                    className="text-[10px] font-black uppercase text-white/70 px-2 py-2"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {galleryLoading && (
                <p className="text-center text-white/50 text-xs font-bold uppercase py-16 tracking-widest">Cargando fotos...</p>
              )}
              {!galleryLoading && galleryThumbs.length === 0 && (
                <div className="py-16 text-center space-y-3">
                  <History className="w-12 h-12 text-white/20 mx-auto" />
                  <p className="text-[11px] text-white/40 font-black uppercase tracking-widest">Sin fotos en el album<br/>Field Trace</p>
                </div>
              )}
              {!galleryLoading && galleryThumbs.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {galleryThumbs.map((item, idx) => {
                    const isSel = selectedGalleryUris.includes(item.uri);
                    return (
                      <button
                        key={item.uri}
                        type="button"
                        className={`relative aspect-square rounded-lg overflow-hidden bg-white/5 active:opacity-80 ${isSel ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => {
                          if (gallerySelectMode) toggleGallerySelect(item.uri);
                          else openPhotoViewer(idx);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (!gallerySelectMode) setGallerySelectMode(true);
                          toggleGallerySelect(item.uri);
                        }}
                      >
                        <img src={item.thumb} alt="" className="w-full h-full object-cover" />
                        {gallerySelectMode && (
                          <span className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center ${isSel ? 'bg-blue-500 text-white' : 'bg-black/40 border border-white/40 text-transparent'}`}>
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {gallerySelectMode && selectedGalleryUris.length > 0 && (
              <div className="shrink-0 border-t border-white/10 px-4 py-3 flex gap-3 bg-black/90">
                <button
                  type="button"
                  onClick={() => shareSelectedGallery()}
                  className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Compartir
                </button>
                <button
                  type="button"
                  onClick={() => requestDeleteGallery()}
                  className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              </div>
            )}
            <p className="text-center text-[9px] text-white/30 py-2 shrink-0">Toca una foto para abrir · desliza para ver otras</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPhotoViewer && galleryThumbs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setShowPhotoViewer(false)}
                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-xs font-black uppercase tracking-widest text-white/80">
                {viewerIndex + 1} / {galleryThumbs.length}
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoViewer(false);
                  setShowGalleryGrid(true);
                }}
                className="text-[10px] font-black uppercase text-blue-400 px-2 py-2"
              >
                Cuadrícula
              </button>
            </div>

            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              <motion.div
                key={galleryThumbs[viewerIndex]?.uri || viewerIndex}
                className="w-full h-full flex items-center justify-center touch-pan-y"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -80 && viewerIndex < galleryThumbs.length - 1) {
                    setViewerIndex((i) => Math.min(galleryThumbs.length - 1, i + 1));
                  } else if (info.offset.x > 80 && viewerIndex > 0) {
                    setViewerIndex((i) => Math.max(0, i - 1));
                  }
                }}
              >
                <img
                  src={
                    viewerFullImages[galleryThumbs[viewerIndex].uri] ||
                    galleryThumbs[viewerIndex].thumb
                  }
                  alt={`Foto ${viewerIndex + 1}`}
                  className="max-w-full max-h-full object-contain select-none pointer-events-none"
                  draggable={false}
                />
              </motion.div>

              {viewerIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setViewerIndex((i) => Math.max(0, i - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {viewerIndex < galleryThumbs.length - 1 && (
                <button
                  type="button"
                  onClick={() => setViewerIndex((i) => Math.min(galleryThumbs.length - 1, i + 1))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:scale-95"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 px-4 py-3 flex items-center justify-between gap-3 bg-black">
              <p className="text-[9px] text-white/35">Desliza para ver otras</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const uri = galleryThumbs[viewerIndex]?.uri;
                    if (uri) shareSelectedGallery([uri]);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Compartir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const uri = galleryThumbs[viewerIndex]?.uri;
                    if (uri) requestDeleteGallery([uri]);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickConfig && selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              storageService.updateProject(selectedProject.id!, selectedProject);
              setShowQuickConfig(false);
            }}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-lg bg-white rounded-t-[3rem] p-8 shadow-2xl overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
              
              <div className="flex justify-between items-center mb-6">                <div>
                   <h3 className="text-xl font-black uppercase tracking-tighter">Campos Operativos</h3>
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ajustes rápidos de captura</p>
                </div>
                <button 
                  onClick={() => {
                    const newFields = [...selectedProject.customFields, { name: '', value: '', showInPhoto: true, active: true }];
                    const updated = { ...selectedProject, customFields: newFields };
                    setSelectedProject(updated);
                  }}
                  className="p-3 bg-blue-50 text-blue-600 rounded-2xl active:scale-90 transition-transform"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar pb-8">
                {selectedProject.customFields.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-[2rem]">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No hay campos dinámicos</p>
                  </div>
                )}
                {selectedProject.customFields.map((cf, idx) => (
                  <div key={idx} className={`p-2.5 rounded-2xl border transition-all ${cf.active !== false ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex gap-2">
                        <AutoResizingTextarea
                          value={cf.name || ''} 
                          onChange={(e: any) => {
                            const newFields = [...selectedProject.customFields];
                            newFields[idx].name = e.target.value;
                            setSelectedProject({...selectedProject, customFields: newFields});
                          }}
                          className="bg-transparent font-black text-[11px] uppercase tracking-tighter w-full outline-none border-b border-transparent focus:border-blue-400 resize-none overflow-hidden"
                          placeholder="NOMBRE CAMPO"
                        />
                        <input 
                          type="number"
                          value={cf.value || ''} 
                          onChange={(e) => {
                            const newFields = [...selectedProject.customFields];
                            newFields[idx].value = e.target.value;
                            setSelectedProject({...selectedProject, customFields: newFields});
                          }}
                          className="bg-white px-2 py-1.5 rounded-lg font-mono text-[11px] w-16 shrink-0 shadow-sm border border-gray-100 focus:border-blue-400 outline-none"
                          placeholder="CANT"
                        />
                      </div>
                      
                      <button 
                        onClick={() => {
                          const newFields = [...selectedProject.customFields];
                          newFields[idx].active = !newFields[idx].active;
                          setSelectedProject({...selectedProject, customFields: newFields});
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${cf.active !== false ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                      >
                         <CheckCircle2 className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => setConfirmDelete({ type: 'field', index: idx })}
                        className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center active:scale-90 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => {
                    storageService.updateProject(selectedProject.id!, selectedProject);
                    setShowQuickConfig(false);
                  }}
                  className="flex-1 py-5 bg-gray-950 text-white rounded-[2rem] text-[13px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
                >
                  Volver a Cámara
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2">¿Confirmar Eliminación?</h3>
              <p className="text-sm text-gray-500 font-medium mb-8">
                {confirmDelete.type === 'field' 
                  ? '¿Estás seguro de que deseas eliminar este campo personalizado? Esta acción no se puede deshacer.'
                  : confirmDelete.type === 'evidence'
                  ? '¿Eliminar esta evidencia definitivamente? Se borrará la fotografía de Firebase Storage, su registro y la referencia local. Esta acción no se puede deshacer.'
                  : '¿Estás seguro de que deseas eliminar este proyecto y toda su historia?'}
              </p>
              <div className="flex gap-4">                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    if (confirmDelete.type === 'field' && confirmDelete.index !== undefined) {
                      if (currentStep === 'setup' && editingProject) {
                        const newFields = [...(editingProject.customFields || [])];
                        newFields.splice(confirmDelete.index, 1);
                        setEditingProject({...editingProject, customFields: newFields});
                      } else if (selectedProject) {
                        const newFields = [...(selectedProject.customFields || [])];
                        newFields.splice(confirmDelete.index, 1);
                        setSelectedProject({...selectedProject, customFields: newFields});
                      }
                    } else if (confirmDelete.type === 'evidence' && confirmDelete.id != null) {
                      try {
                        await storageService.deleteEvidence(confirmDelete.id);
                        if (selectedProject?.id) {
                          const evs = await storageService.getEvidencesByProject(selectedProject.id);
                          setEvidences(evs);
                        }
                        setViewingEvidence(null);
                        setShowStorageEvidenceViewer(false);
                        setStorageEvidenceCategory(null);
                      } catch (e) {
                        console.error('Error eliminando evidencia', e);
                        alert(`No se pudo eliminar definitivamente la evidencia: ${e instanceof Error ? e.message : 'error desconocido'}`);
                      }
                    } else if (confirmDelete.type === 'project' && confirmDelete.id != null) {
                      requestDeleteProjects([confirmDelete.id]);
                    }
                    setConfirmDelete(null);
                  }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-sm font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-red-500/30"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showFiberPairSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Puntas de fibra</p>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-1">Seleccione la punta</h3>
                <p className="text-xs text-gray-500 mt-2">Cada punta reúne su fotografía inicial y final en el mismo grupo.</p>
              </div>

              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {fiberPairs.filter(pair => !pair.complete).map(pair => (
                  <div key={pair.pairId} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-950">PUNTA {String(pair.pairNumber).padStart(2, '0')}</p>
                        <p className={`text-[8px] font-black uppercase mt-1 ${pair.complete ? 'text-green-600' : 'text-amber-600'}`}>
                          {pair.complete ? '2/2 FOTOS · COMPLETA' : `1/2 FOTOS · FALTA ${!pair.hasInitial ? 'INICIAL' : 'FINAL'}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!pair.hasInitial && (
                          <button type="button" onClick={() => openFiberSide('initial', pair.pairId)} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[8px] font-black uppercase">Inicial</button>
                        )}
                        {!pair.hasFinal && pair.hasInitial && (
                          <button type="button" onClick={() => openFiberSide('final', pair.pairId)} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[8px] font-black uppercase">Final</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => openFiberSide('initial')} className="w-full py-3 rounded-2xl border-2 border-dashed border-blue-200 text-blue-700 text-[10px] font-black uppercase">Nueva punta</button>
              </div>

              <button type="button" onClick={() => setShowFiberPairSelector(false)} className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase">Cancelar</button>
            </motion.div>
          </motion.div>
        )}

        {showFiberCaptureModal && fiberCaptureDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Punta de fibra {fiberCaptureDraft.pairNumber}</p>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-1">
                  {fiberCaptureDraft.side === 'initial' ? 'Fotografía inicial' : 'Fotografía final'}
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  {fiberCaptureDraft.side === 'initial'
                    ? 'Ingrese el metraje de esta punta. Después se abrirá automáticamente la cámara.'
                    : 'Seleccione la punta pendiente e ingrese el metraje final. Después se abrirá automáticamente la cámara.'}
                </p>
              </div>

              {fiberCaptureDraft.side === 'final' && (
                <div>
                  <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Punta pendiente</label>
                  <select
                    value={fiberCaptureDraft.pairId}
                    onChange={(e) => {
                      const selected = evidences.find(ev => ev.fiberPairId === e.target.value && ev.category === 'PUNTAS_FIBRA_INICIAL');
                      setFiberCaptureDraft(prev => prev ? {
                        ...prev,
                        pairId: e.target.value,
                        pairNumber: Number(selected?.fiberPairNumber || prev.pairNumber)
                      } : prev);
                    }}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-black text-gray-900 outline-none"
                  >
                    {evidences
                      .filter(ev => ev.category === 'PUNTAS_FIBRA_INICIAL' && ev.fiberPairId)
                      .filter(initial => !evidences.some(ev => ev.category === 'PUNTAS_FIBRA_FINAL' && ev.fiberPairId === initial.fiberPairId))
                      .sort((a, b) => Number(a.fiberPairNumber || 0) - Number(b.fiberPairNumber || 0))
                      .map(initial => (
                        <option key={initial.fiberPairId} value={initial.fiberPairId}>
                          PUNTA {String(initial.fiberPairNumber).padStart(2, '0')} · INICIAL {initial.fiberMeterage} m
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Número de carrete</label>
                <input
                  type="text"
                  inputMode="text"
                  autoFocus={fiberCaptureDraft.side === 'initial'}
                  value={fiberCaptureDraft.reelNumber}
                  onChange={(e) => setFiberCaptureDraft(prev => prev ? { ...prev, reelNumber: e.target.value.toUpperCase() } : prev)}
                  readOnly={fiberCaptureDraft.side === 'final'}
                  placeholder="Ej. 00125"
                  className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-black text-gray-950 outline-none ${fiberCaptureDraft.side === 'final' ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-200 focus:border-blue-600'}`}
                />
                {fiberCaptureDraft.side === 'final' && (
                  <p className="text-[9px] font-bold uppercase text-green-600 mt-1">✓ Carrete heredado de la punta inicial</p>
                )}
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Fibra Óptica de:</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={fiberCaptureDraft.fiberCount}
                  onChange={(e) => setFiberCaptureDraft(prev => prev ? { ...prev, fiberCount: e.target.value } : prev)}
                  readOnly={fiberCaptureDraft.side === 'final'}
                  placeholder="Ej. 12, 24, 48"
                  className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-black text-gray-950 outline-none ${fiberCaptureDraft.side === 'final' ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-200 focus:border-blue-600'}`}
                />
                {fiberCaptureDraft.side === 'final' && (
                  <p className="text-[9px] font-bold uppercase text-green-600 mt-1">✓ Fibra Óptica de: heredada de la punta inicial</p>
                )}
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Metraje de la punta (m)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={fiberCaptureDraft.metraje}
                  onChange={(e) => setFiberCaptureDraft(prev => prev ? { ...prev, metraje: e.target.value } : prev)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmFiberCapture(); }}
                  placeholder="Ej. 1250"
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-4 text-xl font-black text-gray-950 outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowFiberCaptureModal(false); setFiberCaptureDraft(null); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase">Cancelar</button>
                <button type="button" onClick={confirmFiberCapture} disabled={!fiberCaptureDraft.metraje.trim() || !fiberCaptureDraft.reelNumber.trim() || !fiberCaptureDraft.fiberCount.trim()} className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase shadow-lg disabled:opacity-40">Guardar y abrir cámara</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showNapCaptureModal && napCaptureDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[221] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Evidencia NAPS</p>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-1">
                  NAP {String(napCaptureDraft.napNumber).padStart(2, '0')} · FOTO {napCaptureDraft.photoNumber}/9
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  Ingrese el nombre del NAP una sola vez. Las 9 fotografías quedarán agrupadas bajo el mismo NAP.
                </p>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Nombre del NAP</label>
                <textarea
                  value={napCaptureDraft.napName}
                  onChange={e => setNapCaptureDraft(prev => prev ? { ...prev, napName: e.target.value } : prev)}
                  placeholder="Ej. GT069/072"
                  readOnly={napCaptureDraft.photoNumber > 1}
                  rows={2}
                  className="w-full min-h-[92px] px-4 py-4 rounded-2xl border-2 border-blue-500 text-lg font-black uppercase tracking-tight outline-none resize-none overflow-y-auto whitespace-pre-wrap break-words read-only:bg-gray-100 read-only:text-gray-500"
                />
                {napCaptureDraft.photoNumber > 1 && <p className="text-[9px] font-black uppercase text-green-600 mt-2">✓ Nombre heredado para las 9 fotos</p>}
              </div>
              <button type="button" disabled={!napCaptureDraft.napName.trim()}
                onClick={() => { setEvidenceCategory('NAPS'); setShowNapCaptureModal(false); setCurrentStep('camera'); }}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase disabled:opacity-40">
                {napCaptureDraft.photoNumber === 1 ? 'GUARDAR NOMBRE Y ABRIR CÁMARA' : 'ABRIR CÁMARA'}
              </button>
              <button type="button" onClick={() => { setShowNapCaptureModal(false); setNapCaptureDraft(null); }}
                className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase">Cancelar</button>
            </motion.div>
          </motion.div>
        )}

        {showMufaCaptureModal && mufaCaptureDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[221] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Evidencia MUFA</p>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-1">
                  MUFA {String(mufaCaptureDraft.mufaNumber).padStart(2, '0')} · FOTO {mufaCaptureDraft.photoNumber}/9
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  Ingrese el nombre del MUFA una sola vez. Las 9 fotografías quedarán agrupadas bajo el mismo MUFA.
                </p>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Nombre del MUFA</label>
                <textarea
                  value={mufaCaptureDraft.mufaName}
                  onChange={e => setMufaCaptureDraft(prev => prev ? { ...prev, mufaName: e.target.value } : prev)}
                  placeholder="Ej. GT069/072"
                  readOnly={mufaCaptureDraft.photoNumber > 1}
                  rows={2}
                  className="w-full min-h-[92px] px-4 py-4 rounded-2xl border-2 border-blue-500 text-lg font-black uppercase tracking-tight outline-none resize-none overflow-y-auto whitespace-pre-wrap break-words read-only:bg-gray-100 read-only:text-gray-500"
                />
                {mufaCaptureDraft.photoNumber > 1 && <p className="text-[9px] font-black uppercase text-green-600 mt-2">✓ Nombre heredado para las 9 fotos</p>}
              </div>
              <button type="button" disabled={!mufaCaptureDraft.mufaName.trim()}
                onClick={() => { setEvidenceCategory('MUFA'); setShowMufaCaptureModal(false); setCurrentStep('camera'); }}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase disabled:opacity-40">
                {mufaCaptureDraft.photoNumber === 1 ? 'GUARDAR NOMBRE Y ABRIR CÁMARA' : 'ABRIR CÁMARA'}
              </button>
              <button type="button" onClick={() => { setShowMufaCaptureModal(false); setMufaCaptureDraft(null); }}
                className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase">Cancelar</button>
            </motion.div>
          </motion.div>
        )}

        {showAltaCaptureModal && altaCaptureDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[221] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 max-h-[88vh] overflow-y-auto">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Altas</p>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-1">
                  {altaCaptureDraft.altaId
                    ? `ALTA ${String(altaCaptureDraft.altaNumber).padStart(2, '0')}`
                    : 'TIPO DE ALTA'}
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  {!altaCaptureDraft.altaId
                    ? 'Seleccione primero el tipo de alta que desea documentar.'
                    : altaPromptMode === 'meterage'
                      ? 'Ingrese el metraje que corresponde a esta fotografía.'
                      : '¿Qué tipo de fotografía desea tomar?'}
                </p>
              </div>

              {!altaCaptureDraft.altaId ? (
                <div className="space-y-2.5">
                  {(['FIBRA DE DESCARTE', 'FIBRA DE DESECHO', 'ALTAS EN ACERO'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const groups = Array.from(new Set(
                          evidences
                            .filter(ev => ev.category === 'ALTAS' && ev.altaId && ev.altaType === type)
                            .map(ev => ev.altaId as string)
                        ))
                          .map(altaId => {
                            const group = evidences.filter(ev => ev.category === 'ALTAS' && ev.altaId === altaId);
                            const first = group[0];
                            const altaNumber = Number(first?.altaNumber || 0);
                            const hasPanoramic = group.some(ev => ev.altaSide === 'panoramic');
                            const hasMeterage = group.some(ev => ev.altaSide === 'meterage');
                            return { altaId, altaNumber, hasPanoramic, hasMeterage };
                          })
                          .filter(group => !(group.hasPanoramic && group.hasMeterage))
                          .sort((a, b) => a.altaNumber - b.altaNumber);

                        if (groups.length > 0) {
                          const group = groups[0];
                          const missingSide: 'panoramic' | 'meterage' = group.hasPanoramic ? 'meterage' : 'panoramic';
                          setAltaCaptureDraft({
                            altaId: group.altaId,
                            altaNumber: group.altaNumber,
                            altaType: type,
                            side: missingSide
                          });
                          setAltaMeterageDraft('');
                          setAltaReelDraft('');
                          setAltaFiberCountDraft('');

                          // Un set de ALTA solo admite una panorámica y un metraje.
                          // Si ya existe una de las dos, no volvemos a ofrecerla:
                          // continuamos directamente con la parte que falta.
                          if (missingSide === 'panoramic') {
                            setAltaPromptMode(null);
                            setShowAltaCaptureModal(false);
                            setCurrentStep('camera');
                          } else {
                            setAltaPromptMode('meterage');
                          }
                        } else {
                          const usedNumbers = evidences
                            .filter(ev => ev.category === 'ALTAS' && ev.altaNumber != null)
                            .map(ev => Number(ev.altaNumber))
                            .filter(Number.isFinite);
                          const altaNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
                          const altaId = crypto.randomUUID
                            ? crypto.randomUUID()
                            : 'alta_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                          setAltaCaptureDraft({
                            altaId,
                            altaNumber,
                            altaType: type,
                            side: 'panoramic'
                          });
                          setAltaMeterageDraft('');
                          setAltaReelDraft('');
                          setAltaFiberCountDraft('');
                          setAltaPromptMode('type');
                        }
                      }}
                      className="w-full py-4 rounded-2xl border-2 border-blue-100 bg-blue-50 text-blue-800 text-[10px] font-black uppercase"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              ) : altaPromptMode === 'type' ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-[9px] font-black uppercase text-gray-500">Tipo de alta</p>
                    <p className="text-sm font-black uppercase text-gray-950 mt-1">{altaCaptureDraft.altaType}</p>
                    <p className="text-[9px] font-black uppercase text-blue-700 mt-2">
                      ALTA {String(altaCaptureDraft.altaNumber).padStart(2, '0')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAltaCaptureDraft(prev => prev ? { ...prev, side: 'panoramic' } : prev);
                      setAltaPromptMode(null);
                      setShowAltaCaptureModal(false);
                      setCurrentStep('camera');
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                  >
                    PANORÁMICA
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAltaCaptureDraft(prev => prev ? { ...prev, side: 'meterage' } : prev);
                      setAltaMeterageDraft('');
                      setAltaPromptMode('meterage');
                    }}
                    className="w-full py-4 rounded-2xl bg-gray-100 text-gray-800 text-[11px] font-black uppercase tracking-wider border border-gray-200"
                  >
                    METRAJE
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAltaCaptureModal(false);
                      setAltaPromptMode(null);
                      setAltaMeterageDraft('');
                      setAltaCaptureDraft(null);                    }}
                    className="w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    CANCELAR
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-[9px] font-black uppercase text-gray-500">Tipo de alta</p>
                    <p className="text-sm font-black uppercase text-gray-950 mt-1">{altaCaptureDraft.altaType}</p>
                    <p className="text-[9px] font-black uppercase text-blue-700 mt-2">
                      ALTA {String(altaCaptureDraft.altaNumber).padStart(2, '0')} · METRAJE
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        autoFocus
                        value={altaMeterageDraft}
                        onChange={(e) => setAltaMeterageDraft(e.target.value)}
                        placeholder="Ej. 1250"
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-black outline-none focus:border-blue-500"
                      />
                      <span className="text-sm font-black text-gray-500">M</span>
                    </div>

                    {(altaCaptureDraft.altaType === 'FIBRA DE DESCARTE' || altaCaptureDraft.altaType === 'FIBRA DE DESECHO') && (
                      <div className="mt-4 space-y-3">
                        <div>
                          <p className="text-[9px] font-black uppercase text-gray-500">Número de carrete <span className="text-gray-400">(opcional)</span></p>
                          <input
                            type="text"
                            inputMode="text"
                            value={altaReelDraft}
                            onChange={(e) => setAltaReelDraft(e.target.value.toUpperCase())}
                            placeholder="Ej. 123456"
                            className="w-full mt-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm font-black outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-gray-500">Fibra Óptica de: <span className="text-gray-400">(opcional)</span></p>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={altaFiberCountDraft}
                            onChange={(e) => setAltaFiberCountDraft(e.target.value)}
                            placeholder="Ej. 48"
                            className="w-full mt-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm font-black outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const value = Number(altaMeterageDraft);
                      if (!Number.isFinite(value) || value <= 0) {
                        alert('Ingrese un metraje válido mayor que 0.');
                        return;
                      }
                      setAltaPromptMode(null);
                      setShowAltaCaptureModal(false);
                      setCurrentStep('camera');
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                  >
                    CONTINUAR A CÁMARA
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAltaMeterageDraft('');
                      setAltaReelDraft('');
                      setAltaFiberCountDraft('');
                      setAltaPromptMode('type');
                    }}
                    className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase"
                  >
                    CAMBIAR TIPO
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAltaCaptureModal(false);
                      setAltaPromptMode(null);
                      setAltaMeterageDraft('');
                      setAltaCaptureDraft(null);
                    }}
                    className="w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    CANCELAR
                  </button>
                </div>
              )}

              {!altaCaptureDraft.altaId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAltaCaptureModal(false);
                    setAltaPromptMode(null);
                    setAltaMeterageDraft('');
                    setAltaCaptureDraft(null);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase"
                >
                  CANCELAR
                </button>
              )}
            </motion.div>
          </motion.div>
        )}

        {showAceroCaptureModal && aceroCaptureDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[231] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
              <div className="text-center mb-5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                  <CameraIcon className="w-7 h-7 text-blue-600" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Set de Aceros</p>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-950 mt-1">
                  ACERO {String(aceroCaptureDraft.aceroNumber).padStart(2, '0')}
                </h3>
                {aceroPromptMode === 'type' ? (
                  <p className="text-xs text-gray-500 mt-2">¿Qué tipo de fotografía desea tomar?</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">Ingrese el metraje que corresponde a esta fotografía.</p>
                )}
              </div>

              {aceroPromptMode === 'type' ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {                      setAceroCaptureDraft(prev => prev ? { ...prev, side: 'photo1' } : prev);
                      setAceroPromptMode(null);
                      setShowAceroCaptureModal(false);
                      setCurrentStep('camera');
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                  >
                    PANORÁMICA
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAceroCaptureDraft(prev => prev ? { ...prev, side: 'photo2' } : prev);
                      setAceroMeterageDraft('');
                      setAceroPromptMode('meterage');
                    }}
                    className="w-full py-4 rounded-2xl bg-gray-100 text-gray-800 text-[11px] font-black uppercase tracking-wider border border-gray-200"
                  >
                    METRAJE
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAceroCaptureModal(false);
                      setAceroPromptMode(null);
                      setAceroMeterageDraft('');
                      setAceroCaptureDraft(null);
                    }}
                    className="w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    CANCELAR
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-[9px] font-black uppercase text-gray-500">Metraje</p>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        autoFocus
                        value={aceroMeterageDraft}
                        onChange={(e) => setAceroMeterageDraft(e.target.value)}
                        placeholder="Ej. 1250"
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-black outline-none focus:border-blue-500"
                      />
                      <span className="text-sm font-black text-gray-500">M</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const value = Number(aceroMeterageDraft);
                      if (!Number.isFinite(value) || value <= 0) {
                        alert('Ingrese un metraje válido mayor que 0.');
                        return;
                      }
                      setShowAceroCaptureModal(false);
                      setAceroPromptMode(null);
                      setCurrentStep('camera');
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                  >
                    CONTINUAR A CÁMARA
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAceroMeterageDraft('');
                      setAceroPromptMode('type');
                    }}
                    className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase"
                  >
                    CAMBIAR TIPO
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAceroCaptureModal(false);
                      setAceroPromptMode(null);
                      setAceroMeterageDraft('');
                      setAceroCaptureDraft(null);
                    }}
                    className="w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    CANCELAR
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {aceroSetChoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[230] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
              <div className="text-center mb-5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                  <CameraIcon className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-950">SET DE ACEROS INCOMPLETO</h3>
                <p className="text-xs text-gray-500 mt-2">
                  ACERO {String(aceroSetChoice.aceroNumber).padStart(2, '0')} tiene 1 de 2 fotografías.
                </p>
                <p className="text-[10px] font-bold uppercase text-amber-600 mt-1">
                  FALTA {aceroSetChoice.missingSide === 'photo1' ? 'PANORÁMICA' : 'METRAJE'}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    const choice = aceroSetChoice;
                    setAceroSetChoice(null);
                    setEvidenceCategory('ACEROS');
                    setAceroCaptureDraft({
                      aceroId: choice.aceroId,
                      aceroNumber: choice.aceroNumber,
                      side: choice.missingSide
                    });
                    setAceroMeterageDraft('');
                    if (choice.missingSide === 'photo2') {
                      setAceroPromptMode('meterage');
                      setShowAceroCaptureModal(true);
                    } else {
                      setAceroPromptMode(null);
                      setCurrentStep('camera');
                    }
                  }}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                >
                  COMPLETAR ACERO {String(aceroSetChoice.aceroNumber).padStart(2, '0')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAceroSetChoice(null);                    setEvidenceCategory('ACEROS');
                    const usedNumbers = evidences
                      .filter(ev => ev.category === 'ACEROS' && ev.aceroNumber != null)
                      .map(ev => Number(ev.aceroNumber))
                      .filter(Number.isFinite);
                    const aceroNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;                    const aceroId = crypto.randomUUID
                      ? crypto.randomUUID()
                      : `acero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                    setAceroCaptureDraft({
                      aceroId,                      aceroNumber,
                      side: 'photo1'
                    });
                    setAceroMeterageDraft('');
                    setAceroPromptMode('type');
                    setShowAceroCaptureModal(true);
                  }}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-800 text-[11px] font-black uppercase tracking-wider border border-gray-200"
                >
                  TOMAR FOTO DE NUEVO ACERO
                </button>

                <button type="button" onClick={() => setAceroSetChoice(null)} className="w-full py-3 text-[10px] font-black uppercase text-gray-500">
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showMejoraCaptureModal && mejoraCaptureDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[232] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
              <div className="text-center mb-5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                  <CameraIcon className="w-7 h-7 text-blue-600" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">MEJORAS</p>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-950 mt-1">
                  MEJORA {String(mejoraCaptureDraft.mejoraNumber).padStart(2, '0')}
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  {mejoraPromptMode === 'type' ? 'Seleccione el tipo de mejora que desea documentar.' : '¿La fotografía corresponde al antes o al después?'}
                </p>
              </div>

              {mejoraPromptMode === 'type' ? (
                <div className="space-y-3">
                  {(['SUBIDA DE BANDAS', 'PODAS', 'SUBIDA DE RETENIDAS'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setMejoraCaptureDraft(prev => prev ? { ...prev, mejoraType: type } : prev);
                        setMejoraPromptMode('side');
                      }}
                      className="w-full py-4 rounded-2xl bg-blue-50 text-blue-800 text-[11px] font-black uppercase tracking-wider border border-blue-100"
                    >
                      {type}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMejoraCaptureModal(false);
                      setMejoraPromptMode(null);
                      setMejoraCaptureDraft(null);
                    }}
                    className="w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    CANCELAR
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-[9px] font-black uppercase text-gray-500">TIPO DE MEJORA</p>
                    <p className="text-sm font-black text-gray-950 mt-1">{mejoraCaptureDraft.mejoraType}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMejoraCaptureDraft(prev => prev ? { ...prev, side: 'before' } : prev);
                      setShowMejoraCaptureModal(false);
                      setMejoraPromptMode(null);
                      setCurrentStep('camera');
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                  >
                    ANTES
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMejoraCaptureDraft(prev => prev ? { ...prev, side: 'after' } : prev);
                      setShowMejoraCaptureModal(false);
                      setMejoraPromptMode(null);
                      setCurrentStep('camera');
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                  >
                    DESPUÉS
                  </button>
                  <button
                    type="button"
                    onClick={() => setMejoraPromptMode('type')}
                    className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase"
                  >
                    CAMBIAR TIPO
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMejoraCaptureModal(false);
                      setMejoraPromptMode(null);
                      setMejoraCaptureDraft(null);
                    }}
                    className="w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    CANCELAR
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {showDesechoCaptureModal && desechoCaptureDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[231] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
              <div className="text-center mb-5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                  <CameraIcon className="w-7 h-7 text-blue-600" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Set de Desechos</p>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-950 mt-1">
                  DESECHO {String(desechoCaptureDraft.desechoNumber).padStart(2, '0')}
                </h3>
                {desechoPromptMode === 'type' ? (
                  <p className="text-xs text-gray-500 mt-2">¿Qué tipo de fotografía desea tomar?</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">Ingrese el metraje que corresponde a esta fotografía.</p>
                )}
              </div>

              {desechoPromptMode === 'type' ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDesechoCaptureDraft(prev => prev ? { ...prev, side: 'photo1' } : prev);
                      setDesechoPromptMode(null);
                      setShowDesechoCaptureModal(false);
                      setCurrentStep('camera');
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                  >
                    PANORÁMICA
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDesechoCaptureDraft(prev => prev ? { ...prev, side: 'photo2' } : prev);
                      setDesechoMeterageDraft('');
                      setDesechoPromptMode('meterage');
                    }}
                    className="w-full py-4 rounded-2xl bg-gray-100 text-gray-800 text-[11px] font-black uppercase tracking-wider border border-gray-200"
                  >
                    METRAJE
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDesechoCaptureModal(false);
                      setDesechoPromptMode(null);
                      setDesechoMeterageDraft('');
                      setDesechoCaptureDraft(null);
                    }}
                    className="w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    CANCELAR
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-[9px] font-black uppercase text-gray-500">Metraje</p>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        autoFocus
                        value={desechoMeterageDraft}
                        onChange={(e) => setDesechoMeterageDraft(e.target.value)}
                        placeholder="Ej. 1250"
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-black outline-none focus:border-blue-500"
                      />
                      <span className="text-sm font-black text-gray-500">M</span>
                    </div>
                  </div>

                  <button
                    type="button"                    onClick={() => {
                      const value = Number(desechoMeterageDraft);
                      if (!Number.isFinite(value) || value <= 0) {
                        alert('Ingrese un metraje válido mayor que 0.');
                        return;
                      }
                      setShowDesechoCaptureModal(false);
                      setDesechoPromptMode(null);
                      setCurrentStep('camera');
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                  >
                    CONTINUAR A CÁMARA
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDesechoMeterageDraft('');
                      setDesechoPromptMode('type');
                    }}
                    className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase"
                  >
                    CAMBIAR TIPO
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDesechoCaptureModal(false);
                      setDesechoPromptMode(null);
                      setDesechoMeterageDraft('');
                      setDesechoCaptureDraft(null);
                    }}
                    className="w-full py-3 text-[10px] font-black uppercase text-gray-500"
                  >
                    CANCELAR
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {mejoraSetChoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[231] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
              <div className="text-center mb-5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                  <CameraIcon className="w-7 h-7 text-blue-600" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">MEJORAS</p>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-950">
                  MEJORA {String(mejoraSetChoice.mejoraNumber).padStart(2, '0')}
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  {mejoraSetChoice.mejoraType}
                </p>
                <p className="text-[10px] font-bold uppercase text-amber-600 mt-1">
                  FALTA {mejoraSetChoice.missingSide === 'before' ? 'ANTES' : 'DESPUÉS'}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    const choice = mejoraSetChoice;
                    setMejoraSetChoice(null);
                    setEvidenceCategory('MEJORAS');
                    setMejoraCaptureDraft({
                      mejoraId: choice.mejoraId,
                      mejoraNumber: choice.mejoraNumber,
                      mejoraType: choice.mejoraType,
                      side: choice.missingSide
                    });
                    setCurrentStep('camera');
                  }}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                >
                  COMPLETAR MEJORA {String(mejoraSetChoice.mejoraNumber).padStart(2, '0')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMejoraSetChoice(null);
                    const usedNumbers = evidences
                      .filter(ev => ev.category === 'MEJORAS' && ev.mejoraNumber != null)
                      .map(ev => Number(ev.mejoraNumber))
                      .filter(Number.isFinite);
                    const mejoraNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
                    const mejoraId = crypto.randomUUID
                      ? crypto.randomUUID()
                      : `mejora_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    setMejoraCaptureDraft({
                      mejoraId,
                      mejoraNumber,
                      mejoraType: 'SUBIDA DE BANDAS',
                      side: 'before'
                    });
                    setMejoraPromptMode('type');
                    setShowMejoraCaptureModal(true);
                  }}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-800 text-[11px] font-black uppercase tracking-wider border border-gray-200"
                >
                  TOMAR FOTO DE NUEVA MEJORA
                </button>

                <button type="button" onClick={() => setMejoraSetChoice(null)} className="w-full py-3 text-[10px] font-black uppercase text-gray-500">
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {desechoSetChoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[230] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
              <div className="text-center mb-5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                  <CameraIcon className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-950">SET DE DESECHOS INCOMPLETO</h3>
                <p className="text-xs text-gray-500 mt-2">
                  DESECHO {String(desechoSetChoice.desechoNumber).padStart(2, '0')} tiene 1 de 2 fotografías.
                </p>
                <p className="text-[10px] font-bold uppercase text-amber-600 mt-1">
                  FALTA {desechoSetChoice.missingSide === 'photo1' ? 'PANORÁMICA' : 'METRAJE'}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    const choice = desechoSetChoice;
                    setDesechoSetChoice(null);
                    setEvidenceCategory('DESECHOS');
                    setDesechoCaptureDraft({
                      desechoId: choice.desechoId,
                      desechoNumber: choice.desechoNumber,
                      side: choice.missingSide                    });
                    setDesechoMeterageDraft('');
                    if (choice.missingSide === 'photo2') {
                      setDesechoPromptMode('meterage');
                      setShowDesechoCaptureModal(true);
                    } else {
                      setDesechoPromptMode(null);
                      setCurrentStep('camera');
                    }
                  }}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider"
                >
                  COMPLETAR DESECHO {String(desechoSetChoice.desechoNumber).padStart(2, '0')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDesechoSetChoice(null);
                    setEvidenceCategory('DESECHOS');
                    const usedNumbers = evidences
                      .filter(ev => ev.category === 'DESECHOS' && ev.desechoNumber != null)
                      .map(ev => Number(ev.desechoNumber))
                      .filter(Number.isFinite);
                    const desechoNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
                    const desechoId = crypto.randomUUID
                      ? crypto.randomUUID()
                      : `desecho_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                    setDesechoCaptureDraft({
                      desechoId,
                      desechoNumber,
                      side: 'photo1'
                    });
                    setDesechoMeterageDraft('');
                    setDesechoPromptMode('type');
                    setShowDesechoCaptureModal(true);
                  }}
                  className="w-full py-4 rounded-2xl bg-gray-100 text-gray-800 text-[11px] font-black uppercase tracking-wider border border-gray-200"
                >
                  TOMAR FOTO DE NUEVO DESECHO
                </button>

                <button type="button" onClick={() => setDesechoSetChoice(null)} className="w-full py-3 text-[10px] font-black uppercase text-gray-500">
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReserveCaptureModal && reserveCaptureDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[221] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
            <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 max-h-[88vh] overflow-y-auto">
              {reserveCaptureDraft.reserveId === '' ? (
                <>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Reserva de fibra</p>
                    <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-1">Seleccionar reserva</h3>
                    <p className="text-xs text-gray-500 mt-2">
                      Seleccione cuál reserva desea completar. Las reservas terminadas no aparecen aquí.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {Array.from(new Set(
                      evidences
                        .filter(ev => ev.category === 'RESERVA' && ev.reserveId)
                        .map(ev => ev.reserveId as string)
                    ))
                      .map(reserveId => {
                        const reserveEvidences = evidences.filter(ev => ev.category === 'RESERVA' && ev.reserveId === reserveId);
                        const first = reserveEvidences[0];
                        const reserveNumber = Number(first?.reserveNumber || 0);
                        const hasInitial = reserveEvidences.some(ev => ev.reserveSide === 'initial');
                        const hasFinal = reserveEvidences.some(ev => ev.reserveSide === 'final');
                        const hasRoll = reserveEvidences.some(ev => ev.reserveSide === 'roll');
                        const complete = hasInitial && hasFinal && hasRoll;
                        if (complete) return null;

                        const missing = [
                          !hasInitial ? 'INICIAL' : '',
                          !hasFinal ? 'FINAL' : '',
                          !hasRoll ? 'ROLLO' : ''
                        ].filter(Boolean).join(' · ');

                        return (
                          <button
                            key={reserveId}
                            type="button"
                            onClick={() => {
                              const missingSide: 'initial' | 'final' | 'roll' =
                                !hasInitial ? 'initial' : !hasFinal ? 'final' : 'roll';

                              if (missingSide === 'initial') {
                                setReserveCaptureDraft({
                                  side: 'initial',
                                  reserveId,
                                  reserveNumber,
                                  reelNumber: '',
                                  fiberCount: '', metraje: '',
                                });
                                return;
                              }

                              const inheritedReel = getReserveReelNumber(reserveId, reserveNumber);
                              const inheritedFiberCount = getReserveFiberCount(reserveId, reserveNumber);
                              if (!inheritedReel || !inheritedFiberCount) {
                                alert('LA PUNTA INICIAL de esta reserva no tiene registrado el número de carrete y/o el valor de FIBRA ÓPTICA DE.');
                                return;
                              }

                              setReserveCaptureDraft({
                                side: missingSide,
                                reserveId,
                                reserveNumber,
                                reelNumber: inheritedReel,
                                fiberCount: inheritedFiberCount, metraje: '',
});
                            }}
                            className="w-full p-4 rounded-2xl border border-blue-200 bg-blue-50 text-left active:scale-[0.98] transition-transform"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-black uppercase text-gray-950">
                                RESERVA {String(reserveNumber).padStart(2, '0')}
                              </span>
                              <span className="text-[9px] font-black uppercase text-blue-700">
                                {reserveEvidences.length}/3 FOTOS
                              </span>
                            </div>
                            <p className="text-[9px] font-black uppercase text-amber-600 mt-1">
                              FALTA {missing}
                            </p>
                          </button>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const usedNumbers = evidences
                        .filter(ev => ev.category === 'RESERVA' && ev.reserveNumber != null)
                        .map(ev => Number(ev.reserveNumber))
                        .filter(Number.isFinite);
                      const reserveNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : 1;
                      const reserveId = crypto.randomUUID ? crypto.randomUUID() : `reserve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                      setReserveCaptureDraft({ side: 'initial', reserveId, reserveNumber, reelNumber: '', fiberCount: '', metraje: '' });
                    }}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide"
                  >
                    + NUEVA RESERVA
                  </button>

                  <button type="button" onClick={() => { setShowReserveCaptureModal(false); setReserveCaptureDraft(null); }} className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase">
                    Cancelar
                  </button>
                </>
              ) : reserveCaptureDraft.side !== 'initial' ? (
                <>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Reserva de fibra</p>
                    <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-1">
                      RESERVA {String(reserveCaptureDraft.reserveNumber).padStart(2, '0')} · {reserveCaptureDraft.side === 'final' ? 'PUNTA FINAL' : 'ROLLO DETALLADO'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">Los datos se heredan de la PUNTA INICIAL y no se pueden modificar.</p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Número de carrete</label>
                    <input type="text" value={reserveCaptureDraft.reelNumber} readOnly className="w-full rounded-2xl border-2 border-gray-200 bg-gray-100 px-4 py-3 text-lg font-black text-gray-950 outline-none" />
                    <p className="text-[9px] font-bold uppercase text-green-600 mt-1">✓ Carrete heredado de la PUNTA INICIAL</p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Fibra Óptica de:</label>
                    <input type="number" value={reserveCaptureDraft.fiberCount} readOnly className="w-full rounded-2xl border-2 border-gray-200 bg-gray-100 px-4 py-3 text-lg font-black text-gray-950 outline-none" />
                    <p className="text-[9px] font-bold uppercase text-green-600 mt-1">✓ Fibra Óptica de: heredada de la PUNTA INICIAL</p>
                  </div>
                  {reserveCaptureDraft.side === 'final' && (
                    <div>
                      <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Metraje de PUNTA FINAL</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={reserveCaptureDraft.metraje}
                          onChange={(e) => setReserveCaptureDraft(prev => prev ? { ...prev, metraje: e.target.value } : prev)}
                          placeholder="Ej. 8500"
                          className="flex-1 rounded-2xl border-2 border-blue-500 bg-white px-4 py-3 text-lg font-black text-gray-950 outline-none"
                        />
                        <span className="text-sm font-black text-gray-500">M</span>
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={() => {
                    if (reserveCaptureDraft.side === 'final') {
                      const value = Number(reserveCaptureDraft.metraje.replace(',', '.'));
                      if (!Number.isFinite(value) || value < 0) {
                        alert('Ingrese un metraje válido para la PUNTA FINAL.');
                        return;
                      }
                      setReserveCaptureDraft(prev => prev ? { ...prev, metraje: String(value) } : prev);
                    }
                    setShowReserveCaptureModal(false);
                    setCurrentStep('camera');
                  }} className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide">
                    GUARDAR Y ABRIR CÁMARA
                  </button>
                  <button type="button" onClick={() => setReserveCaptureDraft({ side: 'initial', reserveId: '', reserveNumber: 0, reelNumber: '', fiberCount: '', metraje: '' })} className="w-full py-3 rounded-2xl bg-blue-50 text-blue-700 text-[10px] font-black uppercase">
                    CAMBIAR RESERVA
                  </button>
                  <button type="button" onClick={() => { setShowReserveCaptureModal(false); setReserveCaptureDraft(null); }} className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Reserva de fibra</p>
                    <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-1">
                      RESERVA {String(reserveCaptureDraft.reserveNumber).padStart(2, '0')}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">
                      {reserveCaptureDraft.side === 'initial'
                        ? 'Ingrese los datos una sola vez. Se reutilizarán en las 3 fotos de esta reserva.'
                        : (reserveCaptureDraft.side === 'final'
                          ? 'Datos heredados de la PUNTA INICIAL para PUNTA FINAL.'
                          : 'Datos heredados de la PUNTA INICIAL para ROLLO DETALLADO.')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Número de carrete</label>
                    <input
                      type="text"
                      inputMode="text"
                      autoFocus={!reserveCaptureDraft.reelNumber}
                      value={reserveCaptureDraft.reelNumber}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        setReserveCaptureDraft(prev => {
                          if (!prev) return prev;
                          try {
                            if (prev.reserveId && value.trim()) {
                              localStorage.setItem(`fieldtrace_reserve_reel_${prev.reserveId}`, value.trim());
                              localStorage.setItem(`fieldtrace_reserve_reel_number_${prev.reserveNumber}`, value.trim());
                            }
                          } catch {
                            // IndexedDB/evidence remains the source of truth.
                          }
                          return { ...prev, reelNumber: value };
                        });
                      }}
                      readOnly={reserveCaptureDraft.side !== 'initial'}
                      placeholder="Ej. 00125"
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-black text-gray-950 outline-none ${reserveCaptureDraft.side !== 'initial' ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-200 focus:border-blue-600'}`}
                    />
                    <p className="text-[9px] font-bold uppercase text-gray-500 mt-1">
                      {reserveCaptureDraft.side !== 'initial'
                        ? `✓ Carrete heredado de la PUNTA INICIAL: ${reserveCaptureDraft.reelNumber || 'PENDIENTE'}`
                        : (reserveCaptureDraft.reelNumber ? '✓ Este carrete se reutilizará en las 3 fotos de la reserva.' : 'Ingrese el carrete una sola vez; se reutilizará en inicial, final y rollo.')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Fibra Óptica de:</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={reserveCaptureDraft.fiberCount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setReserveCaptureDraft(prev => {
                          if (!prev) return prev;
                          try {
                            if (prev.reserveId && value.trim()) {
                              localStorage.setItem(`fieldtrace_reserve_fiber_count_${prev.reserveId}`, value.trim());
                              if (prev.reserveNumber) {
                                localStorage.setItem(`fieldtrace_reserve_fiber_count_number_${prev.reserveNumber}`, value.trim());
                              }
                            }
                          } catch {}
                          return { ...prev, fiberCount: value };
                        });
                      }}
                      readOnly={reserveCaptureDraft.side !== 'initial'}
                      placeholder="Ej. 12, 24, 48"
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-black text-gray-950 outline-none ${reserveCaptureDraft.side !== 'initial' ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-200 focus:border-blue-600'}`}
                    />
                    <p className="text-[9px] font-bold uppercase text-gray-500 mt-1">
                      {reserveCaptureDraft.side !== 'initial'
                        ? `✓ Fibra Óptica de: heredada de la PUNTA INICIAL: ${reserveCaptureDraft.fiberCount || 'PENDIENTE'}`
                        : (reserveCaptureDraft.fiberCount ? '✓ Se reutilizará en las 3 fotos de la reserva.' : 'Ingrese una sola vez la cantidad de fibras; se reutilizará en inicial, final y rollo.')}
                    </p>
                  </div>

                  {reserveCaptureDraft.side === 'initial' && (
                    <div>
                      <label className="block text-[9px] font-black uppercase text-gray-500 mb-2">Metraje de PUNTA INICIAL</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={reserveCaptureDraft.metraje}
                          onChange={(e) => setReserveCaptureDraft(prev => prev ? { ...prev, metraje: e.target.value } : prev)}
                          placeholder="Ej. 3000"
                          className="flex-1 rounded-2xl border-2 border-blue-500 bg-white px-4 py-3 text-lg font-black text-gray-950 outline-none"
                        />
                        <span className="text-sm font-black text-gray-500">M</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      disabled={reserveHasSide(reserveCaptureDraft.reserveId, 'initial') || !reserveCaptureDraft.reelNumber.trim() || !reserveCaptureDraft.fiberCount.trim() || !reserveCaptureDraft.metraje.trim()}
                      onClick={() => openReserveSide('initial', reserveCaptureDraft.reserveId, reserveCaptureDraft.metraje)}
                      className="w-full py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {reserveHasSide(reserveCaptureDraft.reserveId, 'initial') ? 'Punta inicial ✓' : 'Punta inicial'}
                    </button>
                    <button
                      type="button"
                      disabled={reserveHasSide(reserveCaptureDraft.reserveId, 'final') || !reserveCaptureDraft.reelNumber.trim() || !reserveCaptureDraft.fiberCount.trim()}
                      onClick={() => openReserveSide('final', reserveCaptureDraft.reserveId)}
                      className="w-full py-4 rounded-2xl bg-white border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-wide disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400"
                    >
                      {reserveHasSide(reserveCaptureDraft.reserveId, 'final') ? 'Punta final ✓' : 'Punta final'}
                    </button>
                    <button
                      type="button"
                      disabled={reserveHasSide(reserveCaptureDraft.reserveId, 'roll') || !reserveCaptureDraft.reelNumber.trim() || !reserveCaptureDraft.fiberCount.trim()}
                      onClick={() => openReserveSide('roll', reserveCaptureDraft.reserveId)}
                      className="w-full py-4 rounded-2xl bg-white border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-wide disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400"
                    >
                      {reserveHasSide(reserveCaptureDraft.reserveId, 'roll') ? 'Rollo detallado ✓' : 'Rollo detallado'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReserveCaptureDraft({ side: 'initial', reserveId: '', reserveNumber: 0, reelNumber: '', fiberCount: '', metraje: '' })}
                    className="w-full py-3 rounded-2xl bg-blue-50 text-blue-700 text-[10px] font-black uppercase"
                  >
                    Cambiar reserva
                  </button>

                  <button type="button" onClick={() => { setShowReserveCaptureModal(false); setReserveCaptureDraft(null); }} className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 text-[10px] font-black uppercase">
                    Cancelar
                  </button>
                </>              )}
            </motion.div>
          </motion.div>
        )}

        {showCloudProjects && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5">
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-xl max-h-[88vh] bg-white rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Proyectos compartidos</h2>
                  <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Proyectos disponibles en Firebase</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCloudProjects(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    value={cloudSearchTerm}
                    onChange={e => setCloudSearchTerm(e.target.value)}
                    placeholder="BUSCAR PROYECTO O CLIENTE..."
                    className="flex-1 bg-transparent outline-none text-xs font-black uppercase"
                  />
                  {cloudSearchTerm && (
                    <button type="button" onClick={() => setCloudSearchTerm('')}>
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cloudProjectsLoading ? (
                  <div className="py-16 text-center">
                    <RefreshCcw className="w-7 h-7 mx-auto text-blue-500 animate-spin mb-3" />
                    <p className="text-[10px] font-black uppercase text-gray-400">Cargando desde Firebase...</p>
                  </div>
                ) : cloudProjects.filter((p: any) => {
                  const term = cloudSearchTerm.toLowerCase().trim();
                  if (!term) return true;
                  return String(p.name || '').toLowerCase().includes(term) ||
                    String(p.client || '').toLowerCase().includes(term) ||
                    String(p.techName || '').toLowerCase().includes(term);
                }).length === 0 ? (
                  <div className="py-16 text-center">
                    <CloudUpload className="w-9 h-9 mx-auto text-gray-300 mb-3" />
                    <p className="text-[11px] font-black uppercase text-gray-500">No hay proyectos compartidos</p>
                  </div>
                ) : (
                  cloudProjects
                    .filter((p: any) => {
                      const term = cloudSearchTerm.toLowerCase().trim();
                      if (!term) return true;
                      return String(p.name || '').toLowerCase().includes(term) ||
                        String(p.client || '').toLowerCase().includes(term) ||
                        String(p.techName || '').toLowerCase().includes(term);
                    })
                    .map((p: any) => {
                      const uuid = String(p.uuid || p.id);
                      const importing = cloudImportingUuid === uuid;
                      return (
                        <div
                          key={uuid}
                          className="w-full p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between text-left shadow-sm"
                        >
                          <button
                            type="button"
                            disabled={!!cloudImportingUuid || cloudDeleteRunning}
                            onClick={() => { void importAndOpenCloudProject(p); }}
                            className="min-w-0 flex-1 text-left active:scale-[0.99] disabled:opacity-60"
                          >
                            <div className="min-w-0 pr-3">
                              <p className="text-[13px] font-black uppercase text-gray-950 truncate">{p.name || 'Proyecto sin nombre'}</p>
                              <p className="text-[9px] font-bold uppercase text-gray-400 truncate">{p.client || 'Sin cliente'}</p>
                              <p className="text-[8px] font-bold uppercase text-gray-300 mt-1">Actualizado: {p.updatedAt ? new Date(p.updatedAt).toLocaleString('es-CR') : '—'}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {importing ? (
                              <RefreshCcw className="w-5 h-5 text-blue-600 animate-spin" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-blue-600" />
                            )}
                            <button
                              type="button"
                              disabled={!!cloudImportingUuid || cloudDeleteRunning}
                              onClick={(e) => { e.stopPropagation(); requestDeleteCloudProject(p); }}
                              className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 active:scale-95 disabled:opacity-50"
                              title="Eliminar proyecto compartido"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {cloudDeleteStep === 1 && pendingCloudDeleteProject && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight text-gray-950">¿Eliminar proyecto compartido?</h3>
              <p className="text-sm text-gray-600">Se eliminará <span className="font-bold text-gray-900">{pendingCloudDeleteProject.name}</span> de Firebase junto con todos sus registros y fotografías almacenadas en la nube.</p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setCloudDeleteStep(0); setPendingCloudDeleteProject(null); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => setCloudDeleteStep(2)} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {cloudDeleteStep === 2 && pendingCloudDeleteProject && (
          <motion.div initial={{ opacity: 0.95 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[221] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border-2 border-red-200">
              <h3 className="text-base font-black uppercase tracking-tight text-red-700">Confirmación final</h3>
              <p className="text-sm text-gray-600">Esta acción <span className="font-bold text-red-600">no se puede deshacer</span>. Se eliminarán definitivamente el proyecto, sus evidencias y sus fotografías de Firebase.</p>
              <div className="flex gap-3 pt-1">
                <button type="button" disabled={cloudDeleteRunning} onClick={() => { setCloudDeleteStep(0); setPendingCloudDeleteProject(null); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider disabled:opacity-50">Cancelar</button>
                <button type="button" disabled={cloudDeleteRunning} onClick={() => { void executeDeleteCloudProject(); }} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider disabled:opacity-60">{cloudDeleteRunning ? 'Eliminando...' : 'Sí, eliminar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showStorageEvidenceViewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[185] bg-black/80 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
              <div>                <h2 className="text-sm font-black uppercase tracking-tight text-gray-950">
                  {storageEvidenceCategory
                    ? EVIDENCE_CATEGORIES.find(c => c.id === storageEvidenceCategory)?.label || 'Evidencias'
                    : 'Evidencias para Excel'}
                </h2>
                <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Fotografías confirmadas en Firebase Storage</p>
              </div>
              <button type="button" onClick={() => { setShowStorageEvidenceViewer(false); setStorageEvidenceCategory(null); }} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cerrar</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {evidences.filter((ev: any) => {
                if (!ev.photoUrl) return false;
                if (!storageEvidenceCategory) return true;
                if (storageEvidenceCategory === 'PUNTAS_FIBRA') {
                  return ev.category === 'PUNTAS_FIBRA_INICIAL' || ev.category === 'PUNTAS_FIBRA_FINAL';
                }
                return ev.category === storageEvidenceCategory;
              }).length === 0 ? (
                <div className="py-20 text-center">
                  <CloudUpload className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-[11px] font-black uppercase text-gray-500">No hay fotografías en Storage todavía</p>
                  <p className="text-[9px] font-bold text-gray-400 mt-2">Toma una fotografía y espera a que termine la subida.</p>
                </div>
              ) : (
                <div className={
                  storageEvidenceCategory === 'RESERVA' || storageEvidenceCategory === 'NAPS' || storageEvidenceCategory === 'MUFA' || storageEvidenceCategory === 'ALTAS' || storageEvidenceCategory === 'PUNTAS_FIBRA' || storageEvidenceCategory === 'ACEROS' || storageEvidenceCategory === 'DESECHOS' || storageEvidenceCategory === 'MEJORAS'
                    ? "space-y-5 pb-8"
                    : "grid grid-cols-2 gap-3 pb-8"
                }>
                  {storageEvidenceCategory === 'NAPS' ? (() => {
                    const napPhotos = evidences
                      .filter((ev: any) => !!ev.photoUrl && ev.category === 'NAPS' && ev.napId)
                      .sort((a: any, b: any) => {
                        const numberDiff = Number(a.napNumber || 0) - Number(b.napNumber || 0);
                        if (numberDiff !== 0) return numberDiff;
                        return Number(a.napPhotoNumber || 0) - Number(b.napPhotoNumber || 0);
                      });

                    const groups = Array.from(
                      napPhotos.reduce((map: Map<string, any[]>, ev: any) => {
                        const key = ev.napId || `legacy-nap-${ev.napNumber || ev.id || ev.uuid}`;
                        if (!map.has(key)) map.set(key, []);
                        map.get(key)!.push(ev);
                        return map;
                      }, new Map<string, any[]>()).values()
                    );

                    return groups.map((group: any[], groupIndex: number) => {
                      const napNumber = Number(group[0]?.napNumber || groupIndex + 1);
                      const napName = group[0]?.napName || 'SIN NOMBRE';

                      return (
                        <div key={group[0]?.napId || `nap-group-${napNumber}`} className="bg-white rounded-3xl border border-blue-100 shadow-sm p-3">
                          <div className="flex items-center justify-between gap-3 px-1 pb-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                                NAP {String(napNumber).padStart(2, '0')} · {napName}
                              </p>
                              <p className="text-[8px] font-bold uppercase text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">
                                {group.length}/9 FOTOS · GRUPO INDEPENDIENTE
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 lg:gap-2.5">
                            {Array.from({ length: 9 }, (_, slotIndex) => {
                              const photoNumber = slotIndex + 1;
                              const ev = group.find((item: any) => Number(item.napPhotoNumber) === photoNumber);

                              if (ev) {
                                return (
                                  <button
                                    key={ev.id || ev.uuid || `nap-photo-${photoNumber}`}
                                    type="button"
                                    onClick={() => setViewingEvidence(ev)}
                                    className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm text-left active:scale-[0.98] transition-transform"
                                  >
                                    <div className="aspect-[4/5] bg-black overflow-hidden">
                                      <img
                                        src={ev.photoUrl}
                                        alt={ev.napName || 'NAP'}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>
                                    <div className="p-2.5 lg:p-2">
                                      <p className="text-[9px] font-black uppercase text-gray-900 lg:text-[10px] lg:leading-tight">
                                        {getNapsPhotoTitle(photoNumber)}
                                      </p>
                                      <p className="text-[8px] font-bold uppercase text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">
                                        NAP{(ev.napName || napName) ? ` · ${String(ev.napName || napName).toUpperCase()}` : ''}
                                      </p>
                                      <p className="text-[8px] font-bold text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">
                                        {ev.fecha} {ev.hora || ''}
                                      </p>
                                    </div>
                                  </button>
                                );
                              }

                              return (
                                <div
                                  key={`nap-missing-${photoNumber}`}
                                  className="min-h-[240px] lg:min-h-[170px] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 flex flex-col items-center justify-center gap-2 text-blue-700 p-3"
                                >
                                  <CameraIcon className="w-8 h-8" />
                                  <span className="text-[9px] font-black uppercase text-center px-2">
                                    FALTA FOTO<br />{getNapsPhotoTitle(photoNumber)} NAP
                                  </span>
                                  <button
                                    type="button"
                                    disabled={memoryUploadLoading}
                                    onClick={() => uploadMissingMemoryPhoto({
                                      category: 'NAPS',
                                      napId: group[0]?.napId || '',
                                      napNumber: Number(group[0]?.napNumber || groupIndex + 1),
                                      napName: group[0]?.napName || '',
                                      photoNumber
                                    })}
                                    className="w-full px-2 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-[8px] font-black uppercase active:scale-95 disabled:opacity-50"
                                  >
                                    {memoryUploadLoading ? 'SUBIENDO...' : 'SUBIR FOTO DESDE EL TELÉFONO'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const napId = group[0]?.napId || '';
                                      const napNumber = Number(group[0]?.napNumber || groupIndex + 1);
                                      const napName = group[0]?.napName || '';
                                      setViewingEvidence(null);
                                      setShowStorageEvidenceViewer(false);
                                      setStorageEvidenceCategory(null);
                                      setEvidenceCategory('NAPS');
                                      setNapCaptureDraft({ napId, napNumber, napName, photoNumber, remainingPhotos: 1 });
                                      setShowNapCaptureModal(false);
                                      setCurrentStep('camera');
                                    }}
                                    className="w-full px-2 py-2 rounded-xl bg-blue-600 text-white text-[8px] font-black uppercase active:scale-95"
                                  >
                                    TOMAR FOTO
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })() : storageEvidenceCategory === 'ALTAS' ? (() => {
                    const altaPhotos = evidences                      .filter((ev: any) => !!ev.photoUrl && ev.category === 'ALTAS' && ev.altaId)
                      .sort((a: any, b: any) => {
                        const numberDiff = Number(a.altaNumber || 0) - Number(b.altaNumber || 0);
                        if (numberDiff !== 0) return numberDiff;
                        const sideOrder: Record<string, number> = { panoramic: 1, meterage: 2 };
                        return (sideOrder[a.altaSide || ''] || 99) - (sideOrder[b.altaSide || ''] || 99);
                      });
                    const groups = Array.from(
                      altaPhotos.reduce((map: Map<string, any[]>, ev: any) => {
                        const key = ev.altaId || `legacy-alta-${ev.altaNumber || ev.id || ev.uuid}`;
                        if (!map.has(key)) map.set(key, []);
                        map.get(key)!.push(ev);
                        return map;                      }, new Map<string, any[]>()).values()
                    );

                    return groups.map((group: any[], groupIndex: number) => {
                      const altaNumber = Number(group[0]?.altaNumber || groupIndex + 1);
                      const altaType = group[0]?.altaType || 'ALTA';
                      const altaId = group[0]?.altaId || '';
                      const hasPanoramic = group.some(ev => ev.altaSide === 'panoramic');
                      const hasMeterage = group.some(ev => ev.altaSide === 'meterage');
                      const missingSide: 'panoramic' | 'meterage' | null =
                        !hasPanoramic ? 'panoramic' : !hasMeterage ? 'meterage' : null;

                      return (
                        <div key={altaId || `alta-group-${altaNumber}`} className="bg-white rounded-3xl border border-blue-100 shadow-sm p-3">
                          <div className="flex items-center justify-between gap-3 px-1 pb-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                                ALTA {String(altaNumber).padStart(2, '0')}
                              </p>
                              <p className="text-[8px] font-bold uppercase text-gray-500 mt-1">{altaType}</p>
                              <p className={"text-[8px] font-bold uppercase mt-1 " + (missingSide ? 'text-amber-600' : 'text-gray-400')}>
                                {missingSide
                                  ? group.length + '/2 FOTOS · FALTA ' + (missingSide === 'panoramic' ? 'PANORÁMICA' : 'METRAJE')
                                  : '2/2 FOTOS · SET COMPLETO'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 lg:gap-2.5">
                            {group.map((ev: any, index: number) => (
                              <button
                                key={ev.id || ev.uuid || index}
                                type="button"
                                onClick={() => setViewingEvidence(ev)}
                                className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm text-left active:scale-[0.98] transition-transform"
                              >
                                <div className="aspect-[4/5] bg-black overflow-hidden">
                                  <img src={ev.photoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </div>
                                <div className="p-2.5 lg:p-2">
                                  <p className="text-[9px] font-black uppercase text-gray-900 lg:text-[10px] lg:leading-tight">
                                    {ev.altaSide === 'panoramic' ? 'PANORÁMICA' : 'METRAJE'}
                                  </p>
                                  <p className="text-[8px] font-bold text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">{ev.fecha} {ev.hora || ''}</p>
                                </div>
                              </button>
                            ))}

                            {missingSide && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingEvidence(null);
                                  setShowStorageEvidenceViewer(false);
                                  setStorageEvidenceCategory(null);
                                  setEvidenceCategory('ALTAS');
                                  setAltaMeterageDraft('');
                                  setAltaReelDraft('');
                                  setAltaFiberCountDraft('');
                                  setAltaCaptureDraft({
                                    altaId,
                                    altaNumber,
                                    altaType,
                                    side: missingSide
                                  });

                                  // Al completar desde VER FOTOS, la foto faltante
                                  // debe conservar exactamente su lado. No reutilizar
                                  // el estado anterior del modal (por ejemplo METRAJE).
                                  if (missingSide === 'panoramic') {
                                    setAltaPromptMode(null);
                                    setShowAltaCaptureModal(false);
                                    setCurrentStep('camera');
                                  } else {
                                    setAltaPromptMode('meterage');
                                    setShowAltaCaptureModal(true);
                                  }
                                }}
                                className="aspect-[4/5] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 flex flex-col items-center justify-center gap-2 text-blue-700 active:scale-[0.98] transition-transform"
                              >
                                <CameraIcon className="w-8 h-8" />
                                <span className="text-[9px] font-black uppercase text-center px-2">
                                  TOMAR FOTO<br />{missingSide === 'panoramic' ? 'PANORÁMICA' : 'METRAJE'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })() : storageEvidenceCategory === 'ACEROS' ? (() => {
                    const aceroPhotos = evidences
                      .filter((ev: any) => !!ev.photoUrl && ev.category === 'ACEROS' && ev.aceroId)
                      .sort((a: any, b: any) => {
                        const numberDiff = Number(a.aceroNumber || 0) - Number(b.aceroNumber || 0);
                        if (numberDiff !== 0) return numberDiff;
                        const sideOrder: Record<string, number> = { photo1: 1, photo2: 2 };
                        return (sideOrder[a.aceroSide || ''] || 99) - (sideOrder[b.aceroSide || ''] || 99);
                      });

                    const groups = Array.from(
                      aceroPhotos.reduce((map: Map<string, any[]>, ev: any) => {
                        const key = ev.aceroId || `legacy-acero-${ev.aceroNumber || ev.id || ev.uuid}`;
                        if (!map.has(key)) map.set(key, []);
                        map.get(key)!.push(ev);
                        return map;
                      }, new Map<string, any[]>()).values()
                    );

                    return groups.map((group: any[], groupIndex: number) => {
                      const aceroNumber = Number(group[0]?.aceroNumber || groupIndex + 1);
                      const aceroId = group[0]?.aceroId || '';
                      const hasPhoto1 = group.some(ev => ev.aceroSide === 'photo1');
                      const hasPhoto2 = group.some(ev => ev.aceroSide === 'photo2');
                      const missingSide: 'photo1' | 'photo2' | null =
                        !hasPhoto1 ? 'photo1' : !hasPhoto2 ? 'photo2' : null;

                      return (
                        <div key={aceroId || `acero-group-${aceroNumber}`} className="bg-white rounded-3xl border border-blue-100 shadow-sm p-3">
                          <div className="flex items-center justify-between gap-3 px-1 pb-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                                ACERO {String(aceroNumber).padStart(2, '0')}
                              </p>
                              <p className={"text-[8px] font-bold uppercase mt-1 " + (missingSide ? 'text-amber-600' : 'text-gray-400')}>
                                {missingSide
                                  ? group.length + '/2 FOTOS · FALTA ' + (missingSide === 'photo1' ? 'FOTO 1' : 'FOTO 2')
                                  : '2/2 FOTOS · SET COMPLETO'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 lg:gap-2.5">
                            {group.map((ev: any, index: number) => (
                              <button key={ev.id || ev.uuid || index} type="button" onClick={() => setViewingEvidence(ev)} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm text-left active:scale-[0.98] transition-transform">
                                <div className="aspect-[4/5] bg-black overflow-hidden">
                                  <img src={ev.photoUrl} alt="Acero" className="w-full h-full object-cover" loading="lazy" />
                                </div>
                                <div className="p-2.5 lg:p-2">
                                  <p className="text-[9px] font-black uppercase text-gray-900 lg:text-[10px] lg:leading-tight">
                                    {ev.aceroSide === 'photo1' ? 'PANORÁMICA' : 'METRAJE'}
                                  </p>
                                  <p className="text-[8px] font-bold text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">{ev.fecha} {ev.hora || ''}</p>
                                </div>
                              </button>
                            ))}

                            {missingSide && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingEvidence(null);
                                  setShowStorageEvidenceViewer(false);
                                  setStorageEvidenceCategory(null);
                                  setEvidenceCategory('ACEROS');
                                  setAceroCaptureDraft({
                                    aceroId,
                                    aceroNumber,
                                    side: missingSide
                                  });
                                  setCurrentStep('camera');
                                }}
                                className="aspect-[4/5] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 flex flex-col items-center justify-center gap-2 text-blue-700 active:scale-[0.98] transition-transform"
                              >
                                <CameraIcon className="w-8 h-8" />
                                <span className="text-[9px] font-black uppercase text-center px-2">
                                  TOMAR FOTO<br />{missingSide === 'photo1' ? 'PANORÁMICA' : 'METRAJE'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })() : storageEvidenceCategory === 'DESECHOS' ? (() => {
                    const desechoPhotos = evidences
                      .filter((ev: any) => !!ev.photoUrl && ev.category === 'DESECHOS' && ev.desechoId)
                      .sort((a: any, b: any) => {
                        const numberDiff = Number(a.desechoNumber || 0) - Number(b.desechoNumber || 0);
                        if (numberDiff !== 0) return numberDiff;
                        const sideOrder: Record<string, number> = { photo1: 1, photo2: 2 };
                        return (sideOrder[a.desechoSide || ''] || 99) - (sideOrder[b.desechoSide || ''] || 99);
                      });

                    const groups = Array.from(
                      desechoPhotos.reduce((map: Map<string, any[]>, ev: any) => {
                        const key = ev.desechoId || `legacy-desecho-${ev.desechoNumber || ev.id || ev.uuid}`;
                        if (!map.has(key)) map.set(key, []);
                        map.get(key)!.push(ev);
                        return map;
                      }, new Map<string, any[]>()).values()
                    );

                    return groups.map((group: any[], groupIndex: number) => {
                      const desechoNumber = Number(group[0]?.desechoNumber || groupIndex + 1);
                      const desechoId = group[0]?.desechoId || '';
                      const hasPhoto1 = group.some(ev => ev.desechoSide === 'photo1');
                      const hasPhoto2 = group.some(ev => ev.desechoSide === 'photo2');
                      const missingSide: 'photo1' | 'photo2' | null =
                        !hasPhoto1 ? 'photo1' : !hasPhoto2 ? 'photo2' : null;

                      return (
                        <div key={desechoId || `desecho-group-${desechoNumber}`} className="bg-white rounded-3xl border border-blue-100 shadow-sm p-3">
                          <div className="flex items-center justify-between gap-3 px-1 pb-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                                DESECHO {String(desechoNumber).padStart(2, '0')}                              </p>
                              <p className={"text-[8px] font-bold uppercase mt-1 " + (missingSide ? 'text-amber-600' : 'text-gray-400')}>
                                {missingSide
                                  ? group.length + '/2 FOTOS · FALTA ' + (missingSide === 'photo1' ? 'PANORÁMICA' : 'METRAJE')
                                  : '2/2 FOTOS · SET COMPLETO'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 lg:gap-2.5">
                            {group.map((ev: any, index: number) => (
                              <button key={ev.id || ev.uuid || index} type="button" onClick={() => setViewingEvidence(ev)} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm text-left active:scale-[0.98] transition-transform">
                                <div className="aspect-[4/5] bg-black overflow-hidden">
                                  <img src={ev.photoUrl} alt="Desecho" className="w-full h-full object-cover" loading="lazy" />
                                </div>
                                <div className="p-2.5 lg:p-2">
                                  <p className="text-[9px] font-black uppercase text-gray-900 lg:text-[10px] lg:leading-tight">
                                    {ev.desechoSide === 'photo1' ? 'PANORÁMICA' : 'METRAJE'}
                                  </p>
                                  <p className="text-[8px] font-bold text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">{ev.fecha} {ev.hora || ''}</p>
                                </div>
                              </button>
                            ))}

                            {missingSide && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingEvidence(null);
                                  setShowStorageEvidenceViewer(false);
                                  setStorageEvidenceCategory(null);
                                  setEvidenceCategory('DESECHOS');
                                  setDesechoCaptureDraft({
                                    desechoId,
                                    desechoNumber,
                                    side: missingSide
                                  });
                                  setDesechoMeterageDraft('');
                                  if (missingSide === 'photo2') {
                                    setDesechoPromptMode('meterage');
                                    setShowDesechoCaptureModal(true);
                                  } else {
                                    setDesechoPromptMode(null);
                                    setCurrentStep('camera');
                                  }
                                }}
                                className="aspect-[4/5] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 flex flex-col items-center justify-center gap-2 text-blue-700 active:scale-[0.98] transition-transform"
                              >
                                <CameraIcon className="w-8 h-8" />
                                <span className="text-[9px] font-black uppercase text-center px-2">
                                  TOMAR FOTO<br />{missingSide === 'photo1' ? 'PANORÁMICA' : 'METRAJE'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })() : storageEvidenceCategory === 'MEJORAS' ? (() => {
                    const mejoraPhotos = evidences
                      .filter((ev: any) => !!ev.photoUrl && ev.category === 'MEJORAS' && ev.mejoraId)
                      .sort((a: any, b: any) => {
                        const numberDiff = Number(a.mejoraNumber || 0) - Number(b.mejoraNumber || 0);
                        if (numberDiff !== 0) return numberDiff;
                        const sideOrder: Record<string, number> = { before: 1, after: 2 };
                        return (sideOrder[a.mejoraSide || ''] || 99) - (sideOrder[b.mejoraSide || ''] || 99);
                      });

                    const groups = Array.from(
                      mejoraPhotos.reduce((map: Map<string, any[]>, ev: any) => {
                        const key = ev.mejoraId || `legacy-mejora-${ev.mejoraNumber || ev.id || ev.uuid}`;
                        if (!map.has(key)) map.set(key, []);
                        map.get(key)!.push(ev);
                        return map;
                      }, new Map<string, any[]>()).values()
                    );

                    const getMejoraLabel = (type: string) =>
                      type === 'SUBIDA DE BANDAS' ? 'SUBIDA DE BANDA'
                      : type === 'PODAS' ? 'PODA'
                      : type === 'SUBIDA DE RETENIDAS' ? 'SUBIDA DE RETENIDA'
                      : type;

                    return groups.map((group: any[], groupIndex: number) => {
                      const mejoraNumber = Number(group[0]?.mejoraNumber || groupIndex + 1);
                      const mejoraId = group[0]?.mejoraId || '';
                      const mejoraType = group[0]?.mejoraType || 'MEJORA';
                      const hasBefore = group.some(ev => ev.mejoraSide === 'before');
                      const hasAfter = group.some(ev => ev.mejoraSide === 'after');
                      const missingSide: 'before' | 'after' | null =
                        !hasBefore ? 'before' : !hasAfter ? 'after' : null;

                      return (
                        <div key={mejoraId || `mejora-group-${mejoraNumber}`} className="bg-white rounded-3xl border border-blue-100 shadow-sm p-3">
                          <div className="flex items-center justify-between gap-3 px-1 pb-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                                {getMejoraLabel(mejoraType)} {String(mejoraNumber).padStart(2, '0')}
                              </p>
                              <p className={"text-[8px] font-bold uppercase mt-1 " + (missingSide ? 'text-amber-600' : 'text-gray-400')}>
                                {missingSide
                                  ? group.length + '/2 FOTOS · FALTA ' + (missingSide === 'before' ? 'ANTES' : 'DESPUÉS')
                                  : '2/2 FOTOS · SET COMPLETO'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 lg:gap-2.5">
                            {group.map((ev: any, index: number) => (
                              <button key={ev.id || ev.uuid || index} type="button" onClick={() => setViewingEvidence(ev)} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm text-left active:scale-[0.98] transition-transform">
                                <div className="aspect-[4/5] bg-black overflow-hidden">
                                  <img src={ev.photoUrl} alt="Mejora" className="w-full h-full object-cover" loading="lazy" />
                                </div>
                                <div className="p-2.5 lg:p-2">
                                  <p className="text-[9px] font-black uppercase text-gray-900 lg:text-[10px] lg:leading-tight">
                                    {getMejoraLabel(ev.mejoraType || mejoraType)} · {ev.mejoraSide === 'before' ? 'ANTES' : 'DESPUÉS'}
                                  </p>
                                  <p className="text-[8px] font-bold text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">{ev.fecha} {ev.hora || ''}</p>
                                </div>
                              </button>
                            ))}

                            {missingSide && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingEvidence(null);
                                  setShowStorageEvidenceViewer(false);
                                  setStorageEvidenceCategory(null);
                                  setEvidenceCategory('MEJORAS');
                                  setMejoraCaptureDraft({
                                    mejoraId,
                                    mejoraNumber,
                                    mejoraType,
                                    side: missingSide
                                  });
                                  setCurrentStep('camera');
                                }}
                                className="aspect-[4/5] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 flex flex-col items-center justify-center gap-2 text-blue-700 active:scale-[0.98] transition-transform"
                              >
                                <CameraIcon className="w-8 h-8" />
                                <span className="text-[9px] font-black uppercase text-center px-2">                                  TOMAR FOTO<br />{missingSide === 'before' ? 'ANTES' : 'DESPUÉS'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })() : storageEvidenceCategory === 'PUNTAS_FIBRA' ? (() => {
                    const fiberPhotos = evidences
                      .filter((ev: any) =>
                        !!ev.photoUrl &&
                        (ev.category === 'PUNTAS_FIBRA_INICIAL' || ev.category === 'PUNTAS_FIBRA_FINAL') &&
                        ev.fiberPairId
                      )
                      .sort((a: any, b: any) => {
                        const numberDiff = Number(a.fiberPairNumber || 0) - Number(b.fiberPairNumber || 0);
                        if (numberDiff !== 0) return numberDiff;
                        const sideOrder: Record<string, number> = { initial: 1, final: 2 };
                        return (sideOrder[a.fiberSide || ''] || 99) - (sideOrder[b.fiberSide || ''] || 99);
                      });

                    const groups = Array.from(
                      fiberPhotos.reduce((map: Map<string, any[]>, ev: any) => {
                        const key = ev.fiberPairId || `legacy-fiber-${ev.fiberPairNumber || ev.id || ev.uuid}`;
                        if (!map.has(key)) map.set(key, []);
                        map.get(key)!.push(ev);
                        return map;
                      }, new Map<string, any[]>()).values()
                    );

                    return groups.map((group: any[], groupIndex: number) => {
                      const pairNumber = Number(group[0]?.fiberPairNumber || groupIndex + 1);
                      const pairId = group[0]?.fiberPairId || '';
                      const initial = group.find(ev => ev.fiberSide === 'initial');
                      const final = group.find(ev => ev.fiberSide === 'final');
                      const missingSide: 'initial' | 'final' | null =
                        !initial ? 'initial' : !final ? 'final' : null;
                      const first = initial || final;
                      const fiberCount = first?.fiberCount != null && String(first.fiberCount).trim() !== ''
                        ? String(first.fiberCount)
                        : '';
                      const reelNumber = first?.fiberReelNumber || '';

                      const renderPhoto = (ev: any, side: 'initial' | 'final') => {
                        if (ev) {
                          return (
                            <button
                              key={ev.id || ev.uuid || `fiber-${pairNumber}-${side}`}
                              type="button"
                              onClick={() => setViewingEvidence(ev)}
                              className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm text-left active:scale-[0.98] transition-transform"
                            >
                              <div className="aspect-[4/5] bg-black overflow-hidden">
                                <img
                                  src={ev.photoUrl}
                                  alt={side === 'initial' ? 'Punta inicial' : 'Punta final'}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <div className="p-2.5 lg:p-2">
                                <p className="text-[9px] font-black uppercase text-gray-900 lg:text-[10px] lg:leading-tight">
                                  {side === 'initial' ? 'PUNTA INICIAL' : 'PUNTA FINAL'}
                                </p>
                                <p className="text-[8px] font-bold text-gray-500 mt-1">
                                  {ev.fiberMeterage != null ? `METRAJE: ${ev.fiberMeterage} M` : 'METRAJE NO REGISTRADO'}
                                </p>
                                <p className="text-[8px] font-bold text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">
                                  {ev.fecha} {ev.hora || ''}
                                </p>
                              </div>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={`fiber-missing-${pairNumber}-${side}`}
                            type="button"
                            onClick={() => {
                              setViewingEvidence(null);
                              setShowStorageEvidenceViewer(false);
                              setStorageEvidenceCategory(null);
                              setEvidenceCategory('PUNTAS_FIBRA');
                              openFiberSide(side, pairId);
                            }}
                            className="aspect-[4/5] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 flex flex-col items-center justify-center gap-2 text-blue-700 active:scale-[0.98] transition-transform"
                          >
                            <CameraIcon className="w-8 h-8" />
                            <span className="text-[9px] font-black uppercase text-center px-2">
                              TOMAR FOTO<br />{side === 'initial' ? 'PUNTA INICIAL' : 'PUNTA FINAL'}
                            </span>
                          </button>
                        );
                      };

                      return (
                        <div key={pairId || `fiber-group-${pairNumber}`} className="bg-white rounded-3xl border border-blue-100 shadow-sm p-3">
                          <div className="flex items-center justify-between gap-3 px-1 pb-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                                PUNTA {String(pairNumber).padStart(2, '0')}
                              </p>
                              <p className={"text-[8px] font-bold uppercase mt-1 " + (missingSide ? 'text-amber-600' : 'text-gray-400')}>
                                {missingSide
                                  ? group.length + '/2 FOTOS · FALTA ' + (missingSide === 'initial' ? 'PUNTA INICIAL' : 'PUNTA FINAL')
                                  : '2/2 FOTOS · SET COMPLETO'}
                              </p>
                            </div>
                            <div className="text-right">
                              {fiberCount && (
                                <p className="text-[8px] font-black uppercase text-gray-500">{fiberCount} HILOS</p>
                              )}
                              {reelNumber && (
                                <p className="text-[8px] font-black uppercase text-gray-500">CARRETE: {reelNumber}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 lg:gap-2.5">
                            {renderPhoto(initial, 'initial')}
                            {renderPhoto(final, 'final')}
                          </div>
                        </div>
                      );
                    });
                  })() : storageEvidenceCategory === 'MUFA' ? (() => {
                    const mufaPhotos = evidences
                      .filter((ev: any) => !!ev.photoUrl && ev.category === 'MUFA')
                      .sort((a: any, b: any) => {
                        const numberDiff = Number(a.mufaNumber || 0) - Number(b.mufaNumber || 0);
                        if (numberDiff !== 0) return numberDiff;
                        return Number(a.mufaPhotoNumber || a.photoNumber || 0) - Number(b.mufaPhotoNumber || b.photoNumber || 0);
                      });

                    const groups = Array.from(
                      mufaPhotos.reduce((map: Map<string, any[]>, ev: any) => {
                        const mufaNumber = Number(ev.mufaNumber || 0);
                        const mufaName = String(ev.mufaName || '').trim().toUpperCase();
                        const isLegacyPlaceholder = mufaNumber === 0 && (!mufaName || mufaName === 'MUFA');
                        const key = isLegacyPlaceholder
                          ? 'mufa_legacy_placeholder'
                          : (ev.mufaId || 'mufa_' + mufaNumber + '_' + mufaName);
                        if (!map.has(key)) map.set(key, []);
                        map.get(key)!.push(ev);
                        return map;
                      }, new Map<string, any[]>()).values()
                    );

                    return groups.map((group: any[], groupIndex: number) => {
                      const storedMufaNumber = Number(group[0]?.mufaNumber || 0);
                      const mufaNumber = storedMufaNumber > 0 ? storedMufaNumber : groupIndex + 1;
                      const storedMufaName = String(group[0]?.mufaName || '').trim();
                      const mufaName = storedMufaName && storedMufaName.toUpperCase() !== 'MUFA' ? storedMufaName : '';

                      return (
                        <div key={group[0]?.mufaId || `mufa-group-${mufaNumber}`} className="bg-white rounded-3xl border border-blue-100 shadow-sm p-3">
                          <div className="flex items-center justify-between gap-3 px-1 pb-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                                MUFA {String(mufaNumber).padStart(2, '0')}{mufaName ? ' · ' + mufaName : ''}
                              </p>
                              <p className="text-[8px] font-bold uppercase text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">
                                {group.length}/9 FOTOS · GRUPO INDEPENDIENTE
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 lg:gap-2.5">
                            {Array.from({ length: 9 }, (_, slotIndex) => {
                              const photoNumber = slotIndex + 1;
                              const ev = group.find((item: any) => Number(item.mufaPhotoNumber ?? item.photoNumber) === photoNumber)
                                || group[slotIndex];

                              if (ev) {
                                return (
                                  <button
                                    key={ev.id || ev.uuid || `nap-photo-${photoNumber}`}
                                    type="button"
                                    onClick={() => setViewingEvidence(ev)}
                                    className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm text-left active:scale-[0.98] transition-transform"
                                  >
                                    <div className="aspect-[4/5] bg-black overflow-hidden">
                                      <img
                                        src={ev.photoUrl}
                                        alt={ev.mufaName || 'MUFA'}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>
                                    <div className="p-2.5 lg:p-2">
                                      <p className="text-[9px] font-black uppercase text-gray-900 lg:text-[10px] lg:leading-tight">
                                        FOTO {photoNumber}/9
                                      </p>
                                      <p className="text-[8px] font-bold text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">
                                        {ev.fecha} {ev.hora || ''}
                                      </p>
                                    </div>
                                  </button>
                                );
                              }

                              return (
                                <button
                                  key={`nap-missing-${photoNumber}`}
                                  type="button"
                                  onClick={() => {
                                    const mufaId = group[0]?.mufaId || '';
                                    const mufaNumber = Number(group[0]?.mufaNumber || groupIndex + 1);
                                    const mufaName = group[0]?.mufaName || '';
                                    setViewingEvidence(null);
                                    setShowStorageEvidenceViewer(false);
                                    setStorageEvidenceCategory(null);
                                    setEvidenceCategory('MUFA');
                                    // Captura puntual: al volver de la cámara se regresa
                                    // al visor después de completar únicamente esta foto.
                                    setMufaCaptureDraft({
                                      mufaId,
                                      mufaNumber,
                                      mufaName,
                                      photoNumber,
                                      remainingPhotos: 1
                                    });
                                    setShowNapCaptureModal(false);
                                    setCurrentStep('camera');
                                  }}
                                  className="aspect-[4/5] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 flex flex-col items-center justify-center gap-2 text-blue-700 active:scale-[0.98] transition-transform"
                                >
                                  <CameraIcon className="w-8 h-8" />
                                  <span className="text-[9px] font-black uppercase text-center px-2">
                                    TOMAR FOTO<br />FOTO {photoNumber}/9
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })() : (
                    evidences
                      .filter((ev: any) => !!ev.photoUrl && (!storageEvidenceCategory || ev.category === storageEvidenceCategory))
                      .map((ev: any, index: number) => (
                        <button key={ev.id || ev.uuid || index} type="button" onClick={() => setViewingEvidence(ev)} className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm text-left active:scale-[0.98] transition-transform">
                          <div className="aspect-[4/5] bg-black overflow-hidden">
                            <img src={ev.photoUrl} alt={ev.categoryLabel || 'Evidencia'} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          <div className="p-2.5 lg:p-2">
                            <p className="text-[9px] font-black uppercase text-gray-900 lg:text-[10px] lg:leading-tight truncate">{ev.categoryLabel || 'Otros'}</p>
                            {ev.fiberPairId && (
                              <p className="text-[8px] font-black uppercase text-blue-600 mt-1">PUNTA {String(ev.fiberPairNumber || '').padStart(2, '0')} · {ev.fiberSide === 'initial' ? 'INICIAL' : 'FINAL'} · {ev.fiberMeterage ?? '-'} M</p>
                            )}
                            <p className="text-[8px] font-bold text-gray-400 mt-1 lg:text-[9px] lg:leading-tight">{ev.fecha} {ev.hora || ''}</p>
                          </div>
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {viewingEvidence && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 bg-white border-b">
              <h2 className="text-sm font-black uppercase tracking-tight">Detalle del registro</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (viewingEvidence?.id != null) setConfirmDelete({ type: 'evidence', id: viewingEvidence.id });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[10px] font-black uppercase"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
                <button type="button" onClick={() => setViewingEvidence(null)} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cerrar</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2.5 shadow-sm">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Proyecto</p>
                <p className="text-sm font-black text-gray-950 uppercase">{viewingEvidence.projectName || '-'}</p>
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Fecha / Hora</p>
                <p className="text-sm font-mono text-gray-800">{viewingEvidence.fecha} {viewingEvidence.hora || ''}</p>
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">GPS</p>
                <p className="text-sm font-mono text-green-700">{viewingEvidence.gpsLabel || (viewingEvidence.latitude ? `${viewingEvidence.latitude}, ${viewingEvidence.longitude}` : 'SIN GPS')}</p>
                {viewingEvidence.ubicacion && (<><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Ubicacion</p><p className="text-sm text-gray-700 uppercase">{viewingEvidence.ubicacion}</p></>)}
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Tecnico</p>
                <p className="text-sm font-bold text-gray-900 uppercase">{viewingEvidence.baseFields?.tecnico || '-'}</p>
                {(viewingEvidence.customFields || []).filter((f: any) => f.active !== false).map((f: any, i: number) => (
                  <div key={i}><p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">{f.name || 'Campo'}</p><p className="text-sm text-gray-800 uppercase">{f.value || '-'}</p></div>
                ))}
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Referencia foto</p>
                <p className="text-[11px] font-mono text-gray-400 break-all">{viewingEvidence.photoPath || viewingEvidence.uuid || '-'}</p>
                {viewingEvidence.fiberPairId && (
                  <>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Punta de fibra</p>
                    <p className="text-sm font-black text-blue-700 uppercase">
                      PUNTA {String(viewingEvidence.fiberPairNumber || '').padStart(2, '0')} · {viewingEvidence.fiberSide === 'initial' ? 'INICIAL' : 'FINAL'} · {viewingEvidence.fiberMeterage ?? '-'} m
                    </p>
                    {viewingEvidence.fiberReelNumber && (
                      <p className="text-[11px] font-black text-gray-700 uppercase mt-1">CARRETE: {viewingEvidence.fiberReelNumber}</p>
                    )}
                  </>
                )}
                {viewingEvidence.reserveReelNumber && (
                  <>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Carrete</p>
                    <p className="text-sm font-black text-gray-700 uppercase">{viewingEvidence.reserveReelNumber}</p>
                  </>
                )}
                {viewingEvidence.categoryLabel && (
                  <>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Tipo de evidencia</p>
                    <p className="text-sm font-black text-blue-700 uppercase">{viewingEvidence.categoryLabel}</p>
                  </>
                )}
              </div>
              <div className="bg-black rounded-2xl overflow-hidden border border-gray-200 min-h-[260px] flex items-center justify-center">
                {viewingEvidence.photoUrl ? (
                  <img src={viewingEvidence.photoUrl} alt={viewingEvidence.categoryLabel || 'Evidencia'} className="w-full max-h-[62vh] object-contain" />
                ) : (
                  <div className="p-8 text-center text-white/60">
                    <CameraIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Fotografía todavía no disponible en Storage</p>
                  </div>
                )}
              </div>
              <p className="text-center text-[10px] text-gray-400 pt-2">
                {viewingEvidence.photoUrl ? 'Esta es la fotografía que utilizará la memoria de Excel.' : 'La fotografía aún está pendiente de subir a Firebase Storage.'}
              </p>
            </div>
          </motion.div>
        )}



        {confirmDeleteGalleryStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight text-gray-950">
                {selectedGalleryUris.length === 1 ? '¿Eliminar foto?' : `¿Eliminar ${selectedGalleryUris.length} fotos?`}
              </h3>
              <p className="text-sm text-gray-600">
                Se eliminarán del álbum Field Trace del dispositivo.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setConfirmDeleteGalleryStep(0)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => setConfirmDeleteGalleryStep(2)} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmDeleteGalleryStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[211] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border-2 border-red-200">
              <h3 className="text-base font-black uppercase tracking-tight text-red-700">Confirmación final</h3>
              <p className="text-sm text-gray-600">
                Esta acción <span className="font-bold text-red-600">no se puede deshacer</span>.
                {selectedGalleryUris.length === 1
                  ? ' ¿Eliminar definitivamente esta foto?'
                  : ` ¿Eliminar definitivamente ${selectedGalleryUris.length} fotos?`}
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setConfirmDeleteGalleryStep(0)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => { void executeDeleteGallery(); }} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Sí, eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmDeleteProjectsStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight text-gray-950">
                {pendingDeleteProjectIds.length === 1 ? '¿Eliminar proyecto?' : `¿Eliminar ${pendingDeleteProjectIds.length} proyectos?`}
              </h3>
              <p className="text-sm text-gray-600">
                Se quitará el proyecto únicamente de la lista principal de este dispositivo. Sus datos, registros y fotografías permanecerán en Firebase y podrán consultarse desde <span className="font-bold text-gray-900">Proyectos compartidos</span>.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setConfirmDeleteProjectsStep(0); setPendingDeleteProjectIds([]); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => setConfirmDeleteProjectsStep(2)} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmDeleteProjectsStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[201] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border-2 border-red-200">
              <h3 className="text-base font-black uppercase tracking-tight text-red-700">Confirmación final</h3>
              <p className="text-sm text-gray-600">
                El proyecto dejará de mostrarse en la lista principal de este dispositivo.
                <span className="block mt-2 font-bold text-gray-900">Los datos de Firebase y las fotografías de Storage NO se eliminarán.</span>
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setConfirmDeleteProjectsStep(0); setPendingDeleteProjectIds([]); }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => { void executeDeleteProjects(); }} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Sí, ocultar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmClearAllStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <h3 className="text-base font-black uppercase tracking-tight text-gray-950">¿Vaciar todos los registros?</h3>
              <p className="text-sm text-gray-600">
                Se eliminarán <span className="font-bold text-gray-900">{evidences.length}</span> registro(s) de este proyecto. Las fotos del álbum Field Trace no se borran automáticamente.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setConfirmClearAllStep(0)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button type="button" onClick={() => setConfirmClearAllStep(2)} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmClearAllStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[201] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border-2 border-red-200">
              <h3 className="text-base font-black uppercase tracking-tight text-red-700">Confirmación final</h3>
              <p className="text-sm text-gray-600">
                Esta acción <span className="font-bold text-red-600">no se puede deshacer</span>. ¿Eliminar definitivamente todos los registros del proyecto?
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setConfirmClearAllStep(0)} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 text-[11px] font-black uppercase tracking-wider">Cancelar</button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (selectedProject?.id != null) {
                        if ((storageService as any).deleteAllEvidencesByProject) {
                          await (storageService as any).deleteAllEvidencesByProject(selectedProject.id);
                        } else {
                          for (const ev of evidences) {
                            if (ev.id != null) await storageService.deleteEvidence(ev.id);
                          }
                        }
                        setEvidences([]);
                      }
                    } catch (e) {
                      console.error('[ClearAll] failed', e);
                    } finally {
                      setConfirmClearAllStep(0);
                    }
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wider"
                >
                  Sí, eliminar todo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {editingEvidence && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 bg-white border-b">
              <h2 className="text-sm font-black uppercase tracking-tight">Editar registro</h2>
              <button type="button" onClick={() => setEditingEvidence(null)} className="text-xs font-bold uppercase text-gray-500 px-3 py-2">Cancelar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3"><p className="text-[11px] text-amber-800 font-medium">Si editas esta informacion, no coincidira con el texto impreso en la fotografia.</p></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tecnico</label>
                <input type="text" value={editingEvidence.baseFields?.tecnico || ''} onChange={(e) => setEditingEvidence({ ...editingEvidence, baseFields: { ...(editingEvidence.baseFields || {}), tecnico: e.target.value.toUpperCase() } })} className="w-full p-3.5 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none" />
              </div>
              {(editingEvidence.customFields || []).map((f: any, idx: number) => (
                <div key={idx} className="space-y-3 bg-white border border-gray-100 rounded-2xl p-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Descripción</label>
                    <input
                      type="text"
                      value={f.name || ''}
                      onChange={(e) => {
                        const fields = [...(editingEvidence.customFields || [])];
                        fields[idx] = { ...fields[idx], name: e.target.value };
                        setEditingEvidence({ ...editingEvidence, customFields: fields });
                      }}
                      className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-400"
                      placeholder="Nombre del campo"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cantidad / Valor</label>
                    <input
                      type="text"
                      value={f.value || ''}
                      onChange={(e) => {
                        const fields = [...(editingEvidence.customFields || [])];
                        fields[idx] = { ...fields[idx], value: e.target.value };
                        setEditingEvidence({ ...editingEvidence, customFields: fields });
                      }}
                      className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-400"
                      placeholder="Valor"
                    />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => { setPendingEditSave(editingEvidence); setEditConfirmOpen(true); }} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase">Guardar cambios</button>
            </div>
          </motion.div>
        )}
        {editConfirmOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center">
              <h3 className="text-lg font-black uppercase mb-3">Confirmar edicion</h3>
              <p className="text-sm text-gray-500 mb-8">Si editas esta informacion, no coincidira con el texto impreso en la fotografia. ¿Continuar?</p>
              <div className="flex gap-4">
                <button onClick={() => { setEditConfirmOpen(false); setPendingEditSave(null); }} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold uppercase">Cancelar</button>
                <button onClick={async () => { if (pendingEditSave?.id != null) { try { await storageService.updateEvidence(pendingEditSave.id, { baseFields: pendingEditSave.baseFields, customFields: pendingEditSave.customFields }); if (selectedProject?.id) { const evs = await storageService.getEvidencesByProject(selectedProject.id); setEvidences(evs); } } catch (e) { console.error(e); } } setEditConfirmOpen(false); setPendingEditSave(null); setEditingEvidence(null); }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold uppercase">Continuar</button>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}