import React, { useEffect, useState } from 'react';
import {
  Users, UserPlus, Edit, Shield, EyeOff, Eye, Ban,
  Settings2, CheckCircle, XCircle, Star, User, Mail,
  Lock, AtSign, ChevronRight, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPermisosArbol from './components/ModalPermisosArbol';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

// ========================
//  INTERFACES
// ========================
interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre: string;
  activo: number;
  role?: string;
}

// ========================
//  CONSTANTES
// ========================
const ROLES = [
  {
    value: 'admin',
    label: 'Administrador',
    desc: 'Acceso total al sistema',
    icon: Shield,
    color: 'from-purple-500 to-indigo-600',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800',
  },
  {
    value: 'avanzado',
    label: 'Avanzado',
    desc: 'Sin gestión de usuarios y roles',
    icon: Star,
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
  },
  {
    value: 'usuario',
    label: 'Simple',
    desc: 'Solo páginas asignadas',
    icon: User,
    color: 'from-gray-400 to-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700',
  },
];

const defaultUser: Usuario & { password?: string } = {
  id: 0,
  username: '',
  nombre: '',
  email: '',
  role: 'usuario',
  activo: 1,
  password: '12345678',
};

// ========================
//  HELPERS
// ========================
function getRoleInfo(role?: string) {
  return ROLES.find(r => r.value === role) ?? ROLES[2];
}

function getInitials(nombre: string) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

