import { useState, useCallback, useMemo } from 'react';
import type { Preparacion, Chofer, CodigoDespacho, SigmaSyncEstado } from '../types/biblia';
import { type ZonaAdmin, type ImpactarEnSigmaResult, type PedidoCambioEstado } from '@/services/bibliaApi';
import {
  computeEstados,
  nextBusinessDay,
  selectAsignacionesBiblia,
  selectSigmaEstadoByPrepId,
  selectPedidoCambiosByPrepId,
  selectAsignacionCrossCodeByPrepId,
  selectOcupadasEnOtraBiblia,
  selectCodigosDespachoSet,
  selectCodigosDespachoByChofer,
  selectNombresRepartosZona,
  selectPreparacionesFiltradas,
  selectChoferesPorCodigo,
  selectChoferesPorCodigoExcepcion,
} from './bibliaSelectors';
import { useZonas } from './useZonas';
import { useCodigosDespacho } from './useCodigosDespacho';
import { useAsignaciones } from './useAsignaciones';
import { useFechaRange } from './useFechaRange';
import { useChoferesYExcepciones } from './useChoferesYExcepciones';
import { usePreparacionesYCambios } from './usePreparacionesYCambios';
import { useAsignacionMutations } from './useAsignacionMutations';

export interface BibliaData {
  choferes: Chofer[];
  codigosDespacho: CodigoDespacho[];
  codigosDespachoByChofer: Map<string, CodigoDespacho[]>;
  preparacionesPorChofer: Map<string, Preparacion[]>;
  preparacionesDisponibles: Preparacion[];
  ocupadasEnOtraBiblia: Map<number, string>;
  sigmaEstadoByPrepId: Map<number, SigmaSyncEstado>;
  pedidoCambiosByPrepId: Map<number, PedidoCambioEstado[]>;
  asignacionCrossCodeByPrepId: Map<number, { destino_nombre: string | null; destino_id: string | null; sigma_sync_estado: SigmaSyncEstado }>;
  estados: string[];
  estadosSeleccionados: string[];
  zonas: Pick<ZonaAdmin, 'id' | 'nombre'>[];
  zonasSeleccionadas: number[];
  fechaDesde: string;
  fechaHasta: string;
  bibliaFecha: string;
  setFechaDesde: (f: string) => void;
  setFechaHasta: (f: string) => void;
  setBibliaFecha: (f: string) => void;
  toggleZona: (zonaId: number) => void;
  setZonasSeleccionadas: (ids: number[]) => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  recargarPreparaciones: () => void;
  toggleEstado: (estado: string) => void;
  asignarPreparacion: (preparacionId: number, choferCodigo: string) => Promise<void>;
  reasignarPreparacion: (prep: Preparacion, choferCodigo: string, codigoDespacho: CodigoDespacho) => Promise<void>;
  desasignarPreparacion: (preparacionId: number) => Promise<void>;
  autoAsignarPendientes: () => Promise<number>;
  impactarEnSigma: () => Promise<ImpactarEnSigmaResult>;
  recargarExcepciones: () => Promise<void>;
  eliminarExcepcion: (excepcionId: number) => Promise<void>;
  limpiarBiblia: () => Promise<void>;
}

const today = new Date().toISOString().slice(0, 10);

