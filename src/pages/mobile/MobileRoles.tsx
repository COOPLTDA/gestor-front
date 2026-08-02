import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import {
  ShieldCheck, Plus, Eye, EyeOff, Search, ChevronRight,
  XCircle, Edit, Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RolMobile {
  id: number;
  codigo: string;
  descripcion: string;
  activo: number;
}

interface FormRol {
  id: number | null;
  codigo: string;
  descripcion: string;
  activo: boolean;
}

export default function MobileRoles() {
  const [roles, setRoles] = useState<RolMobile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const [form, setForm] = useState<FormRol>({
    id: null,
    codigo: "",
    descripcion: "",
    activo: true,
  });

  const [soloActivos, setSoloActivos] = useState(false);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const safeJson = (res: any) => {
    if (!res || typeof res !== "object") {
      return { success: false, message: "Respuesta inválida del servidor." };
    }
    return res;
  };

  // =======================================================
  // Cargar roles
  // =======================================================
  const loadRoles = async () => {
    setLoading(true);
    const res = await fetchWithAuth("/api/distrigestion/mobile-admin/roles");
    const data = safeJson(res);
    if (data.success) {
      setRoles(data.data);
    } else {
      alert(data.message || "Error al obtener roles.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRoles();
  }, []);

  // =======================================================
  // Nuevo / Editar
  // =======================================================
  const openNew = () => {
    setErrorMsg("");
    setForm({ id: null, codigo: "", descripcion: "", activo: true });
    setModalOpen(true);
  };

  const openEdit = (r: RolMobile) => {
    setErrorMsg("");
    setForm({ id: r.id, codigo: r.codigo, descripcion: r.descripcion, activo: r.activo === 1 });
    setModalOpen(true);
  };

  // =======================================================
  // Guardar
  // =======================================================
  const save = async () => {
    setErrorMsg("");

    if (!form.codigo.trim()) {
      setErrorMsg("El código es obligatorio.");
      return;
    }

    const payload = {
      codigo: form.codigo.trim(),
      descripcion: form.descripcion.trim(),
      activo: form.activo ? 1 : 0,
    };

    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/distrigestion/mobile-admin/roles/${form.id}` : "/api/distrigestion/mobile-admin/roles";

    const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
    const data = safeJson(res);

    if (!data.success) {
      if (data.code === "DUPLICATE") {
        setErrorMsg("⚠ Ya existe un rol con este código.");
      } else {
        setErrorMsg(data.message || "Error al guardar el rol.");
      }
      return;
    }

    setModalOpen(false);
    loadRoles();
  };

  // =======================================================
  // Filtro
  // =======================================================
  const term = (search ?? "").toLowerCase();
  const rolesFiltrados = roles
    .filter((r) => (soloActivos ? r.activo === 1 : true))
    .filter((r) => {
      if (!term) return true;
      return (
        (r.codigo ?? "").toLowerCase().includes(term) ||
        (r.descripcion ?? "").toLowerCase().includes(term)
      );
    });

  const activos = roles.filter((r) => r.activo === 1).length;

  // =======================================================
  // UI
  // =======================================================
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            Roles Mobile
          </h1>
          <p className="text-gray-500 mt-1 ml-[52px] text-sm">
            {activos} activos · {roles.length} totales
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
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 transition flex items-center gap-2 shadow-sm"
            onClick={openNew}
          >
            <Plus className="w-4 h-4" />
            Nuevo Rol
          </button>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por código o descripción..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Lista de Roles</h2>
          <span className="text-xs text-gray-400">{rolesFiltrados.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3 text-left w-32">Código</th>
                  <th className="px-6 py-3 text-left">Descripción</th>
                  <th className="px-6 py-3 text-center w-28">Estado</th>
                  <th className="px-6 py-3 text-center w-20">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rolesFiltrados.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                        <Tag className="w-3 h-3" />
                        {r.codigo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.descripcion}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        r.activo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.activo ? "bg-emerald-500" : "bg-red-500"}`} />
                        {r.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        title="Editar"
                        className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-50 transition"
                        onClick={() => openEdit(r)}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rolesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <ShieldCheck className="w-8 h-8" />
                        <p className="text-sm">No se encontraron roles con los filtros aplicados</p>
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
          MODAL ALTA / EDICIÓN
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {form.id ? "Editar Rol" : "Nuevo Rol"}
                    </h2>
                    <p className="text-violet-200 text-sm mt-0.5">
                      {form.id ? `Modificando rol "${form.codigo}"` : "Completá los datos del nuevo rol"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">

                {/* Error */}
                {errorMsg && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Código */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-gray-400" /> Código
                  </label>
                  <input
                    disabled={!!form.id}
                    className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition ${
                      form.id ? "bg-gray-50 text-gray-400" : ""
                    }`}
                    placeholder="Ej: VEN, ADM..."
                    value={form.codigo}
                    onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value }))}
                  />
                </div>

                {/* Descripción */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Descripción</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                    placeholder="Descripción del rol"
                    value={form.descripcion}
                    onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  />
                </div>

                {/* Activo */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Estado del rol</div>
                    <div className="text-xs text-gray-400">Los roles inactivos no pueden asignarse</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, activo: !prev.activo }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.activo ? "bg-emerald-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.activo ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                {/* Botones */}
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
                    className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
                    onClick={save}
                  >
                    {form.id ? "Guardar Cambios" : "Crear Rol"}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
