import React, { useMemo, useState } from "react";
import {
  Eye, X, ChevronUp, ChevronDown, ChevronsUpDown,
  Loader2, AlertTriangle, MinusCircle, Map,
} from "lucide-react";
import { InfoTooltip, DEFINICIONES } from "./InfoTooltip";
import type { FichajeRow, DetalleCobertura } from "../Fichajes";
import { FichajesDetallePanel } from "./FichajesDetallePanel";
import { RutaMapModal } from "./RutaMapModal";

type SortCol = { col: string; asc: boolean };

type Props = {
  items: FichajeRow[];
  openEmpleado: string | null;
  detalles: Record<string, DetalleCobertura>;
  loadingDetalle: boolean;
  erroresDetalle: Record<string, string>;
  diaSemanaLabel: string;
  umbralMinutos?: number;
  fecha: string;
  onToggle: (emp: string) => void;
};

function timeToMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}

export function FichajesTabla({
  items,
  openEmpleado,
  detalles,
  loadingDetalle,
  erroresDetalle,
  diaSemanaLabel,
  umbralMinutos = 525,
  fecha,
  onToggle,
}: Props) {
  const [sortCols, setSortCols] = useState<SortCol[]>([]);
  const [rutaRow, setRutaRow]   = useState<FichajeRow | null>(null);

  const sortBy = (col: string, shiftKey: boolean) => {
    setSortCols((prev) => {
      const idx = prev.findIndex((s) => s.col === col);
      if (shiftKey) {
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { col, asc: !next[idx].asc };
          return next;
        }
        return [...prev, { col, asc: true }];
      }
      if (idx >= 0 && prev.length === 1) return [{ col, asc: !prev[0].asc }];
      return [{ col, asc: true }];
    });
  };

  const sortedItems = useMemo(() => {
    if (sortCols.length === 0) return items;
    return [...items].sort((a, b) => {
      for (const { col, asc } of sortCols) {
        let va: any;
        let vb: any;
        if (col === "estado") {
          const ma = timeToMin(a.primerCheckinValidoHora); va = ma !== null && ma <= umbralMinutos ? 0 : 1;
          const mb = timeToMin(b.primerCheckinValidoHora); vb = mb !== null && mb <= umbralMinutos ? 0 : 1;
        } else {
          va = (a as any)[col] ?? "";
          vb = (b as any)[col] ?? "";
        }
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
      }
      return 0;
    });
  }, [items, sortCols]);

  const SortIcon = ({ col }: { col: string }) => {
    const s = sortCols.find((s) => s.col === col);
    if (!s) return <ChevronsUpDown className="w-3 h-3 text-gray-300 ml-1 shrink-0" />;
    return s.asc ? (
      <ChevronUp className="w-3 h-3 text-blue-500 ml-1 shrink-0" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-500 ml-1 shrink-0" />
    );
  };

  const ColHeader = ({
    col,
    label,
    center,
  }: {
    col: string;
    label: string;
    center?: boolean;
  }) => (
    <th
      className={`px-5 py-4 font-semibold text-gray-600 cursor-pointer select-none hover:text-blue-600 transition-colors ${
        center ? "text-center" : "text-left"
      }`}
      onClick={(e) => sortBy(col, e.shiftKey)}
    >
      <div className={`flex items-center ${center ? "justify-center" : ""}`}>
        {label}
        <SortIcon col={col} />
      </div>
    </th>
  );

  const pctColor = (v: number) =>
    v >= 70 ? "text-green-600" : v >= 40 ? "text-amber-600" : "text-red-600";
  const barColor = (v: number) =>
    v >= 70 ? "bg-green-500" : v >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <>
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 overflow-hidden border border-gray-100">
      <table className="min-w-full text-sm">
        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
          <tr>
            <ColHeader col="nombreVendedor" label="Vendedor" />
            <ColHeader col="zona" label="Zona" center />
            <ColHeader col="primerCheckinValidoHora" label="Primer Check-in" center />
            <ColHeader col="estado" label="Estado" center />
            <ColHeader col="carteraPct" label="Cartera" center />
            <th className="px-5 py-4 text-center font-semibold text-gray-600">Acciones</th>
            <th className="px-3 py-4 text-center font-semibold text-gray-600">Ruta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedItems.map((row) => (
            <React.Fragment key={row.codigoEmpleado}>
              <tr
                className={`hover:bg-gray-50/50 transition-colors ${
                  !row.tieneRegistro
                    ? "bg-gray-50/60 opacity-70"
                    : (() => { const m = timeToMin(row.primerCheckinValidoHora); return m !== null && m <= umbralMinutos ? "bg-green-50/30" : ""; })()
                }`}
              >
                {/* Vendedor */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                      {(row.nombreVendedor ?? "").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{row.nombreVendedor}</div>
                      <div className="text-gray-400 text-xs">Cód: {row.codigoEmpleado}</div>
                    </div>
                  </div>
                </td>

                {/* Zona */}
                <td className="px-5 py-4 text-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {row.zona}
                  </span>
                </td>

                {/* Primer check-in */}
                <td className="px-5 py-4 text-center">
                  <span className="font-mono text-gray-700">
                    {row.primerCheckinValidoHora ? row.primerCheckinValidoHora.slice(0, 5) : "—"}
                  </span>
                </td>

                {/* Estado */}
                <td className="px-5 py-4 text-center">
                  {!row.tieneRegistro ? (
                    <span className="inline-flex items-center gap-1 text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full text-xs font-semibold">
                      <MinusCircle className="w-3.5 h-3.5" />
                      Sin actividad
                      <InfoTooltip text={DEFINICIONES.sinActividad} />
                    </span>
                  ) : (() => { const m = timeToMin(row.primerCheckinValidoHora); return m !== null && m <= umbralMinutos; })() ? (
                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-3 py-1.5 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      A tiempo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 bg-amber-500 rounded-full" />
                      Tarde
                    </span>
                  )}
                </td>

                {/* Cartera */}
                <td className="px-5 py-4 text-center">
                  {row.carteraTotal > 0 ? (
                    <div>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`font-bold ${pctColor(row.carteraPct)}`}>
                          {row.carteraVisitados}
                        </span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-500">{row.carteraTotal}</span>
                      </div>
                      <div className={`text-xs font-medium mt-0.5 ${pctColor(row.carteraPct)}`}>
                        {row.carteraPct}%
                      </div>
                      <div className="mt-1 h-1 w-16 mx-auto bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor(row.carteraPct)}`}
                          style={{ width: `${Math.min(row.carteraPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>

                {/* Acciones */}
                <td className="px-5 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onToggle(row.codigoEmpleado)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      openEmpleado === row.codigoEmpleado
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                        : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                    }`}
                  >
                    {openEmpleado === row.codigoEmpleado ? (
                      <><X className="w-3.5 h-3.5" /> Cerrar</>
                    ) : (
                      <><Eye className="w-3.5 h-3.5" /> Ver</>
                    )}
                  </button>
                </td>

                {/* Ruta */}
                <td className="px-3 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => setRutaRow(row)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
                    title="Ver ruta del día"
                  >
                    <Map className="w-3.5 h-3.5" />
                    Ruta
                  </button>
                </td>
              </tr>

              {/* Detalle expandible */}
              {openEmpleado === row.codigoEmpleado && (
                <tr>
                  <td
                    colSpan={7}
                    className="bg-gradient-to-br from-gray-50 to-blue-50/30 px-6 py-5"
                  >
                    {loadingDetalle && !detalles[row.codigoEmpleado] ? (
                      <div className="flex items-center justify-center py-8 text-blue-600">
                        <Loader2 className="w-6 h-6 animate-spin mr-3" />
                        <span className="font-medium">Cargando movimientos...</span>
                      </div>
                    ) : erroresDetalle[row.codigoEmpleado] ? (
                      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <span>{erroresDetalle[row.codigoEmpleado]}</span>
                      </div>
                    ) : detalles[row.codigoEmpleado] ? (
                      <FichajesDetallePanel
                        rows={detalles[row.codigoEmpleado].rows}
                        diaSemanaLabel={diaSemanaLabel}
                      />
                    ) : null}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>

      {/* Modal de ruta */}
      {rutaRow && (
        <RutaMapModal
          empleado={rutaRow.codigoEmpleado}
          nombreVendedor={rutaRow.nombreVendedor ?? rutaRow.codigoEmpleado}
          fecha={fecha}
          onClose={() => setRutaRow(null)}
        />
      )}
    </>
  );
}
