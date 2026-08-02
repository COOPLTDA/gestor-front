import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMantenimiento } from './useMantenimiento';
import * as api from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  fetchAllChoferes: vi.fn(),
  fetchAllCodigosDespacho: vi.fn(),
  fetchAllZonas: vi.fn(),
  createChofer: vi.fn(),
  updateChofer: vi.fn(),
  updateCodigoDespacho: vi.fn(),
  createZona: vi.fn(),
  updateZona: vi.fn(),
  asignarChoferCodigoDespacho: vi.fn(),
  desasignarChoferCodigoDespacho: vi.fn(),
  asignarCodigoDespachoAZona: vi.fn(),
  desasignarCodigoDespachoDeZona: vi.fn(),
}));

const mocked = vi.mocked(api);

const CHOFERES: api.ChoferAdmin[] = [
  { codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: ['BIG'] },
  { codigo: 'CH2', descripcion: 'García', desactivado: 1, rutas: [] },
];
const CODIGOS: api.CodigoDespachoAdmin[] = [
  { id: 'BIG', nombre: 'BIG', desactivado: 0, direccion: 'LOMAS', zona_id: 1, choferes: ['CH1'] },
  { id: 'PERI 5', nombre: 'PERI 5', desactivado: 0, direccion: 'SUR', zona_id: null, choferes: [] },
];
const ZONAS: api.ZonaAdmin[] = [
  { id: 1, nombre: 'LOMAS', desactivado: 0, repartos: ['BIG'] },
  { id: 2, nombre: 'SUR', desactivado: 0, repartos: [] },
];

beforeEach(() => {
  vi.resetAllMocks();
  mocked.fetchAllChoferes.mockResolvedValue(CHOFERES);
  mocked.fetchAllCodigosDespacho.mockResolvedValue(CODIGOS);
  mocked.fetchAllZonas.mockResolvedValue(ZONAS);
});

async function renderReady() {
  const utils = renderHook(() => useMantenimiento());
  await waitFor(() => {
    expect(utils.result.current.choferes).toHaveLength(2);
    expect(utils.result.current.codigosDespacho).toHaveLength(2);
    expect(utils.result.current.zonas).toHaveLength(2);
  });
  return utils;
}

describe('carga inicial', () => {
  it('carga choferes, códigos de despacho y zonas al montar', async () => {
    const { result } = await renderReady();
    expect(result.current.choferes).toEqual(CHOFERES);
    expect(result.current.codigosDespacho).toEqual(CODIGOS);
    expect(result.current.zonas).toEqual(ZONAS);
    expect(result.current.error).toBeNull();
    expect(result.current.loadingChoferes).toBe(false);
    expect(result.current.loadingRepartos).toBe(false);
    expect(result.current.loadingZonas).toBe(false);
  });

  it('expone el mensaje de error si falla la carga de choferes', async () => {
    // La rejección se demora para que sea la última en resolverse: una carga
    // exitosa posterior haría setError(null) y pisaría el mensaje.
    mocked.fetchAllChoferes.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('sin red')), 10)),
    );
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => expect(result.current.error).toBe('sin red'));
    expect(result.current.loadingChoferes).toBe(false);
  });

  it('usa mensaje genérico si el error no es Error', async () => {
    mocked.fetchAllZonas.mockRejectedValue('cualquier cosa');
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar zonas'));
  });

  it('usa mensaje genérico si falla la carga de repartos con algo que no es Error', async () => {
    mocked.fetchAllCodigosDespacho.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(42), 10)),
    );
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar repartos'));
  });
});

