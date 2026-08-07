import { request } from './zonificacionRequest';
import type { Grupo, Pdv, TipoGrupo, Zona } from '@/pages/zonificacion/types';

const BASE = '/api/gestor/zonificacion';

export interface NuevoGrupo {
  nombre: string;
  tipo: TipoGrupo;
  editablePorOtros: boolean;
  zonas?: Zona[];
}

export interface CambiosGrupo {
  nombre?: string;
  tipo?: TipoGrupo;
  editablePorOtros?: boolean;
  zonas?: Zona[];
}

export interface RangoVentas {
  desde: string;
  hasta: string;
}

export function fetchPdv(rango?: RangoVentas): Promise<Pdv[]> {
  const query = rango ? `?desde=${rango.desde}&hasta=${rango.hasta}` : '';
  return request<Pdv[]>(`${BASE}/pdv${query}`);
}

export function fetchGrupos(): Promise<Grupo[]> {
  return request<Grupo[]>(`${BASE}/grupos`);
}

export function crearGrupo(nuevo: NuevoGrupo): Promise<Grupo> {
  return request<Grupo>(`${BASE}/grupos`, {
    method: 'POST',
    body: JSON.stringify(nuevo),
  });
}

export function actualizarGrupo(id: number, cambios: CambiosGrupo): Promise<{ ok: true }> {
  return request<{ ok: true }>(`${BASE}/grupos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(cambios),
  });
}

export function eliminarGrupo(id: number): Promise<{ ok: true }> {
  return request<{ ok: true }>(`${BASE}/grupos/${id}`, { method: 'DELETE' });
}
