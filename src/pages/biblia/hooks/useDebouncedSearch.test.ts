import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebouncedSearch } from './useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('arranca con query vacío, sin resultados y sin loading', () => {
    const searchFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch(searchFn));
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(searchFn).not.toHaveBeenCalled();
  });

  it('actualiza el query inmediatamente al llamar a search, antes de que dispare el debounce', () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useDebouncedSearch(searchFn));
    act(() => result.current.search('abc'));
    expect(result.current.query).toBe('abc');
    expect(searchFn).not.toHaveBeenCalled();
  });

  it('tras el delay, llama a searchFn y carga los resultados', async () => {
    const searchFn = vi.fn().mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 300));
    act(() => result.current.search('abc'));
    await waitFor(() => expect(searchFn).toHaveBeenCalledWith('abc'));
    await waitFor(() => expect(result.current.results).toEqual([{ id: 1 }]));
    expect(result.current.loading).toBe(false);
  });

  it('con un query de menos de 1 carácter (vacío), no busca y vacía resultados', async () => {
    const searchFn = vi.fn().mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 10));
    act(() => result.current.search('a'));
    await waitFor(() => expect(result.current.results).toEqual([{ id: 1 }]));

    act(() => result.current.search(''));
    expect(result.current.results).toEqual([]);
    expect(result.current.query).toBe('');
  });

  it('un solo carácter SÍ dispara la búsqueda (largo mínimo 1, no 2)', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 10));
    act(() => result.current.search('a'));
    await waitFor(() => expect(searchFn).toHaveBeenCalledWith('a'));
  });

  it('mientras la promesa de búsqueda está pendiente, loading es true', async () => {
    let resolveSearch!: (v: unknown[]) => void;
    const searchFn = vi.fn().mockReturnValue(new Promise(res => { resolveSearch = res; }));
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 10));
    act(() => result.current.search('abc'));
    await waitFor(() => expect(result.current.loading).toBe(true));
    act(() => resolveSearch([]));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('escribir de nuevo antes de que dispare el debounce anterior cancela esa búsqueda (solo una llamada)', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 50));
    act(() => result.current.search('a'));
    act(() => result.current.search('ab'));
    await new Promise(r => setTimeout(r, 80));
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenCalledWith('ab');
  });

  it('si searchFn rechaza, deja resultados vacíos y loading en false (no rompe)', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 10));
    act(() => result.current.search('abc'));
    await waitFor(() => expect(searchFn).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toEqual([]);
  });

  it('si searchFn rechaza habiendo resultados previos, los vacía (no los deja stale)', async () => {
    const searchFn = vi.fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 10));
    act(() => result.current.search('primero'));
    await waitFor(() => expect(result.current.results).toEqual([{ id: 1 }]));

    act(() => result.current.search('segundo'));
    await waitFor(() => expect(searchFn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.results).toEqual([]));
  });

  it('clear() vacía query y resultados, y cancela un debounce pendiente', async () => {
    const searchFn = vi.fn().mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 30));
    act(() => result.current.search('abc'));
    act(() => result.current.clear());
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);

    await new Promise(r => setTimeout(r, 60));
    expect(searchFn).not.toHaveBeenCalled();
  });

  it('setResults permite pisar los resultados manualmente (usado tras seleccionar un ítem)', () => {
    const searchFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch<{ id: number }>(searchFn));
    act(() => result.current.setResults([{ id: 9 }]));
    expect(result.current.results).toEqual([{ id: 9 }]);
  });

  it('al desmontar con un debounce pendiente, limpia el timer sin llamar a searchFn', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const { result, unmount } = renderHook(() => useDebouncedSearch(searchFn, 30));
    act(() => result.current.search('abc'));
    expect(() => unmount()).not.toThrow();
    await new Promise(r => setTimeout(r, 60));
    expect(searchFn).not.toHaveBeenCalled();
  });

  it('si delayMs cambia entre renders, la siguiente búsqueda usa el nuevo delay', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ delay }) => useDebouncedSearch(searchFn, delay),
      { initialProps: { delay: 1000 } },
    );
    rerender({ delay: 10 });
    act(() => result.current.search('abc'));
    await waitFor(() => expect(searchFn).toHaveBeenCalledWith('abc'), { timeout: 200 });
  });

  it('si searchFn cambia entre renders, la siguiente búsqueda usa la nueva función', async () => {
    const searchFnViejo = vi.fn().mockResolvedValue([{ id: 'viejo' }]);
    const searchFnNuevo = vi.fn().mockResolvedValue([{ id: 'nuevo' }]);
    const { result, rerender } = renderHook(
      ({ fn }) => useDebouncedSearch(fn, 10),
      { initialProps: { fn: searchFnViejo } },
    );
    rerender({ fn: searchFnNuevo });
    act(() => result.current.search('abc'));
    await waitFor(() => expect(result.current.results).toEqual([{ id: 'nuevo' }]));
    expect(searchFnViejo).not.toHaveBeenCalled();
  });

  it('respeta un delayMs distinto al default (300)', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useDebouncedSearch(searchFn, 1000));
    act(() => result.current.search('abc'));
    await new Promise(r => setTimeout(r, 200));
    expect(searchFn).not.toHaveBeenCalled();
    await waitFor(() => expect(searchFn).toHaveBeenCalled(), { timeout: 2000 });
  });
});
