import { useEffect, useState, useMemo, Fragment, useRef, useCallback } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { usePresupuesto } from "@/contexts/PresupuestoEnroContext";
import { useCatalogos, useCatalogosState } from "@/contexts/CatalogosContext";
import { API } from "@/constants/api";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search } from "lucide-react";
// exceljs se importa dinámicamente en handleExport


const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const fmtDiff = (n: number) => {
  const abs = `$ ${Math.abs(Math.round(n)).toLocaleString("es-AR")}`;
  return n < 0 ? `-${abs}` : abs;
};

function MoneyInput({ value, onCommit, disabled }: { value: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(String(Math.round(value)));
  return (
    <Input
      type="text"
      disabled={disabled}
      value={focused ? raw : fmt(Math.round(Number(raw) || 0))}
      onFocus={() => { if (!disabled) setFocused(true); }}
      onChange={e => { if (!disabled) setRaw(e.target.value.replace(/[^0-9-]/g, "")); }}
      onBlur={() => { setFocused(false); if (!disabled) onCommit(Number(raw)); }}
      className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    />
  );
}

type RowZona = {
  proveedor_codigo: number;
  division_codigo: number;
  zona: string;
  def_crec_zona: number | null;
  objetivo_base_zona: number;
  objetivo_zona: number;
  obj_vs_mes_anterior: number | null;
  obj_vs_mpaa: number | null;
};

export default function ZonaTab({ readonly = false }: { readonly?: boolean }) {
  const { state, dispatch } = usePresupuesto();
  const modoGuardado = state.modoGuardado;
  const catalogos = useCatalogos();
  const { loading: catalogosLoading } = useCatalogosState();

  const [rows, setRows] = useState<RowZona[]>([]);
  const [loading, setLoading] = useState(true);

  const pageSize = state.pageSize;
  const fullscreen = state.fullscreen;

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");

  type PendingZona = { row: RowZona; numeric: number | null };
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingZona>>(new Map());

  // totals: keyed by zona name → { bgtOrig, bgtFinal, baseMA, objMA, baseMPAA, objMPAA }
  type ZonaTotal = { bgtOrig: number; bgtFinal: number; baseMA: number; objMA: number; baseMPAA: number; objMPAA: number };
  const [totals, setTotals] = useState<Record<string, ZonaTotal> | null>(null);

  // ===== FILTRO ZONAS =====
  const [mostrarZonas, setMostrarZonas] = useState(false);
  const [zonasVisibles, setZonasVisibles] = useState<string[]>([]);
  const [busquedaZona, setBusquedaZona] = useState("");
  const zonasRef = useRef<HTMLDivElement>(null);
  const [totalFijo, setTotalFijo] = useState(() => localStorage.getItem('pres-total-fijo') === '1');


  // ================================
  // LABEL DINÁMICO MA
  // ================================

  // ================================
  // FORMATEADORES
  // ================================

  const money = (v: number | null | undefined) =>
    v !== null && v !== undefined
      ? `$ ${Math.round(v).toLocaleString("es-AR")}`
      : "-";

  const pct = (v: number | null | undefined) =>
    v !== null && v !== undefined
      ? `${(v * 100).toFixed(2)} %`
      : "-";

  const pctColor = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "";
    return v < 0
      ? "bg-red-200 text-red-800"
      : "bg-green-200 text-green-800";
  };

  const proveedoresMap = useMemo(() => {
    return Object.fromEntries(
      catalogos.proveedores.map((p) => [p.codigo, `${p.codigo} - ${p.nombre}`])
    );
  }, [catalogos.proveedores]);

  const divisionesMap = useMemo(() => {
    return Object.fromEntries(
      catalogos.divisiones.map((d) => [d.codigo, `${d.codigo} - ${d.nombre}`])
    );
  }, [catalogos.divisiones]);

  // ================================
  // FETCH DATA
  // ================================

  const reload = async () => {
    if (!state.mesObjetivo) return;

    setLoading(true);

    const matchingCodes = busquedaDebounced.trim()
      ? catalogos.proveedores
          .filter(p => `${p.codigo} - ${p.nombre}`.toLowerCase().includes(busquedaDebounced.trim().toLowerCase()))
          .map(p => p.codigo)
      : [];

    const filtros: Record<string, any> = {};
    if (matchingCodes.length) filtros.proveedor_codigo = matchingCodes;

    const res = await fetchWithAuth(
      API.PRESUPUESTO_ENRO.ZONA.QUERY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes: state.mesObjetivo,
          filtros,
          pagination: { page, pageSize }
        })
      }
    );

    if (res.success) {
      const data = await res.json();
      setRows(data.data.rows);
      setTotalPages(data.data.pagination.totalPages);
    }

    setLoading(false);
    window.dispatchEvent(new CustomEvent("presupuesto-tab-loaded"));
  };

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 700);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mesObjetivo, page, pageSize, busquedaDebounced]);

  useEffect(() => {
    setPage(1);
  }, [busquedaDebounced]);

  const reloadTotals = useCallback(async () => {
    if (!state.mesObjetivo) return;

    const matchingCodes = busquedaDebounced.trim()
      ? catalogos.proveedores
          .filter(p => `${p.codigo} - ${p.nombre}`.toLowerCase().includes(busquedaDebounced.trim().toLowerCase()))
          .map(p => p.codigo)
      : [];

    const filtros: Record<string, any> = {};
    if (matchingCodes.length) filtros.proveedor_codigo = matchingCodes;

    const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.ZONA.QUERY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes: state.mesObjetivo, filtros, pagination: { page: 1, pageSize: 999999 } })
    });

    if (!res.success) return;

    const data = await res.json();
    const allRows: RowZona[] = data.data.rows;

    const t: Record<string, ZonaTotal> = {};
    allRows.forEach(r => {
      if (!t[r.zona]) t[r.zona] = { bgtOrig: 0, bgtFinal: 0, baseMA: 0, objMA: 0, baseMPAA: 0, objMPAA: 0 };
      const zt = t[r.zona];
      zt.bgtOrig += r.objetivo_base_zona ?? 0;
      zt.bgtFinal += r.objetivo_zona ?? 0;
      // Base implícita: objetivo_zona = base * (1 + ratio) => base = objetivo_zona / (1 + ratio)
      if (r.obj_vs_mes_anterior !== null && r.obj_vs_mes_anterior !== undefined && (1 + r.obj_vs_mes_anterior) !== 0) {
        zt.baseMA += (r.objetivo_zona ?? 0) / (1 + r.obj_vs_mes_anterior);
        zt.objMA += r.objetivo_zona ?? 0;
      }
      if (r.obj_vs_mpaa !== null && r.obj_vs_mpaa !== undefined && (1 + r.obj_vs_mpaa) !== 0) {
        zt.baseMPAA += (r.objetivo_zona ?? 0) / (1 + r.obj_vs_mpaa);
        zt.objMPAA += r.objetivo_zona ?? 0;
      }
    });
    setTotals(t);
  }, [state.mesObjetivo, busquedaDebounced, catalogos.proveedores]);

  useEffect(() => {
    reloadTotals();
  }, [state.mesObjetivo, reloadTotals]);

  // ================================
  // PIVOT
  // ================================

  const zonasUnicas = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.zona))).sort();
  }, [rows]);

  // Inicializar zonas visibles
  useEffect(() => {
    setZonasVisibles(prev =>
      prev.length === 0 ? zonasUnicas : prev
    );
  }, [zonasUnicas]);

  // ===== ZONAS FILTRADAS (según selector) =====
  const zonasFiltradas: string[] = useMemo(() => {
    return zonasUnicas.filter((z: string) =>
      zonasVisibles.includes(z)
    );
  }, [zonasUnicas, zonasVisibles]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
  
      if (zonasRef.current && !zonasRef.current.contains(target)) {
        setMostrarZonas(false);
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  


  const dataAgrupada = useMemo(() => {
    const map: any = {};

    rows.forEach((row) => {
      const key = `${row.proveedor_codigo}_${row.division_codigo}`;

      if (!map[key]) {
        map[key] = {
          proveedor_codigo: row.proveedor_codigo,
          division_codigo: row.division_codigo,
          zonas: {}
        };
      }

      map[key].zonas[row.zona] = row;
    });

    return Object.values(map);
  }, [rows]);

  const grouped = useMemo(() => {
    const map: Record<number, any[]> = {};
    dataAgrupada.forEach((row: any) => {
      if (!map[row.proveedor_codigo]) map[row.proveedor_codigo] = [];
      map[row.proveedor_codigo].push(row);
    });
    return Object.values(map);
  }, [dataAgrupada]);

  const grandTotalAll = useMemo(() => {
    if (!totals) return { bgtOrig: 0, bgtFinal: 0 };
    let bgtOrig = 0, bgtFinal = 0;
    zonasFiltradas.forEach(zona => {
      const t = totals[zona];
      if (t) { bgtOrig += t.bgtOrig; bgtFinal += t.bgtFinal; }
    });
    return { bgtOrig, bgtFinal };
  }, [totals, zonasFiltradas]);

  // =====================================================
// EXPORTAR EXCEL
// =====================================================

useEffect(() => {
    const handleExport = async (event: any) => {
      if (event.detail?.nivel !== "zona") return;
      if (!state.mesObjetivo) return;

      const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.ZONA.QUERY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: state.mesObjetivo, pagination: { page: 1, pageSize: 999999 } })
      });
      if (!res.success) return;

      const data = await res.json();
      const exportRows: RowZona[] = data.data.rows;
      const soloFiltros: boolean = event.detail?.soloFiltros ?? false;
      const zonas = soloFiltros
        ? [...zonasFiltradas]
        : Array.from(new Set(exportRows.map(r => r.zona))).sort() as string[];

      // @ts-ignore
      const ExcelJS = await import("exceljs");
      const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
      const HEADER_FONT = { name: "Arial", bold: true, size: 10, color: { argb: "FF1E3A5F" } };
      const CELL_FONT   = { name: "Arial", size: 10 };
      const MONEY_FMT   = '"$ "#,##0;[Red]"$ "(-#,##0);"-"';
      const PCT_FMT     = '0.00"%"';
      const bThin = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
      const bMed  = { style: "medium" as const, color: { argb: "FF6B7280" } };

      const ZONA_COLORS: [string, string][] = [
        ["FFEEF2FF","FFE0E7FF"],["FFE0F7FA","FFB2EBF2"],["FFD1FAE5","FFA7F3D0"],
        ["FFFEF3C7","FFFDE68A"],["FFEDE9FE","FFDDD6FE"],["FFFFE4E6","FFFECDD3"]
      ];

      const wb = new ExcelJS.default.Workbook();
      const ws = wb.addWorksheet("Zona");

      // — Fila 1: Proveedor | División | [zona colSpan4] ...
      // — Fila 2: sub-headers Crec% | BGT | vs Prom 6M | VS MA
      const SKY_H = "FFBAE6FD"; const SKY_C = "FFE0F2FE";
      const AMBER_TH = "FFFEF3C7"; const AMBER_TC = "FFFEF9C3";

      // Header row 1
      const h1: any[] = ["Proveedor", "División"];
      zonas.forEach(z => { h1.push(z); h1.push(""); h1.push(""); h1.push(""); h1.push(""); });
      h1.push("Total Zona"); h1.push(""); h1.push("");
      const hr1 = ws.addRow(h1);
      hr1.height = 22;

      // Merge zona headers + total header
      zonas.forEach((_, zi) => {
        const startCol = 3 + zi * 6;
        ws.mergeCells(1, startCol, 1, startCol + 5);
      });
      const totalStartCol = 3 + zonas.length * 6;
      ws.mergeCells(1, totalStartCol, 1, totalStartCol + 2);

      // Style header row 1
      hr1.eachCell((cell: any, ci: number) => {
        const isTotal = ci >= totalStartCol;
        const zi = ci <= 2 ? -1 : Math.floor((ci - 3) / 5);
        const bgH = ci <= 2 ? SKY_H : isTotal ? AMBER_TH : ZONA_COLORS[zi % ZONA_COLORS.length][0];
        cell.font = HEADER_FONT;
        cell.fill = fill(bgH);
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      // Header row 2
      const h2: any[] = ["", ""];
      zonas.forEach(() => { h2.push("BGT Orig"); h2.push("Crec %"); h2.push("Crec $"); h2.push("BGT Final"); h2.push("VS MA"); h2.push("VS MPAA"); });
      h2.push("BGT Orig"); h2.push("BGT Final"); h2.push("Final - Orig");
      const hr2 = ws.addRow(h2);
      hr2.height = 18;
      hr2.eachCell((cell: any, ci: number) => {
        const isTotal = ci >= totalStartCol;
        const zi = ci <= 2 ? -1 : Math.floor((ci - 3) / 5);
        const bgH = ci <= 2 ? SKY_H : isTotal ? AMBER_TH : ZONA_COLORS[zi % ZONA_COLORS.length][0];
        cell.font = HEADER_FONT;
        cell.fill = fill(bgH);
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      // Build pivot map
      const pivotMap: Record<string, any> = {};
      exportRows.forEach(row => {
        const key = `${row.proveedor_codigo}_${row.division_codigo}`;
        if (!pivotMap[key]) pivotMap[key] = {
          proveedor: proveedoresMap[row.proveedor_codigo] ?? String(row.proveedor_codigo),
          division: divisionesMap[row.division_codigo] ?? String(row.division_codigo),
          zonas: {} as Record<string, RowZona>
        };
        pivotMap[key].zonas[row.zona] = row;
      });

      // Data rows
      // Per zona sub-col index: 0=bgtOrig, 1=crec%, 2=crec$, 3=bgtFinal, 4=maPct, 5=mpaaPct
      let grandBgtOrig = 0; let grandBgtFinal = 0;
      Object.values(pivotMap).forEach((item: any) => {
        const vals: any[] = [item.proveedor, item.division];
        let rowBgtOrig = 0; let rowBgtFinal = 0;
        zonas.forEach(z => {
          const zd = item.zonas[z];
          const orig = zd ? (zd.objetivo_base_zona ?? 0) : null;
          const final = zd?.objetivo_zona ?? null;
          vals.push(orig);
          vals.push(zd?.def_crec_zona ?? null);
          vals.push(orig !== null && final !== null ? final - orig : null);
          vals.push(final);
          vals.push(zd ? (zd.obj_vs_mes_anterior ?? null) !== null ? (zd.obj_vs_mes_anterior as number) * 100 : null : null);
          vals.push(zd ? (zd.obj_vs_mpaa ?? null) !== null ? (zd.obj_vs_mpaa as number) * 100 : null : null);
          if (zd) {
            rowBgtOrig  += orig ?? 0;
            rowBgtFinal += final ?? 0;
          }
        });
        grandBgtOrig  += rowBgtOrig;
        grandBgtFinal += rowBgtFinal;
        vals.push(rowBgtOrig); vals.push(rowBgtFinal); vals.push(rowBgtFinal - rowBgtOrig);
        const dr = ws.addRow(vals);
        dr.height = 18;
        dr.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
          const isTotal = ci >= totalStartCol;
          const zi = ci <= 2 ? -1 : Math.floor((ci - 3) / 6);
          const bgC = ci <= 2 ? SKY_C : isTotal ? AMBER_TC : ZONA_COLORS[zi % ZONA_COLORS.length][1];
          const subCol = ci <= 2 ? -1 : isTotal ? ci - totalStartCol : (ci - 3) % 6;
          // subCol: 0=bgtOrig,1=crec%,2=crec$,3=bgtFinal,4=maPct
          cell.font = isTotal ? { ...CELL_FONT, bold: true } : { ...CELL_FONT };
          cell.fill = fill(bgC);
          const isCenter = !isTotal && subCol === 1;
          cell.alignment = { horizontal: ci <= 2 ? "left" : isCenter ? "center" : "right", vertical: "middle" };
          cell.border = { top: bThin, bottom: bThin, left: bThin, right: bThin };
          if (isTotal) { if (cell.value !== null) cell.numFmt = MONEY_FMT; }
          else if (subCol === 0 || subCol === 2 || subCol === 3) { if (cell.value !== null) cell.numFmt = MONEY_FMT; }
          else if (subCol === 4 || subCol === 5) {
            cell.numFmt = PCT_FMT;
            if (cell.value !== null && typeof cell.value === "number") {
              cell.font = { ...CELL_FONT, color: { argb: cell.value < 0 ? "FFDC2626" : "FF16A34A" } };
            }
          }
        });
      });

      // Grand TOTAL row
      const gtr = ws.addRow(["TOTAL", "", ...zonas.flatMap(() => [null, null, null, null, null, null]),
        grandBgtOrig, grandBgtFinal, grandBgtFinal - grandBgtOrig]);
      gtr.height = 20;
      gtr.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
        const isTotal = ci >= totalStartCol;
        cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = fill("FF1E293B");
        cell.alignment = { horizontal: ci <= 2 ? "left" : "right", vertical: "middle" };
        cell.border = { top: { style: "medium" as const, color: { argb: "FF475569" } }, bottom: bThin, left: bThin, right: bThin };
        if (isTotal && cell.value !== null) cell.numFmt = MONEY_FMT;
      });

      // Column widths
      ws.getColumn(1).width = 30;
      ws.getColumn(2).width = 22;
      zonas.forEach((_, zi) => {
        ws.getColumn(3 + zi * 6).width = 18; // BGT Orig
        ws.getColumn(4 + zi * 6).width = 10; // Crec %
        ws.getColumn(5 + zi * 6).width = 18; // Crec $
        ws.getColumn(6 + zi * 6).width = 18; // BGT Final
        ws.getColumn(7 + zi * 6).width = 16; // VS MA
        ws.getColumn(8 + zi * 6).width = 16; // VS MPAA
      });
      ws.getColumn(totalStartCol).width = 18;
      ws.getColumn(totalStartCol + 1).width = 18;
      ws.getColumn(totalStartCol + 2).width = 18;
      ws.views = [{ state: "frozen", xSplit: 2, ySplit: 2 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Presupuesto_zona_${state.mesObjetivo}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    };
  
    window.addEventListener("export-presupuesto", handleExport);
  
    return () =>
      window.removeEventListener("export-presupuesto", handleExport);
  }, [state.mesObjetivo, proveedoresMap, divisionesMap, zonasFiltradas]);
  

  // ================================
  // COLORES ZONA (más marcados)
  // ================================

  const zonaColors = [
    "bg-indigo-100",
    "bg-cyan-100",
    "bg-emerald-100",
    "bg-amber-100",
    "bg-violet-100",
    "bg-rose-100"
  ];

  const getZonaColor = (index: number) =>
    zonaColors[index % zonaColors.length];