// ========================
//  COMPONENTE PRINCIPAL
// ========================
const Usuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mostrarSoloActivos, setMostrarSoloActivos] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalPermisos, setModalPermisos] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  const [form, setForm] = useState<Usuario & { password?: string }>(defaultUser);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean; usuario?: Usuario; accion?: 'bloquear' | 'desbloquear';
  }>({ show: false });

  const [feedback, setFeedback] = useState<{
    show: boolean; success: boolean; message: string;
  }>({ show: false, success: true, message: '' });

  // ========================
  // CARGA USUARIOS
  // ========================
  const fetchUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth('/api/distrigestion/users');
      if (!response.ok) throw new Error('Error cargando usuarios');
      const result = await response.json() as { data: Usuario[] };
      setUsuarios(
        result.data.map((u: Usuario) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          nombre: u.nombre,
          activo: u.activo ? 1 : 0,
          role: u.role,
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  // ========================
  // FORMULARIO
  // ========================
  const onChangeForm = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const openModal = (user?: Usuario) => {
    setShowPassword(false);
    if (user) {
      setForm({ ...user, password: '' });
      setEditingUser(user);
    } else {
      setForm({ ...defaultUser, password: '12345678' });
      setEditingUser(null);
    }
    setModalOpen(true);
  };

  // ========================
  // GUARDAR USUARIO
  // ========================
  const saveUsuario = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);

    try {
      if (!form.nombre || !form.email || !form.role || !form.username) {
        setFeedback({ show: true, success: false, message: 'Todos los campos son obligatorios' });
        return;
      }

      let response;

      if (editingUser) {
        const body: Record<string, unknown> = {
          nombre: form.nombre,
          username: form.username,
          email: form.email,
          role: form.role,
          activo: form.activo,
        };
        if (form.password) body.password = form.password;

        response = await fetchWithAuth(`/api/distrigestion/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        const body: Record<string, unknown> = {
          nombre: form.nombre,
          username: form.username,
          email: form.email,
          role: form.role,
          activo: Boolean(form.activo),
        };
        if (form.password && form.password.trim() !== '') {
          body.password = form.password;
        }

        response = await fetchWithAuth('/api/distrigestion/users', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        let msg = 'Error guardando usuario';
        try {
          const err = await response.json() as { message?: string; details?: { field: string; message: string }[] };
          msg = err.message ?? msg;
          if (err.details?.length) {
            msg += ': ' + err.details.map(d => `${d.field} - ${d.message}`).join(', ');
          }
        } catch { /* ignore */ }
        setFeedback({ show: true, success: false, message: msg });
        return;
      }

      setModalOpen(false);
      fetchUsuarios();
      setFeedback({
        show: true,
        success: true,
        message: editingUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente. Contraseña inicial: 12345678',
      });
    } catch (err: unknown) {
      setFeedback({
        show: true,
        success: false,
        message: err instanceof Error ? err.message : 'Error desconocido',
      });
    } finally {
      setSaving(false);
    }
  };

  // ========================
  // BLOQUEAR / DESBLOQUEAR
  // ========================
  const openConfirmModal = (usuario: Usuario, accion: 'bloquear' | 'desbloquear') => {
    setConfirmModal({ show: true, usuario, accion });
  };

  const confirmarAccion = async () => {
    if (!confirmModal.usuario) return;
    const { id } = confirmModal.usuario;
    const esBloqueo = confirmModal.accion === 'bloquear';

    try {
      const response = await fetchWithAuth(`/api/distrigestion/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ activo: !esBloqueo }),
      });
      setConfirmModal({ show: false });
      if (!response.ok) {
        setFeedback({
          show: true,
          success: false,
          message: `No se pudo ${esBloqueo ? 'bloquear' : 'desbloquear'} el usuario`,
        });
        return;
      }
      await fetchUsuarios();
      setFeedback({
        show: true,
        success: true,
        message: `Usuario ${esBloqueo ? 'bloqueado' : 'desbloqueado'} correctamente`,
      });
    } catch {
      setFeedback({
        show: true,
        success: false,
        message: `No se pudo ${esBloqueo ? 'bloquear' : 'desbloquear'} el usuario`,
      });
      setConfirmModal({ show: false });
    }
  };

  // ========================
  // PERMISOS
  // ========================
  const openPermisos = (usuario: Usuario) => {
    setEditingUser(usuario);
    setModalPermisos(true);
  };

  // ========================
  // FILTRADO
  // ========================
  const usuariosFiltrados = mostrarSoloActivos
    ? usuarios.filter(u => u.activo)
    : usuarios;

  const activos = usuarios.filter(u => u.activo).length;

  // ========================
  // LOADING / ERROR
  // ========================
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 mt-4 flex items-center gap-3">
        <XCircle className="w-6 h-6 text-red-600 shrink-0" />
        <div>
          <div className="text-red-800 font-bold">Error</div>
          <div className="text-red-700 text-sm">{error}</div>
        </div>
      </div>
    );

  // ========================
  // RENDER
  // ========================
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
              <Users className="w-5 h-5 text-white" />
            </div>
            Gestión de Usuarios
          </h1>
          <p className="text-gray-500 mt-1 ml-[52px] text-sm">
            {activos} activos · {usuarios.length} totales
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${
              mostrarSoloActivos
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-gray-100 border-gray-200 text-gray-600'
            }`}
            onClick={() => setMostrarSoloActivos(v => !v)}
          >
            {mostrarSoloActivos
              ? <><Eye className="w-4 h-4" /> Solo activos</>
              : <><EyeOff className="w-4 h-4" /> Todos</>}
          </button>

          <button
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 transition flex items-center gap-2 shadow-sm"
            onClick={() => openModal()}
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Lista de Usuarios</h2>
          <span className="text-xs text-gray-400">{usuariosFiltrados.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Usuario</th>
                <th className="px-6 py-3 text-center w-32">Rol</th>
                <th className="px-6 py-3 text-center w-28">Estado</th>
                <th className="px-6 py-3 text-center w-32">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usuariosFiltrados.map(usuario => {
                const roleInfo = getRoleInfo(usuario.role);
                const initials = getInitials(usuario.nombre);
                return (
                  <tr key={usuario.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${roleInfo.color} ${!usuario.activo ? 'opacity-40 grayscale' : ''}`}>
                          {initials || <Users className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${usuario.activo ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                            {usuario.nombre}
                          </div>
                          <div className="text-xs text-gray-400">@{usuario.username}</div>
                          <div className="text-xs text-gray-400">{usuario.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.badge}`}>
                        <roleInfo.icon className="w-3 h-3" />
                        {roleInfo.label}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        usuario.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${usuario.activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {usuario.activo ? 'Activo' : 'Bloqueado'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-1">
                        <button
                          title="Editar"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                          onClick={() => openModal(usuario)}
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {usuario.role !== 'admin' && (
                          <button
                            title="Permisos"
                            className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-50 transition"
                            onClick={() => openPermisos(usuario)}
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                        )}

                        {usuario.activo ? (
                          <button
                            title="Bloquear"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                            onClick={() => openConfirmModal(usuario, 'bloquear')}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            title="Desbloquear"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                            onClick={() => openConfirmModal(usuario, 'desbloquear')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================== */}
      {/* MODAL ALTA / EDICIÓN     */}
      {/* ======================== */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
          >
            <motion.div
              key="modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header del modal */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    {editingUser ? (
                      <span className="text-white font-bold text-lg">
                        {getInitials(editingUser.nombre)}
                      </span>
                    ) : (
                      <UserPlus className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h2>
                    <p className="text-blue-200 text-sm mt-0.5">
                      {editingUser
                        ? `Modificando @${editingUser.username}`
                        : 'Completá los datos del nuevo usuario'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <form onSubmit={saveUsuario} className="p-6 space-y-5">

                {/* Nombre */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" /> Nombre completo
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Ej: Juan García"
                    value={form.nombre}
                    onChange={e => onChangeForm('nombre', e.target.value)}
                    required
                  />
                </div>

                {/* Username + Email en grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-gray-400" /> Usuario
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="usuario"
                      autoComplete="off"
                      value={form.username}
                      onChange={e => onChangeForm('username', e.target.value)}
                      required
                      minLength={3}
                    />
                    <p className="text-xs text-gray-400 mt-1">Solo letras, números, puntos, guiones y guiones bajos</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-400" /> Email
                    </label>
                    <input
                      type="email"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder="usuario@mail.com"
                      value={form.email}
                      onChange={e => onChangeForm('email', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Selector de Rol */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-gray-400" /> Rol
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map(rol => {
                      const selected = form.role === rol.value;
                      return (
                        <button
                          key={rol.value}
                          type="button"
                          onClick={() => onChangeForm('role', rol.value)}
                          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                            selected
                              ? `${rol.border} ${rol.bg} shadow-sm`
                              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${rol.color}`}>
                            <rol.icon className="w-4 h-4 text-white" />
                          </div>
                          <span className={`text-xs font-semibold ${selected ? rol.text : 'text-gray-600'}`}>
                            {rol.label}
                          </span>
                          <span className="text-[10px] text-gray-400 leading-tight">{rol.desc}</span>
                          {selected && (
                            <motion.div
                              layoutId="role-check"
                              className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"
                            >
                              <CheckCircle className="w-3 h-3 text-white" />
                            </motion.div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    {editingUser ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder={editingUser ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
                      autoComplete="new-password"
                      value={form.password ?? ''}
                      onChange={e => onChangeForm('password', e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      onClick={() => setShowPassword(v => !v)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!editingUser && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      Si no ingresás contraseña se asignará <b>12345678</b> por defecto
                    </p>
                  )}
                </div>

                {/* Toggle activo (solo edición) */}
                {editingUser && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Estado del usuario</div>
                      <div className="text-xs text-gray-400">Un usuario bloqueado no puede iniciar sesión</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeForm('activo', form.activo ? 0 : 1)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.activo ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.activo ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PERMISOS */}
      {modalPermisos && editingUser && (
        <ModalPermisosArbol
          userId={editingUser.id}
          userName={editingUser.nombre}
          onClose={() => setModalPermisos(false)}
          feedback={setFeedback}
        />
      )}

      {/* CONFIRMA BLOQUEO/DESBLOQUEO */}
      <AnimatePresence>
        {confirmModal.show && confirmModal.usuario && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                confirmModal.accion === 'bloquear' ? 'bg-red-100' : 'bg-emerald-100'
              }`}>
                {confirmModal.accion === 'bloquear'
                  ? <Ban className="w-6 h-6 text-red-600" />
                  : <Eye className="w-6 h-6 text-emerald-600" />}
              </div>

              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {confirmModal.accion === 'bloquear' ? 'Bloquear usuario' : 'Desbloquear usuario'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                ¿Seguro que deseas {confirmModal.accion === 'bloquear' ? 'bloquear' : 'desbloquear'} a{' '}
                <span className="font-semibold text-gray-700">{confirmModal.usuario.nombre}</span>?
              </p>

              <div className="flex gap-3">
                <button
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                  onClick={() => setConfirmModal({ show: false })}
                >
                  Cancelar
                </button>
                <button
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition ${
                    confirmModal.accion === 'bloquear'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                  onClick={confirmarAccion}
                >
                  Sí, {confirmModal.accion === 'bloquear' ? 'bloquear' : 'desbloquear'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FEEDBACK */}
      <AnimatePresence>
        {feedback.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-xs w-full text-center"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                feedback.success ? 'bg-emerald-100' : 'bg-red-100'
              }`}>
                {feedback.success
                  ? <CheckCircle className="w-8 h-8 text-emerald-600" />
                  : <XCircle className="w-8 h-8 text-red-600" />}
              </div>
              <p className={`font-semibold text-base mb-5 ${feedback.success ? 'text-emerald-700' : 'text-red-700'}`}>
                {feedback.message}
              </p>
              <button
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-xl text-sm font-medium transition"
                onClick={() => setFeedback(prev => ({ ...prev, show: false }))}
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Usuarios;
