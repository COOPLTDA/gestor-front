// components/tabs/ImportarCobranzasVerExtractosTable.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowUpDown, FileSpreadsheet, ChevronRight, ShieldCheck, X, Undo2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import type { TipoCobro, Extracto } from "./ImportarCobranzasTabs";
import RecibosEditarModal from "@/pages/recibos/components/RecibosEditarModal";
import { fetchWithAuth } from "@/utils/fetchWithAuth";

interface ColumnaGlobal {
  id: number;
  nombre: string;
  orden: number;
}

type ConciliadosFiltro = "todos" | "si" | "no";

const DIACRITICOS_RE = new RegExp("[̀-ͯ]", "g");

// Normaliza para comparar: quita espacios no separables (comunes al pegar/exportar
// desde Excel), recorta, pasa a minúsculas y elimina acentos. Sin esto, un solo
// caracter "invisible" distinto en el dato importado hace que el filtro no
// encuentre nada aunque el valor "exista" a simple vista.
function normalizarFiltro(v: unknown): string {
  return String(v ?? "")
    .replace(/ /g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS_RE, "");
}

// Quita el sufijo "[usuario - fecha_hora]" que se agrega al persistir la observación
function textoObservacion(obs: string | null | undefined): string {
  if (!obs) return "";
  return obs.replace(/\s*\[[^\]]*\]\s*$/, "").trim();
}

interface Props {
  tiposCobro: TipoCobro[];
  tipoFiltro: string[];
  setTipoFiltro: (v: string[]) => void;
  desde: string;
  setDesde: (v: string) => void;
  hasta: string;
  setHasta: (v: string) => void;
  conciliados: ConciliadosFiltro;
  setConciliados: (v: ConciliadosFiltro) => void;
  resultados: Extracto[];
  buscando: boolean;
  errorBusqueda: string | null;
  onBuscar: () => void;
  onExtractoActualizado: (id: number, patch: Partial<Extracto>) => void;
}