describe('guardarChofer', () => {
  it('crea el chofer cuando no está editando y recarga', async () => {
    const { result } = await renderReady();
    mocked.fetchAllChoferes.mockClear();
    await act(() => result.current.guardarChofer({ codigo: 'CH3', descripcion: 'Nuevo', chofer_padre_codigo: null }, false));
    expect(mocked.createChofer).toHaveBeenCalledWith('CH3', 'Nuevo', null);
    expect(mocked.updateChofer).not.toHaveBeenCalled();
    expect(mocked.fetchAllChoferes).toHaveBeenCalledTimes(1);
  });

  it('crea un chofer hijo pasando el padre', async () => {
    const { result } = await renderReady();
    await act(() => result.current.guardarChofer({ codigo: 'CH3-2', descripcion: 'Camioneta 2', chofer_padre_codigo: 'CH3' }, false));
    expect(mocked.createChofer).toHaveBeenCalledWith('CH3-2', 'Camioneta 2', 'CH3');
  });

  it('actualiza el chofer cuando está editando', async () => {
    const { result } = await renderReady();
    await act(() => result.current.guardarChofer({ codigo: 'CH1', descripcion: 'Editado', chofer_padre_codigo: null }, true));
    expect(mocked.updateChofer).toHaveBeenCalledWith('CH1', { descripcion: 'Editado', chofer_padre_codigo: null });
    expect(mocked.createChofer).not.toHaveBeenCalled();
  });
});

describe('toggleChofer', () => {
  it('activa un chofer desactivado y actualiza el estado local', async () => {
    const { result } = await renderReady();
    await act(() => result.current.toggleChofer('CH2', 1));
    expect(mocked.updateChofer).toHaveBeenCalledWith('CH2', { desactivado: 0 });
    expect(result.current.choferes.find(c => c.codigo === 'CH2')?.desactivado).toBe(0);
  });

  it('desactiva un chofer activo', async () => {
    const { result } = await renderReady();
    await act(() => result.current.toggleChofer('CH1', 0));
    expect(mocked.updateChofer).toHaveBeenCalledWith('CH1', { desactivado: 1 });
    expect(result.current.choferes.find(c => c.codigo === 'CH1')?.desactivado).toBe(1);
    // CH2 ya estaba desactivado (1); si el map tocara todas las filas (no solo la de CH1),
    // este valor no cambiaría igual, pero si además comparamos identidad de objeto queda claro
    // que CH2 nunca se tocó.
    const ch2Antes = result.current.choferes.find(c => c.codigo === 'CH2');
    expect(ch2Antes?.desactivado).toBe(1);
    await act(() => result.current.toggleChofer('CH1', 1)); // vuelve a activar CH1
    expect(result.current.choferes.find(c => c.codigo === 'CH2')).toBe(ch2Antes); // CH2 nunca se re-crea
  });

  it('setea error y no toca el estado si la API falla', async () => {
    mocked.updateChofer.mockRejectedValue(new Error('boom'));
    const { result } = await renderReady();
    await act(() => result.current.toggleChofer('CH1', 0));
    expect(result.current.error).toBe('boom');
    expect(result.current.choferes.find(c => c.codigo === 'CH1')?.desactivado).toBe(0);
  });
});

describe('guardarCodigoDespacho', () => {
  it('solo actualiza zona_id (nunca crea ni manda nombre) y recarga', async () => {
    const { result } = await renderReady();
    mocked.fetchAllCodigosDespacho.mockClear();
    await act(() => result.current.guardarCodigoDespacho({ id: 'BIG', zona_id: 2 }, true));
    expect(mocked.updateCodigoDespacho).toHaveBeenCalledWith('BIG', { zona_id: 2 });
    expect(mocked.fetchAllCodigosDespacho).toHaveBeenCalledTimes(1);
  });
});

describe('toggleCodigoDespacho', () => {
  it('alterna el desactivado y refleja el cambio local', async () => {
    const { result } = await renderReady();
    const periAntes = result.current.codigosDespacho.find(r => r.id === 'PERI 5');
    await act(() => result.current.toggleCodigoDespacho('BIG', 0));
    expect(mocked.updateCodigoDespacho).toHaveBeenCalledWith('BIG', { desactivado: 1 });
    expect(result.current.codigosDespacho.find(r => r.id === 'BIG')?.desactivado).toBe(1);
    // PERI 5 no debería tocarse: si el map aplicara el cambio a todas las filas, esta
    // referencia cambiaría igual.
    expect(result.current.codigosDespacho.find(r => r.id === 'PERI 5')).toBe(periAntes);
  });

  it('reactiva un código de despacho ya desactivado (1 -> 0)', async () => {
    const { result } = await renderReady();
    await act(() => result.current.toggleCodigoDespacho('BIG', 1));
    expect(mocked.updateCodigoDespacho).toHaveBeenCalledWith('BIG', { desactivado: 0 });
    expect(result.current.codigosDespacho.find(r => r.id === 'BIG')?.desactivado).toBe(0);
  });

  it('setea error genérico si la API falla con algo que no es Error', async () => {
    mocked.updateCodigoDespacho.mockRejectedValue('x');
    const { result } = await renderReady();
    await act(() => result.current.toggleCodigoDespacho('BIG', 0));
    expect(result.current.error).toBe('Error al actualizar código de despacho');
  });
});

