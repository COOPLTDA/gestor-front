import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAsignaciones } from './useAsignaciones';
import { fetchAsignaciones } from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  fetchAsignaciones: vi.fn(),
}));

const mockFetch = vi.mocked(fetchAsignaciones);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAsignaciones', () => {
  it('arranca vacío antes de que resuelva el fetch', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const setErrorStable = vi.fn();
    const { result } = renderHook(() => useAsignaciones(setErrorStable));
    expect(result.current.rawAsignaciones).toEqual([]);
  });

  it('carga las asignaciones y sincroniza el ref', async () => {
    const filas = [{ preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: '2026-07-20', preparacion_fecha: '2026-07-17' }];
    mockFetch.mockResolvedValue(filas);
    const setErrorStable = vi.fn();
    const { result } = renderHook(() => useAsignaciones(setErrorStable));
    await waitFor(() => expect(result.current.rawAsignaciones).toEqual(filas));
    expect(result.current.rawAsignacionesRef.current).toEqual(filas);
  });

  it('reporta el error con el mensaje exacto y el fallback', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));
    const setError = vi.fn();
    renderHook(() => useAsignaciones(setError));
    await waitFor(() => expect(setError).toHaveBeenCalledWith('timeout'));

    mockFetch.mockRejectedValue('raro');
    const setError2 = vi.fn();
    renderHook(() => useAsignaciones(setError2));
    await waitFor(() => expect(setError2).toHaveBeenCalledWith('Error al cargar asignaciones'));
  });

  it('vuelve a hacer fetch si cambia la identidad de setError (efecto atado a esa dependencia)', async () => {
    mockFetch.mockResolvedValue([]);
    const setErrorA = vi.fn();
    const { rerender } = renderHook(({ se }) => useAsignaciones(se), { initialProps: { se: setErrorA } });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const setErrorB = vi.fn();
    act(() => rerender({ se: setErrorB }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
