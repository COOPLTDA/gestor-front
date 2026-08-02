import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChoferesYExcepciones } from './useChoferesYExcepciones';
import { fetchChoferes, fetchRepartosExcepcionales, eliminarRepartoExcepcional } from '@/services/bibliaApi';
import type { Chofer, RepartoExcepcional } from '../types/biblia';

vi.mock('@/services/bibliaApi', () => ({
  fetchChoferes: vi.fn(),
  fetchRepartosExcepcionales: vi.fn(),
  eliminarRepartoExcepcional: vi.fn(),
}));

const mockChoferes = vi.mocked(fetchChoferes);
const mockExcepciones = vi.mocked(fetchRepartosExcepcionales);
const mockEliminar = vi.mocked(eliminarRepartoExcepcional);

const PARAMS = { fechaDesde: '2026-07-17', fechaHasta: '2026-07-19', bibliaFecha: '2026-07-20' };

function chofer(codigo: string): Chofer {
  return { codigo, descripcion: `Chofer ${codigo}`, desactivado: 0 };
}

function excepcion(id: number, chofer_codigo: string): RepartoExcepcional {
  return { id, chofer_codigo, chofer_nombre: `Virtual ${chofer_codigo}`, codigo_reparto: 'BIG', codigo_despacho_id: '150', fecha: PARAMS.bibliaFecha };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChoferes.mockResolvedValue([]);
  mockExcepciones.mockResolvedValue([]);
  mockEliminar.mockResolvedValue(undefined);
});

// El setError debe ser estable entre renders (está en los deps de los efectos del hook):
// crearlo dentro del callback de renderHook dispararía los efectos en cada render.
function render() {
  const setError = vi.fn();
  const utils = renderHook(() => useChoferesYExcepciones({ ...PARAMS, setError }));
  return { ...utils, setError };
}

