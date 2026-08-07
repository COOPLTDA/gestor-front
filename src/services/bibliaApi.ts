import { request } from './bibliaRequest'
import type { Preparacion, Chofer, CodigoDespacho, RepartoExcepcional, GrupoDireccion, SigmaSyncEstado } from '@/pages/biblia/types/biblia'

export interface SyncEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  message: string;
  stage?: string;
  current?: number;
  total?: number;
  progress?: number;
  source?: string;
  error?: string;
}

function makeSyncSubscriber(path: string) {
  return (
    onEvent: (e: SyncEvent) => void,
    onError?: (err: string) => void,
  ): (() => void) => {
    // La sesión viaja en cookies httpOnly: EventSource las envía automáticamente
    // en requests same-origin, así que no hace falta token en la query string
    // (resuelve el diferido N1 del reporte #5 de la Biblia standalone).
    const es = new EventSource(path)
    let completed = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      completed = true
      if (timeoutId) clearTimeout(timeoutId)
      es.close()
    }

    // Timeout después de 10 minutos para evitar memory leaks
    timeoutId = setTimeout(() => {
      if (!completed) {
        onError?.('Conexión SSE expirada')
        cleanup()
      }
    }, 10 * 60 * 1000)

    es.onmessage = (msg) => {
      try {
        const event: SyncEvent = JSON.parse(msg.data)
        if (event.stage === 'done' || event.type === 'complete') {
          cleanup()
        }
        if (event.type === 'error' || event.stage === 'error') {
          onError?.(event.error || event.message)
          cleanup()
        } else {
          onEvent(event)
        }
      } catch {
        onError?.('Error parseando evento SSE')
        cleanup()
      }
    }

    es.onerror = () => {
      if (!completed) {
        onError?.('Error de conexión SSE')
      }
      cleanup()
    }

    return cleanup
  }
}

export const subscribeSyncAll = makeSyncSubscriber('/api/gestor/biblia/sync/all/stream')
export const subscribeSyncHoy = makeSyncSubscriber('/api/gestor/biblia/sync/hoy/stream')

export function subscribeSyncEvents(onSyncComplete: () => void): () => void {
  const es = new EventSource('/api/gestor/biblia/sync/events')

  es.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data)
      if (event.type === 'sync-complete') onSyncComplete()
    } catch {
      // evento SSE malformado — no hay nada que notificar
    }
  }

  return () => es.close()
}

export async function fetchSyncStatus(): Promise<{ lastSync: string | null; dataVersion: string; pedidosSnapshot: Record<string, number> }> {
  return request('/api/gestor/biblia/sync/status')
}

export async function fetchPreparaciones(params: {
  fecha_desde?: string;
  fecha_hasta?: string;
  estado?: string;
  tipo?: string;
  page?: number;
  pageSize?: number;
}): Promise<Preparacion[]> {
  const query = new URLSearchParams();
  if (params.fecha_desde) query.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta) query.set('fecha_hasta', params.fecha_hasta);
  if (params.estado) query.set('estado', params.estado);
  if (params.tipo) query.set('tipo', params.tipo);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  return request<Preparacion[]>(`/api/gestor/biblia/preparaciones?${query}`);
}

export async function fetchChoferes(params?: { fecha_desde?: string; fecha_hasta?: string; biblia_fecha?: string }): Promise<Chofer[]> {
  const query = new URLSearchParams()
  if (params?.fecha_desde) query.set('fecha_desde', params.fecha_desde)
  if (params?.fecha_hasta) query.set('fecha_hasta', params.fecha_hasta)
  if (params?.biblia_fecha) query.set('biblia_fecha', params.biblia_fecha)
  const qs = query.toString()
  return request<Chofer[]>(`/api/gestor/biblia/choferes${qs ? `?${qs}` : ''}`);
}

export async function fetchCodigosDespacho(): Promise<CodigoDespacho[]> {
  return request<CodigoDespacho[]>('/api/gestor/biblia/repartos');
}

export async function asignarPreparacionAChofer(
  preparacionId: number,
  choferCodigo: string,
  bibliaFecha: string,
  preparacionFecha: string,
  codigoDespachoDestino?: string | number | null,
  sigmaSyncEstado?: string | null,
): Promise<void> {
  await request(`/api/gestor/biblia/asignaciones/${preparacionId}/chofer`, {
    method: 'PUT',
    body: JSON.stringify({
      chofer_codigo: choferCodigo,
      biblia_fecha: bibliaFecha,
      preparacion_fecha: preparacionFecha,
      codigo_despacho_destino: codigoDespachoDestino ?? null,
      sigma_sync_estado: sigmaSyncEstado ?? null,
    }),
  });
}

