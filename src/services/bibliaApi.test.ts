import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request } from './bibliaRequest';
import {
  subscribeSyncAll,
  subscribeSyncHoy,
  subscribeSyncEvents,
  fetchSyncStatus,
  fetchPreparaciones,
  fetchChoferes,
  fetchCodigosDespacho,
  asignarPreparacionAChofer,
  asignarPreparacionesBatch,
  fetchAsignaciones,
  searchChoferes,
  searchCodigosDespacho,
  fetchRepartosExcepcionales,
  crearRepartoExcepcional,
  eliminarRepartoExcepcional,
  limpiarAsignacionesBiblia,
  fetchRangoBiblia,
  fetchResumenBiblia,
  fetchRepartosPorDireccion,
  fetchMapaClientes,
  fetchAllChoferes,
  fetchAllCodigosDespacho,
  createChofer,
  updateChofer,
  updateCodigoDespacho,
  asignarChoferCodigoDespacho,
  desasignarChoferCodigoDespacho,
  fetchAllZonas,
  createZona,
  updateZona,
  asignarCodigoDespachoAZona,
  desasignarCodigoDespachoDeZona,
  modificarPedido,
  fetchCambiosEstado,
  impactarEnSigma,
  type SyncEvent,
} from './bibliaApi';

vi.mock('./bibliaRequest', () => ({
  request: vi.fn(),
}));

const requestMock = vi.mocked(request);

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue(undefined);
});

describe('endpoints de lectura', () => {
  it('fetchSyncStatus consulta /api/biblia/sync/status', async () => {
    await fetchSyncStatus();
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/sync/status');
  });

  it('fetchPreparaciones arma la query con todos los filtros', async () => {
    await fetchPreparaciones({
      fecha_desde: '2026-07-01',
      fecha_hasta: '2026-07-02',
      estado: 'Completada',
      tipo: 'Pedidos individuales',
      page: 2,
      pageSize: 50,
    });
    expect(requestMock).toHaveBeenCalledWith(
      '/api/gestor/biblia/preparaciones?fecha_desde=2026-07-01&fecha_hasta=2026-07-02&estado=Completada&tipo=Pedidos+individuales&page=2&pageSize=50',
    );
  });

  it('fetchPreparaciones omite los filtros ausentes', async () => {
    await fetchPreparaciones({ fecha_desde: '2026-07-01' });
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/preparaciones?fecha_desde=2026-07-01');
  });

  it('fetchChoferes sin params pega sin query string', async () => {
    await fetchChoferes();
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/choferes');
  });

  it('fetchChoferes con params arma la query', async () => {
    await fetchChoferes({ fecha_desde: '2026-07-01', fecha_hasta: '2026-07-02', biblia_fecha: '2026-07-03' });
    expect(requestMock).toHaveBeenCalledWith(
      '/api/gestor/biblia/choferes?fecha_desde=2026-07-01&fecha_hasta=2026-07-02&biblia_fecha=2026-07-03',
    );
  });

  it('fetchCodigosDespacho consulta /api/biblia/repartos', async () => {
    await fetchCodigosDespacho();
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos');
  });

  it('fetchAsignaciones consulta /api/biblia/asignaciones', async () => {
    await fetchAsignaciones();
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/asignaciones');
  });

  it('searchChoferes escapa la query', async () => {
    await searchChoferes('lópez & co');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/choferes/search?q=l%C3%B3pez%20%26%20co');
  });

  it('searchCodigosDespacho escapa la query', async () => {
    await searchCodigosDespacho('PERI 5');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos/search?q=PERI%205');
  });

  it('fetchRepartosExcepcionales con y sin fecha', async () => {
    await fetchRepartosExcepcionales('2026-07-10');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos-excepcionales?fecha=2026-07-10');
    await fetchRepartosExcepcionales();
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos-excepcionales');
  });

  it('fetchRangoBiblia pasa biblia_fecha', async () => {
    await fetchRangoBiblia('2026-07-10');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/reportes/rango-biblia?biblia_fecha=2026-07-10');
  });

  it('fetchResumenBiblia pasa biblia_fecha', async () => {
    await fetchResumenBiblia('2026-07-10');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/reportes/resumen-biblia?biblia_fecha=2026-07-10');
  });

  it('fetchRepartosPorDireccion duplica fecha_desde como fecha_hasta si falta', async () => {
    await fetchRepartosPorDireccion('2026-07-10');
    expect(requestMock).toHaveBeenCalledWith(
      '/api/gestor/biblia/reportes/repartos-por-direccion?fecha_desde=2026-07-10&fecha_hasta=2026-07-10',
    );
  });

  it('fetchRepartosPorDireccion incluye biblia_fecha cuando se pasa', async () => {
    await fetchRepartosPorDireccion('2026-07-09', '2026-07-10', '2026-07-11');
    expect(requestMock).toHaveBeenCalledWith(
      '/api/gestor/biblia/reportes/repartos-por-direccion?fecha_desde=2026-07-09&fecha_hasta=2026-07-10&biblia_fecha=2026-07-11',
    );
  });

  it('fetchMapaClientes duplica fecha_desde y agrega biblia_fecha opcional', async () => {
    await fetchMapaClientes('2026-07-10');
    expect(requestMock).toHaveBeenCalledWith(
      '/api/gestor/biblia/reportes/mapa-clientes?fecha_desde=2026-07-10&fecha_hasta=2026-07-10',
    );
    await fetchMapaClientes('2026-07-09', '2026-07-10', '2026-07-11');
    expect(requestMock).toHaveBeenCalledWith(
      '/api/gestor/biblia/reportes/mapa-clientes?fecha_desde=2026-07-09&fecha_hasta=2026-07-10&biblia_fecha=2026-07-11',
    );
  });

  it('fetchCambiosEstado pasa biblia_fecha', async () => {
    await fetchCambiosEstado('2026-07-10');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/sigma/cambios-estado?biblia_fecha=2026-07-10');
  });

  it('fetchAllChoferes consulta /api/biblia/choferes/all', async () => {
    await fetchAllChoferes();
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/choferes/all');
  });

  it('fetchAllCodigosDespacho consulta /api/biblia/repartos', async () => {
    await fetchAllCodigosDespacho();
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos');
  });

  it('fetchAllZonas consulta /api/biblia/zonas', async () => {
    await fetchAllZonas();
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/zonas');
  });
});

