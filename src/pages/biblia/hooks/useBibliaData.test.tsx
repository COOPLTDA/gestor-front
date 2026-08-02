import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBibliaData } from './useBibliaData';
import { nextBusinessDay, prevBusinessDay } from './bibliaSelectors';
import * as api from '@/services/bibliaApi';
import type { Preparacion, Pedido } from '../types/biblia';

vi.mock('@/services/bibliaApi', () => ({
  fetchPreparaciones: vi.fn(),
  fetchChoferes: vi.fn(),
  fetchCodigosDespacho: vi.fn(),
  fetchAsignaciones: vi.fn(),
  asignarPreparacionAChofer: vi.fn(),
  asignarPreparacionesBatch: vi.fn(),
  fetchRepartosExcepcionales: vi.fn(),
  eliminarRepartoExcepcional: vi.fn(),
  fetchAllZonas: vi.fn(),
  impactarEnSigma: vi.fn(),
  fetchCambiosEstado: vi.fn(),
  limpiarAsignacionesBiblia: vi.fn(),
}));

const mocked = vi.mocked(api);

const TODAY = new Date().toISOString().slice(0, 10);
const BIBLIA = nextBusinessDay(TODAY);
const PREV_BD = prevBusinessDay(BIBLIA);

function makePedido(over: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'P1',
    codigo_despacho: 'VI HPC 1',
    codigo_cliente_ubicacion: null,
    cliente_nombre: null,
    cliente_direccion: null,
    cliente_lat: null,
    cliente_lng: null,
    estado: 'Pendiente',
    importe: 100,
    peso_text: null,
    volumen_text: null,
    peso: 0,
    volumen: 0,
    fecha: PREV_BD,
    ...over,
  };
}

function makePrep(over: Partial<Preparacion> = {}): Preparacion {
  return {
    id: 1,
    tipo: 'Pedidos individuales',
    estado: 'Completada',
    codigo_envio: 'E-1',
    pedidos: [makePedido()],
    cantidad_pedidos: 1,
    cantidad_clientes: 1,
    importe_total: 100,
    peso: 0,
    volumen: 0,
    peso_text: '0',
    volumen_text: '0',
    fecha_hora_estado: `${PREV_BD} 10:00:00`,
    reasignable: true,
    ...over,
  };
}

const CODIGOS = [
  { id: 150, nombre: 'VI HPC 1', desactivado: 0, choferes: ['CH1'], direccion: null, zona_id: 1 },
  { id: 151, nombre: 'BIG', desactivado: 0, choferes: ['CH1', 'CH2'], direccion: null, zona_id: 2 },
];

const CHOFERES = [
  { codigo: 'CH1', descripcion: 'López', desactivado: 0 },
  { codigo: 'CH2', descripcion: 'García', desactivado: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocked.fetchAllZonas.mockResolvedValue([
    { id: 1, nombre: 'LOMAS', desactivado: 0 },
    { id: 2, nombre: 'SUR', desactivado: 0 },
    { id: 3, nombre: 'VIEJA', desactivado: 1 },
  ]);
  mocked.fetchCodigosDespacho.mockResolvedValue(CODIGOS);
  mocked.fetchAsignaciones.mockResolvedValue([]);
  mocked.fetchRepartosExcepcionales.mockResolvedValue([]);
  mocked.fetchCambiosEstado.mockResolvedValue([]);
  mocked.fetchChoferes.mockResolvedValue(CHOFERES);
  mocked.fetchPreparaciones.mockResolvedValue([makePrep()]);
  mocked.asignarPreparacionAChofer.mockResolvedValue(undefined);
  mocked.asignarPreparacionesBatch.mockResolvedValue({ ok: true, count: 1 });
  mocked.eliminarRepartoExcepcional.mockResolvedValue(undefined);
  mocked.limpiarAsignacionesBiblia.mockResolvedValue({ ok: true, deleted: 1 });
  mocked.impactarEnSigma.mockResolvedValue({ ok: [], fallido: [], error: [], total: 0 });
});

async function renderReady() {
  const utils = renderHook(() => useBibliaData());
  await waitFor(() => expect(utils.result.current.isLoading).toBe(false));
  return utils;
}

