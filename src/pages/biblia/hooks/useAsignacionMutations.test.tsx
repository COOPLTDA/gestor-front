import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useAsignacionMutations, type AsignacionMutationsParams } from './useAsignacionMutations';
import { asignarPreparacionAChofer, asignarPreparacionesBatch, limpiarAsignacionesBiblia, type PedidoCambioEstado } from '@/services/bibliaApi';
import { type AsignacionRaw, prevBusinessDay } from './bibliaSelectors';
import type { Preparacion, SigmaSyncEstado } from '../types/biblia';

// Tests unitarios del sub-hook de mutaciones, complementarios a useBibliaData.test.tsx.
// Los setters se mockean sin ejecutar los updaters automáticamente: cada test aplica el
// updater capturado sobre un array controlado y asserta el resultado exacto.

vi.mock('@/services/bibliaApi', () => ({
  asignarPreparacionAChofer: vi.fn(),
  asignarPreparacionesBatch: vi.fn(),
  limpiarAsignacionesBiblia: vi.fn(),
}));

const mockAsignar = vi.mocked(asignarPreparacionAChofer);
const mockBatch = vi.mocked(asignarPreparacionesBatch);
const mockLimpiar = vi.mocked(limpiarAsignacionesBiblia);

const BIBLIA = '2026-07-20';
const HASTA = '2026-07-19';
const PREV_BD = prevBusinessDay(BIBLIA);

function prep(id: number, extra: Record<string, unknown> = {}): Preparacion {
  return {
    id,
    tipo: 'CONSOLIDADO',
    estado: 'Completada',
    codigo_envio: `E-${id}`,
    pedidos: [],
    cantidad_pedidos: 0,
    cantidad_clientes: 0,
    importe_total: 0,
    peso: 0,
    volumen: 0,
    peso_text: '0',
    volumen_text: '0',
    ...extra,
  } as unknown as Preparacion;
}

function pedido(codigo_despacho: string | null) {
  return { codigo: `P-${Math.random()}`, codigo_despacho } as Preparacion['pedidos'][number];
}

type Updater<T> = (prev: T[]) => T[];

function lastUpdater<T>(setter: ReturnType<typeof vi.fn>): Updater<T> {
  const calls = setter.mock.calls;
  const call = calls[calls.length - 1];
  if (!call || typeof call[0] !== 'function') throw new Error('no functional updater captured');
  return call[0] as Updater<T>;
}

function makeParams(overrides: Partial<AsignacionMutationsParams> = {}): AsignacionMutationsParams {
  return {
    bibliaFecha: BIBLIA,
    fechaHasta: HASTA,
    preparaciones: [],
    preparacionesFiltradas: [],
    asignacionesBiblia: new Map(),
    ocupadasEnOtraBiblia: new Map(),
    asignacionCrossCodeByPrepId: new Map(),
    choferesPorCodigo: new Map(),
    choferesPorCodigoExcepcion: new Map(),
    rawAsignacionesRef: { current: [] as AsignacionRaw[] },
    setRawAsignaciones: vi.fn(),
    setRawPedidoCambios: vi.fn(),
    resetDateRangeOverride: vi.fn(),
    setError: vi.fn(),
    ...overrides,
  };
}

function render(overrides: Partial<AsignacionMutationsParams> = {}) {
  const params = makeParams(overrides);
  const rendered = renderHook((p: AsignacionMutationsParams) => useAsignacionMutations(p), { initialProps: params });
  return { ...rendered, params };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAsignar.mockResolvedValue(undefined);
  mockBatch.mockResolvedValue({ ok: true, count: 1 });
  mockLimpiar.mockResolvedValue({ ok: true, deleted: 1 });
});

