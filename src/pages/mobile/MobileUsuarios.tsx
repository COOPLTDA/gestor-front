import React, { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import {
  Smartphone, UserPlus, Eye, EyeOff, User, Lock, AtSign,
  Search, ChevronRight, AlertTriangle, X, ShieldCheck, CheckCircle,
  XCircle, Edit,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// =======================================================
// Types
// =======================================================
type UsuarioMobile = {
  id: number;
  usuario: string;
  nombre: string;
  activo: number;
  rol_id: number;
  rol_codigo: string;
};

type Rol = {
  id: number;
  codigo: string;
  descripcion: string;
};

type Vendedor = {
  idvendedor: number;
  nombrevendedor: string;
};

type FormUsuario = {
  id: number | null;
  rol_id: number | null;
  vendedorId: number | null;
  usuario: string;
  nombre: string;
  password: string;
  activo: boolean;
};

// =======================================================
// Helpers
// =======================================================
const ROLE_GRADIENTS = [
  "from-purple-500 to-indigo-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
];

const ROLE_BADGES = [
  "bg-purple-100 text-purple-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function rolHash(codigo: string, arr: string[]) {
  let h = 0;
  for (let i = 0; i < codigo.length; i++) h = (h + codigo.charCodeAt(i)) % arr.length;
  return arr[h];
}

function getInitials(nombre: string) {
  return nombre.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?";
}

// =======================================================
// Component
// =======================================================
export default function MobileUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioMobile[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [helperVendedorOpen, setHelperVendedorOpen] = useState(false);

  const [rolFilter, setRolFilter] = useState("todos");
  const [soloActivos, setSoloActivos] = useState(false);
  const [search, setSearch] = useState("");
  const [searchVend, setSearchVend] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<FormUsuario>({
    id: null,
    rol_id: null,
    vendedorId: null,
    usuario: "",
    nombre: "",
    password: "",
    activo: true,
  });

  const safeJson = (res: any) =>
    typeof res === "object" ? res : { success: false, message: "Respuesta inválida" };

  // =======================================================
  // LOADERS
  // =======================================================
  const loadUsuarios = async () => {
    setLoading(true);
    const res = await fetchWithAuth("/api/gestor/mobile-admin/usuarios");
    const data = safeJson(res);
    if (data.success) setUsuarios(data.data);
    setLoading(false);
  };

  const loadRoles = async () => {
    const res = await fetchWithAuth("/api/gestor/mobile-admin/roles");
    const data = safeJson(res);
    if (data.success) setRoles(data.data);
  };

  const loadVendedores = async () => {
    const res = await fetchWithAuth("/api/gestor/mobile-admin/vendedores");
    const data = safeJson(res);
    if (data.success) {
      const ordenados = [...data.data].sort(
        (a: Vendedor, b: Vendedor) => a.idvendedor - b.idvendedor
      );
      setVendedores(ordenados);
    }
  };

  useEffect(() => {
    loadUsuarios();
    loadRoles();
    loadVendedores();
  }, []);

  // =======================================================
  // Identificación de rol vendedor
  // =======================================================
  const rolVendedor = roles.find((r) =>
    ["VEN", "VENDEDOR", "VEND"].includes(r.codigo.toUpperCase())
  );
  const ROL_VEND_ID = rolVendedor?.id ?? null;
  const isVendedor = form.rol_id === ROL_VEND_ID;

  // =======================================================
  // Nuevo / Editar
  // =======================================================
  const openNew = () => {
    setEditMode(false);
    setErrorMsg("");
    setShowPassword(false);
    setForm({ id: null, rol_id: null, vendedorId: null, usuario: "", nombre: "", password: "", activo: true });
    setModalOpen(true);
  };

  const openEdit = (u: UsuarioMobile) => {
    setEditMode(true);
    setErrorMsg("");
    setShowPassword(false);
    const esVend = u.rol_id === ROL_VEND_ID;
    setForm({
      id: u.id,
      rol_id: u.rol_id,
      vendedorId: esVend ? Number(u.usuario) : null,
      usuario: u.usuario,
      nombre: u.nombre,
      password: "",
      activo: u.activo === 1,
    });
    setModalOpen(true);
  };

  // =======================================================
  // Cambio de rol
  // =======================================================
  const onChangeRol = (rolId: number) => {
    const esVend = rolId === ROL_VEND_ID;
    setForm((prev) => ({
      ...prev,
      rol_id: rolId,
      vendedorId: null,
      usuario: esVend ? "" : prev.usuario,
      nombre: esVend ? "" : prev.nombre,
    }));
  };

  // =======================================================
  // Helper vendedor
  // =======================================================
  const abrirHelperVendedor = () => {
    setHelperVendedorOpen(true);
  };

  const idsVendUsados = usuarios
    .filter((u) => u.rol_id === ROL_VEND_ID)
    .filter((u) => u.id !== form.id)
    .map((u) => Number(u.usuario))
    .filter((n) => !isNaN(n));

  const vendedoresDisponibles = vendedores.filter(
    (v) => !idsVendUsados.includes(v.idvendedor)
  );

  const filtroVend = (searchVend ?? "").toLowerCase();
  const vendedoresFiltrados = vendedoresDisponibles.filter((v) => {
    const name = (v.nombrevendedor ?? "").toLowerCase();
    const id = (v.idvendedor?.toString() ?? "").toLowerCase();
    return name.includes(filtroVend) || id.includes(filtroVend);
  });

  const seleccionarVendedor = (v: Vendedor) => {
    const exists = usuarios.some(
      (u) => Number(u.usuario) === v.idvendedor && u.id !== form.id
    );
    if (exists) {
      setErrorMsg("Este vendedor ya está asignado a otro usuario.");
      setHelperVendedorOpen(false);
      return;
    }
    setForm((prev) => ({
      ...prev,
      vendedorId: v.idvendedor,
      usuario: v.idvendedor.toString(),
      nombre: v.nombrevendedor,
    }));
    setHelperVendedorOpen(false);
  };

  // =======================================================
  // Guardar
  // =======================================================
  const save = async () => {
    setErrorMsg("");

    if (!form.rol_id) {
      setErrorMsg("Debe seleccionar un rol.");
      return;
    }
    if (!editMode && isVendedor && !form.vendedorId) {
      setErrorMsg("Debe seleccionar un vendedor.");
      return;
    }

    const finalPassword = form.password.trim() === "" ? "123456" : form.password;
    const payload: any = {
      usuario: form.usuario,
      nombre: form.nombre,
      password: finalPassword,
      activo: form.activo ? 1 : 0,
      rol_id: form.rol_id,
      vendedorId: form.vendedorId,
    };

    const method = editMode ? "PUT" : "POST";
    const url = editMode ? `/api/gestor/mobile-admin/usuarios/${form.id}` : "/api/gestor/mobile-admin/usuarios";

    const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
    const data = safeJson(res);

    if (!data.success) {
      if (data.code === "DUPLICATE") {
        setErrorMsg("⚠ El usuario ya existe. Si está creando un vendedor, verifique que ese vendedor no esté asignado a otro usuario.");
      } else {
        setErrorMsg(data.message || "Error al guardar el usuario.");
      }
      return;
    }

    setModalOpen(false);
    loadUsuarios();
  };

  // =======================================================
  // Filtrado tabla
  // =======================================================
  const term = (search ?? "").toLowerCase();
  const usersFiltrados = usuarios
    .filter((u) => (soloActivos ? u.activo === 1 : true))
    .filter((u) => (rolFilter === "todos" ? true : (u.rol_codigo ?? "") === rolFilter))
    .filter((u) => {
      if (!term) return true;
      return (
        (u.usuario ?? "").toLowerCase().includes(term) ||
        (u.nombre ?? "").toLowerCase().includes(term) ||
        (u.rol_codigo ?? "").toLowerCase().includes(term)
      );
    });

  const activos = usuarios.filter((u) => u.activo === 1).length;

  // =======================================================
  // UI
  // =======================================================
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            Usuarios Mobile
          </h1>
          <p className="text-gray-500 mt-1 ml-[52px] text-sm">
            {activos} activos · {usuarios.length} totales
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${
              soloActivos
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-gray-100 border-gray-200 text-gray-600"
            }`}
            onClick={() => setSoloActivos((v) => !v)}
          >
            {soloActivos ? <><Eye className="w-4 h-4" /> Solo activos</> : <><EyeOff className="w-4 h-4" /> Todos</>}
          </button>

          <button
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 transition flex items-center gap-2 shadow-sm"
            onClick={openNew}
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por usuario, nombre o rol..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            autoComplete="off"
            name="mobile-usuarios-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
          value={rolFilter}
          onChange={(e) => setRolFilter(e.target.value)}
        >
          <option value="todos">Todos los roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.codigo}>{r.codigo}</option>
          ))}
        </select>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Lista de Usuarios</h2>
          <span className="text-xs text-gray-400">{usersFiltrados.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3 text-left">Usuario</th>
                  <th className="px-6 py-3 text-center w-32">Rol</th>
                  <th className="px-6 py-3 text-center w-28">Estado</th>
                  <th className="px-6 py-3 text-center w-20">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {usersFiltrados.map((u) => {
                  const initials = getInitials(u.nombre);
                  const gradient = rolHash(u.rol_codigo ?? "", ROLE_GRADIENTS);
                  const badge = rolHash(u.rol_codigo ?? "", ROLE_BADGES);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${gradient} ${!u.activo ? "opacity-40 grayscale" : ""}`}>
                            {initials}
                          </div>
                          <div>
                            <div className={`text-sm font-semibold ${u.activo ? "text-gray-900" : "text-gray-400 line-through"}`}>
                              {u.nombre}
                            </div>
                            <div className="text-xs text-gray-400">@{u.usuario}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge}`}>
                          <ShieldCheck className="w-3 h-3" />
                          {u.rol_codigo}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.activo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? "bg-emerald-500" : "bg-red-500"}`} />
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <button
                          title="Editar"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                          onClick={() => openEdit(u)}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {usersFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <User className="w-8 h-8" />
                        <p className="text-sm">No se encontraron usuarios con los filtros aplicados</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ======================================================
          MODAL USUARIO (ALTA / EDICIÓN)
      ====================================================== */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) { setModalOpen(false); setErrorMsg(""); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    {editMode ? (
                      <span className="text-white font-bold text-lg">{getInitials(form.nombre)}</span>
                    ) : (
                      <UserPlus className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {editMode ? "Editar Usuario" : "Nuevo Usuario"}
                    </h2>
                    <p className="text-blue-200 text-sm mt-0.5">
                      {editMode ? `Modificando @${form.usuario}` : "Completá los datos del nuevo usuario"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

                {/* Error */}
                {errorMsg && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* ROL */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-gray-400" /> Rol
                  </label>
                  <select
                    disabled={editMode && form.rol_id === ROL_VEND_ID}
                    className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                      editMode && form.rol_id === ROL_VEND_ID ? "bg-gray-50 text-gray-400" : "bg-white"
                    }`}
                    value={form.rol_id || ""}
                    onChange={(e) => onChangeRol(Number(e.target.value))}
                  >
                    <option value="">Seleccione un rol...</option>
                    {roles
                      .filter((r) =>
                        editMode
                          ? form.rol_id === ROL_VEND_ID
                            ? r.id === ROL_VEND_ID
                            : r.id !== ROL_VEND_ID
                          : true
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.codigo} — {r.descripcion}
                        </option>
                      ))}
                  </select>
                </div>

                {/* SECCIÓN VENDEDOR */}
                {!editMode && isVendedor && (
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-0.5">
                          Vendedor seleccionado
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {form.vendedorId ? `${form.vendedorId} — ${form.nombre}` : "Ninguno"}
                        </div>
                      </div>
                      <button
                        className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg text-xs font-medium hover:opacity-90 transition"
                        onClick={abrirHelperVendedor}
                      >
                        Seleccionar
                      </button>
                    </div>
                  </div>
                )}

                {/* USUARIO */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <AtSign className="w-3.5 h-3.5 text-gray-400" /> Usuario
                  </label>
                  <input
                    disabled={editMode || isVendedor}
                    className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                      editMode || isVendedor ? "bg-gray-50 text-gray-400" : ""
                    }`}
                    placeholder="nombre_usuario"
                    autoComplete="off"
                    name="mobile-form-usuario"
                    value={form.usuario}
                    onChange={(e) => setForm((prev) => ({ ...prev, usuario: e.target.value }))}
                  />
                </div>

                {/* NOMBRE */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" /> Nombre
                  </label>
                  <input
                    disabled={isVendedor}
                    className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                      isVendedor ? "bg-gray-50 text-gray-400" : ""
                    }`}
                    placeholder="Nombre completo"
                    value={form.nombre}
                    onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  />
                </div>

                {/* PASSWORD */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    {editMode ? "Nueva Contraseña (opcional)" : "Contraseña"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      placeholder={editMode ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!editMode && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      Si no ingresás contraseña se asignará <b>123456</b> por defecto
                    </p>
                  )}
                </div>

                {/* ACTIVO */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Estado del usuario</div>
                    <div className="text-xs text-gray-400">Un usuario inactivo no puede iniciar sesión</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, activo: !prev.activo }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.activo ? "bg-emerald-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.activo ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                {/* BOTONES */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                    onClick={() => { setModalOpen(false); setErrorMsg(""); }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
                    onClick={save}
                  >
                    {editMode ? "Guardar Cambios" : "Crear Usuario"}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================
          HELPER VENDEDOR
      ====================================================== */}
      <AnimatePresence>
        {helperVendedorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setHelperVendedorOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Seleccionar vendedor</h3>
                <button
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                  onClick={() => setHelperVendedorOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 pt-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    placeholder="Buscar por nombre o ID..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    value={searchVend}
                    onChange={(e) => setSearchVend(e.target.value)}
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-auto max-h-64 mx-4 mb-4 border border-gray-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0">
                      <th className="px-4 py-2.5 text-center w-16">ID</th>
                      <th className="px-4 py-2.5 text-left">Nombre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {vendedoresFiltrados.map((v) => (
                      <tr
                        key={v.idvendedor}
                        className="hover:bg-blue-50 cursor-pointer transition"
                        onClick={() => seleccionarVendedor(v)}
                      >
                        <td className="px-4 py-2.5 text-center text-gray-500">{v.idvendedor}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{v.nombrevendedor}</td>
                      </tr>
                    ))}
                    {vendedoresFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-gray-400 text-sm">
                          No hay vendedores disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
