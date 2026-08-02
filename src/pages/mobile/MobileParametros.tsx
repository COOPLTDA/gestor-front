import React, { useEffect, useState } from "react";
import { fetchWithAuth } from "../../utils/fetchWithAuth";
import {
  Settings2, Plus, Search, ChevronRight, XCircle, Edit,
  Code, AlignLeft, Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ParametroMobile {
  id: number;
  codigo: string;
  valor: string;
  descripcion: string;
  fecha_actualizacion: string;
}

interface FormParametro {
  id: number | null;
  codigo: string;
  valor: string;
  descripcion: string;
}

export default function MobileParametros() {
  const [parametros, setParametros] = useState<ParametroMobile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState<FormParametro>({
    id: null,
    codigo: "",
    valor: "",
    descripcion: "",
  });

  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const safeJson = (res: any) => {
    if (!res || typeof res !== "object") {
      return { success: false, message: "Respuesta inválida del servidor." };
    }
    return res;
  };

  // =======================================================
  // CARGAR PARÁMETROS
  // =======================================================
  const loadParametros = async () => {
    setLoading(true);
    const res = await fetchWithAuth("/api/distrigestion/mobile-admin/parametros");
    const data = safeJson(res);
    if (data.success) {
      setParametros(data.data);
    } else {
      alert(data.message || "Error obteniendo parámetros");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadParametros();
  }, []);

  // =======================================================
  const openNew = () => {
    setErrorMsg("");
    setForm({ id: null, codigo: "", valor: "", descripcion: "" });
    setModalOpen(true);
  };

  const openEdit = (p: ParametroMobile) => {
    setErrorMsg("");
    setForm({ id: p.id, codigo: p.codigo, valor: p.valor, descripcion: p.descripcion });
    setModalOpen(true);
  };

  // =======================================================
  // GUARDAR
  // =======================================================
  const save = async () => {
    setErrorMsg("");

    if (!form.codigo.trim()) {
      setErrorMsg("El código es obligatorio.");
      return;
    }

    const payload = {
      codigo: form.codigo.trim(),
      valor: form.valor.trim(),
      descripcion: form.descripcion.trim(),
    };

    let url = "/api/distrigestion/mobile-admin/parametros";
    let method = "POST";

    if (form.id) {
      url = `/api/distrigestion/mobile-admin/parametros/${form.id}`;
      method = "PUT";
    }

    const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
    const data = safeJson(res);

    if (!data.success) {
      if (data.code === "DUPLICATE") {
        setErrorMsg("⚠ Ya existe un parámetro con este código.");
      } else {
        setErrorMsg(data.message || "Error al guardar el parámetro.");
      }
      return;
    }

    setModalOpen(false);
    loadParametros();
  };

  // =======================================================
  // FILTRO TABLA
  // =======================================================
  const term = (search ?? "").toLowerCase();
  const parametrosFiltrados = parametros.filter((p) => {
    if (!term) return true;
    return (
      (p.codigo ?? "").toLowerCase().includes(term) ||
      (p.valor ?? "").toLowerCase().includes(term) ||
      (p.descripcion ?? "").toLowerCase().includes(term)
    );
  });

  // =======================================================
  // UI
  // =======================================================
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            Parámetros Mobile
          </h1>
          <p className="text-gray-500 mt-1 ml-[52px] text-sm">
            {parametros.length} parámetro{parametros.length !== 1 ? "s" : ""} configurado{parametros.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 transition flex items-center gap-2 shadow-sm"
          onClick={openNew}
        >
          <Plus className="w-4 h-4" />
          Nuevo Parámetro
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por código, valor o descripción..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Lista de Parámetros</h2>
          <span className="text-xs text-gray-400">{parametrosFiltrados.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3 text-left w-36">Código</th>
                  <th className="px-6 py-3 text-left">Valor</th>
                  <th className="px-6 py-3 text-left">Descripción</th>
                  <th className="px-6 py-3 text-center w-36">Actualizado</th>
                  <th className="px-6 py-3 text-center w-20">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parametrosFiltrados.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        <Code className="w-3 h-3" />
                        {p.codigo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-[160px] truncate">{p.valor}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{p.descripcion}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.fecha_actualizacion).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        title="Editar"
                        className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition"
                        onClick={() => openEdit(p)}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {parametrosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Settings2 className="w-8 h-8" />
                        <p className="text-sm">No se encontraron parámetros con el filtro aplicado</p>
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
          MODAL
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
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Settings2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {form.id ? "Editar Parámetro" : "Nuevo Parámetro"}
                    </h2>
                    <p className="text-amber-100 text-sm mt-0.5">
                      {form.id ? `Modificando "${form.codigo}"` : "Completá los datos del parámetro"}
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
                    <Code className="w-3.5 h-3.5 text-gray-400" /> Código
                  </label>
                  <input
                    disabled={!!form.id}
                    className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition ${
                      form.id ? "bg-gray-50 text-gray-400" : ""
                    }`}
                    placeholder="Ej: TIMEOUT_SESION"
                    value={form.codigo}
                    onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value }))}
                  />
                </div>

                {/* Valor */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5 text-gray-400" /> Valor
                  </label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition resize-none h-20"
                    placeholder="Valor del parámetro"
                    value={form.valor}
                    onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))}
                  />
                </div>

                {/* Descripción */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Descripción</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                    placeholder="Descripción del parámetro"
                    value={form.descripcion}
                    onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  />
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
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
                    onClick={save}
                  >
                    {form.id ? "Guardar Cambios" : "Crear Parámetro"}
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