describe('asignarPreparacion — fechas', () => {
  it('usa la fecha de la preparación pedida, no la de otra', async () => {
    const { result } = render({
      preparaciones: [
        prep(1, { fecha_hora_estado: '2026-07-18T10:00:00' }),
        prep(2, { fecha_hora_estado: '2026-07-15T08:30:00' }),
      ],
    });
    await act(() => result.current.asignarPreparacion(2, 'CH1'));
    expect(mockAsignar).toHaveBeenCalledWith(2, 'CH1', BIBLIA, '2026-07-15');
  });

  it('clampa a fechaHasta solo cuando la fecha la supera', async () => {
    const { result } = render({
      preparaciones: [
        prep(1, { fecha_hora_estado: '2026-07-25T10:00:00' }),
        prep(2, { fecha_hora_estado: '2026-07-15T08:30:00' }),
      ],
    });
    await act(() => result.current.asignarPreparacion(1, 'CH1'));
    expect(mockAsignar).toHaveBeenLastCalledWith(1, 'CH1', BIBLIA, HASTA);
    await act(() => result.current.asignarPreparacion(2, 'CH1'));
    expect(mockAsignar).toHaveBeenLastCalledWith(2, 'CH1', BIBLIA, '2026-07-15');
  });

  it('una prep inexistente usa el día hábil previo sin explotar', async () => {
    const { result } = render({ preparaciones: [] });
    await act(() => result.current.asignarPreparacion(99, 'CH1'));
    expect(mockAsignar).toHaveBeenCalledWith(99, 'CH1', BIBLIA, PREV_BD);
  });

  it('el updater reemplaza solo la fila de esa prep con los campos exactos', async () => {
    const { result, params } = render({ preparaciones: [prep(2, { fecha_hora_estado: '2026-07-15T08:30:00' })] });
    await act(() => result.current.asignarPreparacion(2, 'CH1'));
    const updater = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>);
    const prev: AsignacionRaw[] = [
      { preparacion_id: 2, chofer_codigo: 'VIEJO', biblia_fecha: BIBLIA, preparacion_fecha: '2026-07-10' },
      { preparacion_id: 3, chofer_codigo: 'CH3', biblia_fecha: BIBLIA, preparacion_fecha: '2026-07-11' },
    ];
    const next = updater(prev);
    expect(next).toHaveLength(2);
    expect(next.find(a => a.preparacion_id === 3)).toEqual(prev[1]);
    expect(next.find(a => a.preparacion_id === 2)).toEqual({
      preparacion_id: 2,
      chofer_codigo: 'CH1',
      biblia_fecha: BIBLIA,
      preparacion_fecha: '2026-07-15',
      sigma_sync_estado: 'no_aplica',
    });
  });

  it('si la API falla restaura exactamente el snapshot previo', async () => {
    mockAsignar.mockRejectedValueOnce(new Error('boom'));
    const prevReal: AsignacionRaw[] = [{ preparacion_id: 7, chofer_codigo: 'X', biblia_fecha: BIBLIA, preparacion_fecha: HASTA }];
    const setRawAsignaciones = vi.fn((arg: unknown) => {
      if (typeof arg === 'function') (arg as Updater<AsignacionRaw>)(prevReal);
    });
    const { result, params } = render({ setRawAsignaciones: setRawAsignaciones as AsignacionMutationsParams['setRawAsignaciones'] });
    await act(() => result.current.asignarPreparacion(1, 'CH1'));
    expect(setRawAsignaciones).toHaveBeenCalledTimes(2);
    expect(setRawAsignaciones.mock.calls[1][0]).toBe(prevReal);
    expect(params.setError).toHaveBeenCalledWith('boom');
  });

  it('si la API falla pero el updater nunca corrió, no hay rollback espurio', async () => {
    mockAsignar.mockRejectedValueOnce(new Error('boom'));
    const setRawAsignaciones = vi.fn(); // nunca ejecuta el updater → snapshot queda null
    const { result } = render({ setRawAsignaciones });
    await act(() => result.current.asignarPreparacion(1, 'CH1'));
    expect(setRawAsignaciones).toHaveBeenCalledTimes(1);
  });
});

