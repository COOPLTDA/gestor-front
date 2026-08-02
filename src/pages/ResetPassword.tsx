import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || 'Error al restablecer la contraseña.');
      }
    } catch {
      setError('No se pudo conectar al servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Enlace inválido</h2>
          <p className="text-slate-500 mb-6">El enlace de recuperación es inválido o ya no está disponible.</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-900">
      {/* Fondo igual al login */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'radial-gradient(ellipse at 20% 50%, #064e3b 0%, #1e3a5f 50%, #111827 100%)',
            'radial-gradient(ellipse at 80% 50%, #065f46 0%, #1e3a5f 40%, #111827 100%)',
            'radial-gradient(ellipse at 20% 50%, #064e3b 0%, #1e3a5f 50%, #111827 100%)',
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -bottom-40 left-0 w-[200%] h-[400px] bg-gradient-to-r from-green-300/40 via-cyan-300/40 to-green-200/30 blur-3xl"
          animate={{ x: ['0%', '-50%', '0%'], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md backdrop-blur-lg bg-white/10 p-8 rounded-2xl shadow-2xl border border-white/20"
      >
        {success ? (
          <div className="text-center py-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4"
            >
              <CheckCircle className="w-9 h-9 text-green-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Contraseña actualizada</h2>
            <p className="text-indigo-100 text-sm mb-8">
              Tu contraseña fue restablecida correctamente. Ya podés iniciar sesión.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="bg-white text-green-700 px-8 py-3 rounded-xl font-semibold shadow-md hover:bg-green-50 transition"
            >
              Ir al inicio de sesión
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full backdrop-blur-sm mb-4 shadow-lg">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Nueva contraseña</h1>
              <p className="text-indigo-100 mt-2 text-sm">Ingresá tu nueva contraseña para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-xl focus:ring-2 focus:ring-white focus:outline-none pr-12 transition"
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-xl focus:ring-2 focus:ring-white focus:outline-none pr-12 transition"
                    placeholder="Repetí la contraseña"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition"
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/40 text-red-200 rounded-lg p-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full bg-white text-green-700 py-3 rounded-xl font-semibold shadow-md hover:bg-green-50 transition disabled:bg-white/40 disabled:text-gray-400"
              >
                {loading ? (
                  <div className="flex justify-center items-center gap-2">
                    <div className="w-5 h-5 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                    <span>Actualizando...</span>
                  </div>
                ) : (
                  'Actualizar contraseña'
                )}
              </motion.button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full text-white/60 hover:text-white text-sm transition text-center"
              >
                Volver al inicio de sesión
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
