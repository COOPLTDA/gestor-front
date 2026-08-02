import { useEffect, useState, useMemo, useCallback, Fragment, useRef } from "react";
import { Search } from "lucide-react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { usePresupuesto } from "@/contexts/PresupuestoEnroContext";
import { useCatalogos, useCatalogosState } from "@/contexts/CatalogosContext";
import { API } from "@/constants/api";
import { Input } from "@/components/ui/input";
// exceljs se importa dinámicamente en handleExport

function MoneyInput({ value, onCommit, disabled }: { value: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(String(Math.round(value)));
  return (
    <Input
      type="text"
      disabled={disabled}
      value={focused ? raw : `$ ${(Math.round(Number(raw) || 0)).toLocaleString("es-AR")}`}
      onFocus={() => { if (!disabled) setFocused(true); }}
      onChange={e => { if (!disabled) setRaw(e.target.value.replace(/[^0-9-]/g, "")); }}
      onBlur={() => { setFocused(false); if (!disabled) onCommit(Number(raw)); }}
      className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    />
  );
}

type RowEmpresa = {
  proveedor_codigo: number;
  division_codigo: number;
  ventas_mes: number;
  ventas_ma: number;
  ventas_mpaa: number;
  prom_ult_4: number;
  crec_n1_mpaa: number;
  pct_crec_vs_ma: number | null;
  pct_crec_vs_prom4: number | null;
  pct_crec_ger_vs_ma: number | null;
  def_crec_dir: number | null;
  def_crec_ger: number | null;
  objetivo_empresa: number;
  origen: string | null;
};

export default function EmpresaTab({ readonly = false }: { readonly?: boolean }) {
  const { state, dispatch } = usePresupuesto();
  const modoGuardado = state.modoGuardado;
  const pageSize = state.pageSize;
  const fullscreen = state.fullscreen;
  const catalogos = useCatalogos();
  const { loading: catalogosLoading } = useCatalogosState();

  const [rows, setRows] = useState<RowEmpresa[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");

  const [showDireccion, setShowDireccion] = useState(true);
  const [showGerencia, setShowGerencia] = useState(true);

  type PendingEmpresa = { row: RowEmpresa; field: "def_crec_dir" | "def_crec_ger"; numeric: number | null };
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingEmpresa>>(new Map());

  type Totals = {
    crec_n1_mpaa: number;
    ventas_mes: number;
    ventas_mpaa: number;
    prom_ult_4: number;
    objetivo_empresa: number;
  };
  const [totals, setTotals] = useState<Totals | null>(null);

  const money = useCallback((v: number | null | undefined) =>
    v !== null && v !== undefined
      ? `$ ${Math.round(v).toLocaleString("es-AR")}`
      : "-",
    []
  );

  const pct = (v: number | null) => v !== null ? `${v.toFixed(1)} %` : "—";

  const direccionVisible =
    showDireccion || (!showDireccion && !showGerencia);
  const gerenciaVisible =
    showGerencia || (!showDireccion && !showGerencia);

  // =====================================================
  // MAPS DESDE CONTEXTO
  // =====================================================

  const proveedoresMap = useMemo(() => {
    return Object.fromEntries(
      catalogos.proveedores.map((p) => [
        p.codigo,
        `${p.codigo} - ${p.nombre}`
      ])
    );
  }, [catalogos.proveedores]);

  const divisionesMap = useMemo(() => {
    return Object.fromEntries(
      catalogos.divisiones.map((d) => [
        d.codigo,
        `${d.codigo} - ${d.nombre}`
      ])
    );
  }, [catalogos.divisiones]);

  // =====================================================
  // DATA
  // =====================================================

  const reload = useCallback(async () => {
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
      API.PRESUPUESTO_ENRO.EMPRESA.QUERY,
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
  }, [state.mesObjetivo, page, pageSize, busquedaDebounced, catalogos.proveedores]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 700);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    setPage(1);
  }, [busquedaDebounced]);

  const reloadTotals = useCallback(async () => {
    if (!state.mesObjetivo) return;

    const res = await fetchWithAuth(
      API.PRESUPUESTO_ENRO.EMPRESA.QUERY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes: state.mesObjetivo,
          pagination: { page: 1, pageSize: 999999 }
        })
      }
    );

    if (!res.success) return;

    const data = await res.json();
    const allRows: RowEmpresa[] = data.data.rows;

    setTotals({
      crec_n1_mpaa:    allRows.reduce((s, r) => s + (r.crec_n1_mpaa    ?? 0), 0),
      ventas_mes:      allRows.reduce((s, r) => s + (r.ventas_mes       ?? 0), 0),
      ventas_mpaa:     allRows.reduce((s, r) => s + (r.ventas_mpaa      ?? 0), 0),
      prom_ult_4:      allRows.reduce((s, r) => s + (r.prom_ult_4       ?? 0), 0),
      objetivo_empresa:allRows.reduce((s, r) => s + (r.objetivo_empresa ?? 0), 0),
    });
  }, [state.mesObjetivo]);

  useEffect(() => {
    reloadTotals();
  }, [state.mesObjetivo, reloadTotals]);

  // =====================================================
  // SAVE
  // =====================================================

  const saveChange = useCallback(async (
    row: RowEmpresa,
    field: "def_crec_dir" | "def_crec_ger",
    value: string
  ) => {
    if (!state.mesObjetivo) return;
    const numeric = value === "" || value === null ? null : Number(value);

    if (modoGuardado === "manual") {
      const changeKey = `${row.proveedor_codigo}_${row.division_codigo}_${field}`;
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(changeKey, { row, field, numeric });
        return next;
      });
      return;
    }

    try {
      const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.EMPRESA.BASE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes: state.mesObjetivo,
          changes: [{ keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo }, [field]: numeric }]
        })
      });
      if (!res.success) return;
      await reload();
      reloadTotals();
    } catch (err) {
      console.error("Error PATCH empresa:", err);
    }
  }, [state.mesObjetivo, modoGuardado, reload, reloadTotals]);

  const aplicarCambiosEmpresa = useCallback(async () => {
    if (!state.mesObjetivo || pendingChanges.size === 0) return;
    const changes = Array.from(pendingChanges.values()).map(({ row, field, numeric }) => ({
      keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo },
      [field]: numeric
    }));
    try {
      await fetchWithAuth(API.PRESUPUESTO_ENRO.EMPRESA.BASE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: state.mesObjetivo, changes })
      });
      setPendingChanges(new Map());
      await reload();
      reloadTotals();
    } catch (err) {
      console.error("Error aplicando cambios empresa:", err);
    }
  }, [state.mesObjetivo, pendingChanges, reload, reloadTotals]);

  // Guarda un valor manual de ventas_mpaa en HistMensual (siempre auto-save)
  const saveHistMpaa = useCallback(async (row: RowEmpresa, valor: number) => {
    if (!state.mesObjetivo || valor <= 0) return;
    try {
      const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.EMPRESA.HIST_MPAA, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes: state.mesObjetivo,
          proveedor_codigo: row.proveedor_codigo,
          division_codigo: row.division_codigo,
          ventas_mpaa: valor,
        }),
      });
      if (res.success) {
        await reload();
        reloadTotals();
      } else {
        console.error("Error saveHistMpaa:", res.message);
      }
    } catch (err) {
      console.error("Error saveHistMpaa:", err);
    }
  }, [state.mesObjetivo, reload, reloadTotals]);


  // =====================================================
