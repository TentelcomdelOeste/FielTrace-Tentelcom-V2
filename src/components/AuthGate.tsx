import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, type User } from 'firebase/auth';
import { LockKeyhole, Mail, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { auth } from '../services/firebaseService';

type AuthGateProps = { children: ReactNode };

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, currentUser => {
    setUser(currentUser);
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
        // No revelar si una cuenta existe o si solamente la contraseña es incorrecta.
        setError('No se pudo iniciar sesión. Verificá tus credenciales e intentá nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center" aria-label="Verificando sesión">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <LoaderCircle className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold">Verificando acceso...</p>
        </div>
      </main>
    );
  }

  if (user) return <>{children}</>;

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-8">
      <section className="w-full max-w-sm rounded-[2rem] bg-white p-7 sm:p-8 shadow-xl shadow-gray-200/70 border border-gray-100">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <ShieldCheck className="w-9 h-9 text-blue-600" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-center text-3xl font-black tracking-tighter uppercase text-gray-950">Field Trace</h1>
        <p className="text-center text-sm text-gray-500 mt-2 mb-7">Ingresá tus credenciales para continuar</p>

        <form onSubmit={handleSignIn} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Correo electrónico</span>
            <span className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <Mail className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
              <input
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full min-w-0 py-3.5 outline-none text-gray-900 placeholder:text-gray-400 bg-transparent"
                aria-label="Correo electrónico"
              />
            </span>
          </label>

          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Contraseña</span>
            <span className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <LockKeyhole className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                className="w-full min-w-0 py-3.5 outline-none text-gray-900 placeholder:text-gray-400 bg-transparent"
                aria-label="Contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                className="text-gray-400 hover:text-gray-700 shrink-0"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </span>
          </label>

          {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 shadow-lg shadow-blue-600/20 transition-colors"
          >
            {submitting && <LoaderCircle className="w-5 h-5 animate-spin" />}
            {submitting ? 'Validando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
          Acceso exclusivo para usuarios autorizados de Tentelcom.
        </p>
      </section>
    </main>
  );
}