export async function asignarPreparacionesBatch(
  asignaciones: { preparacion_id: number; chofer_codigo: string; biblia_fecha: string; preparacion_fecha: string }[],
): Promise<{ ok: boolean; count: number }> {
  return request(`/api/gestor/biblia/asignaciones/batch`, {
    method: 'POST',
    body: JSON.stringify({ asignaciones }),
  });
}

export async function fetchAsignaciones(): Promise<{
  preparacion_id: number;
  chofer_codigo: string;
  biblia_fecha: string;
  preparacion_fecha: string;
  codigo_despacho_destino?: string | null;
  sigma_sync_estado?: SigmaSyncEstado;
}[]> {
  return request(`/api/gestor/biblia/asignaciones`);
}

export async function searchChoferes(query: string): Promise<Chofer[]> {
  return request<Chofer[]>(`/api/gestor/biblia/choferes/search?q=${encodeURIComponent(query)}`);
}

export async function searchCodigosDespacho(query: string): Promise<CodigoDespacho[]> {
  return request<CodigoDespacho[]>(`/api/gestor/biblia/repartos/search?q=${encodeURIComponent(query)}`);
}

export async function fetchRepartosExcepcionales(fecha?: string): Promise<RepartoExcepcional[]> {
  const query = fecha ? `?fecha=${fecha}` : ''
  return request<RepartoExcepcional[]>(`/api/gestor/biblia/repartos-excepcionales${query}`);
}

export async function crearRepartoExcepcional(data: { chofer_codigo: string; chofer_nombre: string; codigo_reparto: string; codigo_despacho_id: string; fecha: string }): Promise<RepartoExcepcional> {
  return request<RepartoExcepcional>(`/api/gestor/biblia/repartos-excepcionales`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function eliminarRepartoExcepcional(id: number): Promise<void> {
  await request(`/api/gestor/biblia/repartos-excepcionales/${id}`, { method: 'DELETE' });
}

export async function limpiarAsignacionesBiblia(bibliaFecha: string): Promise<{ ok: boolean; deleted: number }> {
  return request(`/api/gestor/biblia/asignaciones/biblia/${bibliaFecha}`, { method: 'DELETE' });
}

export async function fetchRangoBiblia(
  bibliaFecha: string,
): Promise<{ fecha_desde: string; fecha_hasta: string } | null> {
  return request(`/api/gestor/biblia/reportes/rango-biblia?biblia_fecha=${bibliaFecha}`);
}

export interface ResumenChoferPrep {
  id: number
  estado: string | null
  codigo_envio: string | null
  importe_total: number
  cantidad_pedidos: number
  peso: number    // kg
  volumen: number // m³
}

export interface ResumenChofer {
  chofer_codigo: string
  chofer_nombre: string
  preps: ResumenChoferPrep[]
  total_importe: number
  total_pedidos: number
  total_peso: number    // kg
  total_volumen: number  // m³
  total_clientes: number
  codigos_despacho: string[]
}

export async function fetchResumenBiblia(bibliaFecha: string): Promise<ResumenChofer[]> {
  return request<ResumenChofer[]>(`/api/gestor/biblia/reportes/resumen-biblia?biblia_fecha=${bibliaFecha}`)
}

export async function fetchRepartosPorDireccion(
  fechaDesde: string,
  fechaHasta?: string,
  bibliaFecha?: string,
): Promise<GrupoDireccion[]> {
  const hasta = fechaHasta ?? fechaDesde;
  const params = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: hasta });
  if (bibliaFecha) params.set('biblia_fecha', bibliaFecha);
  return request<GrupoDireccion[]>(`/api/gestor/biblia/reportes/repartos-por-direccion?${params}`);
}

export interface MapaCliente {
  codigo: string
  descripcion: string
  lat: number
  lng: number
  codigo_despacho: string
  direccion: string
  choferes: { codigo: string; nombre: string }[]
  importe: number
}

export async function fetchMapaClientes(
  fechaDesde: string,
  fechaHasta?: string,
  bibliaFecha?: string,
): Promise<MapaCliente[]> {
  const hasta = fechaHasta ?? fechaDesde
  const params = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: hasta })
  if (bibliaFecha) params.set('biblia_fecha', bibliaFecha)
  return request<MapaCliente[]>(`/api/gestor/biblia/reportes/mapa-clientes?${params}`)
}

// --- Mantenimiento (CRUD admin) ---

export interface ChoferAdmin {
  codigo: string;
  descripcion: string | null;
  desactivado: number;
  chofer_padre_codigo?: string | null;
  rutas?: string[];
}

