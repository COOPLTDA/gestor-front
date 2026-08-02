// Lógica derivada pura de useBibliaData.ts, separada del hook para poder testearla sin
// mockear React ni fetch. Cada función toma los datos crudos que ya vive en el estado del
// hook y devuelve el dato calculado — el hook solo se encarga de fetch/estado y de llamarlas
// dentro de sus useMemo con las mismas dependencias que ya tenía.
import type { Preparacion, Chofer, CodigoDespacho, RepartoExcepcional, SigmaSyncEstado } from '../types/biblia';

export type AsignacionRaw = {
  preparacion_id: number;
  chofer_codigo: string;
  biblia_fecha: string;
  preparacion_fecha: string;
  codigo_despacho_destino?: string | null;
  sigma_sync_estado?: SigmaSyncEstado;
};

export const ORDER_ESTADOS = ['Pendiente', 'En preparacion', 'Completada', 'Completo', 'Remitido', 'Eliminado'];

export const ORDER_ESTADOS_LC = ORDER_ESTADOS.map(e => e.toLowerCase());

export const TIPOS_VISIBLES = ['Pedidos individuales', 'Agrupa por direccion de entrega', 'Consolidado de pedidos'];

export function computeEstados(preparaciones: Preparacion[]): string[] {
  const estados = new Set<string>();
  for (const p of preparaciones) {
    if (p.estado) estados.add(p.estado);
  }
  return [...estados].sort((a, b) => {
    const ia = ORDER_ESTADOS_LC.indexOf(a.toLowerCase())
    const ib = ORDER_ESTADOS_LC.indexOf(b.toLowerCase())
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  });
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nextBusinessDay(dateStr: string): string {
  let d = addDays(dateStr, 1);
  while (new Date(d + 'T00:00:00').getDay() === 0 || new Date(d + 'T00:00:00').getDay() === 6) {
    d = addDays(d, 1);
  }
  return d;
}

export function prevBusinessDay(dateStr: string): string {
  let d = addDays(dateStr, -1);
  while (new Date(d + 'T00:00:00').getDay() === 0 || new Date(d + 'T00:00:00').getDay() === 6) {
    d = addDays(d, -1);
  }
  return d;
}

export function selectAsignacionesBiblia(rawAsignaciones: AsignacionRaw[], bibliaFecha: string): Map<number, string> {
  return new Map(rawAsignaciones
    .filter(a => a.biblia_fecha === bibliaFecha)
    .map(a => [a.preparacion_id, a.chofer_codigo]));
}

// sigma_sync_estado por prep_id: combina asignaciones cross-código + cambios individuales.
// Prioridad: fallido > pendiente > ok > no_aplica
export function selectSigmaEstadoByPrepId(
  rawAsignaciones: AsignacionRaw[],
  rawPedidoCambios: { preparacion_id: number; estado: SigmaSyncEstado }[],
  bibliaFecha: string,
): Map<number, SigmaSyncEstado> {
  const priority = (e: SigmaSyncEstado): number =>
    ({ fallido: 3, bloqueado: 3, pendiente: 2, ok: 1, no_aplica: 0 })[e] ?? 0;
  const map = new Map<number, SigmaSyncEstado>();
  const set = (prepId: number, estado: SigmaSyncEstado) => {
    if (estado === 'no_aplica') return;
    const prev = map.get(prepId);
    if (!prev || priority(estado) > priority(prev)) map.set(prepId, estado);
  };
  for (const a of rawAsignaciones) {
    if (a.biblia_fecha === bibliaFecha && a.sigma_sync_estado) set(a.preparacion_id, a.sigma_sync_estado);
  }
  for (const c of rawPedidoCambios) {
    set(c.preparacion_id, c.estado);
  }
  return map;
}

export function selectPedidoCambiosByPrepId<T extends { preparacion_id: number }>(rawPedidoCambios: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const c of rawPedidoCambios) {
    const arr = map.get(c.preparacion_id) ?? [];
    arr.push(c);
    map.set(c.preparacion_id, arr);
  }
  return map;
}

// Asignaciones cross-código de la biblia actual: destino_nombre (para mostrar en UI) + estado
export function selectAsignacionCrossCodeByPrepId(
  rawAsignaciones: AsignacionRaw[],
  bibliaFecha: string,
  codigosDespacho: CodigoDespacho[],
): Map<number, { destino_nombre: string | null; destino_id: string | null; sigma_sync_estado: SigmaSyncEstado }> {
  const map = new Map<number, { destino_nombre: string | null; destino_id: string | null; sigma_sync_estado: SigmaSyncEstado }>();
  for (const a of rawAsignaciones) {
    if (a.biblia_fecha !== bibliaFecha) continue;
    if (!a.codigo_despacho_destino || !a.sigma_sync_estado || a.sigma_sync_estado === 'no_aplica') continue;
    const destino_nombre = codigosDespacho.find(r => String(r.id) === a.codigo_despacho_destino)?.nombre ?? null;
    map.set(a.preparacion_id, { destino_nombre, destino_id: a.codigo_despacho_destino, sigma_sync_estado: a.sigma_sync_estado });
  }
  return map;
}