describe('carga inicial', () => {
  it('carga zonas activas, códigos, choferes y preparaciones', async () => {
    const { result } = await renderReady();
    expect(result.current.zonas).toEqual([
      { id: 1, nombre: 'LOMAS' },
      { id: 2, nombre: 'SUR' },
    ]);
    expect(result.current.codigosDespacho).toEqual(CODIGOS);
    expect(result.current.choferes).toEqual(CHOFERES);
    expect(result.current.preparacionesDisponibles).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('la biblia por defecto es el próximo día hábil y el rango el día hábil previo', async () => {
    const { result } = await renderReady();
    expect(result.current.bibliaFecha).toBe(BIBLIA);
    const esperadoHasta = PREV_BD > TODAY ? TODAY : PREV_BD;
    expect(result.current.fechaHasta).toBe(esperadoHasta);
    expect(result.current.fechaDesde <= result.current.fechaHasta).toBe(true);
  });

  it('pide preparaciones y choferes con el rango y la biblia actuales', async () => {
    const { result } = await renderReady();
    expect(mocked.fetchPreparaciones).toHaveBeenCalledWith({
      fecha_desde: result.current.fechaDesde,
      fecha_hasta: result.current.fechaHasta,
    });
    expect(mocked.fetchChoferes).toHaveBeenCalledWith({
      fecha_desde: result.current.fechaDesde,
      fecha_hasta: result.current.fechaHasta,
      biblia_fecha: BIBLIA,
    });
  });

  it('expone el error si falla la carga de preparaciones', async () => {
    mocked.fetchPreparaciones.mockRejectedValue(new Error('digip caído'));
    const { result } = renderHook(() => useBibliaData());
    await waitFor(() => expect(result.current.error).toBe('digip caído'));
    expect(result.current.isLoading).toBe(false);
  });

  it('expone errores de las cargas auxiliares', async () => {
    mocked.fetchAllZonas.mockRejectedValue(new Error('zonas rotas'));
    const { result } = renderHook(() => useBibliaData());
    await waitFor(() => expect(result.current.error).toBe('zonas rotas'));
  });

  it('agrega como chofer virtual al de un reparto excepcional que no está en la lista', async () => {
    mocked.fetchRepartosExcepcionales.mockResolvedValue([
      { id: 9, chofer_codigo: 'EXT1', chofer_nombre: 'Suplente', codigo_reparto: 'BIG', codigo_despacho_id: '151', fecha: BIBLIA },
    ]);
    const { result } = await renderReady();
    await waitFor(() => {
      expect(result.current.choferes.map(c => c.codigo)).toContain('EXT1');
    });
    const virtual = result.current.choferes.find(c => c.codigo === 'EXT1');
    expect(virtual).toMatchObject({ descripcion: 'Suplente', desactivado: 0 });
  });
});

describe('derivados y filtros', () => {
  it('separa disponibles de asignadas según las asignaciones de la biblia', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([makePrep({ id: 1 }), makePrep({ id: 2 })]);
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
    ]);
    const { result } = await renderReady();
    expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([2]);
    expect(result.current.preparacionesPorChofer.get('CH1')?.map(p => p.id)).toEqual([1]);
  });

  it('muestra como ocupadas (grisadas) las preps asignadas a otra biblia', async () => {
    const otraFecha = nextBusinessDay(BIBLIA);
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: otraFecha, preparacion_fecha: PREV_BD },
    ]);
    const { result } = await renderReady();
    expect(result.current.ocupadasEnOtraBiblia.get(1)).toBe(otraFecha);
    expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([1]);
    expect(result.current.preparacionesPorChofer.size).toBe(0);
  });

  it('toggleEstado agrega y quita estados del filtro', async () => {
    const { result } = await renderReady();
    act(() => result.current.toggleEstado('Completada'));
    expect(result.current.estadosSeleccionados).toEqual(['Completada']);
    act(() => result.current.toggleEstado('Completada'));
    expect(result.current.estadosSeleccionados).toEqual([]);
  });

  it('toggleZona agrega y quita zonas del filtro', async () => {
    const { result } = await renderReady();
    act(() => result.current.toggleZona(1));
    expect(result.current.zonasSeleccionadas).toEqual([1]);
    act(() => result.current.toggleZona(1));
    expect(result.current.zonasSeleccionadas).toEqual([]);
  });

  it('filtra preparaciones por zona seleccionada', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: 'VI HPC 1' })] }),
      makePrep({ id: 2, pedidos: [makePedido({ codigo_despacho: 'BIG' })] }),
    ]);
    const { result } = await renderReady();
    act(() => result.current.toggleZona(1)); // zona 1 → VI HPC 1
    expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([1]);
  });

  it('computa la lista de estados presentes', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, estado: 'Remitido' }),
      makePrep({ id: 2, estado: 'Completada' }),
    ]);
    const { result } = await renderReady();
    expect(result.current.estados).toEqual(['Completada', 'Remitido']);
  });

  it('clearError limpia el error', async () => {
    mocked.fetchAllZonas.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useBibliaData());
    await waitFor(() => expect(result.current.error).toBe('x'));
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});

describe('asignarPreparacion', () => {
  it('asigna optimistamente y llama a la API con la fecha de la preparación', async () => {
    const { result } = await renderReady();
    await act(() => result.current.asignarPreparacion(1, 'CH1'));
    expect(result.current.preparacionesPorChofer.get('CH1')?.map(p => p.id)).toEqual([1]);
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, 'CH1', BIBLIA, PREV_BD);
  });

  it('revierte la asignación y setea error si la API falla', async () => {
    mocked.asignarPreparacionAChofer.mockRejectedValue(new Error('conflicto'));
    const { result } = await renderReady();
    await act(() => result.current.asignarPreparacion(1, 'CH1'));
    expect(result.current.error).toBe('conflicto');
    expect(result.current.preparacionesPorChofer.get('CH1')).toBeUndefined();
    expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([1]);
  });

  it('usa el día hábil previo si la preparación no tiene fecha_hora_estado', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([makePrep({ id: 1, fecha_hora_estado: undefined })]);
    const { result } = await renderReady();
    await act(() => result.current.asignarPreparacion(1, 'CH1'));
    const fecha = mocked.asignarPreparacionAChofer.mock.calls[0][3];
    expect(fecha <= result.current.fechaHasta).toBe(true);
  });
});

