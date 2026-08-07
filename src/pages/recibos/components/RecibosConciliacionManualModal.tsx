// src/components/modals/RecibosConciliacionManualModal.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { X, Search, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronDown, Copy, Filter } from "lucide-react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { useToast } from "@/hooks/useToast";
import { useModalEscClose } from "@/hooks/useModalEscClose";
import { useDraggable } from "@/hooks/useDraggable";

interface Extracto {
  id: number;
  operacion: string;
  documento: string;
  importe: number | string;
  fecha: string;
  codigo_cobranza: string;
  datos_extra?: string | null;
}

interface ColumnaGlobal {
  id: number;
  nombre: string;
  orden: number;
}

interface TipoCobro {
  codigo: string;
  nombre: string;
}

interface Props {
  open: boolean;
  recibo: {
    valorId: number;
    codigo: string;
    documento: string;
    monto: number;
    fecha: string;
    observacion?: string;
    chofer?: string;
    fechaDesdeInicial?: string;
    fechaHastaInicial?: string;
  } | null;
  onClose: () => void;
  onSelect: (data: {
    valorId: number;
    conciliado: {
      extractoId: number;
      operacion: string;
      documento: string;
      importe: number;
      tipoCobro: string;
    };
  }) => void;
}

const FIXED_FIELDS = ["operacion", "documento", "importe", "fecha", "codigo_cobranza"] as const;

