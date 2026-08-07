// ---------------------------------------------------------
// src/components/recibos/RecibosTabla.tsx
// CON ORDENAMIENTO POR COLUMNAS
// ---------------------------------------------------------

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Edit2, Unlink, Handshake, Filter } from "lucide-react";
import { useModalEscClose } from "@/hooks/useModalEscClose";
import { useDraggable } from "@/hooks/useDraggable";

import {
  RecibosConciliacionModalMulti,
  RecibosConciliacionModalDesvincular,
} from "./RecibosConciliacionModals";
import { fetchWithAuth } from "@/utils/fetchWithAuth";

import RecibosConciliacionManualModal from "./RecibosConciliacionManualModal";

// ------------------------------------------

export interface ReciboValor {
  valorId: number;
  cobranzaId: number;
  clienteId: string;
  nombre_cliente: string;
  documento: string;
  codigo: string;
  observacion: string;
  monto: number;
  recibo: string;
  empresa: string;
  empresa_nombre: string;
  empresa_division: string;
  estado: "pendiente" | "enviado" | "error";
  response_json?: any;
  fecha: string;
  hojaRuta?: string;
  aCuenta?: number;

  __idx?: number; // para mantener orden original
}

const CATEGORIAS_RESALTADO = [
  { key: "empresa", label: "Empresa no coincide", dot: "bg-yellow-400" },
  { key: "efe", label: "EFE en conflicto", dot: "bg-cyan-400" },
  { key: "noConciliadas", label: "Cobranza con valores sin conciliar", dot: "bg-pink-400" },
  { key: "aCuenta", label: "A cuenta", dot: "bg-green-400" },
  { key: "tipoDifiere", label: "Tipo de cobro difiere del conciliado", dot: "bg-red-400" },
  { key: "docMismatch", label: "Documento conciliado no coincide", dot: "bg-orange-400" },
  { key: "manyMatches", label: "Múltiples coincidencias al conciliar", dot: "bg-yellow-300" },
  { key: "importe", label: "Importe con discrepancia", dot: "bg-red-500" },
] as const;

type CategoriaResaltado = typeof CATEGORIAS_RESALTADO[number]["key"];

interface Props {
  hojaRuta: string;
  rows: ReciboValor[];
  conciliados?: Record<number, any>;
  pendientesAplicar: Set<number>;
  discrepancias?: Set<number>;
  discrepanciasEmpresa?: Set<number>;
  recibosConEFEConflicto?: Set<string>;
  cobranzasNoConciliadasTransmitir?: Set<number>;
  recibosConACuenta?: Set<number>;
  choferMap?: Record<string, string>;
  idsADeseleccionar?: Set<number>;
  fechaMinHDR?: string;
  fechaMaxHDR?: string;

  onSelectChange?: (selected: Set<number>) => void;
  onEditar?: (cobranzaId: number) => void;

  onConciliadoManual?: (valorId: number, data: any) => void;
  onDesvinculado?: (valorId: number) => void;
  onReplicarTipoCobro?: (valorId: number, nuevoCodigo: string) => Promise<void>;
}

