import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { LockKeyhole, Mail, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { auth, db } from '../services/firebaseService';

type AuthGateProps = { children: ReactNode };
const ADMIN_EMAIL = 'jenamorado@tentelcom.com';

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, async currentUser => {
    setCheckingSession(true);
    setUser(currentUser);
    if (currentUser && currentUser.email?.toLowerCase() !== ADMIN_EMAIL) {
      try {
        const profileRef = doc(db, 'users', currentUser.uid);
        const profile = await getDoc(profileRef);
        if (!profile.exists()) {
          await setDoc(profileRef, {
            uid: currentUser.uid,
            email: currentUser.email || '',
            role: 'user',
            permissions: { projects: true, memory: true, sync: true },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (cause) {
        // No bloqueamos el acceso por una escritura de perfil fallida; los permisos sensibles
        // deben seguir siendo validados por las reglas de Firebase.
        console.error('[Auth] No se pudo inicializar el perfil:', cause);
      }
    }
    setCheckingSession(false);
  }), []);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (cause: any) {
      const code = String(cause?.code || '');
      if (code === 'auth/too-many-requests') {
        setError('Se han realizado demasiados intentos. Esperá un momento e intentá de nuevo.');
      } else if (code === 'auth/network-request-failed') {
        setError('No se pudo conectar. Revisá tu conexión e intentá nuevamente.');
      } else {
        setError('No se pudo iniciar sesión. Verificá tus credenciales e intentá nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="h-[100dvh] overflow-hidden bg-slate-950 flex items-center justify-center" aria-label="Verificando sesión">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <LoaderCircle className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm font-semibold">Verificando acceso...</p>
        </div>
      </main>
    );
  }

  if (user) return <>{children}</>;

  return (
    <main className="h-[100dvh] overflow-y-auto overscroll-none bg-gradient-to-br from-slate-950 via-[#101d3a] to-blue-950 flex items-center justify-center px-4 py-3">
      <section className="w-full max-w-md max-h-full overflow-y-auto rounded-[2rem] bg-white shadow-2xl shadow-black/30 border border-white/10">
        <header className="bg-gradient-to-br from-[#1e3a8a] via-blue-800 to-[#2563eb] px-6 py-5 sm:py-6 text-white text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-blue-100" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase">Field Trace</h1>
          <p className="text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase text-blue-100 mt-2">Acceso corporativo</p>
        </header>

        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <form onSubmit={handleSignIn} className="space-y-4">
            <label className="block">
              <span className="block text-[11px] font-black uppercase tracking-[0.13em] text-slate-500 mb-2">Correo electrónico</span>
              <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <Mail className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
                <input type="email" autoComplete="username" inputMode="email" required value={email}
                  onChange={event => setEmail(event.target.value)} placeholder="usuario@empresa.com"
                  className="w-full min-w-0 py-3 outline-none text-slate-900 placeholder:text-slate-400 bg-transparent text-sm sm:text-base"
                  aria-label="Correo electrónico" />
              </span>
            </label>

            <label className="block">
              <span className="block text-[11px] font-black uppercase tracking-[0.13em] text-slate-500 mb-2">Contraseña</span>
              <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <LockKeyhole className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password}
                  onChange={event => setPassword(event.target.value)} placeholder="Tu contraseña"
                  className="w-full min-w-0 py-3 outline-none text-slate-900 placeholder:text-slate-400 bg-transparent text-sm sm:text-base"
                  aria-label="Contraseña" />
                <button type="button" onClick={() => setShowPassword(value => !value)} className="text-slate-400 hover:text-blue-700 shrink-0"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </span>
            </label>

            {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={submitting || !email.trim() || !password}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider text-sm py-3.5 shadow-lg shadow-blue-800/20 transition-colors">
              {submitting && <LoaderCircle className="w-5 h-5 animate-spin" />}
              {submitting ? 'Validando...' : 'Iniciar sesión'}
            </button>
          </form>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">Acceso exclusivo para usuarios autorizados de Tentelcom.</p>
        </div>
      </section>
    </main>
  );
}