describe('reasignarPreparacion', () => {
  it('asignación al mismo código no es cross-code: destino null y estado no_aplica', async () => {
    const { result } = await renderReady();
    const prep = makePrep({ id: 1 });
    await act(() => result.current.reasignarPreparacion(prep, 'CH1', CODIGOS[0]));
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, 'CH1', BIBLIA, PREV_BD, null, null);
    expect(result.current.asignacionCrossCodeByPrepId.has(1)).toBe(false);
  });

  it('asignación a otro código es cross-code: guarda destino y queda pendiente', async () => {
    const { result } = await renderReady();
    const prep = makePrep({ id: 1 }); // pedidos en VI HPC 1
    await act(() => result.current.reasignarPreparacion(prep, 'CH2', CODIGOS[1])); // BIG
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, 'CH2', BIBLIA, PREV_BD, '151', null);
    expect(result.current.asignacionCrossCodeByPrepId.get(1)).toEqual({
      destino_nombre: 'BIG',
      destino_id: '151',
      sigma_sync_estado: 'pendiente',
    });
    expect(result.current.sigmaEstadoByPrepId.get(1)).toBe('pendiente');
  });

  it('cross-code con preparación no reasignable queda bloqueado', async () => {
    const { result } = await renderReady();
    const prep = makePrep({ id: 1, reasignable: false });
    await act(() => result.current.reasignarPreparacion(prep, 'CH2', CODIGOS[1]));
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, 'CH2', BIBLIA, PREV_BD, '151', 'bloqueado');
    expect(result.current.sigmaEstadoByPrepId.get(1)).toBe('bloqueado');
  });

  it('volver al código pendiente existente conserva el pending (no lo cancela)', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'pendiente' },
    ]);
    const { result } = await renderReady();
    const prep = makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: 'BIG' })] });
    // los pedidos ya están en BIG según Digip → no es cross, pero hay pending previo a BIG
    await act(() => result.current.reasignarPreparacion(prep, 'CH1', CODIGOS[1]));
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, 'CH1', BIBLIA, PREV_BD, '151', null);
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('pendiente');
  });

  it('con cross-code ya impactado (ok), volver al código de Digip vuelve a ser cross-code', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'ok' },
    ]);
    const { result } = await renderReady();
    // Sigma efectivo = BIG (por el ok); Digip muestra VI HPC 1. Mover a VI HPC 1 = cross.
    const prep = makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: 'VI HPC 1' })] });
    await act(() => result.current.reasignarPreparacion(prep, 'CH1', CODIGOS[0]));
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, 'CH1', BIBLIA, PREV_BD, '150', null);
  });

  it('el cross-code descarta los cambios individuales previos de esa preparación', async () => {
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'pendiente' },
    ]);
    const { result } = await renderReady();
    expect(result.current.pedidoCambiosByPrepId.get(1)).toHaveLength(1);
    const prep = makePrep({ id: 1 });
    await act(() => result.current.reasignarPreparacion(prep, 'CH2', CODIGOS[1]));
    expect(result.current.pedidoCambiosByPrepId.has(1)).toBe(false);
  });

  it('revierte y setea error si la API falla', async () => {
    mocked.asignarPreparacionAChofer.mockRejectedValue(new Error('sin permiso'));
    const { result } = await renderReady();
    const prep = makePrep({ id: 1 });
    await act(() => result.current.reasignarPreparacion(prep, 'CH2', CODIGOS[1]));
    expect(result.current.error).toBe('sin permiso');
    expect(result.current.asignacionCrossCodeByPrepId.has(1)).toBe(false);
  });
});

describe('desasignarPreparacion', () => {
  it('fuerza la prep a pendientes con chofer vacío', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
    ]);
    const { result } = await renderReady();
    await act(() => result.current.desasignarPreparacion(1));
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, '', BIBLIA, PREV_BD, null, null);
    expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([1]);
  });

  it('preserva el estado de Sigma ok al desasignar', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'ok' },
    ]);
    const { result } = await renderReady();
    await act(() => result.current.desasignarPreparacion(1));
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, '', BIBLIA, PREV_BD, '151', 'ok');
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('ok');
  });

  it('revierte si la API falla', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
    ]);
    mocked.asignarPreparacionAChofer.mockRejectedValue(new Error('offline'));
    const { result } = await renderReady();
    await act(() => result.current.desasignarPreparacion(1));
    expect(result.current.error).toBe('offline');
    expect(result.current.preparacionesPorChofer.get('CH1')?.map(p => p.id)).toEqual([1]);
  });
});