// EXPORTAR EXCEL
// =====================================================

useEffect(() => {
    const handleExport = async (event: any) => {
      if (event.detail?.nivel !== "empresa") return;
      if (!state.mesObjetivo) return;

      const res = await fetchWithAuth(
        API.PRESUPUESTO_ENRO.EMPRESA.QUERY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mes: state.mesObjetivo,
            pagination: { page: 1, pageSize: 999999 }
          })
        }
      );

      if (!res.success) return;

      const data = await res.json();
      const exportRows: RowEmpresa[] = data.data.rows;

      // ── Colores que replican la UI ──────────────────────────
      const SKY_HEADER    = "FFBAE6FD"; // bg-sky-100
      const SKY_CELL      = "FFE0F2FE"; // bg-sky-50
      const YELLOW_HEADER = "FFFEF9C3"; // bg-yellow-100
      const YELLOW_CELL   = "FFFEFCE8"; // bg-yellow-50
      const ORANGE_HEADER = "FFFFEDD5"; // bg-orange-100
      const ORANGE_CELL   = "FFFFF7ED"; // bg-orange-50

      const MONEY_FMT   = '"$ "#,##0;[Red]"$ "(-#,##0);"-"';
      const PCT_FMT     = '0.0"%"';
      const HEADER_FONT = { name: "Arial", bold: true, size: 10 };
      const CELL_FONT   = { name: "Arial", size: 10 };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ExcelJS = await import("exceljs");
      const fill = (argb: string) =>
        ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

      const wb = new ExcelJS.default.Workbook();
      const ws = wb.addWorksheet("Empresa");

      // ── Definición de columnas ──────────────────────────────
      type ColDef = {
        header: string;
        key: string;
        width: number;
        numFmt?: string;
        headerColor: string;
        cellColor: string;
        align: "left" | "center" | "right";
        bold?: boolean;
      };

      const cols: ColDef[] = [
        { header: "Proveedor",             key: "proveedor",    width: 30, headerColor: SKY_HEADER,    cellColor: SKY_CELL,    align: "left"  },
        { header: "División",              key: "division",     width: 22, headerColor: SKY_HEADER,    cellColor: SKY_CELL,    align: "left"  },
        { header: "Dir %",                 key: "dir_pct",      width: 10, headerColor: YELLOW_HEADER, cellColor: YELLOW_CELL, align: "center", numFmt: PCT_FMT },
        { header: "Dir $",                 key: "dir_dolar",    width: 20, headerColor: YELLOW_HEADER, cellColor: YELLOW_CELL, align: "right",  numFmt: MONEY_FMT },
        { header: "Objetivo Dirección",    key: "obj_dir",      width: 20, headerColor: YELLOW_HEADER, cellColor: YELLOW_CELL, align: "right",  numFmt: MONEY_FMT },
        { header: "Ventas MA",             key: "ventas_ma",    width: 18, headerColor: YELLOW_HEADER, cellColor: YELLOW_CELL, align: "right",  numFmt: MONEY_FMT },
        { header: "CREC % vs MA",          key: "crec_ma",      width: 16, headerColor: YELLOW_HEADER, cellColor: YELLOW_CELL, align: "right",  numFmt: PCT_FMT },
        { header: "Ventas MPAA",           key: "ventas_mpaa",  width: 18, headerColor: YELLOW_HEADER, cellColor: YELLOW_CELL, align: "right",  numFmt: MONEY_FMT },
        { header: "CREC % vs Ult 4 Meses", key: "crec_4",      width: 20, headerColor: YELLOW_HEADER, cellColor: YELLOW_CELL, align: "right",  numFmt: PCT_FMT },
        { header: "Ger %",                 key: "ger_pct",         width: 10, headerColor: ORANGE_HEADER, cellColor: ORANGE_CELL, align: "center", numFmt: PCT_FMT },
        { header: "Ger $",                 key: "ger_dolar",       width: 18, headerColor: ORANGE_HEADER, cellColor: ORANGE_CELL, align: "right",  numFmt: MONEY_FMT, bold: true },
        { header: "Objetivo Final",        key: "obj_ger",         width: 18, headerColor: ORANGE_HEADER, cellColor: ORANGE_CELL, align: "right",  numFmt: MONEY_FMT, bold: true },
        { header: "Ventas MA",             key: "ger_ventas_ma",   width: 18, headerColor: ORANGE_HEADER, cellColor: ORANGE_CELL, align: "right",  numFmt: MONEY_FMT },
        { header: "CREC % vs MA",          key: "ger_crec_ma",     width: 16, headerColor: ORANGE_HEADER, cellColor: ORANGE_CELL, align: "right",  numFmt: PCT_FMT },
        { header: "Ventas MPAA",           key: "ger_ventas_mpaa", width: 18, headerColor: ORANGE_HEADER, cellColor: ORANGE_CELL, align: "right",  numFmt: MONEY_FMT },
        { header: "% Crec vs MPAA",        key: "ger_crec_mpaa",   width: 16, headerColor: ORANGE_HEADER, cellColor: ORANGE_CELL, align: "right",  numFmt: PCT_FMT },
        { header: "$ OBJ DIR vs OBJ GER",  key: "dif_obj",         width: 22, headerColor: ORANGE_HEADER, cellColor: ORANGE_CELL, align: "right",  numFmt: MONEY_FMT, bold: true },
      ];

      ws.columns = cols.map(c => ({ key: c.key, width: c.width }));

      // ── Header row ──────────────────────────────────────────
      const headerRow = ws.addRow(cols.map(c => c.header));
      headerRow.height = 22;
      headerRow.eachCell((cell: any, colIdx: number) => {
        const def = cols[colIdx - 1];
        cell.font = { ...HEADER_FONT, color: { argb: "FF1E3A5F" } };
        cell.fill = fill(def.headerColor);
        cell.alignment = { horizontal: def.align, vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFB0B0B0" } },
          bottom: { style: "medium", color: { argb: "FF6B7280" } },
          left: { style: "thin", color: { argb: "FFB0B0B0" } },
          right: { style: "thin", color: { argb: "FFB0B0B0" } },
        };
      });

      // ── Data rows ───────────────────────────────────────────
      exportRows.forEach((row, rowIdx) => {
        const isEven = rowIdx % 2 === 0;

        const values = {
          proveedor:   proveedoresMap[row.proveedor_codigo] ?? String(row.proveedor_codigo),
          division:    divisionesMap[row.division_codigo] ?? `${row.division_codigo} - Gral`,
          dir_pct:     row.def_crec_dir ?? null,
          dir_dolar:   row.crec_n1_mpaa ?? null,
          obj_dir:     row.crec_n1_mpaa ?? null,
          ventas_ma:   row.ventas_mes ?? null,
          crec_ma:     row.pct_crec_vs_ma !== null ? (row.pct_crec_vs_ma ?? 0) * 100 : null,
          ventas_mpaa: row.ventas_mpaa ?? null,
          crec_4:      row.pct_crec_vs_prom4 !== null ? (row.pct_crec_vs_prom4 ?? 0) * 100 : null,
          ger_pct:          row.def_crec_ger ?? null,
          ger_dolar:        row.objetivo_empresa ?? null,
          obj_ger:          row.objetivo_empresa ?? null,
          ger_ventas_ma:    row.ventas_mes ?? null,
          ger_crec_ma:      row.pct_crec_ger_vs_ma !== null ? (row.pct_crec_ger_vs_ma ?? 0) * 100 : null,
          ger_ventas_mpaa:  row.ventas_mpaa ?? null,
          ger_crec_mpaa:    row.ventas_mpaa ? ((row.objetivo_empresa ?? 0) / row.ventas_mpaa - 1) * 100 : null,
          dif_obj:          (row.objetivo_empresa ?? 0) - (row.crec_n1_mpaa ?? 0),
        };

        const dataRow = ws.addRow(Object.values(values));
        dataRow.height = 18;

        dataRow.eachCell({ includeEmpty: true }, (cell: any, colIdx: number) => {
          const def = cols[colIdx - 1];
          const baseColor = def.cellColor;
          cell.fill = fill(baseColor);
          cell.font = { ...CELL_FONT, bold: def.bold ?? false };
          cell.alignment = { horizontal: def.align, vertical: "middle" };
          if (def.numFmt) cell.numFmt = def.numFmt;
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      });

      // ── Total row ───────────────────────────────────────────
      const totObjDir     = exportRows.reduce((s, r) => s + (r.crec_n1_mpaa ?? 0), 0);
      const totVentasMa   = exportRows.reduce((s, r) => s + (r.ventas_mes ?? 0), 0);
      const totVentasMpaa = exportRows.reduce((s, r) => s + (r.ventas_mpaa ?? 0), 0);
      const totObjGer     = exportRows.reduce((s, r) => s + (r.objetivo_empresa ?? 0), 0);
      const tVals = {
        proveedor: "TOTAL", division: "", dir_pct: null,
        dir_dolar: totObjDir, obj_dir: totObjDir, ventas_ma: totVentasMa, crec_ma: null,
        ventas_mpaa: totVentasMpaa, crec_4: null, ger_pct: null,
        ger_dolar: totObjGer, obj_ger: totObjGer,
        ger_ventas_ma: totVentasMa, ger_crec_ma: null,
        ger_ventas_mpaa: totVentasMpaa,
        ger_crec_mpaa: totVentasMpaa > 0 ? ((totObjGer / totVentasMpaa) - 1) * 100 : null,
        dif_obj: totObjGer - totObjDir,
      };
      const tRow = ws.addRow(Object.values(tVals));
      tRow.height = 20;
      tRow.eachCell({ includeEmpty: true }, (cell: any, colIdx: number) => {
        const def = cols[colIdx - 1];
        cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = fill("FF1E293B");
        cell.alignment = { horizontal: def.align, vertical: "middle" };
        if (def.numFmt && cell.value !== null) cell.numFmt = def.numFmt;
        cell.border = {
          top: { style: "medium" as const, color: { argb: "FF475569" } },
          bottom: { style: "thin" as const, color: { argb: "FFD1D5DB" } },
          left: { style: "thin" as const, color: { argb: "FFD1D5DB" } },
          right: { style: "thin" as const, color: { argb: "FFD1D5DB" } },
        };
      });

      // ── Freeze header + primera columna ────────────────────
      ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

      // ── Descargar ───────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Presupuesto_empresa_${state.mesObjetivo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    };
  
    window.addEventListener("export-presupuesto", handleExport);
  
    return () =>
      window.removeEventListener("export-presupuesto", handleExport);
  }, [state.mesObjetivo, proveedoresMap, divisionesMap]);
  

  const grouped = useMemo(() => {
    const map: Record<number, RowEmpresa[]> = {};
    rows.forEach(row => {
      if (!map[row.proveedor_codigo]) map[row.proveedor_codigo] = [];
      map[row.proveedor_codigo].push(row);
    });
    return Object.values(map);
  }, [rows]);

  // Retorna el valor base antes de aplicar def_crec_dir para llegar a crec_n1_mpaa
  const computeBaseDir = (crec_n1_mpaa: number, def_crec_dir: number | null): number => {
    if (def_crec_dir === null) return crec_n1_mpaa;
    const factor = 1 + def_crec_dir / 100;
    if (Math.abs(factor) < 0.000001) return crec_n1_mpaa;
    return crec_n1_mpaa / factor;
  };

  const colCount = 2
    + (direccionVisible ? 8 : 0)
    + (gerenciaVisible ? 8 : 0);

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
      <div className="flex justify-between items-center flex-wrap gap-2">

        <div className="flex items-center gap-4">

          <select
            className="border rounded-md px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              dispatch({ type: "SET_PAGE_SIZE", payload: Number(e.target.value) });
            }}
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
        </div>

        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDireccion}
              onChange={() => setShowDireccion(!showDireccion)}
            />
            Dirección
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showGerencia}
              onChange={() => setShowGerencia(!showGerencia)}
            />
            Gerencia
          </label>
        </div>

        {!readonly && (
          <div className="flex items-center gap-2">
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
                <button onClick={aplicarCambiosEmpresa} className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700">
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
          <thead className="sticky top-0 z-40 shadow-md bg-white">
            <tr>
              <th className="w-56 p-2 border bg-sky-100 sticky left-0 z-50">
                Proveedor
              </th>

              <th className="w-36 p-2 border bg-sky-100 sticky left-56 z-50">
                División
              </th>

              {direccionVisible && (
                <>
                  <th className="w-24 p-2 border bg-yellow-100">Dir %</th>
                  <th className="w-40 p-2 border bg-yellow-100">Dir $</th>
                  <th className="w-40 p-2 border bg-yellow-100">
                    Objetivo Dirección
                  </th>
                  <th className="w-40 p-2 border bg-yellow-100">
                    Ventas MA
                  </th>
                  <th className="w-32 p-2 border bg-yellow-100">
                    CREC % vs MA
                  </th>
                  <th className="w-40 p-2 border bg-yellow-100">
                    Ventas MPAA
                  </th>
                  <th className="w-40 p-2 border bg-yellow-100">
                    CREC % vs Ult 4 Meses
                  </th>
                </>
              )}

              {gerenciaVisible && (
                <>
                  <th className="w-24 p-2 border bg-orange-100">Ger %</th>
                  <th className="w-40 p-2 border bg-orange-100">Ger $</th>
                  <th className="w-40 p-2 border bg-orange-100">Objetivo Final</th>
                  <th className="w-40 p-2 border bg-orange-100">Ventas MA</th>
                  <th className="w-32 p-2 border bg-orange-100">CREC % vs MA</th>
                  <th className="w-40 p-2 border bg-orange-100">Ventas MPAA</th>
                  <th className="w-32 p-2 border bg-orange-100">% Crec vs MPAA</th>
                  <th className="w-44 p-2 border bg-orange-100">$ OBJ DIR vs OBJ GER</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
          {(loading || catalogosLoading) ? (
            Array.from({ length: pageSize }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: colCount }).map((_, j) => (
                  <td key={j} className="p-2 border">
                    <div className="h-4 bg-slate-200 animate-pulse rounded" />
                  </td>
                ))}
              </tr>
            ))
          ) : grouped.map((group, gi) => {
            const subCrecN1 = group.reduce((s, r) => s + (r.crec_n1_mpaa ?? 0), 0);
            const subVentasMes = group.reduce((s, r) => s + (r.ventas_mes ?? 0), 0);
            const subVentasMpaa = group.reduce((s, r) => s + (r.ventas_mpaa ?? 0), 0);
            const subObjetivo = group.reduce((s, r) => s + (r.objetivo_empresa ?? 0), 0);
            const subDirPct = subVentasMpaa > 0 ? ((subCrecN1 / subVentasMpaa) - 1) * 100 : null;
            const subDirCrecVsMa = subVentasMes > 0 ? ((subCrecN1 / subVentasMes) - 1) * 100 : null;
            const subGerPct = subVentasMpaa > 0 ? ((subObjetivo / subVentasMpaa) - 1) * 100 : null;
            const subGerCrecVsMa = subVentasMes > 0 ? ((subObjetivo / subVentasMes) - 1) * 100 : null;
            const subGerCrecMpaa = subVentasMpaa > 0 ? ((subObjetivo / subVentasMpaa) - 1) * 100 : null;

            return (
              <Fragment key={`group-${gi}`}>
                {group.length > 1 && (
                  <tr className="bg-sky-50 font-semibold border-t-2 border-slate-300">
                    <td className="w-56 p-2 border bg-sky-100 sticky left-0 z-20">
                      {proveedoresMap[group[0].proveedor_codigo]}
                    </td>
                    <td className="w-36 p-2 border bg-sky-100 sticky left-56 z-20 text-slate-500 italic">
                      Empresa
                    </td>
                    {direccionVisible && (
                      <>
                        <td className="w-24 p-2 border bg-yellow-50 text-center text-slate-600 font-medium">{pct(subDirPct)}</td>
                        <td className="w-40 p-2 border bg-yellow-50 text-right">{money(subCrecN1)}</td>
                        <td className="w-40 p-2 border bg-yellow-50 text-right">{money(subCrecN1)}</td>
                        <td className="w-40 p-2 border bg-yellow-50 text-right">{money(subVentasMes)}</td>
                        <td className="w-32 p-2 border bg-yellow-50 text-center text-slate-600 font-medium">{pct(subDirCrecVsMa)}</td>
                        <td className="w-40 p-2 border bg-yellow-50 text-right">
                          <span className="flex items-center justify-end gap-1">
                            {money(subVentasMpaa)}
                            {group.some(r => r.origen === "Manual") && (
                              <span className="text-amber-600 font-bold text-xs leading-none" title="Al menos un valor manual">*</span>
                            )}
                          </span>
                        </td>
                        <td className="w-40 p-2 border bg-yellow-50 text-center text-slate-400">—</td>
                      </>
                    )}
                    {gerenciaVisible && (
                      <>
                        <td className="w-24 p-2 border bg-orange-50 text-center text-slate-600 font-medium">{pct(subGerPct)}</td>
                        <td className="w-40 p-2 border bg-orange-50 text-right font-semibold">{money(subObjetivo)}</td>
                        <td className="w-40 p-2 border bg-orange-50 text-right font-semibold">{money(subObjetivo)}</td>
                        <td className="w-40 p-2 border bg-orange-50 text-right">{money(subVentasMes)}</td>
                        <td className="w-32 p-2 border bg-orange-50 text-center text-slate-600 font-medium">{pct(subGerCrecVsMa)}</td>
                        <td className="w-40 p-2 border bg-orange-50 text-right">{money(subVentasMpaa)}</td>
                        <td className="w-32 p-2 border bg-orange-50 text-center text-slate-600 font-medium">{pct(subGerCrecMpaa)}</td>
                        <td className="w-44 p-2 border bg-orange-50 text-right font-semibold">{money(subObjetivo - subCrecN1)}</td>
                      </>
                    )}
                  </tr>
                )}
                {group.map((row) => (
                  <tr key={`${row.proveedor_codigo}_${row.division_codigo}`} className="hover:bg-slate-100 transition-colors">

                    <td className="w-56 p-2 border bg-sky-50 sticky left-0 z-20">
                      {proveedoresMap[row.proveedor_codigo]}
                    </td>

                    <td className="w-36 p-2 border bg-sky-50 sticky left-56 z-20">
                      {divisionesMap[row.division_codigo] ??
                        `${row.division_codigo} - Gral`}
                    </td>

                    {direccionVisible && (() => {
                      const dirDirty = pendingChanges.has(`${row.proveedor_codigo}_${row.division_codigo}_def_crec_dir`);
                      // Modo manual: ventas_mpaa sin dato ETL o ya cargado manualmente.
                      // En ambos casos Dir % no debe tener efecto; Dir $ actualiza HistMensual.
                      const isManual = !Number(row.ventas_mpaa) || row.origen === "Manual";
                      return (
                      <>
                        <td className={`w-24 p-2 border text-center ${dirDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : "bg-yellow-50"}`}>
                          <Input
                            type="number"
                            disabled={isManual || readonly}
                            className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${isManual || readonly ? "opacity-40 cursor-not-allowed" : ""}`}
                            key={`dir_${row.proveedor_codigo}_${row.division_codigo}_${row.def_crec_dir}`}
                            defaultValue={row.def_crec_dir ?? ""}
                            onBlur={(e) => {
                              if (isManual || readonly) return;
                              saveChange(row, "def_crec_dir", e.target.value);
                            }}
                          />
                        </td>

                        <td className={`w-40 p-2 border text-center ${dirDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : "bg-yellow-50"}`}>
                          <MoneyInput
                            key={`dir_dolar_${row.proveedor_codigo}_${row.division_codigo}_${row.crec_n1_mpaa}_${row.origen}`}
                            value={Math.round(row.crec_n1_mpaa ?? 0)}
                            disabled={readonly}
                            onCommit={(dirDolar) => {
                              if (isManual) {
                                if (dirDolar > 0) {
                                  saveHistMpaa(row, dirDolar);
                                  saveChange(row, "def_crec_dir", "");
                                }
                                return;
                              }
                              const baseDir = computeBaseDir(row.crec_n1_mpaa, row.def_crec_dir);
                              if (!baseDir) return;
                              const pct = ((dirDolar / baseDir) - 1) * 100;
                              saveChange(row, "def_crec_dir", String(Math.max(-9999.99, Math.min(9999.99, pct))));
                            }}
                          />
                        </td>

                        <td className="w-40 p-2 border bg-yellow-50 text-right">
                          {money(row.crec_n1_mpaa)}
                        </td>

                        <td className="w-40 p-2 border bg-yellow-50 text-right">
                          {money(row.ventas_mes)}
                        </td>

                        <td className="w-32 p-2 border bg-yellow-50 text-right">
                          {row.pct_crec_vs_ma !== null
                            ? `${(row.pct_crec_vs_ma * 100).toFixed(1)} %`
                            : "-"}
                        </td>

                        <td className="w-40 p-2 border bg-yellow-50 text-right">
                          <span className="flex items-center justify-end gap-1">
                            {money(row.ventas_mpaa)}
                            {row.origen === "Manual" && (
                              <span
                                className="text-amber-600 font-bold text-xs leading-none"
                                title="Valor ingresado manualmente"
                              >
                                *
                              </span>
                            )}
                          </span>
                        </td>

                        <td className="w-40 p-2 border bg-yellow-50 text-right">
                          {row.pct_crec_vs_prom4 !== null
                            ? `${(row.pct_crec_vs_prom4 * 100).toFixed(1)} %`
                            : "-"}
                        </td>
                      </>
                    );
                    })()}

                    {gerenciaVisible && (() => {
                      const gerDirty = pendingChanges.has(`${row.proveedor_codigo}_${row.division_codigo}_def_crec_ger`);
                      return (
                      <>
                        <td className={`w-24 p-2 border text-center ${gerDirty ? "bg-orange-200 ring-2 ring-inset ring-orange-400" : "bg-orange-50"}`}>
                          <Input
                            type="number"
                            disabled={readonly}
                            className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${readonly ? "opacity-50 cursor-not-allowed" : ""}`}
                            key={`ger_${row.proveedor_codigo}_${row.division_codigo}_${row.def_crec_ger}`}
                            defaultValue={row.def_crec_ger ?? ""}
                            onBlur={(e) => {
                              if (readonly) return;
                              saveChange(row, "def_crec_ger", e.target.value);
                            }}
                          />
                        </td>

                        <td className={`w-40 p-2 border text-center ${gerDirty ? "bg-orange-200 ring-2 ring-inset ring-orange-400" : "bg-orange-50"}`}>
                          <MoneyInput
                            key={`ger_dolar_${row.proveedor_codigo}_${row.division_codigo}_${row.objetivo_empresa}`}
                            value={Math.round(row.objetivo_empresa ?? 0)}
                            disabled={readonly}
                            onCommit={(gerDolar) => {
                              const baseGer = row.crec_n1_mpaa ?? 0;
                              if (!baseGer) return;
                              const pct = ((gerDolar / baseGer) - 1) * 100;
                              saveChange(row, "def_crec_ger", String(Math.max(-9999.99, Math.min(9999.99, pct))));
                            }}
                          />
                        </td>

                        <td className="w-40 p-2 border bg-orange-50 text-right font-semibold">
                          {money(row.objetivo_empresa)}
                        </td>

                        <td className="w-40 p-2 border bg-orange-50 text-right">
                          {money(row.ventas_mes)}
                        </td>

                        <td className="w-32 p-2 border bg-orange-50 text-right">
                          {row.pct_crec_ger_vs_ma !== null && row.pct_crec_ger_vs_ma !== undefined
                            ? `${(row.pct_crec_ger_vs_ma * 100).toFixed(1)} %`
                            : "-"}
                        </td>

                        <td className="w-40 p-2 border bg-orange-50 text-right">
                          <span className="flex items-center justify-end gap-1">
                            {money(row.ventas_mpaa)}
                            {row.origen === "Manual" && (
                              <span className="text-amber-600 font-bold text-xs leading-none" title="Valor ingresado manualmente">*</span>
                            )}
                          </span>
                        </td>

                        <td className="w-32 p-2 border bg-orange-50 text-center text-slate-600 font-medium">
                          {pct(row.ventas_mpaa ? ((row.objetivo_empresa ?? 0) / row.ventas_mpaa - 1) * 100 : null)}
                        </td>

                        <td className="w-44 p-2 border bg-orange-50 text-right font-semibold">
                          {money((row.objetivo_empresa ?? 0) - (row.crec_n1_mpaa ?? 0))}
                        </td>
                      </>
                    );
                    })()}
                  </tr>
                ))}
              </Fragment>
            );
          })}
          </tbody>

          <tfoot className="sticky bottom-0 z-40">
            <tr className="bg-slate-800 text-white font-bold text-sm">
              <td className="w-56 p-2 border border-slate-600 bg-slate-800 sticky left-0 z-50 uppercase tracking-wide">
                TOTAL
              </td>
              <td className="w-36 p-2 border border-slate-600 bg-slate-800 sticky left-56 z-50" />

              {direccionVisible && (
                <>
                  <td className="w-24 p-2 border border-slate-600 bg-yellow-900/40 text-center text-slate-300">—</td>
                  <td className="w-40 p-2 border border-slate-600 bg-yellow-900/40 text-right">
                    {totals ? money(totals.crec_n1_mpaa) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-40 p-2 border border-slate-600 bg-yellow-900/40 text-right">
                    {totals ? money(totals.crec_n1_mpaa) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-40 p-2 border border-slate-600 bg-yellow-900/40 text-right">
                    {totals ? money(totals.ventas_mes) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-32 p-2 border border-slate-600 bg-yellow-900/40 text-center">
                    {totals ? pct(totals.ventas_mes > 0 ? ((totals.crec_n1_mpaa / totals.ventas_mes) - 1) * 100 : null) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-40 p-2 border border-slate-600 bg-yellow-900/40 text-right">
                    {totals ? money(totals.ventas_mpaa) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-40 p-2 border border-slate-600 bg-yellow-900/40 text-center text-slate-300">—</td>
                </>
              )}

              {gerenciaVisible && (
                <>
                  <td className="w-24 p-2 border border-slate-600 bg-orange-900/40 text-center text-slate-300">—</td>
                  <td className="w-40 p-2 border border-slate-600 bg-orange-900/40 text-right">
                    {totals ? money(totals.objetivo_empresa) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-40 p-2 border border-slate-600 bg-orange-900/40 text-right">
                    {totals ? money(totals.objetivo_empresa) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-40 p-2 border border-slate-600 bg-orange-900/40 text-right">
                    {totals ? money(totals.ventas_mes) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-32 p-2 border border-slate-600 bg-orange-900/40 text-center">
                    {totals ? pct(totals.ventas_mes > 0 ? ((totals.objetivo_empresa / totals.ventas_mes) - 1) * 100 : null) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-40 p-2 border border-slate-600 bg-orange-900/40 text-right">
                    {totals ? money(totals.ventas_mpaa) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-32 p-2 border border-slate-600 bg-orange-900/40 text-center">
                    {totals ? pct(totals.ventas_mpaa > 0 ? ((totals.objetivo_empresa / totals.ventas_mpaa) - 1) * 100 : null) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                  <td className="w-44 p-2 border border-slate-600 bg-orange-900/40 text-right">
                    {totals ? money(totals.objetivo_empresa - totals.crec_n1_mpaa) : <span className="text-slate-400 text-xs">…</span>}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

              {/* PAGINACIÓN */}
              <div className="flex justify-center items-center gap-4 text-sm font-medium">
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
