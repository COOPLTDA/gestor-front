export interface VendedorAsignacion {
  cod: string;
  nombre: string | null;
  dia: number | null;
  frq: string | null;
  reparto: string | null;
}

export interface Articulo {
  id: string;
  nombre: string;
}

export interface Pdv {
  id: string;
  n: string;
  dir: string;
  com: string | null;
  loc: string;
  par: string;
  lat: number;
  lng: number;
  desactivado: boolean;
  vnd_cod: string | null;
  vnd_nombre: string | null;
  dia: number | null;
  frq: string | null;
  reparto: string | null;
  /** Todas las asignaciones de vendedor del cliente (vnd_cod/vnd_nombre/dia/frq/reparto arriba son solo la predeterminada). */
  vendedores: VendedorAsignacion[];
  /** Facturación dentro del rango de fechas filtrado (ver RangoVentas). */
  facturacion: number;
  proveedores: string[];
  divisiones: string[];
  lineas: string[];
  articulos: Articulo[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Snapshot de con qué criterio se armó una zona: filtros activos + PDV excluidos a mano. */
export interface Criterios {
  filtros: Filtros;
  excluidos: string[];
}

export interface Zona {
  id?: number;
  nombre: string;
  color: string;
  vertices: LatLng[];
  /** Con qué criterio se armó la zona (trazabilidad) — null en zonas creadas antes de esta función. */
  criterios: Criterios | null;
}

export type TipoGrupo = 'ruta_flete' | 'ruta_vendedor' | 'reestructuracion';

export const TIPO_GRUPO_LABEL: Record<TipoGrupo, string> = {
  ruta_flete: 'Ruta Flete',
  ruta_vendedor: 'Ruta Vendedor',
  reestructuracion: 'Reestructuración',
};

export interface UsuarioBasico {
  id: number;
  nombre: string | null;
}

export interface Grupo {
  id: number;
  nombre: string;
  tipo: TipoGrupo;
  creadoPor: UsuarioBasico;
  editablePorOtros: boolean;
  zonas: Zona[];
}

export type ColorScheme = 'tipo' | 'dia' | 'vendedor' | 'reparto';

export type FiltroActivo = 'activos' | 'desactivados' | 'todos';

export interface Filtros {
  comercio: string[];
  partido: string[];
  frecuencia: string[];
  search: string;
  dia: string[];
  vndCod: string[];
  proveedor: string[];
  division: string[];
  linea: string[];
  articulo: string[];
  activo: FiltroActivo;
  /** Rango de facturación (dentro del rango de fechas elegido) — null = sin límite. */
  facturacionMin: number | null;
  facturacionMax: number | null;
}

export const FILTROS_VACIOS: Filtros = {
  comercio: [],
  partido: [],
  frecuencia: [],
  search: '',
  dia: [],
  vndCod: [],
  proveedor: [],
  division: [],
  linea: [],
  articulo: [],
  activo: 'activos',
  facturacionMin: null,
  facturacionMax: null,
};