export function ImportarCobranzasVerExtractosTable({
  tiposCobro,
  tipoFiltro,
  setTipoFiltro,
  desde,
  setDesde,
  hasta,
  setHasta,
  conciliados,
  setConciliados,
  resultados,
  buscando,
  errorBusqueda,
  onBuscar,
  onExtractoActualizado,
}: Props) {
  // -------------------------------------------
  // COLUMNAS GLOBALES
  // -------------------------------------------
  const [columnasGlobales, setColumnasGlobales] = useState<ColumnaGlobal[]>([]);

  useEffect(() => {
    fetchWithAuth("/api/distrigestion/columnas-extra").then((res) => {
      if (res.success) setColumnasGlobales(res.data);
    });
  }, []);

  // Sólo mostrar las que tienen al menos un valor en los resultados actuales
  const columnasConDatos = useMemo(() => {
    if (columnasGlobales.length === 0 || resultados.length === 0) return [];
    return columnasGlobales.filter((col) =>
      resultados.some((r) => {
        if (!r.datos_extra) return false;
        try {
          const obj = JSON.parse(r.datos_extra);
          return obj?.[col.nombre] != null && obj[col.nombre] !== "";
        } catch { return false; }
      })
    );
  }, [columnasGlobales, resultados]);

  // -------------------------------------------
  // PAGINACIÓN
  // -------------------------------------------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // -------------------------------------------
  // ORDENAMIENTO
  // -------------------------------------------
  type SortField = keyof Extracto | "conciliado" | "hdr";
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // Valor de ordenamiento para campos derivados
  function sortValue(r: Extracto, field: SortField): string | number {
    if (field === "conciliado") {
      if (r.id_cobranza) return 2;
      if (r.forzado_conciliado) return 1;
      return 0;
    }
    if (field === "hdr") return r.hdr ?? "";
    if (field === "importe") return Number(r.importe) || 0;
    const v = r[field as keyof Extracto];
    return (v ?? "") as string | number;
  }

  // -------------------------------------------
  // FILTROS DE TABLA
  // -------------------------------------------
  const [tipoDropdownOpen, setTipoDropdownOpen] = useState(false);
  const tipoDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tipoDropdownRef.current && !tipoDropdownRef.current.contains(e.target as Node)) {
        setTipoDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [filterDocumento, setFilterDocumento] = useState("");
  const [filterOperacion, setFilterOperacion] = useState("");
  const [filterExtra, setFilterExtra] = useState<Record<string, string>>({});

  // Modal recibo (solo lectura)
  const [modalReciboId, setModalReciboId] = useState<number | null>(null);

  // Modal ver observación de forzado
  const [verObsExtracto, setVerObsExtracto] = useState<Extracto | null>(null);

  // Modal confirmar reversión de forzado
  const [confirmarRevertirId, setConfirmarRevertirId] = useState<number | null>(null);

  // Modal forzar conciliación
  const [forzarExtracto, setForzarExtracto] = useState<Extracto | null>(null);
  const [obsTexto, setObsTexto] = useState("");
  const [forzando, setForzando] = useState(false);
  const [errorForzar, setErrorForzar] = useState<string | null>(null);

  async function confirmarForzar() {
    if (!forzarExtracto) return;
    setForzando(true);
    setErrorForzar(null);
    const res = await fetchWithAuth("/api/distrigestion/extractos/forzar-conciliacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractoId: forzarExtracto.id, observacion: obsTexto }),
    });
    setForzando(false);
    if (!res.success) { setErrorForzar(res.message || "Error al forzar"); return; }
    onExtractoActualizado(forzarExtracto.id, {
      forzado_conciliado: 1,
      observacion_forzado: (res.observacion as string | undefined) ?? obsTexto,
    });
    setForzarExtracto(null);
    setObsTexto("");
  }

  async function deshacerForzado() {
    if (!confirmarRevertirId) return;
    const res = await fetchWithAuth("/api/distrigestion/extractos/deshacer-forzado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractoId: confirmarRevertirId }),
    });
    if (res.success) {
      onExtractoActualizado(confirmarRevertirId, {
        forzado_conciliado: 0,
        observacion_forzado: null,
      });
    }
    setConfirmarRevertirId(null);
  }

  // -------------------------------------------
  // PROCESAR FILTROS + ORDENAMIENTO
  // -------------------------------------------
  const datosFiltrados = useMemo(() => {
    let data = [...resultados];

    if (tipoFiltro.length > 0) {
      data = data.filter((r) => tipoFiltro.includes(r.codigo_cobranza));
    }

    if (filterDocumento.trim() !== "") {
      data = data.filter((r) =>
        r.documento.toLowerCase().includes(filterDocumento.toLowerCase())
      );
    }

    if (filterOperacion.trim() !== "") {
      data = data.filter((r) =>
        r.operacion.toLowerCase().includes(filterOperacion.toLowerCase())
      );
    }

    // Filter extra columns
    for (const col of columnasConDatos) {
      const val = normalizarFiltro(filterExtra[col.nombre]);
      if (val) {
        data = data.filter((r) => {
          if (!r.datos_extra) return false;
          try {
            const obj = JSON.parse(r.datos_extra);
            return normalizarFiltro(obj?.[col.nombre]).includes(val);
          } catch { return false; }
        });
      }
    }

    if (sortField) {
      data.sort((a, b) => {
        const valA = sortValue(a, sortField);
        const valB = sortValue(b, sortField);
        if (valA < valB) return sortDir === "asc" ? -1 : 1;
        if (valA > valB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [resultados, filterDocumento, filterOperacion, filterExtra, columnasConDatos, sortField, sortDir]);

  // -------------------------------------------
  // PAGINAR
  // -------------------------------------------
  const totalPages = Math.ceil(datosFiltrados.length / pageSize);

  const paginaActual = datosFiltrados.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Se usa el listado de ids (no la referencia de `resultados`) para no resetear
  // la página cuando sólo se actualiza una fila en memoria (forzar/deshacer).
  const idsResultados = useMemo(() => resultados.map((r) => r.id).join(","), [resultados]);

  useEffect(() => {
    setPage(1);
    setFilterExtra({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, idsResultados, filterDocumento, filterOperacion]);

  // -------------------------------------------
  // EXPORTAR A EXCEL
  // -------------------------------------------
  function exportarExcel() {
    const datos = datosFiltrados.map((r) => {
      let extra: Record<string, string> = {};
      if (r.datos_extra) {
        try { extra = JSON.parse(r.datos_extra) ?? {}; } catch { /* noop */ }
      }
      return {
        "Tipo Cobro": r.nombre_cobranza || r.codigo_cobranza,
        Fecha: r.fecha.split("T")[0],
        Documento: r.documento,
        Operación: r.operacion,
        Importe: Number(r.importe),
        ...extra,
        Conciliado: r.id_cobranza ? "Sí" : "No",
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(wb, ws, "Extractos");

    XLSX.writeFile(wb, "extractos.xlsx");
  }

  return (
    <div className="space-y-4">
      {/* FILTROS SUPERIORES */}
      <div className="grid md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">
            Tipo de cobro
          </label>
          <div className="relative" ref={tipoDropdownRef}>
            <button
              type="button"
              onClick={() => setTipoDropdownOpen((o) => !o)}
              className="border rounded-md p-2 w-full text-sm text-left flex items-center justify-between bg-white"
            >
              <span className="truncate text-gray-700">
                {tipoFiltro.length === 0
                  ? "Todos"
                  : tipoFiltro.length === 1
                  ? tiposCobro.find((t) => t.codigo_cobranza === tipoFiltro[0])?.nombre_cobranza ?? tipoFiltro[0]
                  : `${tipoFiltro.length} seleccionados`}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
            {tipoDropdownOpen && (
              <div className="absolute z-20 bg-white border rounded-md shadow-lg mt-1 w-full max-h-60 overflow-y-auto">
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={tipoFiltro.length === 0}
                    onChange={() => setTipoFiltro([])}
                    className="accent-blue-600"
                  />
                  Todos
                </label>
                {tiposCobro.map((t) => (
                  <label
                    key={t.codigo_cobranza}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={tipoFiltro.includes(t.codigo_cobranza)}
                      onChange={() => {
                        const next = tipoFiltro.includes(t.codigo_cobranza)
                          ? tipoFiltro.filter((c) => c !== t.codigo_cobranza)
                          : [...tipoFiltro, t.codigo_cobranza];
                        setTipoFiltro(next);
                      }}
                      className="accent-blue-600"
                    />
                    {t.nombre_cobranza}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Fecha desde</label>
          <input
            type="date"
            className="border rounded-md p-2 w-full text-sm"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Fecha hasta</label>
          <input
            type="date"
            className="border rounded-md p-2 w-full text-sm"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Conciliados</label>
          <select
            className="border rounded-md p-2 w-full text-sm"
            value={conciliados}
            onChange={(e) =>
              setConciliados(e.target.value as ConciliadosFiltro)
            }
          >
            <option value="todos">Todos</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between">
        <div>
          <label className="mr-2 text-sm">Registros:</label>
          <select
            className="border rounded-md p-1 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={80}>80</option>
            <option value={100}>100</option>
          </select>
        </div>

        <Button
          variant="secondary"
          className="inline-flex items-center gap-2"
          onClick={onBuscar}
        >
          <Search className="w-4 h-4" />
          {buscando ? "Buscando..." : "Buscar"}
        </Button>

        <Button
          className="inline-flex items-center gap-2"
          onClick={exportarExcel}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Exportar Excel
        </Button>
      </div>

      {/* ERRORES */}
      {errorBusqueda && (
        <p className="text-sm text-red-700 bg-red-100 border border-red-300 rounded-md p-2">
          {errorBusqueda}
        </p>
      )}

      {/* TABLA */}
      <div className="overflow-x-auto border rounded-md">
        {buscando ? (
          <p className="text-sm p-3">Cargando...</p>
        ) : resultados.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">
            No hay resultados.
          </p>
        ) : (
          <table className="min-w-full text-sm border-collapse">
            <thead className="bg-muted">
              <tr>
                {[
                  { key: "codigo_cobranza", label: "Tipo cobro" },
                  { key: "fecha", label: "Fecha" },
                  { key: "documento", label: "Documento" },
                  { key: "operacion", label: "Operación" },
                  { key: "importe", label: "Importe" },
                ].map((col) => (
                  <th
                    key={col.key}
                    className="border px-2 py-1 text-left cursor-pointer select-none"
                    onClick={() => toggleSort(col.key as keyof Extracto)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                ))}
                {columnasConDatos.map((col) => (
                  <th key={col.id} className="border px-2 py-1 text-left bg-blue-50 text-blue-700 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 opacity-60" />
                      {col.nombre}
                    </div>
                  </th>
                ))}
                <th
                  className="border px-2 py-1 text-center cursor-pointer select-none"
                  onClick={() => toggleSort("conciliado")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Conciliado <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  className="border px-2 py-1 text-center cursor-pointer select-none"
                  onClick={() => toggleSort("hdr")}
                >
                  <div className="flex items-center justify-center gap-1">
                    HDR <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="border px-2 py-1 text-center">Acción</th>
              </tr>

              {/* FILTROS DENTRO DE LA TABLA */}
              <tr className="bg-gray-50">
                <th></th>
                <th></th>
                <th className="border px-2 py-1">
                  <input
                    placeholder="Filtrar..."
                    className="w-full border rounded p-1 text-xs"
                    value={filterDocumento}
                    onChange={(e) => setFilterDocumento(e.target.value)}
                  />
                </th>
                <th className="border px-2 py-1">
                  <input
                    placeholder="Filtrar..."
                    className="w-full border rounded p-1 text-xs"
                    value={filterOperacion}
                    onChange={(e) => setFilterOperacion(e.target.value)}
                  />
                </th>
                <th></th>
                {columnasConDatos.map((col) => (
                  <th key={col.id} className="border px-2 py-1 bg-blue-50">
                    <input
                      placeholder="Filtrar..."
                      className="w-full border rounded p-1 text-xs"
                      value={filterExtra[col.nombre] ?? ""}
                      onChange={(e) =>
                        setFilterExtra((prev) => ({ ...prev, [col.nombre]: e.target.value }))
                      }
                    />
                  </th>
                ))}
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {datosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + columnasConDatos.length + 3}
                    className="border px-2 py-4 text-center text-sm text-muted-foreground"
                  >
                    No hay resultados para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginaActual.map((r) => {
                  let extra: Record<string, string> = {};
                  if (r.datos_extra) {
                    try { extra = JSON.parse(r.datos_extra) ?? {}; } catch { /* noop */ }
                  }
                  return (
                    <tr key={r.id}>
                      <td className="border px-2 py-1">
                        {r.nombre_cobranza || r.codigo_cobranza}
                      </td>
                      <td className="border px-2 py-1">
                        {r.fecha?.split("T")[0]}
                      </td>
                      <td className="border px-2 py-1">{r.documento}</td>
                      <td className="border px-2 py-1">{r.operacion}</td>
                      <td className="border px-2 py-1 text-right">
                        {Number(r.importe).toLocaleString("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        })}
                      </td>
                      {columnasConDatos.map((col) => (
                        <td key={col.id} className="border px-2 py-1 text-sm text-slate-600 bg-blue-50/40">
                          {extra[col.nombre] ?? <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="border px-2 py-1 text-center">
                        {r.id_cobranza ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                            Conciliado
                          </span>
                        ) : r.forzado_conciliado ? (
                          <button
                            onClick={() => setVerObsExtracto(r)}
                            className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium hover:bg-violet-200 transition-colors"
                          >
                            Forzado
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">
                            No
                          </span>
                        )}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        {r.hdr && r.cobranza_id ? (
                          <button
                            title="Ver recibo asociado"
                            onClick={() => setModalReciboId(r.cobranza_id!)}
                            className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shadow-sm text-xs font-medium hover:bg-blue-100 hover:shadow-md transition-all cursor-pointer"
                          >
                            {r.hdr}
                          </button>
                        ) : r.forzado_conciliado ? (
                          <button
                            title="Ver observación del forzado"
                            onClick={() => setVerObsExtracto(r)}
                            className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 shadow-sm text-xs font-medium hover:bg-violet-100 hover:shadow-md transition-all cursor-pointer max-w-[180px] truncate inline-block align-middle"
                          >
                            {textoObservacion(r.observacion_forzado) || "Forzado"}
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        {!r.id_cobranza && !r.forzado_conciliado && (
                          <button
                            title="Forzar conciliación manual"
                            onClick={() => { setForzarExtracto(r); setObsTexto(""); setErrorForzar(null); }}
                            className="p-1 rounded hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                        {r.forzado_conciliado === 1 && (
                          <button
                            title="Revertir forzado"
                            onClick={() => setConfirmarRevertirId(r.id)}
                            className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINACIÓN */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ⬅ Anterior
          </Button>

          <span className="text-sm py-2">
            Página {page} de {totalPages}
          </span>

          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente ➡
          </Button>
        </div>
      )}

      {/* MODAL CONFIRMAR REVERSIÓN */}
      {confirmarRevertirId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-slate-800">Revertir forzado</h2>
              </div>
              <button onClick={() => setConfirmarRevertirId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                ¿Confirmás que querés revertir el forzado? El extracto volverá a quedar como <strong>no conciliado</strong> y se perderá la observación registrada.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmarRevertirId(null)}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={deshacerForzado}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 inline-flex items-center gap-2"
                >
                  <Undo2 className="w-4 h-4" /> Sí, revertir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VER OBSERVACIÓN FORZADO */}
      {verObsExtracto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
                <h2 className="font-bold text-slate-800">Detalle de conciliación forzada</h2>
              </div>
              <button onClick={() => setVerObsExtracto(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-slate-50 border p-3 text-sm space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Operación</span>
                  <span className="font-mono text-slate-700">{verObsExtracto.operacion}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Documento</span>
                  <span className="font-mono text-slate-700">{verObsExtracto.documento}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Importe</span>
                  <span className="font-medium text-slate-700">
                    {Number(verObsExtracto.importe).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Observación</p>
                <p className="text-sm text-slate-700 bg-violet-50 border border-violet-100 rounded-lg p-3 whitespace-pre-wrap">
                  {verObsExtracto.observacion_forzado || "Sin observación"}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setVerObsExtracto(null)}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50 text-slate-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORZAR CONCILIACIÓN */}
      {forzarExtracto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
                <h2 className="font-bold text-slate-800">Forzar conciliación</h2>
              </div>
              <button onClick={() => setForzarExtracto(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-slate-50 border p-3 text-sm space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Operación</span>
                  <span className="font-mono text-slate-700">{forzarExtracto.operacion}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Documento</span>
                  <span className="font-mono text-slate-700">{forzarExtracto.documento}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Importe</span>
                  <span className="font-medium text-slate-700">
                    {Number(forzarExtracto.importe).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observación <span className="text-xs text-slate-400">(se adjuntará usuario y fecha automáticamente)</span>
                </label>
                <textarea
                  className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  rows={3}
                  placeholder="Motivo del forzado..."
                  value={obsTexto}
                  onChange={(e) => setObsTexto(e.target.value)}
                  autoFocus
                />
              </div>

              {errorForzar && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{errorForzar}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setForzarExtracto(null)}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarForzar}
                  disabled={forzando}
                  className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {forzando ? "Guardando..." : "Confirmar forzado"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RecibosEditarModal
        open={modalReciboId !== null}
        reciboId={modalReciboId}
        onClose={() => setModalReciboId(null)}
        onUpdated={() => {}}
        readOnly
        tiposCobro={tiposCobro.map((t) => ({
          codigo: t.codigo_cobranza,
          nombre: t.nombre_cobranza,
        }))}
      />
    </div>
  );
}