describe('reasignarPreparacion — cross-code', () => {
  const codigoBIG = { id: 150, nombre: 'BIG', desactivado: 0, direccion: '' } as Parameters<ReturnType<typeof useAsignacionMutations>['reasignarPreparacion']>[2];
  const codigoSUR = { id: 200, nombre: 'SUR', desactivado: 0, direccion: '' } as typeof codigoBIG;

  it('al mismo código no es cross: no_aplica, sin destino y sin tocar cambios individuales', async () => {
    const p = prep(1, { pedidos: [pedido('BIG')], fecha_hora_estado: '2026-07-15T08:00:00' });
    const { result, params } = render();
    await act(() => result.current.reasignarPreparacion(p, 'CH1', codigoBIG));
    expect(mockAsignar).toHaveBeenCalledWith(1, 'CH1', BIBLIA, '2026-07-15', null, null);
    expect(params.setRawPedidoCambios).not.toHaveBeenCalled();
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)([]);
    expect(next[0].sigma_sync_estado).toBe('no_aplica');
    expect(next[0].codigo_despacho_destino).toBeNull();
  });

  it('los pedidos sin código no cuentan para decidir el código actual', async () => {
    const p = prep(1, { pedidos: [pedido('BIG'), pedido(null)], fecha_hora_estado: '2026-07-15T08:00:00' });
    const { result, params } = render();
    await act(() => result.current.reasignarPreparacion(p, 'CH1', codigoBIG));
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)([]);
    expect(next[0].sigma_sync_estado).toBe('no_aplica'); // sigue siendo el mismo código
  });

  it('una prep multi-código siempre es cross', async () => {
    const p = prep(1, { pedidos: [pedido('BIG'), pedido('SUR')], fecha_hora_estado: '2026-07-15T08:00:00' });
    const { result, params } = render();
    await act(() => result.current.reasignarPreparacion(p, 'CH1', codigoBIG));
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)([]);
    expect(next[0].sigma_sync_estado).toBe('pendiente');
    expect(next[0].codigo_despacho_destino).toBe('150');
  });

  it('cross descarta los cambios individuales solo de esa prep', async () => {
    const p = prep(1, { pedidos: [pedido('BIG')], fecha_hora_estado: '2026-07-15T08:00:00', reasignable: true });
    const { result, params } = render();
    await act(() => result.current.reasignarPreparacion(p, 'CH1', codigoSUR));
    const updater = lastUpdater<PedidoCambioEstado>(params.setRawPedidoCambios as ReturnType<typeof vi.fn>);
    const cambios = [
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'X', estado: 'pendiente' },
      { pedido_codigo: 'P2', preparacion_id: 9, nuevo_codigo_despacho: 'Y', estado: 'pendiente' },
    ] as PedidoCambioEstado[];
    expect(updater(cambios)).toEqual([cambios[1]]);
  });

  it('un cross-code ya impactado (ok) no se conserva como pendiente al volver al mismo destino', async () => {
    const p = prep(1, { pedidos: [pedido('BIG')], fecha_hora_estado: '2026-07-15T08:00:00' });
    const crossOk = new Map([[1, { destino_nombre: 'SUR', destino_id: '99', sigma_sync_estado: 'ok' as SigmaSyncEstado }]]);
    const { result, params } = render({ asignacionCrossCodeByPrepId: crossOk });
    // Reasignar a SUR = código efectivo en Sigma → no es cross y el estado ok no se pisa con pendiente
    await act(() => result.current.reasignarPreparacion(p, 'CH1', codigoSUR));
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)([]);
    expect(next[0].sigma_sync_estado).toBe('no_aplica');
    expect(next[0].codigo_despacho_destino).toBeNull();
  });

  it('cross con prep no reasignable queda bloqueado aunque haya un pendiente previo', async () => {
    const p = prep(1, { pedidos: [pedido('BIG')], fecha_hora_estado: '2026-07-15T08:00:00', reasignable: false });
    const crossPend = new Map([[1, { destino_nombre: 'SUR', destino_id: '200', sigma_sync_estado: 'pendiente' as SigmaSyncEstado }]]);
    const { result, params } = render({ asignacionCrossCodeByPrepId: crossPend });
    // Reasignar a un TERCER código: es cross y la prep no es reasignable → bloqueado
    const codigoOtro = { ...codigoSUR, id: 300, nombre: 'OTRO' } as typeof codigoSUR;
    await act(() => result.current.reasignarPreparacion(p, 'CH1', codigoOtro));
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)([]);
    expect(next[0].sigma_sync_estado).toBe('bloqueado');
    expect(mockAsignar).toHaveBeenCalledWith(1, 'CH1', BIBLIA, '2026-07-15', '300', 'bloqueado');
  });

  it('clampa la fecha a fechaHasta solo cuando la supera', async () => {
    const { result } = render();
    await act(() => result.current.reasignarPreparacion(
      prep(1, { pedidos: [pedido('BIG')], fecha_hora_estado: '2026-07-25T10:00:00' }), 'CH1', codigoBIG));
    expect(mockAsignar).toHaveBeenLastCalledWith(1, 'CH1', BIBLIA, HASTA, null, null);
    await act(() => result.current.reasignarPreparacion(
      prep(2, { pedidos: [pedido('BIG')], fecha_hora_estado: '2026-07-14T10:00:00' }), 'CH1', codigoBIG));
    expect(mockAsignar).toHaveBeenLastCalledWith(2, 'CH1', BIBLIA, '2026-07-14', null, null);
  });

  it('sin fecha_hora_estado usa el día hábil previo', async () => {
    const { result } = render();
    await act(() => result.current.reasignarPreparacion(prep(1, { pedidos: [pedido('BIG')] }), 'CH1', codigoBIG));
    expect(mockAsignar).toHaveBeenCalledWith(1, 'CH1', BIBLIA, PREV_BD, null, null);
  });
});