export interface CodigoDespachoAdmin {
  id: string;
  nombre: string | null;
  desactivado: number;
  camion?: string | null;
  direccion: string | null;
  zona_id?: number | null;
  choferes?: string[];
}

export interface ZonaAdmin {
  id: number;
  nombre: string;
  desactivado: number;
  repartos?: string[];
}

export async function fetchAllChoferes(): Promise<ChoferAdmin[]> {
  return request<ChoferAdmin[]>('/api/gestor/biblia/choferes/all');
}

export async function fetchAllCodigosDespacho(): Promise<CodigoDespachoAdmin[]> {
  return request<CodigoDespachoAdmin[]>('/api/gestor/biblia/repartos');
}

export async function createChofer(codigo: string, descripcion: string, choferPadreCodigo?: string | null): Promise<void> {
  await request('/api/gestor/biblia/choferes', {
    method: 'POST',
    body: JSON.stringify({ codigo, descripcion, chofer_padre_codigo: choferPadreCodigo ?? null }),
  });
}

export async function updateChofer(codigo: string, data: Partial<Pick<ChoferAdmin, 'descripcion' | 'desactivado' | 'chofer_padre_codigo'>>): Promise<void> {
  await request(`/api/gestor/biblia/choferes/${encodeURIComponent(codigo)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateCodigoDespacho(id: string, data: Partial<Pick<CodigoDespachoAdmin, 'zona_id' | 'desactivado'>>): Promise<void> {
  await request(`/api/gestor/biblia/repartos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function asignarChoferCodigoDespacho(codigoDespachoId: string, choferCodigo: string): Promise<void> {
  await request(`/api/gestor/biblia/repartos/${encodeURIComponent(codigoDespachoId)}/choferes`, {
    method: 'POST',
    body: JSON.stringify({ chofer_codigo: choferCodigo }),
  });
}

export async function desasignarChoferCodigoDespacho(codigoDespachoId: string, choferCodigo: string): Promise<void> {
  await request(`/api/gestor/biblia/repartos/${encodeURIComponent(codigoDespachoId)}/choferes/${encodeURIComponent(choferCodigo)}`, {
    method: 'DELETE',
  });
}

export async function fetchAllZonas(): Promise<ZonaAdmin[]> {
  return request<ZonaAdmin[]>('/api/gestor/biblia/zonas');
}

export async function createZona(nombre: string): Promise<number> {
  const res = await request<{ id: number }>('/api/gestor/biblia/zonas', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  });
  return res.id;
}

export async function updateZona(id: number, data: Partial<Pick<ZonaAdmin, 'nombre' | 'desactivado'>>): Promise<void> {
  await request(`/api/gestor/biblia/zonas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function asignarCodigoDespachoAZona(codigoDespachoId: string, zonaId: number): Promise<void> {
  await updateCodigoDespacho(codigoDespachoId, { zona_id: zonaId });
}

export async function desasignarCodigoDespachoDeZona(codigoDespachoId: string): Promise<void> {
  await updateCodigoDespacho(codigoDespachoId, { zona_id: null });
}

export async function modificarPedido(
  pedidoId: string,
  data: { repartoId?: number; nuevoCodigo?: string | null; fechaReparto?: string; observacion?: string },
  preparacionId: number,
  bibliaFecha: string,
): Promise<void> {
  await request(`/api/gestor/biblia/pedidos/${encodeURIComponent(pedidoId)}/reparto`, {
    method: 'PUT',
    body: JSON.stringify({
      ...data,
      nuevo_codigo_despacho: data.nuevoCodigo ?? null,
      preparacion_id: preparacionId,
      biblia_fecha: bibliaFecha,
    }),
  });
}

export interface PedidoCambioEstado {
  pedido_codigo: string;
  preparacion_id: number;
  nuevo_codigo_despacho: string | null;
  estado: 'pendiente' | 'ok' | 'fallido';
}

export async function fetchCambiosEstado(bibliaFecha: string): Promise<PedidoCambioEstado[]> {
  return request<PedidoCambioEstado[]>(`/api/gestor/biblia/sigma/cambios-estado?biblia_fecha=${bibliaFecha}`);
}

export interface ImpactarEnSigmaResult {
  ok: number[];
  fallido: number[];   // pedidos ya no estaban Pendiente en Sigma
  error: number[];     // error al llamar a la API de Sigma
  total: number;
}

export async function impactarEnSigma(
  bibliaFecha: string,
): Promise<ImpactarEnSigmaResult> {
  return request('/api/gestor/biblia/sigma/impactar', {
    method: 'POST',
    body: JSON.stringify({ biblia_fecha: bibliaFecha }),
  });
}
