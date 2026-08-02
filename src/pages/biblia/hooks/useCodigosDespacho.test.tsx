import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCodigosDespacho } from './useCodigosDespacho';
import { fetchCodigosDespacho } from '@/services/bibliaApi';
import type { CodigoDespacho } from '../types/biblia';

vi.mock('@/services/bibliaApi', () => ({
  fetchCodigosDespacho: vi.fn(),
}));

const mockFetch = vi.mocked(fetchCodigosDespacho);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCodigosDespacho', () => {
  it('arranca vacío antes de que resuelva el fetch', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const setErrorStable = vi.fn();
    const { result } = renderHook(() => useCodigosDespacho(setErrorStable));
    expect(result.current.codigosDespacho).toEqual([]);
  });

  it('carga los códigos y sincroniza el ref', async () => {
    const codigos = [{ id: 150, nombre: 'BIG', desactivado: 0, direccion: '' }] as CodigoDespacho[];
    mockFetch.mockResolvedValue(codigos);
    const setErrorStable = vi.fn();
    const { result } = renderHook(() => useCodigosDespacho(setErrorStable));
    await waitFor(() => expect(result.current.codigosDespacho).toEqual(codigos));
    expect(result.current.codigosDespachoRef.current).toEqual(codigos);
  });

  it('reporta el error con el mensaje exacto y el fallback', async () => {
    mockFetch.mockRejectedValue(new Error('500'));
    const setError = vi.fn();
    renderHook(() => useCodigosDespacho(setError));
    await waitFor(() => expect(setError).toHaveBeenCalledWith('500'));

    mockFetch.mockRejectedValue('raro');
    const setError2 = vi.fn();
    renderHook(() => useCodigosDespacho(setError2));
    await waitFor(() => expect(setError2).toHaveBeenCalledWith('Error al cargar repartos'));
  });

  it('vuelve a hacer fetch si cambia la identidad de setError (efecto atado a esa dependencia)', async () => {
    mockFetch.mockResolvedValue([]);
    const setErrorA = vi.fn();
    const { rerender } = renderHook(({ se }) => useCodigosDespacho(se), { initialProps: { se: setErrorA } });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const setErrorB = vi.fn();
    act(() => rerender({ se: setErrorB }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
