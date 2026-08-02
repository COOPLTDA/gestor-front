import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BibliaPage } from './BibliaPage';
import {
  subscribeSyncAll,
  subscribeSyncHoy,
  subscribeSyncEvents,
  fetchSyncStatus,
  type SyncEvent,
} from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  subscribeSyncAll: vi.fn(),
  subscribeSyncHoy: vi.fn(),
  subscribeSyncEvents: vi.fn(),
  fetchSyncStatus: vi.fn(),
}));

vi.mock('./components/BibleDashboard', () => ({
  BibleDashboard: () => <div data-testid="dashboard" />,
}));

const mockedSyncAll = vi.mocked(subscribeSyncAll);
const mockedSyncHoy = vi.mocked(subscribeSyncHoy);
const mockedSyncEvents = vi.mocked(subscribeSyncEvents);
const mockedStatus = vi.mocked(fetchSyncStatus);

let emitirEvento: (e: SyncEvent) => void = () => {};
let emitirError: (err: string) => void = () => {};
let subscriptionCleanup: ReturnType<typeof vi.fn> = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '0:0|0:0|0', pedidosSnapshot: {} });
  mockedSyncEvents.mockReturnValue(() => {});
  const capture = (onEvent: (e: SyncEvent) => void, onError?: (err: string) => void) => {
    emitirEvento = onEvent;
    emitirError = onError ?? (() => {});
    subscriptionCleanup = vi.fn();
    return subscriptionCleanup;
  };
  mockedSyncAll.mockImplementation(capture);
  mockedSyncHoy.mockImplementation(capture);
});

function renderPage() {
  return render(<MemoryRouter><BibliaPage /></MemoryRouter>);
}

describe('BibliaPage — encabezado', () => {
  it('muestra el título y el dashboard', () => {
    renderPage();
    expect(screen.getByText('Biblia Digital')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('consulta el estado de sync al montar y se suscribe a los eventos', async () => {
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalled());
    expect(mockedSyncEvents).toHaveBeenCalled();
  });

  it('sin lastSync (null), no muestra "Última actualización"', async () => {
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalled());
    expect(screen.queryByText(/Última actualización:/)).not.toBeInTheDocument();
  });

  it('un evento SSE dispara una nueva consulta de estado de sync', async () => {
    let onSseEvent: () => void = () => {};
    mockedSyncEvents.mockImplementation((cb: () => void) => { onSseEvent = cb; return () => {}; });

    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    onSseEvent();

    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(2));
  });

  it('muestra la última actualización que reporta el backend', async () => {
    mockedStatus.mockResolvedValue({
      lastSync: '2026-07-10T08:30:00',
      dataVersion: '1:1|1:1|0',
      pedidosSnapshot: {},
    });
    renderPage();
    expect(await screen.findByText(/Última actualización:/)).toBeInTheDocument();
    expect(localStorage.getItem('biblia_last_sync')).toBeTruthy();
  });

  it('formatea la fecha/hora con día y mes de 2 dígitos (con cero a la izquierda)', async () => {
    mockedStatus.mockResolvedValue({
      lastSync: '2026-01-05T03:07:00',
      dataVersion: '1:1|1:1|0',
      pedidosSnapshot: {},
    });
    renderPage();
    // { hour: '2-digit', minute: '2-digit' } da "03:07 a. m." (sin segundos); sin esas
    // opciones, Intl.DateTimeFormat incluye segundos (ej. "03:07:00"), así que este texto
    // exacto distingue tener las opciones de no tenerlas.
    expect(await screen.findByText('Última actualización: 5/1 03:07 a. m.')).toBeInTheDocument();
  });
});