describe('useChoferesYExcepciones', () => {
  it('arranca con choferes y repartosExcepcionales vacíos antes de que resuelva ningún fetch', () => {
    mockChoferes.mockReturnValue(new Promise(() => {}));
    mockExcepciones.mockReturnValue(new Promise(() => {}));
    const { result } = render();
    expect(result.current.choferes).toEqual([]);
    expect(result.current.repartosExcepcionales).toEqual([]);
  });

  it('vuelve a pedir las excepciones si cambia bibliaFecha (efecto atado a esa dependencia)', async () => {
    const setError = vi.fn();
    const { rerender } = renderHook(
      (p: { bibliaFecha: string }) => useChoferesYExcepciones({ ...PARAMS, bibliaFecha: p.bibliaFecha, setError }),
      { initialProps: { bibliaFecha: '2026-07-20' } }
    );
    await waitFor(() => expect(mockExcepciones).toHaveBeenCalledTimes(1));

    rerender({ bibliaFecha: '2026-07-21' });
    await waitFor(() => expect(mockExcepciones).toHaveBeenCalledTimes(2));
    expect(mockExcepciones).toHaveBeenLastCalledWith('2026-07-21');
  });

  it('eliminarExcepcion: si cambia la identidad de setError, el error de un fallo posterior va al setError nuevo', async () => {
    mockEliminar.mockRejectedValue(new Error('fallo al eliminar'));
    const setErrorA = vi.fn();
    const { result, rerender } = renderHook(
      (p: { se: (msg: string | null) => void }) => useChoferesYExcepciones({ ...PARAMS, setError: p.se }),
      { initialProps: { se: setErrorA } }
    );
    const setErrorB = vi.fn();
    rerender({ se: setErrorB });

    await act(() => result.current.eliminarExcepcion(1));

    expect(setErrorB).toHaveBeenCalledWith('fallo al eliminar');
    expect(setErrorA).not.toHaveBeenCalledWith('fallo al eliminar');
  });

  it('eliminarExcepcion saca solo la excepción pedida', async () => {
    mockExcepciones.mockResolvedValue([excepcion(1, 'EX1'), excepcion(2, 'EX2')]);
    const { result } = render();
    await waitFor(() => expect(result.current.repartosExcepcionales).toHaveLength(2));
    await act(() => result.current.eliminarExcepcion(1));
    expect(result.current.repartosExcepcionales).toEqual([excepcion(2, 'EX2')]);
  });

  it('el fetch de choferes conserva al chofer virtual de una excepción ya cargada', async () => {
    // Las excepciones resuelven primero; choferes después, sin incluir al virtual
    mockExcepciones.mockResolvedValue([excepcion(1, 'EX1')]);
    let resolveChoferes: (c: Chofer[]) => void = () => {};
    mockChoferes.mockReturnValue(new Promise(res => { resolveChoferes = res; }));

    const { result } = render();
    await waitFor(() => expect(result.current.repartosExcepcionales).toHaveLength(1));
    // Aparece como virtual por el merge reactivo
    await waitFor(() => expect(result.current.choferes.some(c => c.codigo === 'EX1')).toBe(true));

    // Ahora resuelve el fetch de choferes reales, sin EX1: el merge del fetch lo re-agrega
    await act(async () => { resolveChoferes([chofer('CH1')]); });
    await waitFor(() => {
      const codigos = result.current.choferes.map(c => c.codigo).sort();
      expect(codigos).toEqual(['CH1', 'EX1']);
    });
    // El virtual conserva el nombre de la excepción y no pisa datos si ya existiera
    expect(result.current.choferes.find(c => c.codigo === 'EX1')?.descripcion).toBe('Virtual EX1');
  });

  it('el merge no pisa a un chofer real con el mismo código', async () => {
    mockExcepciones.mockResolvedValue([excepcion(1, 'CH1')]);
    mockChoferes.mockResolvedValue([chofer('CH1')]);
    const { result } = render();
    await waitFor(() => expect(result.current.choferes).toHaveLength(1));
    expect(result.current.choferes[0].descripcion).toBe('Chofer CH1'); // el real, no el virtual
  });

  it('descarta respuestas de choferes fuera de orden (guard de carrera)', async () => {
    // Primer render dispara fetch #1 (lento); el rerender con otra fecha dispara #2 (rápido)
    let resolveViejo: (c: Chofer[]) => void = () => {};
    mockChoferes
      .mockReturnValueOnce(new Promise(res => { resolveViejo = res; }))
      .mockResolvedValueOnce([chofer('NUEVO')]);

    const setError = vi.fn();
    const { result, rerender } = renderHook(
      (p: { fechaDesde: string }) => useChoferesYExcepciones({ ...PARAMS, fechaDesde: p.fechaDesde, setError }),
      { initialProps: { fechaDesde: '2026-07-15' } }
    );
    rerender({ fechaDesde: '2026-07-16' });
    await waitFor(() => expect(result.current.choferes.some(c => c.codigo === 'NUEVO')).toBe(true));

    // La respuesta vieja llega tarde: debe ignorarse
    await act(async () => { resolveViejo([chofer('VIEJO')]); });
    expect(result.current.choferes.some(c => c.codigo === 'VIEJO')).toBe(false);
    expect(result.current.choferes.some(c => c.codigo === 'NUEVO')).toBe(true);
  });

  it('reporta errores de cada fuente con su mensaje', async () => {
    mockExcepciones.mockRejectedValue('raro');
    mockChoferes.mockRejectedValue('raro');
    const setError = vi.fn();
    renderHook(() => useChoferesYExcepciones({ ...PARAMS, setError }));
    await waitFor(() => expect(setError).toHaveBeenCalledWith('Error al cargar excepciones'));
    await waitFor(() => expect(setError).toHaveBeenCalledWith('Error al cargar choferes'));
  });

  it('recargarExcepciones reemplaza la lista y reporta errores', async () => {
    const { result } = render();
    await waitFor(() => expect(mockExcepciones).toHaveBeenCalled());
    mockExcepciones.mockResolvedValue([excepcion(5, 'EX5')]);
    await act(() => result.current.recargarExcepciones());
    expect(result.current.repartosExcepcionales).toEqual([excepcion(5, 'EX5')]);
  });

  it('recargarExcepciones con un rechazo que no es Error usa el mensaje default', async () => {
    const { result, setError } = render();
    await waitFor(() => expect(mockExcepciones).toHaveBeenCalled());
    mockExcepciones.mockRejectedValueOnce('raro');

    await act(() => result.current.recargarExcepciones());

    expect(setError).toHaveBeenCalledWith('Error al recargar excepciones');
  });

  it('recargarExcepciones usa el bibliaFecha ACTUAL, no uno stale de un closure viejo', async () => {
    const setError = vi.fn();
    const { result, rerender } = renderHook(
      (p: { bibliaFecha: string }) => useChoferesYExcepciones({ ...PARAMS, bibliaFecha: p.bibliaFecha, setError }),
      { initialProps: { bibliaFecha: '2026-07-20' } }
    );
    await waitFor(() => expect(mockExcepciones).toHaveBeenCalledTimes(1));

    rerender({ bibliaFecha: '2026-07-21' });
    await waitFor(() => expect(mockExcepciones).toHaveBeenCalledTimes(2));

    mockExcepciones.mockResolvedValueOnce([]);
    await act(() => result.current.recargarExcepciones());

    expect(mockExcepciones).toHaveBeenLastCalledWith('2026-07-21');
  });

  it('eliminarExcepcion con un rechazo que no es Error usa el mensaje default', async () => {
    const { result, setError } = render();
    await waitFor(() => expect(mockExcepciones).toHaveBeenCalled());
    mockEliminar.mockRejectedValueOnce('raro');

    await act(() => result.current.eliminarExcepcion(1));

    expect(setError).toHaveBeenCalledWith('Error al eliminar la excepción');
  });
});
