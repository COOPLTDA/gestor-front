import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { usePresupuesto } from "@/contexts/PresupuestoEnroContext";
import { useCatalogos, useCatalogosState } from "@/contexts/CatalogosContext";
import { API } from "@/constants/api";

type Props = {
  nivel: "empresa" | "zona" | "supervisor" | "vendedor" | "cliente";
};

export default function ValidacionNivelTab({ nivel }: Props) {
  const { state } = usePresupuesto();
  const catalogos = useCatalogos();
  const { loading: catalogosLoading } = useCatalogosState();

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasBuscado, setHasBuscado] = useState(false);

  const [searchProveedor, setSearchProveedor] = useState("");
  const [searchNivel, setSearchNivel] = useState("");
  const [desvioFilter, setDesvioFilter] =
    useState<"todos" | "positivo" | "negativo" | "cero">("todos");

  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);

  const formatMoney = (value: number) =>
    `$ ${Math.round(value || 0).toLocaleString("es-AR")}`;

  const formatPercent = (value: number) =>
    `${value.toFixed(2)} %`;

  // =============================
  // CARGA DATOS (on demand)
  // =============================

  // Reset al cambiar período — y libera el overlay de carga
  useEffect(() => {
    setRows([]);
    setHasBuscado(false);
    window.dispatchEvent(new CustomEvent("presupuesto-tab-loaded"));
  }, [state.mesObjetivo, nivel]);

  const handleBuscar = useCallback(async () => {
    if (!state.mesObjetivo) return;
    setLoading(true);
    setHasBuscado(true);
    try {
      const res  = await fetchWithAuth(API.PRESUPUESTO_ENRO.VALIDACION.QUERY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: state.mesObjetivo, nivel })
      });
      const data = await res.json();
      if (data.success) setRows(data.data.rows || []);
    } catch {
      // silently ignore
    }
    setLoading(false);
  }, [state.mesObjetivo, nivel]);

  // =============================
  // FILTRADO
  // =============================

  const filteredRows = useMemo(() => {
    return rows.filter((r: any) => {
      const proveedorObj = catalogos?.proveedores?.find(
        (p: any) => String(p.codigo) === String(r.proveedor_codigo)
      );

      const proveedorLabel =
        `${r.proveedor_codigo} - ${proveedorObj?.nombre || ""}`.toLowerCase();

      let nivelLabel = "";

      if (nivel === "zona") nivelLabel = String(r.zona || "").toLowerCase();
      if (nivel === "supervisor")
        nivelLabel = String(r.supervisor_id || "").toLowerCase();
      if (nivel === "vendedor")
        nivelLabel = String(r.vendedor || "").toLowerCase();
      if (nivel === "cliente")
        nivelLabel = String(r.cliente_id || "").toLowerCase();

      const actual = r.total_actual || 0;
      const siguiente = r.total_siguiente || 0;
      const desvio = siguiente - actual;

      const matchesProveedor =
        proveedorLabel.includes(searchProveedor.toLowerCase());

      const matchesNivel =
        nivelLabel.includes(searchNivel.toLowerCase());

      let matchesDesvio = true;

      if (desvioFilter === "positivo") matchesDesvio = desvio > 0;
      if (desvioFilter === "negativo") matchesDesvio = desvio < 0;
      if (desvioFilter === "cero") matchesDesvio = desvio === 0;

      return matchesProveedor && matchesNivel && matchesDesvio;
    });
  }, [rows, catalogos, searchProveedor, searchNivel, desvioFilter, nivel]);

  // =============================
  // EXPORTAR (HOOK ARRIBA DEL RETURN)
  // =============================

  useEffect(() => {
    const handleExport = async (e: any) => {
      const { nivel: nivelExport } = e.detail;
      if (nivelExport !== nivel) return;
      if (!filteredRows.length) return;

      // @ts-ignore
      const ExcelJS = await import("exceljs");
      const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
      const HEADER_FONT = { name: "Arial", bold: true, size: 10, color: { argb: "FF1E3A5F" } };
      const CELL_FONT   = { name: "Arial", size: 10 };
      const MONEY_FMT   = '"$ "#,##0;[Red]"$ "(-#,##0);"-"';
      const PCT_FMT     = '0.00"%"';
      const bThin = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
      const bMed  = { style: "medium" as const, color: { argb: "FF6B7280" } };

      const SLATE_H = "FFF1F5F9"; const SLATE_C = "FFF8FAFC";
      const GREEN_C = "FFF0FDF4"; const RED_C = "FFFEF2F2";

      const wb = new ExcelJS.default.Workbook();
      const ws = wb.addWorksheet(`Validacion ${nivel}`);

      const headers = ["Proveedor", "División", "Nivel", "Nivel Actual", "Nivel Siguiente", "Desvío $$", "Desvío %"];
      const hr = ws.addRow(headers);
      hr.height = 22;
      hr.eachCell((cell: any) => {
        cell.font = HEADER_FONT;
        cell.fill = fill(SLATE_H);
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { top: bThin, bottom: bMed, left: bThin, right: bThin };
      });

      filteredRows.forEach((r: any) => {
        const proveedorObj = catalogos?.proveedores?.find((p: any) => String(p.codigo) === String(r.proveedor_codigo));
        const divisionObj  = catalogos?.divisiones?.find((d: any) => String(d.codigo) === String(r.division_codigo));
        const supervisorObj = catalogos?.supervisores?.find((s: any) => String(s.id) === String(r.supervisor_id));
        const vendedorObj  = catalogos?.vendedores?.find((v: any) => String(v.id) === String(r.vendedor));
        const clienteIdRow = r.cliente_id ?? r.cliente ?? r.id_cliente ?? null;
        const clienteObj   = catalogos?.clientes?.find((c: any) => {
          if (!clienteIdRow) return false;
          return String(c.id).replace(/^0+/, "") === String(clienteIdRow).replace(/^0+/, "");
        });

        let nivelLabel = "";
        if (nivel === "empresa") nivelLabel = "Total Empresa";
        if (nivel === "zona") nivelLabel = r.zona ?? "";
        if (nivel === "supervisor") nivelLabel = `${r.zona} - ${supervisorObj?.nombre ?? ""}`;
        if (nivel === "vendedor") nivelLabel = `${r.vendedor} - ${vendedorObj?.nombre ?? ""}`;
        if (nivel === "cliente") nivelLabel = `Vend ${r.vendedor} - ${clienteIdRow ?? ""} - ${clienteObj?.nombre?.trim() ?? ""}`;

        const actual    = r.total_actual || 0;
        const siguiente = r.total_siguiente || 0;
        const desvio    = siguiente - actual;
        const desvioPct = siguiente !== 0 ? (desvio / siguiente) * 100 : 0;
        const isPos = desvioPct > 0; const isNeg = desvioPct < 0;

        const dr = ws.addRow([
          `${r.proveedor_codigo} - ${proveedorObj?.nombre ?? ""}`,
          divisionObj?.nombre ?? "",
          nivelLabel,
          actual,
          nivel === "cliente" ? null : siguiente,
          nivel === "cliente" ? null : desvio,
          nivel === "cliente" ? null : desvioPct
        ]);
        dr.height = 18;
        dr.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
          const bgC = ci >= 6 ? (isPos ? GREEN_C : isNeg ? RED_C : SLATE_C) : SLATE_C;
          cell.font = { ...CELL_FONT, color: { argb: ci === 7 ? (isPos ? "FF16A34A" : isNeg ? "FFDC2626" : "FF374151") : "FF374151" } };
          cell.fill = fill(bgC);
          cell.alignment = { horizontal: ci <= 3 ? "left" : "right", vertical: "middle" };
          cell.border = { top: bThin, bottom: bThin, left: bThin, right: bThin };
          if (ci === 4 || ci === 5 || ci === 6) cell.numFmt = MONEY_FMT;
          if (ci === 7) cell.numFmt = PCT_FMT;
        });
      });

      // ── Total row ────────────────────────────────────────────
      const nonCliente = nivel !== "cliente";
      const totActual    = filteredRows.reduce((s: number, r: any) => s + (r.total_actual || 0), 0);
      const totSiguiente = nonCliente ? filteredRows.reduce((s: number, r: any) => s + (r.total_siguiente || 0), 0) : null;
      const totDesvio    = nonCliente && totSiguiente !== null ? totSiguiente - totActual : null;
      const totDesvioPct = nonCliente && totSiguiente ? ((totSiguiente - totActual) / totSiguiente) * 100 : null;
      const totRow = ws.addRow(["TOTAL", "", "", totActual, totSiguiente, totDesvio, totDesvioPct]);
      totRow.height = 20;
      totRow.eachCell({ includeEmpty: true }, (cell: any, ci: number) => {
        cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = fill("FF1E293B");
        cell.alignment = { horizontal: ci <= 3 ? "left" : "right", vertical: "middle" };
        cell.border = {
          top: { style: "medium" as const, color: { argb: "FF475569" } },
          bottom: bThin, left: bThin, right: bThin,
        };
        if (ci === 4 || ci === 5 || ci === 6) { if (cell.value !== null) cell.numFmt = MONEY_FMT; }
        if (ci === 7) { if (cell.value !== null) cell.numFmt = PCT_FMT; }
      });

      ws.getColumn(1).width = 30; ws.getColumn(2).width = 18;
      ws.getColumn(3).width = 35; ws.getColumn(4).width = 18;
      ws.getColumn(5).width = 18; ws.getColumn(6).width = 18; ws.getColumn(7).width = 12;
      ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Validacion_${nivel}_${state.mesObjetivo}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    };

    window.addEventListener("export-presupuesto", handleExport);
    return () => window.removeEventListener("export-presupuesto", handleExport);
  }, [nivel, filteredRows, catalogos, state.mesObjetivo]);

  // =============================
  // PAGINACION
  // =============================

  const totalPages = Math.ceil(filteredRows.length / pageSize);

  const paginatedRows = filteredRows.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // ⚠️ ESTE RETURN VA DESPUÉS DE TODOS LOS HOOKS
  return (
    <div className="space-y-4">

      {/* FILTROS */}
      <div className="flex flex-wrap gap-4 items-end bg-white p-4 border rounded shadow">

        <div>
          <label className="text-xs font-medium">Proveedor</label>
          <input
            className="border rounded px-2 py-1 text-sm"
            value={searchProveedor}
            onChange={(e) => setSearchProveedor(e.target.value)}
            placeholder="Buscar proveedor..."
          />
        </div>

        <div>
          <label className="text-xs font-medium">Nivel</label>
          <input
            className="border rounded px-2 py-1 text-sm"
            value={searchNivel}
            onChange={(e) => setSearchNivel(e.target.value)}
            placeholder="Buscar nivel..."
          />
        </div>

        <div>
          <label className="text-xs font-medium">Desvío $$</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={desvioFilter}
            onChange={(e) => setDesvioFilter(e.target.value as any)}
          >
            <option value="todos">Todos</option>
            <option value="positivo">Positivo</option>
            <option value="negativo">Negativo</option>
            <option value="cero">Cero</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium">Filas</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </div>

        <button
          onClick={handleBuscar}
          disabled={loading || !state.mesObjetivo}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded transition flex items-center gap-2"
        >
          {loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {loading ? "Buscando..." : "Buscar datos"}
        </button>
      </div>

      {!hasBuscado && !loading && (
        <div className="bg-white rounded-lg border shadow-sm p-10 text-center text-slate-400 text-sm">
          Seleccioná un período y presioná <strong>Buscar datos</strong> para ver la validación.
        </div>
      )}

      {/* TABLA Y PAGINACION — solo visible tras buscar */}
      {(hasBuscado || loading) && <>
      <div className="overflow-auto border rounded shadow bg-white">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-slate-100">
            <tr className="text-slate-700 font-semibold">
              <th className="p-2 border">Proveedor</th>
              <th className="p-2 border">División</th>
              <th className="p-2 border">Nivel</th>
              <th className="p-2 border text-right">Nivel Actual</th>
              <th className="p-2 border text-right">Nivel Siguiente</th>
              <th className="p-2 border text-right">Desvío $$</th>
              <th className="p-2 border text-right">Desvío %</th>
            </tr>
          </thead>

          <tbody>
            {(loading || catalogosLoading) ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="p-2 border">
                      <div className="h-4 bg-slate-200 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedRows.map((r: any, i: number) => {

              const proveedorObj = catalogos.proveedores.find(
                (p: any) => String(p.codigo) === String(r.proveedor_codigo)
              );

              const divisionObj = catalogos.divisiones.find(
                (d: any) => String(d.codigo) === String(r.division_codigo)
              );

              const supervisorObj = catalogos.supervisores.find(
                (s: any) => String(s.id) === String(r.supervisor_id)
              );

              const vendedorObj = catalogos.vendedores.find(
                (v: any) => String(v.id) === String(r.vendedor)
              );

              const clienteIdRow =
              r.cliente_id ??
              r.cliente ??
              r.id_cliente ??
              r.idCliente ??
              null;
            
                const clienteObj = catalogos.clientes.find((c: any) => {
                if (!clienteIdRow) return false;
                
                const idCatalogo = String(c.id).replace(/^0+/, "");
                const idRow = String(clienteIdRow).replace(/^0+/, "");
                return idCatalogo === idRow;
                });

              const actual = r.total_actual || 0;
              const siguiente = r.total_siguiente || 0;
              const desvio = siguiente - actual;
              const desvioPct =
                siguiente !== 0 ? (desvio / siguiente) * 100 : 0;

              const pctColor =
                desvioPct > 0
                  ? "bg-green-100 text-green-700"
                  : desvioPct < 0
                  ? "bg-red-100 text-red-700"
                  : "";

              return (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-2 border">
                    {r.proveedor_codigo} - {proveedorObj?.nombre || ""}
                  </td>

                  <td className="p-2 border">
                    {divisionObj?.nombre || ""}
                  </td>

                  <td className="p-2 border">
                    {nivel === "empresa" && "Total Empresa"}
                    {nivel === "zona" && r.zona}
                    {nivel === "supervisor" &&
                      `${r.zona} - ${supervisorObj?.nombre || ""}`}
                    {nivel === "vendedor" &&
                      `${r.vendedor} - ${vendedorObj?.nombre || ""}`}
                    {nivel === "cliente" &&
                     `Vend ${r.vendedor} - ${clienteIdRow || ""} - ${clienteObj?.nombre?.trim() || ""}`}
                  </td>

                  <td className="p-2 border text-right">
                    {formatMoney(actual)}
                  </td>

                  <td className="p-2 border text-right">
                    {nivel === "cliente" ? "-" : formatMoney(siguiente)}
                  </td>

                  <td className="p-2 border text-right">
                    {nivel === "cliente" ? "-" : formatMoney(desvio)}
                  </td>

                  <td className={`p-2 border text-right ${pctColor}`}>
                    {nivel === "cliente"
                      ? "-"
                      : formatPercent(desvioPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PAGINACION */}
      <div className="flex justify-between items-center text-sm">
        <span>
          Página {page} de {totalPages || 1}
        </span>

        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Anterior
          </button>

          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
      </>}
    </div>
  );
}