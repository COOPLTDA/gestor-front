import { useState, useCallback, useEffect, useRef } from 'react';
import type { Chofer, RepartoExcepcional } from '../types/biblia';
import { fetchChoferes, fetchRepartosExcepcionales, eliminarRepartoExcepcional } from '@/services/bibliaApi';

export interface ChoferesYExcepcionesParams {
  fechaDesde: string;
  fechaHasta: string;
  bibliaFecha: string;
  setError: (msg: string | null) => void;
}

export interface ChoferesYExcepcionesData {
  choferes: Chofer[];
  repartosExcepcionales: RepartoExcepcional[];
  recargarExcepciones: () => Promise<void>;
  eliminarExcepcion: (excepcionId: number) => Promise<void>;
}

export function useChoferesYExcepciones({
  fechaDesde,
  fechaHasta,
  bibliaFecha,
  setError,
}: ChoferesYExcepcionesParams): ChoferesYExcepcionesData {
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [repartosExcepcionales, setRepartosExcepcionales] = useState<RepartoExcepcional[]>([]);
  // El signo de este contador es irrelevante para el guard de carrera de abajo (compara
  // igualdad contra el valor actual, no orden/magnitud): ++ o -- producen la misma secuencia
  // de valores únicos, así que un mutante que cambia ++ por -- es estructuralmente
  // equivalente (no hay test que pueda distinguirlos sin depender del signo concreto).
  const fetchChoferesIdRef = useRef(0);
  // El valor inicial de este ref también es inobservable: el efecto de la línea siguiente
  // lo sincroniza con repartosExcepcionales en el mismo ciclo de render inicial.
  const repartosExcepcionalesRef = useRef<RepartoExcepcional[]>([]);

  useEffect(() => {
    fetchRepartosExcepcionales(bibliaFecha)
      .then(setRepartosExcepcionales)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar excepciones'));
  }, [bibliaFecha, setError]);

  useEffect(() => {
    repartosExcepcionalesRef.current = repartosExcepcionales;
  }, [repartosExcepcionales]);

  useEffect(() => {
    const id = ++fetchChoferesIdRef.current;

    fetchChoferes({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta, biblia_fecha: bibliaFecha })
      .then(data => {
        if (id !== fetchChoferesIdRef.current) return;
        const map = new Map(data.map(c => [c.codigo, c]));
        for (const ex of repartosExcepcionalesRef.current) {
          if (!map.has(ex.chofer_codigo)) {
            map.set(ex.chofer_codigo, {
              codigo: ex.chofer_codigo,
              descripcion: ex.chofer_nombre,
              desactivado: 0,
            });
          }
        }
        setChoferes(Array.from(map.values()));
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar choferes'));
  }, [fechaDesde, fechaHasta, bibliaFecha, setError]);

  useEffect(() => {
    setChoferes(prev => {
      const map = new Map(prev.map(c => [c.codigo, c]));
      let changed = false;
      for (const ex of repartosExcepcionales) {
        if (!map.has(ex.chofer_codigo)) {
          map.set(ex.chofer_codigo, {
            codigo: ex.chofer_codigo,
            descripcion: ex.chofer_nombre,
            desactivado: 0,
          });
          changed = true;
        }
      }
      return changed ? Array.from(map.values()) : prev;
    });
  }, [repartosExcepcionales]);

  const recargarExcepciones = useCallback(async () => {
    try {
      const data = await fetchRepartosExcepcionales(bibliaFecha);
      setRepartosExcepcionales(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recargar excepciones');
    }
  }, [bibliaFecha, setError]);

  const eliminarExcepcion = useCallback(async (excepcionId: number) => {
    setError(null);
    try {
      await eliminarRepartoExcepcional(excepcionId);
      setRepartosExcepcionales(prev => prev.filter(ex => ex.id !== excepcionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar la excepción');
    }
  }, [setError]);

  return { choferes, repartosExcepcionales, recargarExcepciones, eliminarExcepcion };
}