describe('endpoints de escritura', () => {
  it('asignarPreparacionAChofer hace PUT con el body completo', async () => {
    await asignarPreparacionAChofer(7, 'CH1', '2026-07-10', '2026-07-09', 'BIG', 'pendiente');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/asignaciones/7/chofer', {
      method: 'PUT',
      body: JSON.stringify({
        chofer_codigo: 'CH1',
        biblia_fecha: '2026-07-10',
        preparacion_fecha: '2026-07-09',
        codigo_despacho_destino: 'BIG',
        sigma_sync_estado: 'pendiente',
      }),
    });
  });

  it('asignarPreparacionAChofer normaliza opcionales ausentes a null', async () => {
    await asignarPreparacionAChofer(7, 'CH1', '2026-07-10', '2026-07-09');
    const body = JSON.parse(requestMock.mock.calls[0][1]!.body as string);
    expect(body.codigo_despacho_destino).toBeNull();
    expect(body.sigma_sync_estado).toBeNull();
  });

  it('asignarPreparacionesBatch hace POST a /batch', async () => {
    const asignaciones = [
      { preparacion_id: 1, chofer_codigo: 'CH1', biblia_fecha: '2026-07-10', preparacion_fecha: '2026-07-09' },
    ];
    await asignarPreparacionesBatch(asignaciones);
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/asignaciones/batch', {
      method: 'POST',
      body: JSON.stringify({ asignaciones }),
    });
  });

  it('crearRepartoExcepcional hace POST con los datos', async () => {
    const data = {
      chofer_codigo: 'CH1',
      chofer_nombre: 'López',
      codigo_reparto: 'R1',
      codigo_despacho_id: 'BIG',
      fecha: '2026-07-10',
    };
    await crearRepartoExcepcional(data);
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos-excepcionales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('eliminarRepartoExcepcional hace DELETE por id', async () => {
    await eliminarRepartoExcepcional(42);
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos-excepcionales/42', { method: 'DELETE' });
  });

  it('limpiarAsignacionesBiblia hace DELETE por fecha', async () => {
    await limpiarAsignacionesBiblia('2026-07-10');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/asignaciones/biblia/2026-07-10', { method: 'DELETE' });
  });

  it('createChofer hace POST con codigo y descripcion (padre null por defecto)', async () => {
    await createChofer('CH9', 'Nuevo Chofer');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/choferes', {
      method: 'POST',
      body: JSON.stringify({ codigo: 'CH9', descripcion: 'Nuevo Chofer', chofer_padre_codigo: null }),
    });
  });

  it('createChofer incluye chofer_padre_codigo cuando se pasa', async () => {
    await createChofer('CH9-2', 'Camioneta 2', 'CH9');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/choferes', {
      method: 'POST',
      body: JSON.stringify({ codigo: 'CH9-2', descripcion: 'Camioneta 2', chofer_padre_codigo: 'CH9' }),
    });
  });

  it('updateChofer hace PUT escapando el código', async () => {
    await updateChofer('CH 9', { desactivado: 1 });
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/choferes/CH%209', {
      method: 'PUT',
      body: JSON.stringify({ desactivado: 1 }),
    });
  });

  it('updateCodigoDespacho hace PUT escapando el id', async () => {
    await updateCodigoDespacho('PERI 5', { zona_id: 3 });
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos/PERI%205', {
      method: 'PUT',
      body: JSON.stringify({ zona_id: 3 }),
    });
  });

  it('asignarChoferCodigoDespacho hace POST al sub-recurso choferes', async () => {
    await asignarChoferCodigoDespacho('BIG', 'CH1');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos/BIG/choferes', {
      method: 'POST',
      body: JSON.stringify({ chofer_codigo: 'CH1' }),
    });
  });

  it('desasignarChoferCodigoDespacho hace DELETE al sub-recurso', async () => {
    await desasignarChoferCodigoDespacho('BIG', 'CH1');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos/BIG/choferes/CH1', { method: 'DELETE' });
  });

  it('createZona hace POST y devuelve el id', async () => {
    requestMock.mockResolvedValue({ id: 11 });
    await expect(createZona('SUR')).resolves.toBe(11);
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/zonas', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'SUR' }),
    });
  });

  it('updateZona hace PUT por id', async () => {
    await updateZona(3, { nombre: 'NORTE', desactivado: 0 });
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/zonas/3', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'NORTE', desactivado: 0 }),
    });
  });

  it('asignarCodigoDespachoAZona delega en updateCodigoDespacho con zona_id', async () => {
    await asignarCodigoDespachoAZona('BIG', 5);
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos/BIG', {
      method: 'PUT',
      body: JSON.stringify({ zona_id: 5 }),
    });
  });

  it('desasignarCodigoDespachoDeZona manda zona_id null', async () => {
    await desasignarCodigoDespachoDeZona('BIG');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/repartos/BIG', {
      method: 'PUT',
      body: JSON.stringify({ zona_id: null }),
    });
  });

  it('modificarPedido hace PUT con el body armado', async () => {
    await modificarPedido('P-1/2', { repartoId: 9, nuevoCodigo: 'BIG', fechaReparto: '2026-07-10' }, 77, '2026-07-10');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/pedidos/P-1%2F2/reparto', {
      method: 'PUT',
      body: JSON.stringify({
        repartoId: 9,
        nuevoCodigo: 'BIG',
        fechaReparto: '2026-07-10',
        nuevo_codigo_despacho: 'BIG',
        preparacion_id: 77,
        biblia_fecha: '2026-07-10',
      }),
    });
  });

  it('modificarPedido normaliza nuevoCodigo ausente a null', async () => {
    await modificarPedido('P1', { observacion: 'obs' }, 77, '2026-07-10');
    const body = JSON.parse(requestMock.mock.calls[0][1]!.body as string);
    expect(body.nuevo_codigo_despacho).toBeNull();
  });

  it('impactarEnSigma hace POST con biblia_fecha', async () => {
    await impactarEnSigma('2026-07-10');
    expect(requestMock).toHaveBeenCalledWith('/api/gestor/biblia/sigma/impactar', {
      method: 'POST',
      body: JSON.stringify({ biblia_fecha: '2026-07-10' }),
    });
  });
});

