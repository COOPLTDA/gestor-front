import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePdvData } from './usePdvData';
import { fetchPdv } from '@/services/zonificacionApi';

vi.mock('@/services/zonificacionApi', () => ({
  fetchPdv: vi.fn(),
}));

const mockFetchPdv = vi.mocked(fetchPdv);
const RANGO = { desde: '2025-07-01', hasta: '2026-07-01' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePdvData', () => {
  it('arranca en loading, con data vacía', () => {
    mockFetchPdv.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePdvData(RANGO));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('carga los datos y apaga el loading', async () => {
    const pdv = [{ id: '1' }] as any;
    mockFetchPdv.mockResolvedValue(pdv);

    const { result } = renderHook(() => usePdvData(RANGO));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(pdv);
    expect(result.current.error).toBeNull();
  });

  it('reporta el mensaje de error si el fetch rechaza', async () => {
    mockFetchPdv.mockRejectedValue(new Error('falló la red'));

    const { result } = renderHook(() => usePdvData(RANGO));

    await waitFor(() => expect(result.current.error).toBe('falló la red'));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
  });

  it('pasa el rango recibido a fetchPdv y refetchea si cambia', async () => {
    mockFetchPdv.mockResolvedValue([]);
    const { result, rerender } = renderHook(({ rango }) => usePdvData(rango), { initialProps: { rango: RANGO } });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchPdv).toHaveBeenCalledWith(RANGO);

    const NUEVO_RANGO = { desde: '2026-01-01', hasta: '2026-06-01' };
    rerender({ rango: NUEVO_RANGO });

    await waitFor(() => expect(mockFetchPdv).toHaveBeenCalledWith(NUEVO_RANGO));
  });
});
