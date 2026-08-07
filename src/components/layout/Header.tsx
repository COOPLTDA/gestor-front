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
const appName = (import.meta.env.VITE_APP_NAME as string | undefined) || "CoopGestion";
const appNameAccent = appName.slice(-Math.ceil(appName.length / 2));
const appNamePrefix = appName.slice(0, appName.length - appNameAccent.length);

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
      const res = await fetchWithAuth('/api/gestor/users/change-password', {
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
    document.title = `${appName} – ${formatted}`;
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  return (
    <>
    <header className="bg-card/90 backdrop-blur-sm border-b border-border h-16 flex items-center justify-between px-6 shadow-sm transition-all">
      {/* Izquierda */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-accent/60 transition-colors"
        >
          <Menu className="w-5 h-5 text-foreground/80" />
        </button>

        <Link to="/app/dashboard" className="flex flex-col leading-none group" title="Ir al inicio">
          <span className="font-display text-base font-800 font-extrabold text-foreground tracking-tight group-hover:text-primary transition-colors">
            {appNamePrefix}<span className="text-primary">{appNameAccent}</span>
          </span>
          <span className="font-display text-[11px] font-semibold text-muted-foreground tracking-widest uppercase mt-0.5">
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
              <span className="text-sm font-semibold text-foreground/80">{empresa}</span>
            )}
            {entorno && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                entorno.toLowerCase().includes('prod')
                  ? 'bg-accent text-primary border border-primary/20'
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
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent/60 transition-all"
          >
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-foreground">{user?.nombre}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-popover rounded-lg shadow-lg border border-border z-20">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{user?.nombre}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={openChangePassword}
                    className="flex items-center w-full px-3 py-2 text-sm text-foreground/80 hover:bg-accent/60 rounded-md transition-colors"
                  >
                    <KeyRound className="w-4 h-4 mr-3 text-primary" />
                    Cambiar contraseña
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 text-sm text-foreground/80 hover:bg-accent/60 rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-3 text-primary" />
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
            className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Header del modal */}
            <div className="bg-primary px-6 py-5 flex items-center gap-3">
              <div className="bg-primary-foreground/20 rounded-full p-2">
                <KeyRound className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-primary-foreground font-semibold text-base">Cambiar contraseña</h2>
                <p className="text-primary-foreground/80 text-xs mt-0.5">{user?.nombre}</p>
              </div>
            </div>

            <div className="p-6">
              {cpSuccess ? (
                <div className="text-center py-2">
                  <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
                  <p className="text-foreground font-medium mb-1">Contraseña actualizada</p>
                  <p className="text-muted-foreground text-sm mb-6">Tu contraseña fue cambiada correctamente.</p>
                  <button
                    onClick={closeChangePassword}
                    className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {/* Contraseña actual */}
                  <div>
                    <label className="block text-sm font-medium text-foreground/80 mb-1.5">Contraseña actual</label>
                    <div className="relative">
                      <input
                        type={cpShowCurrent ? 'text' : 'password'}
                        value={cpCurrent}
                        onChange={(e) => setCpCurrent(e.target.value)}
                        className="w-full border border-input rounded-lg px-3 py-2.5 text-sm pr-10 bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition"
                        placeholder="Tu contraseña actual"
                        required
                        disabled={cpLoading}
                        autoFocus
                      />
                      <button type="button" onClick={() => setCpShowCurrent(!cpShowCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                        {cpShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Nueva contraseña */}
                  <div>
                    <label className="block text-sm font-medium text-foreground/80 mb-1.5">Nueva contraseña</label>
                    <div className="relative">
                      <input
                        type={cpShowNew ? 'text' : 'password'}
                        value={cpNew}
                        onChange={(e) => setCpNew(e.target.value)}
                        className="w-full border border-input rounded-lg px-3 py-2.5 text-sm pr-10 bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition"
                        placeholder="Mínimo 6 caracteres"
                        required
                        minLength={6}
                        disabled={cpLoading}
                      />
                      <button type="button" onClick={() => setCpShowNew(!cpShowNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                        {cpShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar */}
                  <div>
                    <label className="block text-sm font-medium text-foreground/80 mb-1.5">Confirmar nueva contraseña</label>
                    <input
                      type="password"
                      value={cpConfirm}
                      onChange={(e) => setCpConfirm(e.target.value)}
                      className="w-full border border-input rounded-lg px-3 py-2.5 text-sm bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition"
                      placeholder="Repetí la nueva contraseña"
                      required
                      disabled={cpLoading}
                    />
                  </div>

                  {cpError && (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{cpError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={closeChangePassword} disabled={cpLoading}
                      className="flex-1 border border-input text-muted-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-accent/60 transition">
                      Cancelar
                    </button>
                    <button type="submit" disabled={cpLoading || !cpCurrent || !cpNew || !cpConfirm}
                      className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
                      {cpLoading ? (
                        <div className="flex justify-center items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
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
