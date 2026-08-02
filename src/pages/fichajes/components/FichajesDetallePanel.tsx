import React, { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Circle, PackageX, MapPin, X, Timer } from "lucide-react";
import type { DetalleRow } from "../Fichajes";

type Props = {
  rows: DetalleRow[];
  diaSemanaLabel: string;
};

function buildEmbedUrl(lat: string | number | null, lng: string | number | null): string | null {
  if (!lat || !lng) return null;
  return `https://maps.google.com/maps?q=${lat},${lng}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
}

function parseCoordenadas(coords: string | null): { lat: string; lng: string } | null {
  if (!coords || !String(coords).includes(';')) return null;
  const [lat, lng] = String(coords).split(';');
  return { lat, lng };
}

// ─────────────────────────────────────────────────────────────
// MAP MODAL
// ─────────────────────────────────────────────────────────────

function MapFrame({ src, title }: { src: string | null; title: string }) {
  if (!src) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs bg-gray-50">
        Sin coordenadas
      </div>
    );
  }
  return (
    <iframe
      src={src}
      width="100%"
      height="100%"
      style={{ border: 0 }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title={title}
    />
  );
}

function MapModal({ row, onClose }: { row: DetalleRow; onClose: () => void }) {
  const checkinCoords = parseCoordenadas(row.coordenadasCheckin);
  const checkinEmbed  = buildEmbedUrl(checkinCoords?.lat ?? null, checkinCoords?.lng ?? null);
  const clienteEmbed  = buildEmbedUrl(row.clienteLatitud, row.clienteLongitud);

  const direccion = [row.clienteCalle, row.clienteAltura, row.clienteLocalidad]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="font-semibold text-gray-800 text-sm">
              <span className="font-mono text-gray-500 mr-2">{row.codigoCliente}</span>
              {row.clienteNombre}
            </div>
            {direccion && (
              <div className="text-xs text-gray-400 mt-0.5">{direccion}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dos mapas en paralelo */}
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          <div className="flex flex-col">
            <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
              <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Checkin del vendedor
              </p>
              {checkinCoords && (
                <p className="text-[10px] text-indigo-400 font-mono mt-0.5">
                  {checkinCoords.lat}, {checkinCoords.lng}
                </p>
              )}
            </div>
            <div className="h-[380px]">
              <MapFrame src={checkinEmbed} title={`Checkin ${row.codigoCliente}`} />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Ubicación del cliente
              </p>
              {row.clienteLatitud && row.clienteLongitud && (
                <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                  {row.clienteLatitud}, {row.clienteLongitud}
                </p>
              )}
            </div>
            <div className="h-[380px]">
              <MapFrame src={clienteEmbed} title={`Cliente ${row.codigoCliente}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────

type Filtro = "validos" | "invalidos" | "fuera" | "pendientes" | null;

export function FichajesDetallePanel({ rows, diaSemanaLabel }: Props) {
  const [mapRow, setMapRow] = useState<DetalleRow | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(null);

  const asignados  = rows.filter(r => r.asignado);
  const fuera      = rows.filter(r => !r.asignado);
  const validos    = asignados.filter(r => r.visitado &&  r.tieneValido);
  const invalidos  = asignados.filter(r => r.visitado && !r.tieneValido);
  const pendientes = asignados.filter(r => !r.visitado);

  const filteredRows = filtro === "validos"    ? rows.filter(r =>  r.asignado &&  r.visitado &&  r.tieneValido)
                     : filtro === "invalidos"  ? rows.filter(r =>  r.asignado &&  r.visitado && !r.tieneValido)
                     : filtro === "fuera"      ? rows.filter(r => !r.asignado)
                     : filtro === "pendientes" ? rows.filter(r =>  r.asignado && !r.visitado)
                     : rows;

  // Tiempo de traslado entre clientes visitados consecutivos (checkout actual → checkin siguiente)
  const transitMap = new Map<string, number>();
  const visitedSorted = [...rows]
    .filter(r => r.visitado && r.timestampCheckin)
    .sort((a, b) => (a.timestampCheckin ?? "").localeCompare(b.timestampCheckin ?? ""));
  visitedSorted.forEach((curr, i) => {
    if (i < visitedSorted.length - 1) {
      const next = visitedSorted[i + 1];
      if (curr.timestampCheckout && next.timestampCheckin) {
        const diff = Math.round(
          (new Date(next.timestampCheckin).getTime() - new Date(curr.timestampCheckout).getTime()) / 60000
        );
        if (diff > 0) transitMap.set(curr.codigoCliente, diff);
      }
    }
  });

  function toggleFiltro(f: Filtro) {
    setFiltro(prev => prev === f ? null : f);
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <PackageX className="w-10 h-10 mb-2" />
        <span className="text-sm">Sin clientes asignados para este día</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
            Cartera del {diaSemanaLabel}
            <span className="text-xs font-normal text-gray-400">({asignados.length} clientes)</span>
          </h4>
          <div className="flex items-center gap-2">
            {filtro !== null && (
              <button
                onClick={() => setFiltro(null)}
                className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
              >
                Mostrar todos
              </button>
            )}
            <button
              onClick={() => toggleFiltro("validos")}
              className={`text-xs px-2 py-1 rounded-full transition-all ${
                filtro === "validos"
                  ? "bg-green-600 text-white ring-2 ring-green-400 ring-offset-1"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              {validos.length} válidos
            </button>
            <button
              onClick={() => toggleFiltro("invalidos")}
              className={`text-xs px-2 py-1 rounded-full transition-all ${
                filtro === "invalidos"
                  ? "bg-red-600 text-white ring-2 ring-red-400 ring-offset-1"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
            >
              {invalidos.length} inválidos
            </button>
            <button
              onClick={() => toggleFiltro("fuera")}
              className={`text-xs px-2 py-1 rounded-full transition-all ${
                filtro === "fuera"
                  ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
            >
              {fuera.length} fuera ruta
            </button>
            <button
              onClick={() => toggleFiltro("pendientes")}
              className={`text-xs px-2 py-1 rounded-full transition-all ${
                filtro === "pendientes"
                  ? "bg-amber-500 text-white ring-2 ring-amber-400 ring-offset-1"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              }`}
            >
              {pendientes.length} pendientes
            </button>
          </div>
        </div>

        {filteredRows.length === 0 && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            Sin clientes en esta categoría
          </div>
        )}

        {filteredRows.map((r, i) => {
          const borderClass = !r.asignado
            ? "bg-blue-50/50 border-blue-200"
            : !r.visitado
            ? "bg-amber-50/50 border-amber-200"
            : r.tieneValido
            ? "bg-white border-green-200"
            : "bg-red-50/50 border-red-200";

          const iconBg = !r.asignado
            ? "bg-blue-100"
            : !r.visitado
            ? "bg-amber-100"
            : r.tieneValido
            ? "bg-green-100"
            : "bg-red-100";

          const Icon = !r.asignado
            ? Circle
            : !r.visitado
            ? Clock
            : r.tieneValido
            ? CheckCircle2
            : AlertTriangle;

          const iconColor = !r.asignado
            ? "text-blue-500"
            : !r.visitado
            ? "text-amber-500"
            : r.tieneValido
            ? "text-green-600"
            : "text-red-500";

          const direccion = [r.clienteCalle, r.clienteAltura, r.clienteLocalidad]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl px-4 py-3 shadow-sm border transition-all hover:shadow-md ${borderClass}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div>
                  <div className="font-medium text-gray-800 text-sm">
                    <span className="font-mono">{r.codigoCliente}</span>
                    {r.clienteNombre && (
                      <span className="text-gray-400 ml-1 text-xs">{r.clienteNombre}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {direccion && (
                      <span className="text-xs text-gray-500">{direccion}</span>
                    )}
                    {!r.asignado && r.diaDeVisita && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                        Asig: {r.diaDeVisita}
                      </span>
                    )}
                    {!r.asignado && !r.diaDeVisita && (
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        Sin ruta
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end shrink-0">
                {r.mapsUrl && r.visitado && (
                  <button
                    onClick={() => setMapRow(r)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-full transition-colors border border-indigo-200"
                  >
                    <MapPin className="w-3 h-3" />
                    Mapa
                  </button>
                )}
                {r.visitado && (
                  <div className="flex flex-row items-center gap-2">
                    {/* Caja checkin → checkout */}
                    <div className={`border rounded-lg px-2.5 py-1.5 text-right ${
                      r.tieneValido
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}>
                      {!r.tieneValido && (
                        <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-0.5">Inválido</div>
                      )}
                      <div className="font-mono font-bold text-gray-700 text-sm">
                        {(r.timestampCheckin ?? "").slice(11, 16)}
                        {r.timestampCheckout && (
                          <span className="text-gray-400 font-normal"> → {r.timestampCheckout.slice(11, 16)}</span>
                        )}
                      </div>
                      {r.duracion != null && r.duracion > 0 && (
                        <div className="text-[11px] text-gray-400 mt-0.5">{r.duracion} min en punto</div>
                      )}
                    </div>
                    {/* Caja tiempo de traslado al próximo cliente */}
                    <div className="border border-violet-200 bg-violet-50 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                      <Timer className="w-3 h-3 text-violet-400 shrink-0" />
                      <span className="text-[11px] font-medium text-violet-600 leading-tight">
                        <div>{transitMap.get(r.codigoCliente) ?? 0} min traslado</div>
                        <div>prox. PDV</div>
                      </span>
                    </div>
                  </div>
                )}
                {!r.visitado && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                    Sin visita
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de mapa */}
      {mapRow && <MapModal row={mapRow} onClose={() => setMapRow(null)} />}
    </>
  );
}