describe('asignar / desasignar chofer a código de despacho', () => {
  it('asignar agrega el chofer al código y la ruta al chofer sin duplicar', async () => {
    const { result } = await renderReady();
    const bigAntes = result.current.codigosDespacho.find(r => r.id === 'BIG');
    const ch2Antes = result.current.choferes.find(c => c.codigo === 'CH2');
    await act(() => result.current.asignar('PERI 5', 'CH1'));
    expect(mocked.asignarChoferCodigoDespacho).toHaveBeenCalledWith('PERI 5', 'CH1');
    expect(result.current.codigosDespacho.find(r => r.id === 'PERI 5')?.choferes).toEqual(['CH1']);
    expect(result.current.choferes.find(c => c.codigo === 'CH1')?.rutas).toEqual(['BIG', 'PERI 5']);
    // BIG y CH2 no son el target de esta asignación: deben quedar con la misma referencia.
    expect(result.current.codigosDespacho.find(r => r.id === 'BIG')).toBe(bigAntes);
    expect(result.current.choferes.find(c => c.codigo === 'CH2')).toBe(ch2Antes);

    await act(() => result.current.asignar('PERI 5', 'CH1'));
    expect(result.current.codigosDespacho.find(r => r.id === 'PERI 5')?.choferes).toEqual(['CH1']);
  });

  it('desasignar remueve el chofer del código y la ruta del chofer', async () => {
    const { result } = await renderReady();
    const periAntes = result.current.codigosDespacho.find(r => r.id === 'PERI 5');
    const ch2Antes = result.current.choferes.find(c => c.codigo === 'CH2');
    await act(() => result.current.desasignar('BIG', 'CH1'));
    expect(mocked.desasignarChoferCodigoDespacho).toHaveBeenCalledWith('BIG', 'CH1');
    expect(result.current.codigosDespacho.find(r => r.id === 'BIG')?.choferes).toEqual([]);
    expect(result.current.choferes.find(c => c.codigo === 'CH1')?.rutas).toEqual([]);
    expect(result.current.codigosDespacho.find(r => r.id === 'PERI 5')).toBe(periAntes);
    expect(result.current.choferes.find(c => c.codigo === 'CH2')).toBe(ch2Antes);
  });

  it('asignar setea error si la API falla y no toca el estado', async () => {
    mocked.asignarChoferCodigoDespacho.mockRejectedValue(new Error('falló asignar'));
    const { result } = await renderReady();
    await act(() => result.current.asignar('PERI 5', 'CH1'));
    expect(result.current.error).toBe('falló asignar');
    expect(result.current.codigosDespacho.find(r => r.id === 'PERI 5')?.choferes).toEqual([]);
  });

  it('desasignar setea error si la API falla', async () => {
    mocked.desasignarChoferCodigoDespacho.mockRejectedValue(new Error('falló desasignar'));
    const { result } = await renderReady();
    await act(() => result.current.desasignar('BIG', 'CH1'));
    expect(result.current.error).toBe('falló desasignar');
    expect(result.current.codigosDespacho.find(r => r.id === 'BIG')?.choferes).toEqual(['CH1']);
  });
});

describe('guardarZona', () => {
  it('crea una zona nueva cuando no edita', async () => {
    const { result } = await renderReady();
    mocked.fetchAllZonas.mockClear();
    await act(() => result.current.guardarZona({ nombre: 'OESTE' }, false));
    expect(mocked.createZona).toHaveBeenCalledWith('OESTE');
    expect(mocked.fetchAllZonas).toHaveBeenCalledTimes(1);
  });

  it('actualiza la zona cuando edita con id', async () => {
    const { result } = await renderReady();
    await act(() => result.current.guardarZona({ id: 1, nombre: 'LOMAS 2' }, true));
    expect(mocked.updateZona).toHaveBeenCalledWith(1, { nombre: 'LOMAS 2' });
    expect(mocked.createZona).not.toHaveBeenCalled();
  });

  it('crea si está editando pero falta el id', async () => {
    const { result } = await renderReady();
    await act(() => result.current.guardarZona({ nombre: 'SIN ID' }, true));
    expect(mocked.createZona).toHaveBeenCalledWith('SIN ID');
  });
});

