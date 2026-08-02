import type { Pdv } from '../types';
import { diaLabel } from './colors';

// Port de getZoneStats/ptToRow de mapa_universo_enro.html, más computeOverlaps
// (antes inline dentro de exportExcel) extraída como función pura.

export interface ZoneStats {
  Zona: string;
  PDV_Total: number;
  Vendedores_Distintos: number;
  Facturacion: number;
  Lunes: number;
  Martes: number;
  Miercoles: number;
  Jueves: number;
  Viernes: number;
  Sabado: number;
  Domingo: number;
  Sin_Dia: number;
}

export function getZoneStats(pts: Pdv[], nombre: string): ZoneStats {
  const dias: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  pts.forEach((p) => {
    const d = p.dia ?? 0;
    if (dias[d] !== undefined) dias[d]++;
  });
  return {
    Zona: nombre,
    PDV_Total: pts.length,
    Vendedores_Distintos: new Set(pts.flatMap((p) => p.vendedores.map((v) => v.cod))).size,
    Facturacion: pts.reduce((acc, p) => acc + p.facturacion, 0),
    Lunes: dias[1], Martes: dias[2], Miercoles: dias[3], Jueves: dias[4],
    Viernes: dias[5], Sabado: dias[6], Domingo: dias[7], Sin_Dia: dias[0],
  };
}

export function ptToRow(p: Pdv, zona: string) {
  return {
    Zona: zona,
    Cuenta: p.id,
    Nombre: p.n,
    Direccion: p.dir,
    Localidad: p.loc,
    Partido: p.par,
    Rubro: p.com,
    // Vendedor_Cod/Nombre: solo el predeterminado (compat con lo que ya se exportaba);
    // Vendedores: todas las asignaciones, para clientes con más de un vendedor.
    Vendedor_Cod: p.vnd_cod,
    Vendedor_Nombre: p.vnd_nombre,
    Vendedores: p.vendedores.map((v) => `${v.nombre || v.cod} (${v.cod})`).join(' | '),
    Dia_Visita: diaLabel(p.dia),
    Frecuencia: p.frq,
    Reparto: p.reparto,
    Facturacion: p.facturacion,
    Proveedores: p.proveedores.join(', '),
    Divisiones: p.divisiones.join(', '),
    Lineas: p.lineas.join(', '),
    Articulos: p.articulos.map((a) => a.nombre).join(', '),
    Latitud: p.lat,
    Longitud: p.lng,
  };
}

export interface ZonaConPuntos {
  nombre: string;
  pts: Pdv[];
}

export function computeOverlaps(zonasConPuntos: ZonaConPuntos[]) {
  const pdvZonas = new Map<string, { p: Pdv; zonas: string[] }>();
  zonasConPuntos.forEach(({ nombre, pts }) => {
    pts.forEach((p) => {
      if (!pdvZonas.has(p.id)) pdvZonas.set(p.id, { p, zonas: [] });
      pdvZonas.get(p.id)!.zonas.push(nombre);
    });
  });

  return [...pdvZonas.values()]
    .filter(({ zonas }) => zonas.length > 1)
    .map(({ p, zonas }) => ({
      Cuenta: p.id,
      Nombre: p.n,
      Direccion: p.dir,
      Localidad: p.loc,
      Partido: p.par,
      Rubro: p.com,
      Vendedor: p.vnd_nombre || p.vnd_cod,
      Facturacion: p.facturacion,
      Cantidad_Zonas: zonas.length,
      Zonas: zonas.join(' | '),
      Latitud: p.lat,
      Longitud: p.lng,
    }));
}