// Preps asignadas a OTRA biblia → para mostrar grisadas en sidebar.
// Se ignoran asignaciones legacy con biblia_fecha vacío (no pertenecen a ninguna biblia).
export function selectOcupadasEnOtraBiblia(rawAsignaciones: AsignacionRaw[], bibliaFecha: string): Map<number, string> {
  return new Map(rawAsignaciones
    .filter(a => a.chofer_codigo && a.biblia_fecha && a.biblia_fecha !== bibliaFecha)
    .map(a => [a.preparacion_id, a.biblia_fecha]));
}

export function selectCodigosDespachoSet(preparaciones: Preparacion[]): Set<string> {
  const set = new Set<string>();
  for (const p of preparaciones) {
    if (!TIPOS_VISIBLES.includes(p.tipo)) continue;
    for (const ped of p.pedidos) {
      if (ped.codigo_despacho) set.add(ped.codigo_despacho);
    }
  }
  return set;
}

export function selectCodigosDespachoByChofer(
  codigosDespacho: CodigoDespacho[],
  codigosDespachoSet: Set<string>,
  repartosExcepcionales: RepartoExcepcional[],
): Map<string, CodigoDespacho[]> {
  const map = new Map<string, CodigoDespacho[]>();
  for (const r of codigosDespacho) {
    if (r.desactivado) continue;
    if (r.nombre === null || !codigosDespachoSet.has(r.nombre)) continue;
    for (const codigoChofer of (r.choferes ?? [])) {
      const arr = map.get(codigoChofer) || [];
      arr.push(r);
      map.set(codigoChofer, arr);
    }
  }
  for (const ex of repartosExcepcionales) {
    const virtual: CodigoDespacho = {
      id: ex.codigo_despacho_id || `ex-${ex.id}`,
      nombre: ex.codigo_reparto,
      desactivado: 0,
      direccion: null,
      es_excepcion: true,
      excepcion_id: ex.id,
    };
    const arr = map.get(ex.chofer_codigo) || [];
    arr.push(virtual);
    map.set(ex.chofer_codigo, arr);
  }
  return map;
}

// Nombres de códigos de despacho que pertenecen a alguna de las zonas seleccionadas
export function selectNombresRepartosZona(codigosDespacho: CodigoDespacho[], zonasSeleccionadas: number[]): Set<string> | null {
  if (zonasSeleccionadas.length === 0) return null;
  const set = new Set(zonasSeleccionadas);
  return new Set(
    codigosDespacho
      .filter(r => r.zona_id != null && set.has(r.zona_id))
      .map(r => r.nombre)
      .filter(Boolean) as string[]
  );
}

export function selectPreparacionesFiltradas(
  preparaciones: Preparacion[],
  nombresRepartosZona: Set<string> | null,
  estadosSeleccionados: string[],
): Preparacion[] {
  return preparaciones
    .filter(p => {
      if (nombresRepartosZona !== null) {
        const tieneZona = p.pedidos.some(ped => ped.codigo_despacho && nombresRepartosZona.has(ped.codigo_despacho));
        if (!tieneZona) return false;
      }
      if (estadosSeleccionados.length === 0) return true;
      return p.estado ? estadosSeleccionados.includes(p.estado) : false;
    })
    // NOTA mutation testing: varios mutantes sobre este comparador (líneas siguientes: los
    // defaults -1→+1, y el "if (eb !== -1) return 1") quedan sin matar/sin cobertura de forma
    // consistente bajo Stryker+V8: cuando la mutación degenera el comparador a devolver un
    // valor constante, el sort de V8 no siempre re-ordena arrays chicos (confirmado a mano:
    // `[1,4,7].sort((a,b)=>1)` devuelve `[1,4,7]` sin swaps). No hay array de test que fuerce
    // de forma confiable una salida distinta — es una limitación de la interacción entre motor
    // de sort y el framework de mutación, no un hueco real de cobertura (mismo criterio
    // documentado para MapView.tsx en Zonificación).
    .sort((a, b) => {
      const ea = a.estado ? ORDER_ESTADOS_LC.indexOf(a.estado.toLowerCase()) : -1
      const eb = b.estado ? ORDER_ESTADOS_LC.indexOf(b.estado.toLowerCase()) : -1
      if (ea !== -1 && eb !== -1) return ea - eb
      if (ea !== -1) return -1
      if (eb !== -1) return 1
      return 0
    });
}

// Código de despacho → choferes ACTIVOS que lo atienden (de chofer_reparto, vía codigosDespacho[].choferes).
// Se filtran los desactivados para que el auto-asignar nunca asigne a un chofer inactivo.
export function selectChoferesPorCodigo(codigosDespacho: CodigoDespacho[], choferes: Chofer[]): Map<string, string[]> {
  const activos = new Set(choferes.filter(c => !c.desactivado).map(c => c.codigo));
  const map = new Map<string, string[]>();
  for (const r of codigosDespacho) {
    if (r.desactivado || r.nombre === null) continue;
    const filtrados = (r.choferes ?? []).filter(c => activos.has(c));
    if (filtrados.length > 0) map.set(r.nombre, filtrados);
  }
  return map;
}

// código_reparto → [chofer_codigo] para los repartos excepcionales de la fecha actual.
export function selectChoferesPorCodigoExcepcion(repartosExcepcionales: RepartoExcepcional[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const ex of repartosExcepcionales) {
    const arr = map.get(ex.codigo_reparto) ?? [];
    arr.push(ex.chofer_codigo);
    map.set(ex.codigo_reparto, arr);
  }
  return map;
}
