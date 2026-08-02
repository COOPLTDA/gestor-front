import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGroups } from './useGroups';
import { actualizarGrupo, crearGrupo, eliminarGrupo, fetchGrupos } from '@/services/zonificacionApi';
import type { Grupo } from '../types';

vi.mock('@/services/zonificacionApi', () => ({
  fetchGrupos: vi.fn(),
  crearGrupo: vi.fn(),
  actualizarGrupo: vi.fn(),
  eliminarGrupo: vi.fn(),
}));

const mockFetchGrupos = vi.mocked(fetchGrupos);
const mockCrearGrupo = vi.mocked(crearGrupo);
const mockActualizarGrupo = vi.mocked(actualizarGrupo);
const mockEliminarGrupo = vi.mocked(eliminarGrupo);

const ACTIVE_KEY = 'zonificacion_active_group_id';

function grupo(overrides: Partial<Grupo> = {}): Grupo {
  return {
    id: 1, nombre: 'Grupo 1', tipo: 'ruta_flete',
    creadoPor: { id: 1, nombre: 'Ana' }, editablePorOtros: false, zonas: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useGroups', () => {
  it('carga los grupos y selecciona el primero si no hay ninguno guardado', async () => {
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1 }), grupo({ id: 2 })]);

    const { result } = renderHook(() => useGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grupos).toHaveLength(2);
    expect(result.current.activeId).toBe(1);
    expect(result.current.activeGroup?.id).toBe(1);
  });

  it('respeta el grupo activo guardado en localStorage si todavía existe', async () => {
    localStorage.setItem(ACTIVE_KEY, '2');
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1 }), grupo({ id: 2 })]);

    const { result } = renderHook(() => useGroups());

    await waitFor(() => expect(result.current.activeId).toBe(2));
  });

  it('si el grupo guardado ya no existe, cae al primero de la lista', async () => {
    localStorage.setItem(ACTIVE_KEY, '999');
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1 })]);

    const { result } = renderHook(() => useGroups());

    await waitFor(() => expect(result.current.activeId).toBe(1));
  });

  it('activeId queda null si no hay grupos', async () => {
    mockFetchGrupos.mockResolvedValue([]);

    const { result } = renderHook(() => useGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeId).toBeNull();
    expect(result.current.activeGroup).toBeNull();
  });

  it('reporta el error si fetchGrupos rechaza', async () => {
    mockFetchGrupos.mockRejectedValue(new Error('sin conexión'));

    const { result } = renderHook(() => useGroups());

    await waitFor(() => expect(result.current.error).toBe('sin conexión'));
    expect(result.current.loading).toBe(false);
  });

  it('guardarZonas actualiza el grupo activo con las zonas nuevas', async () => {
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1, zonas: [] })]);
    mockActualizarGrupo.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const nuevaZona = { nombre: 'Z1', color: '#000', vertices: [], criterios: null };
    await act(async () => {
      await result.current.guardarZonas([nuevaZona]);
    });

    expect(mockActualizarGrupo).toHaveBeenCalledWith(1, { zonas: [nuevaZona] });
    expect(result.current.activeGroup?.zonas).toEqual([nuevaZona]);
  });

  it('guardarZonas no hace nada si no hay grupo activo', async () => {
    mockFetchGrupos.mockResolvedValue([]);
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.guardarZonas([]);
    });

    expect(mockActualizarGrupo).not.toHaveBeenCalled();
  });

  it('crear agrega el grupo nuevo a la lista y lo marca como activo', async () => {
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1 })]);
    const nuevo = grupo({ id: 2, nombre: 'Grupo 2' });
    mockCrearGrupo.mockResolvedValue(nuevo);
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({ nombre: 'Grupo 2', tipo: 'ruta_flete', editablePorOtros: false });
    });

    expect(result.current.grupos.map((g) => g.id)).toEqual([1, 2]);
    expect(result.current.activeId).toBe(2);
  });

  it('editar aplica los cambios sobre el grupo correspondiente sin tocar los demás', async () => {
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1, nombre: 'Original' }), grupo({ id: 2, nombre: 'Otro' })]);
    mockActualizarGrupo.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.editar(1, { nombre: 'Renombrado' });
    });

    expect(mockActualizarGrupo).toHaveBeenCalledWith(1, { nombre: 'Renombrado' });
    expect(result.current.grupos.find((g) => g.id === 1)?.nombre).toBe('Renombrado');
    expect(result.current.grupos.find((g) => g.id === 2)?.nombre).toBe('Otro');
  });

  it('eliminar saca el grupo de la lista y activa otro si era el activo', async () => {
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1 }), grupo({ id: 2 })]);
    mockEliminarGrupo.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.activeId).toBe(1));

    await act(async () => {
      await result.current.eliminar(1);
    });

    expect(result.current.grupos.map((g) => g.id)).toEqual([2]);
    expect(result.current.activeId).toBe(2);
  });

  it('eliminar deja activeId en null si no quedan grupos', async () => {
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1 })]);
    mockEliminarGrupo.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.activeId).toBe(1));

    await act(async () => {
      await result.current.eliminar(1);
    });

    expect(result.current.grupos).toEqual([]);
    expect(result.current.activeId).toBeNull();
  });

  it('eliminar un grupo que no es el activo no cambia activeId', async () => {
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1 }), grupo({ id: 2 })]);
    mockEliminarGrupo.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.activeId).toBe(1));

    await act(async () => {
      await result.current.eliminar(2);
    });

    expect(result.current.activeId).toBe(1);
  });

  it('persiste el grupo activo en localStorage cuando cambia', async () => {
    mockFetchGrupos.mockResolvedValue([grupo({ id: 1 }), grupo({ id: 2 })]);
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setActiveId(2));

    await waitFor(() => expect(localStorage.getItem(ACTIVE_KEY)).toBe('2'));
  });
});