describe('BibliaPage — sincronización manual', () => {
  it('el botón Hoy inicia el sync de hoy y muestra el progreso', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    expect(mockedSyncHoy).toHaveBeenCalled();
    expect(screen.getByText(/Iniciando/)).toBeInTheDocument();

    emitirEvento({ type: 'progress', message: 'procesando', stage: 'preparaciones', current: 5, total: 10 });
    // Texto exacto: "Preparaciones " lleva un espacio antes de "5/10" (stageLabel && `${stageLabel} `).
    expect(await screen.findByText('[Hoy] Preparaciones 5/10')).toBeInTheDocument();

    // La barra de progreso usa división (current/total), no multiplicación: 5/10 = 50%.
    const barra = document.querySelector('.bg-white.rounded-full') as HTMLElement;
    expect(barra.style.width).toBe('50%');
  });

  it('sin total (progreso indeterminado), muestra sync.message en vez de una fracción', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));

    emitirEvento({ type: 'progress', message: 'Consultando WMS...', stage: 'preparaciones', current: 0, total: 0 });

    // Sin total>0 no debe haber barra de progreso, y el texto debe ser el mensaje (no
    // "prev.message" stale: distingue ?? de && cuando e.message es truthy).
    expect(await screen.findByText(/Consultando WMS\.\.\./)).toBeInTheDocument();
    expect(document.querySelector('.bg-white\\/20.rounded-full.overflow-hidden')).not.toBeInTheDocument();
  });

  it('si el componente se desmonta antes de que llegue el evento "done", no escribe localStorage', async () => {
    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    localStorage.removeItem('biblia_last_sync');

    unmount();
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(localStorage.getItem('biblia_last_sync')).toBeNull();
  });

  it('el botón Sincronizar todo usa el stream completo', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar todo/ }));
    expect(mockedSyncAll).toHaveBeenCalled();
  });

  it('en modo "todo" (Sincronizar todo), el prefijo es "[Todo]" y el stage "pedidos" muestra "Pedidos"', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar todo/ }));

    emitirEvento({ type: 'progress', message: 'procesando', stage: 'pedidos', current: 3, total: 9 });

    expect(await screen.findByText(/\[Todo\]\s*Pedidos\s*3\/9/)).toBeInTheDocument();
  });

  it('un stage que no es "preparaciones" ni "pedidos" no muestra ninguna etiqueta de stage', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));

    emitirEvento({ type: 'progress', message: 'procesando', stage: 'otra-cosa', current: 1, total: 2 });

    // El texto queda "[Hoy] 1/2" sin ninguna palabra de stage antepuesta.
    expect(await screen.findByText(/^\[Hoy\]\s*1\/2$/)).toBeInTheDocument();
  });

  it('reintentar tras un error en "Sincronizar todo" reinicia con subscribeSyncAll (no Hoy)', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar todo/ }));
    emitirError('falló todo');
    expect(await screen.findByText('falló todo')).toBeInTheDocument();

    mockedSyncAll.mockClear();
    mockedSyncHoy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(mockedSyncAll).toHaveBeenCalled();
    expect(mockedSyncHoy).not.toHaveBeenCalled();
  });

  it('mientras hay un warning activo pero sync.active sigue true, no se muestra el warning', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'ojo con esto', stage: 'warning' });

    // El sync sigue activo (no llegó 'done'): el warning no debe renderizarse todavía.
    expect(screen.queryByText('ojo con esto')).not.toBeInTheDocument();
  });

  it('si hay warning Y error simultáneos, se muestra el error pero no el warning', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'un warning', stage: 'warning' });
    emitirError('un error');

    expect(await screen.findByText('un error')).toBeInTheDocument();
    expect(screen.queryByText('un warning')).not.toBeInTheDocument();
  });

  it('mientras el sync está activo, no se muestra "Última actualización" aunque ya hubiera una', async () => {
    mockedStatus.mockResolvedValue({ lastSync: '2026-07-10T08:30:00', dataVersion: '1:1|1:1|0', pedidosSnapshot: {} });
    renderPage();
    await screen.findByText(/Última actualización:/);

    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));

    expect(screen.queryByText(/Última actualización:/)).not.toBeInTheDocument();
  });

  it('mientras el sync está activo, no se muestran los botones Hoy/Sincronizar todo', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));

    expect(screen.queryByRole('button', { name: /Sincronizar todo/ })).not.toBeInTheDocument();
  });

  it('mientras hay un error, no se muestran los botones Hoy/Sincronizar todo (solo Reintentar)', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirError('roto');
    await screen.findByText('roto');

    expect(screen.queryByRole('button', { name: /Sincronizar todo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Hoy$/ })).not.toBeInTheDocument();
  });

  it('al terminar guarda la marca de tiempo y vuelve a idle', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });
    expect(await screen.findByText(/Última actualización:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sincronizar todo/ })).toBeInTheDocument();
    expect(localStorage.getItem('biblia_last_sync')).toBeTruthy();
  });

  it('muestra el error de sync con botón de reintento', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirError('SSE cortado');
    expect(await screen.findByText('SSE cortado')).toBeInTheDocument();

    mockedSyncHoy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockedSyncHoy).toHaveBeenCalled();
  });

  it('al recibir un error, sync.active pasa a false (deja de mostrarse "Iniciando..."/el spinner)', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    expect(screen.getByText(/Iniciando/)).toBeInTheDocument();

    emitirError('SSE cortado');
    await screen.findByText('SSE cortado');

    expect(screen.queryByText(/Iniciando/)).not.toBeInTheDocument();
  });

  it('si el componente se desmonta antes de que llegue un error de la suscripción, no lo muestra', async () => {
    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    unmount();

    expect(() => emitirError('llega tarde')).not.toThrow();
  });

  it('muestra el warning cuando el sync termina con advertencias', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'Sigma no respondió', stage: 'warning' });
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });
    expect(await screen.findByText('Sigma no respondió')).toBeInTheDocument();
  });

  it('al desmontar, llama a la función de limpieza de la suscripción de sync activa', async () => {
    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    expect(subscriptionCleanup).not.toHaveBeenCalled();

    unmount();

    expect(subscriptionCleanup).toHaveBeenCalled();
  });

  it('si el componente se desmonta antes de que resuelva fetchSyncStatus, ignora la respuesta tardía (no escribe localStorage)', async () => {
    let resolveStatus!: (v: { lastSync: string | null; dataVersion: string; pedidosSnapshot: Record<string, number> }) => void;
    mockedStatus.mockReturnValue(new Promise(res => { resolveStatus = res; }));
    localStorage.removeItem('biblia_last_sync');

    const { unmount } = renderPage();
    unmount();
    resolveStatus({ lastSync: '2026-07-10T08:30:00', dataVersion: '1:1|1:1|0', pedidosSnapshot: {} });
    await Promise.resolve();
    await Promise.resolve();

    // El guard de isMountedRef debe evitar el localStorage.setItem/setSync post-unmount.
    expect(localStorage.getItem('biblia_last_sync')).toBeNull();
  });

  it('lee ultimaActualizacion inicial desde localStorage', async () => {
    localStorage.setItem('biblia_last_sync', '09/07 10:00');
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '0:0|0:0|0', pedidosSnapshot: {} });
    renderPage();
    expect(await screen.findByText(/Última actualización: 09\/07 10:00/)).toBeInTheDocument();
  });

  it('re-consulta el estado de sync cuando la pestaña vuelve a estar visible', async () => {
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(2));
  });

  it('no re-consulta si la pestaña pasa a oculta', async () => {
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Le damos una vuelta de microtasks; no debería haber una segunda llamada.
    await Promise.resolve();
    expect(mockedStatus).toHaveBeenCalledTimes(1);
  });

  it('el intervalo de fallback re-consulta el estado si la pestaña está visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      renderPage();
      await vi.waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

      vi.advanceTimersByTime(10 * 60 * 1000);
      await vi.waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it('al desmontar, limpia el listener de visibilitychange y el intervalo (no sigue re-consultando)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { unmount } = renderPage();
      await vi.waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

      unmount();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(10 * 60 * 1000);
      await Promise.resolve();

      expect(mockedStatus).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('BibliaPage — datos nuevos disponibles', () => {
  it('avisa cuando cambió la dataVersion y recarga el dashboard', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: { P1: 1 } });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    // Segunda consulta con más preparaciones y pedidos
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '12:5|21:3|2', pedidosSnapshot: { P1: 1 } });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    // el plural se arma como "preparación"+"es nuevas" → "preparaciónes nuevas" (texto real)
    expect(await screen.findByText(/2 preparación.*nuevas/)).toBeInTheDocument();
    expect(screen.getByText(/1 pedido nuevo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(screen.queryByText(/preparaciones nuevas/)).not.toBeInTheDocument();
  });

  it('describe cambios de estado nombrando los pedidos', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: { P1: 1, P2: 2 } });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:4|2', pedidosSnapshot: { P1: 1, P2: 3 } });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/cambio de estado en pedido: P2/)).toBeInTheDocument();
  });

  it('reporta pendientes de Sigma que ya no lo están', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|4', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|1', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/3 pedidos menos pendientes en Sigma/)).toBeInTheDocument();
  });
});

