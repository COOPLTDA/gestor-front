import { useCallback, useEffect, useState } from 'react';
import { actualizarGrupo, crearGrupo, eliminarGrupo, fetchGrupos, type CambiosGrupo, type NuevoGrupo } from '@/services/zonificacionApi';
import type { Grupo, Zona } from '../types';

// Reemplaza persistAll/initGroups/localStorage del HTML original: los grupos y zonas
// viven en la API. Lo único que sigue en localStorage es "cuál grupo estaba abierto"
// (preferencia de UI de este navegador, no dato de negocio — ver plan de arquitectura).
const ACTIVE_KEY = 'zonificacion_active_group_id';

export function useGroups() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGrupos();
      setError(null);
      setGrupos(data);

      const saved = Number(localStorage.getItem(ACTIVE_KEY));
      const found = data.find((g) => g.id === saved);
      setActiveId(found ? found.id : (data[0]?.id ?? null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (activeId != null) localStorage.setItem(ACTIVE_KEY, String(activeId));
  }, [activeId]);

  const activeGroup = grupos.find((g) => g.id === activeId) || null;

  const guardarZonas = useCallback(
    async (zonas: Zona[]) => {
      if (activeId == null) return;
      await actualizarGrupo(activeId, { zonas });
      setGrupos((prev) => prev.map((g) => (g.id === activeId ? { ...g, zonas } : g)));
    },
    [activeId]
  );

  const crear = useCallback(async (nuevo: NuevoGrupo) => {
    const grupo = await crearGrupo(nuevo);
    setGrupos((prev) => [...prev, grupo]);
    setActiveId(grupo.id);
    return grupo;
  }, []);

  const editar = useCallback(async (id: number, cambios: CambiosGrupo) => {
    await actualizarGrupo(id, cambios);
    setGrupos((prev) => prev.map((g) => (g.id === id ? { ...g, ...cambios } : g)));
  }, []);

  const eliminar = useCallback(
    async (id: number) => {
      await eliminarGrupo(id);
      setGrupos((prev) => {
        const restantes = prev.filter((g) => g.id !== id);
        if (activeId === id) setActiveId(restantes.length ? restantes[0].id : null);
        return restantes;
      });
    },
    [activeId]
  );

  return { grupos, activeGroup, activeId, setActiveId, loading, error, guardarZonas, crear, editar, eliminar, reload };
}