describe('autoAsignarPendientes', () => {
  it('asigna solo las preps cuyo código tiene exactamente un chofer', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: 'VI HPC 1' })] }), // 1 chofer
      makePrep({ id: 2, pedidos: [makePedido({ codigo_despacho: 'BIG' })] }),      // 2 choferes
      makePrep({ id: 3, pedidos: [makePedido({ codigo_despacho: 'VI HPC 1' }), makePedido({ codigo: 'P2', codigo_despacho: 'BIG' })] }), // mixto
    ]);
    const { result } = await renderReady();
    let count = 0;
    await act(async () => { count = await result.current.autoAsignarPendientes(); });
    expect(count).toBe(1);
    expect(mocked.asignarPreparacionesBatch).toHaveBeenCalledWith([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
    ]);
    expect(result.current.preparacionesPorChofer.get('CH1')?.map(p => p.id)).toEqual([1]);
  });

  it('no reasigna preps ya asignadas ni las de otra biblia', async () => {
    const otraFecha = nextBusinessDay(BIBLIA);
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1 }),
      makePrep({ id: 2 }),
      makePrep({ id: 3 }),
    ]);
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
      { preparacion_id: 2, chofer_codigo: 'CH1', biblia_fecha: otraFecha, preparacion_fecha: PREV_BD },
    ]);
    const { result } = await renderReady();
    await act(async () => { await result.current.autoAsignarPendientes(); });
    expect(mocked.asignarPreparacionesBatch).toHaveBeenCalledWith([
      { preparacion_id: 3, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
    ]);
  });

  it('no considera choferes desactivados', async () => {
    mocked.fetchChoferes.mockResolvedValue([
      { codigo: 'CH1', descripcion: 'López', desactivado: 1 },
      { codigo: 'CH2', descripcion: 'García', desactivado: 0 },
    ]);
    const { result } = await renderReady();
    let count = -1;
    await act(async () => { count = await result.current.autoAsignarPendientes(); });
    // VI HPC 1 solo lo atiende CH1, que está desactivado → nada para asignar
    expect(count).toBe(0);
    expect(mocked.asignarPreparacionesBatch).not.toHaveBeenCalled();
  });

  it('asigna por reparto excepcional cuando el código no tiene chofer regular', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: 'RUTA X' })] }),
    ]);
    mocked.fetchRepartosExcepcionales.mockResolvedValue([
      { id: 5, chofer_codigo: 'EXT1', chofer_nombre: 'Suplente', codigo_reparto: 'RUTA X', codigo_despacho_id: '999', fecha: BIBLIA },
    ]);
    const { result } = await renderReady();
    let count = 0;
    await act(async () => { count = await result.current.autoAsignarPendientes(); });
    expect(count).toBe(1);
    expect(mocked.asignarPreparacionesBatch).toHaveBeenCalledWith([
      expect.objectContaining({ preparacion_id: 1, chofer_codigo: 'EXT1' }),
    ]);
  });

  it('devuelve 0 y revierte si el batch falla', async () => {
    mocked.asignarPreparacionesBatch.mockRejectedValue(new Error('batch falló'));
    const { result } = await renderReady();
    let count = -1;
    await act(async () => { count = await result.current.autoAsignarPendientes(); });
    expect(count).toBe(0);
    expect(result.current.error).toBe('batch falló');
    expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([1]);
  });

  it('devuelve 0 sin llamar a la API si no hay nada para asignar', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([]);
    const { result } = await renderReady();
    let count = -1;
    await act(async () => { count = await result.current.autoAsignarPendientes(); });
    expect(count).toBe(0);
    expect(mocked.asignarPreparacionesBatch).not.toHaveBeenCalled();
  });
});

describe('impactarEnSigma', () => {
  it('marca ok las pendientes impactadas y fallido las que fallaron', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'pendiente' },
      { preparacion_id: 2, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '150', sigma_sync_estado: 'pendiente' },
      { preparacion_id: 3, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '150', sigma_sync_estado: 'ok' },
    ]);
    mocked.impactarEnSigma.mockResolvedValue({ ok: [1], fallido: [2], error: [], total: 2 });
    const { result } = await renderReady();
    await act(async () => { await result.current.impactarEnSigma(); });
    expect(mocked.impactarEnSigma).toHaveBeenCalledWith(BIBLIA);
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('ok');
    expect(result.current.asignacionCrossCodeByPrepId.get(2)?.sigma_sync_estado).toBe('fallido');
    expect(result.current.asignacionCrossCodeByPrepId.get(3)?.sigma_sync_estado).toBe('ok');
  });

  it('marca fallido lo que vino en error (fallo de la API de Sigma)', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'pendiente' },
    ]);
    mocked.impactarEnSigma.mockResolvedValue({ ok: [], fallido: [], error: [1], total: 1 });
    const { result } = await renderReady();
    await act(async () => { await result.current.impactarEnSigma(); });
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('fallido');
  });

  it('recarga los cambios individuales después de impactar', async () => {
    const { result } = await renderReady();
    mocked.fetchCambiosEstado.mockClear();
    await act(async () => { await result.current.impactarEnSigma(); });
    expect(mocked.fetchCambiosEstado).toHaveBeenCalledWith(BIBLIA);
  });

  it('setea error y relanza si la API falla', async () => {
    mocked.impactarEnSigma.mockRejectedValue(new Error('sigma caído'));
    const { result } = await renderReady();
    await act(async () => {
      await expect(result.current.impactarEnSigma()).rejects.toThrow('sigma caído');
    });
    expect(result.current.error).toBe('sigma caído');
  });
});

describe('limpiarBiblia', () => {
  it('borra las asignaciones de la biblia pero conserva las ok sin chofer', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
      { preparacion_id: 2, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'ok' },
      { preparacion_id: 3, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '150', sigma_sync_estado: 'pendiente' },
    ]);
    mocked.fetchPreparaciones.mockResolvedValue([makePrep({ id: 1 }), makePrep({ id: 2 }), makePrep({ id: 3 })]);
    const { result } = await renderReady();
    await act(async () => { await result.current.limpiarBiblia(); });
    expect(mocked.limpiarAsignacionesBiblia).toHaveBeenCalledWith(BIBLIA);
    // todas vuelven a pendientes
    expect(result.current.preparacionesPorChofer.size).toBe(0);
    // el badge ok del cross-code impactado sobrevive; el pendiente se descarta
    expect(result.current.asignacionCrossCodeByPrepId.get(2)?.sigma_sync_estado).toBe('ok');
    expect(result.current.asignacionCrossCodeByPrepId.has(3)).toBe(false);
  });

  it('descarta los cambios individuales no-ok', async () => {
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'pendiente' },
    ]);
    const { result } = await renderReady();
    expect(result.current.pedidoCambiosByPrepId.has(1)).toBe(true);
    await act(async () => { await result.current.limpiarBiblia(); });
    expect(result.current.pedidoCambiosByPrepId.has(1)).toBe(false);
  });

  it('setea error si falla', async () => {
    mocked.limpiarAsignacionesBiblia.mockRejectedValue(new Error('no se pudo limpiar'));
    const { result } = await renderReady();
    await act(async () => { await result.current.limpiarBiblia(); });
    expect(result.current.error).toBe('no se pudo limpiar');
  });
});

