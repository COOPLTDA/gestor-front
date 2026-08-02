import React from "react";
import { Eye, X, Loader2, AlertTriangle, MinusCircle } from "lucide-react";
import { InfoTooltip, DEFINICIONES } from "./InfoTooltip";
import type { FichajeRow, DetalleCobertura } from "../Fichajes";
import { FichajesDetallePanel } from "./FichajesDetallePanel";

type Props = {
  items: FichajeRow[];
  openEmpleado: string | null;
  detalles: Record<string, DetalleCobertura>;
  loadingDetalle: boolean;
  erroresDetalle: Record<string, string>;
  diaSemanaLabel: string;
  umbralMinutos?: number;
  onToggle: (emp: string) => void;
};

function timeToMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}

export function FichajesCards({
  items,
  openEmpleado,
  detalles,
  loadingDetalle,
  erroresDetalle,
  diaSemanaLabel,
  umbralMinutos = 525,
  onToggle,
}: Props) {
  const pctColor = (v: number) =>
    v >= 70 ? "text-green-600" : v >= 40 ? "text-amber-600" : "text-red-600";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((row) => (
        <div
          key={row.codigoEmpleado}
          className={`rounded-2xl shadow-lg border overflow-hidden hover:shadow-xl transition-all ${
            !row.tieneRegistro
              ? "bg-gray-50 border-gray-200 opacity-75 shadow-gray-100/50"
              : "bg-white border-gray-100 shadow-gray-200/50"
          }`}
        >
          <div className="p-5">
            {/* Header de la card */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/25 shrink-0">
                  {(row.nombreVendedor ?? "").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-gray-800">{row.nombreVendedor}</div>
                  <div className="text-xs text-gray-400">{row.zona}</div>
                </div>
              </div>
              {!row.tieneRegistro ? (
                <span className="flex items-center gap-1 text-gray-400 bg-gray-200 px-2 py-1 rounded-full text-xs font-semibold shrink-0">
                  <MinusCircle className="w-3 h-3" />
                  Sin actividad
                  <InfoTooltip text={DEFINICIONES.sinActividad} />
                </span>
              ) : (() => { const m = timeToMin(row.primerCheckinValidoHora); return m !== null && m <= umbralMinutos; })() ? (
                <span className="flex items-center gap-1 text-green-600 bg-green-100 px-2 py-1 rounded-full text-xs font-semibold shrink-0">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Puntual
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 bg-amber-100 px-2 py-1 rounded-full text-xs font-semibold shrink-0">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  Tarde
                </span>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-gray-800">
                  {row.primerCheckinValidoHora ? row.primerCheckinValidoHora.slice(0, 5) : "—"}
                </div>
                <div className="text-xs text-gray-500">1er Check-in</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold">
                  <span className="text-green-600">{row.totalCheckinsValidos}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-500">{row.totalCheckins}</span>
                </div>
                <div className="text-xs text-gray-500">Válidos/Total</div>
              </div>
              {row.carteraTotal > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 text-center col-span-2">
                  <div className={`text-lg font-bold ${pctColor(row.carteraPct)}`}>
                    {row.carteraVisitados}/{row.carteraTotal}
                  </div>
                  <div className="text-xs text-gray-500">Cartera {row.carteraPct}%</div>
                </div>
              )}
            </div>

            {/* Toggle button */}
            <button
              type="button"
              onClick={() => onToggle(row.codigoEmpleado)}
              className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                openEmpleado === row.codigoEmpleado
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              {openEmpleado === row.codigoEmpleado ? (
                <>
                  <X className="w-4 h-4" /> Cerrar
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" /> Ver movimientos
                </>
              )}
            </button>
          </div>

          {/* Panel expandible */}
          {openEmpleado === row.codigoEmpleado && (
            <div className="border-t border-gray-100 bg-gray-50 p-4 max-h-64 overflow-y-auto">
              {loadingDetalle && !detalles[row.codigoEmpleado] ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : erroresDetalle[row.codigoEmpleado] ? (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{erroresDetalle[row.codigoEmpleado]}</span>
                </div>
              ) : detalles[row.codigoEmpleado] ? (
                <FichajesDetallePanel
                  rows={detalles[row.codigoEmpleado].rows}
                  diaSemanaLabel={diaSemanaLabel}
                />
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
