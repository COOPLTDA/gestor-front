import { useState, useCallback, useEffect } from 'react';
import { fetchAllZonas, type ZonaAdmin } from '@/services/bibliaApi';

export interface ZonasData {
  zonas: Pick<ZonaAdmin, 'id' | 'nombre'>[];
  zonasSeleccionadas: number[];
  toggleZona: (zonaId: number) => void;
  setZonasSeleccionadas: (ids: number[]) => void;
}

export function useZonas(setError: (msg: string | null) => void): ZonasData {
  const [zonas, setZonas] = useState<Pick<ZonaAdmin, 'id' | 'nombre'>[]>([]);
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<number[]>([]);

  useEffect(() => {
    fetchAllZonas()
      .then(data => setZonas(data.filter(z => !z.desactivado).map(z => ({ id: z.id, nombre: z.nombre }))))
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar zonas'));
  }, [setError]);

  const toggleZona = useCallback((zonaId: number) => {
    setZonasSeleccionadas(prev =>
      prev.includes(zonaId) ? prev.filter(id => id !== zonaId) : [...prev, zonaId]
    );
  }, []);

  return { zonas, zonasSeleccionadas, toggleZona, setZonasSeleccionadas };
}
