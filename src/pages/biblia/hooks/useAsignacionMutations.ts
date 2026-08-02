import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Preparacion, CodigoDespacho, SigmaSyncEstado } from '../types/biblia';
import { asignarPreparacionAChofer, asignarPreparacionesBatch, limpiarAsignacionesBiblia, type PedidoCambioEstado } from '@/services/bibliaApi';
import { type AsignacionRaw, prevBusinessDay } from './bibliaSelectors';

export interface AsignacionMutationsParams {
  bibliaFecha: string;
  fechaHasta: string;
  preparaciones: Preparacion[];
  preparacionesFiltradas: Preparacion[];
  asignacionesBiblia: Map<number, string>;
  ocupadasEnOtraBiblia: Map<number, string>;
  asignacionCrossCodeByPrepId: Map<number, { destino_nombre: string | null; destino_id: string | null; sigma_sync_estado: SigmaSyncEstado }>;
  choferesPorCodigo: Map<string, string[]>;
  choferesPorCodigoExcepcion: Map<string, string[]>;
  rawAsignacionesRef: React.MutableRefObject<AsignacionRaw[]>;
  setRawAsignaciones: Dispatch<SetStateAction<AsignacionRaw[]>>;
  setRawPedidoCambios: Dispatch<SetStateAction<PedidoCambioEstado[]>>;
  resetDateRangeOverride: () => void;
  setError: (msg: string | null) => void;
}

export interface AsignacionMutationsData {
  asignarPreparacion: (preparacionId: number, choferCodigo: string) => Promise<void>;
  reasignarPreparacion: (prep: Preparacion, choferCodigo: string, codigoDespacho: CodigoDespacho) => Promise<void>;
  desasignarPreparacion: (preparacionId: number) => Promise<void>;
  autoAsignarPendientes: () => Promise<number>;
  limpiarBiblia: () => Promise<void>;
}

