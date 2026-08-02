import type { RangoVentas } from '@/services/zonificacionApi';

const MESES_DEFAULT = 1;

/** Mismo default que el backend cuando no se pasa desde/hasta (ver pdvService.js). */
export function defaultRangoVentas(): RangoVentas {
  const hasta = new Date();
  const desde = new Date();
  desde.setMonth(desde.getMonth() - MESES_DEFAULT);
  return { desde: toISODate(desde), hasta: toISODate(hasta) };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "2025-07-28" -> "28/07/2025", para mostrar el rango filtrado en labels de facturación. */
function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Ej: "28/07/2025–28/07/2026", usado en los labels de "Facturación" en vez del fijo "(12m)". */
export function formatRangoVentas(rango: RangoVentas): string {
  return `${formatFecha(rango.desde)}–${formatFecha(rango.hasta)}`;
}