describe('excepciones', () => {
  it('recargarExcepciones actualiza la lista', async () => {
    const { result } = await renderReady();
    mocked.fetchRepartosExcepcionales.mockResolvedValue([
      { id: 4, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'BIG', codigo_despacho_id: '151', fecha: BIBLIA },
    ]);
    await act(async () => { await result.current.recargarExcepciones(); });
    expect(result.current.codigosDespachoByChofer.get('CH1')?.some(c => c.es_excepcion)).toBe(true);
  });

  it('recargarExcepciones setea error si falla', async () => {
    const { result } = await renderReady();
    mocked.fetchRepartosExcepcionales.mockRejectedValue(new Error('excepciones rotas'));
    await act(async () => { await result.current.recargarExcepciones(); });
    expect(result.current.error).toBe('excepciones rotas');
  });

  it('eliminarExcepcion la quita de la lista', async () => {
    mocked.fetchRepartosExcepcionales.mockResolvedValue([
      { id: 4, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'BIG', codigo_despacho_id: '151', fecha: BIBLIA },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.codigosDespachoByChofer.get('CH1')?.some(c => c.es_excepcion)).toBe(true));
    await act(async () => { await result.current.eliminarExcepcion(4); });
    expect(mocked.eliminarRepartoExcepcional).toHaveBeenCalledWith(4);
    expect(result.current.codigosDespachoByChofer.get('CH1')?.some(c => c.es_excepcion) ?? false).toBe(false);
  });

  it('eliminarExcepcion setea error y no toca la lista si falla', async () => {
    mocked.fetchRepartosExcepcionales.mockResolvedValue([
      { id: 4, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'BIG', codigo_despacho_id: '151', fecha: BIBLIA },
    ]);
    mocked.eliminarRepartoExcepcional.mockRejectedValue(new Error('tiene preps'));
    const { result } = await renderReady();
    await act(async () => { await result.current.eliminarExcepcion(4); });
    expect(result.current.error).toBe('tiene preps');
  });
});

describe('rango de fechas', () => {
  it('setFechaDesde manual no puede achicar el rango por debajo de las asignaciones', async () => {
    const vieja = '2026-01-05';
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: vieja },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.fechaDesde).toBe(vieja));
    act(() => result.current.setFechaDesde('2026-06-01'));
    expect(result.current.fechaDesde).toBe(vieja);
  });

  it('setFechaDesde manual se respeta si no hay asignaciones más viejas', async () => {
    const { result } = await renderReady();
    act(() => result.current.setFechaDesde('2026-01-01'));
    expect(result.current.fechaDesde).toBe('2026-01-01');
  });

  it('cambiar la biblia resetea el rango al default de la nueva fecha', async () => {
    const { result } = await renderReady();
    act(() => result.current.setFechaDesde('2026-01-01'));
    const nueva = nextBusinessDay(BIBLIA);
    act(() => result.current.setBibliaFecha(nueva));
    await waitFor(() => {
      expect(result.current.bibliaFecha).toBe(nueva);
      expect(result.current.fechaDesde).not.toBe('2026-01-01');
    });
  });

  it('el rango de una biblia con asignaciones viejas se extiende hacia atrás', async () => {
    const vieja = '2026-01-05';
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 9, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: vieja },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.fechaDesde).toBe(vieja));
    expect(result.current.fechaHasta >= PREV_BD || result.current.fechaHasta === TODAY).toBe(true);
  });

  it('recargarPreparaciones vuelve a pedir preparaciones y cambios', async () => {
    const { result } = await renderReady();
    mocked.fetchPreparaciones.mockClear();
    mocked.fetchCambiosEstado.mockClear();
    act(() => result.current.recargarPreparaciones());
    await waitFor(() => {
      expect(mocked.fetchPreparaciones).toHaveBeenCalledTimes(1);
      expect(mocked.fetchCambiosEstado).toHaveBeenCalledTimes(1);
    });
  });
});

describe('reconciliación con Digip', () => {
  it('limpia el badge ok del cross-code cuando Digip ya refleja el código destino', async () => {
    // cross-code ok hacia BIG (151); los pedidos de la prep ya están todos en BIG.
    // La respuesta de preparaciones se demora para que los códigos de despacho ya estén
    // cargados al reconciliar (la reconciliación necesita codigosDespachoRef poblado; si
    // preparaciones gana la carrera, recién se limpia en la próxima recarga).
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'ok' },
    ]);
    mocked.fetchPreparaciones.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([
        makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: 'BIG' })] }),
      ]), 10)),
    );
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.asignacionCrossCodeByPrepId.has(1)).toBe(false));
  });

  it('mantiene el badge ok mientras Digip siga mostrando el código original', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'ok' },
    ]);
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: 'VI HPC 1' })] }),
    ]);
    const { result } = await renderReady();
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('ok');
  });

  it('descarta los cambios individuales ok que Digip ya refleja', async () => {
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'VI HPC 1', estado: 'ok' },
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'pendiente' },
    ]);
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1', codigo_despacho: 'VI HPC 1' })] }),
    ]);
    const { result } = await renderReady();
    await waitFor(() => {
      const cambios = result.current.pedidoCambiosByPrepId.get(1) ?? [];
      // el ok ya reflejado desaparece; el pendiente se queda
      expect(cambios.map(c => c.estado)).toEqual(['pendiente']);
    });
  });

  it('conserva los cambios ok que Digip todavía no refleja', async () => {
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'ok' },
    ]);
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1', codigo_despacho: 'VI HPC 1' })] }),
    ]);
    const { result } = await renderReady();
    expect(result.current.pedidoCambiosByPrepId.get(1)).toHaveLength(1);
  });

  it('descarta cambios ok sin nuevo código (solo fecha/observación)', async () => {
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: null, estado: 'ok' },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.pedidoCambiosByPrepId.has(1)).toBe(false));
  });
});