describe('toggleZona', () => {
  it('alterna el desactivado localmente', async () => {
    const { result } = await renderReady();
    await act(() => result.current.toggleZona(1, 0));
    expect(mocked.updateZona).toHaveBeenCalledWith(1, { desactivado: 1 });
    expect(result.current.zonas.find(z => z.id === 1)?.desactivado).toBe(1);
    expect(result.current.zonas.find(z => z.id === 2)?.desactivado).toBe(0);
  });

  it('reactiva una zona ya desactivada (1 -> 0)', async () => {
    const { result } = await renderReady();
    await act(() => result.current.toggleZona(1, 1));
    expect(mocked.updateZona).toHaveBeenCalledWith(1, { desactivado: 0 });
    expect(result.current.zonas.find(z => z.id === 1)?.desactivado).toBe(0);
  });

  it('setea error si falla', async () => {
    mocked.updateZona.mockRejectedValue(new Error('zona rota'));
    const { result } = await renderReady();
    await act(() => result.current.toggleZona(1, 0));
    expect(result.current.error).toBe('zona rota');
  });
});

describe('asignarCodigoDespacho a zona', () => {
  it('mueve el código a la zona destino y lo saca de las demás', async () => {
    const { result } = await renderReady();
    await act(() => result.current.asignarCodigoDespacho('BIG', 2));
    expect(mocked.asignarCodigoDespachoAZona).toHaveBeenCalledWith('BIG', 2);
    expect(result.current.zonas.find(z => z.id === 2)?.repartos).toEqual(['BIG']);
    expect(result.current.zonas.find(z => z.id === 1)?.repartos).toEqual([]);
    expect(result.current.codigosDespacho.find(r => r.id === 'BIG')?.zona_id).toBe(2);
    // PERI 5 no es el código movido: su zona_id no debe tocarse.
    expect(result.current.codigosDespacho.find(r => r.id === 'PERI 5')?.zona_id).toBeNull();
  });

  it('al mover un código, una zona de origen con otros repartos conserva el resto', async () => {
    mocked.fetchAllZonas.mockResolvedValue([
      { id: 1, nombre: 'LOMAS', desactivado: 0, repartos: ['BIG', 'OTRO'] },
      { id: 2, nombre: 'SUR', desactivado: 0, repartos: [] },
    ]);
    const { result } = await renderReady();
    await act(() => result.current.asignarCodigoDespacho('BIG', 2));
    // La zona de origen pierde BIG pero conserva OTRO (si el filter descartara todo, esto fallaría).
    expect(result.current.zonas.find(z => z.id === 1)?.repartos).toEqual(['OTRO']);
  });

  it('no duplica el código si ya estaba en la zona', async () => {
    const { result } = await renderReady();
    await act(() => result.current.asignarCodigoDespacho('BIG', 1));
    expect(result.current.zonas.find(z => z.id === 1)?.repartos).toEqual(['BIG']);
  });

  it('setea error si falla', async () => {
    mocked.asignarCodigoDespachoAZona.mockRejectedValue(new Error('sin zona'));
    const { result } = await renderReady();
    await act(() => result.current.asignarCodigoDespacho('BIG', 2));
    expect(result.current.error).toBe('sin zona');
    expect(result.current.zonas.find(z => z.id === 1)?.repartos).toEqual(['BIG']);
  });
});

