import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { type AsignacionRaw } from './bibliaSelectors';
import { fetchAsignaciones } from '@/services/bibliaApi';

export interface AsignacionesData {
  rawAsignaciones: AsignacionRaw[];
  setRawAsignaciones: Dispatch<SetStateAction<AsignacionRaw[]>>;
  rawAsignacionesRef: React.MutableRefObject<AsignacionRaw[]>;
}

export function useAsignaciones(setError: (msg: string | null) => void): AsignacionesData {
  const [rawAsignaciones, setRawAsignaciones] = useState<AsignacionRaw[]>([]);
  // El valor inicial de este ref es inobservable: el efecto de la línea siguiente lo
  // sincroniza con rawAsignaciones en el mismo ciclo de render inicial.
  const rawAsignacionesRef = useRef<AsignacionRaw[]>([]);

  useEffect(() => {
    fetchAsignaciones()
      .then(setRawAsignaciones)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar asignaciones'));
  }, [setError]);

  useEffect(() => { rawAsignacionesRef.current = rawAsignaciones; }, [rawAsignaciones]);

  return { rawAsignaciones, setRawAsignaciones, rawAsignacionesRef };
}