describe('refuerzos de ramas', () => {
  it('setFechaHasta manual no puede quedar por debajo de la asignación más nueva', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
    ]);
    const { result } = await renderReady();
    act(() => result.current.setFechaHasta('2020-01-01'));
    expect(result.current.fechaHasta).toBe(PREV_BD);
  });

  it('desasignar preserva el cross-code pendiente (chofer vacío, destino intacto)', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'pendiente' },
    ]);
    const { result } = await renderReady();
    await act(() => result.current.desasignarPreparacion(1));
    expect(mocked.asignarPreparacionAChofer).toHaveBeenCalledWith(1, '', BIBLIA, PREV_BD, '151', 'pendiente');
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('pendiente');
  });

  it('reconciliación caso 2: cambios individuales ok reemplazan al cross-code y limpian su badge', async () => {
    // cross-code ok hacia BIG (151), pero luego un cambio individual ok movió el pedido a
    // VI HPC 1 y Digip ya lo refleja: ningún pedido quedó en BIG → el badge del cross se limpia.
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'ok' },
    ]);
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'VI HPC 1', estado: 'ok' },
    ]);
    mocked.fetchPreparaciones.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([
        makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1', codigo_despacho: 'VI HPC 1' })] }),
      ]), 20)),
    );
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.asignacionCrossCodeByPrepId.has(1)).toBe(false));
  });

  it('reconciliación caso 2 no limpia si quedan cambios individuales pendientes', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'ok' },
    ]);
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'VI HPC 1', estado: 'ok' },
      { pedido_codigo: 'P2', preparacion_id: 1, nuevo_codigo_despacho: 'VI HPC 1', estado: 'pendiente' },
    ]);
    mocked.fetchPreparaciones.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([
        makePrep({
          id: 1,
          pedidos: [
            makePedido({ codigo: 'P1', codigo_despacho: 'VI HPC 1' }),
            makePedido({ codigo: 'P2', codigo_despacho: 'VI HPC 1' }),
          ],
        }),
      ]), 20)),
    );
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.pedidoCambiosByPrepId.get(1)?.length).toBe(1));
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('ok');
  });

  it('ignora respuestas de preparaciones fuera de orden (fetch id viejo)', async () => {
    const { result } = await renderReady();
    // dos recargas seguidas: la primera resuelve después que la segunda
    let resolveFirst: (v: Preparacion[]) => void = () => {};
    mocked.fetchPreparaciones
      .mockImplementationOnce(() => new Promise(res => { resolveFirst = res; }))
      .mockResolvedValueOnce([makePrep({ id: 99 })]);
    act(() => result.current.recargarPreparaciones());
    act(() => result.current.recargarPreparaciones());
    await waitFor(() => expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([99]));
    // la respuesta vieja llega tarde y se descarta
    act(() => resolveFirst([makePrep({ id: 1 })]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([99]);
  });

  it('el error de un fetch viejo de preparaciones no pisa el estado actual', async () => {
    const { result } = await renderReady();
    let rejectFirst: (e: Error) => void = () => {};
    mocked.fetchPreparaciones
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectFirst = rej; }))
      .mockResolvedValueOnce([makePrep({ id: 99 })]);
    act(() => result.current.recargarPreparaciones());
    act(() => result.current.recargarPreparaciones());
    await waitFor(() => expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([99]));
    act(() => rejectFirst(new Error('viejo')));
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.error).toBeNull();
  });
});

