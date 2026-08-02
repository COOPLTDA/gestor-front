import React, { useState, useEffect, useMemo, useRef } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { Search, X, ArrowLeftRight, CheckSquare, ArrowUp, ArrowDown, ArrowUpDown, XCircle, CalendarDays, ChevronDown } from "lucide-react";
import { useDraggable } from "@/hooks/useDraggable";

interface HojaRuta {
  hoja_ruta: string;
  fecha: string;
  vendedor: string;
  chofer: string;
  total: number;
  cant_recibos: number;
}

type SortCol = "fecha" | "hoja_ruta" | "chofer" | "cant_recibos" | "total";

interface Props {
  onSelect: (hojas: HojaRuta[]) => void;
  compact?: boolean;
  onCambiarHR?: (proceed: () => void) => void;
  onCerrarHDR?: (hojas: HojaRuta[]) => void;
}

const HojaRutaSelector: React.FC<Props> = ({ onSelect, compact = false, onCambiarHR, onCerrarHDR }) => {
  const [open, setOpen] = useState(false);
  const [hojas, setHojas] = useState<HojaRuta[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedHojas, setCheckedHojas] = useState<Set<string>>(new Set());

  const [filtroFechas, setFiltroFechas] = useState<Set<string>>(new Set());
  const [fechasOpen, setFechasOpen] = useState(false);
  const fechasRef = useRef<HTMLDivElement>(null);
  const [sortCol, setSortCol] = useState<SortCol>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { style, handleProps } = useDraggable(open);

  const fetchHojas = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/distrigestion/hojas-ruta");
      const json = await res.json();
      if (json.success) setHojas(json.data);
    } finally {
      setLoading(false);
    }
  };

  const formatMoneda = (valor: number) =>
    Number(valor || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });

  const toISO = (fecha: string) => new Date(fecha).toISOString().split("T")[0];

  useEffect(() => {
    if (open) {
      fetchHojas();
      setCheckedHojas(new Set());
      setFiltroFechas(new Set());
      setFechasOpen(false);
    }
  }, [open]);

  // Cierra el panel de fechas al hacer click fuera
  useEffect(() => {
    if (!fechasOpen) return;
    const handler = (e: MouseEvent) => {
      if (fechasRef.current && !fechasRef.current.contains(e.target as Node)) {
        setFechasOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fechasOpen]);

  // Fechas únicas para el combo, ordenadas desc
  const fechasUnicas = useMemo(() => {
    const set = new Set(hojas.map((h) => toISO(h.fecha)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [hojas]);

  const toggleFecha = (fecha: string) => {
    setFiltroFechas((prev) => {
      const n = new Set(prev);
      if (n.has(fecha)) n.delete(fecha); else n.add(fecha);
      return n;
    });
  };

  const toggleTodasFechas = () => {
    setFiltroFechas((prev) =>
      prev.size === fechasUnicas.length ? new Set() : new Set(fechasUnicas)
    );
  };

  const labelFiltroFechas = useMemo(() => {
    if (filtroFechas.size === 0) return `Todas las fechas (${hojas.length})`;
    const cant = hojas.filter((h) => filtroFechas.has(toISO(h.fecha))).length;
    if (filtroFechas.size === 1) return `${Array.from(filtroFechas)[0]} (${cant})`;
    return `${filtroFechas.size} fechas (${cant} HDR)`;
  }, [filtroFechas, hojas, fechasUnicas]);

  // Filas filtradas y ordenadas
  const hojasFiltradas = useMemo(() => {
    const filtradas = filtroFechas.size > 0
      ? hojas.filter((h) => filtroFechas.has(toISO(h.fecha)))
      : hojas;

    return [...filtradas].sort((a, b) => {
      let A: any = a[sortCol];
      let B: any = b[sortCol];

      if (sortCol === "fecha") {
        A = toISO(a.fecha);
        B = toISO(b.fecha);
      } else if (sortCol === "cant_recibos" || sortCol === "total") {
        A = Number(A);
        B = Number(B);
      }

      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [hojas, filtroFechas, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="inline w-3 h-3 ml-1 text-blue-600" />
      : <ArrowDown className="inline w-3 h-3 ml-1 text-blue-600" />;
  };

  const toggleCheck = (hoja_ruta: string) => {
    setCheckedHojas((prev) => {
      const n = new Set(prev);
      if (n.has(hoja_ruta)) n.delete(hoja_ruta);
      else n.add(hoja_ruta);
      return n;
    });
  };

  const toggleAll = () => {
    const visibles = new Set(hojasFiltradas.map((h) => h.hoja_ruta));
    const todasVisiblesChecked = hojasFiltradas.length > 0 &&
      hojasFiltradas.every((h) => checkedHojas.has(h.hoja_ruta));

    setCheckedHojas((prev) => {
      const n = new Set(prev);
      if (todasVisiblesChecked) {
        visibles.forEach((id) => n.delete(id));
      } else {
        visibles.forEach((id) => n.add(id));
      }
      return n;
    });
  };

  const todasVisiblesChecked =
    hojasFiltradas.length > 0 && hojasFiltradas.every((h) => checkedHojas.has(h.hoja_ruta));

  const handleAceptar = () => {
    const seleccionadas = hojas.filter((h) => checkedHojas.has(h.hoja_ruta));
    if (!seleccionadas.length) return;
    onSelect(seleccionadas);
    setOpen(false);
  };

  const thClass = "px-3 py-2 border cursor-pointer select-none hover:bg-gray-200";

  return (
    <>
      {compact ? (
        <button
          onClick={() => (onCambiarHR ? onCambiarHR(() => setOpen(true)) : setOpen(true))}
          className="flex items-center gap-1 px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded-lg shadow text-sm transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> Cambiar HR
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
        >
          <Search className="w-4 h-4" />
          Seleccionar HR
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div style={style} className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-5xl max-h-[85vh] flex flex-col relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 {...handleProps} className="text-lg font-semibold mb-3 text-gray-800 text-center">
              HDR sin enviar a Sigma
            </h2>

            {loading ? (
              <p className="text-gray-500 text-center py-6">Cargando...</p>
            ) : (
              <>
                {/* Filtro de fecha con multi-selección */}
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-sm text-gray-600 shrink-0 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> Fechas:
                  </label>

                  <div className="relative" ref={fechasRef}>
                    <button
                      onClick={() => setFechasOpen((v) => !v)}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 text-sm bg-white hover:border-blue-400 focus:outline-none transition-colors ${filtroFechas.size > 0 ? "border-blue-400 text-blue-700 font-medium" : "text-gray-700"}`}
                    >
                      {labelFiltroFechas}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${fechasOpen ? "rotate-180" : ""}`} />
                    </button>

                    {fechasOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[220px] py-1">
                        {/* Todas */}
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={filtroFechas.size === 0}
                            onChange={toggleTodasFechas}
                            className="accent-blue-600"
                          />
                          Todas las fechas
                          <span className="ml-auto text-xs text-gray-400">{hojas.length}</span>
                        </label>

                        <div className="max-h-52 overflow-y-auto">
                          {fechasUnicas.map((f) => {
                            const cant = hojas.filter((h) => toISO(h.fecha) === f).length;
                            return (
                              <label
                                key={f}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={filtroFechas.has(f)}
                                  onChange={() => toggleFecha(f)}
                                  className="accent-blue-600"
                                />
                                {f}
                                <span className="ml-auto text-xs text-gray-400">{cant}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {filtroFechas.size > 0 && (
                    <button
                      onClick={() => setFiltroFechas(new Set())}
                      className="text-gray-400 hover:text-gray-600"
                      title="Limpiar filtro de fechas"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <span className="ml-auto text-xs text-gray-400">
                    {hojasFiltradas.length} resultado(s)
                  </span>
                </div>

                <div className="overflow-y-auto flex-1 border border-gray-300 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700 text-center sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 border">
                          <input
                            type="checkbox"
                            checked={todasVisiblesChecked}
                            onChange={toggleAll}
                            className="accent-blue-600"
                          />
                        </th>
                        <th className={thClass} onClick={() => handleSort("fecha")}>
                          Fecha <SortIcon col="fecha" />
                        </th>
                        <th className={thClass} onClick={() => handleSort("hoja_ruta")}>
                          Hoja de Ruta <SortIcon col="hoja_ruta" />
                        </th>
                        <th className={thClass} onClick={() => handleSort("chofer")}>
                          Chofer <SortIcon col="chofer" />
                        </th>
                        <th className={thClass} onClick={() => handleSort("cant_recibos")}>
                          Recibos <SortIcon col="cant_recibos" />
                        </th>
                        <th className={thClass} onClick={() => handleSort("total")}>
                          Total <SortIcon col="total" />
                        </th>
                        <th className="px-3 py-2 border">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hojasFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-gray-500">
                            {hojas.length === 0
                              ? "No hay hojas de ruta pendientes."
                              : "No hay HDR para la fecha seleccionada."}
                          </td>
                        </tr>
                      ) : (
                        hojasFiltradas.map((h) => (
                          <tr
                            key={h.hoja_ruta}
                            className={`hover:bg-gray-50 border-t text-center cursor-pointer ${
                              checkedHojas.has(h.hoja_ruta) ? "bg-blue-50" : ""
                            }`}
                            onClick={() => toggleCheck(h.hoja_ruta)}
                          >
                            <td
                              className="px-3 py-2 border"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={checkedHojas.has(h.hoja_ruta)}
                                onChange={() => toggleCheck(h.hoja_ruta)}
                                className="accent-blue-600"
                              />
                            </td>
                            <td className="px-2 py-1 text-sm text-gray-800">
                              {toISO(h.fecha)}
                            </td>
                            <td className="px-3 py-2 border font-medium">{h.hoja_ruta}</td>
                            <td className="px-3 py-2 border">
                              {h.vendedor} - {h.chofer || "-"}
                            </td>
                            <td className="px-3 py-2 border">{h.cant_recibos}</td>
                            <td className="px-3 py-2 border text-right pr-4">
                              {formatMoneda(h.total)}
                            </td>
                            <td
                              className="px-3 py-2 border"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  onSelect([h]);
                                  setOpen(false);
                                }}
                                className="text-blue-600 hover:underline"
                              >
                                Abrir HDR
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    {onCerrarHDR && (
                      <button
                        disabled={checkedHojas.size === 0}
                        onClick={() => {
                          const seleccionadas = hojas.filter((h) => checkedHojas.has(h.hoja_ruta));
                          if (!seleccionadas.length) return;
                          onCerrarHDR(seleccionadas);
                          setOpen(false);
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold"
                      >
                        <XCircle className="w-4 h-4" /> Cerrar HDR
                      </button>
                    )}
                    <span className="text-sm text-gray-500">
                      {checkedHojas.size > 0
                        ? `${checkedHojas.size} HDR seleccionada(s)`
                        : "Usá los checks para múltiples HDR, o \"Seleccionar\" para una sola."}
                    </span>
                  </div>
                  <button
                    disabled={checkedHojas.size === 0}
                    onClick={handleAceptar}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold"
                  >
                    <CheckSquare className="w-4 h-4" /> Aceptar selección
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default HojaRutaSelector;