describe('desasignarCodigoDespacho de zona', () => {
  it('saca el código de la zona y limpia zona_id', async () => {
    const { result } = await renderReady();
    const zona2Antes = result.current.zonas.find(z => z.id === 2);
    const periAntes = result.current.codigosDespacho.find(r => r.id === 'PERI 5');
    await act(() => result.current.desasignarCodigoDespacho('BIG', 1));
    expect(mocked.desasignarCodigoDespachoDeZona).toHaveBeenCalledWith('BIG');
    expect(result.current.zonas.find(z => z.id === 1)?.repartos).toEqual([]);
    expect(result.current.codigosDespacho.find(r => r.id === 'BIG')?.zona_id).toBeNull();
    // La zona 2 (no la de origen) y PERI 5 (no el código desasignado) no deben tocarse:
    // misma referencia de objeto, no solo mismo contenido.
    expect(result.current.zonas.find(z => z.id === 2)).toBe(zona2Antes);
    expect(result.current.codigosDespacho.find(r => r.id === 'PERI 5')).toBe(periAntes);
  });

  it('la zona de origen con otros repartos conserva el resto al desasignar uno', async () => {
    mocked.fetchAllZonas.mockResolvedValue([
      { id: 1, nombre: 'LOMAS', desactivado: 0, repartos: ['BIG', 'OTRO'] },
      { id: 2, nombre: 'SUR', desactivado: 0, repartos: [] },
    ]);
    const { result } = await renderReady();
    await act(() => result.current.desasignarCodigoDespacho('BIG', 1));
    expect(result.current.zonas.find(z => z.id === 1)?.repartos).toEqual(['OTRO']);
  });

  it('setea error si falla', async () => {
    mocked.desasignarCodigoDespachoDeZona.mockRejectedValue(new Error('no se pudo'));
    const { result } = await renderReady();
    await act(() => result.current.desasignarCodigoDespacho('BIG', 1));
    expect(result.current.error).toBe('no se pudo');
    expect(result.current.zonas.find(z => z.id === 1)?.repartos).toEqual(['BIG']);
  });
});

// --- Refuerzos de mutation testing ---

