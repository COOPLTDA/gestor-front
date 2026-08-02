import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as api from '@/services/bibliaApi';
import type { GrupoDireccion } from '@/pages/biblia/types/biblia';
import type { ResumenChofer, MapaCliente } from '@/services/bibliaApi';
import {
  useRangoAsignacionesFetch, useDireccionGruposFetch, useRangoDirectoGruposFetch,
  useResumenFetch, useMapaFetch,
} from './reporteFetchHooks';

vi.mock('@/services/bibliaApi');

beforeEach(() => {
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useRangoAsignacionesFetch', () => {
  it('no llama al fetch si la vista no es biblia, mapa ni personalizado', () => {
    const setRangoAsignaciones = vi.fn();
    renderHook(() => useRangoAsignacionesFetch('2026-07-10', 'resumen', setRangoAsignaciones, vi.fn()));
    expect(api.fetchRangoBiblia).not.toHaveBeenCalled();
  });

  it.each(['biblia', 'mapa', 'personalizado'] as const)('llama al fetch para vista %s y setea "cargando" antes de resolver', async (vista) => {
    vi.mocked(api.fetchRangoBiblia).mockResolvedValue({ fecha_desde: '2026-07-08', fecha_hasta: '2026-07-10' });
    const setRangoAsignaciones = vi.fn();
    renderHook(() => useRangoAsignacionesFetch('2026-07-10', vista, setRangoAsignaciones, vi.fn()));
    expect(setRangoAsignaciones).toHaveBeenCalledWith('cargando');
    await waitFor(() => expect(setRangoAsignaciones).toHaveBeenCalledWith({ fecha_desde: '2026-07-08', fecha_hasta: '2026-07-10' }));
    expect(api.fetchRangoBiblia).toHaveBeenCalledWith('2026-07-10');
  });

  it('ante un error, informa el mensaje y deja el rango en null', async () => {
    vi.mocked(api.fetchRangoBiblia).mockRejectedValue(new Error('boom'));
    const setRangoAsignaciones = vi.fn();
    const setFetchError = vi.fn();
    renderHook(() => useRangoAsignacionesFetch('2026-07-10', 'biblia', setRangoAsignaciones, setFetchError));
    await waitFor(() => expect(setFetchError).toHaveBeenCalledWith('boom'));
    expect(setRangoAsignaciones).toHaveBeenCalledWith(null);
  });

  it('ante un error no-Error, usa el mensaje genérico', async () => {
    vi.mocked(api.fetchRangoBiblia).mockRejectedValue('algo raro');
    const setFetchError = vi.fn();
    renderHook(() => useRangoAsignacionesFetch('2026-07-10', 'biblia', vi.fn(), setFetchError));
    await waitFor(() => expect(setFetchError).toHaveBeenCalledWith('Error al cargar el rango de la biblia'));
  });

  it('una respuesta vieja (fecha cambió antes de resolver) no pisa el estado', async () => {
    let resolveFirst: (v: { fecha_desde: string; fecha_hasta: string }) => void;
    vi.mocked(api.fetchRangoBiblia).mockImplementationOnce(() => new Promise(res => { resolveFirst = res; }));
    vi.mocked(api.fetchRangoBiblia).mockResolvedValueOnce({ fecha_desde: '2026-07-09', fecha_hasta: '2026-07-09' });
    const setRangoAsignaciones = vi.fn();
    const { rerender } = renderHook(
      ({ fecha }) => useRangoAsignacionesFetch(fecha, 'biblia', setRangoAsignaciones, vi.fn()),
      { initialProps: { fecha: '2026-07-10' } },
    );
    rerender({ fecha: '2026-07-11' });
    await waitFor(() => expect(setRangoAsignaciones).toHaveBeenCalledWith({ fecha_desde: '2026-07-09', fecha_hasta: '2026-07-09' }));
    resolveFirst!({ fecha_desde: '2026-07-08', fecha_hasta: '2026-07-08' });
    await new Promise(r => setTimeout(r, 0));
    expect(setRangoAsignaciones).not.toHaveBeenCalledWith({ fecha_desde: '2026-07-08', fecha_hasta: '2026-07-08' });
  });

  it('un error de una respuesta vieja, tras una más nueva ya resuelta, no informa el error ni pisa el rango', async () => {
    const first = deferred<{ fecha_desde: string; fecha_hasta: string }>();
    const second = deferred<{ fecha_desde: string; fecha_hasta: string }>();
    vi.mocked(api.fetchRangoBiblia).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setRangoAsignaciones = vi.fn();
    const setFetchError = vi.fn();
    const { rerender } = renderHook(
      ({ fecha }) => useRangoAsignacionesFetch(fecha, 'biblia', setRangoAsignaciones, setFetchError),
      { initialProps: { fecha: '2026-07-10' } },
    );
    rerender({ fecha: '2026-07-11' });
    second.resolve({ fecha_desde: '2026-07-09', fecha_hasta: '2026-07-09' });
    await waitFor(() => expect(setRangoAsignaciones).toHaveBeenCalledWith({ fecha_desde: '2026-07-09', fecha_hasta: '2026-07-09' }));
    setRangoAsignaciones.mockClear();
    first.reject(new Error('vieja falló'));
    await new Promise(r => setTimeout(r, 0));
    expect(setFetchError).not.toHaveBeenCalled();
    expect(setRangoAsignaciones).not.toHaveBeenCalled();
  });
});