describe('desasignarPreparacion', () => {
  it('preserva el estado de Sigma ok: limpia el chofer sin tocar el resto ni otras filas', async () => {
    const refRow: AsignacionRaw = {
      preparacion_id: 5, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: '2026-07-15',
      sigma_sync_estado: 'ok', codigo_despacho_destino: '150',
    };
    const { result, params } = render({ rawAsignacionesRef: { current: [refRow] } });
    await act(() => result.current.desasignarPreparacion(5));
    expect(mockAsignar).toHaveBeenCalledWith(5, '', BIBLIA, expect.any(String), '150', 'ok');
    const otra: AsignacionRaw = { preparacion_id: 6, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: '2026-07-15' };
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)([refRow, otra]);
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual({ ...refRow, chofer_codigo: '' });
    expect(next[1]).toEqual(otra); // la otra fila no se toca
  });

  it('un estado ok de OTRA biblia no se preserva', async () => {
    const refRow: AsignacionRaw = {
      preparacion_id: 5, chofer_codigo: 'CH1', biblia_fecha: '2026-01-01', preparacion_fecha: '2025-12-30',
      sigma_sync_estado: 'ok', codigo_despacho_destino: '150',
    };
    const { result, params } = render({ rawAsignacionesRef: { current: [refRow] } });
    await act(() => result.current.desasignarPreparacion(5));
    expect(mockAsignar).toHaveBeenCalledWith(5, '', BIBLIA, expect.any(String), null, null);
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)([refRow]);
    // Camino de reemplazo: fila nueva sin estado de Sigma
    const fila = next.find(a => a.biblia_fecha === BIBLIA);
    expect(fila).toEqual({ preparacion_id: 5, chofer_codigo: '', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD });
  });

  it('un pendiente sin destino no se preserva', async () => {
    const refRow: AsignacionRaw = {
      preparacion_id: 5, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: '2026-07-15',
      sigma_sync_estado: 'pendiente', codigo_despacho_destino: null,
    };
    const { result } = render({ rawAsignacionesRef: { current: [refRow] } });
    await act(() => result.current.desasignarPreparacion(5));
    expect(mockAsignar).toHaveBeenCalledWith(5, '', BIBLIA, expect.any(String), null, null);
  });

  it('sin fila previa, el updater agrega la fila de desasignación', async () => {
    const { result, params } = render();
    await act(() => result.current.desasignarPreparacion(5));
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)([]);
    expect(next).toEqual([{ preparacion_id: 5, chofer_codigo: '', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD }]);
  });

  it('usa la fecha de la prep correcta, con clamp y slice', async () => {
    const { result } = render({
      preparaciones: [
        prep(1, { fecha_hora_estado: '2026-07-25T10:00:00' }),
        prep(2, { fecha_hora_estado: '2026-07-14T10:00:00' }),
      ],
    });
    await act(() => result.current.desasignarPreparacion(1));
    expect(mockAsignar).toHaveBeenLastCalledWith(1, '', BIBLIA, HASTA, null, null);
    await act(() => result.current.desasignarPreparacion(2));
    expect(mockAsignar).toHaveBeenLastCalledWith(2, '', BIBLIA, '2026-07-14', null, null);
  });
});

