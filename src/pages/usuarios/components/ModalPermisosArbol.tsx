import React, { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";

interface Pagina {
  id: number;
  nombre: string;
  ruta: string;
  agrupacion?: string | null;

  categoria_id?: number | null;
  categoria_label?: string | null;
  categoria_orden?: number | null;
}

interface Props {
  userId: number;
  userName: string;
  onClose: () => void;
  feedback: (x: { show: boolean; success: boolean; message: string }) => void;
}

const ModalPermisosArbol: React.FC<Props> = ({
  userId,
  userName,
  onClose,
  feedback,
}) => {
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ================================
  // CARGAR PÁGINAS & PERMISOS
  // ================================
  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.all([
      fetchWithAuth("/api/distrigestion/pages").then(async (r) => {
        if (!r.ok) throw new Error("Error cargando páginas");
        return r.json();
      }),
      fetchWithAuth(`/api/distrigestion/users/${userId}/paginas`).then(async (r) => {
        if (!r.ok) throw new Error("Error cargando permisos");
        return r.json();
      }),
    ])
      .then(([pagesRes, permsRes]) => {
        if (!pagesRes.success) throw new Error("Error cargando páginas");
        if (!permsRes.success) throw new Error("Error cargando permisos");

        setPaginas(pagesRes.data);

        // Permisos actuales
        const permisos = permsRes.data;
        setSeleccionadas(
          permisos.map((p: any) => (typeof p === "object" ? p.id : p))
        );

        // expandir todas las categorías
        const grupos = Object.keys(groupByCategoria(pagesRes.data));
        const expandedInit: Record<string, boolean> = {};
        grupos.forEach((g) => (expandedInit[g] = true));
        setExpanded(expandedInit);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  // ================================
  // AGRUPAR POR CATEGORÍA
  // ================================
  function groupByCategoria(pags: Pagina[]) {
    return pags.reduce((acc: Record<string, Pagina[]>, pag) => {
      const key =
        pag.categoria_label?.trim() ||
        pag.agrupacion?.trim() ||
        "Sin categoría";

      if (!acc[key]) acc[key] = [];
      acc[key].push(pag);
      return acc;
    }, {});
  }

  const agrupadas = groupByCategoria(paginas);

  // ================================
  // EXPANDIR / COLAPSAR
  // ================================
  const toggleExpand = (key: string) =>
    setExpanded((old) => ({ ...old, [key]: !old[key] }));

  const expandirTodo = () =>
    setExpanded(Object.fromEntries(Object.keys(agrupadas).map((k) => [k, true])));

  const colapsarTodo = () =>
    setExpanded(Object.fromEntries(Object.keys(agrupadas).map((k) => [k, false])));

  // ================================
  // SELECCIÓN INDIVIDUAL
  // ================================
  const togglePage = (id: number) =>
    setSeleccionadas((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id]
    );

  // ================================
  // SELECCIÓN MASIVA POR CATEGORÍA
  // ================================
  const seleccionarCategoria = (categoria: string) => {
    const ids = agrupadas[categoria].map((p) => p.id);
    setSeleccionadas((old) => Array.from(new Set([...old, ...ids])));
  };

  const deseleccionarCategoria = (categoria: string) => {
    const ids = agrupadas[categoria].map((p) => p.id);
    setSeleccionadas((old) => old.filter((id) => !ids.includes(id)));
  };

  // ================================
  // SELECCIONAR TODO / NADA
  // ================================
  const handleSelectAll = () => setSeleccionadas(paginas.map((p) => p.id));
  const handleUnselectAll = () => setSeleccionadas([]);

  // ================================
  // GUARDAR
  // ================================
  const handleGuardar = async () => {
    setLoading(true);

    try {
      const res = await fetchWithAuth(`/api/distrigestion/users/${userId}/paginas`, {
        method: "POST",
        body: JSON.stringify({ paginas: seleccionadas }),
      });

      if (!res.ok) throw new Error("Error guardando permisos");

      feedback({
        show: true,
        success: true,
        message: "Permisos actualizados correctamente",
      });

      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // RENDER
  // ================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-8 relative">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
          onClick={onClose}
          disabled={loading}
        >
          ×
        </button>

        <h2 className="text-xl font-bold mb-2">
          Permisos de <span className="text-blue-700">{userName}</span>
        </h2>

        {loading && <div className="text-center py-6">Cargando...</div>}
        {error && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-3">
            {error}
          </div>
        )}

        {!loading && (
          <>
            {/* === BOTONES SUPERIORES === */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded"
                onClick={expandirTodo}
              >
                Expandir todo
              </button>
              <button
                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded"
                onClick={colapsarTodo}
              >
                Contraer todo
              </button>
              <button
                className="px-3 py-1 bg-green-50 hover:bg-green-100 rounded"
                onClick={handleSelectAll}
              >
                Seleccionar todo
              </button>
              <button
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                onClick={handleUnselectAll}
              >
                Quitar todo
              </button>
            </div>

            {/* === ÁRBOL === */}
            <div className="max-h-72 overflow-y-auto border rounded p-2">
              {Object.keys(agrupadas).map((categoria) => (
                <div key={categoria} className="mb-2">
                  {/* === CABECERA DE CATEGORÍA === */}
                  <div className="flex items-center justify-between pr-2">
                    <button
                      className="flex items-center font-semibold text-sm text-gray-700 hover:bg-gray-100 rounded px-2 py-1"
                      onClick={() => toggleExpand(categoria)}
                      type="button"
                    >
                      {expanded[categoria] ? (
                        <ChevronDown className="w-4 h-4 mr-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mr-1" />
                      )}
                      {categoria}
                    </button>

                    {/* === BOTONES MASIVOS POR CATEGORÍA === */}
                    <div className="flex gap-1">
                      <button
                        className="text-xs bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded"
                        onClick={() => seleccionarCategoria(categoria)}
                      >
                        ✓ todas
                      </button>
                      <button
                        className="text-xs bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded"
                        onClick={() => deseleccionarCategoria(categoria)}
                      >
                        ✗ ninguna
                      </button>
                    </div>
                  </div>

                  {/* === LISTA DE PÁGINAS === */}
                  {expanded[categoria] && (
                    <ul className="ml-5 mt-1">
                      {agrupadas[categoria]
                        .sort((a, b) =>
                          a.nombre.localeCompare(b.nombre, "es", {
                            sensitivity: "base",
                          })
                        )
                        .map((pag) => (
                          <li key={pag.id}>
                            <label className="flex items-center cursor-pointer px-2 py-1 rounded hover:bg-blue-50">
                              <input
                                type="checkbox"
                                className="mr-2 accent-blue-600"
                                checked={seleccionadas.includes(pag.id)}
                                onChange={() => togglePage(pag.id)}
                                disabled={loading}
                              />
                              {/* === SOLO EL NOMBRE, SIN RUTA === */}
                              <span>{pag.nombre}</span>

                              {seleccionadas.includes(pag.id) && (
                                <Check className="ml-1 w-4 h-4 text-green-600" />
                              )}
                            </label>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="bg-gray-100 hover:bg-gray-200 px-5 py-2 rounded"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-semibold"
                onClick={handleGuardar}
              >
                Guardar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModalPermisosArbol;
