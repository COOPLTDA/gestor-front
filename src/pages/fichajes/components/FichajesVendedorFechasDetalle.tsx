import React, { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";
import { FichajesDetallePanel } from "./FichajesDetallePanel";
import type { DetalleCobertura } from "../Fichajes";

type EvolucionDia = {
  fecha: string;
  llego_a_tiempo: boolean;
  totalCheckins: number;
  primer_checkin: string | null;
  primer_checkin_minutos: number | null;
  cartera: number;
  cartera_validos: number;
  cartera_invalidos: number;
  sin_visitar: number;
  fuera_validos: number;
  fuera_invalidos: number;
  ultimo_checkin: string | null;
  total_duracion_minutos: number;
  promedio_duracion_minutos: number | null;
};

function formatMinutos(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

type Props = {
  evolucion: EvolucionDia[];
  empleado: string;
  umbralMinutos: number;
};

function getDiaSemanaLabel(fechaStr: string): string {
  const d = new Date(fechaStr + "T12:00:00");
  return ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][d.getDay()];
}

function formatFecha(fechaStr: string): string {
  const d = new Date(fechaStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

export function FichajesVendedorFechasDetalle({ evolucion, empleado, umbralMinutos }: Props) {
  const [openFechas, setOpenFechas]   = useState<Set<string>>(new Set());
  const [detalles,   setDetalles]     = useState<Record<string, DetalleCobertura>>({});
  const [loadings,   setLoadings]     = useState<Record<string, boolean>>({});
  const [errores,    setErrores]      = useState<Record<string, string>>({});

  const toggle = async (fecha: string) => {
    setOpenFechas(prev => {
      const next = new Set(prev);
      if (next.has(fecha)) { next.delete(fecha); return next; }
      next.add(fecha);
      return next;
    });

    if (detalles[fecha] || errores[fecha] || loadings[fecha]) return;

    setLoadings(prev => ({ ...prev, [fecha]: true }));
    try {
      const res  = await fetchWithAuth(`${API.FICHAJES.DETALLE(empleado)}?fecha=${encodeURIComponent(fecha)}`);
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      const data = await res.json() as any;
      if (data.error) throw new Error(data.msg ?? "Error del servidor");
      setDetalles(prev => ({ ...prev, [fecha]: data }));
    } catch (e: any) {
      setErrores(prev => ({ ...prev, [fecha]: e.message ?? "Error" }));
    } finally {
      setLoadings(prev => ({ ...prev, [fecha]: false }));
    }
  };

  if (evolucion.length === 0) return null;

  return (
    <div className="mt-5 space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Detalle por fecha</h4>

      {evolucion.map(dia => {
        const open    = openFechas.has(dia.fecha);
        const loading = loadings[dia.fecha];
        const detalle = detalles[dia.fecha];
        const error   = errores[dia.fecha];
        const diaNombre = getDiaSemanaLabel(dia.fecha);
        const aTiempo = dia.primer_checkin_minutos !== null && dia.primer_checkin_minutos <= umbralMinutos;

        return (
          <div key={dia.fecha} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Fila colapsable */}
            <button
              type="button"
              onClick={() => toggle(dia.fecha)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${open ? "bg-blue-50 border-b border-blue-100" : "bg-white hover:bg-gray-50"}`}
            >
              {/* Chevron */}
              <span className="text-gray-400 shrink-0">
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>

              {/* Puntualidad dot */}
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${aTiempo ? "bg-green-500" : "bg-red-400"}`} />

              {/* Fecha + día */}
              <span className="font-semibold text-gray-800 text-sm w-28 shrink-0">
                {diaNombre} {formatFecha(dia.fecha)}
              </span>

              {/* Checkins: primero → último */}
              <span className="font-mono text-xs text-purple-600 shrink-0 w-28">
                {dia.primer_checkin ?? "—"}
                {dia.ultimo_checkin && dia.ultimo_checkin !== dia.primer_checkin && (
                  <> → {dia.ultimo_checkin}</>
                )}
              </span>

              {/* Duración total y promedio */}
              <span className="text-xs text-gray-500 shrink-0 w-36">
                {dia.total_duracion_minutos > 0 && (
                  <>{formatMinutos(dia.total_duracion_minutos)}
                    {dia.promedio_duracion_minutos != null && (
                      <span className="text-gray-400"> · ø {dia.promedio_duracion_minutos} min</span>
                    )}
                  </>
                )}
              </span>

              {/* Resumen de cartera */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
                  <span className="text-emerald-700 font-medium">{dia.cartera_validos}</span>
                  <span className="text-gray-400">vál</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />
                  <span className="text-amber-700 font-medium">{dia.cartera_invalidos}</span>
                  <span className="text-gray-400">inv</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-gray-300 inline-block" />
                  <span className="text-gray-600 font-medium">{dia.sin_visitar}</span>
                  <span className="text-gray-400">pend</span>
                </span>
                {(dia.fuera_validos > 0 || dia.fuera_invalidos > 0) && (
                  <>
                    <span className="text-gray-300 mx-1">|</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" />
                      <span className="text-blue-700 font-medium">{dia.fuera_validos}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />
                      <span className="text-red-600 font-medium">{dia.fuera_invalidos}</span>
                    </span>
                    <span className="text-gray-400 text-[10px]">fuera ruta</span>
                  </>
                )}
              </div>

              {/* Total cartera del día (derecha) */}
              <span className="ml-auto text-xs text-gray-400 shrink-0">
                {dia.cartera} clientes
              </span>
            </button>

            {/* Panel expandido */}
            {open && (
              <div className="px-4 py-4 bg-white">
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-6 text-blue-500 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Cargando detalle...
                  </div>
                )}
                {error && (
                  <div className="text-sm text-red-600 py-4 text-center">{error}</div>
                )}
                {!loading && !error && detalle && (
                  <FichajesDetallePanel
                    rows={detalle.rows}
                    diaSemanaLabel={diaNombre}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
