export interface Pedido {
  codigo: string;
  codigo_despacho: string | null;
  codigo_cliente_ubicacion: string | null;
  cliente_nombre: string | null;
  cliente_direccion: string | null;
  cliente_lat: number | null;
  cliente_lng: number | null;
  estado: string;
  pendiente_sigma?: boolean;
  importe: number;
  peso_text: string | null;
  volumen_text: string | null;
  peso: number;
  volumen: number;
  fecha: string;
}

export interface Chofer {
  codigo: string;
  descripcion: string;
  desactivado: number;
}

export interface CodigoDespacho {
  id: number | string;
  nombre: string | null;
  desactivado: number;
  choferes?: string[];
  direccion: string | null;
  camion?: string | null;
  zona_id?: number | null;
  es_excepcion?: boolean;
  excepcion_id?: number; // id de BIBLIA_repartos_excepcionales (solo en virtuales es_excepcion)
}

// 'bloqueado': pedidos ya no Pendiente en Sigma al asignar — no se intenta impactar
// 'fallido':   se intentó impactar y falló (estado cambió entre asignación e impacto)
export type SigmaSyncEstado = 'no_aplica' | 'pendiente' | 'ok' | 'fallido' | 'bloqueado';

export interface Preparacion {
  id: number;
  tipo: string;
  estado: string | null;
  codigo_envio: string | null;
  pedidos: Pedido[];
  cantidad_pedidos: number;
  cantidad_clientes: number;
  importe_total: number;
  peso: number;
  volumen: number;
  peso_text: string;
  volumen_text: string;
  fecha_hora_estado?: string;
  reasignable?: boolean;
  sigma_sync_estado?: SigmaSyncEstado;
}

export interface RepartoExcepcional {
  id: number;
  chofer_codigo: string;
  chofer_nombre: string;
  codigo_reparto: string;
  codigo_despacho_id: string;
  fecha: string;
  created_at?: string;
}

export interface GrupoDireccion {
  direccion: string;
  total_clientes_unicos: number;
  repartos: RepartoReporte[];
}

export interface RepartoReporte {
  codigo_numerico: number;
  nombre: string;
  chofer_codigo: string;
  chofer_nombre: string;
  tipo_agrupa_direccion: number;
  tipo_consolidado: number;
  tipo_individual: number;
  total_importe: number;
  total_pedidos: number;
  total_clientes: number;
  clientes_unicos: string[];
  detalle: DetallePreparacion[];
  caso: 'propia' | 'sin_asignar' | 'otra_biblia';
  biblia_fecha_asignada: string | null;
}

export interface DetallePreparacion {
  preparacion_id: number;
  tipo: string;
  importe: number;
  pedidos: number;
  clientes: number;
}