const RecibosConciliacionManualModal: React.FC<Props> = ({
  open,
  recibo,
  onClose,
  onSelect,
}) => {
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [tiposCobro, setTiposCobro] = useState<TipoCobro[]>([]);
  const [selectedCodigos, setSelectedCodigos] = useState<string[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Extracto[]>([]);
  const [loading, setLoading] = useState(false);

  const [columnasGlobales, setColumnasGlobales] = useState<ColumnaGlobal[]>([]);

  // sortField es string para soportar tanto campos fijos como nombres de columnas extra
  const [sortField, setSortField] = useState<string>("operacion");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Filtros por columna extra
  const [filterExtra, setFilterExtra] = useState<Record<string, string>>({});

  const [pendingExt, setPendingExt] = useState<Extracto | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [filtroImporte, setFiltroImporte] = useState(false);
  const [cantCercanos, setCantCercanos] = useState(2);
  const userChangedSelectionRef = useRef(false);

  const copiar = (campo: string, valor: string) => {
    navigator.clipboard.writeText(valor).then(() => {
      setCopiedField(campo);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  useModalEscClose(open, onClose);
  const { style, handleProps } = useDraggable(open);
  const { style: stylePending, handleProps: handlePropsPending } = useDraggable(!!pendingExt);

  // Cargar columnas globales una sola vez
  useEffect(() => {
    fetchWithAuth("/api/gestor/columnas-extra").then((res) => {
      if (res.success) setColumnasGlobales(res.data ?? []);
    });
  }, []);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Al abrir: resetear estados y buscar
  useEffect(() => {
    if (!open || !recibo) return;

    setBusqueda("");
    setResultados([]);
    setDropdownOpen(false);
    setFilterExtra({});
    setFiltroImporte(false);
    setCantCercanos(2);

    const fecha = recibo.fecha.slice(0, 10);
    const desde = recibo.fechaDesdeInicial ?? fecha;
    const hasta = recibo.fechaHastaInicial ?? fecha;
    setFechaDesde(desde);
    setFechaHasta(hasta);

    const init = async () => {
      try {
        const res = await fetchWithAuth("/api/gestor/tipos-cobro?concilia=S");
        const json = await res.json();
        const tipos: TipoCobro[] = json.success ? json.data : [];
        setTiposCobro(tipos);

        const defaultCodigos = [recibo.codigo];
        setSelectedCodigos(defaultCodigos);

        await buscarConFiltros(defaultCodigos, desde, hasta);
      } catch {
        setTiposCobro([]);
      }
    };

    init();
  }, [open, recibo]);

  // Resetear filtros extra cuando cambian los resultados
  useEffect(() => {
    setFilterExtra({});
  }, [resultados]);

  // Auto-búsqueda cuando el usuario cambia la selección de tipos de cobro
  useEffect(() => {
    if (!userChangedSelectionRef.current) return;
    userChangedSelectionRef.current = false;
    if (selectedCodigos.length === 0 || !fechaDesde || !fechaHasta) return;
    buscarConFiltros(selectedCodigos, fechaDesde, fechaHasta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCodigos]);

  const buscarConFiltros = async (codigos: string[], desde: string, hasta: string) => {
    if (!codigos.length || !desde || !hasta) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/gestor/conciliacion/manual/no-conciliados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigos, fechaDesde: desde, fechaHasta: hasta }),
      });
      const json = await res.json();
      setResultados(json.success ? json.data : []);
    } catch {
      setResultados([]);
    }
    setLoading(false);
  };

  const toggleCodigo = (codigo: string) => {
    userChangedSelectionRef.current = true;
    setSelectedCodigos((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    );
  };

  const toggleTodos = () => {
    userChangedSelectionRef.current = true;
    setSelectedCodigos((prev) =>
      prev.length === tiposCobro.length ? [] : tiposCobro.map((t) => t.codigo)
    );
  };

  const ordenar = (campo: string) => {
    if (campo === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(campo);
      setSortAsc(true);
    }
  };

  // Extraer valor de un extracto para el campo dado (fijo o extra)
  const getValor = (e: Extracto, campo: string): string | number => {
    if (FIXED_FIELDS.includes(campo as any)) {
      const v = e[campo as keyof Extracto];
      return (v ?? "") as string | number;
    }
    // Columna extra
    try {
      const obj = e.datos_extra ? JSON.parse(e.datos_extra) : {};
      return String(obj?.[campo] ?? "");
    } catch {
      return "";
    }
  };

  const sorted = useMemo(() => {
    const copy = [...resultados];
    copy.sort((a, b) => {
      let A = getValor(a, sortField);
      let B = getValor(b, sortField);
      if (sortField === "importe") { A = Number(A); B = Number(B); }
      if (A < B) return sortAsc ? -1 : 1;
      if (A > B) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [resultados, sortField, sortAsc]);

  // Filtro de búsqueda general
  const filteredGeneral = useMemo(() => {
    const s = busqueda.trim().toLowerCase();
    if (!s) return sorted;
    return sorted.filter((e) =>
      e.operacion.toLowerCase().includes(s) ||
      e.documento.toLowerCase().includes(s) ||
      e.codigo_cobranza.toLowerCase().includes(s)
    );
  }, [sorted, busqueda]);

  // Filtros por columna extra
  const filtered = useMemo(() => {
    let data = filteredGeneral;
    for (const [nombre, val] of Object.entries(filterExtra)) {
      const v = val.trim().toLowerCase();
      if (!v) continue;
      data = data.filter((e) => {
        try {
          const obj = e.datos_extra ? JSON.parse(e.datos_extra) : {};
          return String(obj?.[nombre] ?? "").toLowerCase().includes(v);
        } catch { return false; }
      });
    }
    return data;
  }, [filteredGeneral, filterExtra]);

  // Filtro por importe del recibo: exacto o N más cercanos por arriba y por abajo
  const filteredFinal = useMemo(() => {
    if (!filtroImporte || !recibo) return filtered;
    const monto = Number(recibo.monto);
    const n = Math.max(1, cantCercanos);

    const exactos = filtered.filter((e) => Number(e.importe) === monto);
    if (exactos.length > 0) return exactos;

    const menores = filtered
      .filter((e) => Number(e.importe) < monto)
      .sort((a, b) => Number(b.importe) - Number(a.importe))
      .slice(0, n)
      .reverse();

    const mayores = filtered
      .filter((e) => Number(e.importe) > monto)
      .sort((a, b) => Number(a.importe) - Number(b.importe))
      .slice(0, n);

    return [...menores, ...mayores];
  }, [filtered, filtroImporte, recibo, cantCercanos]);

  // Solo mostrar columnas extra que tengan al menos un valor en los resultados
  const columnasConDatos = useMemo(() =>
    columnasGlobales.filter((col) =>
      resultados.some((r) => {
        if (!r.datos_extra) return false;
        try {
          const obj = JSON.parse(r.datos_extra);
          return obj?.[col.nombre] != null && obj[col.nombre] !== "";
        } catch { return false; }
      })
    ),
    [columnasGlobales, resultados]
  );

  const totalCols = 6 + columnasConDatos.length;

  const SortIcon = ({ campo }: { campo: string }) => {
    if (sortField !== campo) return <ArrowUpDown className="inline w-3 h-3 opacity-50" />;
    return sortAsc
      ? <ArrowUp className="inline w-3 h-3 text-blue-600" />
      : <ArrowDown className="inline w-3 h-3 text-blue-600" />;
  };

  const confirmarSeleccion = (ext: Extracto) => {
    onSelect({
      valorId: recibo!.valorId,
      conciliado: {
        extractoId: ext.id,
        operacion: ext.operacion,
        documento: ext.documento,
        importe: Number(ext.importe),
        tipoCobro: ext.codigo_cobranza,
      },
    });
    toast({ title: "Conciliación aplicada", description: `Extracto ${ext.operacion} vinculado.` });
    setPendingExt(null);
    onClose();
  };

  const seleccionar = (ext: Extracto) => {
    if (ext.codigo_cobranza.trim().toUpperCase() !== recibo!.codigo.trim().toUpperCase()) {
      setPendingExt(ext);
    } else {
      confirmarSeleccion(ext);
    }
  };

  const formatImporte = (n: any) =>
    Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS" });

  const labelCodigos =
    selectedCodigos.length === 0
      ? "Seleccionar tipos..."
      : selectedCodigos.length === tiposCobro.length
      ? "Todos los tipos"
      : selectedCodigos.join(", ");

  if (!open || !recibo) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div style={style} className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-6 relative h-[65vh] overflow-hidden flex flex-col">

        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800">
          <X className="w-5 h-5" />
        </button>

        <div {...handleProps} className="mb-4">
          <h2 className="text-lg font-bold mb-2">Conciliación Manual</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">

            {recibo.chofer && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-xs">Chofer:</span>
                <span className="font-medium text-slate-800">{recibo.chofer}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-xs">Documento:</span>
              <span className="font-medium text-slate-800">{recibo.documento}</span>
              <button
                type="button"
                title="Copiar"
                onClick={() => copiar("documento", recibo.documento)}
                className="text-slate-400 hover:text-blue-600 transition-colors"
              >
                {copiedField === "documento"
                  ? <Check className="w-3.5 h-3.5 text-green-500" />
                  : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {recibo.observacion && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-xs">Observación:</span>
                <span className="font-medium text-slate-800">{recibo.observacion}</span>
                <button
                  type="button"
                  title="Copiar"
                  onClick={() => copiar("observacion", recibo.observacion!)}
                  className="text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {copiedField === "observacion"
                    ? <Check className="w-3.5 h-3.5 text-green-500" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-xs">Monto:</span>
              <span className="font-semibold text-slate-900">{formatImporte(recibo.monto)}</span>

              {/* Activar/desactivar filtro por importe */}
              <button
                type="button"
                onClick={() => setFiltroImporte((v) => !v)}
                title={filtroImporte ? "Desactivar filtro por importe" : "Filtrar por importe del recibo"}
                className={`transition-colors ${filtroImporte ? "text-blue-600" : "text-slate-400 hover:text-blue-600"}`}
              >
                <Filter className="w-3.5 h-3.5" />
              </button>

              {/* Spinner cantidad de cercanos */}
              <div className="flex items-center border rounded overflow-hidden text-xs select-none">
                <button
                  type="button"
                  onClick={() => setCantCercanos((v) => Math.max(1, v - 1))}
                  className="px-1 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 leading-none"
                  title="Menos"
                >▼</button>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={cantCercanos}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setCantCercanos(Math.min(20, Math.max(1, v)));
                  }}
                  className="w-7 text-center text-xs border-x py-0.5 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setCantCercanos((v) => Math.min(20, v + 1))}
                  className="px-1 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 leading-none"
                  title="Más"
                >▲</button>
              </div>

              {/* X para limpiar el filtro (solo visible cuando está activo) */}
              {filtroImporte && (
                <button
                  type="button"
                  onClick={() => setFiltroImporte(false)}
                  title="Limpiar filtro por importe"
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Filtros superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">

          {/* Multi-select tipos de cobro */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs text-gray-500 mb-1">Tipos de cobro</label>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm bg-white hover:border-blue-400 focus:outline-none"
            >
              <span className="truncate text-gray-700">{labelCodigos}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b font-medium">
                  <input
                    type="checkbox"
                    checked={selectedCodigos.length === tiposCobro.length && tiposCobro.length > 0}
                    onChange={toggleTodos}
                    className="accent-blue-600"
                  />
                  <span className="text-gray-700">Seleccionar todos</span>
                </label>
                {tiposCobro.map((t) => (
                  <label
                    key={t.codigo}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCodigos.includes(t.codigo)}
                      onChange={() => toggleCodigo(t.codigo)}
                      className="accent-blue-600"
                    />
                    <span className="font-mono text-xs text-blue-700 w-8 shrink-0">{t.codigo}</span>
                    <span className="text-gray-700 truncate">{t.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Fecha desde */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); if (e.target.value && fechaHasta) buscarConFiltros(selectedCodigos, e.target.value, fechaHasta); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); if (fechaDesde && e.target.value) buscarConFiltros(selectedCodigos, fechaDesde, e.target.value); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Buscador general */}
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar por operación, documento o tipo…"
            className="flex-1 border px-3 py-2 rounded-lg text-sm"
          />
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto border rounded-lg min-h-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">

              {/* Fila de encabezados ordenables */}
              <tr>
                <th className="border px-2 py-2 text-center cursor-pointer select-none whitespace-nowrap" onClick={() => ordenar("codigo_cobranza")}>
                  Tipo <SortIcon campo="codigo_cobranza" />
                </th>
                <th className="border px-2 py-2 text-center cursor-pointer select-none whitespace-nowrap" onClick={() => ordenar("fecha")}>
                  Fecha <SortIcon campo="fecha" />
                </th>
                <th className="border px-2 py-2 text-center cursor-pointer select-none whitespace-nowrap" onClick={() => ordenar("operacion")}>
                  Operación <SortIcon campo="operacion" />
                </th>
                <th className="border px-2 py-2 text-center cursor-pointer select-none whitespace-nowrap" onClick={() => ordenar("documento")}>
                  Documento <SortIcon campo="documento" />
                </th>
                <th className="border px-2 py-2 text-center cursor-pointer select-none whitespace-nowrap" onClick={() => ordenar("importe")}>
                  Importe <SortIcon campo="importe" />
                </th>
                {columnasConDatos.map((col) => (
                  <th
                    key={col.id}
                    className="border px-2 py-2 text-center bg-blue-50 text-blue-700 whitespace-nowrap text-xs cursor-pointer select-none"
                    onClick={() => ordenar(col.nombre)}
                  >
                    {col.nombre} <SortIcon campo={col.nombre} />
                  </th>
                ))}
                <th className="border px-2 py-2 text-center">Elegir</th>
              </tr>

              {/* Fila de filtros para columnas extra */}
              {columnasConDatos.length > 0 && (
                <tr className="bg-blue-50/60">
                  {/* Celdas vacías para las columnas fijas */}
                  <td className="border px-1 py-1" />
                  <td className="border px-1 py-1" />
                  <td className="border px-1 py-1" />
                  <td className="border px-1 py-1" />
                  <td className="border px-1 py-1" />
                  {columnasConDatos.map((col) => (
                    <td key={col.id} className="border px-1 py-1">
                      <input
                        placeholder="Filtrar…"
                        className="w-full border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-400"
                        value={filterExtra[col.nombre] ?? ""}
                        onChange={(e) =>
                          setFilterExtra((prev) => ({ ...prev, [col.nombre]: e.target.value }))
                        }
                      />
                    </td>
                  ))}
                  <td className="border px-1 py-1" />
                </tr>
              )}

            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={totalCols} className="py-4 text-center text-gray-400">Cargando…</td>
                </tr>
              ) : filteredFinal.length ? (
                filteredFinal.map((e) => {
                  let extra: Record<string, string> = {};
                  if (e.datos_extra) {
                    try { extra = JSON.parse(e.datos_extra) ?? {}; } catch { /* noop */ }
                  }
                  return (
                    <tr key={e.id} className="hover:bg-blue-50">
                      <td className="border px-2 py-1 text-center font-mono text-xs text-blue-700">{e.codigo_cobranza}</td>
                      <td className="border px-2 py-1 text-center">{String(e.fecha).slice(0, 10)}</td>
                      <td className="border px-2 py-1 text-center">{e.operacion}</td>
                      <td className="border px-2 py-1 text-center">{e.documento}</td>
                      <td className="border px-2 py-1 text-center font-semibold">{formatImporte(e.importe)}</td>
                      {columnasConDatos.map((col) => (
                        <td key={col.id} className="border px-2 py-1 text-center text-xs text-slate-600 bg-blue-50/40">
                          {extra[col.nombre] != null && extra[col.nombre] !== ""
                            ? extra[col.nombre]
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      ))}
                      <td className="border px-2 py-1 text-center">
                        <button onClick={() => seleccionar(e)} className="text-blue-600 hover:text-blue-800">
                          <Check className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={totalCols} className="py-4 text-center text-gray-500">
                    No se encontraron movimientos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>

    {/* Confirmación tipo de cobro diferente */}
    {pendingExt && recibo && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div style={stylePending} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
          <h3 {...handlePropsPending} className="text-base font-bold text-amber-600 mb-3">Tipo de cobro diferente</h3>
          <p className="text-sm text-gray-700 mb-4">
            El extracto seleccionado es de tipo{" "}
            <span className="font-bold text-blue-700">{pendingExt.codigo_cobranza}</span>, pero el
            registro del recibo es de tipo{" "}
            <span className="font-bold text-blue-700">{recibo.codigo}</span>.
          </p>
          <p className="text-sm text-gray-500 mb-5">¿Confirmás la conciliación de todas formas?</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPendingExt(null)}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => confirmarSeleccion(pendingExt)}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
            >
              Confirmar igual
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default RecibosConciliacionManualModal;