// --- SSE ---

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((msg: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
}

describe('suscriptores SSE', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function lastES(): MockEventSource {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }

  it('subscribeSyncAll abre la URL del stream full (la sesión viaja en cookies, sin token en query)', () => {
    subscribeSyncAll(() => {});
    expect(lastES().url).toBe('/api/gestor/biblia/sync/all/stream');
  });

  it('subscribeSyncHoy abre la URL del stream hoy', () => {
    subscribeSyncHoy(() => {});
    expect(lastES().url).toBe('/api/gestor/biblia/sync/hoy/stream');
  });

  it('entrega los eventos de progreso al callback', () => {
    const onEvent = vi.fn();
    subscribeSyncAll(onEvent);
    const ev: SyncEvent = { type: 'progress', message: 'sincronizando', progress: 40 };
    lastES().emit(ev);
    expect(onEvent).toHaveBeenCalledWith(ev);
    expect(lastES().closed).toBe(false);
  });

  it('cierra la conexión al recibir stage done y aún entrega el evento', () => {
    const onEvent = vi.fn();
    subscribeSyncAll(onEvent);
    lastES().emit({ type: 'progress', message: 'fin', stage: 'done' });
    expect(onEvent).toHaveBeenCalled();
    expect(lastES().closed).toBe(true);
  });

  it('cierra la conexión al recibir type complete', () => {
    subscribeSyncAll(() => {});
    lastES().emit({ type: 'complete', message: 'listo' });
    expect(lastES().closed).toBe(true);
  });

  it('notifica onError y cierra ante un evento de error', () => {
    const onError = vi.fn();
    subscribeSyncAll(() => {}, onError);
    lastES().emit({ type: 'error', message: 'falló', error: 'detalle' });
    expect(onError).toHaveBeenCalledWith('detalle');
    expect(lastES().closed).toBe(true);
  });

  it('usa message como fallback si el evento de error no trae error', () => {
    const onError = vi.fn();
    subscribeSyncAll(() => {}, onError);
    lastES().emit({ type: 'progress', message: 'se rompió', stage: 'error' });
    expect(onError).toHaveBeenCalledWith('se rompió');
  });

  it('notifica onError ante un evento no parseable', () => {
    const onError = vi.fn();
    subscribeSyncAll(() => {}, onError);
    lastES().emit('esto no es JSON{');
    expect(onError).toHaveBeenCalledWith('Error parseando evento SSE');
    expect(lastES().closed).toBe(true);
  });

  it('notifica onError ante error de conexión y cierra', () => {
    const onError = vi.fn();
    subscribeSyncAll(() => {}, onError);
    lastES().onerror?.();
    expect(onError).toHaveBeenCalledWith('Error de conexión SSE');
    expect(lastES().closed).toBe(true);
  });

  it('no notifica error de conexión si ya se completó', () => {
    const onError = vi.fn();
    subscribeSyncAll(() => {}, onError);
    lastES().emit({ type: 'complete', message: 'ok' });
    lastES().onerror?.();
    expect(onError).not.toHaveBeenCalled();
  });

  it('expira por timeout a los 10 minutos si no se completó', () => {
    const onError = vi.fn();
    subscribeSyncAll(() => {}, onError);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(onError).toHaveBeenCalledWith('Conexión SSE expirada');
    expect(lastES().closed).toBe(true);
  });

  it('no expira si ya se había completado', () => {
    const onError = vi.fn();
    subscribeSyncAll(() => {}, onError);
    lastES().emit({ type: 'complete', message: 'ok' });
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(onError).not.toHaveBeenCalled();
  });

  it('la función devuelta cierra la conexión', () => {
    const cleanup = subscribeSyncAll(() => {});
    cleanup();
    expect(lastES().closed).toBe(true);
  });

  it('subscribeSyncEvents notifica solo ante sync-complete', () => {
    const onComplete = vi.fn();
    const unsubscribe = subscribeSyncEvents(onComplete);
    expect(lastES().url).toBe('/api/gestor/biblia/sync/events');

    lastES().emit({ type: 'otro' });
    expect(onComplete).not.toHaveBeenCalled();

    lastES().emit({ type: 'sync-complete' });
    expect(onComplete).toHaveBeenCalledTimes(1);

    lastES().emit('malformado{');
    expect(onComplete).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(lastES().closed).toBe(true);
  });
});
