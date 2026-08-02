import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePreparacionesYCambios } from './usePreparacionesYCambios';
import { fetchPreparaciones, fetchCambiosEstado, impactarEnSigma, type PedidoCambioEstado } from '@/services/bibliaApi';
import { type AsignacionRaw } from './bibliaSelectors';
import type { Preparacion, CodigoDespacho } from '../types/biblia';

vi.mock('@/services/bibliaApi', () => ({
  fetchPreparaciones: vi.fn(),
  fetchCambiosEstado: vi.fn(),
  impactarEnSigma: vi.fn(),
}));

const mockPreps = vi.mocked(fetchPreparaciones);
const mockCambios = vi.mocked(fetchCambiosEstado);
const mockImpactar = vi.mocked(impactarEnSigma);

const PARAMS = { fechaDesde: '2026-07-17', fechaHasta: '2026-07-19', bibliaFecha: '2026-07-20' };
const CODIGOS = [
  { id: 200, nombre: 'SUR', desactivado: 0, direccion: '' },
  { id: 150, nombre: 'BIG', desactivado: 0, direccion: '' },
] as CodigoDespacho[];

function prepConPedidos(id: number, codigos: (string | null)[]): Preparacion {
  return {
    id,
    tipo: 'CONSOLIDADO',
    estado: 'Completada',
    codigo_envio: `E-${id}`,
    pedidos: codigos.map((c, i) => ({ codigo: `P${id}-${i}`, codigo_despacho: c })),
    cantidad_pedidos: codigos.length,
  } as unknown as Preparacion;
}

function okAsig(preparacion_id: number, destino: string | null, extra: Partial<AsignacionRaw> = {}): AsignacionRaw {
  return {
    preparacion_id,
    chofer_codigo: 'CH1',
    biblia_fecha: PARAMS.bibliaFecha,
    preparacion_fecha: '2026-07-17',
    sigma_sync_estado: 'ok',
    codigo_despacho_destino: destino,
    ...extra,
  };
}

type Updater<T> = (prev: T[]) => T[];

function lastUpdater<T>(setter: ReturnType<typeof vi.fn>): Updater<T> {
  const calls = setter.mock.calls.filter(c => typeof c[0] === 'function');
  if (calls.length === 0) throw new Error('no functional updater captured');
  return calls[calls.length - 1][0] as Updater<T>;
}

function render() {
  const setRawAsignaciones = vi.fn();
  const setError = vi.fn();
  const codigosDespachoRef = { current: CODIGOS };
  const utils = renderHook(() => usePreparacionesYCambios({
    ...PARAMS, codigosDespachoRef, setRawAsignaciones, setError,
  }));
  return { ...utils, setRawAsignaciones, setError };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPreps.mockResolvedValue([]);
  mockCambios.mockResolvedValue([]);
  mockImpactar.mockResolvedValue({ ok: [], fallido: [], error: [], total: 0 });
});

describe('usePreparacionesYCambios — estado inicial', () => {
  it('arranca cargando y con listas vacías', () => {
    mockPreps.mockReturnValue(new Promise(() => {}));
    mockCambios.mockReturnValue(new Promise(() => {}));
    const { result } = render();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.preparaciones).toEqual([]);
    expect(result.current.rawPedidoCambios).toEqual([]);
  });
});

