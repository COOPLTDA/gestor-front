import { useEffect, useState, useMemo, Fragment, useRef, useCallback } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { usePresupuesto } from "@/contexts/PresupuestoEnroContext";
import { useCatalogos, useCatalogosState } from "@/contexts/CatalogosContext";
import { API } from "@/constants/api";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search } from "lucide-react";

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
      value={focused ? raw : `$ ${(Math.round(Number(raw) || 0)).toLocaleString("es-AR")}`}
      onFocus={() => { if (!disabled) setFocused(true); }}
      onChange={e => { if (!disabled) setRaw(e.target.value.replace(/[^0-9-]/g, "")); }}
      onBlur={() => { setFocused(false); if (!disabled) onCommit(Number(raw)); }}
      className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    />
  );
}

type RowSupervisor = {
  proveedor_codigo: number;
  division_codigo: number;
  zona: string;
  supervisor_id: number;
  def_crec_sup: number | null;
  objetivo_base_supervisor: number;
  objetivo_supervisor: number;
  obj_vs_prom_ult_6m: number | null;
  obj_vs_mes_anterior: number | null;
  obj_vs_mpaa: number | null;
};

export default function SupervisorTab({ readonly = false }: { readonly?: boolean }) {
  const { state, dispatch } = usePresupuesto();
  const modoGuardado = state.modoGuardado;
  const catalogos = useCatalogos();
  const { loading: catalogosLoading } = useCatalogosState();

  const [rows, setRows] = useState<RowSupervisor[]>([]);
  const [loading, setLoading] = useState(true);

  const pageSize = state.pageSize;
  const fullscreen = state.fullscreen;

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");

  type PendingSupervisor = { row: RowSupervisor; numeric: number | null };
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingSupervisor>>(new Map());

  // totals: zona → supervisor_id → { bgtOrig, bgtFinal, baseMA, objMA, baseMPAA, objMPAA }
  type SupervisorTotal = { bgtOrig: number; bgtFinal: number; baseMA: number; objMA: number; baseMPAA: number; objMPAA: number };
  const [totals, setTotals] = useState<Record<string, Record<number, SupervisorTotal>> | null>(null);

  const [mostrarSupervisores, setMostrarSupervisores] = useState(false);
  const [supervisoresVisibles, setSupervisoresVisibles] = useState<number[]>([]);
  const [busquedaSupervisor, setBusquedaSupervisor] = useState("");
  const supervisoresRef = useRef<HTMLDivElement>(null);

  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<string[]>([]);
  const [mostrarZonas, setMostrarZonas] = useState(false);
  const [busquedaZona, setBusquedaZona] = useState("");
  const zonaRef = useRef<HTMLDivElement>(null);
  const [totalFijo, setTotalFijo] = useState(() => localStorage.getItem('pres-total-fijo') === '1');
  const [estructuraCompleta, setEstructuraCompleta] = useState<Array<{ zona: string; supervisores: number[] }>>([]);


  const money = (v: number | null | undefined) =>
    v != null ? `$ ${Math.round(v).toLocaleString("es-AR")}` : "-";

  const pct = (v: number | null | undefined) =>
    v != null ? `${(v * 100).toFixed(2)} %` : "-";

  const pctColor = (v: number | null | undefined) =>
    v == null
      ? ""
      : v < 0
      ? "bg-red-200 text-red-800"
      : "bg-green-200 text-green-800";

  const proveedoresMap = useMemo(() => {
    return Object.fromEntries(
      catalogos.proveedores.map(p => [p.codigo, `${p.codigo} - ${p.nombre}`])
    );
  }, [catalogos.proveedores]);

  const divisionesMap = useMemo(() => {
    return Object.fromEntries(
      catalogos.divisiones.map(d => [d.codigo, `${d.codigo} - ${d.nombre}`])
    );
  }, [catalogos.divisiones]);

  const supervisoresMap = useMemo(() => {
    return Object.fromEntries(
      catalogos.supervisores.map(s => [s.id, s.nombre])
    );
  }, [catalogos.supervisores]);

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
      API.PRESUPUESTO_ENRO.SUPERVISOR.QUERY,
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

    const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.SUPERVISOR.QUERY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes: state.mesObjetivo, filtros, pagination: { page: 1, pageSize: 999999 } })
    });

    if (!res.success) return;

    const data = await res.json();
    const allRows: RowSupervisor[] = data.data.rows;

    const t: Record<string, Record<number, SupervisorTotal>> = {};
    const estructuraMap: Record<string, Set<number>> = {};
    allRows.forEach(r => {
      if (!t[r.zona]) t[r.zona] = {};
      if (!t[r.zona][r.supervisor_id]) t[r.zona][r.supervisor_id] = { bgtOrig: 0, bgtFinal: 0, baseMA: 0, objMA: 0, baseMPAA: 0, objMPAA: 0 };
      const su = t[r.zona][r.supervisor_id];
      su.bgtOrig += r.objetivo_base_supervisor ?? 0;
      su.bgtFinal += r.objetivo_supervisor ?? 0;
      // Base implícita: objetivo_supervisor = base * (1 + ratio) => base = objetivo_supervisor / (1 + ratio)
      if (r.obj_vs_mes_anterior !== null && r.obj_vs_mes_anterior !== undefined && (1 + r.obj_vs_mes_anterior) !== 0) {
        su.baseMA += (r.objetivo_supervisor ?? 0) / (1 + r.obj_vs_mes_anterior);
        su.objMA += r.objetivo_supervisor ?? 0;
      }
      if (r.obj_vs_mpaa !== null && r.obj_vs_mpaa !== undefined && (1 + r.obj_vs_mpaa) !== 0) {
        su.baseMPAA += (r.objetivo_supervisor ?? 0) / (1 + r.obj_vs_mpaa);
        su.objMPAA += r.objetivo_supervisor ?? 0;
      }
      if (!estructuraMap[r.zona]) estructuraMap[r.zona] = new Set();
      estructuraMap[r.zona].add(r.supervisor_id);
    });
    setTotals(t);

    const ec = Object.entries(estructuraMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([zona, supSet]) => ({
        zona,
        supervisores: Array.from(supSet).sort((a, b) => a - b)
      }));
    setEstructuraCompleta(ec);
  }, [state.mesObjetivo, busquedaDebounced, catalogos.proveedores]);

  useEffect(() => {
    reloadTotals();
  }, [state.mesObjetivo, reloadTotals]);

  // ===== CERRAR DROPDOWNS =====
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (supervisoresRef.current && !supervisoresRef.current.contains(target)) {
        setMostrarSupervisores(false);
      }
      if (zonaRef.current && !zonaRef.current.contains(target)) {
        setMostrarZonas(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const estructura = useMemo(() => {
    const map: Record<string, Set<number>> = {};

    rows.forEach(r => {
      if (!map[r.zona]) {
        map[r.zona] = new Set();
      }
      map[r.zona].add(r.supervisor_id);
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([zona, supSet]) => ({
        zona,
        supervisores: Array.from(supSet).sort((a, b) => a - b)
      }));
  }, [rows]);

  // ===== ZONAS DISPONIBLES =====
  const zonasDisponibles = useMemo(() => estructuraCompleta.map(e => e.zona), [estructuraCompleta]);

  // ===== INICIALIZAR ZONAS Y SUPERVISORES VISIBLES =====
  useEffect(() => {
    if (estructuraCompleta.length === 0) return;
    const todos = estructuraCompleta.flatMap(e => e.supervisores);
    setSupervisoresVisibles(prev => prev.length === 0 ? todos : prev);
    setZonasSeleccionadas(prev => prev.length === 0 ? zonasDisponibles : prev);
  }, [estructuraCompleta]);

  // ===== ESTRUCTURA FILTRADA SEGÚN ZONAS Y SUPERVISORES SELECCIONADOS =====
  const estructuraFiltrada = useMemo(() => {
    return estructuraCompleta
      .filter(z => zonasSeleccionadas.length === 0 || zonasSeleccionadas.includes(z.zona))
      .map((z: { zona: string; supervisores: number[] }) => ({
        zona: z.zona,
        supervisores: z.supervisores.filter((s: number) => supervisoresVisibles.includes(s))
      }))
      .filter(z => z.supervisores.length > 0);
  }, [estructuraCompleta, supervisoresVisibles, zonasSeleccionadas]);


  const dataAgrupada = useMemo(() => {
    const map: any = {};

    rows.forEach(row => {
      const key = `${row.proveedor_codigo}_${row.division_codigo}`;

      if (!map[key]) {
        map[key] = {
          proveedor_codigo: row.proveedor_codigo,
          division_codigo: row.division_codigo,
          data: {}
        };
      }

      if (!map[key].data[row.zona]) {
        map[key].data[row.zona] = {};
      }

      map[key].data[row.zona][row.supervisor_id] = row;
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
    estructuraFiltrada.forEach(z => {
      z.supervisores.forEach(supId => {
        const t = totals[z.zona]?.[supId];
        if (t) { bgtOrig += t.bgtOrig; bgtFinal += t.bgtFinal; }
      });
    });
    return { bgtOrig, bgtFinal };
  }, [totals, estructuraFiltrada]);

  const saveChange = async (row: RowSupervisor, value: string) => {
    if (!state.mesObjetivo) return;
    const numeric = value === "" || value === null ? null : Number(value);
    const changeKey = `${row.proveedor_codigo}_${row.division_codigo}_${row.zona}_${row.supervisor_id}`;

    if (modoGuardado === "manual") {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(changeKey, { row, numeric });
        return next;
      });
      return;
    }

    try {
      const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.SUPERVISOR.BASE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes: state.mesObjetivo,
          changes: [{ keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo, zona: row.zona, supervisor_id: row.supervisor_id }, crecimiento: numeric }]
        })
      });
      if (!res.success) return;
      await res.json();
      await reload();
      reloadTotals();
    } catch (err) {
      console.error("Error PATCH supervisor:", err);
    }
  };

  const aplicarCambiosSupervisor = async () => {
    if (!state.mesObjetivo || pendingChanges.size === 0) return;
    const changes = Array.from(pendingChanges.values()).map(({ row, numeric }) => ({
      keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo, zona: row.zona, supervisor_id: row.supervisor_id },
      crecimiento: numeric
    }));
    try {
      await fetchWithAuth(API.PRESUPUESTO_ENRO.SUPERVISOR.BASE, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: state.mesObjetivo, changes })
      });
      setPendingChanges(new Map());
      await reload();
      reloadTotals();
    } catch (err) {
      console.error("Error aplicando cambios supervisor:", err);
    }
  };


  // =====================================================
  // EXPORTAR EXCEL
  // =====================================================

  useEffect(() => {
    const handleExport = async (event: any) => {
      if (event.detail?.nivel !== "supervisor") return;
      if (!state.mesObjetivo) return;

      const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.SUPERVISOR.QUERY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: state.mesObjetivo, pagination: { page: 1, pageSize: 999999 } })
      });
      if (!res.success) return;

      const data = await res.json();
      const exportRows: RowSupervisor[] = data.data.rows;

      const soloFiltros: boolean = event.detail?.soloFiltros ?? false;

      // estructura: zona → [supervisores]
      let estructuraExp: Record<string, number[]>;
      let zonas: string[];

      if (soloFiltros) {
        estructuraExp = {};
        estructuraFiltrada.forEach(z => {
          estructuraExp[z.zona] = [...z.supervisores].sort((a, b) => a - b);
        });
        zonas = estructuraFiltrada.map(z => z.zona);
      } else {
        estructuraExp = {};
        exportRows.forEach(r => {
          if (!estructuraExp[r.zona]) estructuraExp[r.zona] = [];
          if (!estructuraExp[r.zona].includes(r.supervisor_id))
            estructuraExp[r.zona].push(r.supervisor_id);
        });
        Object.values(estructuraExp).forEach(arr => arr.sort((a, b) => a - b));
        zonas = Object.keys(estructuraExp).sort();
      }

      // @ts-ignore
      const ExcelJS = await import("exceljs");
      const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
      const HEADER_FONT = { name: "Arial", bold: true, size: 10, color: { argb: "FF1E3A5F" } };
      const CELL_FONT   = { name: "Arial", size: 10 };
      const MONEY_FMT   = '"$ "#,##0;[Red]"$ "(-#,##0);"-"';
      const PCT_FMT     = '0.00"%"';
      const bThin = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
      const bMed  = { style: "medium" as const, color: { argb: "FF6B7280" } };

      const INDIGO_H2 = "FFC7D2FE"; const INDIGO_H3 = "FFE0E7FF"; const INDIGO_C = "FFEEF2FF";
      const SKY_H = "FFBAE6FD"; const SKY_C = "FFE0F2FE";

      const wb = new ExcelJS.default.Workbook();
      const ws = wb.addWorksheet("Supervisor");

      // — Fila 1: Proveedor | División | [Zona colSpanN*4] ...
      // — Fila 2: [Supervisor colSpan4] ...
      // — Fila 3: Crec% | BGT | vs Prom 6M | VS MA

      const AMBER_TH_S = "FFFEF3C7"; const AMBER_TC_S = "FFFEF9C3";
      const totalDataCols = zonas.reduce((s, z) => s + estructuraExp[z].length * 6, 0);
      const totColStart = 3 + totalDataCols; // 1-based start col for Total group

      const h1: any[] = ["Proveedor", "División"];
      zonas.forEach(z => {
        const supCount = estructuraExp[z].length;
        h1.push(z);
        for (let i = 1; i < supCount * 6; i++) h1.push("");
      });
      h1.push("Total Supervisor"); h1.push(""); h1.push("");
      const hr1 = ws.addRow(h1);
      hr1.height = 22;
      let colCursor = 3;
      zonas.forEach(z => {
        const span = estructuraExp[z].length * 6;
        if (span > 1) ws.mergeCells(1, colCursor, 1, colCursor + span - 1);
        colCursor += span;
      });
      ws.mergeCells(1, totColStart, 1, totColStart + 2);
      hr1.eachCell((cell: any, ci: number) => {
        const isTot = ci >= totColStart;
        cell.font = HEADER_FONT; cell.fill = fill(ci <= 2 ? SKY_H : isTot ? AMBER_TH_S : INDIGO_H2);
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      const h2: any[] = ["", ""];
      zonas.forEach(z => estructuraExp[z].forEach(supId => {
        h2.push(supervisoresMap[supId] ?? `ID ${supId}`);
        h2.push(""); h2.push(""); h2.push(""); h2.push(""); h2.push("");
      }));
      h2.push(""); h2.push(""); h2.push("");
      const hr2 = ws.addRow(h2);
      hr2.height = 20;
      colCursor = 3;
      zonas.forEach(z => estructuraExp[z].forEach(() => {
        ws.mergeCells(2, colCursor, 2, colCursor + 5);
        colCursor += 6;
      }));
      hr2.eachCell((cell: any, ci: number) => {
        const isTot = ci >= totColStart;
        cell.font = HEADER_FONT; cell.fill = fill(ci <= 2 ? SKY_H : isTot ? AMBER_TH_S : INDIGO_H3);
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      const h3: any[] = ["", ""];
      zonas.forEach(z => estructuraExp[z].forEach(() => {
        h3.push("BGT Orig"); h3.push("Crec %"); h3.push("Crec $"); h3.push("BGT Final"); h3.push("VS MA"); h3.push("VS MPAA");
      }));
      h3.push("BGT Orig"); h3.push("BGT Final"); h3.push("Final - Orig");
      const hr3 = ws.addRow(h3);
      hr3.height = 18;
      hr3.eachCell((cell: any, ci: number) => {
        const isTot = ci >= totColStart;
        cell.font = HEADER_FONT; cell.fill = fill(ci <= 2 ? SKY_H : isTot ? AMBER_TH_S : INDIGO_H3);
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      // pivot
      const pivotMap: Record<string, any> = {};
      exportRows.forEach(r => {
        const key = `${r.proveedor_codigo}_${r.division_codigo}`;
        if (!pivotMap[key]) pivotMap[key] = {
          proveedor: proveedoresMap[r.proveedor_codigo] ?? String(r.proveedor_codigo),
          division: divisionesMap[r.division_codigo] ?? String(r.division_codigo),
          data: {} as Record<string, Record<number, RowSupervisor>>
        };
        if (!pivotMap[key].data[r.zona]) pivotMap[key].data[r.zona] = {};
        pivotMap[key].data[r.zona][r.supervisor_id] = r;
      });

      // Per supervisor sub-col: 0=bgtOrig,1=crec%,2=crec$,3=bgtFinal,4=maPct,5=mpaaPct
      let grandBgtOrigSup = 0; let grandBgtFinalSup = 0;
      Object.values(pivotMap).forEach((item: any) => {
        const vals: any[] = [item.proveedor, item.division];
        let rowBgtOrig = 0; let rowBgtFinal = 0;
        zonas.forEach(z => estructuraExp[z].forEach(supId => {
          const d = item.data?.[z]?.[supId];
          const orig = d ? (d.objetivo_base_supervisor ?? 0) : null;
          const final = d?.objetivo_supervisor ?? null;
          vals.push(orig);
          vals.push(d?.def_crec_sup ?? null);
          vals.push(orig !== null && final !== null ? final - orig : null);
          vals.push(final);
          vals.push(d ? (d.obj_vs_mes_anterior ?? null) !== null ? (d.obj_vs_mes_anterior as number) * 100 : null : null);
          vals.push(d ? (d.obj_vs_mpaa ?? null) !== null ? (d.obj_vs_mpaa as number) * 100 : null : null);
          if (d) {
            rowBgtOrig  += orig ?? 0;
            rowBgtFinal += final ?? 0;
          }
        }));
        grandBgtOrigSup  += rowBgtOrig;
        grandBgtFinalSup += rowBgtFinal;
        vals.push(rowBgtOrig); vals.push(rowBgtFinal); vals.push(rowBgtFinal - rowBgtOrig);
        const dr = ws.addRow(vals);
        dr.height = 18;
        dr.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
          const isTot = ci >= totColStart;
          const subCol = ci <= 2 ? -1 : isTot ? ci - totColStart : (ci - 3) % 6;
          // subCol: 0=bgtOrig,1=crec%,2=crec$,3=bgtFinal,4=promPct,5=maPct
          cell.font = isTot ? { ...CELL_FONT, bold: true } : { ...CELL_FONT };
          cell.fill = fill(ci <= 2 ? SKY_C : isTot ? AMBER_TC_S : INDIGO_C);
          const isCenter = !isTot && subCol === 1;
          cell.alignment = { horizontal: ci <= 2 ? "left" : isCenter ? "center" : "right", vertical: "middle" };
          cell.border = { top: bThin, bottom: bThin, left: bThin, right: bThin };
          if (isTot) { if (cell.value !== null) cell.numFmt = MONEY_FMT; }
          else if (subCol === 0 || subCol === 2 || subCol === 3) { if (cell.value !== null) cell.numFmt = MONEY_FMT; }
          else if (subCol === 4 || subCol === 5) {
            cell.numFmt = PCT_FMT;
            if (cell.value !== null && typeof cell.value === "number")
              cell.font = { ...CELL_FONT, color: { argb: cell.value < 0 ? "FFDC2626" : "FF16A34A" } };
          }
        });
      });

      // Grand TOTAL row
      const gtr = ws.addRow(["TOTAL", "", ...Array(totalDataCols).fill(null),
        grandBgtOrigSup, grandBgtFinalSup, grandBgtFinalSup - grandBgtOrigSup]);
      gtr.height = 20;
      gtr.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
        const isTot = ci >= totColStart;
        cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = fill("FF1E293B");
        cell.alignment = { horizontal: ci <= 2 ? "left" : "right", vertical: "middle" };
        cell.border = { top: { style: "medium" as const, color: { argb: "FF475569" } }, bottom: bThin, left: bThin, right: bThin };
        if (isTot && cell.value !== null) cell.numFmt = MONEY_FMT;
      });

      ws.getColumn(1).width = 30; ws.getColumn(2).width = 22;
      ws.getColumn(totColStart).width = 18;
      ws.getColumn(totColStart + 1).width = 18;
      ws.getColumn(totColStart + 2).width = 18;
      ws.views = [{ state: "frozen", xSplit: 2, ySplit: 3 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Presupuesto_supervisor_${state.mesObjetivo}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    };

    window.addEventListener("export-presupuesto", handleExport);
    return () => window.removeEventListener("export-presupuesto", handleExport);
  }, [state.mesObjetivo, proveedoresMap, divisionesMap, supervisoresMap, estructuraFiltrada]);

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

        {/* ===== FILTROS ===== */}
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

        {/* ZONAS */}
        <div className="relative" ref={zonaRef}>
          <button
            onClick={() => setMostrarZonas(!mostrarZonas)}
            className="px-3 py-1 border rounded bg-gray-100 min-w-[200px] text-left flex items-center justify-between gap-2"
          >
            <span>{zonasSeleccionadas.length === 0
              ? "Todas las zonas"
              : zonasSeleccionadas.length === zonasDisponibles.length
                ? "Todas las zonas"
                : zonasSeleccionadas.length === 1
                  ? zonasSeleccionadas[0]
                  : `${zonasSeleccionadas.length} zonas`}</span>
            <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
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
                  checked={zonasSeleccionadas.length === zonasDisponibles.length}
                  onChange={() => {
                    if (zonasSeleccionadas.length === zonasDisponibles.length) {
                      setZonasSeleccionadas([]);
                    } else {
                      setZonasSeleccionadas(zonasDisponibles);
                    }
                  }}
                />
                Seleccionar todas
              </label>
              {zonasDisponibles
                .filter(z => z.toLowerCase().includes(busquedaZona.toLowerCase()))
                .map(z => (
                  <label key={z} className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={zonasSeleccionadas.includes(z)}
                      onChange={() => {
                        setZonasSeleccionadas(prev =>
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

        {/* SUPERVISORES */}
        <div className="relative" ref={supervisoresRef}>
          <button
            onClick={() => setMostrarSupervisores(!mostrarSupervisores)}
            className="px-3 py-1 border rounded bg-gray-100 flex items-center gap-2"
          >
            Supervisores
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {mostrarSupervisores && (
            <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow max-h-96 overflow-auto w-80 resize both">

              <input
                type="text"
                placeholder="Buscar supervisor..."
                value={busquedaSupervisor}
                onChange={e => setBusquedaSupervisor(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm mb-3"
              />

              <label className="flex items-center gap-2 font-semibold text-sm mb-2">
                <input
                  type="checkbox"
                  checked={supervisoresVisibles.length === estructuraCompleta.flatMap(e => e.supervisores).length}
                  onChange={() => {
                    if (supervisoresVisibles.length === estructuraCompleta.flatMap(e => e.supervisores).length) {
                      setSupervisoresVisibles([]);
                    } else {
                      setSupervisoresVisibles(estructuraCompleta.flatMap(e => e.supervisores));
                    }
                  }}
                />
                Seleccionar todos
              </label>

              {Array.from(new Set(estructuraCompleta.flatMap(e => e.supervisores)))
                .filter(id =>
                  (supervisoresMap[id] ?? "")
                    .toLowerCase()
                    .includes(busquedaSupervisor.toLowerCase())
                )
                .map(id => (
                  <label key={id} className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={supervisoresVisibles.includes(id)}
                      onChange={() => {
                        setSupervisoresVisibles(prev =>
                          prev.includes(id)
                            ? prev.filter(x => x !== id)
                            : [...prev, id]
                        );
                      }}
                    />
                    {supervisoresMap[id]}
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
                <button onClick={aplicarCambiosSupervisor} className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700">
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

        <div className={fullscreen ? "overflow-auto flex-1 min-h-0 rounded-lg border shadow-sm" : "overflow-x-auto rounded-lg border shadow-sm"}>

        <table className="min-w-max table-fixed text-sm border-collapse">

          <thead className="sticky top-0 z-40 bg-white shadow-md">

            <tr>
              <th rowSpan={3} className="w-56 p-2 border bg-sky-100 sticky left-0 z-50 border-r-2 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                Proveedor
              </th>

              <th rowSpan={3} className="w-36 p-2 border bg-sky-100 sticky left-56 z-50 border-r-4 border-slate-400 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                División
              </th>

              {estructuraFiltrada.map(z => (
                <th
                  key={z.zona}
                  colSpan={z.supervisores.length * 6}
                  className="p-2 border text-center font-bold border-r-4 border-slate-600 bg-indigo-200"
                >
                  {z.zona}
                </th>
              ))}
              <th
                colSpan={3}
                rowSpan={2}
                className={`p-2 border text-center font-bold bg-amber-100 border-r-4 border-slate-600${totalFijo ? ' sticky right-0 z-50' : ''}`}
              >
                Total
              </th>
            </tr>

            <tr>
              {estructuraFiltrada.map(z =>
                z.supervisores.map(supId => (
                  <th
                    key={`${z.zona}-${supId}`}
                    colSpan={6}
                    className="p-2 border text-center font-semibold bg-indigo-100 border-r-4 border-slate-500"
                  >
                    {supervisoresMap[supId] ?? `ID ${supId}`}
                  </th>
                ))
              )}
            </tr>

            <tr>
              {estructuraFiltrada.map(z =>
                z.supervisores.map(supId => (
                  <Fragment key={`metric-${z.zona}-${supId}`}>
                    <th className="w-32 p-2 border border-slate-600 bg-indigo-50">
                      BGT Orig
                    </th>

                    <th className="w-24 p-2 border border-slate-600 bg-indigo-50">
                      Crec %
                    </th>

                    <th className="w-32 p-2 border border-slate-600 bg-indigo-50">
                      Crec $
                    </th>

                    <th className="w-32 p-2 border border-slate-600 bg-indigo-50">
                      BGT Final
                    </th>

                    <th className="w-32 p-2 border border-slate-600 bg-indigo-50">
                      VS MA
                    </th>

                    <th className="w-32 p-2 border border-slate-600 bg-indigo-50 border-r-4 border-slate-500">
                      VS MPAA
                    </th>
                  </Fragment>
                ))
              )}
              <th className={`w-32 p-2 border border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-64 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>BGT Orig</th>
              <th className={`w-32 p-2 border border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-32 z-50' : ''}`}>BGT Final</th>
              <th className={`w-32 p-2 border border-r-4 border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-0 z-50' : ''}`}>Final - Orig</th>
            </tr>

          </thead>

          <tbody>
            {(loading || catalogosLoading) ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 2 + supervisoresVisibles.length * 6 + 3 }).map((_, j) => (
                    <td key={j} className="p-2 border">
                      <div className="h-4 bg-slate-200 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <>
                {grouped.map((group: any[], gi: number) => {
                  const subtotalBgtOrig = estructuraFiltrada.reduce((sum, z) =>
                    sum + z.supervisores.reduce((s2, supId) =>
                      s2 + group.reduce((s, r) => s + (r.data?.[z.zona]?.[supId]?.objetivo_base_supervisor ?? 0), 0), 0), 0);
                  const subtotalBgtFinal = estructuraFiltrada.reduce((sum, z) =>
                    sum + z.supervisores.reduce((s2, supId) =>
                      s2 + group.reduce((s, r) => s + (r.data?.[z.zona]?.[supId]?.objetivo_supervisor || 0), 0), 0), 0);

                  return (
                    <Fragment key={`group-${gi}`}>
                      {group.length > 1 && (
                        <tr className="bg-sky-50 font-semibold border-t-2 border-slate-300">
                          <td className="w-56 p-2 border bg-sky-100 sticky left-0 z-30 border-r-2 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                            {proveedoresMap[group[0].proveedor_codigo]}
                          </td>
                          <td className="w-36 p-2 border bg-sky-100 sticky left-56 z-30 border-r-4 border-slate-400 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)] text-slate-500 italic">
                            Empresa
                          </td>
                          {estructuraFiltrada.map(z =>
                            z.supervisores.map(supId => {
                              const subOrigSup  = group.reduce((s, r) => s + (r.data?.[z.zona]?.[supId]?.objetivo_base_supervisor ?? 0), 0);
                              const subFinalSup = group.reduce((s, r) => s + (r.data?.[z.zona]?.[supId]?.objetivo_supervisor || 0), 0);
                              const subCrecAcum = subOrigSup > 0 ? ((subFinalSup / subOrigSup) - 1) * 100 : null;
                              return (
                                <Fragment key={`subsup-${z.zona}-${supId}`}>
                                  <td className="p-2 border border-slate-600 text-right font-medium">
                                    {money(subOrigSup)}
                                  </td>
                                  <td className="p-2 border border-slate-600 text-center font-medium text-slate-700">
                                    {subCrecAcum !== null ? `${subCrecAcum.toFixed(2)} %` : "—"}
                                  </td>
                                  <td className="p-2 border border-slate-600 text-center text-slate-400">—</td>
                                  <td className="p-2 border border-slate-600 text-right font-medium">
                                    {money(subFinalSup)}
                                  </td>
                                  <td className="p-2 border border-slate-600 text-center text-slate-400">—</td>
                                  <td className="p-2 border border-slate-600 border-r-4 border-slate-500 text-center text-slate-400">—</td>
                                </Fragment>
                              );
                            })
                          )}
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
                        const rowBgtOrig = estructuraFiltrada.reduce((sum, z) =>
                          sum + z.supervisores.reduce((s2, supId) =>
                            s2 + (row.data?.[z.zona]?.[supId]?.objetivo_base_supervisor ?? 0), 0), 0);
                        const rowBgtFinal = estructuraFiltrada.reduce((sum, z) =>
                          sum + z.supervisores.reduce((s2, supId) =>
                            s2 + (row.data?.[z.zona]?.[supId]?.objetivo_supervisor || 0), 0), 0);

                        return (
                          <tr key={i} className="hover:bg-slate-100">

                            <td className="w-56 p-2 border bg-sky-50 sticky left-0 z-30 border-r-2 border-slate-300 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                              {proveedoresMap[row.proveedor_codigo]}
                            </td>

                            <td className="w-36 p-2 border bg-sky-50 sticky left-56 z-30 border-r-4 border-slate-400 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]">
                              {divisionesMap[row.division_codigo]}
                            </td>

                            {estructuraFiltrada.map(z =>
                              z.supervisores.map(supId => {
                                const data = row.data?.[z.zona]?.[supId];
                                const bgtOrig = data?.objetivo_base_supervisor ?? null;

                                return (
                                  <Fragment key={`${z.zona}-${supId}-${i}`}>
                                    <td className="p-2 border border-slate-600 text-right">
                                      {bgtOrig !== null ? money(bgtOrig) : "-"}
                                    </td>

                                    {(() => {
                                      const supDirty = data ? pendingChanges.has(`${data.proveedor_codigo}_${data.division_codigo}_${data.zona}_${data.supervisor_id}`) : false;
                                      return (
                                      <>
                                    <td className={`p-2 border border-slate-600 text-center ${supDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : ""}`}>
                                      {data ? (
                                        <Input
                                          type="number"
                                          step="0.01"
                                          disabled={readonly}
                                          defaultValue={
                                            data.def_crec_sup !== null && data.def_crec_sup !== undefined
                                              ? Number(data.def_crec_sup).toFixed(2)
                                              : ""
                                          }
                                          className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${readonly ? "opacity-50 cursor-not-allowed" : ""}`}
                                          onBlur={(e) => {
                                            if (readonly) return;
                                            const value = e.target.value;
                                            if (value !== "") {
                                              const rounded = Number(value).toFixed(2);
                                              e.target.value = rounded;
                                              saveChange(data, rounded);
                                            } else {
                                              saveChange(data, "");
                                            }
                                          }}
                                        />
                                      ) : "-"}
                                    </td>

                                    <td className={`p-2 border border-slate-600 text-center ${supDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : ""}`}>
                                      {data && bgtOrig ? (
                                        <MoneyInput
                                          key={`crec_dolar_${z.zona}_${supId}_${data.proveedor_codigo}_${data.division_codigo}_${data.objetivo_supervisor}`}
                                          value={Math.round(data.objetivo_supervisor ?? 0)}
                                          disabled={readonly}
                                          onCommit={(v) => {
                                            const rounded = Number((((v / bgtOrig) - 1) * 100).toFixed(2));
                                            saveChange(data, String(rounded));
                                          }}
                                        />
                                      ) : "-"}
                                    </td>
                                      </>
                                      );
                                    })()}

                                    <td className="p-2 border border-slate-600 text-right">
                                      {data ? money(data.objetivo_supervisor) : "-"}
                                    </td>

                                    <td className={`p-2 border border-slate-600 text-right ${pctColor(data?.obj_vs_mes_anterior)}`}>
                                      {data ? pct(data.obj_vs_mes_anterior) : "-"}
                                    </td>

                                    <td className={`p-2 border border-slate-600 border-r-4 border-slate-500 text-right ${pctColor(data?.obj_vs_mpaa)}`}>
                                      {data ? pct(data.obj_vs_mpaa) : "-"}
                                    </td>
                                  </Fragment>
                                );
                              })
                            )}

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

              {estructuraFiltrada.map(z =>
                z.supervisores.map(supId => {
                  const su = totals?.[z.zona]?.[supId];
                  const crecPct = su && su.bgtOrig > 0 ? ((su.bgtFinal / su.bgtOrig) - 1) * 100 : null;
                  const maPct = su && su.baseMA > 0 ? ((su.objMA / su.baseMA) - 1) * 100 : null;
                  const mpaaPct = su && su.baseMPAA > 0 ? ((su.objMPAA / su.baseMPAA) - 1) * 100 : null;
                  return (
                    <Fragment key={`total-${z.zona}-${supId}`}>
                      <td className="w-32 p-2 border border-slate-600 bg-slate-700 text-right">
                        {su ? money(su.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
                      </td>
                      <td className="w-24 p-2 border border-slate-600 bg-slate-700 text-center">
                        {su ? (crecPct !== null ? `${crecPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                      </td>
                      <td className="w-32 p-2 border border-slate-600 bg-slate-700 text-right">
                        {su ? fmtDiff(su.bgtFinal - su.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
                      </td>
                      <td className="w-32 p-2 border border-slate-600 bg-slate-700 text-right">
                        {su ? money(su.bgtFinal) : <span className="text-slate-400 text-xs">…</span>}
                      </td>
                      <td className="w-32 p-2 border border-slate-600 bg-slate-700 text-center">
                        {su ? (maPct !== null ? `${maPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                      </td>
                      <td className="w-32 p-2 border border-slate-600 bg-slate-700 border-r-4 text-center">
                        {su ? (mpaaPct !== null ? `${mpaaPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                      </td>
                    </Fragment>
                  );
                })
              )}
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

      <div className="flex justify-center items-center gap-4 text-sm font-medium mt-4">
        <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-md border disabled:opacity-40">◀</button>
        <span>Página {page} de {totalPages}</span>
        <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-md border disabled:opacity-40">▶</button>
      </div>

    </div>
  );
}