describe('autoAsignarPendientes', () => {
  const filtradas = [
    prep(1, { pedidos: [pedido('BIG')], fecha_hora_estado: '2026-07-25T10:00:00' }), // clamp
    prep(2, { pedidos: [pedido('BIG'), pedido(null)], fecha_hora_estado: '2026-07-14T10:00:00' }), // null no cuenta
  ];
  const choferesPorCodigo = new Map([['BIG', ['CH1']]]);

  it('asigna candidatas con las fechas correctas (clamp y slice) e ignora pedidos sin código', async () => {
    const { result } = render({ preparacionesFiltradas: filtradas, choferesPorCodigo });
    let count = 0;
    await act(async () => { count = await result.current.autoAsignarPendientes(); });
    expect(count).toBe(2);
    expect(mockBatch).toHaveBeenCalledWith([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: HASTA },
      { preparacion_id: 2, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: '2026-07-14' },
    ]);
  });

  it('el updater reemplaza filas previas de las mismas preps sin duplicar', async () => {
    const { result, params } = render({ preparacionesFiltradas: filtradas, choferesPorCodigo });
    await act(async () => { await result.current.autoAsignarPendientes(); });
    const prev: AsignacionRaw[] = [
      { preparacion_id: 1, chofer_codigo: '', biblia_fecha: BIBLIA, preparacion_fecha: '2026-07-10' },
      { preparacion_id: 8, chofer_codigo: 'CH8', biblia_fecha: BIBLIA, preparacion_fecha: '2026-07-10' },
    ];
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)(prev);
    expect(next).toHaveLength(3); // 8 intacta + las 2 nuevas; la vieja de la prep 1 reemplazada
    expect(next.filter(a => a.preparacion_id === 1)).toHaveLength(1);
    expect(next.find(a => a.preparacion_id === 8)).toEqual(prev[1]);
  });

  it('usa la lista de preparaciones vigente tras un re-render', async () => {
    const { result, rerender, params } = render({ preparacionesFiltradas: [], choferesPorCodigo });
    let count = -1;
    await act(async () => { count = await result.current.autoAsignarPendientes(); });
    expect(count).toBe(0);
    rerender({ ...params, preparacionesFiltradas: filtradas, choferesPorCodigo });
    await act(async () => { count = await result.current.autoAsignarPendientes(); });
    expect(count).toBe(2);
  });
});

describe('limpiarBiblia', () => {
  it('conserva solo lo impactado (ok) sin chofer, descarta el resto de esta biblia', async () => {
    const { result, params } = render();
    await act(() => result.current.limpiarBiblia());
    expect(mockLimpiar).toHaveBeenCalledWith(BIBLIA);
    const prev: AsignacionRaw[] = [
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: HASTA, sigma_sync_estado: 'ok', codigo_despacho_destino: '150' },
      { preparacion_id: 2, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: HASTA, sigma_sync_estado: 'pendiente', codigo_despacho_destino: '150' },
      { preparacion_id: 3, chofer_codigo: 'CH3', biblia_fecha: '2026-01-01', preparacion_fecha: '2025-12-30' },
    ];
    const next = lastUpdater<AsignacionRaw>(params.setRawAsignaciones as ReturnType<typeof vi.fn>)(prev);
    expect(next).toEqual([
      { ...prev[0], chofer_codigo: '' },
      prev[2], // otra biblia intacta
    ]);
    const cambios = [
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'X', estado: 'ok' },
      { pedido_codigo: 'P2', preparacion_id: 2, nuevo_codigo_despacho: 'Y', estado: 'pendiente' },
    ] as PedidoCambioEstado[];
    expect(lastUpdater<PedidoCambioEstado>(params.setRawPedidoCambios as ReturnType<typeof vi.fn>)(cambios)).toEqual([cambios[0]]);
    expect(params.resetDateRangeOverride).toHaveBeenCalled();
  });

  it('si la API falla no toca nada y reporta el error', async () => {
    mockLimpiar.mockRejectedValueOnce(new Error('sin permisos'));
    const { result, params } = render();
    await act(() => result.current.limpiarBiblia());
    expect(params.setRawAsignaciones).not.toHaveBeenCalled();
    expect(params.setRawPedidoCambios).not.toHaveBeenCalled();
    expect(params.resetDateRangeOverride).not.toHaveBeenCalled();
    expect(params.setError).toHaveBeenCalledWith('sin permisos');
  });
});