// ================================
// SAVE
// ================================

const saveChange = async (row: RowZona, value: string) => {
    const numeric = value === "" ? null : Number(value);
    const changeKey = `${row.proveedor_codigo}_${row.division_codigo}_${row.zona}`;

    if (modoGuardado === "manual") {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(changeKey, { row, numeric });
        return next;
      });
      return;
    }

    await fetchWithAuth(API.PRESUPUESTO_ENRO.ZONA.BASE, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mes: state.mesObjetivo,
        changes: [{ keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo, zona: row.zona }, crecimiento: numeric }]
      })
    });

    reload();
    reloadTotals();
  };

  const aplicarCambiosZona = async () => {
    if (!state.mesObjetivo || pendingChanges.size === 0) return;
    const changes = Array.from(pendingChanges.values()).map(({ row, numeric }) => ({
      keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo, zona: row.zona },
      crecimiento: numeric
    }));
    await fetchWithAuth(API.PRESUPUESTO_ENRO.ZONA.BASE, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes: state.mesObjetivo, changes })
    });
    setPendingChanges(new Map());
    reload();
    reloadTotals();
  };

  if (catalogosLoading) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-10 flex items-center justify-center gap-3 text-slate-500">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>Cargando datos...</span>
      </div>
    );
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-[60] bg-white flex flex-col p-4 gap-4" : "space-y-4"}>

      {/* CONTROLES */}
      {/* ===== FILTRO ZONAS ===== */}
      <div className="flex gap-4 items-center flex-wrap">

        <select
          className="border rounded-md px-2 py-1 text-sm shadow-sm"
          value={pageSize}
          onChange={e => { setPage(1); dispatch({ type: "SET_PAGE_SIZE", payload: Number(e.target.value) }); }}
        >
          <option value={15}>15</option>
          <option value={30}>30</option>
          <option value={50}>50</option>
          <option value={80}>80</option>
        </select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar proveedor..."
            className="pl-8 pr-3 py-1 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-52"
          />
        </div>

        <div className="relative" ref={zonasRef}>
          <button
            onClick={() => setMostrarZonas(!mostrarZonas)}
            className="px-3 py-1 border rounded bg-gray-100 flex items-center gap-2"
          >
            Zonas
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {mostrarZonas && (
            <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow max-h-96 overflow-auto w-80 resize both">

              <input
                type="text"
                placeholder="Buscar zona..."
                value={busquedaZona}
                onChange={e => setBusquedaZona(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm mb-3"
              />

              <label className="flex items-center gap-2 font-semibold text-sm mb-2">
                <input
                  type="checkbox"
                  checked={zonasVisibles.length === zonasUnicas.length}
                  onChange={() => {
                    if (zonasVisibles.length === zonasUnicas.length) {
                      setZonasVisibles([]);
                    } else {
                      setZonasVisibles(zonasUnicas);
                    }
                  }}
                />
                Seleccionar todas
              </label>

              {zonasUnicas
                .filter(z =>
                  z.toLowerCase().includes(busquedaZona.toLowerCase())
                )
                .map(z => (
                  <label key={z} className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={zonasVisibles.includes(z)}
                      onChange={() => {
                        setZonasVisibles(prev =>
                          prev.includes(z)
                            ? prev.filter(x => x !== z)
                            : [...prev, z]
                        );
                      }}
                    />
                    {z}
                  </label>
                ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={totalFijo} onChange={e => { setTotalFijo(e.target.checked); localStorage.setItem('pres-total-fijo', e.target.checked ? '1' : '0'); }} className="w-3.5 h-3.5 accent-amber-500" />
          Fijar totales
        </label>

        {!readonly && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => {
                if (modoGuardado === "manual" && pendingChanges.size > 0) setPendingChanges(new Map());
                dispatch({ type: "SET_MODO_GUARDADO", payload: modoGuardado === "auto" ? "manual" : "auto" });
              }}
              className={`px-3 py-1 rounded text-sm border ${modoGuardado === "manual" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
            >
              {modoGuardado === "auto" ? "Modo: Automático" : "Modo: Manual"}
            </button>
            {modoGuardado === "manual" && pendingChanges.size > 0 && (
              <>
                <button onClick={aplicarCambiosZona} className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700">
                  Aplicar ({pendingChanges.size})
                </button>
                <button onClick={() => setPendingChanges(new Map())} className="px-3 py-1 rounded text-sm bg-red-100 text-red-700 border border-red-300 hover:bg-red-200">
                  Descartar
                </button>
              </>
            )}
          </div>
        )}

      </div>



      {/* TABLA */}
      <div className={fullscreen ? "overflow-auto flex-1 min-h-0 rounded-lg border shadow-sm" : "overflow-x-auto rounded-lg border shadow-sm"}>

      <table className="min-w-max table-fixed text-sm border-collapse">

          <thead className="sticky top-0 z-40 bg-white shadow-md">

            <tr>
            <th rowSpan={2} className="w-56 p-2 border border-slate-300 bg-sky-100 sticky left-0 z-50 border-r-2 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                Proveedor
              </th>

              <th rowSpan={2} className="w-36 p-2 border border-slate-300 bg-sky-100 sticky left-56 z-50 border-r-4 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                División
              </th>

              {zonasFiltradas.map((zona, idx) => (
                <th
                  key={zona}
                  colSpan={6}
                  className={`p-2 border text-center font-semibold ${getZonaColor(idx)} border-r-4 border-slate-600`}
                >
                  {zona}
                </th>
              ))}
              <th
                colSpan={3}
                className={`p-2 border text-center font-semibold bg-amber-100 border-r-4 border-slate-600${totalFijo ? ' sticky right-0 z-50' : ''}`}
              >
                Total Zona
              </th>
            </tr>

            <tr>
              {zonasFiltradas.map((zona, idx) => (
                <Fragment key={`sub-${zona}`}>
                  <th className={`w-32 p-2 border border-slate-600 ${getZonaColor(idx)}`}>
                    BGT Orig
                  </th>

                  <th className={`w-24 p-2 border border-slate-600 ${getZonaColor(idx)}`}>
                    Crec %
                  </th>

                  <th className={`w-32 p-2 border border-slate-600 ${getZonaColor(idx)}`}>
                    Crec $
                  </th>

                  <th className={`w-32 p-2 border border-slate-600 ${getZonaColor(idx)}`}>
                    BGT Final
                  </th>

                  <th className={`w-32 p-2 border ${getZonaColor(idx)}`}>
                    VS MA
                  </th>

                  <th className={`w-32 p-2 border ${getZonaColor(idx)} border-r-4 border-slate-600`}>
                    VS MPAA
                  </th>

                </Fragment>
              ))}
              <th className={`w-32 p-2 border border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-64 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>BGT Orig</th>
              <th className={`w-32 p-2 border border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-32 z-50' : ''}`}>BGT Final</th>
              <th className={`w-32 p-2 border border-r-4 border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-0 z-50' : ''}`}>Final - Orig</th>
            </tr>

          </thead>

          <tbody>
          {(loading || catalogosLoading) ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 2 + zonasFiltradas.length * 6 + 3 }).map((_, j) => (
                  <td key={j} className="p-2 border">
                    <div className="h-4 bg-slate-200 animate-pulse rounded" />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <>
              {grouped.map((group: any[], gi: number) => {
                const subtotalBgtOrig = zonasFiltradas.reduce((sum, zona) =>
                  sum + group.reduce((s, r) => s + (r.zonas[zona]?.objetivo_base_zona ?? 0), 0), 0);
                const subtotalBgtFinal = zonasFiltradas.reduce((sum, zona) =>
                  sum + group.reduce((s, r) => s + (r.zonas[zona]?.objetivo_zona || 0), 0), 0);

                return (
                  <Fragment key={`group-${gi}`}>
                    {group.length > 1 && (
                      <tr className="bg-sky-50 font-semibold border-t-2 border-slate-300">
                        <td className="w-56 p-2 border bg-sky-100 sticky left-0 z-30 border-r-2 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                          {proveedoresMap[group[0].proveedor_codigo]}
                        </td>
                        <td className="w-36 p-2 border border-slate-300 bg-sky-100 sticky left-56 z-30 border-r-4 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)] text-slate-500 italic">
                          Empresa
                        </td>
                        {zonasFiltradas.map((zona, idx) => {
                          const subOrigZona  = group.reduce((s, r) => s + (r.zonas[zona]?.objetivo_base_zona ?? 0), 0);
                          const subFinalZona = group.reduce((s, r) => s + (r.zonas[zona]?.objetivo_zona || 0), 0);
                          const crecAcum = subOrigZona > 0 ? ((subFinalZona / subOrigZona) - 1) * 100 : null;
                          return (
                            <Fragment key={`subz-${zona}`}>
                              <td className={`p-2 border border-slate-600 text-right font-medium ${getZonaColor(idx)}`}>
                                {money(subOrigZona)}
                              </td>
                              <td className={`p-2 border border-slate-600 text-center font-medium text-slate-700 ${getZonaColor(idx)}`}>
                                {crecAcum !== null ? `${crecAcum.toFixed(2)} %` : "—"}
                              </td>
                              <td className={`p-2 border border-slate-600 text-center text-slate-400 ${getZonaColor(idx)}`}>—</td>
                              <td className={`p-2 border border-slate-600 text-right font-medium ${getZonaColor(idx)}`}>
                                {money(subFinalZona)}
                              </td>
                              <td className={`p-2 border border-slate-600 text-center text-slate-400 ${getZonaColor(idx)}`}>—</td>
                              <td className={`p-2 border border-slate-600 border-r-4 border-slate-500 text-center text-slate-400 ${getZonaColor(idx)}`}>—</td>
                            </Fragment>
                          );
                        })}
                        <td className={`p-2 border border-slate-600 text-right bg-amber-50 font-medium${totalFijo ? ' sticky right-64 z-30 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>
                          {fmt(subtotalBgtOrig)}
                        </td>
                        <td className={`p-2 border border-slate-600 text-right bg-amber-50 font-medium${totalFijo ? ' sticky right-32 z-30' : ''}`}>
                          {fmt(subtotalBgtFinal)}
                        </td>
                        <td className={`p-2 border border-r-4 border-slate-600 text-right bg-amber-50 font-medium ${subtotalBgtFinal - subtotalBgtOrig < 0 ? "text-red-600" : "text-slate-700"}${totalFijo ? ' sticky right-0 z-30' : ''}`}>
                          {fmtDiff(subtotalBgtFinal - subtotalBgtOrig)}
                        </td>
                      </tr>
                    )}
                    {group.map((row: any, i: number) => {
                      const rowBgtOrig = zonasFiltradas.reduce((sum, zona) =>
                        sum + (row.zonas[zona]?.objetivo_base_zona ?? 0), 0);
                      const rowBgtFinal = zonasFiltradas.reduce((sum, zona) =>
                        sum + (row.zonas[zona]?.objetivo_zona || 0), 0);

                      return (
                        <tr key={i} className="hover:bg-slate-100">

                          <td className="w-56 p-2 border bg-sky-50 sticky left-0 z-30 border-r-2 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                            {proveedoresMap[row.proveedor_codigo]}
                          </td>

                          <td className="w-36 p-2 border border-slate-300 bg-sky-50 sticky left-56 z-30 border-r-4 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                            {divisionesMap[row.division_codigo]}
                          </td>

                          {zonasFiltradas.map((zona, idx) => {
                            const z = row.zonas[zona];
                            const bgtOrig = z?.objetivo_base_zona ?? null;

                            return (
                              <Fragment key={`${zona}-${idx}`}>
                                <td className={`p-2 border border-slate-600 text-right ${getZonaColor(idx)}`}>
                                  {bgtOrig !== null ? money(bgtOrig) : "-"}
                                </td>

                                {(() => {
                                  const zonaDirty = pendingChanges.has(`${row.proveedor_codigo}_${row.division_codigo}_${zona}`);
                                  return (
                                  <>
                                <td className={`p-2 border border-slate-600 text-center ${zonaDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : getZonaColor(idx)}`}>
                                  {z ? (
                                    <Input
                                      type="number"
                                      disabled={readonly}
                                      defaultValue={z.def_crec_zona ?? ""}
                                      className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${readonly ? "opacity-50 cursor-not-allowed" : ""}`}
                                      onBlur={(e) => { if (!readonly) saveChange(z, e.target.value); }}
                                    />
                                  ) : "-"}
                                </td>

                                <td className={`p-2 border border-slate-600 text-center ${zonaDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : getZonaColor(idx)}`}>
                                  {z && bgtOrig ? (
                                    <MoneyInput
                                      key={`crec_dolar_${zona}_${row.proveedor_codigo}_${row.division_codigo}_${z.objetivo_zona}`}
                                      value={Math.round(z.objetivo_zona ?? 0)}
                                      disabled={readonly}
                                      onCommit={(v) => saveChange(z, String(((v / bgtOrig) - 1) * 100))}
                                    />
                                  ) : "-"}
                                </td>
                                  </>
                                  );
                                })()}

                                <td className={`p-2 border border-slate-600 text-right ${getZonaColor(idx)}`}>
                                  {z ? money(z.objetivo_zona) : "-"}
                                </td>

                                <td className={`p-2 border border-slate-600 text-right ${pctColor(z?.obj_vs_mes_anterior)}`}>
                                  {z ? pct(z.obj_vs_mes_anterior) : "-"}
                                </td>

                                <td className={`p-2 border border-slate-600 border-r-4 border-slate-500 text-right ${pctColor(z?.obj_vs_mpaa)}`}>
                                  {z ? pct(z.obj_vs_mpaa) : "-"}
                                </td>
                              </Fragment>
                            );
                          })}

                          <td className={`p-2 border border-slate-600 text-right bg-amber-50 font-medium${totalFijo ? ' sticky right-64 z-30 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>
                            {fmt(rowBgtOrig)}
                          </td>
                          <td className={`p-2 border border-slate-600 text-right bg-amber-50 font-medium${totalFijo ? ' sticky right-32 z-30' : ''}`}>
                            {fmt(rowBgtFinal)}
                          </td>
                          <td className={`p-2 border border-r-4 border-slate-600 text-right bg-amber-50 font-medium ${rowBgtFinal - rowBgtOrig < 0 ? "text-red-600" : "text-slate-700"}${totalFijo ? ' sticky right-0 z-30' : ''}`}>
                            {fmtDiff(rowBgtFinal - rowBgtOrig)}
                          </td>

                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}

            </>
          )}
          </tbody>

          <tfoot className="sticky bottom-0 z-40">
            <tr className="bg-slate-800 text-white font-bold text-sm">
              <td className="w-56 p-2 border border-slate-600 bg-slate-800 sticky left-0 z-50 uppercase tracking-wide border-r-2 border-slate-600 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                TOTAL
              </td>
              <td className="w-36 p-2 border border-slate-600 bg-slate-800 sticky left-56 z-50 border-r-4 border-slate-600 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]" />

              {zonasFiltradas.map((zona) => {
                const zo = totals?.[zona];
                const crecPct = zo && zo.bgtOrig > 0 ? ((zo.bgtFinal / zo.bgtOrig) - 1) * 100 : null;
                const maPct = zo && zo.baseMA > 0 ? ((zo.objMA / zo.baseMA) - 1) * 100 : null;
                const mpaaPct = zo && zo.baseMPAA > 0 ? ((zo.objMPAA / zo.baseMPAA) - 1) * 100 : null;
                return (
                  <Fragment key={`total-${zona}`}>
                    <td className="w-32 p-2 border border-slate-600 bg-slate-700 text-right">
                      {zo ? money(zo.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="w-24 p-2 border border-slate-600 bg-slate-700 text-center">
                      {zo ? (crecPct !== null ? `${crecPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="w-32 p-2 border border-slate-600 bg-slate-700 text-right">
                      {zo ? fmtDiff(zo.bgtFinal - zo.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="w-32 p-2 border border-slate-600 bg-slate-700 text-right">
                      {zo ? money(zo.bgtFinal) : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="w-32 p-2 border border-slate-600 bg-slate-700 text-center">
                      {zo ? (maPct !== null ? `${maPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="w-32 p-2 border border-slate-600 bg-slate-700 border-r-4 text-center">
                      {zo ? (mpaaPct !== null ? `${mpaaPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                  </Fragment>
                );
              })}
              <td className={`w-32 p-2 border border-slate-600 bg-slate-700 text-right${totalFijo ? ' sticky right-64 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>
                {totals ? money(grandTotalAll.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
              </td>
              <td className={`w-32 p-2 border border-slate-600 bg-slate-700 text-right${totalFijo ? ' sticky right-32 z-50' : ''}`}>
                {totals ? money(grandTotalAll.bgtFinal) : <span className="text-slate-400 text-xs">…</span>}
              </td>
              <td className={`w-32 p-2 border border-r-4 border-slate-600 bg-slate-700 text-right ${grandTotalAll.bgtFinal - grandTotalAll.bgtOrig < 0 ? "text-red-300" : "text-white"}${totalFijo ? ' sticky right-0 z-50' : ''}`}>
                {totals ? fmtDiff(grandTotalAll.bgtFinal - grandTotalAll.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
              </td>
            </tr>
          </tfoot>

        </table>
      </div>
            {/* PAGINACIÓN */}
            <div className="flex justify-center items-center gap-4 text-sm font-medium mt-4">

                    <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1 rounded-md border hover:bg-slate-100 disabled:opacity-40 transition"
                    >
                    ◀
                    </button>

                    <span className="text-slate-600">
                    Página {page} de {totalPages}
                    </span>

                    <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="px-3 py-1 rounded-md border hover:bg-slate-100 disabled:opacity-40 transition"
                    >
                    ▶
                    </button>

            </div>  

    </div>
  );
}
