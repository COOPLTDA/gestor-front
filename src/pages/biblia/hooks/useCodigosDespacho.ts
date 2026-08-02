import { useState, useEffect, useRef, useCallback } from 'react';
import type { CodigoDespacho } from '../types/biblia';
import { fetchCodigosDespacho } from '@/services/bibliaApi';

export interface CodigosDespachoData {
  codigosDespacho: CodigoDespacho[];
  codigosDespachoRef: React.MutableRefObject<CodigoDespacho[]>;
  recargarCodigosDespacho: () => Promise<void>;
}

export function useCodigosDespacho(setError: (msg: string | null) => void): CodigosDespachoData {
  const [codigosDespacho, setCodigosDespacho] = useState<CodigoDespacho[]>([]);
  // El valor inicial de este ref es estructuralmente inobservable: el efecto de abajo
  // (línea siguiente) sincroniza codigosDespachoRef.current = codigosDespacho en el mismo
  // ciclo de render inicial, así que cualquier valor semilla queda pisado antes de que algo
  // pueda leerlo. No se fuerza un test de relleno para el mutante de Stryker en esta línea.
  const codigosDespachoRef = useRef<CodigoDespacho[]>([]);

  const recargarCodigosDespacho = useCallback(async () => {
    try {
      setCodigosDespacho(await fetchCodigosDespacho());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar repartos');
    }
  }, [setError]);

  useEffect(() => {
    recargarCodigosDespacho();
  }, [recargarCodigosDespacho]);

  useEffect(() => { codigosDespachoRef.current = codigosDespacho; }, [codigosDespacho]);

  return { codigosDespacho, codigosDespachoRef, recargarCodigosDespacho };
}
