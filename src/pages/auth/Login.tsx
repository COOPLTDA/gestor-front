import React, { useState, useCallback } from 'react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, AlertCircle, Mail, CheckCircle, ArrowRight, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Schema de validación ────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').max(50),
  password: z.string().min(3, 'La contraseña es requerida').max(72),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Ingresá un email válido'),
});

const appName  = (import.meta.env.VITE_APP_NAME as string | undefined) || 'CoopGestion';
const appNameAccent = appName.slice(-Math.ceil(appName.length / 2));
const appNamePrefix = appName.slice(0, appName.length - appNameAccent.length);
const empresa  = import.meta.env.VITE_APP_EMPRESA as string | undefined;
const entorno  = import.meta.env.VITE_APP_ENTORNO  as string | undefined;
const isProd   = entorno?.toLowerCase().includes('prod');

// ── Blob orgánico animado ───────────────────────────────────────────────────
interface BlobProps {
  size: number;
  color: string;
  style?: React.CSSProperties;
  duration?: number;
  delay?: number;
}
const Blob: React.FC<BlobProps> = ({ size, color, style, duration = 26, delay = 0 }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none blur-3xl"
    style={{ width: size, height: size, background: color, ...style }}
    animate={{
      x: [0, 40, -25, 0],
      y: [0, -35, 20, 0],
      scale: [1, 1.08, 0.96, 1],
    }}
    transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
  />
);

// ── Patrón de puntos sutil (textura, no decoración pesada) ──────────────────
const DotGrid: React.FC<{ className?: string; dotColor: string }> = ({ className = '', dotColor }) => (
  <svg className={`absolute pointer-events-none ${className}`} width="200" height="200">
    <defs>
      <pattern id="dot-grid" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.4" fill={dotColor} />
      </pattern>
    </defs>
    <rect width="200" height="200" fill="url(#dot-grid)" />
  </svg>
);