export function useAsignacionMutations({
  bibliaFecha,
  fechaHasta,
  preparaciones,
  preparacionesFiltradas,
  asignacionesBiblia,
  ocupadasEnOtraBiblia,
  asignacionCrossCodeByPrepId,
  choferesPorCodigo,
  choferesPorCodigoExcepcion,
  rawAsignacionesRef,
  setRawAsignaciones,
  setRawPedidoCambios,
  resetDateRangeOverride,
  setError,
}: AsignacionMutationsParams): AsignacionMutationsData {
  const asignarPreparacion = useCallback(async (preparacionId: number, choferCodigo: string) => {
    const prep = preparaciones.find(p => p.id === preparacionId);
    const rawFecha = (prep?.fecha_hora_estado ?? prevBusinessDay(bibliaFecha)).slice(0, 10);
    const preparacionFecha = rawFecha > fechaHasta ? fechaHasta : rawFecha;

    let snapshot: AsignacionRaw[] | null = null;
    setRawAsignaciones(prev => {
      snapshot = prev;
      const next = prev.filter(a => a.preparacion_id !== preparacionId);
      next.push({ preparacion_id: preparacionId, chofer_codigo: choferCodigo, biblia_fecha: bibliaFecha, preparacion_fecha: preparacionFecha, sigma_sync_estado: 'no_aplica' });
      return next;
    });
    setError(null);
    try {
      await asignarPreparacionAChofer(preparacionId, choferCodigo, bibliaFecha, preparacionFecha);
    } catch (e) {
      if (snapshot) setRawAsignaciones(snapshot);
      setError(e instanceof Error ? e.message : 'Error al asignar la preparación');
    }
  }, [preparaciones, bibliaFecha, fechaHasta, setRawAsignaciones, setError]);

  // Reasigna una prep a un chofer/código. Si el código destino difiere del código efectivo en
  // Sigma, guarda codigo_despacho_destino para el paso "impactar en Sigma".
  // No llama Sigma en este momento — eso lo hace el botón "Impactar en Sigma".
  const reasignarPreparacion = useCallback(async (prep: Preparacion, choferCodigo: string, codigoDespacho: CodigoDespacho) => {
    const codigos = new Set(prep.pedidos.map(p => p.codigo_despacho).filter(Boolean));
    const codigoActual = codigos.size === 1 ? [...codigos][0] : null;

    // Si ya se impactó un cross-code ('ok'), Sigma tiene los pedidos en el código destino,
    // no en el que muestra Digip. Volver al código de Digip también es un cross-code.
    const crossCodeOk = asignacionCrossCodeByPrepId.get(prep.id);
    const codigoEfectivoSigma = (crossCodeOk?.sigma_sync_estado === 'ok' && crossCodeOk.destino_nombre)
      ? crossCodeOk.destino_nombre
      : codigoActual;
    const esCross = codigoDespacho.nombre !== codigoEfectivoSigma;

    // Si no es cross-code pero hay un pending cross-code existente (p.ej. drag de vuelta al
    // código original después de arrastrar a otro), conservar el pending en lugar de borrarlo.
    // El usuario arrastra al mismo destino que ya estaba pendiente → no es un "cancelar".
    const keepExistingPending = !esCross && crossCodeOk?.sigma_sync_estado === 'pendiente';

    const destino = esCross ? String(codigoDespacho.id)
      : keepExistingPending ? (crossCodeOk?.destino_id ?? null)
      : null;

    // Si ya sabemos (por la caché DW_) que los pedidos no están en Pendiente, marcar
    // directamente como fallido sin pasar por la cola de Sigma.
    const sigmaEstado: SigmaSyncEstado = keepExistingPending ? 'pendiente'
      : !esCross ? 'no_aplica'
      : prep.reasignable === false ? 'bloqueado'
      : 'pendiente';

    const rawFechaR = (prep.fecha_hora_estado ?? prevBusinessDay(bibliaFecha)).slice(0, 10);
    const preparacionFecha = rawFechaR > fechaHasta ? fechaHasta : rawFechaR;
    let snapshot: AsignacionRaw[] | null = null;
    setRawAsignaciones(prev => {
      snapshot = prev;
      const next = prev.filter(a => a.preparacion_id !== prep.id);
      next.push({
        preparacion_id: prep.id,
        chofer_codigo: choferCodigo,
        biblia_fecha: bibliaFecha,
        preparacion_fecha: preparacionFecha,
        codigo_despacho_destino: destino,
        sigma_sync_estado: sigmaEstado,
      });
      return next;
    });
    setError(null);
    try {
      await asignarPreparacionAChofer(prep.id, choferCodigo, bibliaFecha, preparacionFecha, destino, (sigmaEstado === 'pendiente' || sigmaEstado === 'no_aplica') ? null : sigmaEstado);
      // La asignación cross-code reemplaza cualquier cambio individual previo del servidor
      if (esCross) setRawPedidoCambios(prev => prev.filter(c => c.preparacion_id !== prep.id));
    } catch (e) {
      if (snapshot) setRawAsignaciones(snapshot);
      setError(e instanceof Error ? e.message : 'Error al reasignar la preparación');
    }
  }, [bibliaFecha, fechaHasta, asignacionCrossCodeByPrepId, setRawAsignaciones, setRawPedidoCambios, setError]);

  // Desasignar = forzar la preparación a "pendientes". Se guarda un override con chofer
  // vacío en vez de borrar la fila para que persista como "vista sin asignar" entre recargas.
  // Si hay un estado de Sigma ('ok' o 'pendiente' cross-code), se preserva: el badge no
  // debe desaparecer solo porque el usuario quitó el chofer.
  // Nota: auto-asignar sí puede volver a asignarla si cumple las condiciones.
  const desasignarPreparacion = useCallback(async (preparacionId: number) => {
    const prep = preparaciones.find(p => p.id === preparacionId);
    const rawFechaD = (prep?.fecha_hora_estado ?? prevBusinessDay(bibliaFecha)).slice(0, 10);
    const preparacionFecha = rawFechaD > fechaHasta ? fechaHasta : rawFechaD;

    // Leer el estado actual antes de la actualización optimista
    const existingRaw = rawAsignacionesRef.current.find(
      a => a.preparacion_id === preparacionId && a.biblia_fecha === bibliaFecha
    );
    const sigmaToPreserve = existingRaw?.sigma_sync_estado === 'ok'
      || (existingRaw?.sigma_sync_estado === 'pendiente' && existingRaw.codigo_despacho_destino != null);

    let snapshot: AsignacionRaw[] | null = null;
    setRawAsignaciones(prev => {
      snapshot = prev;
      if (sigmaToPreserve) {
        // Solo limpiar el chofer; sigma_sync_estado y codigo_despacho_destino no cambian
        return prev.map(a => a.preparacion_id === preparacionId ? { ...a, chofer_codigo: '' } : a);
      }
      const next = prev.filter(a => a.preparacion_id !== preparacionId);
      next.push({ preparacion_id: preparacionId, chofer_codigo: '', biblia_fecha: bibliaFecha, preparacion_fecha: preparacionFecha });
      return next;
    });
    setError(null);
    try {
      // Si hay estado de Sigma, pasarlo como override para que el servidor no lo sobreescriba
      const sigmaOverride = sigmaToPreserve ? (existingRaw!.sigma_sync_estado ?? null) : null;
      const destinoOverride = sigmaToPreserve ? (existingRaw!.codigo_despacho_destino ?? null) : null;
      await asignarPreparacionAChofer(preparacionId, '', bibliaFecha, preparacionFecha, destinoOverride, sigmaOverride);
    } catch (e) {
      if (snapshot) setRawAsignaciones(snapshot);
      setError(e instanceof Error ? e.message : 'Error al desasignar la preparación');
    }
  }, [preparaciones, bibliaFecha, fechaHasta, rawAsignacionesRef, setRawAsignaciones, setError]);

  // Botón "auto-asignar": asigna todas las preparaciones sin chofer cuyo código de despacho
  // lo atiende EXACTAMENTE 1 chofer. No toca las que ya tienen asignación explícita (chofer != ''),
  // ni las de otra biblia, ni las de código mixto/compartido. Incluye las desasignadas a mano.
  // Es siempre within.
  const autoAsignarPendientes = useCallback(async (): Promise<number> => {
    const nuevas: AsignacionRaw[] = [];
    const prevBD = prevBusinessDay(bibliaFecha);
    for (const p of preparacionesFiltradas) {
      if (ocupadasEnOtraBiblia.has(p.id) || asignacionesBiblia.get(p.id)) continue;
      const rawFechaA = (p.fecha_hora_estado ?? prevBD).slice(0, 10);
      const preparacionFecha = rawFechaA > fechaHasta ? fechaHasta : rawFechaA;
      const codigos = new Set(p.pedidos.map(ped => ped.codigo_despacho).filter(Boolean));
      if (codigos.size !== 1) continue;
      const codigo = [...codigos][0] as string;
      const choferesDelCodigo = choferesPorCodigo.get(codigo) ?? choferesPorCodigoExcepcion.get(codigo) ?? [];
      if (choferesDelCodigo.length !== 1) continue;
      nuevas.push({ preparacion_id: p.id, chofer_codigo: choferesDelCodigo[0], biblia_fecha: bibliaFecha, preparacion_fecha: preparacionFecha });
    }
    if (nuevas.length === 0) return 0;
    let snapshot: AsignacionRaw[] | null = null;
    const ids = new Set(nuevas.map(a => a.preparacion_id));
    setRawAsignaciones(prev => {
      snapshot = prev;
      return [...prev.filter(a => !ids.has(a.preparacion_id)), ...nuevas];
    });
    setError(null);
    try {
      await asignarPreparacionesBatch(nuevas);
      return nuevas.length;
    } catch (e) {
      if (snapshot) setRawAsignaciones(snapshot);
      setError(e instanceof Error ? e.message : 'Error al auto-asignar');
      return 0;
    }
  }, [preparacionesFiltradas, ocupadasEnOtraBiblia, asignacionesBiblia, choferesPorCodigo, choferesPorCodigoExcepcion, bibliaFecha, fechaHasta, setRawAsignaciones, setError]);

  const limpiarBiblia = useCallback(async () => {
    setError(null);
    try {
      await limpiarAsignacionesBiblia(bibliaFecha);
      // Solo se conserva lo que ya impactó en Sigma ('ok'), sin chofer.
      // Todo lo pendiente (incluyendo cross-code) se descarta.
      setRawAsignaciones(prev =>
        prev
          .filter(a => a.biblia_fecha !== bibliaFecha || a.sigma_sync_estado === 'ok')
          .map(a => a.biblia_fecha === bibliaFecha ? { ...a, chofer_codigo: '' } : a)
      );
      setRawPedidoCambios(prev => prev.filter(c => c.estado === 'ok'));
      resetDateRangeOverride();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al limpiar la biblia');
    }
  }, [bibliaFecha, setRawAsignaciones, setRawPedidoCambios, resetDateRangeOverride, setError]);

  return {
    asignarPreparacion,
    reasignarPreparacion,
    desasignarPreparacion,
    autoAsignarPendientes,
    limpiarBiblia,
  };
}