const RecibosTabla: React.FC<Props> = ({
  hojaRuta,
  rows,
  conciliados = {},
  pendientesAplicar,
  discrepancias = new Set(),
  discrepanciasEmpresa = new Set(),
  recibosConEFEConflicto = new Set(),
  cobranzasNoConciliadasTransmitir = new Set<number>(),
  recibosConACuenta = new Set<number>(),
  choferMap,
  idsADeseleccionar,
  fechaMinHDR,
  fechaMaxHDR,
  onSelectChange,
  onEditar,
  onConciliadoManual,
  onDesvinculado,
  onReplicarTipoCobro,
}) => {

  // ---------------------------
  // ESTADOS
  // ---------------------------
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [vistaColumnas, setVistaColumnas] = useState<'clasica' | 'agrupada'>(() => {
    try { return (localStorage.getItem('recibos-vista-columnas') as 'clasica' | 'agrupada') || 'clasica'; }
    catch { return 'clasica'; }
  });
  const cambiarVista = (v: 'clasica' | 'agrupada') => {
    setVistaColumnas(v);
    try { localStorage.setItem('recibos-vista-columnas', v); } catch {}
  };

  // Filtro por tipo de validación resaltada (popover en portal, para que no
  // quede recortado por el overflow-hidden de la tarjeta de la tabla)
  const [resaltadosActivos, setResaltadosActivos] = useState<Set<CategoriaResaltado>>(new Set());
  const [resaltadosOpen, setResaltadosOpen] = useState(false);
  const resaltadosBtnRef = useRef<HTMLButtonElement>(null);
  const resaltadosPanelRef = useRef<HTMLDivElement>(null);
  const [resaltadosPos, setResaltadosPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!resaltadosOpen || !resaltadosBtnRef.current) return;

    const calcularPosicion = () => {
      const rect = resaltadosBtnRef.current!.getBoundingClientRect();
      const margen = 8;
      const espacioAbajo = window.innerHeight - rect.bottom - margen;
      const espacioArriba = rect.top - margen;
      const abrirHaciaArriba = espacioAbajo < 200 && espacioArriba > espacioAbajo;

      setResaltadosPos(
        abrirHaciaArriba
          ? { left: rect.left, bottom: window.innerHeight - rect.top + 4, maxHeight: Math.max(150, espacioArriba) }
          : { left: rect.left, top: rect.bottom + 4, maxHeight: Math.max(150, espacioAbajo) }
      );
    };

    calcularPosicion();
    window.addEventListener("resize", calcularPosicion);
    window.addEventListener("scroll", calcularPosicion, true);
    return () => {
      window.removeEventListener("resize", calcularPosicion);
      window.removeEventListener("scroll", calcularPosicion, true);
    };
  }, [resaltadosOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        resaltadosBtnRef.current && !resaltadosBtnRef.current.contains(target) &&
        resaltadosPanelRef.current && !resaltadosPanelRef.current.contains(target)
      ) {
        setResaltadosOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [multiModalData, setMultiModalData] = useState<any>(null);
  const [manualData, setManualData] = useState<any>(null);
  const [desvincularData, setDesvincularData] = useState<any>(null);
  const [replicarData, setReplicarData] = useState<{ valorId: number; codigoActual: string; codigoNuevo: string } | null>(null);
  const [replicarLoading, setReplicarLoading] = useState(false);
  useModalEscClose(!!replicarData && !replicarLoading, () => setReplicarData(null));
  const { style: styleReplicar, handleProps: handlePropsReplicar } = useDraggable(!!replicarData);

  // ---------------------------
  // ORDENAMIENTO
  // ---------------------------
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

  const toggleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortCol(null);
      setSortDir(null);
    }
  };

  const sortIcon = (col: string) => {
    if (sortCol !== col) return "";
    if (sortDir === "asc") return "▲";
    if (sortDir === "desc") return "▼";
    return "";
  };

  // Cuando rows cambia (post-transmisión), destilda los que quedaron en estado "enviado"
  React.useEffect(() => {
    const enviadosIds = new Set(rows.filter(r => r.estado === "enviado").map(r => r.valorId));
    setSelected(prev => {
      if (![...prev].some(id => enviadosIds.has(id))) return prev;
      const next = new Set([...prev].filter(id => !enviadosIds.has(id)));
      onSelectChange?.(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Destilda los valorIds que acaban de ser transmitidos (incluso los que quedaron en error)
  React.useEffect(() => {
    if (!idsADeseleccionar?.size) return;
    setSelected(prev => {
      if (![...prev].some(id => idsADeseleccionar.has(id))) return prev;
      const next = new Set([...prev].filter(id => !idsADeseleccionar.has(id)));
      onSelectChange?.(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsADeseleccionar]);

  // ---------------------------
  // SELECCIÓN
  // ---------------------------
  const actualizarSeleccion = (next: Set<number>) => {
    setSelected(next);
    onSelectChange?.(next);
  };

  const toggleSelect = (valorId: number) => {
    const next = new Set(selected);
    next.has(valorId) ? next.delete(valorId) : next.add(valorId);
    actualizarSeleccion(next);
  };

// 🚫 Nunca seleccionar valores enviados
const toggleSelectAll = () => {
  // Solo valores NO enviados
  const visiblesNoEnviados = filtered
    .filter((r) => r.estado !== "enviado")
    .map((r) => r.valorId);

  const next = new Set(selected);

  const allSelected = visiblesNoEnviados.every((v) => next.has(v));

  if (allSelected) {
    visiblesNoEnviados.forEach((v) => next.delete(v));
  } else {
    visiblesNoEnviados.forEach((v) => next.add(v));
  }

  actualizarSeleccion(next);
};


  // ---------------------------
  // CATEGORÍAS DE RESALTADO (por fila) — misma lógica que se usa para pintar
  // las celdas, centralizada acá para poder filtrar sin duplicar reglas.
  // ---------------------------
  const categoriasPorValorId = useMemo(() => {
    const map = new Map<number, Set<CategoriaResaltado>>();
    const add = (valorId: number, cat: CategoriaResaltado) => {
      if (!map.has(valorId)) map.set(valorId, new Set());
      map.get(valorId)!.add(cat);
    };

    rows.forEach((r) => {
      if (discrepanciasEmpresa.has(r.valorId)) add(r.valorId, "empresa");
      if (recibosConEFEConflicto.has(r.recibo)) add(r.valorId, "efe");
      if (cobranzasNoConciliadasTransmitir.has(r.cobranzaId)) add(r.valorId, "noConciliadas");
      if (recibosConACuenta.has(r.valorId)) add(r.valorId, "aCuenta");
      if (discrepancias.has(r.valorId)) add(r.valorId, "importe");

      const conc = conciliados[r.valorId];
      if (conc) {
        const dgDocNorm = (r.documento || "").trim().replace(/\D+/g, "");
        const concDocNorm = (conc.documento || "").trim().replace(/\D+/g, "");
        const docMismatch = concDocNorm !== "" && dgDocNorm !== "" && dgDocNorm !== concDocNorm;
        if (docMismatch) add(r.valorId, "docMismatch");

        const tipoDifiere =
          !!conc.extractoId &&
          !!conc.tipoCobro &&
          conc.tipoCobro.trim().toUpperCase() !== r.codigo.trim().toUpperCase();
        if (tipoDifiere) add(r.valorId, "tipoDifiere");

        if (conc.manyMatches) add(r.valorId, "manyMatches");
      }
    });

    return map;
  }, [rows, conciliados, discrepanciasEmpresa, recibosConEFEConflicto, cobranzasNoConciliadasTransmitir, recibosConACuenta, discrepancias]);

  const conteoPorCategoria = useMemo(() => {
    const counts = {} as Record<CategoriaResaltado, number>;
    CATEGORIAS_RESALTADO.forEach((c) => (counts[c.key] = 0));
    categoriasPorValorId.forEach((cats) => {
      cats.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
    });
    return counts;
  }, [categoriasPorValorId]);

  // ---------------------------
  // BÚSQUEDA + FILTRO POR RESALTADOS
  // ---------------------------
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = rows;

    if (s) {
      base = base.filter((r) =>
        (
          r.clienteId +
          r.nombre_cliente +
          r.documento +
          r.codigo +
          r.observacion +
          r.recibo +
          r.empresa_nombre +
          r.empresa_division
        )
          .toLowerCase()
          .includes(s)
      );
    }

    if (resaltadosActivos.size > 0) {
      base = base.filter((r) => {
        const cats = categoriasPorValorId.get(r.valorId);
        if (!cats) return false;
        for (const c of resaltadosActivos) {
          if (cats.has(c)) return true;
        }
        return false;
      });
    }

    return base;
  }, [rows, q, resaltadosActivos, categoriasPorValorId]);

  // ---------------------------
  // ORDENADO FINAL
  // ---------------------------
  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered;

    const copy = [...filtered];

    copy.sort((a, b) => {
      let x: any = a[sortCol as keyof ReciboValor];
      let y: any = b[sortCol as keyof ReciboValor];

      if (sortCol === "monto") {
        x = Number(x);
        y = Number(y);
      }

      if (x < y) return sortDir === "asc" ? -1 : 1;
      if (x > y) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return copy;
  }, [filtered, sortCol, sortDir]);

  const formatMoneda = (n: number) =>
    n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

      {/* BUSCADOR */}
      <div className="p-3 border-b border-gray-200 flex items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div
          className="flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5 bg-gray-50 shrink-0"
          title="Muestra las columnas de conciliación de manera agrupada o intercalada con los datos del recibo"
        >
          <button
            onClick={() => cambiarVista('clasica')}
            className={`px-2.5 py-1 text-xs rounded-md transition-all whitespace-nowrap ${vistaColumnas === 'clasica' ? 'bg-white shadow text-blue-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Vista clásica
          </button>
          <button
            onClick={() => cambiarVista('agrupada')}
            className={`px-2.5 py-1 text-xs rounded-md transition-all whitespace-nowrap ${vistaColumnas === 'agrupada' ? 'bg-white shadow text-blue-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Agrupada
          </button>
        </div>

        <div className="shrink-0">
          <button
            ref={resaltadosBtnRef}
            type="button"
            onClick={() => setResaltadosOpen((o) => !o)}
            title="Filtrar por tipo de validación resaltada"
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs rounded-lg border transition-colors ${
              resaltadosActivos.size > 0
                ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Resaltados
            {resaltadosActivos.size > 0 && (
              <span className="bg-blue-600 text-white rounded-full min-w-[16px] h-4 px-1 text-[10px] flex items-center justify-center">
                {resaltadosActivos.size}
              </span>
            )}
          </button>

          {resaltadosOpen && resaltadosPos && createPortal(
            <div
              ref={resaltadosPanelRef}
              style={{
                position: "fixed",
                left: resaltadosPos.left,
                top: resaltadosPos.top,
                bottom: resaltadosPos.bottom,
                maxHeight: resaltadosPos.maxHeight,
              }}
              className="z-[100] w-80 bg-white border border-gray-200 rounded-lg shadow-xl p-2 overflow-y-auto"
            >
              <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b">
                <span className="text-xs font-semibold text-gray-600">Filtrar por validación</span>
                {resaltadosActivos.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setResaltadosActivos(new Set())}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              {CATEGORIAS_RESALTADO.map((cat) => {
                const count = conteoPorCategoria[cat.key] ?? 0;
                return (
                  <label
                    key={cat.key}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
                      count === 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={count === 0}
                      checked={resaltadosActivos.has(cat.key)}
                      onChange={() => {
                        setResaltadosActivos((prev) => {
                          const next = new Set(prev);
                          next.has(cat.key) ? next.delete(cat.key) : next.add(cat.key);
                          return next;
                        });
                      }}
                      className="w-3.5 h-3.5"
                    />
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cat.dot}`} />
                    <span className="text-xs text-gray-700 flex-1">{cat.label}</span>
                    <span className="text-xs text-gray-400">{count}</span>
                  </label>
                );
              })}
            </div>,
            document.body
          )}
        </div>

        <span className="text-sm text-gray-500 shrink-0">
          {sorted.length} registros
        </span>
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200">
          <thead className="bg-gray-50 text-gray-700">
            <tr className="text-left">

              <th className="px-2 py-1 text-center">
                <input
                  type="checkbox"
                  onChange={toggleSelectAll}
                  checked={
                    sorted
                      .filter((r) => r.estado !== "enviado")       // solo seleccionables
                      .every((r) => selected.has(r.valorId))       // todos seleccionados?
                      &&
                    sorted.some((r) => r.estado !== "enviado")     // pero que haya alguno seleccionable
                  }                  
                />
              </th>

              <th className="px-2 py-1 text-center cursor-pointer">
                Estado {sortIcon("estado")}
              </th>

              <th className="px-3 py-2 border text-center">
                Editar
              </th>

              <th
                className="px-2 py-1 cursor-pointer"
                onClick={() => toggleSort("empresa_nombre")}
              >
                Empresa {sortIcon("empresa_nombre")}
              </th>

              <th
                className="px-3 py-2 border cursor-pointer"
                onClick={() => toggleSort("recibo")}
              >
                Recibo {sortIcon("recibo")}
              </th>

              <th
                className="px-3 py-2 border cursor-pointer"
                onClick={() => toggleSort("clienteId")}
              >
                Cliente {sortIcon("clienteId")}
              </th>

              <th className="px-3 py-2 border cursor-pointer" onClick={() => toggleSort("nombre_cliente")}>
                Nombre {sortIcon("nombre_cliente")}
              </th>

              {vistaColumnas === 'agrupada' && (
                <th className="px-3 py-2 border cursor-pointer" onClick={() => toggleSort("codigo")}>
                  Tipo {sortIcon("codigo")}
                </th>
              )}

              <th className="px-3 py-2 border cursor-pointer" onClick={() => toggleSort("documento")}>
                Documento {sortIcon("documento")}
              </th>

              {vistaColumnas === 'agrupada' && (
                <th className="px-3 py-2 border bg-blue-50 text-blue-700">Documento conc.</th>
              )}

              {vistaColumnas === 'clasica' && (
                <th className="px-3 py-2 border cursor-pointer" onClick={() => toggleSort("codigo")}>
                  Tipo {sortIcon("codigo")}
                </th>
              )}

              <th className="px-3 py-2 border cursor-pointer" onClick={() => toggleSort("observacion")}>
                Observación {sortIcon("observacion")}
              </th>

              {vistaColumnas === 'agrupada' && (
                <th className="px-3 py-2 border bg-blue-50 text-blue-700">Operación conc.</th>
              )}

              <th className="px-3 py-2 border text-right cursor-pointer" onClick={() => toggleSort("monto")}>
                Monto {sortIcon("monto")}
              </th>

              {vistaColumnas === 'agrupada' && (
                <th className="px-3 py-2 border text-right bg-blue-50 text-blue-700">Importe conc.</th>
              )}

              {vistaColumnas === 'clasica' && (
                <>
                  <th className="px-3 py-2 border">Operación conc.</th>
                  <th className="px-3 py-2 border">Documento conc.</th>
                  <th className="px-3 py-2 border text-right">Importe conc.</th>
                </>
              )}

              <th className="px-3 py-2 border text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((r) => {
              const conc = conciliados[r.valorId];
              const isEnviado = r.estado === "enviado";

              // Normalización: quitar espacios, tabs y todo lo no numérico
              const dgDocNorm = (r.documento || "").trim().replace(/\D+/g, "");
              const concDocNorm = (conc?.documento || "").trim().replace(/\D+/g, "");

              // Solo mismatch si ambos existen y realmente son distintos
              const docMismatch =
                conc &&
                concDocNorm !== "" &&
                dgDocNorm !== "" &&
                dgDocNorm !== concDocNorm;

              const manyMatches = conc?.manyMatches;
              const concBg = manyMatches ? "bg-yellow-100 cursor-pointer" : "";
              const concTitle = manyMatches ? "Múltiples coincidencias detectadas al conciliar — click para ver el detalle" : undefined;
              const abrirMultiModal = () =>
                manyMatches &&
                conc?.candidatos &&
                setMultiModalData({
                  recibo: {
                    valorId: r.valorId,
                    codigo: r.codigo,
                    clienteId: r.clienteId,
                    documento: r.documento,
                    monto: r.monto,
                    observacion: r.observacion,
                    chofer: choferMap?.[r.hojaRuta ?? ""],
                  },
                  candidatos: conc.candidatos,
                });

              const tipoDifiere =
                !!conc?.extractoId &&
                !!conc?.tipoCobro &&
                conc.tipoCobro.trim().toUpperCase() !== r.codigo.trim().toUpperCase();
              const docBg = docMismatch ? "bg-orange-100" : concBg;

              const EstadoIcono =
                {
                  enviado: "🟢",
                  pendiente: "🟡",
                  error: "🔴",
                }[r.estado] || "⚪";

              return (
                <tr key={r.valorId} className="border-t hover:bg-blue-100">

                  <td className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(r.valorId)}
                      disabled={isEnviado}
                      onChange={() => !isEnviado && toggleSelect(r.valorId)}
                      className={`w-4 h-4 ${isEnviado ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                    />
                  </td>

                  <td className="px-2 py-1 text-center" title={r.estado}>
                    {EstadoIcono}
                  </td>

                  <td className="px-3 py-2 border text-center">
                    <button
                      type="button"
                      onClick={() => onEditar?.(r.cobranzaId)}
                      className="p-1 rounded hover:bg-blue-50 text-blue-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>

                  <td
                    className={`px-2 py-1${discrepanciasEmpresa.has(r.valorId) ? " bg-yellow-100 text-yellow-800 font-semibold" : ""}`}
                    title={discrepanciasEmpresa.has(r.valorId) ? "La empresa del recibo no coincide con la empresa del tipo de cobro" : undefined}
                  >
                    {r.empresa_nombre} ({r.empresa_division})
                  </td>

                  <td
                    className={`px-3 py-2 border${recibosConEFEConflicto.has(r.recibo) ? " bg-cyan-100 text-cyan-900 font-semibold" : ""}`}
                    title={recibosConEFEConflicto.has(r.recibo) ? "Este recibo tiene Tipo EFE junto a otro tipo de cobro en el mismo recibo" : undefined}
                  >
                    {r.recibo}
                  </td>

                  <td
                    className={`px-3 py-2 border${cobranzasNoConciliadasTransmitir.has(r.cobranzaId) ? " bg-pink-100 text-pink-800 font-semibold" : ""}`}
                    title={cobranzasNoConciliadasTransmitir.has(r.cobranzaId) ? "Este recibo tiene valores sin conciliar" : undefined}
                  >
                    {r.clienteId}
                  </td>
                  <td
                    className={`px-3 py-2 border${recibosConACuenta.has(r.valorId) ? " bg-green-100 text-green-800 font-semibold" : ""}`}
                    title={recibosConACuenta.has(r.valorId) ? `aCuenta: $${r.aCuenta} — el importe a cuenta supera los $10` : undefined}
                  >
                    {r.nombre_cliente}
                  </td>

                  {vistaColumnas === 'agrupada' && (
                    <td
                      className={`px-3 py-2 border ${tipoDifiere ? "bg-red-50 text-red-600 font-semibold cursor-pointer hover:bg-red-100" : ""}`}
                      title={tipoDifiere ? `Tipo conciliado: ${conc?.tipoCobro} — click para replicar` : undefined}
                      onClick={() => tipoDifiere && setReplicarData({ valorId: r.valorId, codigoActual: r.codigo, codigoNuevo: conc!.tipoCobro! })}
                    >
                      {r.codigo}
                    </td>
                  )}

                  <td className="px-3 py-2 border">{r.documento}</td>

                  {vistaColumnas === 'agrupada' && (
                    <td
                      className={`px-3 py-2 border ${docBg}`}
                      title={docMismatch ? undefined : concTitle}
                      onClick={docMismatch ? undefined : abrirMultiModal}
                    >
                      {conc?.documento || ""}
                    </td>
                  )}

                  {vistaColumnas === 'clasica' && (
                    <td
                      className={`px-3 py-2 border ${tipoDifiere ? "bg-red-50 text-red-600 font-semibold cursor-pointer hover:bg-red-100" : ""}`}
                      title={tipoDifiere ? `Tipo conciliado: ${conc?.tipoCobro} — click para replicar` : undefined}
                      onClick={() => tipoDifiere && setReplicarData({ valorId: r.valorId, codigoActual: r.codigo, codigoNuevo: conc!.tipoCobro! })}
                    >
                      {r.codigo}
                    </td>
                  )}

                  <td className="px-3 py-2 border">{r.observacion || "-"}</td>

                  {vistaColumnas === 'agrupada' && (
                    <td
                      className={`px-3 py-2 border ${concBg}`}
                      title={concTitle}
                      onClick={abrirMultiModal}
                    >
                      {conc?.operacion || ""}
                    </td>
                  )}

                  <td className={`px-3 py-2 border text-right${discrepancias.has(r.valorId) ? " bg-red-100 text-red-700 font-semibold" : ""}`}>
                    {formatMoneda(r.monto)}
                  </td>

                  {vistaColumnas === 'agrupada' && (
                    <td
                      className={`px-3 py-2 border text-right ${concBg}`}
                      title={concTitle}
                      onClick={abrirMultiModal}
                    >
                      {conc?.importe ? formatMoneda(Number(conc.importe)) : ""}
                    </td>
                  )}

                  {vistaColumnas === 'clasica' && (
                    <>
                      <td
                        className={`px-3 py-2 border ${concBg}`}
                        title={concTitle}
                        onClick={abrirMultiModal}
                      >
                        {conc?.operacion || ""}
                      </td>
                      <td
                        className={`px-3 py-2 border ${docBg}`}
                        title={docMismatch ? undefined : concTitle}
                        onClick={docMismatch ? undefined : abrirMultiModal}
                      >
                        {conc?.documento || ""}
                      </td>
                      <td
                        className={`px-3 py-2 border text-right ${concBg}`}
                        title={concTitle}
                        onClick={abrirMultiModal}
                      >
                        {conc?.importe ? formatMoneda(Number(conc.importe)) : ""}
                      </td>
                    </>
                  )}

                  <td
                    className={`px-3 py-2 border text-center flex gap-2 justify-center ${
                      pendientesAplicar.has(r.valorId) ? "bg-green-100" : ""
                    }`}
                  >
                    {/* MANUAL */}
                    <button
                      disabled={isEnviado}
                      title="Concilia Manual"
                      onClick={() =>
                        !isEnviado &&
                        setManualData({
                          valorId: r.valorId,
                          codigo: r.codigo,
                          documento: r.documento,
                          monto: r.monto,
                          fecha: r.fecha.split("T")[0],
                          observacion: r.observacion,
                          chofer: choferMap?.[r.hojaRuta ?? ''],
                          fechaDesdeInicial: fechaMinHDR,
                          fechaHastaInicial: fechaMaxHDR,
                        })
                      }
                      className={`text-blue-600 ${
                        isEnviado
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:text-blue-800"
                      }`}
                    >
                      <Handshake className="w-4 h-4" />
                    </button>

                    {/* DESVINCULAR */}
                    {conc?.extractoId ? (
                      isEnviado ? (
                        <span className="text-gray-300 cursor-not-allowed">
                          <Unlink className="w-4 h-4" />
                        </span>
                      ) : (
                        <button
                          title="Desvincular"
                          onClick={() =>
                            setDesvincularData({
                              valorId: r.valorId,
                              operacion: conc.operacion,
                              extractoId: conc.extractoId,
                            })
                          }
                          className="text-red-600 hover:text-red-800"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODALES */}
      {multiModalData && (
        <RecibosConciliacionModalMulti
          data={multiModalData}
          onClose={() => setMultiModalData(null)}
          onSelect={(candidato) => {
            if (!candidato) return setMultiModalData(null);

            const { recibo } = multiModalData;

            onConciliadoManual?.(recibo.valorId, {
              extractoId: candidato.extractoId,
              operacion: candidato.operacion,
              documento: candidato.documento,
              importe: candidato.importe,
              tipoCobro: candidato.tipoCobro,
            });

            setMultiModalData(null);
          }}
        />
      )}

      {manualData && (
        <RecibosConciliacionManualModal
          open={true}
          recibo={manualData}
          onClose={() => setManualData(null)}
          onSelect={({ valorId, conciliado }) => {
            onConciliadoManual?.(valorId, conciliado);
            setManualData(null);
          }}
        />
      )}

      {desvincularData && (
        <RecibosConciliacionModalDesvincular
          open={true}
          operacion={desvincularData.operacion}
          onClose={() => setDesvincularData(null)}
          onConfirm={async () => {
            await fetchWithAuth("/api/gestor/conciliacion/hdr/desvincular", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                extractos: [desvincularData.extractoId],
              }),
            });

            onDesvinculado?.(desvincularData.valorId);
            setDesvincularData(null);
          }}
        />
      )}
    </div>

    {/* Modal replicar tipo de cobro */}
    {replicarData && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div style={styleReplicar} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
          <h3 {...handlePropsReplicar} className="text-base font-bold text-red-600 mb-3">Tipo de Cobro del Recibo difiere del conciliado</h3>
          <p className="text-sm text-gray-700 mb-1">
            Tipo en el recibo: <span className="font-bold text-gray-900">{replicarData.codigoActual}</span>
          </p>
          <p className="text-sm text-gray-700 mb-4">
            Tipo conciliado: <span className="font-bold text-blue-700">{replicarData.codigoNuevo}</span>
          </p>
          <p className="text-sm text-gray-500 mb-5">¿Deseás replicar el tipo de cobro del extracto en el recibo?</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setReplicarData(null)}
              disabled={replicarLoading}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              disabled={replicarLoading}
              onClick={async () => {
                setReplicarLoading(true);
                await onReplicarTipoCobro?.(replicarData.valorId, replicarData.codigoNuevo);
                setReplicarLoading(false);
                setReplicarData(null);
              }}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {replicarLoading ? "Guardando…" : "Replicar"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default RecibosTabla;