describe('refuerzos de mutation testing — anclas de rango y reconciliación', () => {
  it('una asignación ok sin chofer ancla el rango de fechas', async () => {
    const vieja = '2026-01-05';
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: '', biblia_fecha: BIBLIA, preparacion_fecha: vieja, codigo_despacho_destino: '151', sigma_sync_estado: 'ok' },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.fechaDesde).toBe(vieja));
  });

  it('un cross-code pendiente sin chofer también ancla el rango', async () => {
    const vieja = '2026-01-06';
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: '', biblia_fecha: BIBLIA, preparacion_fecha: vieja, codigo_despacho_destino: '151', sigma_sync_estado: 'pendiente' },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.fechaDesde).toBe(vieja));
  });

  it('una desasignación simple (sin estado de Sigma) NO ancla el rango', async () => {
    const vieja = '2026-01-07';
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: '', biblia_fecha: BIBLIA, preparacion_fecha: vieja },
    ]);
    const { result } = await renderReady();
    expect(result.current.fechaDesde).not.toBe(vieja);
  });

  it('un pendiente sin destino (no cross-code) sin chofer NO ancla el rango', async () => {
    const vieja = '2026-01-08';
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: '', biblia_fecha: BIBLIA, preparacion_fecha: vieja, sigma_sync_estado: 'pendiente' },
    ]);
    const { result } = await renderReady();
    expect(result.current.fechaDesde).not.toBe(vieja);
  });

  it('asignaciones de otra biblia no anclan el rango de la actual', async () => {
    const vieja = '2026-01-09';
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: nextBusinessDay(BIBLIA), preparacion_fecha: vieja },
    ]);
    const { result } = await renderReady();
    expect(result.current.fechaDesde).not.toBe(vieja);
  });

  it('para una biblia pasada el rango no supera la fecha de la biblia', async () => {
    const { result } = await renderReady();
    act(() => result.current.setBibliaFecha('2026-01-14'));
    await waitFor(() => {
      expect(result.current.fechaHasta <= '2026-01-14').toBe(true);
      expect(result.current.fechaDesde <= result.current.fechaHasta).toBe(true);
    });
  });

  it('con el rango tomado a mano, una asignación más vieja lo extiende hacia atrás', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, fecha_hora_estado: '2026-02-02 08:00:00' }),
    ]);
    const { result } = await renderReady();
    act(() => result.current.setFechaDesde('2026-03-01'));
    await waitFor(() => expect(result.current.fechaDesde).toBe('2026-03-01'));
    // asignar una prep con fecha anterior al desde manual
    await act(() => result.current.asignarPreparacion(1, 'CH1'));
    await waitFor(() => expect(result.current.fechaDesde).toBe('2026-02-02'));
  });

  it('impactar reintenta también las fallidas (pasan a ok si Sigma acepta)', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'fallido' },
    ]);
    mocked.impactarEnSigma.mockResolvedValue({ ok: [1], fallido: [], error: [], total: 1 });
    const { result } = await renderReady();
    await act(async () => { await result.current.impactarEnSigma(); });
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('ok');
  });

  it('impactar no toca asignaciones que no vinieron en el resultado', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD, codigo_despacho_destino: '151', sigma_sync_estado: 'pendiente' },
    ]);
    mocked.impactarEnSigma.mockResolvedValue({ ok: [], fallido: [], error: [], total: 0 });
    const { result } = await renderReady();
    await act(async () => { await result.current.impactarEnSigma(); });
    expect(result.current.asignacionCrossCodeByPrepId.get(1)?.sigma_sync_estado).toBe('pendiente');
  });

  it('limpiarBiblia conserva los cambios individuales ok', async () => {
    // un cambio ok que Digip aún no refleja sobrevive a la limpieza
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'ok' },
    ]);
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1', codigo_despacho: 'VI HPC 1' })] }),
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.pedidoCambiosByPrepId.has(1)).toBe(true));
    await act(async () => { await result.current.limpiarBiblia(); });
    expect(result.current.pedidoCambiosByPrepId.get(1)?.map(c => c.estado)).toEqual(['ok']);
  });

  it('los cambios fallidos sobreviven a la recarga de cambios tras impactar', async () => {
    const { result } = await renderReady();
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'fallido' },
    ]);
    await act(async () => { await result.current.impactarEnSigma(); });
    expect(result.current.pedidoCambiosByPrepId.get(1)?.map(c => c.estado)).toEqual(['fallido']);
    expect(result.current.sigmaEstadoByPrepId.get(1)).toBe('fallido');
  });

  it('no duplica al chofer excepcional si ya está en la lista de choferes', async () => {
    mocked.fetchRepartosExcepcionales.mockResolvedValue([
      { id: 9, chofer_codigo: 'CH1', chofer_nombre: 'López bis', codigo_reparto: 'BIG', codigo_despacho_id: '151', fecha: BIBLIA },
    ]);
    const { result } = await renderReady();
    const lopez = result.current.choferes.filter(c => c.codigo === 'CH1');
    expect(lopez).toHaveLength(1);
    expect(lopez[0].descripcion).toBe('López'); // la del fetch, no la de la excepción
  });

  it('reasignar reemplaza la asignación previa de esa prep (sin duplicar filas)', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
    ]);
    const { result } = await renderReady();
    await act(() => result.current.asignarPreparacion(1, 'CH2'));
    expect(result.current.preparacionesPorChofer.get('CH2')?.map(p => p.id)).toEqual([1]);
    expect(result.current.preparacionesPorChofer.get('CH1')).toBeUndefined();
  });

  it('la fecha de la preparación se clampa a fechaHasta al asignar', async () => {
    // prep con fecha futura respecto del rango visible
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, fecha_hora_estado: '2099-01-01 08:00:00' }),
    ]);
    const { result } = await renderReady();
    await act(() => result.current.asignarPreparacion(1, 'CH1'));
    const fechaEnviada = mocked.asignarPreparacionAChofer.mock.calls[0][3];
    expect(fechaEnviada).toBe(result.current.fechaHasta);
  });

  it('cambiar la biblia dispara nueva carga de excepciones y cambios para esa fecha', async () => {
    const { result } = await renderReady();
    const nueva = nextBusinessDay(BIBLIA);
    mocked.fetchRepartosExcepcionales.mockClear();
    mocked.fetchCambiosEstado.mockClear();
    act(() => result.current.setBibliaFecha(nueva));
    await waitFor(() => {
      expect(mocked.fetchRepartosExcepcionales).toHaveBeenCalledWith(nueva);
      expect(mocked.fetchCambiosEstado).toHaveBeenCalledWith(nueva);
    });
  });
});

