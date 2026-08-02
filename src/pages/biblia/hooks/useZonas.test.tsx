import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useZonas } from './useZonas';
import { fetchAllZonas } from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  fetchAllZonas: vi.fn(),
}));

const mockZonas = vi.mocked(fetchAllZonas);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useZonas', () => {
  it('arranca con listas vacías antes de que resuelva el fetch', () => {
    mockZonas.mockReturnValue(new Promise(() => {})); // nunca resuelve
    const setError = vi.fn();
    const { result } = renderHook(() => useZonas(setError));
    expect(result.current.zonas).toEqual([]);
    expect(result.current.zonasSeleccionadas).toEqual([]);
  });

  it('carga solo las zonas activas, reducidas a id y nombre', async () => {
    mockZonas.mockResolvedValue([
      { id: 1, nombre: 'Norte', desactivado: 0 },
      { id: 2, nombre: 'Sur', desactivado: 1 },
    ]);
    const setErrorStable = vi.fn();
    const { result } = renderHook(() => useZonas(setErrorStable));
    await waitFor(() => expect(result.current.zonas).toEqual([{ id: 1, nombre: 'Norte' }]));
  });

  it('toggleZona saca solo la zona toggleada, no las demás', async () => {
    mockZonas.mockResolvedValue([]);
    const setErrorStable = vi.fn();
    const { result } = renderHook(() => useZonas(setErrorStable));
    act(() => result.current.setZonasSeleccionadas([1, 2, 3]));
    act(() => result.current.toggleZona(2));
    expect(result.current.zonasSeleccionadas).toEqual([1, 3]);
    act(() => result.current.toggleZona(2));
    expect(result.current.zonasSeleccionadas).toEqual([1, 3, 2]);
  });

  it('reporta el error de carga con el mensaje exacto', async () => {
    mockZonas.mockRejectedValue(new Error('sin red'));
    const setError = vi.fn();
    renderHook(() => useZonas(setError));
    await waitFor(() => expect(setError).toHaveBeenCalledWith('sin red'));
  });

  it('usa el mensaje de fallback si el error no es un Error', async () => {
    mockZonas.mockRejectedValue('raro');
    const setError = vi.fn();
    renderHook(() => useZonas(setError));
    await waitFor(() => expect(setError).toHaveBeenCalledWith('Error al cargar zonas'));
  });
});