describe('BibliaPage — descripción de cambios (texto exacto, sin partes espúreas)', () => {
  it('sin ningún cambio real, usa el mensaje genérico (no "Sincronización detectó: .")', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: { P1: 1 } });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    // Misma dataVersion (nada cambió) pero forzamos que el efecto de detección corra de nuevo.
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '11:5|20:3|2', pedidosSnapshot: { P1: 1 } });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });
    await screen.findByText(/1 preparación nueva/);

    // Limpiamos el aviso actual con "Recargar".
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(screen.queryByText(/Sincronización detectó/)).not.toBeInTheDocument();

    // Ahora sí, sin cambios: dataVersion idéntica a la última vista.
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '11:5|20:3|2', pedidosSnapshot: { P1: 1 } });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    // No debería aparecer ningún aviso nuevo (dataVersion sin cambios: el if de arriba no dispara).
    await Promise.resolve();
    expect(screen.queryByText(/Sincronización detectó/)).not.toBeInTheDocument();
  });

  it('dataVersion parseable pero con los mismos valores numéricos: usa el mensaje genérico', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    // String distinto (cero a la izquierda) pero mismos valores parseados: partes.length === 0.
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '010:5|20:3|2', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText('La sincronización detectó cambios.')).toBeInTheDocument();
  });

  it('solo preparaciones nuevas: el texto exacto no incluye pedidos/pendientes', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '12:5|20:3|2', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText('Sincronización detectó: 2 preparaciónes nuevas.')).toBeInTheDocument();
  });

  it('solo pedidos nuevos: el texto exacto no incluye preparaciones', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|23:3|2', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText('Sincronización detectó: 3 pedidos nuevos.')).toBeInTheDocument();
  });

  it('solo pendientes nuevos en Sigma: el texto exacto no incluye otras partes', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|5', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText('Sincronización detectó: 3 pendientes nuevos en Sigma.')).toBeInTheDocument();
  });

  it('solo menos pendientes en Sigma: el texto exacto no incluye otras partes', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|5', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText('Sincronización detectó: 3 pedidos menos pendientes en Sigma.')).toBeInTheDocument();
  });

  it('cambio de sumEstado con pedidos identificados: el texto exacto une prefijo y lista correctamente', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: { P1: 1 } });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:4|2', pedidosSnapshot: { P1: 2 } });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText('Sincronización detectó: cambio de estado en pedido: P1.')).toBeInTheDocument();
  });
});

