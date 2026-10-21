import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, LoaderCircle, ShieldCheck, Users, FolderKanban, Images, Cloud, Save, Check, AlertTriangle } from 'lucide-react';
import { auth, db } from '../services/firebaseService';

export type AreaPermissions = {
  projects: boolean;
  memory: boolean;
  sync: boolean;
};

type ManagedUser = {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  permissions: AreaPermissions;
};

type Props = {
  onClose: () => void;
};

const DEFAULT_PERMISSIONS: AreaPermissions = { projects: true, memory: true, sync: true };
const ADMIN_EMAIL = 'jenamorado@tentelcom.com';

function normalizeUser(data: any, uid: string): ManagedUser {
  return {
    uid,
    email: String(data?.email || 'Usuario sin correo'),
    role: data?.role === 'admin' ? 'admin' : 'user',
    permissions: {
      projects: data?.permissions?.projects !== false,
      memory: data?.permissions?.memory !== false,
      sync: data?.permissions?.sync !== false,
    },
  };
}

export default function AdminDashboard({ onClose }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AreaPermissions>>({});
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('La sesión no está activa.');
      const currentIsBootstrapAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL;
      const currentProfileRef = doc(db, 'users', currentUser.uid);
      const currentProfile = await getDocs(collection(db, 'users'));
      const foundCurrent = currentProfile.docs.some(item => item.id === currentUser.uid);
      if (!foundCurrent) {
        // Este correo se reconoce también en las reglas de Firestore como administrador inicial.
        await setDoc(currentProfileRef, {
          uid: currentUser.uid,
          email: currentUser.email || '',
          role: currentIsBootstrapAdmin ? 'admin' : 'user',
          permissions: DEFAULT_PERMISSIONS,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      const loaded = currentProfile.docs.map(item => normalizeUser(item.data(), item.id));
      if (!foundCurrent) {
        loaded.push({
          uid: currentUser.uid,
          email: currentUser.email || '',
          role: currentIsBootstrapAdmin ? 'admin' : 'user',
          permissions: DEFAULT_PERMISSIONS,
        });
      }
      loaded.sort((a, b) => a.email.localeCompare(b.email));
      setUsers(loaded);
      setDrafts(Object.fromEntries(loaded.map(user => [user.uid, { ...user.permissions }])));
    } catch (cause: any) {
      console.error('[AdminDashboard] No se pudieron cargar usuarios:', cause);
      setError('No se pudieron cargar los usuarios. Verificá la conexión y las reglas de Firebase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const togglePermission = (uid: string, area: keyof AreaPermissions, value: boolean) => {
    setDrafts(current => ({ ...current, [uid]: { ...(current[uid] || DEFAULT_PERMISSIONS), [area]: value } }));
    setNotice('');
  };

  const savePermissions = async (user: ManagedUser) => {
    setSavingUid(user.uid);
    setError('');
    setNotice('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        permissions: drafts[user.uid] || DEFAULT_PERMISSIONS,
        updatedAt: serverTimestamp(),
      });
      setUsers(current => current.map(item => item.uid === user.uid ? { ...item, permissions: { ...(drafts[user.uid] || DEFAULT_PERMISSIONS) } } : item));
      setNotice('Permisos guardados para ' + user.email + '.');
    } catch (cause) {
      console.error('[AdminDashboard] No se pudieron guardar permisos:', cause);
      setError('No se pudieron guardar los permisos. Revisá las reglas de Firestore.');
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10" aria-label="Volver a Field Trace"><ArrowLeft className="w-5 h-5"/></button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">Field Trace · Administración</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Accesos y permisos</h1>
          </div>
          <div className="rounded-2xl bg-blue-500/15 border border-blue-300/20 p-3"><ShieldCheck className="w-6 h-6 text-blue-300"/></div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6 mb-5">
          <div className="flex items-start gap-3">
            <Users className="w-6 h-6 text-blue-300 mt-0.5"/>
            <div>
              <h2 className="font-bold text-lg">Usuarios autorizados</h2>
              <p className="text-sm text-slate-400 mt-1">Activá o desactivá el acceso a las áreas principales. Los cambios se guardan en Firebase.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="rounded-2xl bg-slate-950/70 border border-white/5 p-3"><p className="text-xs text-slate-400">Cuentas registradas</p><p className="text-2xl font-black mt-1">{users.length}</p></div>
            <div className="rounded-2xl bg-slate-950/70 border border-white/5 p-3"><p className="text-xs text-slate-400">Administradores</p><p className="text-2xl font-black mt-1">{users.filter(user => user.role === 'admin').length}</p></div>
            <div className="rounded-2xl bg-slate-950/70 border border-white/5 p-3"><p className="text-xs text-slate-400">Tu sesión</p><p className="text-sm font-bold mt-2 truncate">{auth.currentUser?.email}</p></div>
          </div>
        </section>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200 flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0"/>{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200 flex gap-2"><Check className="w-5 h-5 shrink-0"/>{notice}</div>}

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-300"><LoaderCircle className="w-6 h-6 animate-spin"/>Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-center text-slate-300">Todavía no hay perfiles registrados. Los usuarios aparecerán aquí después de iniciar sesión por primera vez.</div>
        ) : (
          <div className="space-y-4">
            {users.map(user => {
              const permissions = drafts[user.uid] || DEFAULT_PERMISSIONS;
              const isCurrentAdmin = user.email.toLowerCase() === ADMIN_EMAIL || user.role === 'admin';
              return (
                <section key={user.uid} className="rounded-3xl border border-white/10 bg-slate-900 p-4 sm:p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="rounded-xl bg-blue-500/15 p-3"><Users className="w-5 h-5 text-blue-300"/></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold break-all">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-400">{isCurrentAdmin ? 'Administrador principal' : 'Usuario'} · ID: {user.uid.slice(0, 10)}…</p>
                    </div>
                    {isCurrentAdmin && <span className="rounded-full bg-blue-500/15 text-blue-200 px-2.5 py-1 text-[10px] font-black uppercase">Admin</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {([
                      ['projects', 'Proyectos', FolderKanban],
                      ['memory', 'Memoria fotográfica', Images],
                      ['sync', 'Sincronización', Cloud],
                    ] as const).map(([key, label, Icon]) => (
                      <label key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 cursor-pointer">
                        <input type="checkbox" checked={permissions[key]} disabled={isCurrentAdmin} onChange={event => togglePermission(user.uid, key, event.target.checked)} className="h-4 w-4 accent-blue-500"/>
                        <Icon className="w-4 h-4 text-slate-300"/>
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                  {!isCurrentAdmin && (
                    <div className="flex justify-end mt-4">
                      <button onClick={() => void savePermissions(user)} disabled={savingUid === user.uid} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-4 py-2.5 text-sm font-bold">
                        {savingUid === user.uid ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                        Guardar permisos
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
        <p className="text-xs text-slate-500 leading-relaxed mt-6">Los permisos de interfaz deben complementarse con reglas de Firebase Storage y Firestore antes de considerarse una barrera de seguridad completa.</p>
      </div>
    </main>
  );
}
