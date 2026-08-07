import React, { useEffect, useState, useMemo } from "react";
import {
  Plus, Pencil, XCircle, CheckCircle, RefreshCw,
  Search, Eye, EyeOff, ChevronDown, ChevronRight,
} from "lucide-react";
import { fetchWithAuth } from "../utils/fetchWithAuth";

interface Parametro {
  id: number;
  codigo: string;
  valor: string;
  descripcion: string;
  interfaz: string;
  activo: number;
  fecha_actualizacion: string;
}

const MODULE_BORDERS = [
  "border-l-blue-400",
  "border-l-violet-400",
  "border-l-emerald-400",
  "border-l-amber-400",
  "border-l-rose-400",
  "border-l-cyan-400",
  "border-l-orange-400",
  "border-l-teal-400",
  "border-l-indigo-400",
  "border-l-pink-400",
];

const MODULE_BADGES = [
  "bg-blue-50 text-blue-700 border border-blue-200",
  "bg-violet-50 text-violet-700 border border-violet-200",
  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "bg-amber-50 text-amber-700 border border-amber-200",
  "bg-rose-50 text-rose-700 border border-rose-200",
  "bg-cyan-50 text-cyan-700 border border-cyan-200",
  "bg-orange-50 text-orange-700 border border-orange-200",
  "bg-teal-50 text-teal-700 border border-teal-200",
  "bg-indigo-50 text-indigo-700 border border-indigo-200",
  "bg-pink-50 text-pink-700 border border-pink-200",
];

