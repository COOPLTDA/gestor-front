import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Download, Calendar, Globe2, Users } from "lucide-react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import type { Zona } from "../Fichajes";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type VendedorAsistencia = {
  empleado: string;
  nombre: string;
  zona: string;
  dias: Record<string, string | null>; // key=fecha, value=hora|null; missing key=ausente
  resumen: { aTiempo: number; tarde: number; sinFichaje: number };
};

type AsistenciaData = {
  fechas: string[];
  vendedores: VendedorAsistencia[];
};

interface Props {
  zonas: Zona[];
  supervisoresAll: Zona[];
  mostrarSupervisor: boolean;
  umbralMinutos: number;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysAgoStr(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

function minutesToStr(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const DAY_ABBR   = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ABBR = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function colHeader(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  return {
    dia:  DAY_ABBR[d.getDay()],
    num:  String(d.getDate()).padStart(2, "0"),
    mes:  MONTH_ABBR[d.getMonth()],
    anio: String(d.getFullYear()).slice(2),
  };
}

function horaToMin(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function FichajesAsistencia({ zonas, supervisoresAll, mostrarSupervisor, umbralMinutos }: Props) {
  const umbralStr = minutesToStr(umbralMinutos);

  const [fechaDesde, setFechaDesde] = useState(daysAgoStr(6));
  const [fechaHasta, setFechaHasta] = useState(todayStr());
  const [zona,       setZona]       = useState<string[]>([]);
  const [supervisor, setSupervisor] = useState<string[]>([]);

  const [data,       setData]       = useState<AsistenciaData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [exporting,  setExporting]  = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (fd: string, fh: string, z: string[], sup: string[]) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fechaDesde: fd, fechaHasta: fh, umbral: umbralStr });
      if (z.length)   params.set("zona",       z.join(","));
      if (sup.length) params.set("supervisor", sup.join(","));

      const res = await fetchWithAuth(`${API.FICHAJES.ANALYTICS_ASISTENCIA}?${params}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Error cargando asistencia");
      const json = await res.json() as any;
      if (!json.success) throw new Error(json.message ?? "Error del servidor");
      setData(json.data);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [umbralStr]);

  useEffect(() => {
    fetchData(fechaDesde, fechaHasta, zona, supervisor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, zona.join(","), supervisor.join(","), umbralStr]);

  // ── Excel export (ExcelJS con estilos) ────────────────────
  async function exportExcel() {
    if (!data) return;
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "DistriGestion";
      const ws = wb.addWorksheet("Asistencia", {
        views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
      });

      // ── Colores ──────────────────────────────────────────
      const C = {
        headerBg:    "FFE2E8F0", headerFg:    "FF374151",
        greenBg:     "FFD1FAE5", greenFg:     "FF15803D",
        redBg:       "FFFEE2E2", redFg:       "FFB91C1C",
        amberBg:     "FFFEF3C7", amberFg:     "FFD97706",
        grayBg:      "FFF9FAFB", grayFg:      "FF9CA3AF",
        totalBg:     "FFE5E7EB", totalFg:     "FF374151",
        sumGreenBg:  "FFD1FAE5", sumRedBg:    "FFFEE2E2",
        sumGrayBg:   "FFF3F4F6",
        white:       "FFFFFFFF",
      };

      const border: Partial<ExcelJS.Borders> = {
        top:    { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        left:   { style: "thin", color: { argb: "FFD1D5DB" } },
        right:  { style: "thin", color: { argb: "FFD1D5DB" } },
      };

      function fill(argb: string): ExcelJS.Fill {
        return { type: "pattern", pattern: "solid", fgColor: { argb } };
      }

      // ── Anchos de columna ─────────────────────────────────
      ws.columns = [
        { key: "vendedor", width: 32 },
        { key: "zona",     width: 16 },
        ...data.fechas.map(f => ({ key: f, width: 11 })),
        { key: "a_tiempo",    width: 10 },
        { key: "tarde",       width: 8  },
        { key: "sin_fichaje", width: 12 },
      ];

      const nDates    = data.fechas.length;
      const colAT     = 3 + nDates;      // col índice 1-based de "A tiempo"
      const colTarde  = 4 + nDates;
      const colSinF   = 5 + nDates;

      // ── Fila de encabezado ────────────────────────────────
      const hdr = ws.addRow([
        "Vendedor", "Zona",
        ...data.fechas.map(f => {
          const { num, dia, mes, anio } = colHeader(f);
          return `${num} ${dia}\n${mes} '${anio}`;
        }),
        "A tiempo", "Tarde", "Sin fichaje",
      ]);
      hdr.height = 38;
      hdr.eachCell((cell, col) => {
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.font      = { bold: true, size: 9, color: { argb: C.headerFg } };
        cell.border    = border;
        if (col === colAT)   { cell.fill = fill(C.sumGreenBg); cell.font = { bold: true, size: 9, color: { argb: C.greenFg } }; }
        else if (col === colTarde)  { cell.fill = fill(C.sumRedBg);   cell.font = { bold: true, size: 9, color: { argb: C.redFg }   }; }
        else if (col === colSinF)   { cell.fill = fill(C.sumGrayBg);  cell.font = { bold: true, size: 9, color: { argb: C.grayFg }  }; }
        else                        { cell.fill = fill(C.headerBg); }
      });

      // ── Filas de datos ────────────────────────────────────
      data.vendedores.forEach((vend, idx) => {
        const rowBg = idx % 2 === 0 ? C.white : "FFF8FAFC";

        const rowVals = [
          vend.nombre ?? vend.empleado,
          vend.zona,
          ...data.fechas.map(f => {
            const hasKey = Object.prototype.hasOwnProperty.call(vend.dias, f);
            if (!hasKey)            return "—";
            const hora = vend.dias[f];
            if (hora === null)      return "s/r";
            return hora;
          }),
          vend.resumen.aTiempo,
          vend.resumen.tarde,
          vend.resumen.sinFichaje,
        ];

        const row = ws.addRow(rowVals);
        row.height = 18;

        row.eachCell((cell, col) => {
          cell.border = border;
          cell.alignment = { vertical: "middle", horizontal: "center" };

          // Columnas de vendedor / zona — alineación izquierda
          if (col <= 2) {
            cell.alignment = { vertical: "middle", horizontal: "left" };
            cell.font = col === 1
              ? { bold: true, size: 9, color: { argb: "FF1F2937" } }
              : { size: 8,  color: { argb: C.grayFg } };
            cell.fill = fill(rowBg);
            return;
          }

          // Columnas de resumen
          if (col === colAT)  { cell.fill = fill(C.sumGreenBg); cell.font = { bold: true, size: 9, color: { argb: C.greenFg } }; return; }
          if (col === colTarde) { cell.fill = fill(C.sumRedBg);  cell.font = { bold: true, size: 9, color: { argb: C.redFg   } }; return; }
          if (col === colSinF)  { cell.fill = fill(C.sumGrayBg); cell.font = { size: 9, color: { argb: C.grayFg } }; return; }

          // Columnas de fechas — colorear según valor
          const val = String(cell.value ?? "");
          if (val === "—") {
            cell.fill = fill(C.grayBg);
            cell.font = { size: 9, color: { argb: C.grayFg } };
          } else if (val === "s/r") {
            cell.fill = fill(C.amberBg);
            cell.font = { size: 9, color: { argb: C.amberFg } };
          } else {
            // Es una hora HH:MM
            const fechaIdx = col - 3;
            const fecha    = data.fechas[fechaIdx];
            const hora     = vend.dias[fecha] ?? "";
            const aTiempo  = horaToMin(hora) <= umbralMinutos;
            cell.fill = fill(aTiempo ? C.greenBg : C.redBg);
            cell.font = { bold: true, size: 9, color: { argb: aTiempo ? C.greenFg : C.redFg } };
          }
        });
      });

      // ── Fila de totales ───────────────────────────────────
      const totalVals = [
        "TOTAL", "",
        ...data.fechas.map(f =>
          data.vendedores.filter(v =>
            Object.prototype.hasOwnProperty.call(v.dias, f) && v.dias[f] !== null
          ).length || ""
        ),
        data.vendedores.reduce((s, v) => s + v.resumen.aTiempo,    0),
        data.vendedores.reduce((s, v) => s + v.resumen.tarde,      0),
        data.vendedores.reduce((s, v) => s + v.resumen.sinFichaje, 0),
      ];
      const totalRow = ws.addRow(totalVals);
      totalRow.height = 20;
      totalRow.eachCell((cell, col) => {
        cell.border = border;
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { bold: true, size: 9, color: { argb: C.totalFg } };
        if (col === colAT)    { cell.fill = fill(C.greenBg); cell.font = { bold: true, size: 9, color: { argb: C.greenFg } }; }
        else if (col === colTarde) { cell.fill = fill(C.redBg);   cell.font = { bold: true, size: 9, color: { argb: C.redFg   } }; }
        else if (col === colSinF)  { cell.fill = fill(C.sumGrayBg); }
        else                       { cell.fill = fill(C.totalBg); }
      });

      // ── Descargar ─────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `asistencia_${fechaDesde}_${fechaHasta}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exportando Excel:", err);
    } finally {
      setExporting(false);
    }
  }

  // ── Cell renderer ──────────────────────────────────────────
  function renderCell(vend: VendedorAsistencia, fecha: string) {
    const hasKey = Object.prototype.hasOwnProperty.call(vend.dias, fecha);
    const hora   = hasKey ? vend.dias[fecha] : undefined;

    if (!hasKey) {
      return (
        <td key={fecha} className="px-2 py-1.5 text-center border-r border-gray-100 bg-gray-50">
          <span className="text-gray-300 text-xs">—</span>
        </td>
      );
    }
    if (hora === null) {
      return (
        <td key={fecha} className="px-2 py-1.5 text-center border-r border-gray-100 bg-amber-50">
          <span className="text-amber-400 text-xs font-medium">s/r</span>
        </td>
      );
    }
    const aTiempo = horaToMin(hora) <= umbralMinutos;
    return (
      <td key={fecha} className={`px-2 py-1.5 text-center border-r border-gray-100 ${aTiempo ? "bg-green-50" : "bg-red-50"}`}>
        <span className={`text-xs font-semibold ${aTiempo ? "text-green-700" : "text-red-700"}`}>
          {hora}
        </span>
      </td>
    );
  }

  return (
    <div>
      {/* ── Filtros + botón export ───────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center mb-6">
        {/* Rango de fechas — mismo estilo que Dashboard */}
        <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm text-sm text-gray-700">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="outline-none bg-transparent text-sm"
          />
          <span className="text-gray-400 mx-1">→</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="outline-none bg-transparent text-sm"
          />
        </div>

        <MultiSelectDropdown
          placeholder="Todas las zonas"
          options={zonas}
          selected={zona}
          onChange={setZona}
          icon={Globe2}
          width="min-w-[155px]"
        />

        {mostrarSupervisor && (
          <MultiSelectDropdown
            placeholder="Todos los supervisores"
            options={supervisoresAll}
            selected={supervisor}
            onChange={setSupervisor}
            icon={Users}
            width="min-w-[175px]"
          />
        )}

        {loading && (
          <div className="flex items-center gap-1.5 text-blue-500 text-xs">
            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Cargando...
          </div>
        )}

        {/* Botón exportar */}
        {data && data.vendedores.length > 0 && (
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            {exporting
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generando...</>
              : <><Download className="w-4 h-4" /> Exportar Excel</>
            }
          </button>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Leyenda ─────────────────────────────────────────── */}
      {!error && data && (
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-200 inline-block" />
            A tiempo (≤ {umbralStr})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-200 inline-block" />
            Tarde
          </span>
          <span className="relative flex items-center gap-1.5 cursor-help group">
            <span className="w-3 h-3 rounded-sm bg-amber-100 inline-block" />
            Sin registro válido
            <span className="absolute bottom-full left-0 mb-2 w-72 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
              El vendedor tuvo actividad ese día pero todos sus checkins resultaron inválidos (ubicación falsa, fuera de zona PDV, sin GPS, etc.). Estuvo presente pero sin fichaje válido registrado.
            </span>
          </span>
          <span className="relative flex items-center gap-1.5 cursor-help group">
            <span className="w-3 h-3 rounded-sm bg-gray-100 inline-block" />
            Ausente
            <span className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
              No existe ningún registro para ese día. Puede ser día no laborable (fin de semana, feriado) o el vendedor no registró ninguna actividad.
            </span>
          </span>
        </div>
      )}

      {/* ── Sin datos ───────────────────────────────────────── */}
      {!error && data && data.vendedores.length === 0 && !loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          Sin datos para el período seleccionado
        </div>
      )}

      {/* ── Tabla ───────────────────────────────────────────── */}
      {!error && data && data.vendedores.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 text-left text-xs font-semibold text-gray-600 border-r border-gray-200 min-w-[180px]">
                  Vendedor
                </th>

                {data.fechas.map(f => {
                  const { dia, num, mes, anio } = colHeader(f);
                  return (
                    <th
                      key={f}
                      className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 border-r border-gray-200 min-w-[68px]"
                    >
                      <div className="text-[10px] text-gray-400 leading-tight">{mes} '{anio}</div>
                      <div className="font-semibold text-gray-700 leading-tight">{num}</div>
                      <div className="text-gray-400 leading-tight">{dia}</div>
                    </th>
                  );
                })}

                <th className="px-3 py-2.5 text-center text-xs font-semibold text-green-700 bg-green-50 border-r border-gray-200 min-w-[72px]">
                  A tiempo
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-red-700 bg-red-50 border-r border-gray-200 min-w-[60px]">
                  Tarde
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 bg-gray-50 min-w-[80px]">
                  Sin fichaje
                </th>
              </tr>
            </thead>

            <tbody>
              {data.vendedores.map((vend, idx) => (
                <tr
                  key={vend.empleado}
                  className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${
                    idx % 2 === 0 ? "" : "bg-gray-50/40"
                  }`}
                >
                  <td className={`sticky left-0 z-10 px-4 py-2 border-r border-gray-200 ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                  }`}>
                    <div className="font-medium text-gray-800 text-sm leading-tight">
                      {vend.nombre ?? `${vend.empleado} -`}
                    </div>
                    <div className="text-xs text-gray-400">{vend.zona}</div>
                  </td>

                  {data.fechas.map(f => renderCell(vend, f))}

                  <td className="px-3 py-2 text-center bg-green-50/60">
                    <span className="font-bold text-green-700">{vend.resumen.aTiempo}</span>
                  </td>
                  <td className="px-3 py-2 text-center bg-red-50/60">
                    <span className="font-bold text-red-700">{vend.resumen.tarde}</span>
                  </td>
                  <td className="px-3 py-2 text-center bg-gray-50">
                    <span className="font-medium text-gray-400">{vend.resumen.sinFichaje}</span>
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-100">
                <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 border-r border-gray-200">
                  TOTAL
                </td>
                {data.fechas.map(f => {
                  const activos = data.vendedores.filter(v =>
                    Object.prototype.hasOwnProperty.call(v.dias, f) && v.dias[f] !== null
                  ).length;
                  return (
                    <td key={f} className="px-2 py-2 text-center border-r border-gray-200">
                      <span className="text-xs text-gray-500">{activos > 0 ? `${activos}v` : ""}</span>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center bg-green-100">
                  <span className="font-bold text-green-700 text-sm">
                    {data.vendedores.reduce((s, v) => s + v.resumen.aTiempo, 0)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center bg-red-100">
                  <span className="font-bold text-red-700 text-sm">
                    {data.vendedores.reduce((s, v) => s + v.resumen.tarde, 0)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center bg-gray-50">
                  <span className="font-medium text-gray-500 text-sm">
                    {data.vendedores.reduce((s, v) => s + v.resumen.sinFichaje, 0)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
