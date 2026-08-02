import { useEffect, useState, useMemo, Fragment, useRef, useCallback } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { usePresupuesto } from "@/contexts/PresupuestoEnroContext";
import { useCatalogos, useCatalogosState } from "@/contexts/CatalogosContext";
import { API } from "@/constants/api";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search } from "lucide-react";

type RowVendedor = {
  proveedor_codigo: number;
  division_codigo: number;
  zona: string;
  supervisor_id: number;
  supervisor: string;
  vendedor: string;
  def_crec_vend: number | null;
  objetivo_vendedor: number;
  objetivo_base_vendedor: number;
  obj_vs_mes_anterior: number | null;
  obj_vs_mpaa: number | null;
};

type EditCell = { crec: string; importe: string };

const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const fmtDiff = (n: number) => {
  const abs = `$ ${Math.abs(Math.round(n)).toLocaleString("es-AR")}`;
  return n < 0 ? `-${abs}` : abs;
};
const pct = (v: number | null | undefined) =>
  v != null ? `${(v * 100).toFixed(2)} %` : "-";
const pctColor = (v: number | null | undefined) =>
  v == null ? "" : v < 0 ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800";

export default function VendedorTab({ readonly = false }: { readonly?: boolean }) {

  const { state, dispatch } = usePresupuesto();
  const modoGuardado = state.modoGuardado;
  const catalogos = useCatalogos();
  const { loading: catalogosLoading } = useCatalogosState();

  const [rows, setRows] = useState<RowVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, EditCell>>({});
  const [focusedImporte, setFocusedImporte] = useState<string | null>(null);

  type PendingVendedor = { row: RowVendedor; crecStr: string };
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingVendedor>>(new Map());

  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<string[]>([]);
  const [totalFijo, setTotalFijo] = useState(() => localStorage.getItem('pres-total-fijo') === '1');
  const [todosVendedores, setTodosVendedores] = useState<string[]>([]);
  const [vendedorSupervisoresMap, setVendedorSupervisoresMap] = useState<Record<string, number[]>>({});
  const [vendedorModelosMap, setVendedorModelosMap] = useState<Record<string, string[]>>({});

  const [zonasDisponibles, setZonasDisponibles] = useState<string[]>([]);
  const [mostrarZonas, setMostrarZonas] = useState(false);
  const [busquedaZona, setBusquedaZona] = useState("");
  const zonaRef = useRef<HTMLDivElement>(null);

  const [mostrarColumnas, setMostrarColumnas] = useState(false);
  const columnasRef = useRef<HTMLDivElement>(null);
  const [busquedaVendedor, setBusquedaVendedor] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>([]);

  const [supervisoresSeleccionados, setSupervisoresSeleccionados] = useState<number[]>([]);
  const [mostrarSupervisores, setMostrarSupervisores] = useState(false);
  const [busquedaSupervisor, setBusquedaSupervisor] = useState("");
  const supervisoresRef = useRef<HTMLDivElement>(null);

  const [modelosSeleccionados, setModelosSeleccionados] = useState<string[]>([]);
  const [mostrarModelos, setMostrarModelos] = useState(false);
  const [busquedaModelo, setBusquedaModelo] = useState("");
  const modelosRef = useRef<HTMLDivElement>(null);

  const pageSize = state.pageSize;
  const fullscreen = state.fullscreen;

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");

  // ================= CERRAR DROPDOWNS =================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (zonaRef.current && !zonaRef.current.contains(target)) {
        setMostrarZonas(false);
      }

      if (columnasRef.current && !columnasRef.current.contains(target)) {
        setMostrarColumnas(false);
      }

      if (supervisoresRef.current && !supervisoresRef.current.contains(target)) {
        setMostrarSupervisores(false);
      }

      if (modelosRef.current && !modelosRef.current.contains(target)) {
        setMostrarModelos(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const vendedoresMap = useMemo(() => {
    const map: Record<string, string> = {};
    catalogos.vendedores.forEach(v => {
      map[String(v.id).trim()] = v.nombre;
    });
    return map;
  }, [catalogos.vendedores]);

  const supervisoresMap = useMemo(() => {
    return Object.fromEntries(
      catalogos.supervisores.map(s => [s.id, s.nombre])
    );
  }, [catalogos.supervisores]);

  // ================= ZONAS =================

  useEffect(() => {
    const loadZonas = async () => {
      if (!state.mesObjetivo) return;

      const res = await fetchWithAuth(
        API.PRESUPUESTO_ENRO.VENDEDOR.QUERY,
        {
          method: "POST",
          body: JSON.stringify({
            mes: state.mesObjetivo,
            pagination: { page: 1, pageSize: 999999 }
          })
        }
      );

      if (res.success) {
        const data = await res.json();
        const rowsData: RowVendedor[] = data.data.rows;

        const zonas = Array.from(new Set(rowsData.map(r => r.zona))).sort();
        setZonasDisponibles(zonas);

        const storageKey = `pres-vendedor-zonas-${state.mesObjetivo}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const parsed: string[] = JSON.parse(saved);
            const valid = parsed.filter(z => zonas.includes(z));
            setZonasSeleccionadas(valid.length > 0 ? valid : zonas.slice(0, 1));
          } catch {
            setZonasSeleccionadas(zonas.slice(0, 1));
          }
        } else {
          setZonasSeleccionadas(zonas.slice(0, 1));
        }
      }
    };

    loadZonas();
  }, [state.mesObjetivo]);

  // ================= RELOAD =================

  const reload = async () => {
    if (!state.mesObjetivo) return;

    setLoading(true);

    const matchingCodes = busquedaDebounced.trim()
      ? catalogos.proveedores
          .filter(p => `${p.codigo} - ${p.nombre}`.toLowerCase().includes(busquedaDebounced.trim().toLowerCase()))
          .map(p => p.codigo)
      : [];

    const filtros: Record<string, any> = {};
    if (zonasSeleccionadas.length) filtros.zona = zonasSeleccionadas;
    if (matchingCodes.length) filtros.proveedor_codigo = matchingCodes;

    const res = await fetchWithAuth(
      API.PRESUPUESTO_ENRO.VENDEDOR.QUERY,
      {
        method: "POST",
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
    if (!state.mesObjetivo || zonasDisponibles.length === 0) return;
    localStorage.setItem(`pres-vendedor-zonas-${state.mesObjetivo}`, JSON.stringify(zonasSeleccionadas));
  }, [zonasSeleccionadas, state.mesObjetivo, zonasDisponibles.length]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mesObjetivo, zonasSeleccionadas, page, pageSize, busquedaDebounced]);

  useEffect(() => {
    setPage(1);
  }, [busquedaDebounced]);

  // ================= EDIT VALUES (inputs controlados) =================

  useEffect(() => {
    const newVals: Record<string, EditCell> = {};
    rows.forEach(row => {
      const key = `${row.proveedor_codigo}_${row.division_codigo}_${String(row.vendedor).trim()}`;
      const crec = row.def_crec_vend !== null ? String(row.def_crec_vend) : "";
      const importe = crec !== "" && row.objetivo_base_vendedor
        ? String(Math.round(row.objetivo_base_vendedor * (1 + Number(crec) / 100)))
        : "";
      newVals[key] = { crec, importe };
    });
    setEditValues(prev => ({ ...prev, ...newVals }));
  }, [rows]);

  // ================= AGRUPADO =================

  const vendedoresUnicos = useMemo<string[]>(() => {
    return Array.from(
      new Set(rows.map(r => String(r.vendedor).trim()))
    ).sort();
  }, [rows]);

  useEffect(() => {
    setColumnasVisibles(prev =>
      prev.length === 0 ? todosVendedores : prev
    );
  }, [todosVendedores]);

  const vendedoresSelectorFiltrados = todosVendedores.filter(v =>
    `${v} ${vendedoresMap[v] ?? ""}`
      .toLowerCase()
      .includes(busquedaVendedor.toLowerCase())
  );

  const supervisoresDisponibles = useMemo<number[]>(() => {
    return Array.from(new Set(rows.map(r => r.supervisor_id))).sort((a, b) => a - b);
  }, [rows]);

  useEffect(() => {
    setSupervisoresSeleccionados(prev => prev.length === 0 ? supervisoresDisponibles : prev);
  }, [supervisoresDisponibles]);

  const modelosDisponibles = useMemo<string[]>(() => {
    return Array.from(new Set(rows.map(r => r.supervisor).filter(Boolean))).sort();
  }, [rows]);

  useEffect(() => {
    setModelosSeleccionados(prev => prev.length === 0 ? modelosDisponibles : prev);
  }, [modelosDisponibles]);

  const vendedoresFiltrados = useMemo(() => {
    return todosVendedores.filter(v => {
      if (!columnasVisibles.includes(v)) return false;
      if (supervisoresSeleccionados.length > 0) {
        if (!(vendedorSupervisoresMap[v] ?? []).some(s => supervisoresSeleccionados.includes(s))) return false;
      }
      if (modelosSeleccionados.length > 0) {
        if (!vendedorModelosMap[v]?.some(m => modelosSeleccionados.includes(m))) return false;
      }
      return true;
    });
  }, [todosVendedores, columnasVisibles, supervisoresSeleccionados, vendedorSupervisoresMap, modelosSeleccionados, vendedorModelosMap]);

  const dataAgrupada = useMemo<any[]>(() => {
    const map: Record<string, any> = {};

    rows.forEach(row => {
      const key = `${row.proveedor_codigo}_${row.division_codigo}`;

      if (!map[key]) {
        map[key] = {
          proveedor_codigo: row.proveedor_codigo,
          division_codigo: row.division_codigo,
          vendedores: {}
        };
      }

      map[key].vendedores[String(row.vendedor).trim()] = row;
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

  // ================= SAVE =================

  const saveCrec = async (row: RowVendedor, crecStr: string) => {
    const numeric = crecStr === "" ? null : Number(crecStr);
    const changeKey = `${row.proveedor_codigo}_${row.division_codigo}_${row.zona}_${row.supervisor_id}_${String(row.vendedor).trim()}`;

    if (modoGuardado === "manual") {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(changeKey, { row, crecStr });
        return next;
      });
      return;
    }

    await fetchWithAuth(API.PRESUPUESTO_ENRO.VENDEDOR.BASE, {
      method: "PATCH",
      body: JSON.stringify({
        mes: state.mesObjetivo,
        changes: [{ keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo, zona: row.zona, supervisor_id: row.supervisor_id, vendedor: row.vendedor }, crecimiento: numeric }]
      })
    });
    reload();
    reloadTotals();
  };

  const aplicarCambiosVendedor = async () => {
    if (!state.mesObjetivo || pendingChanges.size === 0) return;
    const changes = Array.from(pendingChanges.values()).map(({ row, crecStr }) => ({
      keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo, zona: row.zona, supervisor_id: row.supervisor_id, vendedor: row.vendedor },
      crecimiento: crecStr === "" ? null : Number(crecStr)
    }));
    await fetchWithAuth(API.PRESUPUESTO_ENRO.VENDEDOR.BASE, {
      method: "PATCH",
      body: JSON.stringify({ mes: state.mesObjetivo, changes })
    });
    setPendingChanges(new Map());
    reload();
    reloadTotals();
  };

  const handleCrecBlur = async (row: RowVendedor, crecStr: string) => {
    const key = `${row.proveedor_codigo}_${row.division_codigo}_${String(row.vendedor).trim()}`;
    const crecNum = crecStr === "" ? null : Number(crecStr);
    const newImporte = (crecNum !== null && row.objetivo_base_vendedor)
      ? String(Math.round(row.objetivo_base_vendedor * (1 + crecNum / 100)))
      : "";
    setEditValues(prev => ({ ...prev, [key]: { crec: crecStr, importe: newImporte } }));
    await saveCrec(row, crecStr);
  };

  const handleImporteBlur = async (row: RowVendedor, importeStr: string) => {
    if (!importeStr || !row.objetivo_base_vendedor) return;
    const importeNum = Number(importeStr);
    if (isNaN(importeNum) || importeNum <= 0) return;
    const crec = ((importeNum / row.objetivo_base_vendedor) - 1) * 100;
    const crecStr = parseFloat(crec.toFixed(4)).toString();
    const key = `${row.proveedor_codigo}_${row.division_codigo}_${String(row.vendedor).trim()}`;
    setEditValues(prev => ({ ...prev, [key]: { crec: crecStr, importe: importeStr } }));
    await saveCrec(row, crecStr);
  };


  // =====================================================
  // EXPORTAR EXCEL
  // =====================================================

  useEffect(() => {
    const handleExport = async (event: any) => {
      if (event.detail?.nivel !== "vendedor") return;
      if (!state.mesObjetivo) return;

      const soloFiltros: boolean = event.detail?.soloFiltros ?? false;

      const body = soloFiltros
        ? { mes: state.mesObjetivo, filtros: zonasSeleccionadas.length ? { zona: zonasSeleccionadas } : {}, pagination: { page: 1, pageSize: 999999 } }
        : { mes: state.mesObjetivo, pagination: { page: 1, pageSize: 999999 } };

      const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.VENDEDOR.QUERY, {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (!res.success) return;

      const data = await res.json();
      const exportRows: RowVendedor[] = data.data.rows;

      const vendedoresExp = soloFiltros
        ? [...vendedoresFiltrados]
        : Array.from(new Set(exportRows.map(r => String(r.vendedor).trim()))).sort();

      // @ts-ignore
      const ExcelJS = await import("exceljs");
      const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
      const HEADER_FONT = { name: "Arial", bold: true, size: 10, color: { argb: "FF1E3A5F" } };
      const CELL_FONT   = { name: "Arial", size: 10 };
      const MONEY_FMT   = '"$ "#,##0;[Red]"$ "(-#,##0);"-"';
      const PCT_FMT     = '0.00"%"';
      const bThin = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
      const bMed  = { style: "medium" as const, color: { argb: "FF6B7280" } };

      const INDIGO_H = "FFC7D2FE"; const INDIGO_H2 = "FFE0E7FF"; const INDIGO_C = "FFEEF2FF";
      const SKY_H = "FFBAE6FD"; const SKY_C = "FFE0F2FE";

      const wb = new ExcelJS.default.Workbook();
      const ws = wb.addWorksheet("Vendedor");

      const AMBER_TH_V = "FFFEF3C7"; const AMBER_TC_V = "FFFEF9C3";
      const totColStartV = 3 + vendedoresExp.length * 4;

      // Fila 1: Proveedor | División | [Vendedor colSpan4] ... | Total Proveedor (span3)
      // Fila 2: Crec % | BGT | VS MA | VS MPAA | ... | BGT Orig | BGT Final | Final - Orig
      const h1: any[] = ["Proveedor", "División"];
      vendedoresExp.forEach(v => {
        h1.push(`${v} - ${vendedoresMap[v] ?? ""}`);
        h1.push(""); h1.push(""); h1.push("");
      });
      h1.push("Total Proveedor"); h1.push(""); h1.push("");
      const hr1 = ws.addRow(h1);
      hr1.height = 22;
      vendedoresExp.forEach((_, vi) => {
        ws.mergeCells(1, 3 + vi * 4, 1, 6 + vi * 4);
      });
      ws.mergeCells(1, totColStartV, 1, totColStartV + 2);
      hr1.eachCell((cell: any, ci: number) => {
        const isTot = ci >= totColStartV;
        cell.font = HEADER_FONT; cell.fill = fill(ci <= 2 ? SKY_H : isTot ? AMBER_TH_V : INDIGO_H);
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      const h2: any[] = ["", ""];
      vendedoresExp.forEach(() => { h2.push("Crec %"); h2.push("BGT"); h2.push("VS MA"); h2.push("VS MPAA"); });
      h2.push("BGT Orig"); h2.push("BGT Final"); h2.push("Final - Orig");
      const hr2 = ws.addRow(h2);
      hr2.height = 18;
      hr2.eachCell((cell: any, ci: number) => {
        const isTot = ci >= totColStartV;
        cell.font = HEADER_FONT; cell.fill = fill(ci <= 2 ? SKY_H : isTot ? AMBER_TH_V : INDIGO_H2);
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
          vendedores: {} as Record<string, RowVendedor>
        };
        pivotMap[key].vendedores[String(r.vendedor).trim()] = r;
      });

      let grandBgtOrigV = 0; let grandBgtFinalV = 0;
      Object.values(pivotMap).forEach((item: any) => {
        const vals: any[] = [item.proveedor, item.division];
        let rowBgtOrig = 0; let rowBgtFinal = 0;
        vendedoresExp.forEach(v => {
          const d = item.vendedores[v];
          vals.push(d?.def_crec_vend ?? null);
          vals.push(d?.objetivo_vendedor ?? null);
          vals.push(d ? (d.obj_vs_mes_anterior ?? null) !== null ? (d.obj_vs_mes_anterior as number) * 100 : null : null);
          vals.push(d ? (d.obj_vs_mpaa ?? null) !== null ? (d.obj_vs_mpaa as number) * 100 : null : null);
          if (d) {
            rowBgtOrig  += d.objetivo_base_vendedor ?? 0;
            rowBgtFinal += d.objetivo_vendedor ?? 0;
          }
        });
        grandBgtOrigV  += rowBgtOrig;
        grandBgtFinalV += rowBgtFinal;
        vals.push(rowBgtOrig); vals.push(rowBgtFinal); vals.push(rowBgtFinal - rowBgtOrig);
        const dr = ws.addRow(vals);
        dr.height = 18;
        dr.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
          const isTot = ci >= totColStartV;
          const subCol = ci <= 2 ? -1 : isTot ? ci - totColStartV : (ci - 3) % 4;
          // subCol: 0=crec%,1=bgt,2=vsMA,3=vsMPAA
          cell.font = isTot ? { ...CELL_FONT, bold: true } : { ...CELL_FONT };
          cell.fill = fill(ci <= 2 ? SKY_C : isTot ? AMBER_TC_V : INDIGO_C);
          const isCenter = !isTot && subCol === 0;
          cell.alignment = { horizontal: ci <= 2 ? "left" : isCenter ? "center" : "right", vertical: "middle" };
          cell.border = { top: bThin, bottom: bThin, left: bThin, right: bThin };
          if (isTot) { if (cell.value !== null) cell.numFmt = MONEY_FMT; }
          else if (subCol === 1) { if (cell.value !== null) cell.numFmt = MONEY_FMT; }
          else if (subCol === 2 || subCol === 3) {
            cell.numFmt = PCT_FMT;
            if (cell.value !== null && typeof cell.value === "number")
              cell.font = { ...CELL_FONT, color: { argb: cell.value < 0 ? "FFDC2626" : "FF16A34A" } };
          }
        });
      });

      // Grand TOTAL row
      const gtrV = ws.addRow(["TOTAL", "", ...Array(vendedoresExp.length * 4).fill(null),
        grandBgtOrigV, grandBgtFinalV, grandBgtFinalV - grandBgtOrigV]);
      gtrV.height = 20;
      gtrV.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
        const isTot = ci >= totColStartV;
        cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = fill("FF1E293B");
        cell.alignment = { horizontal: ci <= 2 ? "left" : "right", vertical: "middle" };
        cell.border = { top: { style: "medium" as const, color: { argb: "FF475569" } }, bottom: bThin, left: bThin, right: bThin };
        if (isTot && cell.value !== null) cell.numFmt = MONEY_FMT;
      });

      ws.getColumn(1).width = 30; ws.getColumn(2).width = 22;
      ws.getColumn(totColStartV).width = 18;
      ws.getColumn(totColStartV + 1).width = 18;
      ws.getColumn(totColStartV + 2).width = 18;
      ws.views = [{ state: "frozen", xSplit: 2, ySplit: 2 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Presupuesto_vendedor_${state.mesObjetivo}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    };

    window.addEventListener("export-presupuesto", handleExport);
    return () => window.removeEventListener("export-presupuesto", handleExport);
  }, [state.mesObjetivo, proveedoresMap, divisionesMap, vendedoresMap, zonasSeleccionadas, vendedoresFiltrados]);

  // ================= TOTALES =================
  // Calculados desde dataAgrupada (misma fuente que las celdas visibles)
  // para garantizar consistencia entre totales y valores mostrados por fila.

  type VendedorTotal = { bgtOrig: number; bgtFinal: number; baseMA: number; objMA: number; baseMPAA: number; objMPAA: number };
  const [totals, setTotals] = useState<Record<string, VendedorTotal> | null>(null);

  const reloadTotals = useCallback(async () => {
    if (!state.mesObjetivo) return;

    const matchingCodes = busquedaDebounced.trim()
      ? catalogos.proveedores
          .filter(p => `${p.codigo} - ${p.nombre}`.toLowerCase().includes(busquedaDebounced.trim().toLowerCase()))
          .map(p => p.codigo)
      : [];

    const filtros: Record<string, any> = {};
    if (zonasSeleccionadas.length) filtros.zona = zonasSeleccionadas;
    if (matchingCodes.length) filtros.proveedor_codigo = matchingCodes;

    const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.VENDEDOR.QUERY, {
      method: "POST",
      body: JSON.stringify({
        mes: state.mesObjetivo,
        filtros,
        pagination: { page: 1, pageSize: 999999 }
      })
    });
    if (!res.success) return;
    const data = await res.json();
    const allRows: RowVendedor[] = data.data.rows;

    const map: Record<string, VendedorTotal> = {};
    const vSupMap: Record<string, Set<number>> = {};
    const vModMap: Record<string, Set<string>> = {};
    allRows.forEach(r => {
      const v = String(r.vendedor).trim();
      if (!map[v]) map[v] = { bgtOrig: 0, bgtFinal: 0, baseMA: 0, objMA: 0, baseMPAA: 0, objMPAA: 0 };
      const vt = map[v];
      vt.bgtOrig += r.objetivo_base_vendedor || 0;
      vt.bgtFinal += r.objetivo_vendedor || 0;
      // Base implícita: objetivo_vendedor = base * (1 + ratio) => base = objetivo_vendedor / (1 + ratio)
      if (r.obj_vs_mes_anterior !== null && r.obj_vs_mes_anterior !== undefined && (1 + r.obj_vs_mes_anterior) !== 0) {
        vt.baseMA += (r.objetivo_vendedor ?? 0) / (1 + r.obj_vs_mes_anterior);
        vt.objMA += r.objetivo_vendedor ?? 0;
      }
      if (r.obj_vs_mpaa !== null && r.obj_vs_mpaa !== undefined && (1 + r.obj_vs_mpaa) !== 0) {
        vt.baseMPAA += (r.objetivo_vendedor ?? 0) / (1 + r.obj_vs_mpaa);
        vt.objMPAA += r.objetivo_vendedor ?? 0;
      }
      if (!vSupMap[v]) vSupMap[v] = new Set();
      vSupMap[v].add(r.supervisor_id);
      if (r.supervisor) {
        if (!vModMap[v]) vModMap[v] = new Set();
        vModMap[v].add(r.supervisor);
      }
    });
    setTotals(map);

    const todos = Array.from(new Set(allRows.map(r => String(r.vendedor).trim()))).sort();
    setTodosVendedores(todos);
    setVendedorSupervisoresMap(
      Object.fromEntries(Object.entries(vSupMap).map(([v, s]) => [v, Array.from(s)]))
    );
    setVendedorModelosMap(
      Object.fromEntries(Object.entries(vModMap).map(([v, s]) => [v, Array.from(s)]))
    );
  }, [state.mesObjetivo, zonasSeleccionadas, busquedaDebounced, catalogos.proveedores]);

  useEffect(() => {
    reloadTotals();
  }, [reloadTotals]);

  const grandTotalAll = useMemo(() => {
    if (!totals) return { bgtOrig: 0, bgtFinal: 0 };
    let bgtOrig = 0, bgtFinal = 0;
    vendedoresFiltrados.forEach(v => {
      const t = totals[v];
      if (t) { bgtOrig += t.bgtOrig; bgtFinal += t.bgtFinal; }
    });
    return { bgtOrig, bgtFinal };
  }, [totals, vendedoresFiltrados]);

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

      {/* ================= ZONA DROPDOWN ================= */}

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

        <div className="relative" ref={zonaRef}>
          <button
            onClick={() => setMostrarZonas(!mostrarZonas)}
            className="px-3 py-1 border rounded bg-gray-100 min-w-[220px] text-left flex items-center justify-between gap-2"
          >
            <span>
              {zonasSeleccionadas.length === 0 || zonasSeleccionadas.length === zonasDisponibles.length
                ? "Todas las zonas"
                : zonasSeleccionadas.length === 1
                  ? zonasSeleccionadas[0]
                  : `${zonasSeleccionadas.length} zonas`}
            </span>
            <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
          </button>

          {mostrarZonas && (
            <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow max-h-80 overflow-auto w-80 resize both">

              <input
                type="text"
                placeholder="Buscar zona..."
                value={busquedaZona}
                onChange={(e) => setBusquedaZona(e.target.value)}
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
                      setZonasSeleccionadas([...zonasDisponibles]);
                    }
                    setPage(1);
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
                          prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]
                        );
                        setPage(1);
                      }}
                    />
                    {z}
                  </label>
                ))}

            </div>
          )}
        </div>

        {/* ================= SUPERVISOR DROPDOWN ================= */}

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
                  checked={supervisoresSeleccionados.length === supervisoresDisponibles.length}
                  onChange={() => {
                    if (supervisoresSeleccionados.length === supervisoresDisponibles.length) {
                      setSupervisoresSeleccionados([]);
                    } else {
                      setSupervisoresSeleccionados([...supervisoresDisponibles]);
                    }
                  }}
                />
                Seleccionar todos
              </label>

              {supervisoresDisponibles
                .filter(id =>
                  (supervisoresMap[id] ?? "")
                    .toLowerCase()
                    .includes(busquedaSupervisor.toLowerCase())
                )
                .map(id => (
                  <label key={id} className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={supervisoresSeleccionados.includes(id)}
                      onChange={() => {
                        setSupervisoresSeleccionados(prev =>
                          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                        );
                      }}
                    />
                    {supervisoresMap[id] ?? id}
                  </label>
                ))}

            </div>
          )}
        </div>

        {/* ================= MODELO ATENCION DROPDOWN ================= */}

        <div className="relative" ref={modelosRef}>
          <button
            onClick={() => setMostrarModelos(!mostrarModelos)}
            className="px-3 py-1 border rounded bg-gray-100 flex items-center gap-2"
          >
            Modelo Atencion
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {mostrarModelos && (
            <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow max-h-96 overflow-auto w-72 resize both">

              <input
                type="text"
                placeholder="Buscar modelo..."
                value={busquedaModelo}
                onChange={e => setBusquedaModelo(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm mb-3"
              />

              <label className="flex items-center gap-2 font-semibold text-sm mb-2">
                <input
                  type="checkbox"
                  checked={modelosSeleccionados.length === modelosDisponibles.length}
                  onChange={() => {
                    if (modelosSeleccionados.length === modelosDisponibles.length) {
                      setModelosSeleccionados([]);
                    } else {
                      setModelosSeleccionados([...modelosDisponibles]);
                    }
                  }}
                />
                Seleccionar todos
              </label>

              {modelosDisponibles
                .filter(m => m.toLowerCase().includes(busquedaModelo.toLowerCase()))
                .map(m => (
                  <label key={m} className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={modelosSeleccionados.includes(m)}
                      onChange={() => {
                        setModelosSeleccionados(prev =>
                          prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                        );
                      }}
                    />
                    {m}
                  </label>
                ))}

            </div>
          )}
        </div>

        {/* ================= SELECTOR COLUMNAS ================= */}

        <div className="relative" ref={columnasRef}>
          <button
            onClick={() => setMostrarColumnas(!mostrarColumnas)}
            className="px-3 py-1 border rounded bg-gray-100 flex items-center gap-2"
          >
            Vendedores
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {mostrarColumnas && (
            <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow max-h-96 overflow-auto w-96 resize both">

              <input
                type="text"
                placeholder="Buscar vendedor..."
                value={busquedaVendedor}
                onChange={(e) => setBusquedaVendedor(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm mb-3"
              />

              <label className="flex items-center gap-2 font-semibold text-sm mb-2">
                <input
                  type="checkbox"
                  checked={columnasVisibles.length === todosVendedores.length}
                  onChange={() => {
                    if (columnasVisibles.length === todosVendedores.length) {
                      setColumnasVisibles([]);
                    } else {
                      setColumnasVisibles(todosVendedores);
                    }
                  }}
                />
                Seleccionar todos
              </label>

              {vendedoresSelectorFiltrados.map(v => (
                <label key={v} className="flex items-center gap-2 text-sm mb-2">
                  <input
                    type="checkbox"
                    checked={columnasVisibles.includes(v)}
                    onChange={() => {
                      setColumnasVisibles(prev =>
                        prev.includes(v)
                          ? prev.filter(x => x !== v)
                          : [...prev, v]
                      );
                    }}
                  />
                  {v} - {vendedoresMap[v] ?? ""}
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
                <button onClick={aplicarCambiosVendedor} className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700">
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

      {/* ================= TABLA ================= */}

      <div className={fullscreen ? "overflow-auto flex-1 min-h-0 rounded-lg border shadow-sm" : "overflow-x-auto rounded-lg border shadow-sm"}>
        <table className="min-w-max table-fixed text-sm border-collapse">

          <thead className="sticky top-0 z-40 bg-white shadow-md">
            <tr>
              <th rowSpan={2} className="w-56 p-2 border bg-sky-100 sticky left-0 z-50">
                Proveedor
              </th>
              <th rowSpan={2} className="w-36 p-2 border bg-sky-100 sticky left-56 z-50">
                División
              </th>

              {vendedoresFiltrados.map(v => (
                <th
                  key={v}
                  colSpan={6}
                  className="p-2 border text-center font-semibold bg-indigo-200 border-r-4 border-slate-600"
                >
                  {v} - {vendedoresMap[v] ?? ""}
                </th>
              ))}

              <th
                colSpan={3}
                className={`p-2 border text-center font-semibold bg-amber-100 border-r-4 border-slate-600${totalFijo ? ' sticky right-0 z-50' : ''}`}
              >
                Total proveedor
              </th>
            </tr>

            <tr>
              {vendedoresFiltrados.map(v => (
                <Fragment key={`sub-${v}`}>
                  <th className="w-32 p-2 border border-slate-600 bg-indigo-50 text-center">
                    BGT Orig
                  </th>
                  <th className="w-24 p-2 border border-slate-600 bg-indigo-50 text-center">
                    Crec %
                  </th>
                  <th className="w-32 p-2 border border-slate-600 bg-indigo-50 text-center">
                    Crec $
                  </th>
                  <th className="w-32 p-2 border border-slate-600 bg-indigo-50 text-center">
                    BGT Final
                  </th>
                  <th className="w-32 p-2 border border-slate-600 bg-indigo-50 text-center">
                    VS MA
                  </th>
                  <th className="w-32 p-2 border border-r-4 border-slate-600 bg-indigo-50 text-center">
                    VS MPAA
                  </th>
                </Fragment>
              ))}
              <th className={`w-32 p-2 border border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-64 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>
                BGT Orig
              </th>
              <th className={`w-32 p-2 border border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-32 z-50' : ''}`}>
                BGT Final
              </th>
              <th className={`w-32 p-2 border border-r-4 border-slate-600 bg-amber-50 text-center${totalFijo ? ' sticky right-0 z-50' : ''}`}>
                Final - Orig
              </th>
            </tr>
          </thead>

          <tbody>
            {(loading || catalogosLoading) ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 2 + vendedoresFiltrados.length * 6 + 3 }).map((_, j) => (
                    <td key={j} className="p-2 border">
                      <div className="h-4 bg-slate-200 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <>
                {grouped.map((group: any[], gi: number) => {
                  const subtotalBgtOrig = vendedoresFiltrados.reduce(
                    (sum, v) => sum + group.reduce((s, r) => s + (r.vendedores[v]?.objetivo_base_vendedor || 0), 0), 0
                  );
                  const subtotalBgtFinal = vendedoresFiltrados.reduce(
                    (sum, v) => sum + group.reduce((s, r) => s + (r.vendedores[v]?.objetivo_vendedor || 0), 0), 0
                  );

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
                          {vendedoresFiltrados.map(v => {
                            const subOrig = group.reduce((s, r) => s + (r.vendedores[v]?.objetivo_base_vendedor || 0), 0);
                            const subFinal = group.reduce((s, r) => s + (r.vendedores[v]?.objetivo_vendedor || 0), 0);
                            const subCrecAcum = subOrig > 0 ? ((subFinal / subOrig) - 1) * 100 : null;
                            return (
                              <Fragment key={`subv-${v}`}>
                                <td className="p-2 border border-slate-600 text-right bg-indigo-50/40 font-medium">
                                  {fmt(subOrig)}
                                </td>
                                <td className="p-2 border border-slate-600 text-center font-medium text-slate-700">
                                  {subCrecAcum !== null ? `${subCrecAcum.toFixed(2)} %` : "—"}
                                </td>
                                <td className="p-2 border border-slate-600 text-center text-slate-400">—</td>
                                <td className="p-2 border text-right border-slate-600">
                                  {fmt(subFinal)}
                                </td>
                                <td className="p-2 border border-slate-600 text-center text-slate-400">—</td>
                                <td className="p-2 border text-center border-r-4 border-slate-600 text-slate-400">—</td>
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
                        const rowBgtOrigTotal = vendedoresFiltrados.reduce(
                          (sum, v) => sum + (row.vendedores[v]?.objetivo_base_vendedor || 0), 0
                        );
                        const rowBgtFinalTotal = vendedoresFiltrados.reduce(
                          (sum, v) => sum + (row.vendedores[v]?.objetivo_vendedor || 0), 0
                        );

                        return (
                          <tr key={i} className="hover:bg-slate-100">

                            <td className="w-56 p-2 border bg-sky-50 sticky left-0 z-20">
                              {proveedoresMap[row.proveedor_codigo]}
                            </td>

                            <td className="w-36 p-2 border bg-sky-50 sticky left-56 z-20">
                              {divisionesMap[row.division_codigo]}
                            </td>

                            {vendedoresFiltrados.map(v => {
                              const data = row.vendedores[v];
                              const inputKey = data
                                ? `${data.proveedor_codigo}_${data.division_codigo}_${v}`
                                : null;
                              const editVal = inputKey
                                ? (editValues[inputKey] ?? { crec: "", importe: "" })
                                : null;
                              const pendingKey = data
                                ? `${data.proveedor_codigo}_${data.division_codigo}_${data.zona}_${data.supervisor_id}_${String(data.vendedor).trim()}`
                                : null;
                              const vendDirty = pendingKey ? pendingChanges.has(pendingKey) : false;

                              return (
                                <Fragment key={`${v}-${i}`}>
                                  <td className="p-2 border border-slate-600 text-right bg-indigo-50/40">
                                    {data ? fmt(data.objetivo_base_vendedor) : "-"}
                                  </td>

                                  <td className={`p-2 border border-slate-600 text-center ${vendDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : ""}`}>
                                    {data && inputKey ? (
                                      <Input
                                        type="number"
                                        disabled={readonly}
                                        value={editVal?.crec ?? ""}
                                        onChange={e => { if (!readonly) setEditValues(prev => ({ ...prev, [inputKey]: { ...prev[inputKey], crec: e.target.value } })); }}
                                        className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${readonly ? "opacity-50 cursor-not-allowed" : ""}`}
                                        onBlur={e => { if (!readonly) handleCrecBlur(data, e.target.value); }}
                                      />
                                    ) : "-"}
                                  </td>

                                  <td className={`p-2 border border-slate-600 text-center ${vendDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : ""}`}>
                                    {data && inputKey ? (
                                      <Input
                                        type="text"
                                        disabled={readonly}
                                        value={
                                          focusedImporte === inputKey
                                            ? (editVal?.importe ?? "")
                                            : (editVal?.importe ? fmt(Number(editVal.importe)) : "")
                                        }
                                        onFocus={() => { if (!readonly) setFocusedImporte(inputKey); }}
                                        onChange={e => {
                                          if (readonly) return;
                                          const raw = e.target.value.replace(/[^0-9-]/g, "");
                                          setEditValues(prev => ({ ...prev, [inputKey]: { ...prev[inputKey], importe: raw } }));
                                        }}
                                        className={`hover:bg-slate-100 focus-within:bg-blue-50 transition-colors bg-white ${readonly ? "opacity-50 cursor-not-allowed" : ""}`}
                                        onBlur={() => {
                                          setFocusedImporte(null);
                                          if (!readonly) handleImporteBlur(data, editVal?.importe ?? "");
                                        }}
                                      />
                                    ) : "-"}
                                  </td>

                                  <td className="p-2 border text-right border-slate-600">
                                    {data ? fmt(data.objetivo_vendedor) : "-"}
                                  </td>

                                  <td className={`p-2 border border-slate-600 text-right ${pctColor(data?.obj_vs_mes_anterior)}`}>
                                    {data ? pct(data.obj_vs_mes_anterior) : "-"}
                                  </td>

                                  <td className={`p-2 border border-r-4 border-slate-600 text-right ${pctColor(data?.obj_vs_mpaa)}`}>
                                    {data ? pct(data.obj_vs_mpaa) : "-"}
                                  </td>
                                </Fragment>
                              );
                            })}

                            <td className={`p-2 border border-slate-600 text-right bg-amber-50 font-medium${totalFijo ? ' sticky right-64 z-30 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>
                              {fmt(rowBgtOrigTotal)}
                            </td>
                            <td className={`p-2 border border-slate-600 text-right bg-amber-50 font-medium${totalFijo ? ' sticky right-32 z-30' : ''}`}>
                              {fmt(rowBgtFinalTotal)}
                            </td>
                            <td className={`p-2 border border-r-4 border-slate-600 text-right bg-amber-50 font-medium ${rowBgtFinalTotal - rowBgtOrigTotal < 0 ? "text-red-600" : "text-slate-700"}${totalFijo ? ' sticky right-0 z-30' : ''}`}>
                              {fmtDiff(rowBgtFinalTotal - rowBgtOrigTotal)}
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
              <td className="w-56 p-2 border border-slate-600 bg-slate-800 sticky left-0 z-50 uppercase tracking-wide">
                TOTAL
              </td>
              <td className="w-36 p-2 border border-slate-600 bg-slate-800 sticky left-56 z-50" />

              {vendedoresFiltrados.map(v => {
                const vt = totals?.[v];
                const crecPct = vt && vt.bgtOrig > 0 ? ((vt.bgtFinal / vt.bgtOrig) - 1) * 100 : null;
                const maPct = vt && vt.baseMA > 0 ? ((vt.objMA / vt.baseMA) - 1) * 100 : null;
                const mpaaPct = vt && vt.baseMPAA > 0 ? ((vt.objMPAA / vt.baseMPAA) - 1) * 100 : null;
                return (
                  <Fragment key={`total-${v}`}>
                    <td className="p-2 border border-slate-600 bg-slate-700 text-right">
                      {vt ? fmt(vt.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="p-2 border border-slate-600 bg-slate-700 text-center">
                      {vt ? (crecPct !== null ? `${crecPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="p-2 border border-slate-600 bg-slate-700 text-right">
                      {vt ? fmtDiff(vt.bgtFinal - vt.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="p-2 border border-slate-600 bg-slate-700 text-right">
                      {vt ? fmt(vt.bgtFinal) : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="p-2 border border-slate-600 bg-slate-700 text-center">
                      {vt ? (maPct !== null ? `${maPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                    <td className="p-2 border border-r-4 border-slate-600 bg-slate-700 text-center">
                      {vt ? (mpaaPct !== null ? `${mpaaPct.toFixed(2)} %` : "—") : <span className="text-slate-400 text-xs">…</span>}
                    </td>
                  </Fragment>
                );
              })}

              <td className={`w-32 p-2 border border-slate-600 bg-slate-700 text-right${totalFijo ? ' sticky right-64 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>
                {totals ? fmt(grandTotalAll.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
              </td>
              <td className={`w-32 p-2 border border-slate-600 bg-slate-700 text-right${totalFijo ? ' sticky right-32 z-50' : ''}`}>
                {totals ? fmt(grandTotalAll.bgtFinal) : <span className="text-slate-400 text-xs">…</span>}
              </td>
              <td className={`w-32 p-2 border border-r-4 border-slate-600 bg-slate-700 text-right ${grandTotalAll.bgtFinal - grandTotalAll.bgtOrig < 0 ? "text-red-300" : "text-white"}${totalFijo ? ' sticky right-0 z-50' : ''}`}>
                {totals ? fmtDiff(grandTotalAll.bgtFinal - grandTotalAll.bgtOrig) : <span className="text-slate-400 text-xs">…</span>}
              </td>
            </tr>
          </tfoot>

        </table>
      </div>

      {/* PAGINADOR */}

      <div className="flex justify-center items-center gap-4 text-sm font-medium mt-4">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1 rounded-md border disabled:opacity-40"
        >
          ◀
        </button>

        <span>
          Página {page} de {totalPages}
        </span>

        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1 rounded-md border disabled:opacity-40"
        >
          ▶
        </button>
      </div>

    </div>
  );
}
