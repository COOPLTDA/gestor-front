import { useEffect, useState, useMemo, Fragment, useRef } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { usePresupuesto } from "@/contexts/PresupuestoEnroContext";
import { useCatalogos, useCatalogosState } from "@/contexts/CatalogosContext";
import { API } from "@/constants/api";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";

type RowCliente = {
  proveedor_codigo: number;
  division_codigo: number;
  zona: string;
  supervisor_id: number;
  vendedor: string;
  cliente_id: string;
  codigo_canal: number;
  canal: string;
  def_crec_cliente: number | null;
  objetivo_base: number;
  objetivo_cliente: number;
};

type EditCell = { crec: string; importe: string };

const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const fmtDiff = (n: number) => {
  const abs = `$ ${Math.abs(Math.round(n)).toLocaleString("es-AR")}`;
  return n < 0 ? `-${abs}` : abs;
};

export default function ClienteTab({ readonly = false }: { readonly?: boolean }) {

  const { state, dispatch } = usePresupuesto();
  const modoGuardado = state.modoGuardado;
  const catalogos = useCatalogos();
  const { loading: catalogosLoading } = useCatalogosState();

  const [rows, setRows] = useState<RowCliente[]>([]);
  const [allRows, setAllRows] = useState<RowCliente[]>([]);
  const [allRowsTick, setAllRowsTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editValues, setEditValues] = useState<Record<string, EditCell>>({});
  const [focusedImporte, setFocusedImporte] = useState<string | null>(null);

  type PendingCliente = { row: RowCliente; crecStr: string };
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCliente>>(new Map());

  const [zonas, setZonas] = useState<string[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);

  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<string[]>([]);
  const [vendedoresSeleccionados, setVendedoresSeleccionados] = useState<string[]>([]);
  const [canalesSeleccionados, setCanalesSeleccionados] = useState<string[]>([]);

  const [totalFijo, setTotalFijo] = useState(() => localStorage.getItem('pres-total-fijo') === '1');
  const [mostrarZonas, setMostrarZonas] = useState(false);
  const [mostrarVendedores, setMostrarVendedores] = useState(false);
  const [mostrarCanales, setMostrarCanales] = useState(false);
  const [mostrarColumnas, setMostrarColumnas] = useState(false);
  const zonaRef = useRef<HTMLDivElement>(null);
  const vendedorRef = useRef<HTMLDivElement>(null);
  const canalesRef = useRef<HTMLDivElement>(null);
  const columnasRef = useRef<HTMLDivElement>(null);

  const [busquedaZona, setBusquedaZona] = useState("");
  const [busquedaVendedor, setBusquedaVendedor] = useState("");
  const [busquedaCanal, setBusquedaCanal] = useState("");
  const [busquedaColumna, setBusquedaColumna] = useState("");

  const [columnasVisibles, setColumnasVisibles] = useState<string[]>([]);
  const columnasVistasPrevRef = useRef<Set<string>>(new Set());

  const pageSize = state.pageSize;
  const fullscreen = state.fullscreen;

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ===============================
  // CARGA INICIAL
  // ===============================

  useEffect(() => {
    const load = async () => {

      const filtrosRes = await fetchWithAuth(API.PRESUPUESTO_ENRO.CLIENTE.FILTROS);
      if (filtrosRes.success) {
        const data = await filtrosRes.json();

        const zonasData = data.data.zonas.map((z: any) => z.zona);
        const vendedoresData = data.data.vendedores;

        setZonas(zonasData);
        setVendedores(vendedoresData);
      }

    };

    load();
  }, []);

  // ===============================
  // RELOAD
  // ===============================

  const reload = async () => {

    if (!state.mesObjetivo) return;

    setLoading(true);

    const filtros: any = {};

    if (zonasSeleccionadas.length > 0) {
      filtros.zona = zonasSeleccionadas;
    }

    if (vendedoresSeleccionados.length > 0) {
      filtros.vendedor = vendedoresSeleccionados;
    }

    const res = await fetchWithAuth(
      API.PRESUPUESTO_ENRO.CLIENTE.QUERY,
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
      setRows(data.data.rows || []);
      setTotalPages(data.data.pagination?.totalPages || 1);
    } else {
      setRows([]);
    }

    setLoading(false);
    window.dispatchEvent(new CustomEvent("presupuesto-tab-loaded"));
  };

  // Restore or auto-select zones when period or available zones change
  useEffect(() => {
    if (!state.mesObjetivo || zonas.length === 0) return;
    const storageKey = `pres-cliente-zonas-${state.mesObjetivo}`;
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
  }, [state.mesObjetivo, zonas]);

  // Persist zone selection per period
  useEffect(() => {
    if (!state.mesObjetivo || zonas.length === 0) return;
    localStorage.setItem(`pres-cliente-zonas-${state.mesObjetivo}`, JSON.stringify(zonasSeleccionadas));
  }, [zonasSeleccionadas, state.mesObjetivo, zonas.length]);

  // Restore or auto-select first vendor when period, available vendors, or zones change
  useEffect(() => {
    if (!state.mesObjetivo || vendedores.length === 0) return;
    const available = vendedores.filter(v => !zonasSeleccionadas.length || zonasSeleccionadas.includes(v.zona));
    if (available.length === 0) return;

    const storageKey = `pres-cliente-vendedores-${state.mesObjetivo}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed: string[] = JSON.parse(saved);
        const valid = parsed.filter(v => available.some((a: any) => a.vendedor === v));
        setVendedoresSeleccionados(valid.length > 0 ? valid : [available[0].vendedor]);
      } catch {
        setVendedoresSeleccionados([available[0].vendedor]);
      }
    } else {
      setVendedoresSeleccionados([available[0].vendedor]);
    }
  }, [state.mesObjetivo, vendedores, zonasSeleccionadas]);

  // Persist vendor selection per period
  useEffect(() => {
    if (!state.mesObjetivo) return;
    localStorage.setItem(`pres-cliente-vendedores-${state.mesObjetivo}`, JSON.stringify(vendedoresSeleccionados));
  }, [vendedoresSeleccionados, state.mesObjetivo]);

  useEffect(() => {
    reload();
  }, [state.mesObjetivo, zonasSeleccionadas, vendedoresSeleccionados, page, pageSize]);

  // Fetch all rows (sin paginar) para calcular totales por columna
  useEffect(() => {
    if (!state.mesObjetivo) return;

    // Evitar que una respuesta lenta de un fetch anterior pise datos más recientes
    let cancelled = false;

    const filtros: any = {};
    if (zonasSeleccionadas.length > 0) filtros.zona = zonasSeleccionadas;
    if (vendedoresSeleccionados.length > 0) filtros.vendedor = vendedoresSeleccionados;

    fetchWithAuth(API.PRESUPUESTO_ENRO.CLIENTE.QUERY, {
      method: "POST",
      body: JSON.stringify({
        mes: state.mesObjetivo,
        filtros,
        pagination: { page: 1, pageSize: 999999 }
      })
    }).then(async res => {
      if (cancelled) return;
      if (res.success) {
        const data = await res.json() as any;
        if (!cancelled) setAllRows(data.data.rows || []);
      }
    });

    return () => { cancelled = true; };
  }, [state.mesObjetivo, zonasSeleccionadas, vendedoresSeleccionados, allRowsTick]);

  // ===============================
  // EDIT VALUES (inputs controlados)
  // ===============================

  useEffect(() => {
    const newVals: Record<string, EditCell> = {};
    rows.forEach(row => {
      const key = `${row.cliente_id}_${row.proveedor_codigo}-${row.division_codigo}`;
      const crec = row.def_crec_cliente !== null ? String(row.def_crec_cliente) : "";
      const importe = crec !== "" && row.objetivo_base
        ? String(Math.round(row.objetivo_base * (1 + Number(crec) / 100)))
        : "";
      newVals[key] = { crec, importe };
    });
    setEditValues(prev => ({ ...prev, ...newVals }));
  }, [rows]);

  // ===============================
  // GUARDAR
  // ===============================

  const guardarCrecimiento = async (row: RowCliente, nuevoValor: string) => {

    if (!state.mesObjetivo) return;

    const valorNumerico = nuevoValor === "" ? null : Number(nuevoValor);
    const changeKey = `${row.cliente_id}_${row.proveedor_codigo}_${row.division_codigo}`;

    if (modoGuardado === "manual") {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(changeKey, { row, crecStr: nuevoValor });
        return next;
      });
      return;
    }

    await fetchWithAuth(API.PRESUPUESTO_ENRO.CLIENTE.BASE, {
      method: "PATCH",
      body: JSON.stringify({
        mes: state.mesObjetivo,
        changes: [{ keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo, zona: row.zona, supervisor_id: row.supervisor_id, vendedor: row.vendedor, cliente_id: row.cliente_id }, crecimiento: valorNumerico }]
      })
    });

    reload();
    setAllRowsTick(t => t + 1);
  };

  const aplicarCambiosCliente = async () => {
    if (!state.mesObjetivo || pendingChanges.size === 0) return;
    const changes = Array.from(pendingChanges.values()).map(({ row, crecStr }) => ({
      keys: { proveedor_codigo: row.proveedor_codigo, division_codigo: row.division_codigo, zona: row.zona, supervisor_id: row.supervisor_id, vendedor: row.vendedor, cliente_id: row.cliente_id },
      crecimiento: crecStr === "" ? null : Number(crecStr)
    }));
    await fetchWithAuth(API.PRESUPUESTO_ENRO.CLIENTE.BASE, {
      method: "PATCH",
      body: JSON.stringify({ mes: state.mesObjetivo, changes })
    });
    setPendingChanges(new Map());
    reload();
    setAllRowsTick(t => t + 1);
  };

  const handleCrecBlur = async (row: RowCliente, crecStr: string) => {
    const key = `${row.cliente_id}_${row.proveedor_codigo}-${row.division_codigo}`;
    const crecNum = crecStr === "" ? null : Number(crecStr);
    const newImporte = (crecNum !== null && row.objetivo_base)
      ? String(Math.round(row.objetivo_base * (1 + crecNum / 100)))
      : "";
    setEditValues(prev => ({ ...prev, [key]: { crec: crecStr, importe: newImporte } }));
    await guardarCrecimiento(row, crecStr);
  };

  const handleImporteBlur = async (row: RowCliente, importeStr: string) => {
    if (!importeStr || !row.objetivo_base) return;
    const importeNum = Number(importeStr);
    if (isNaN(importeNum) || importeNum <= 0) return;
    const crec = ((importeNum / row.objetivo_base) - 1) * 100;
    const crecStr = parseFloat(crec.toFixed(4)).toString();
    const key = `${row.cliente_id}_${row.proveedor_codigo}-${row.division_codigo}`;
    setEditValues(prev => ({ ...prev, [key]: { crec: crecStr, importe: importeStr } }));
    await guardarCrecimiento(row, crecStr);
  };

  // ===============================
  // CERRAR DROPDOWNS AL HACER CLICK AFUERA
  // ===============================

  useEffect(() => {

    const handleClickOutside = (event: MouseEvent) => {

      const target = event.target as Node;

      if (zonaRef.current && !zonaRef.current.contains(target)) {
        setMostrarZonas(false);
      }

      if (vendedorRef.current && !vendedorRef.current.contains(target)) {
        setMostrarVendedores(false);
      }

      if (canalesRef.current && !canalesRef.current.contains(target)) {
        setMostrarCanales(false);
      }

      if (columnasRef.current && !columnasRef.current.contains(target)) {
        setMostrarColumnas(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };

  }, []);

  // ===============================
  // vendedores filtrados por zona
  // ===============================

  const vendedoresFiltrados = vendedores
    .filter(v => !zonasSeleccionadas.length || zonasSeleccionadas.includes(v.zona))
    .filter(v =>
      `${v.vendedor} ${v.nombre}`
        .toLowerCase()
        .includes(busquedaVendedor.toLowerCase())
    );

  // ===============================
  // CANALES DISPONIBLES (de allRows)
  // ===============================

  const canalesDisponibles = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach(r => { if (r.canal) set.add(r.canal); });
    return Array.from(set).sort();
  }, [allRows]);

  const canalesFiltrados = canalesDisponibles.filter(c =>
    c.toLowerCase().includes(busquedaCanal.toLowerCase())
  );

  // ===============================
  // COLUMNAS
  // ===============================

  // Resetear canales cuando cambia el vendedor (evita valores viejos de Tipo PDV)
  useEffect(() => {
    setCanalesSeleccionados([]);
  }, [vendedoresSeleccionados]);

  const columnas = useMemo(() => {

    const map = new Map<string, any>();

    // Usar allRows en lugar de rows paginadas para que las columnas sean estables entre páginas
    allRows.forEach(r => {

      const key = `${r.proveedor_codigo}-${r.division_codigo}`;

      if (!map.has(key)) {

        const prov = catalogos.proveedores.find((p: any) => Number(p.codigo) === Number(r.proveedor_codigo));
        const div = catalogos.divisiones.find((d: any) => Number(d.codigo) === Number(r.division_codigo));

        map.set(key, {
          proveedor_codigo: r.proveedor_codigo,
          division_codigo: r.division_codigo,
          proveedor_nombre: prov?.nombre ?? r.proveedor_codigo,
          division_nombre: div?.nombre ?? r.division_codigo
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.proveedor_codigo !== b.proveedor_codigo) {
        return a.proveedor_codigo - b.proveedor_codigo;
      }
      return a.division_codigo - b.division_codigo;
    });

  }, [allRows, catalogos.proveedores, catalogos.divisiones]);

  useEffect(() => {
    const keys = columnas.map(
      c => `${c.proveedor_codigo}-${c.division_codigo}`
    );
    // Columnas nuevas que nunca fueron vistas: se agregan como visibles por defecto.
    // Columnas que el usuario ocultó manualmente (estaban en vistas pero no en prev) se respetan.
    const seen = columnasVistasPrevRef.current;
    const brandNew = keys.filter(k => !seen.has(k));
    keys.forEach(k => seen.add(k));
    setColumnasVisibles(prev => {
      if (prev.length === 0) return keys;
      const valid = prev.filter(k => keys.includes(k));
      return [...valid, ...brandNew];
    });
  }, [columnas]);

  const columnasFiltradas = columnas.filter(col =>
    columnasVisibles.includes(`${col.proveedor_codigo}-${col.division_codigo}`)
  );

  const columnasSelectorFiltradas = columnas.filter(col =>
    `${col.proveedor_codigo} ${col.proveedor_nombre} ${col.division_nombre}`
      .toLowerCase()
      .includes(busquedaColumna.toLowerCase())
  );

  // Resetear página al cambiar filtro de canal
  useEffect(() => {
    setPage(1);
  }, [canalesSeleccionados]);

  // ===============================
  // FILAS FILTRADAS POR CANAL (client-side)
  // ===============================

  const rowsFiltrados = useMemo(() => {
    if (canalesSeleccionados.length === 0) return rows;
    return allRows.filter(r => canalesSeleccionados.includes(r.canal));
  }, [rows, allRows, canalesSeleccionados]);

  // ===============================
  // AGRUPADO
  // ===============================

  const dataAgrupada = useMemo(() => {

    const map: Record<string, any> = {};

    rowsFiltrados.forEach(r => {

      if (!map[r.cliente_id]) {

        const cli = catalogos.clientes.find(
          c => Number(c.id) === Number(r.cliente_id)
        );

        map[r.cliente_id] = {
          cliente_id: r.cliente_id,
          cliente_nombre: cli?.nombre || r.cliente_id,
          canal: r.canal,
          data: {}
        };
      }

      const key = `${r.proveedor_codigo}-${r.division_codigo}`;
      map[r.cliente_id].data[key] = r;
    });

    return Object.values(map);

  }, [rowsFiltrados, catalogos.clientes]);

  // Totales por columna proveedor-division
  const totalesPorColumna = useMemo(() => {
    const map: Record<string, { bgtOrig: number; bgtFinal: number }> = {};
    const filtered = canalesSeleccionados.length > 0
      ? allRows.filter(r => canalesSeleccionados.includes(r.canal))
      : allRows;
    filtered.forEach(r => {
      const key = `${r.proveedor_codigo}-${r.division_codigo}`;
      if (!map[key]) map[key] = { bgtOrig: 0, bgtFinal: 0 };
      map[key].bgtOrig += r.objetivo_base != null ? r.objetivo_base : 0;
      map[key].bgtFinal += r.objetivo_cliente ?? 0;
    });
    return map;
  }, [allRows, canalesSeleccionados]);

  const grandTotal = useMemo(() => {
    let bgtOrig = 0, bgtFinal = 0;
    columnasFiltradas.forEach(col => {
      const key = `${col.proveedor_codigo}-${col.division_codigo}`;
      bgtOrig += totalesPorColumna[key]?.bgtOrig ?? 0;
      bgtFinal += totalesPorColumna[key]?.bgtFinal ?? 0;
    });
    return { bgtOrig, bgtFinal };
  }, [totalesPorColumna, columnasFiltradas]);

  // =====================================================
  // EXPORTAR EXCEL
  // =====================================================

  useEffect(() => {
    const handleExport = async (event: any) => {
      if (event.detail?.nivel !== "cliente") return;
      if (!state.mesObjetivo) return;

      const filtros: any = {};
      if (zonasSeleccionadas.length > 0) filtros.zona = zonasSeleccionadas;
      if (vendedoresSeleccionados.length > 0) filtros.vendedor = vendedoresSeleccionados;

      const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.CLIENTE.QUERY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: state.mesObjetivo, filtros, pagination: { page: 1, pageSize: 999999 } })
      });
      if (!res.success) return;

      const data = await res.json();
      let exportRows: RowCliente[] = data.data.rows;

      // Aplicar filtro de canal (Tipo PDV) si hay selección
      if (canalesSeleccionados.length > 0) {
        exportRows = exportRows.filter(r => canalesSeleccionados.includes(r.canal));
      }

      // columnas únicas proveedor-division respetando columnasFiltradas (proveedores visibles)
      const colKeysVisible = new Set(columnasFiltradas.map(c => `${c.proveedor_codigo}-${c.division_codigo}`));
      const colKeys = Array.from(
        new Set(exportRows.map(r => `${r.proveedor_codigo}-${r.division_codigo}`))
      ).filter(k => colKeysVisible.size === 0 || colKeysVisible.has(k)).sort();

      // @ts-ignore
      const ExcelJS = await import("exceljs");
      const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
      const HEADER_FONT = { name: "Arial", bold: true, size: 10, color: { argb: "FF1E3A5F" } };
      const CELL_FONT   = { name: "Arial", size: 10 };
      const MONEY_FMT   = '"$ "#,##0;[Red]"$ "(-#,##0);"-"';
      const bThin = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
      const bMed  = { style: "medium" as const, color: { argb: "FF6B7280" } };

      const TEAL_H = "FF99F6E4"; const TEAL_H2 = "FFCCFBF1"; const TEAL_C = "FFF0FDF4";
      const SKY_H = "FFBAE6FD"; const SKY_C = "FFE0F2FE";

      const wb = new ExcelJS.default.Workbook();
      const ws = wb.addWorksheet("Cliente");

      // Fila 1: Cliente | Tipo PDV | Vendedor | [Prov-Div colSpan4] ...
      // Fila 2: BGT Orig | Crec % | Crec $ | BGT Final
      const h1: any[] = ["Cliente", "Tipo PDV", "Vendedor"];
      colKeys.forEach(ck => {
        const [pCod, dCod] = ck.split("-");
        const pNom = catalogos.proveedores.find((p: any) => String(p.codigo) === pCod)?.nombre ?? pCod;
        const dNom = catalogos.divisiones.find((d: any) => String(d.codigo) === dCod)?.nombre ?? dCod;
        h1.push(`${pCod} ${pNom} / ${dCod} ${dNom}`);
        h1.push(""); h1.push(""); h1.push("");
      });
      const hr1 = ws.addRow(h1);
      hr1.height = 24;
      colKeys.forEach((_, ci) => {
        ws.mergeCells(1, 4 + ci * 4, 1, 7 + ci * 4);
      });
      hr1.eachCell((cell: any, ci: number) => {
        cell.font = HEADER_FONT; cell.fill = fill(ci <= 3 ? SKY_H : TEAL_H);
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      const h2: any[] = ["", "", ""];
      colKeys.forEach(() => { h2.push("BGT Orig"); h2.push("Crec %"); h2.push("Crec $"); h2.push("BGT Final"); });
      const hr2 = ws.addRow(h2);
      hr2.height = 18;
      hr2.eachCell((cell: any, ci: number) => {
        cell.font = HEADER_FONT; cell.fill = fill(ci <= 3 ? SKY_H : TEAL_H2);
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      // pivot: cliente_id + vendedor → row por columna
      const pivotMap: Record<string, any> = {};
      exportRows.forEach(r => {
        const key = `${r.cliente_id}_${r.vendedor}`;
        if (!pivotMap[key]) {
          const clienteObj = catalogos.clientes.find((c: any) => Number(c.id) === Number(r.cliente_id));
          pivotMap[key] = {
            cliente: `${r.cliente_id} - ${clienteObj?.nombre?.trim() ?? ""}`,
            canal: r.canal ?? "",
            vendedor: r.vendedor,
            cols: {} as Record<string, RowCliente>
          };
        }
        pivotMap[key].cols[`${r.proveedor_codigo}-${r.division_codigo}`] = r;
      });

      Object.values(pivotMap).forEach((item: any) => {
        const vals: any[] = [item.cliente, item.canal, item.vendedor];
        colKeys.forEach(ck => {
          const d = item.cols[ck];
          vals.push(d?.objetivo_base ?? null);
          vals.push(d?.def_crec_cliente ?? null);
          const importe = (d?.def_crec_cliente != null && d?.objetivo_base)
            ? Math.round(d.objetivo_base * (1 + d.def_crec_cliente / 100))
            : null;
          vals.push(importe);
          vals.push(d?.objetivo_cliente ?? null);
        });
        const dr = ws.addRow(vals);
        dr.height = 18;
        dr.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
          const subCol = ci <= 3 ? -1 : (ci - 4) % 4;
          cell.font = { ...CELL_FONT };
          cell.fill = fill(ci <= 3 ? SKY_C : TEAL_C);
          cell.alignment = { horizontal: ci <= 3 ? "left" : subCol === 1 ? "center" : "right", vertical: "middle" };
          cell.border = { top: bThin, bottom: bThin, left: bThin, right: bThin };
          if (subCol === 0 || subCol === 2 || subCol === 3) cell.numFmt = MONEY_FMT;
        });
      });

      ws.getColumn(1).width = 30; ws.getColumn(2).width = 16; ws.getColumn(3).width = 18;
      ws.views = [{ state: "frozen", xSplit: 3, ySplit: 2 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Presupuesto_cliente_${state.mesObjetivo}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    };

    window.addEventListener("export-presupuesto", handleExport);
    return () => window.removeEventListener("export-presupuesto", handleExport);
  }, [state.mesObjetivo, catalogos, zonasSeleccionadas, vendedoresSeleccionados, canalesSeleccionados, columnasFiltradas]);

  if (loading || catalogosLoading) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-10 flex items-center justify-center gap-3 text-slate-500">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>Cargando datos...</span>
      </div>
    );
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-[60] bg-white flex flex-col p-4 gap-4" : "space-y-4"}>

      {/* FILTROS SUPERIORES */}

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

        {/* ================= ZONA (múltiple) ================= */}
        <div className="relative" ref={zonaRef}>
          <button
            onClick={() => setMostrarZonas(!mostrarZonas)}
            className="px-3 py-1 border rounded bg-gray-100 min-w-[220px] text-left flex items-center justify-between gap-2"
          >
            <span>
              {zonasSeleccionadas.length === 0 || zonasSeleccionadas.length === zonas.length
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
                  checked={zonasSeleccionadas.length === zonas.length}
                  onChange={() => {
                    if (zonasSeleccionadas.length === zonas.length) {
                      setZonasSeleccionadas([]);
                    } else {
                      setZonasSeleccionadas([...zonas]);
                    }
                    setPage(1);
                  }}
                />
                Seleccionar todas
              </label>

              {zonas
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

        {/* ================= VENDEDOR ================= */}
        <div className="relative" ref={vendedorRef}>
          <button
            onClick={() => setMostrarVendedores(!mostrarVendedores)}
            className="px-3 py-1 border rounded bg-gray-100 min-w-[260px] text-left flex items-center justify-between gap-2"
          >
            <span>{vendedoresSeleccionados.length === 0
              ? "Todos los vendedores"
              : vendedoresSeleccionados.length === 1
                ? vendedoresSeleccionados[0]
                : "Múltiples Vendedores"}</span>
            <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
          </button>

          {mostrarVendedores && (
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
                  checked={
                    vendedoresFiltrados.length > 0 &&
                    vendedoresSeleccionados.length === vendedoresFiltrados.length
                  }
                  onChange={() => {
                    if (vendedoresSeleccionados.length === vendedoresFiltrados.length) {
                      setVendedoresSeleccionados([]);
                    } else {
                      setVendedoresSeleccionados(
                        vendedoresFiltrados.map(v => v.vendedor)
                      );
                    }
                    setPage(1);
                  }}
                />
                Seleccionar todos
              </label>

              {vendedoresFiltrados.map(v => (
                <label key={v.vendedor} className="flex items-start gap-2 text-sm mb-2">
                  <input
                    type="checkbox"
                    checked={vendedoresSeleccionados.includes(v.vendedor)}
                    onChange={() => {
                      setVendedoresSeleccionados(prev =>
                        prev.includes(v.vendedor)
                          ? prev.filter(x => x !== v.vendedor)
                          : [...prev, v.vendedor]
                      );
                      setPage(1);
                    }}
                  />
                  <span>
                    <strong>{v.vendedor}</strong> - {v.nombre}
                  </span>
                </label>
              ))}

            </div>
          )}
        </div>

        {/* ================= TIPO PDV ================= */}
        <div className="relative" ref={canalesRef}>
          <button
            onClick={() => setMostrarCanales(!mostrarCanales)}
            className="px-3 py-1 border rounded bg-gray-100 min-w-[200px] text-left flex items-center justify-between gap-2"
          >
            <span>{canalesSeleccionados.length === 0
              ? "Todos los Tipo PDV"
              : canalesSeleccionados.length === 1
                ? canalesSeleccionados[0]
                : `${canalesSeleccionados.length} Tipo PDV`}</span>
            <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" />
          </button>

          {mostrarCanales && (
            <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow max-h-96 overflow-auto w-72 resize both">

              <input
                type="text"
                placeholder="Buscar tipo PDV..."
                value={busquedaCanal}
                onChange={(e) => setBusquedaCanal(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm mb-3"
              />

              <label className="flex items-center gap-2 font-semibold text-sm mb-2">
                <input
                  type="checkbox"
                  checked={
                    canalesFiltrados.length > 0 &&
                    canalesSeleccionados.length === canalesDisponibles.length
                  }
                  onChange={() => {
                    if (canalesSeleccionados.length === canalesDisponibles.length) {
                      setCanalesSeleccionados([]);
                    } else {
                      setCanalesSeleccionados([...canalesDisponibles]);
                    }
                  }}
                />
                Seleccionar todos
              </label>

              {canalesFiltrados.map(c => (
                <label key={c} className="flex items-center gap-2 text-sm mb-2">
                  <input
                    type="checkbox"
                    checked={canalesSeleccionados.includes(c)}
                    onChange={() => {
                      setCanalesSeleccionados(prev =>
                        prev.includes(c)
                          ? prev.filter(x => x !== c)
                          : [...prev, c]
                      );
                    }}
                  />
                  <span>{c}</span>
                </label>
              ))}

            </div>
          )}
        </div>

        {/* COLUMNAS */}
        <div className="relative" ref={columnasRef}>
          <button
            onClick={() => setMostrarColumnas(!mostrarColumnas)}
            className="px-3 py-1 border rounded bg-gray-100 flex items-center gap-2"
          >
            Proveedores
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {mostrarColumnas && (
            <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow max-h-96 overflow-auto w-96 resize both">

              <input
                type="text"
                placeholder="Buscar proveedor/división..."
                value={busquedaColumna}
                onChange={(e) => setBusquedaColumna(e.target.value)}
                className="w-full px-2 py-1 border rounded text-sm mb-3"
              />

              <label className="flex items-center gap-2 font-semibold text-sm mb-2">
                <input
                  type="checkbox"
                  checked={columnasVisibles.length === columnas.length}
                  onChange={() => {
                    if (columnasVisibles.length === columnas.length) {
                      setColumnasVisibles([]);
                    } else {
                      setColumnasVisibles(
                        columnas.map(c => `${c.proveedor_codigo}-${c.division_codigo}`)
                      );
                    }
                  }}
                />
                Seleccionar todas
              </label>

              {columnasSelectorFiltradas.map(col => {
                const key = `${col.proveedor_codigo}-${col.division_codigo}`;

                return (
                  <label key={key} className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={columnasVisibles.includes(key)}
                      onChange={() => {
                        setColumnasVisibles(prev =>
                          prev.includes(key)
                            ? prev.filter(k => k !== key)
                            : [...prev, key]
                        );
                      }}
                    />
                    {col.proveedor_nombre} - {col.division_nombre}
                  </label>
                );
              })}

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
                <button onClick={aplicarCambiosCliente} className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700">
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

      <div className={fullscreen ? "overflow-auto flex-1 min-h-0 rounded-lg border shadow-sm" : "overflow-x-auto border rounded shadow"}>
        <table className="min-w-max table-fixed text-sm border-collapse">
          <thead className="sticky top-0 z-40 bg-white shadow-md">
            <tr>
              <th rowSpan={2} className="w-48 p-2 border border-slate-600 bg-sky-100 sticky left-0 z-50">
                Cliente
              </th>
              <th rowSpan={2} className="w-28 p-2 border border-slate-600 bg-sky-100 sticky left-48 z-50">
                Tipo PDV
              </th>
              {columnasFiltradas.map(col => (
                <th
                  key={`${col.proveedor_codigo}-${col.division_codigo}`}
                  colSpan={4}
                  className="p-2 border text-center font-semibold bg-indigo-200 border-r-4 border-slate-600"
                >
                  {col.proveedor_nombre} - {col.division_nombre}
                </th>
              ))}
              <th
                colSpan={3}
                className={`p-2 border text-center font-semibold bg-amber-100 border-r-4 border-slate-600${totalFijo ? ' sticky right-0 z-50' : ''}`}
              >
                Total cliente
              </th>
            </tr>
            <tr>
              {columnasFiltradas.map(col => (
                <Fragment key={`sub-${col.proveedor_codigo}-${col.division_codigo}`}>
                  <th className="w-32 p-2 border border-slate-600 bg-indigo-50 text-center">
                    BGT Orig
                  </th>
                  <th className="w-24 p-2 border border-slate-600 bg-indigo-50 text-center">
                    Crec %
                  </th>
                  <th className="w-32 p-2 border border-slate-600 bg-indigo-50 text-center">
                    Crec $
                  </th>
                  <th className="w-32 p-2 border border-r-4 border-slate-600 bg-indigo-50 text-center">
                    BGT Final
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
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 2 + columnasFiltradas.length * 4 + 3 }).map((_, j) => (
                    <td key={j} className="p-2 border">
                      <div className="h-4 bg-slate-200 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : dataAgrupada.map((row: any) => {
              const rowBgtOrigTotal = columnasFiltradas.reduce((sum, col) => {
                const d = row.data[`${col.proveedor_codigo}-${col.division_codigo}`];
                return sum + (d?.objetivo_base != null ? d.objetivo_base : 0);
              }, 0);
              const rowBgtFinalTotal = columnasFiltradas.reduce((sum, col) => {
                const d = row.data[`${col.proveedor_codigo}-${col.division_codigo}`];
                return sum + (d?.objetivo_cliente ?? 0);
              }, 0);

              return (
                <tr key={row.cliente_id} className="hover:bg-slate-100">
                  <td className="w-48 p-2 border border-slate-600 bg-sky-50 sticky left-0 z-10">
                    {row.cliente_id} - {row.cliente_nombre}
                  </td>
                  <td className="w-28 p-2 border border-slate-600 bg-sky-50 sticky left-48 z-10 text-center">
                    {row.canal ?? ""}
                  </td>
                  {columnasFiltradas.map(col => {
                    const key = `${col.proveedor_codigo}-${col.division_codigo}`;
                    const d = row.data[key];
                    const inputKey = d ? `${row.cliente_id}_${key}` : null;
                    const editVal = inputKey
                      ? (editValues[inputKey] ?? { crec: "", importe: "" })
                      : null;
                    const cliDirty = d ? pendingChanges.has(`${d.cliente_id}_${d.proveedor_codigo}_${d.division_codigo}`) : false;

                    return (
                      <Fragment key={`${row.cliente_id}-${key}`}>
                        <td className="p-2 border border-slate-600 text-right bg-indigo-50/40">
                          {d?.objetivo_base != null ? fmt(d.objetivo_base) : "-"}
                        </td>

                        <td className={`p-2 border border-slate-600 text-center ${cliDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : ""}`}>
                          {d && inputKey ? (
                            <Input
                              type="number"
                              disabled={readonly}
                              value={editVal?.crec ?? ""}
                              onChange={e => { if (!readonly) setEditValues(prev => ({ ...prev, [inputKey]: { ...prev[inputKey], crec: e.target.value } })); }}
                              className={`hover:bg-slate-100 focus-within:bg-amber-50 transition-colors bg-white ${readonly ? "opacity-50 cursor-not-allowed" : ""}`}
                              onBlur={e => { if (!readonly) handleCrecBlur(d, e.target.value); }}
                            />
                          ) : "-"}
                        </td>

                        <td className={`p-2 border border-slate-600 text-center ${cliDirty ? "bg-orange-100 ring-2 ring-inset ring-orange-400" : ""}`}>
                          {d && inputKey ? (
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
                                if (!readonly) handleImporteBlur(d, editVal?.importe ?? "");
                              }}
                            />
                          ) : "-"}
                        </td>

                        <td className="p-2 border text-right border-r-4 border-slate-600">
                          {d ? fmt(d.objetivo_cliente) : "-"}
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

          </tbody>

          <tfoot className="sticky bottom-0 z-40">
            {!loading && !catalogosLoading && (
              <tr className="bg-slate-800 text-white font-bold text-sm">
                <td
                  colSpan={2}
                  className="p-2 border border-slate-600 bg-slate-800 sticky left-0 z-50 uppercase tracking-wide"
                >
                  TOTAL CLIENTES
                </td>
                {columnasFiltradas.map(col => {
                  const key = `${col.proveedor_codigo}-${col.division_codigo}`;
                  const total = totalesPorColumna[key];
                  return (
                    <Fragment key={`total-${key}`}>
                      <td className="p-2 border border-slate-600 bg-slate-700 text-right">
                        {total ? fmt(total.bgtOrig) : "-"}
                      </td>
                      <td className="p-2 border border-slate-600 bg-slate-700 text-center text-slate-300">—</td>
                      <td className="p-2 border border-slate-600 bg-slate-700 text-center text-slate-300">—</td>
                      <td className="p-2 border border-r-4 border-slate-600 bg-slate-700 text-right">
                        {total ? fmt(total.bgtFinal) : "-"}
                      </td>
                    </Fragment>
                  );
                })}
                <td className={`p-2 border border-slate-600 bg-slate-700 text-right${totalFijo ? ' sticky right-64 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)]' : ''}`}>
                  {fmt(grandTotal.bgtOrig)}
                </td>
                <td className={`p-2 border border-slate-600 bg-slate-700 text-right${totalFijo ? ' sticky right-32 z-50' : ''}`}>
                  {fmt(grandTotal.bgtFinal)}
                </td>
                <td className={`p-2 border border-r-4 border-slate-600 bg-slate-700 text-right ${grandTotal.bgtFinal - grandTotal.bgtOrig < 0 ? "text-red-300" : "text-white"}${totalFijo ? ' sticky right-0 z-50' : ''}`}>
                  {fmtDiff(grandTotal.bgtFinal - grandTotal.bgtOrig)}
                </td>
              </tr>
            )}
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