describe('useDireccionGruposFetch', () => {
  it('no llama al fetch para vistas que no son biblia ni personalizado', () => {
    renderHook(() => useDireccionGruposFetch('rango', '2026-07-10', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-10' }, vi.fn(), vi.fn(), vi.fn(), vi.fn()));
    expect(api.fetchRepartosPorDireccion).not.toHaveBeenCalled();
  });

  it('si el rango sigue "cargando", no llama al fetch', () => {
    renderHook(() => useDireccionGruposFetch('biblia', '2026-07-10', 'cargando', vi.fn(), vi.fn(), vi.fn(), vi.fn()));
    expect(api.fetchRepartosPorDireccion).not.toHaveBeenCalled();
  });

  it('si el rango es null, vacía los grupos sin llamar al fetch', () => {
    const setGrupos = vi.fn();
    renderHook(() => useDireccionGruposFetch('biblia', '2026-07-10', null, setGrupos, vi.fn(), vi.fn(), vi.fn()));
    expect(setGrupos).toHaveBeenCalledWith([]);
    expect(api.fetchRepartosPorDireccion).not.toHaveBeenCalled();
  });

  it('con rango resuelto, llama al fetch con fecha_desde/hasta/bibliaFecha y setea loading true/false', async () => {
    vi.mocked(api.fetchRepartosPorDireccion).mockResolvedValue([]);
    const setLoading = vi.fn();
    renderHook(() => useDireccionGruposFetch('biblia', '2026-07-10', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, vi.fn(), setLoading, vi.fn(), vi.fn()));
    expect(setLoading).toHaveBeenCalledWith(true);
    await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
    expect(api.fetchRepartosPorDireccion).toHaveBeenCalledWith('2026-07-08', '2026-07-09', '2026-07-10');
  });

  it('al resolver, setea los grupos y ejecuta el callback onSuccess', async () => {
    const grupos = [{ direccion: 'LOMAS' }];
    vi.mocked(api.fetchRepartosPorDireccion).mockResolvedValue(grupos as never);
    const setGrupos = vi.fn();
    const onSuccess = vi.fn();
    renderHook(() => useDireccionGruposFetch('personalizado', '2026-07-10', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, setGrupos, vi.fn(), vi.fn(), onSuccess));
    await waitFor(() => expect(setGrupos).toHaveBeenCalledWith(grupos));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('ante un error, informa el mensaje y no llama a onSuccess', async () => {
    vi.mocked(api.fetchRepartosPorDireccion).mockRejectedValue(new Error('fetch falló'));
    const setFetchError = vi.fn();
    const onSuccess = vi.fn();
    renderHook(() => useDireccionGruposFetch('biblia', '2026-07-10', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, vi.fn(), vi.fn(), setFetchError, onSuccess));
    await waitFor(() => expect(setFetchError).toHaveBeenCalledWith('fetch falló'));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('una respuesta vieja resuelta después de una más nueva no pisa grupos/loading', async () => {
    const first = deferred<GrupoDireccion[]>();
    const second = deferred<GrupoDireccion[]>();
    vi.mocked(api.fetchRepartosPorDireccion).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setGrupos = vi.fn();
    const setLoading = vi.fn();
    const onSuccess = vi.fn();
    const { rerender } = renderHook(
      ({ fecha }) => useDireccionGruposFetch('biblia', fecha, { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, setGrupos, setLoading, vi.fn(), onSuccess),
      { initialProps: { fecha: '2026-07-10' } },
    );
    rerender({ fecha: '2026-07-11' });
    second.resolve([{ direccion: 'NUEVA' }] as never);
    await waitFor(() => expect(setGrupos).toHaveBeenCalledWith([{ direccion: 'NUEVA' }]));
    expect(setLoading).toHaveBeenLastCalledWith(false);
    first.resolve([{ direccion: 'VIEJA' }] as never);
    await new Promise(r => setTimeout(r, 0));
    expect(setGrupos).not.toHaveBeenCalledWith([{ direccion: 'VIEJA' }]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('un error de una respuesta vieja, tras una más nueva ya resuelta, no informa el error ni vuelve a tocar loading', async () => {
    const first = deferred<GrupoDireccion[]>();
    const second = deferred<GrupoDireccion[]>();
    vi.mocked(api.fetchRepartosPorDireccion).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setFetchError = vi.fn();
    const setLoading = vi.fn();
    const { rerender } = renderHook(
      ({ fecha }) => useDireccionGruposFetch('biblia', fecha, { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, vi.fn(), setLoading, setFetchError, vi.fn()),
      { initialProps: { fecha: '2026-07-10' } },
    );
    rerender({ fecha: '2026-07-11' });
    second.resolve([] as never);
    await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
    setLoading.mockClear();
    first.reject(new Error('vieja falló'));
    await new Promise(r => setTimeout(r, 0));
    expect(setFetchError).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });
});

describe('useRangoDirectoGruposFetch', () => {
  it('no llama al fetch si la vista no es rango', () => {
    renderHook(() => useRangoDirectoGruposFetch('biblia', '2026-07-01', '2026-07-05', vi.fn(), vi.fn(), vi.fn(), vi.fn()));
    expect(api.fetchRepartosPorDireccion).not.toHaveBeenCalled();
  });

  it('en vista rango llama al fetch solo con fecha desde/hasta (sin bibliaFecha)', async () => {
    vi.mocked(api.fetchRepartosPorDireccion).mockResolvedValue([]);
    renderHook(() => useRangoDirectoGruposFetch('rango', '2026-07-01', '2026-07-05', vi.fn(), vi.fn(), vi.fn(), vi.fn()));
    await waitFor(() => expect(api.fetchRepartosPorDireccion).toHaveBeenCalledWith('2026-07-01', '2026-07-05'));
  });

  it('al resolver ejecuta el callback onSuccess', async () => {
    vi.mocked(api.fetchRepartosPorDireccion).mockResolvedValue([]);
    const onSuccess = vi.fn();
    renderHook(() => useRangoDirectoGruposFetch('rango', '2026-07-01', '2026-07-05', vi.fn(), vi.fn(), vi.fn(), onSuccess));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('ante un error, informa el mensaje genérico si no es instancia de Error', async () => {
    vi.mocked(api.fetchRepartosPorDireccion).mockRejectedValue('nope');
    const setFetchError = vi.fn();
    renderHook(() => useRangoDirectoGruposFetch('rango', '2026-07-01', '2026-07-05', vi.fn(), vi.fn(), setFetchError, vi.fn()));
    await waitFor(() => expect(setFetchError).toHaveBeenCalledWith('Error al cargar los repartos por dirección'));
  });

  it('una respuesta vieja resuelta después de una más nueva no pisa grupos/loading/onSuccess', async () => {
    const first = deferred<GrupoDireccion[]>();
    const second = deferred<GrupoDireccion[]>();
    vi.mocked(api.fetchRepartosPorDireccion).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setGrupos = vi.fn();
    const setLoading = vi.fn();
    const onSuccess = vi.fn();
    const { rerender } = renderHook(
      ({ desde }) => useRangoDirectoGruposFetch('rango', desde, '2026-07-05', setGrupos, setLoading, vi.fn(), onSuccess),
      { initialProps: { desde: '2026-07-01' } },
    );
    rerender({ desde: '2026-07-02' });
    second.resolve([{ direccion: 'NUEVA' }] as never);
    await waitFor(() => expect(setGrupos).toHaveBeenCalledWith([{ direccion: 'NUEVA' }]));
    expect(setLoading).toHaveBeenLastCalledWith(false);
    first.resolve([{ direccion: 'VIEJA' }] as never);
    await new Promise(r => setTimeout(r, 0));
    expect(setGrupos).not.toHaveBeenCalledWith([{ direccion: 'VIEJA' }]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('un error de una respuesta vieja, tras una más nueva ya resuelta, no informa el error ni vuelve a tocar loading', async () => {
    const first = deferred<GrupoDireccion[]>();
    const second = deferred<GrupoDireccion[]>();
    vi.mocked(api.fetchRepartosPorDireccion).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setFetchError = vi.fn();
    const setLoading = vi.fn();
    const { rerender } = renderHook(
      ({ desde }) => useRangoDirectoGruposFetch('rango', desde, '2026-07-05', vi.fn(), setLoading, setFetchError, vi.fn()),
      { initialProps: { desde: '2026-07-01' } },
    );
    rerender({ desde: '2026-07-02' });
    second.resolve([] as never);
    await waitFor(() => expect(setLoading).toHaveBeenLastCalledWith(false));
    setLoading.mockClear();
    first.reject(new Error('vieja falló'));
    await new Promise(r => setTimeout(r, 0));
    expect(setFetchError).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });
});

describe('useResumenFetch', () => {
  it('no llama al fetch si la vista no es resumen', () => {
    renderHook(() => useResumenFetch('biblia', '2026-07-10', vi.fn(), vi.fn(), vi.fn()));
    expect(api.fetchResumenBiblia).not.toHaveBeenCalled();
  });

  it('en vista resumen llama al fetch con la fecha de biblia y setea loading true/false', async () => {
    vi.mocked(api.fetchResumenBiblia).mockResolvedValue([]);
    const setResumenLoading = vi.fn();
    renderHook(() => useResumenFetch('resumen', '2026-07-10', vi.fn(), setResumenLoading, vi.fn()));
    expect(setResumenLoading).toHaveBeenCalledWith(true);
    await waitFor(() => expect(setResumenLoading).toHaveBeenLastCalledWith(false));
    expect(api.fetchResumenBiblia).toHaveBeenCalledWith('2026-07-10');
  });

  it('al resolver, setea las entradas del resumen', async () => {
    const entries = [{ chofer_codigo: 'CH1' }];
    vi.mocked(api.fetchResumenBiblia).mockResolvedValue(entries as never);
    const setResumenEntries = vi.fn();
    renderHook(() => useResumenFetch('resumen', '2026-07-10', setResumenEntries, vi.fn(), vi.fn()));
    await waitFor(() => expect(setResumenEntries).toHaveBeenCalledWith(entries));
  });

  it('ante un error, informa el mensaje', async () => {
    vi.mocked(api.fetchResumenBiblia).mockRejectedValue(new Error('resumen roto'));
    const setFetchError = vi.fn();
    renderHook(() => useResumenFetch('resumen', '2026-07-10', vi.fn(), vi.fn(), setFetchError));
    await waitFor(() => expect(setFetchError).toHaveBeenCalledWith('resumen roto'));
  });

  it('una respuesta vieja resuelta después de una más nueva no pisa las entradas/loading', async () => {
    const first = deferred<ResumenChofer[]>();
    const second = deferred<ResumenChofer[]>();
    vi.mocked(api.fetchResumenBiblia).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setResumenEntries = vi.fn();
    const setResumenLoading = vi.fn();
    const { rerender } = renderHook(
      ({ fecha }) => useResumenFetch('resumen', fecha, setResumenEntries, setResumenLoading, vi.fn()),
      { initialProps: { fecha: '2026-07-10' } },
    );
    rerender({ fecha: '2026-07-11' });
    second.resolve([{ chofer_codigo: 'NUEVO' }] as never);
    await waitFor(() => expect(setResumenEntries).toHaveBeenCalledWith([{ chofer_codigo: 'NUEVO' }]));
    expect(setResumenLoading).toHaveBeenLastCalledWith(false);
    first.resolve([{ chofer_codigo: 'VIEJO' }] as never);
    await new Promise(r => setTimeout(r, 0));
    expect(setResumenEntries).not.toHaveBeenCalledWith([{ chofer_codigo: 'VIEJO' }]);
  });

  it('un error de una respuesta vieja, tras una más nueva ya resuelta, no informa el error ni vuelve a tocar loading', async () => {
    const first = deferred<ResumenChofer[]>();
    const second = deferred<ResumenChofer[]>();
    vi.mocked(api.fetchResumenBiblia).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setFetchError = vi.fn();
    const setResumenLoading = vi.fn();
    const { rerender } = renderHook(
      ({ fecha }) => useResumenFetch('resumen', fecha, vi.fn(), setResumenLoading, setFetchError),
      { initialProps: { fecha: '2026-07-10' } },
    );
    rerender({ fecha: '2026-07-11' });
    second.resolve([] as never);
    await waitFor(() => expect(setResumenLoading).toHaveBeenLastCalledWith(false));
    setResumenLoading.mockClear();
    first.reject(new Error('vieja falló'));
    await new Promise(r => setTimeout(r, 0));
    expect(setFetchError).not.toHaveBeenCalled();
    expect(setResumenLoading).not.toHaveBeenCalled();
  });
});

describe('useMapaFetch', () => {
  it('no llama al fetch si la vista no es mapa', () => {
    renderHook(() => useMapaFetch('biblia', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-10' }, '2026-07-10', vi.fn(), vi.fn(), vi.fn()));
    expect(api.fetchMapaClientes).not.toHaveBeenCalled();
  });

  it('si el rango sigue "cargando", no llama al fetch', () => {
    renderHook(() => useMapaFetch('mapa', 'cargando', '2026-07-10', vi.fn(), vi.fn(), vi.fn()));
    expect(api.fetchMapaClientes).not.toHaveBeenCalled();
  });

  it('si el rango es null, vacía los clientes sin llamar al fetch', () => {
    const setMapaClientes = vi.fn();
    renderHook(() => useMapaFetch('mapa', null, '2026-07-10', setMapaClientes, vi.fn(), vi.fn()));
    expect(setMapaClientes).toHaveBeenCalledWith([]);
    expect(api.fetchMapaClientes).not.toHaveBeenCalled();
  });

  it('con rango resuelto, llama al fetch con fecha_desde/hasta/bibliaFecha y setea loading true/false', async () => {
    vi.mocked(api.fetchMapaClientes).mockResolvedValue([]);
    const setMapaLoading = vi.fn();
    renderHook(() => useMapaFetch('mapa', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, '2026-07-10', vi.fn(), setMapaLoading, vi.fn()));
    expect(setMapaLoading).toHaveBeenCalledWith(true);
    await waitFor(() => expect(setMapaLoading).toHaveBeenLastCalledWith(false));
    expect(api.fetchMapaClientes).toHaveBeenCalledWith('2026-07-08', '2026-07-09', '2026-07-10');
  });

  it('al resolver, setea los clientes del mapa', async () => {
    const clientes = [{ codigo: 'C1' }];
    vi.mocked(api.fetchMapaClientes).mockResolvedValue(clientes as never);
    const setMapaClientes = vi.fn();
    renderHook(() => useMapaFetch('mapa', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, '2026-07-10', setMapaClientes, vi.fn(), vi.fn()));
    await waitFor(() => expect(setMapaClientes).toHaveBeenCalledWith(clientes));
  });

  it('ante un error, informa el mensaje', async () => {
    vi.mocked(api.fetchMapaClientes).mockRejectedValue(new Error('mapa roto'));
    const setFetchError = vi.fn();
    renderHook(() => useMapaFetch('mapa', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, '2026-07-10', vi.fn(), vi.fn(), setFetchError));
    await waitFor(() => expect(setFetchError).toHaveBeenCalledWith('mapa roto'));
  });

  it('una respuesta vieja resuelta después de una más nueva no pisa los clientes/loading', async () => {
    const first = deferred<MapaCliente[]>();
    const second = deferred<MapaCliente[]>();
    vi.mocked(api.fetchMapaClientes).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setMapaClientes = vi.fn();
    const setMapaLoading = vi.fn();
    const { rerender } = renderHook(
      ({ fecha }) => useMapaFetch('mapa', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, fecha, setMapaClientes, setMapaLoading, vi.fn()),
      { initialProps: { fecha: '2026-07-10' } },
    );
    rerender({ fecha: '2026-07-11' });
    second.resolve([{ codigo: 'NUEVO' }] as never);
    await waitFor(() => expect(setMapaClientes).toHaveBeenCalledWith([{ codigo: 'NUEVO' }]));
    expect(setMapaLoading).toHaveBeenLastCalledWith(false);
    first.resolve([{ codigo: 'VIEJO' }] as never);
    await new Promise(r => setTimeout(r, 0));
    expect(setMapaClientes).not.toHaveBeenCalledWith([{ codigo: 'VIEJO' }]);
  });

  it('un error de una respuesta vieja, tras una más nueva ya resuelta, no informa el error ni vuelve a tocar loading', async () => {
    const first = deferred<MapaCliente[]>();
    const second = deferred<MapaCliente[]>();
    vi.mocked(api.fetchMapaClientes).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    const setFetchError = vi.fn();
    const setMapaLoading = vi.fn();
    const { rerender } = renderHook(
      ({ fecha }) => useMapaFetch('mapa', { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-09' }, fecha, vi.fn(), setMapaLoading, setFetchError),
      { initialProps: { fecha: '2026-07-10' } },
    );
    rerender({ fecha: '2026-07-11' });
    second.resolve([] as never);
    await waitFor(() => expect(setMapaLoading).toHaveBeenLastCalledWith(false));
    setMapaLoading.mockClear();
    first.reject(new Error('vieja falló'));
    await new Promise(r => setTimeout(r, 0));
    expect(setFetchError).not.toHaveBeenCalled();
    expect(setMapaLoading).not.toHaveBeenCalled();
  });
});