// ── Ícono de marca con halo suave ────────────────────────────────────────────
const BrandIcon: React.FC = () => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative mb-7 w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        animate={hovered ? { scale: [1, 1.1, 1], rotate: [0, -6, 6, 0] } : {}}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <Leaf className="w-8 h-8 text-primary" />
      </motion.div>
      <AnimatePresence>
        {hovered && (
          <motion.div
            className="absolute inset-0 rounded-2xl border border-primary/40"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface SpotlightState { x: number; y: number; active: boolean }

const Login: React.FC = () => {
  const { login } = useAuth();

  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);

  // Spotlight en la card del formulario
  const [spot, setSpot] = useState<SpotlightState>({ x: 0, y: 0, active: false });
  const handleCardMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSpot({ x: e.clientX - r.left, y: e.clientY - r.top, active: true });
  }, []);
  const handleCardLeave = useCallback(() => setSpot(s => ({ ...s, active: false })), []);

  // Modal recuperar contraseña
  const [showForgot, setShowForgot]   = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const parsed = forgotPasswordSchema.safeParse({ email: forgotEmail.trim() });
    if (!parsed.success) {
      setForgotError(parsed.error.errors[0].message);
      return;
    }

    setForgotLoading(true);
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data.email }),
      });
      const data = await res.json();
      if (data.success) setForgotSuccess(true);
      else setForgotError(data.message || 'Error al enviar el correo.');
    } catch {
      setForgotError('No se pudo conectar al servidor.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = loginSchema.safeParse({ username: username.trim(), password });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      await login(parsed.data.username, parsed.data.password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-background">

      {/* ══ Blobs globales ══════════════════════════════════════════════════ */}
      <Blob size={520} color="hsl(158 64% 45% / 0.18)" style={{ left: '-8%', top: '-10%' }} duration={30} />
      <Blob size={420} color="hsl(158 55% 60% / 0.14)" style={{ right: '-6%', top: '15%' }} duration={38} delay={4} />
      <Blob size={380} color="hsl(199 70% 55% / 0.10)" style={{ left: '25%', bottom: '-15%' }} duration={34} delay={2} />

      {/* ══ Panel izquierdo – branding ══════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center overflow-hidden">
        <DotGrid className="top-10 left-10 opacity-40" dotColor="hsl(var(--primary))" />
        <DotGrid className="bottom-10 right-10 opacity-30" dotColor="hsl(var(--primary))" />

        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <BrandIcon />

          <h1 className="text-4xl font-display font-extrabold text-foreground tracking-tight">
            {appNamePrefix}<span className="text-primary">{appNameAccent}</span>
          </h1>

          {empresa && (
            <p className="mt-3 text-lg font-semibold text-primary/80">{empresa}</p>
          )}

          <p className="mt-3 text-muted-foreground text-sm leading-relaxed max-w-xs">
            Sistema Integral de Gestión Empresarial
          </p>

          {entorno && (
            <span className={`mt-5 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
              isProd
                ? 'bg-primary/10 text-primary border-primary/25'
                : 'bg-amber-500/10 text-amber-700 border-amber-500/25'
            }`}>
              <motion.span
                className={`w-1.5 h-1.5 rounded-full ${isProd ? 'bg-primary' : 'bg-amber-500'}`}
                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              {entorno}
            </span>
          )}

          <div className="mt-14 w-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <p className="mt-4 text-muted-foreground/70 text-xs">© {new Date().getFullYear()} {appName}</p>
        </div>
      </div>

      {/* Divisor sutil entre paneles */}
      <div className="hidden lg:block absolute left-1/2 top-16 bottom-16 w-px bg-border/60 pointer-events-none" />

      {/* ══ Panel derecho – formulario ═══════════════════════════════════════ */}
      <div className="flex-1 relative flex flex-col items-center justify-center px-6 py-12 overflow-hidden">

        {/* Logo mobile */}
        <div className="relative z-10 lg:hidden mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 shadow-md mb-3">
            <Leaf className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-extrabold text-foreground">
            {appNamePrefix}<span className="text-primary">{appNameAccent}</span>
          </h1>
          {empresa && <p className="text-primary/80 font-semibold text-sm mt-1">{empresa}</p>}
          {entorno && (
            <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              isProd ? 'bg-primary/10 text-primary border-primary/25'
                     : 'bg-amber-500/10 text-amber-700 border-amber-500/25'
            }`}>
              {entorno}
            </span>
          )}
        </div>

        {/* Card con spotlight hover ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-sm rounded-2xl shadow-xl p-8 border border-border overflow-hidden bg-card"
          onMouseMove={handleCardMove}
          onMouseLeave={handleCardLeave}
        >
          {/* Spotlight que sigue el cursor */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
            style={{
              opacity: spot.active ? 1 : 0,
              background: spot.active
                ? `radial-gradient(220px circle at ${spot.x}px ${spot.y}px, hsl(var(--primary) / 0.07), transparent 70%)`
                : 'transparent',
            }}
          />

          <div className="relative">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-foreground">Bienvenido</h2>
              <p className="text-muted-foreground text-sm mt-1">Ingresá tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-sm font-medium text-foreground/80">
                  Usuario
                </label>
                <input
                  type="text"
                  id="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                  placeholder="Tu usuario"
                  required
                  minLength={3}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-foreground/80">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent pr-11 transition"
                    placeholder="••••••••"
                    required
                    minLength={3}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-3.5"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 px-4 rounded-xl font-semibold text-sm shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar Sesión</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>

              <div className="text-center pt-1">
                <motion.button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-sm text-muted-foreground transition relative"
                  whileHover={{ color: 'hsl(var(--foreground))' }}
                >
                  ¿Olvidaste tu contraseña?
                  <motion.span
                    className="absolute bottom-0 left-0 h-px bg-foreground/60 w-0"
                    whileHover={{ width: '100%' }}
                    transition={{ duration: 0.25 }}
                  />
                </motion.button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>

      {/* ══ Modal recuperar contraseña ═══════════════════════════════════════ */}
      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeForgot(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-primary px-6 py-5 flex items-center gap-3">
                <div className="bg-primary-foreground/15 rounded-xl p-2">
                  <Mail className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-primary-foreground font-semibold text-base">Recuperar contraseña</h2>
                  <p className="text-primary-foreground/75 text-xs mt-0.5">Te enviaremos un enlace por correo</p>
                </div>
              </div>

              <div className="p-6">
                {forgotSuccess ? (
                  <div className="text-center py-2">
                    <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
                    <p className="text-foreground font-medium mb-1">Correo enviado</p>
                    <p className="text-muted-foreground text-sm mb-6">
                      Si el email está registrado, recibirás las instrucciones en los próximos minutos. Revisá también tu carpeta de spam.
                    </p>
                    <button
                      onClick={closeForgot}
                      className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition"
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                      Ingresá el email asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-foreground/80 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition"
                        placeholder="usuario@empresa.com"
                        required
                        disabled={forgotLoading}
                        autoFocus
                      />
                    </div>
                    {forgotError && (
                      <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-3 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{forgotError}</span>
                      </div>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={closeForgot}
                        className="flex-1 border border-input text-muted-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-accent/60 transition"
                        disabled={forgotLoading}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading || !forgotEmail}
                        className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                      >
                        {forgotLoading ? (
                          <div className="flex justify-center items-center gap-2">
                            <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                            <span>Enviando...</span>
                          </div>
                        ) : 'Enviar enlace'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