export function useBibliaData(): BibliaData {
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bibliaFecha, setBibliaFecha] = useState(() => nextBusinessDay(today));

  const { zonas, zonasSeleccionadas, toggleZona, setZonasSeleccionadas } = useZonas(setError);
  const { codigosDespacho, codigosDespachoRef, recargarCodigosDespacho } = useCodigosDespacho(setError);
  const { rawAsignaciones, setRawAsignaciones, rawAsignacionesRef } = useAsignaciones(setError);
  const { fechaDesde, fechaHasta, setFechaDesde, setFechaHasta, resetOverride } = useFechaRange(bibliaFecha, rawAsignaciones);
  const { choferes, repartosExcepcionales, recargarExcepciones: recargarExcepcionesData, eliminarExcepcion } = useChoferesYExcepciones({
    fechaDesde,
    fechaHasta,
    bibliaFecha,
    setError,
  });
  // El modal de reparto excepcional también puede crear una asignación permanente
  // (checkbox "guardar permanente"), así que hay que refrescar ambas listas por igual.
  const recargarExcepciones = useCallback(async () => {
    await Promise.all([recargarExcepcionesData(), recargarCodigosDespacho()]);
  }, [recargarExcepcionesData, recargarCodigosDespacho]);
  const {
    preparaciones,
    rawPedidoCambios,
    setRawPedidoCambios,
    isLoading,
    recargarPreparaciones,
    impactarEnSigma,
  } = usePreparacionesYCambios({
    fechaDesde,
    fechaHasta,
    bibliaFecha,
    codigosDespachoRef,
    setRawAsignaciones,
    setError,
  });

  // Asignaciones de la biblia actual → para mostrar bajo choferes
  const asignacionesBiblia = useMemo(
    () => selectAsignacionesBiblia(rawAsignaciones, bibliaFecha),
    [rawAsignaciones, bibliaFecha]
  );

  const sigmaEstadoByPrepId = useMemo(
    () => selectSigmaEstadoByPrepId(rawAsignaciones, rawPedidoCambios, bibliaFecha),
    [rawAsignaciones, rawPedidoCambios, bibliaFecha]
  );

  const pedidoCambiosByPrepId = useMemo(
    () => selectPedidoCambiosByPrepId(rawPedidoCambios),
    [rawPedidoCambios]
  );

  const asignacionCrossCodeByPrepId = useMemo(
    () => selectAsignacionCrossCodeByPrepId(rawAsignaciones, bibliaFecha, codigosDespacho),
    [rawAsignaciones, bibliaFecha, codigosDespacho]
  );

  // Preps asignadas a OTRA biblia → para mostrar grisadas en sidebar.
  const ocupadasEnOtraBiblia = useMemo(
    () => selectOcupadasEnOtraBiblia(rawAsignaciones, bibliaFecha),
    [rawAsignaciones, bibliaFecha]
  );

  const codigosDespachoSet = useMemo(
    () => selectCodigosDespachoSet(preparaciones),
    [preparaciones]
  );

  const codigosDespachoByChofer = useMemo(
    () => selectCodigosDespachoByChofer(codigosDespacho, codigosDespachoSet, repartosExcepcionales),
    [codigosDespacho, codigosDespachoSet, repartosExcepcionales]
  );

  const estados = useMemo(() => computeEstados(preparaciones), [preparaciones]);

  // Nombres de códigos de despacho que pertenecen a alguna de las zonas seleccionadas
  const nombresRepartosZona = useMemo(
    () => selectNombresRepartosZona(codigosDespacho, zonasSeleccionadas),
    [codigosDespacho, zonasSeleccionadas]
  );

  const preparacionesFiltradas = useMemo(
    () => selectPreparacionesFiltradas(preparaciones, nombresRepartosZona, estadosSeleccionados),
    [preparaciones, estadosSeleccionados, nombresRepartosZona]
  );

  const choferesPorCodigo = useMemo(
    () => selectChoferesPorCodigo(codigosDespacho, choferes),
    [codigosDespacho, choferes]
  );

  const choferesPorCodigoExcepcion = useMemo(
    () => selectChoferesPorCodigoExcepcion(repartosExcepcionales),
    [repartosExcepcionales]
  );

  // Chofer efectivo de una prep: SOLO asignación explícita (manual, drag o botón
  // "auto-asignar"). No hay auto-asignación automática al leer; '' = desasignada a mano
  // (forzada a pendientes). Las preps de otra biblia quedan en pendientes (grisadas).
  const choferEfectivo = useCallback((p: Preparacion): string | null => {
    if (ocupadasEnOtraBiblia.has(p.id)) return null;
    return asignacionesBiblia.get(p.id) || null;
  }, [ocupadasEnOtraBiblia, asignacionesBiblia]);

  const preparacionesPorChofer = useMemo(() => {
    const map = new Map<string, Preparacion[]>();
    for (const p of preparacionesFiltradas) {
      const chofer = choferEfectivo(p);
      if (!chofer) continue;
      const arr = map.get(chofer) || [];
      arr.push(p);
      map.set(chofer, arr);
    }
    return map;
  }, [preparacionesFiltradas, choferEfectivo]);

  // Pendientes: preps sin chofer efectivo (ni override ni auto). Incluye las grisadas de otra biblia.
  const preparacionesDisponibles = useMemo(() =>
    preparacionesFiltradas.filter(p => choferEfectivo(p) === null),
    [preparacionesFiltradas, choferEfectivo]
  );

  const toggleEstado = useCallback((estado: string) => {
    setEstadosSeleccionados(prev =>
      prev.includes(estado)
        ? prev.filter(e => e !== estado)
        : [...prev, estado]
    );
  }, []);

  const {
    asignarPreparacion,
    reasignarPreparacion,
    desasignarPreparacion,
    autoAsignarPendientes,
    limpiarBiblia,
  } = useAsignacionMutations({
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
    resetDateRangeOverride: resetOverride,
    setError,
  });

  return {
    choferes,
    codigosDespacho,
    codigosDespachoByChofer,
    preparacionesPorChofer,
    preparacionesDisponibles,
    ocupadasEnOtraBiblia,
    sigmaEstadoByPrepId,
    pedidoCambiosByPrepId,
    asignacionCrossCodeByPrepId,
    estados,
    estadosSeleccionados,
    zonas,
    zonasSeleccionadas,
    fechaDesde,
    fechaHasta,
    bibliaFecha,
    setFechaDesde,
    setFechaHasta,
    setBibliaFecha,
    toggleZona,
    setZonasSeleccionadas,
    isLoading,
    error,
    clearError: useCallback(() => setError(null), []),
    recargarPreparaciones,
    toggleEstado,
    asignarPreparacion,
    reasignarPreparacion,
    desasignarPreparacion,
    autoAsignarPendientes,
    impactarEnSigma,
    recargarExcepciones,
    eliminarExcepcion,
    limpiarBiblia,
  };
}
