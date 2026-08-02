import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Menu, LogOut, User, KeyRound, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { fetchWithAuth } from "@/utils/fetchWithAuth";

interface HeaderProps {
  onToggleSidebar: () => void;
}

const empresa = import.meta.env.VITE_APP_EMPRESA as string | undefined;
const entorno = import.meta.env.VITE_APP_ENTORNO as string | undefined;

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const [pageTitle, setPageTitle] = useState("Sistema Integral Empresarial");

  // Modal cambiar contraseña
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpSuccess, setCpSuccess] = useState(false);
  const [cpError, setCpError] = useState('');

  const openChangePassword = () => {
    setShowUserMenu(false);
    setCpCurrent(''); setCpNew(''); setCpConfirm('');
    setCpError(''); setCpSuccess(false);
    setShowChangePassword(true);
  };

  const closeChangePassword = () => {
    setShowChangePassword(false);
    setCpCurrent(''); setCpNew(''); setCpConfirm('');
    setCpError(''); setCpSuccess(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    if (cpNew.length < 6) { setCpError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (cpNew !== cpConfirm) { setCpError('Las contraseñas no coinciden.'); return; }
    setCpLoading(true);
    try {
      const res = await fetchWithAuth('/api/distrigestion/users/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json();
      if (data.success) {
        setCpSuccess(true);
      } else {
        setCpError(data.message || 'Error al cambiar la contraseña.');
      }
    } catch {
      setCpError('No se pudo conectar al servidor.');
    } finally {
      setCpLoading(false);
    }
  };

  useEffect(() => {
    const path = location.pathname.split("/").filter(Boolean).pop() || "inicio";
    const formatted =
      path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");
    setPageTitle(formatted);
    document.title = `DistriGestión – ${formatted}`;
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  return (
    <>
    <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm transition-all">
      {/* Izquierda */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        <Link to="/app/dashboard" className="flex flex-col leading-none group" title="Ir al inicio">
          <span className="font-display text-base font-800 font-extrabold text-slate-900 tracking-tight group-hover:text-blue-700 transition-colors">
            Distri<span className="text-emerald-500">Gestión</span>
          </span>
          <span className="font-display text-[11px] font-semibold text-slate-400 tracking-widest uppercase mt-0.5">
            {pageTitle}
          </span>
        </Link>
      </div>

      {/* Derecha */}
      <div className="flex items-center space-x-4">
        {/* Empresa + Entorno */}
        {(empresa || entorno) && (
          <div className="hidden sm:flex items-center gap-2">
            {empresa && (
              <span className="text-sm font-semibold text-slate-700">{empresa}</span>
            )}
            {entorno && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                entorno.toLowerCase().includes('prod')
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}>
                {entorno}
              </span>
            )}
          </div>
        )}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-blue-50 transition-all"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-800">{user?.nombre}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-20">
                <div className="p-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-slate-800">{user?.nombre}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={openChangePassword}
                    className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <KeyRound className="w-4 h-4 mr-3 text-blue-600" />
                    Cambiar contraseña
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-3 text-blue-600" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>

    {/* ===== MODAL CAMBIAR CONTRASEÑA ===== */}
    <AnimatePresence>
      {showChangePassword && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeChangePassword(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">Cambiar contraseña</h2>
                <p className="text-blue-100 text-xs mt-0.5">{user?.nombre}</p>
              </div>
            </div>

            <div className="p-6">
              {cpSuccess ? (
                <div className="text-center py-2">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-slate-700 font-medium mb-1">Contraseña actualizada</p>
                  <p className="text-slate-500 text-sm mb-6">Tu contraseña fue cambiada correctamente.</p>
                  <button
                    onClick={closeChangePassword}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {/* Contraseña actual */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña actual</label>
                    <div className="relative">
                      <input
                        type={cpShowCurrent ? 'text' : 'password'}
                        value={cpCurrent}
                        onChange={(e) => setCpCurrent(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Tu contraseña actual"
                        required
                        disabled={cpLoading}
                        autoFocus
                      />
                      <button type="button" onClick={() => setCpShowCurrent(!cpShowCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                        {cpShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Nueva contraseña */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva contraseña</label>
                    <div className="relative">
                      <input
                        type={cpShowNew ? 'text' : 'password'}
                        value={cpNew}
                        onChange={(e) => setCpNew(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Mínimo 6 caracteres"
                        required
                        minLength={6}
                        disabled={cpLoading}
                      />
                      <button type="button" onClick={() => setCpShowNew(!cpShowNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                        {cpShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar nueva contraseña</label>
                    <input
                      type="password"
                      value={cpConfirm}
                      onChange={(e) => setCpConfirm(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="Repetí la nueva contraseña"
                      required
                      disabled={cpLoading}
                    />
                  </div>

                  {cpError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{cpError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={closeChangePassword} disabled={cpLoading}
                      className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
                      Cancelar
                    </button>
                    <button type="submit" disabled={cpLoading || !cpCurrent || !cpNew || !cpConfirm}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:bg-blue-300">
                      {cpLoading ? (
                        <div className="flex justify-center items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Guardando...</span>
                        </div>
                      ) : 'Guardar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default Header;