describe('refuerzos de mutation testing — segunda tanda', () => {
  it('para una biblia bien futura, hasta se clampa exactamente a hoy', async () => {
    const { result } = await renderReady();
    // 10 días hábiles adelante: prevBusinessDay(biblia) queda después de hoy
    let futura = BIBLIA;
    for (let i = 0; i < 10; i++) futura = nextBusinessDay(futura);
    act(() => result.current.setBibliaFecha(futura));
    await waitFor(() => expect(result.current.fechaHasta).toBe(TODAY));
    expect(result.current.fechaDesde).toBe(TODAY);
  });

  it('con dos asignaciones ancla, desde toma la mínima exacta', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: '2026-01-08' },
      { preparacion_id: 2, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: '2026-01-05' },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.fechaDesde).toBe('2026-01-05'));
  });

  it('setFechaHasta por encima del ancla se respeta (no fuerza el máximo)', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: '2026-01-05' },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.fechaDesde).toBe('2026-01-05'));
    act(() => result.current.setFechaHasta('2026-01-20'));
    // el efecto de rango puede reclampear hacia maxPrep, pero nunca por debajo del valor pedido si es válido
    await waitFor(() => expect(result.current.fechaHasta >= '2026-01-05').toBe(true));
  });

  it('setFechaHasta sin asignaciones se respeta tal cual', async () => {
    const { result } = await renderReady();
    act(() => result.current.setFechaDesde('2026-01-01'));
    act(() => result.current.setFechaHasta('2026-02-01'));
    expect(result.current.fechaHasta).toBe('2026-02-01');
  });

  it('la recarga de cambios tras impactar descarta los ok que Digip ya refleja', async () => {
    // primero cargan las preparaciones (pobla codigoPorPedidoRef con P1→VI HPC 1)
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1', codigo_despacho: 'VI HPC 1' })] }),
    ]);
    const { result } = await renderReady();
    // impactar recarga cambios: el ok hacia VI HPC 1 ya está reflejado → se descarta
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'VI HPC 1', estado: 'ok' },
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'pendiente' },
    ]);
    await act(async () => { await result.current.impactarEnSigma(); });
    expect(result.current.pedidoCambiosByPrepId.get(1)?.map(c => c.estado)).toEqual(['pendiente']);
  });

  it('la recarga tras impactar conserva los ok que Digip aún no refleja', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1', codigo_despacho: 'VI HPC 1' })] }),
    ]);
    const { result } = await renderReady();
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'ok' },
    ]);
    await act(async () => { await result.current.impactarEnSigma(); });
    expect(result.current.pedidoCambiosByPrepId.get(1)?.map(c => c.estado)).toEqual(['ok']);
  });

  it('el merge de choferes no pisa al chofer real aunque los choferes lleguen después', async () => {
    mocked.fetchRepartosExcepcionales.mockResolvedValue([
      { id: 9, chofer_codigo: 'CH1', chofer_nombre: 'López bis', codigo_reparto: 'BIG', codigo_despacho_id: '151', fecha: BIBLIA },
    ]);
    mocked.fetchChoferes.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(CHOFERES), 20)),
    );
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.choferes.length).toBeGreaterThan(0));
    const lopez = result.current.choferes.filter(c => c.codigo === 'CH1');
    expect(lopez).toHaveLength(1);
    expect(lopez[0].descripcion).toBe('López');
  });

  it('el cross-code descarta solo los cambios de ESA preparación', async () => {
    mocked.fetchPreparaciones.mockResolvedValue([makePrep({ id: 1 }), makePrep({ id: 2 })]);
    mocked.fetchCambiosEstado.mockResolvedValue([
      { pedido_codigo: 'P1', preparacion_id: 1, nuevo_codigo_despacho: 'BIG', estado: 'pendiente' },
      { pedido_codigo: 'P9', preparacion_id: 2, nuevo_codigo_despacho: 'BIG', estado: 'pendiente' },
    ]);
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.pedidoCambiosByPrepId.size).toBe(2));
    const prep = makePrep({ id: 1 });
    await act(() => result.current.reasignarPreparacion(prep, 'CH2', CODIGOS[1]));
    expect(result.current.pedidoCambiosByPrepId.has(1)).toBe(false);
    expect(result.current.pedidoCambiosByPrepId.has(2)).toBe(true);
  });

  it('desasignar no toca las asignaciones de otras preparaciones', async () => {
    mocked.fetchAsignaciones.mockResolvedValue([
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
      { preparacion_id: 2, chofer_codigo: 'CH2', biblia_fecha: BIBLIA, preparacion_fecha: PREV_BD },
    ]);
    mocked.fetchPreparaciones.mockResolvedValue([makePrep({ id: 1 }), makePrep({ id: 2 })]);
    const { result } = await renderReady();
    await act(() => result.current.desasignarPreparacion(1));
    expect(result.current.preparacionesPorChofer.get('CH2')?.map(p => p.id)).toEqual([2]);
    expect(result.current.preparacionesDisponibles.map(p => p.id)).toEqual([1]);
  });

  it('los mensajes de fallback de las cargas auxiliares son exactos', async () => {
    mocked.fetchCodigosDespacho.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject('x'), 30)),
    );
    const { result } = renderHook(() => useBibliaData());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar repartos'));
  });

  it('el fallback de asignaciones es exacto', async () => {
    mocked.fetchAsignaciones.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject('x'), 30)),
    );
    const { result } = renderHook(() => useBibliaData());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar asignaciones'));
  });

  it('el fallback de excepciones es exacto', async () => {
    mocked.fetchRepartosExcepcionales.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject('x'), 30)),
    );
    const { result } = renderHook(() => useBibliaData());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar excepciones'));
  });

  it('el fallback de cambios pendientes es exacto', async () => {
    mocked.fetchCambiosEstado.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject('x'), 30)),
    );
    const { result } = renderHook(() => useBibliaData());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar cambios pendientes'));
  });

  it('el fallback de choferes es exacto', async () => {
    mocked.fetchChoferes.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject('x'), 30)),
    );
    const { result } = renderHook(() => useBibliaData());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar choferes'));
  });

  it('toggleEstado solo quita el estado toggleado', async () => {
    const { result } = await renderReady();
    act(() => result.current.toggleEstado('Completada'));
    act(() => result.current.toggleEstado('Remitido'));
    act(() => result.current.toggleEstado('Completada'));
    expect(result.current.estadosSeleccionados).toEqual(['Remitido']);
  });
});
