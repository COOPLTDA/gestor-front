import React, { useState, useCallback } from 'react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, AlertCircle, Mail, CheckCircle, ArrowRight, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Schema de validación ────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').max(50),
  password: z.string().min(3, 'La contraseña es requerida').max(72),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Ingresá un email válido'),
});

const empresa = import.meta.env.VITE_APP_EMPRESA as string | undefined;
const entorno  = import.meta.env.VITE_APP_ENTORNO  as string | undefined;
const isProd   = entorno?.toLowerCase().includes('prod');

// ── Generador de path SVG para engranajes ──────────────────────────────────
function makeGearPath(teeth: number, outerR: number, innerR: number, holeR: number): string {
  const step  = (Math.PI * 2) / teeth;
  const toothW = step * 0.38;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const base = i * step - Math.PI / 2;
    const a1   = base - toothW / 2;
    const a2   = base + toothW / 2;
    const a3   = base + step - toothW / 2;
    const p    = (r: number, a: number) =>
      `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
    if (i === 0) d += `M ${p(innerR, a1)} `;
    else d += `L ${p(innerR, a1)} `;
    d += `L ${p(outerR, a1)} L ${p(outerR, a2)} L ${p(innerR, a2)} `;
    if (i < teeth - 1)
      d += `A ${innerR},${innerR} 0 0,1 ${p(innerR, a3)} `;
  }
  d += 'Z';
  d += ` M ${holeR},0 A ${holeR},${holeR} 0 1,0 -${holeR},0 A ${holeR},${holeR} 0 1,0 ${holeR},0 Z`;
  return d;
}

const GEARS = {
  xl: makeGearPath(16, 48, 35, 15),
  lg: makeGearPath(12, 48, 35, 17),
  md: makeGearPath(10, 48, 35, 19),
  sm: makeGearPath(7,  48, 35, 21),
};

interface GearProps {
  size: number;
  variant?: keyof typeof GEARS;
  duration?: number;
  reverse?: boolean;
  opacity?: number;
  className?: string;
}
const Gear: React.FC<GearProps> = ({
  size, variant = 'md', duration = 40, reverse = false, opacity = 0.07, className = '',
}) => (
  <motion.div
    className={`absolute pointer-events-none text-white ${className}`}
    style={{ width: size, height: size, opacity }}
    animate={{ rotate: reverse ? -360 : 360 }}
    transition={{ duration, repeat: Infinity, ease: 'linear' }}
  >
    <svg viewBox="-50 -50 100 100" width={size} height={size}>
      <path d={GEARS[variant]} fill="currentColor" fillRule="evenodd" />
    </svg>
  </motion.div>
);

// ── Trazos de circuito + señales animadas ──────────────────────────────────
// Paths compartidos para trazos visibles y animateMotion de señales
const TRACES = [
  "M 0 120 H 80 V 260 H 200 V 160 H 340",
  "M 600 80 H 480 V 220 H 360 V 340 H 500 V 460",
  "M 0 400 H 140 V 320 H 280 V 480 H 180 V 600",
  "M 600 500 H 420 V 580 H 260 V 680 H 400 V 800",
  "M 100 800 V 660 H 240 V 540 H 380",
  "M 500 0 V 100 H 380 V 200",
];

const NODES: [number, number][] = [
  [80,120],[80,260],[200,260],[200,160],[340,160],
  [480,80],[480,220],[360,220],[360,340],[500,340],
  [140,400],[140,320],[280,320],[280,480],[180,480],
  [420,500],[420,580],[260,580],[260,680],
  [240,660],[240,540],[380,540],
  [380,200],[500,100],
];

// Señales: path index, color, duración, delay inicial negativo (para que empiece a mitad)
const SIGNALS = [
  { path: 0, color: '#10b981', dur: 6.5,  begin: '0s'    },
  { path: 1, color: '#6366f1', dur: 9.0,  begin: '-3.5s' },
  { path: 2, color: '#0ea5e9', dur: 7.2,  begin: '-1.8s' },
  { path: 3, color: '#10b981', dur: 11.0, begin: '-5.0s' },
  { path: 4, color: '#a78bfa', dur: 5.5,  begin: '-2.5s' },
  { path: 5, color: '#34d399', dur: 4.8,  begin: '-1.2s' },
];

const CircuitTraces: React.FC<{ panelColor: string }> = ({ panelColor }) => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
    viewBox="0 0 600 800"
  >
    <defs>
      {/* Filtro glow para señales */}
      <filter id="glow-signal" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-node" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Trazos estáticos */}
    <g stroke={panelColor} fill="none" strokeWidth="1" opacity="0.07">
      {TRACES.map((d, i) => <path key={i} d={d} />)}
    </g>

    {/* Nodos estáticos */}
    <g fill={panelColor} opacity="0.08">
      {NODES.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3.5" />
      ))}
    </g>

    {/* Señales viajeras */}
    {SIGNALS.map((sig, i) => (
      <g key={i} filter="url(#glow-signal)">
        {/* Halo exterior */}
        <circle r="5" fill={sig.color} opacity="0.25">
          <animateMotion
            dur={`${sig.dur}s`}
            repeatCount="indefinite"
            begin={sig.begin}
            path={TRACES[sig.path]}
          />
        </circle>
        {/* Núcleo brillante */}
        <circle r="2.5" fill={sig.color} opacity="0.95">
          <animateMotion
            dur={`${sig.dur}s`}
            repeatCount="indefinite"
            begin={sig.begin}
            path={TRACES[sig.path]}
          />
        </circle>
      </g>
    ))}
  </svg>
);

// ── Ícono con ripple al hover ───────────────────────────────────────────────
const BrandIcon: React.FC = () => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative mb-8 w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shadow-2xl shadow-emerald-900/50 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        animate={hovered ? { scale: [1, 1.12, 1], rotate: [0, -5, 5, 0] } : {}}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <Building2 className="w-10 h-10 text-emerald-400" />
      </motion.div>

      {/* Anillos de ripple */}
      <AnimatePresence>
        {hovered && (
          <>
            {[0, 0.15, 0.3].map((delay, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-2xl border border-emerald-400/60"
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 2.8 + i * 0.6, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut', delay }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Spotlight en la card ───────────────────────────────────────────────────
interface SpotlightState { x: number; y: number; active: boolean }

// ── Componente principal ───────────────────────────────────────────────────
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

  // Hover sobre el panel izquierdo → glow en nodos
  const [leftHover, setLeftHover] = useState(false);

  // Modal recuperar contraseña
  const [showForgot, setShowForgot]   = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    // Validación client-side
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

    // Validación client-side antes de enviar al servidor
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
    <div className="min-h-screen flex relative overflow-hidden bg-slate-900">

      {/* ══ Blobs globales (abarcan toda la pantalla) ══════════════════════ */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #10b981, transparent)', left: '10%', top: '10%' }}
        animate={{ x: [0, 50, -30, 70, -20, 0], y: [0, -60, 30, -90, 50, 0] }}
        transition={{ duration: 38, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)', right: '5%', top: '5%' }}
        animate={{ x: [0, -60, 40, -80, 20, 0], y: [0, 50, -70, 30, -40, 0] }}
        transition={{ duration: 52, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[450px] h-[450px] rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #0ea5e9, transparent)', left: '40%', bottom: '-5%' }}
        animate={{ x: [0, 35, -55, 20, -30, 0], y: [0, -30, 60, -50, 20, 0] }}
        transition={{ duration: 44, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ══ Panel izquierdo – branding ══════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center overflow-hidden"
        onMouseEnter={() => setLeftHover(true)}
        onMouseLeave={() => setLeftHover(false)}
      >
        {/* Hover glow extra en panel */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: leftHover ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.05) 0%, transparent 70%)' }}
        />

        {/* Engranajes */}
        <Gear size={300} variant="xl" duration={80}         opacity={0.055} className="-bottom-20 -right-20" />
        <Gear size={160} variant="lg" duration={50} reverse opacity={0.06}  className="top-8 -right-8" />
        <Gear size={100} variant="md" duration={30}         opacity={0.07}  className="top-36 right-28" />
        <Gear size={120} variant="sm" duration={35} reverse opacity={0.05}  className="-top-10 left-10" />
        <Gear size={80}  variant="md" duration={22}         opacity={0.06}  className="bottom-32 left-6" />

        {/* Circuito + señales (nodos más brillantes al hacer hover en panel) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 600 800"
        >
          <defs>
            <filter id="glow-signal-l" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-node-l" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Trazos */}
          <g stroke="#6ee7b7" fill="none" strokeWidth="1" opacity="0.07">
            {TRACES.map((d, i) => <path key={i} d={d} />)}
          </g>

          {/* Nodos — se iluminan al hover del panel */}
          {NODES.map(([cx, cy], i) => (
            <circle
              key={i} cx={cx} cy={cy} r={leftHover ? 5 : 3.5}
              fill={leftHover ? '#34d399' : '#6ee7b7'}
              opacity={leftHover ? 0.5 : 0.08}
              filter={leftHover ? 'url(#glow-node-l)' : undefined}
              style={{ transition: 'all 0.5s ease' }}
            />
          ))}

          {/* Señales viajeras */}
          {SIGNALS.map((sig, i) => (
            <g key={i} filter="url(#glow-signal-l)">
              <circle r="5" fill={sig.color} opacity="0.25">
                <animateMotion dur={`${sig.dur}s`} repeatCount="indefinite" begin={sig.begin} path={TRACES[sig.path]} />
              </circle>
              <circle r="2.5" fill={sig.color} opacity="0.95">
                <animateMotion dur={`${sig.dur}s`} repeatCount="indefinite" begin={sig.begin} path={TRACES[sig.path]} />
              </circle>
            </g>
          ))}
        </svg>

        {/* Contenido */}
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <BrandIcon />

          <h1 className="text-4xl font-bold text-white tracking-tight">DistriGestión</h1>

          {empresa && (
            <p className="mt-3 text-xl font-semibold text-emerald-300">{empresa}</p>
          )}

          <p className="mt-3 text-slate-400 text-sm leading-relaxed max-w-xs">
            Sistema Integral de Gestión Empresarial
          </p>

          {entorno && (
            <span className={`mt-5 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
              isProd
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}>
              <motion.span
                className={`w-1.5 h-1.5 rounded-full ${isProd ? 'bg-emerald-400' : 'bg-amber-400'}`}
                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              {entorno}
            </span>
          )}

          <div className="mt-16 w-16 h-px bg-gradient-to-r from-transparent via-slate-500 to-transparent" />
          <p className="mt-4 text-slate-600 text-xs">© {new Date().getFullYear()} DistriGestión</p>
        </div>
      </div>

      {/* Divisor sutil entre paneles */}
      <div className="hidden lg:block absolute left-1/2 top-16 bottom-16 w-px bg-white/5 pointer-events-none" />

      {/* ══ Panel derecho – formulario ═══════════════════════════════════════ */}
      <div className="flex-1 relative flex flex-col items-center justify-center px-6 py-12 overflow-hidden">

        {/* Engranajes */}
        <Gear size={360} variant="xl" duration={100}         opacity={0.04}  className="-top-24 -left-24" />
        <Gear size={200} variant="lg" duration={60}  reverse opacity={0.05}  className="-bottom-16 -right-16" />
        <Gear size={110} variant="md" duration={28}          opacity={0.06}  className="bottom-32 left-12" />

        {/* Circuito + señales */}
        <CircuitTraces panelColor="#94a3b8" />

        {/* Logo mobile */}
        <div className="relative z-10 lg:hidden mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/20 shadow-lg mb-3">
            <Building2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">DistriGestión</h1>
          {empresa && <p className="text-emerald-300 font-semibold text-sm mt-1">{empresa}</p>}
          {entorno && (
            <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              isProd ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                     : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
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
          className="relative z-10 w-full max-w-sm rounded-2xl shadow-2xl p-8 border border-white/20 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }}
          onMouseMove={handleCardMove}
          onMouseLeave={handleCardLeave}
        >
          {/* Spotlight que sigue el cursor */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
            style={{
              opacity: spot.active ? 1 : 0,
              background: spot.active
                ? `radial-gradient(220px circle at ${spot.x}px ${spot.y}px, rgba(255,255,255,0.09), transparent 70%)`
                : 'transparent',
            }}
          />

          <div className="relative">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white">Bienvenido</h2>
              <p className="text-white/50 text-sm mt-1">Ingresá tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-sm font-medium text-white/70">
                  Usuario
                </label>
                <input
                  type="text"
                  id="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
                  placeholder="Tu usuario"
                  required
                  minLength={3}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-white/70">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent pr-11 transition"
                    placeholder="••••••••"
                    required
                    minLength={3}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition"
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
                    className="flex items-start gap-2.5 bg-red-500/15 border border-red-400/30 text-red-300 rounded-xl p-3.5"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white py-2.5 px-4 rounded-xl font-semibold text-sm shadow-lg shadow-emerald-900/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02, backgroundColor: '#34d399' }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
                  className="text-sm text-white/40 transition relative"
                  whileHover={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  ¿Olvidaste tu contraseña?
                  <motion.span
                    className="absolute bottom-0 left-0 h-px bg-white/60 w-0"
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center gap-3">
                <div className="bg-white/10 rounded-xl p-2">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-base">Recuperar contraseña</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Te enviaremos un enlace por correo</p>
                </div>
              </div>

              <div className="p-6">
                {forgotSuccess ? (
                  <div className="text-center py-2">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-slate-700 font-medium mb-1">Correo enviado</p>
                    <p className="text-slate-500 text-sm mb-6">
                      Si el email está registrado, recibirás las instrucciones en los próximos minutos. Revisá también tu carpeta de spam.
                    </p>
                    <button
                      onClick={closeForgot}
                      className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-900 transition"
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <p className="text-slate-600 text-sm">
                      Ingresá el email asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                        placeholder="usuario@empresa.com"
                        required
                        disabled={forgotLoading}
                        autoFocus
                      />
                    </div>
                    {forgotError && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{forgotError}</span>
                      </div>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={closeForgot}
                        className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                        disabled={forgotLoading}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading || !forgotEmail}
                        className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        {forgotLoading ? (
                          <div className="flex justify-center items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