describe('usePreparacionesYCambios — reconciliación cross-code', () => {
  async function updaterTrasCarga(preps: Preparacion[]) {
    mockPreps.mockResolvedValue(preps);
    const rendered = render();
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    return { updater: lastUpdater<AsignacionRaw>(rendered.setRawAsignaciones), ...rendered };
  }

  it('limpia el ok cuando Digip refleja el destino en todos los pedidos (fila intacta salvo el estado)', async () => {
    const { updater } = await updaterTrasCarga([prepConPedidos(7, ['SUR'])]);
    const prev = [okAsig(7, '200')];
    const next = updater(prev);
    expect(next[0]).toEqual({ ...prev[0], sigma_sync_estado: 'no_aplica' });
  });

  it('devuelve el MISMO array si no hay nada que reconciliar', async () => {
    const { updater } = await updaterTrasCarga([prepConPedidos(7, ['BIG'])]);
    const prev = [okAsig(7, '200')]; // destino SUR, Digip muestra BIG → sigue ok
    expect(updater(prev)).toBe(prev); // identidad: no se crea un array nuevo
  });

  it('no toca asignaciones pendientes aunque Digip muestre el destino', async () => {
    const { updater } = await updaterTrasCarga([prepConPedidos(7, ['SUR'])]);
    const prev = [okAsig(7, '200', { sigma_sync_estado: 'pendiente' })];
    expect(updater(prev)).toBe(prev);
  });

  it('no toca un ok sin destino ni una prep que no vino en los datos', async () => {
    const { updater } = await updaterTrasCarga([prepConPedidos(7, ['SUR'])]);
    const sinDestino = [okAsig(7, null)];
    expect(updater(sinDestino)).toBe(sinDestino);
    const otraPrep = [okAsig(99, '200')];
    expect(updater(otraPrep)).toBe(otraPrep);
  });

  it('no limpia el ok si la prep quedó multi-código aunque incluya el destino', async () => {
    const { updater } = await updaterTrasCarga([prepConPedidos(7, ['SUR', 'BIG'])]);
    const prev = [okAsig(7, '200')];
    expect(updater(prev)).toBe(prev); // size 2: ni caso 1 ni caso 2 (no hay cambios ok)
  });

  it('caso 2 no aplica si el destino del cross-code no resuelve a ningún nombre conocido', async () => {
    // codigo_despacho_destino '999' no existe en CODIGOS -> destinoNombre queda null.
    // Aunque el resto de las condiciones del caso 2 se cumplirían, debe quedar sin tocar.
    mockCambios.mockResolvedValue([
      { pedido_codigo: 'P7-0', preparacion_id: 7, nuevo_codigo_despacho: 'BIG', estado: 'ok' } as PedidoCambioEstado,
    ]);
    const { updater } = await updaterTrasCarga([prepConPedidos(7, ['SUR'])]);
    const prev = [okAsig(7, '999')];
    expect(updater(prev)).toBe(prev);
  });

  it('caso 2: cambios individuales ok reemplazan al cross-code y lo limpian', async () => {
    // Primer load: prime de rawPedidoCambios con un cambio ok de la prep 7
    mockCambios.mockResolvedValue([
      { pedido_codigo: 'P7-0', preparacion_id: 7, nuevo_codigo_despacho: 'BIG', estado: 'ok' } as PedidoCambioEstado,
    ]);
    mockPreps.mockResolvedValue([prepConPedidos(7, ['BIG'])]);
    const rendered = render();
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    await waitFor(() => expect(rendered.result.current.rawPedidoCambios).toHaveLength(0)); // BIG ya reflejado → cambio descartado

    // Segundo load: el ref de cambios se labura en cargarPreparaciones; recargar con el
    // cambio ok todavía vigente (nuevo código aún no reflejado en otro pedido)
    mockCambios.mockResolvedValue([
      { pedido_codigo: 'PY', preparacion_id: 7, nuevo_codigo_despacho: 'SUR', estado: 'ok' } as PedidoCambioEstado,
    ]);
    await act(async () => { rendered.result.current.recargarPreparaciones(); });
    await waitFor(() => expect(rendered.result.current.rawPedidoCambios).toHaveLength(1));
    await act(async () => { rendered.result.current.recargarPreparaciones(); });

    const updater = lastUpdater<AsignacionRaw>(rendered.setRawAsignaciones);
    // El cross-code apuntaba a SUR pero Digip muestra BIG y hay cambios ok de la prep → limpiar
    const prev = [okAsig(7, '200')];
    const next = updater(prev);
    expect(next[0].sigma_sync_estado).toBe('no_aplica');
  });
});

describe('usePreparacionesYCambios — reconciliarCambios aislado (fetchPreparaciones nunca resuelve)', () => {
  // Con fetchPreparaciones colgado, el único filtro que se ejercita es reconciliarCambios
  // (vía cargarCambios), aislándolo del filtro inline duplicado en cargarPreparaciones.
  function renderConPrepsColgado() {
    mockPreps.mockReturnValue(new Promise(() => {}));
    return render();
  }

  it('un cambio no-ok con nuevo_codigo_despacho null se conserva (el guard de estado corta antes)', async () => {
    mockCambios.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: null, estado: 'pendiente' },
    ] as PedidoCambioEstado[]);
    const { result } = renderConPrepsColgado();
    await waitFor(() => expect(result.current.rawPedidoCambios).toHaveLength(1));
  });

  it('un cambio ok sin nuevo_codigo_despacho se descarta', async () => {
    mockCambios.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: null, estado: 'ok' },
    ] as PedidoCambioEstado[]);
    const { result } = renderConPrepsColgado();
    await waitFor(() => expect(mockCambios).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 0));
    expect(result.current.rawPedidoCambios).toHaveLength(0);
  });
});

