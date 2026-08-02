import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Preparacion, CodigoDespacho, SigmaSyncEstado } from '../types/biblia';
import {
  fetchPreparaciones,
  fetchCambiosEstado,
  impactarEnSigma as impactarEnSigmaApi,
  type ImpactarEnSigmaResult,
  type PedidoCambioEstado,
} from '@/services/bibliaApi';
import { type AsignacionRaw } from './bibliaSelectors';

export interface PreparacionesYCambiosParams {
  fechaDesde: string;
  fechaHasta: string;
  bibliaFecha: string;
  codigosDespachoRef: React.MutableRefObject<CodigoDespacho[]>;
  setRawAsignaciones: Dispatch<SetStateAction<AsignacionRaw[]>>;
  setError: (msg: string | null) => void;
}

export interface PreparacionesYCambiosData {
  preparaciones: Preparacion[];
  rawPedidoCambios: PedidoCambioEstado[];
  setRawPedidoCambios: Dispatch<SetStateAction<PedidoCambioEstado[]>>;
  isLoading: boolean;
  recargarPreparaciones: () => void;
  impactarEnSigma: () => Promise<ImpactarEnSigmaResult>;
}

export function usePreparacionesYCambios({
  fechaDesde,
  fechaHasta,
  bibliaFecha,
  codigosDespachoRef,
  setRawAsignaciones,
  setError,
}: PreparacionesYCambiosParams): PreparacionesYCambiosData {
  const [preparaciones, setPreparaciones] = useState<Preparacion[]>([]);
  const [rawPedidoCambios, setRawPedidoCambios] = useState<PedidoCambioEstado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchIdRef = useRef(0);
  const rawPedidoCambiosRef = useRef<PedidoCambioEstado[]>([]);
  // Último mapa Código-de-pedido→CodigoDespacho leído de Digip. Se usa para reconciliar
  // los cambios individuales tanto en cargarPreparaciones como en cargarCambios.
  const codigoPorPedidoRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => { rawPedidoCambiosRef.current = rawPedidoCambios; }, [rawPedidoCambios]);

  const reconciliarCambios = useCallback((cambios: PedidoCambioEstado[]) => {
    const mapa = codigoPorPedidoRef.current;
    return cambios.filter(c => {
      if (c.estado !== 'ok') return true;
      if (!c.nuevo_codigo_despacho) return false;
      const actual = mapa.get(c.pedido_codigo);
      return actual !== c.nuevo_codigo_despacho;
    });
  }, []);

  const cargarCambios = useCallback(() => {
    fetchCambiosEstado(bibliaFecha)
      .then(cambios => setRawPedidoCambios(reconciliarCambios(cambios)))
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar cambios pendientes'));
  }, [bibliaFecha, reconciliarCambios, setError]);

  useEffect(() => { cargarCambios(); }, [cargarCambios]);

  const cargarPreparaciones = useCallback(() => {
    const id = ++fetchIdRef.current;

    setIsLoading(true);
    setError(null);
    fetchPreparaciones({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta })
      .then(data => {
        if (id !== fetchIdRef.current) return;
        setPreparaciones(data);
        // Reconciliación: si algún ok ya se reflejó en Digip (todos los pedidos de la prep
        // tienen el código destino), limpiamos el estado para que el banner desaparezca.
        // Reconciliación cross-código. Se limpia ('no_aplica') en dos casos:
        //   1. Digip ya refleja el código destino en todos los pedidos de la prep.
        //   2. Cambios individuales 'ok' reemplazaron el destino del cross-code Y Digip los
        //      refleja (ningún pedido tiene ya el código destino del cross-code). Se detecta
        //      usando rawPedidoCambiosRef para ver los cambios ANTES de que la reconciliación
        //      individual los filtre en la misma llamada a setRawPedidoCambios de abajo.
        setRawAsignaciones(prev => {
          const codigosByPrepId = new Map<number, Set<string>>();
          for (const prep of data) {
            const codigos = new Set(prep.pedidos.map(p => p.codigo_despacho).filter(Boolean) as string[]);
            codigosByPrepId.set(prep.id, codigos);
          }
          // Construir sets de preps con cambios ok / con cambios no-ok, usando el ref
          // (valor más reciente, antes de que esta tanda de setX los filtre).
          const okCambiosPrepIds = new Set<number>();
          const nonOkCambiosPrepIds = new Set<number>();
          for (const c of rawPedidoCambiosRef.current) {
            if (c.estado === 'ok') okCambiosPrepIds.add(c.preparacion_id);
            else nonOkCambiosPrepIds.add(c.preparacion_id);
          }
          let changed = false;
          const next = prev.map(a => {
            if (a.sigma_sync_estado !== 'ok' || !a.codigo_despacho_destino) return a;
            const codigos = codigosByPrepId.get(a.preparacion_id);
            if (!codigos) return a;
            // codigo_despacho_destino guarda el ID de Sigma (ej: "150"); los pedidos en Digip
            // usan el nombre (ej: "VI HPC 1"). Se busca el nombre correspondiente al ID.
            const destinoNombre = codigosDespachoRef.current.find(r => String(r.id) === a.codigo_despacho_destino)?.nombre ?? null;
            // Caso 1: Digip ya tiene el código destino en todos los pedidos.
            if (destinoNombre && codigos.size === 1 && codigos.has(destinoNombre)) {
              changed = true;
              return { ...a, sigma_sync_estado: 'no_aplica' as SigmaSyncEstado };
            }
            // Caso 2: cambios individuales 'ok' reemplazaron el cross-code y Digip los refleja.
            // Ningún pedido tiene el código destino del cross-code, y no hay cambios pendientes/fallidos.
            if (destinoNombre && !codigos.has(destinoNombre)
                && okCambiosPrepIds.has(a.preparacion_id)
                && !nonOkCambiosPrepIds.has(a.preparacion_id)) {
              changed = true;
              return { ...a, sigma_sync_estado: 'no_aplica' as SigmaSyncEstado };
            }
            return a;
          });
          return changed ? next : prev;
        });
        // Reconciliación cambios individuales: si el pedido ya tiene el código nuevo en Digip
        const codigoPorPedido = new Map<string, string | null>();
        for (const prep of data) {
          for (const ped of prep.pedidos) codigoPorPedido.set(ped.codigo, ped.codigo_despacho);
        }
        codigoPorPedidoRef.current = codigoPorPedido;
        setRawPedidoCambios(prev => prev.filter(c => {
          if (c.estado !== 'ok') return true; // pendiente y fallido se quedan
          if (!c.nuevo_codigo_despacho) return false; // ok sin cambio de código → listo
          const actual = codigoPorPedido.get(c.pedido_codigo);
          return actual !== c.nuevo_codigo_despacho; // queda hasta que Digip lo refleje
        }));
      })
      .catch(err => {
        if (id === fetchIdRef.current) {
          setError(err instanceof Error ? err.message : 'Error al cargar preparaciones');
        }
      })
      .finally(() => {
        if (id === fetchIdRef.current) setIsLoading(false);
      });
  }, [fechaDesde, fechaHasta, codigosDespachoRef, setRawAsignaciones, setError]);

  useEffect(() => { cargarPreparaciones(); }, [cargarPreparaciones]);

  const recargarPreparaciones = useCallback(() => {
    cargarPreparaciones();
    cargarCambios();
  }, [cargarPreparaciones, cargarCambios]);

  const impactarEnSigma = useCallback(async (): Promise<ImpactarEnSigmaResult> => {
    setError(null);
    try {
      const result = await impactarEnSigmaApi(bibliaFecha);
      // Solo actualizar asignaciones que estaban 'pendiente'. Las 'ok' (cross-code ya impactado)
      // no se tocan: si un cambio individual falla, no debe revertir el estado del cross-code.
      setRawAsignaciones(prev => prev.map(a => {
        if (a.sigma_sync_estado !== 'pendiente' && a.sigma_sync_estado !== 'fallido') return a;
        if (result.ok.includes(a.preparacion_id)) return { ...a, sigma_sync_estado: 'ok' as SigmaSyncEstado };
        if (result.fallido.includes(a.preparacion_id) || (result.error ?? []).includes(a.preparacion_id)) return { ...a, sigma_sync_estado: 'fallido' as SigmaSyncEstado };
        return a;
      }));
      // Recargar cambios individuales desde el server (tienen su propio estado por pedido)
      const cambios = await fetchCambiosEstado(bibliaFecha);
      setRawPedidoCambios(reconciliarCambios(cambios));
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al impactar en Sigma');
      throw e;
    }
  }, [bibliaFecha, setRawAsignaciones, reconciliarCambios, setError]);

  return {
    preparaciones,
    rawPedidoCambios,
    setRawPedidoCambios,
    isLoading,
    recargarPreparaciones,
    impactarEnSigma,
  };
}