describe('BibliaPage — descripción de cambios (bordes)', () => {
  it('usa el mensaje genérico si la dataVersion no es parseable', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: 'basura-total', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText('La sincronización detectó cambios.')).toBeInTheDocument();
  });

  it('usa singular para una preparación nueva', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '11:5|20:3|2', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/1 preparación nueva/)).toBeInTheDocument();
  });

  it('avisa cambios de estado genéricos si no puede identificar los pedidos', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: { P1: 1 } });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    // cambia sumEstado pero el snapshot por pedido es idéntico
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:4|2', pedidosSnapshot: { P1: 1 } });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/cambios en estados de pedidos/)).toBeInTheDocument();
  });

  it('avisa pendientes nuevos en Sigma', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|5', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/3 pendientes nuevos en Sigma/)).toBeInTheDocument();
  });

  it('usa singular para 1 pendiente nuevo en Sigma', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|3', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/1 pendiente nuevo en Sigma/)).toBeInTheDocument();
  });

  it('usa singular para 1 pedido menos pendiente en Sigma', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|1', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/1 pedido menos pendiente en Sigma/)).toBeInTheDocument();
  });

  it('varios cambios simultáneos se unen con " · "', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '11:5|21:3|2', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/1 preparación nueva · 1 pedido nuevo/)).toBeInTheDocument();
  });

  it('usa plural para varios pedidos nuevos', async () => {
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: {} });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|23:3|2', pedidosSnapshot: {} });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/3 pedidos nuevos/)).toBeInTheDocument();
  });

  it('lista exactamente 6 pedidos con cambio de estado sin agregar el resumen "y N más"', async () => {
    const oldSnap: Record<string, number> = {};
    const newSnap: Record<string, number> = {};
    for (let i = 1; i <= 6; i++) { oldSnap[`P${i}`] = 1; newSnap[`P${i}`] = 2; }
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: oldSnap });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:9|2', pedidosSnapshot: newSnap });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    const texto = await screen.findByText(/cambio de estado en pedidos: P1, P2, P3, P4, P5, P6\./);
    expect(texto).toBeInTheDocument();
  });

  it('lista hasta 6 pedidos con cambio de estado y resume el resto', async () => {
    const oldSnap: Record<string, number> = {};
    const newSnap: Record<string, number> = {};
    for (let i = 1; i <= 8; i++) { oldSnap[`P${i}`] = 1; newSnap[`P${i}`] = 2; }
    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:3|2', pedidosSnapshot: oldSnap });
    renderPage();
    await waitFor(() => expect(mockedStatus).toHaveBeenCalledTimes(1));

    mockedStatus.mockResolvedValue({ lastSync: null, dataVersion: '10:5|20:9|2', pedidosSnapshot: newSnap });
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    emitirEvento({ type: 'progress', message: 'fin', stage: 'done' });

    expect(await screen.findByText(/P1, P2, P3, P4, P5, P6 y 2 más/)).toBeInTheDocument();
  });
});