describe('usePreparacionesYCambios — reconciliación de cambios individuales', () => {
  it('descarta ok sin nuevo código, conserva pendientes y ok no reflejados', async () => {
    mockPreps.mockResolvedValue([prepConPedidos(7, ['SUR'])]);
    mockCambios.mockResolvedValue([
      { pedido_codigo: 'P7-0', preparacion_id: 7, nuevo_codigo_despacho: null, estado: 'ok' },
      { pedido_codigo: 'P7-0', preparacion_id: 7, nuevo_codigo_despacho: 'BIG', estado: 'ok' },
      { pedido_codigo: 'P7-0', preparacion_id: 7, nuevo_codigo_despacho: 'SUR', estado: 'ok' },
      { pedido_codigo: 'P7-0', preparacion_id: 7, nuevo_codigo_despacho: 'X', estado: 'pendiente' },
    ] as PedidoCambioEstado[]);
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => {
      const restantes = result.current.rawPedidoCambios;
      // ok sin código → afuera; ok a SUR (ya reflejado en P7-0) → afuera;
      // ok a BIG (no reflejado) → queda; pendiente → queda
      expect(restantes).toHaveLength(2);
      expect(restantes.some(c => c.estado === 'pendiente')).toBe(true);
      expect(restantes.some(c => c.estado === 'ok' && c.nuevo_codigo_despacho === 'BIG')).toBe(true);
    });
  });
});

describe('usePreparacionesYCambios — errores e impactar', () => {
  it('usa los mensajes de fallback exactos cuando el error no es un Error', async () => {
    mockPreps.mockRejectedValue('raro');
    mockCambios.mockRejectedValue('raro');
    const { setError, result } = render();
    await waitFor(() => expect(setError).toHaveBeenCalledWith('Error al cargar preparaciones'));
    await waitFor(() => expect(setError).toHaveBeenCalledWith('Error al cargar cambios pendientes'));

    mockImpactar.mockRejectedValue('raro');
    await expect(act(() => result.current.impactarEnSigma())).rejects.toBe('raro');
    expect(setError).toHaveBeenCalledWith('Error al impactar en Sigma');
  });

  it('impactar marca ok/fallido solo sobre pendientes y fallidos', async () => {
    mockImpactar.mockResolvedValue({ ok: [1], fallido: [2], error: [3], total: 3 });
    const { result, setRawAsignaciones } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.impactarEnSigma(); });
    const updater = lastUpdater<AsignacionRaw>(setRawAsignaciones);
    const prev = [
      okAsig(1, '200', { sigma_sync_estado: 'pendiente' }),
      okAsig(2, '200', { sigma_sync_estado: 'fallido' }),
      okAsig(3, '200', { sigma_sync_estado: 'pendiente' }),
      okAsig(4, '200', { sigma_sync_estado: 'ok' }),
    ];
    const next = updater(prev);
    expect(next.map(a => a.sigma_sync_estado)).toEqual(['ok', 'fallido', 'fallido', 'ok']);
    expect(next[3]).toBe(prev[3]); // los ok no se tocan
  });

  it('impactar no toca una asignación ya "ok" aunque su id aparezca en result.ok/fallido', async () => {
    // Distingue del test anterior: acá el id de la fila "ok" SÍ está en las listas del
    // resultado, para probar que el guard de estado (pendiente/fallido) corta antes de
    // mirar esas listas, y no que "simplemente no matcheó ningún id".
    mockImpactar.mockResolvedValue({ ok: [5], fallido: [], error: [], total: 1 });
    const { result, setRawAsignaciones } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.impactarEnSigma(); });
    const updater = lastUpdater<AsignacionRaw>(setRawAsignaciones);
    const prev = [okAsig(5, '200', { sigma_sync_estado: 'ok' })];
    expect(updater(prev)[0]).toBe(prev[0]); // el objeto queda intacto (misma referencia)
  });

  it('una respuesta viejísima (fetch #1) no apaga isLoading mientras un fetch #3 sigue pendiente', async () => {
    let resolveUno: (v: Preparacion[]) => void = () => {};
    let resolveTres: (v: Preparacion[]) => void = () => {};
    mockPreps
      .mockImplementationOnce(() => new Promise(res => { resolveUno = res; })) // fetch #1 (mount)
      .mockResolvedValueOnce([]) // fetch #2 (resuelve ya)
      .mockImplementationOnce(() => new Promise(res => { resolveTres = res; })); // fetch #3
    const { result } = render();
    await waitFor(() => expect(mockPreps).toHaveBeenCalledTimes(1));

    act(() => { result.current.recargarPreparaciones(); }); // dispara #2
    await waitFor(() => expect(result.current.isLoading).toBe(false)); // #2 resolvió, id vigente

    act(() => { result.current.recargarPreparaciones(); }); // dispara #3, isLoading vuelve a true
    expect(result.current.isLoading).toBe(true);

    // Llega tardísimo el fetch #1 (el más viejo de todos): no debe apagar isLoading
    // porque el fetch vigente (#3) todavía no resolvió.
    await act(async () => { resolveUno([]); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolveTres([]); });
    expect(result.current.isLoading).toBe(false);
  });
});