describe('refuerzos — mensajes de fallback exactos y loading', () => {
  it('los estados iniciales son listas vacías y loading apagado', () => {
    mocked.fetchAllChoferes.mockImplementation(() => new Promise(() => {}));
    mocked.fetchAllCodigosDespacho.mockImplementation(() => new Promise(() => {}));
    mocked.fetchAllZonas.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useMantenimiento());
    expect(result.current.choferes).toEqual([]);
    expect(result.current.codigosDespacho).toEqual([]);
    expect(result.current.zonas).toEqual([]);
  });

  it('enciende loading mientras carga cada recurso', async () => {
    let resolveChoferes: (v: api.ChoferAdmin[]) => void = () => {};
    mocked.fetchAllChoferes.mockImplementation(() => new Promise(res => { resolveChoferes = res; }));
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => expect(result.current.loadingChoferes).toBe(true));
    act(() => resolveChoferes(CHOFERES));
    await waitFor(() => expect(result.current.loadingChoferes).toBe(false));
  });

  it('toggleChofer usa el fallback exacto ante rechazos que no son Error', async () => {
    mocked.updateChofer.mockRejectedValueOnce('x');
    const { result } = await renderReady();
    await act(() => result.current.toggleChofer('CH1', 0));
    expect(result.current.error).toBe('Error al actualizar chofer');
  });

  it('asignar y desasignar usan sus fallbacks exactos', async () => {
    mocked.asignarChoferCodigoDespacho.mockRejectedValueOnce('x');
    const { result } = await renderReady();
    await act(() => result.current.asignar('BIG', 'CH2'));
    expect(result.current.error).toBe('Error al asignar chofer');

    mocked.desasignarChoferCodigoDespacho.mockRejectedValueOnce('x');
    await act(() => result.current.desasignar('BIG', 'CH1'));
    expect(result.current.error).toBe('Error al desasignar chofer');
  });

  it('toggleZona y las asignaciones de zona usan sus fallbacks exactos', async () => {
    mocked.updateZona.mockRejectedValueOnce('x');
    const { result } = await renderReady();
    await act(() => result.current.toggleZona(1, 0));
    expect(result.current.error).toBe('Error al actualizar zona');

    mocked.asignarCodigoDespachoAZona.mockRejectedValueOnce('x');
    await act(() => result.current.asignarCodigoDespacho('BIG', 2));
    expect(result.current.error).toBe('Error al asignar a zona');

    mocked.desasignarCodigoDespachoDeZona.mockRejectedValueOnce('x');
    await act(() => result.current.desasignarCodigoDespacho('BIG', 1));
    expect(result.current.error).toBe('Error al desasignar de zona');
  });

  it('el fallback de carga de choferes es exacto', async () => {
    mocked.fetchAllChoferes.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject('x'), 10)),
    );
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar choferes'));
  });

  it('asignar sobre entidades sin arrays previos crea las listas correctas', async () => {
    mocked.fetchAllChoferes.mockResolvedValue([
      { codigo: 'CH1', descripcion: 'López', desactivado: 0 }, // sin rutas
    ]);
    mocked.fetchAllCodigosDespacho.mockResolvedValue([
      { id: 'BIG', nombre: 'BIG', desactivado: 0, direccion: null }, // sin choferes
    ]);
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => {
      expect(result.current.choferes).toHaveLength(1);
      expect(result.current.codigosDespacho).toHaveLength(1);
    });
    await act(() => result.current.asignar('BIG', 'CH1'));
    expect(result.current.codigosDespacho[0].choferes).toEqual(['CH1']);
    expect(result.current.choferes[0].rutas).toEqual(['BIG']);
  });

  it('desasignar sobre entidades sin arrays previos deja listas vacías', async () => {
    mocked.fetchAllChoferes.mockResolvedValue([
      { codigo: 'CH1', descripcion: 'López', desactivado: 0 },
    ]);
    mocked.fetchAllCodigosDespacho.mockResolvedValue([
      { id: 'BIG', nombre: 'BIG', desactivado: 0, direccion: null },
    ]);
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => {
      expect(result.current.choferes).toHaveLength(1);
      expect(result.current.codigosDespacho).toHaveLength(1);
    });
    await act(() => result.current.desasignar('BIG', 'CH1'));
    expect(result.current.codigosDespacho[0].choferes).toEqual([]);
    expect(result.current.choferes[0].rutas).toEqual([]);
  });

  it('desasignar solo saca el código/chofer indicado, conserva el resto de la lista', async () => {
    mocked.fetchAllChoferes.mockResolvedValue([
      { codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: ['BIG', 'PERI 5'] },
    ]);
    mocked.fetchAllCodigosDespacho.mockResolvedValue([
      { id: 'BIG', nombre: 'BIG', desactivado: 0, direccion: null, choferes: ['CH1', 'CH2'] },
    ]);
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => {
      expect(result.current.choferes).toHaveLength(1);
      expect(result.current.codigosDespacho).toHaveLength(1);
    });
    await act(() => result.current.desasignar('BIG', 'CH1'));
    // Se saca CH1 de BIG.choferes, pero CH2 se conserva.
    expect(result.current.codigosDespacho[0].choferes).toEqual(['CH2']);
    // Se saca BIG de las rutas de CH1, pero PERI 5 se conserva.
    expect(result.current.choferes[0].rutas).toEqual(['PERI 5']);
  });

  it('asignar a zona crea la lista de repartos si la zona no tenía', async () => {
    mocked.fetchAllZonas.mockResolvedValue([
      { id: 1, nombre: 'LOMAS', desactivado: 0 }, // sin repartos
    ]);
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => expect(result.current.zonas).toHaveLength(1));
    await act(() => result.current.asignarCodigoDespacho('BIG', 1));
    expect(result.current.zonas[0].repartos).toEqual(['BIG']);
  });
});

describe('refuerzos — loading de repartos y zonas', () => {
  it('enciende y apaga loadingRepartos', async () => {
    let resolver: (v: api.CodigoDespachoAdmin[]) => void = () => {};
    mocked.fetchAllCodigosDespacho.mockImplementation(() => new Promise(res => { resolver = res; }));
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => expect(result.current.loadingRepartos).toBe(true));
    act(() => resolver(CODIGOS));
    await waitFor(() => expect(result.current.loadingRepartos).toBe(false));
  });

  it('enciende y apaga loadingZonas', async () => {
    let resolver: (v: api.ZonaAdmin[]) => void = () => {};
    mocked.fetchAllZonas.mockImplementation(() => new Promise(res => { resolver = res; }));
    const { result } = renderHook(() => useMantenimiento());
    await waitFor(() => expect(result.current.loadingZonas).toBe(true));
    act(() => resolver(ZONAS));
    await waitFor(() => expect(result.current.loadingZonas).toBe(false));
  });
});