const Parametros: React.FC = () => {
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Parametro | null>(null);
  const [mostrarSoloActivos, setMostrarSoloActivos] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ show: boolean; success: boolean; message: string }>({
    show: false, success: true, message: "",
  });

  const fetchParametros = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/gestor/parametros");
      const result = await res.json();
      if (!result.success) throw new Error(result.message || "Error cargando parámetros");
      setParametros(result.data);
    } catch (err: any) {
      console.error("Error cargando parámetros:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchParametros(); }, []);

  const filtered = useMemo(() => {
    let list = mostrarSoloActivos ? parametros.filter(p => p.activo === 1) : parametros;
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(p =>
      p.codigo.toLowerCase().includes(s) ||
      p.valor.toLowerCase().includes(s) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(s)) ||
      (p.interfaz && p.interfaz.toLowerCase().includes(s))
    );
  }, [search, parametros, mostrarSoloActivos]);

  const grouped = useMemo(() => {
    const groups: Record<string, Parametro[]> = {};
    filtered.forEach(p => {
      const key = p.interfaz?.trim() || "(sin módulo)";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    Object.keys(groups).forEach(k => groups[k].sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return groups;
  }, [filtered]);

  const moduleNames = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  // Índice estable de color por nombre de módulo (no varía al filtrar)
  const moduleColorIndex = useMemo(() => {
    const allModules = [...new Set(parametros.map(p => p.interfaz?.trim() || "(sin módulo)"))].sort();
    const idx: Record<string, number> = {};
    allModules.forEach((m, i) => { idx[m] = i; });
    return idx;
  }, [parametros]);

  const toggleCollapsed = (name: string) =>
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }));

  const handleSave = async () => {
    if (!modal) return;
    const { codigo, valor, descripcion } = modal;
    if (!codigo.trim() || !valor.trim() || !descripcion.trim()) {
      alert("Debe completar Código, Valor y Descripción.");
      return;
    }
    try {
      const method = modal.id ? "PUT" : "POST";
      const url = modal.id
        ? `/api/gestor/parametros/${modal.codigo}`
        : `/api/gestor/parametros`;
      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modal),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      setModal(null);
      fetchParametros();
    } catch (err: any) {
      alert("Error al guardar parámetro: " + err.message);
    }
  };

  const toggleActivo = async (p: Parametro) => {
    try {
      const actualizado = { ...p, activo: p.activo ? 0 : 1 };
      const res = await fetchWithAuth(`/api/gestor/parametros/${p.codigo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actualizado),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      setFeedback({
        show: true, success: true,
        message: `Parámetro ${actualizado.activo ? "activado" : "inactivado"} correctamente.`,
      });
      fetchParametros();
    } catch (err: any) {
      setFeedback({ show: true, success: false, message: "Error al actualizar: " + err.message });
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar parámetro..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <button
          onClick={() => setMostrarSoloActivos(!mostrarSoloActivos)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded-lg transition-colors whitespace-nowrap ${
            mostrarSoloActivos
              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
          }`}
        >
          {mostrarSoloActivos ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {mostrarSoloActivos ? "Solo activos" : "Todos"}
        </button>

        {!loading && (
          <span className="text-xs text-gray-400 hidden sm:inline">
            {filtered.length} parámetros · {moduleNames.length} módulos
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={fetchParametros}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button
            onClick={() =>
              setModal({ id: 0, codigo: "", valor: "", descripcion: "", interfaz: "", activo: 1, fecha_actualizacion: "" })
            }
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40 bg-white rounded-xl border border-gray-200">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
          <span className="text-sm text-gray-500">Cargando...</span>
        </div>
      )}

      {/* Módulos */}
      {!loading && (
        <div className="space-y-2">
          {moduleNames.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              No hay parámetros para mostrar.
            </div>
          ) : (
            moduleNames.map((moduleName) => {
              const items = grouped[moduleName];
              const isCollapsed = collapsed[moduleName];
              const colorIdx = moduleColorIndex[moduleName] ?? 0;
              const borderCls = MODULE_BORDERS[colorIdx % MODULE_BORDERS.length];
              const badgeCls = MODULE_BADGES[colorIdx % MODULE_BADGES.length];

              return (
                <div
                  key={moduleName}
                  className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden border-l-4 ${borderCls}`}
                >
                  <button
                    onClick={() => toggleCollapsed(moduleName)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    }
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${badgeCls}`}>
                      {moduleName}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {items.length} {items.length === 1 ? "parámetro" : "parámetros"}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-gray-50/60">
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-48">Código</th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Valor</th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Descripción</th>
                            <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20">Estado</th>
                            <th className="px-3 py-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50/70 transition-colors group">
                              <td className="px-4 py-2">
                                <span className="text-xs font-mono font-medium text-gray-800">{p.codigo}</span>
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-600 max-w-xs truncate" title={p.valor}>
                                {p.valor}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-400 hidden md:table-cell">
                                {p.descripcion || "—"}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => toggleActivo(p)}
                                  className="focus:outline-none"
                                  title={p.activo ? "Inactivar" : "Activar"}
                                >
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    p.activo
                                      ? "bg-green-50 text-green-700"
                                      : "bg-red-50 text-red-600"
                                  }`}>
                                    {p.activo ? "Activo" : "Inactivo"}
                                  </span>
                                </button>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => setModal(p)}
                                  className="text-gray-300 group-hover:text-blue-500 hover:text-blue-600 transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal Alta/Edición */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 px-6 py-5 max-w-md w-full mx-4 z-50">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              {modal.id ? "Editar parámetro" : "Nuevo parámetro"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Código</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  value={modal.codigo}
                  onChange={(e) => setModal({ ...modal, codigo: e.target.value.toUpperCase() })}
                  disabled={!!modal.id}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  rows={2}
                  value={modal.valor}
                  onChange={(e) => setModal({ ...modal, valor: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={modal.descripcion || ""}
                  onChange={(e) => setModal({ ...modal, descripcion: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Módulo (Interfaz)</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  value={modal.interfaz || ""}
                  onChange={(e) => setModal({ ...modal, interfaz: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setModal(null)}
                className="text-xs px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback.show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 flex flex-col items-center max-w-xs w-full mx-4">
            {feedback.success
              ? <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
              : <XCircle className="w-8 h-8 text-red-500 mb-2" />
            }
            <p className={`text-sm font-medium mb-3 text-center ${feedback.success ? "text-green-700" : "text-red-700"}`}>
              {feedback.message}
            </p>
            <button
              onClick={() => setFeedback({ ...feedback, show: false })}
              className="text-xs px-4 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Parametros;
