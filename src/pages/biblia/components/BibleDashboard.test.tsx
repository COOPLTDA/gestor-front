import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BibleDashboard } from './BibleDashboard';
import { useBibliaData } from '../hooks/useBibliaData';
import type { Preparacion, SigmaSyncEstado } from '../types/biblia';

vi.mock('../hooks/useBibliaData', () => ({ useBibliaData: vi.fn() }));

vi.mock('./Filters', () => ({
  Filters: () => <div data-testid="filters" />,
}));
// Mock "rico": expone botones para disparar los callbacks de drag&drop que
// BibleDashboard pasa como props, ya que de otra forma nada los invoca en los tests
// (los divs mockeados triviales dejaban handleDragStart/handleDragEnd/handleReasignar/
// handleDesasignarViaDrop sin cobertura).
vi.mock('./PendingSidebar', () => ({
  PendingSidebar: (props: {
    onDragStart: (p: Preparacion) => void;
    onDragEnd: () => void;
    onDesasignar: (id: number) => void;
  }) => (
    <div data-testid="pending-sidebar">
      <button onClick={() => props.onDragStart({ id: 42, pedidos: [{ codigo_despacho: 'BIG' }, { codigo_despacho: null }] } as unknown as Preparacion)}>
        drag-start-42
      </button>
      <button onClick={props.onDragEnd}>drag-end</button>
      <button onClick={() => props.onDesasignar(1)}>desasignar-via-drop-1</button>
      <button onClick={() => props.onDesasignar(999)}>desasignar-via-drop-999</button>
    </div>
  ),
}));
vi.mock('./ChoferesList', () => ({
  ChoferesList: (props: {
    onReasignar: (...args: unknown[]) => Promise<void>;
    draggedPrep: Preparacion | null;
    draggedCodigos: Set<string> | null;
  }) => (
    <div data-testid="choferes-list">
      <button onClick={() => props.onReasignar(1, 'CH1', 'BIG')}>reasignar</button>
      <span data-testid="dragged-prep-id">{props.draggedPrep?.id ?? 'none'}</span>
      <span data-testid="dragged-codigos">{props.draggedCodigos ? [...props.draggedCodigos].join(',') : 'none'}</span>
    </div>
  ),
}));
vi.mock('./BibliaResumenModal', () => ({
  BibliaResumenModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="resumen-modal">
        <button onClick={onClose}>cerrar-resumen</button>
      </div>
    ) : null,
}));

const useBibliaDataMock = vi.mocked(useBibliaData);

function makePrep(id: number, codigo_envio = `E-${id}`): Preparacion {
  return {
    id,
    tipo: 'Pedidos individuales',
    estado: 'Completada',
    codigo_envio,
    pedidos: [],
    cantidad_pedidos: 0,
    cantidad_clientes: 0,
    importe_total: 0,
    peso: 0,
    volumen: 0,
    peso_text: '0',
    volumen_text: '0',
  };
}

function baseHook(over: Partial<ReturnType<typeof useBibliaData>> = {}): ReturnType<typeof useBibliaData> {
  return {
    choferes: [],
    codigosDespacho: [],
    codigosDespachoByChofer: new Map(),
    preparacionesPorChofer: new Map(),
    preparacionesDisponibles: [],
    ocupadasEnOtraBiblia: new Map(),
    sigmaEstadoByPrepId: new Map<number, SigmaSyncEstado>(),
    pedidoCambiosByPrepId: new Map(),
    asignacionCrossCodeByPrepId: new Map(),
    estados: [],
    estadosSeleccionados: [],
    zonas: [],
    zonasSeleccionadas: [],
    fechaDesde: '2026-07-09',
    fechaHasta: '2026-07-09',
    bibliaFecha: '2026-07-10',
    setFechaDesde: vi.fn(),
    setFechaHasta: vi.fn(),
    setBibliaFecha: vi.fn(),
    toggleZona: vi.fn(),
    setZonasSeleccionadas: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
    recargarPreparaciones: vi.fn(),
    toggleEstado: vi.fn(),
    asignarPreparacion: vi.fn(),
    reasignarPreparacion: vi.fn(),
    desasignarPreparacion: vi.fn(),
    autoAsignarPendientes: vi.fn(),
    impactarEnSigma: vi.fn().mockResolvedValue({ ok: [], fallido: [], error: [], total: 0 }),
    recargarExcepciones: vi.fn(),
    eliminarExcepcion: vi.fn(),
    limpiarBiblia: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useBibliaDataMock.mockReturnValue(baseHook());
});

describe('BibleDashboard — estados generales', () => {
  it('muestra el indicador de carga', () => {
    useBibliaDataMock.mockReturnValue(baseHook({ isLoading: true }));
    render(<BibleDashboard />);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('muestra el error con botón para cerrarlo', () => {
    const clearError = vi.fn();
    useBibliaDataMock.mockReturnValue(baseHook({ error: 'falló todo', clearError }));
    render(<BibleDashboard />);
    expect(screen.getByText('falló todo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(clearError).toHaveBeenCalled();
  });

  it('renderiza sidebar y lista de choferes', () => {
    render(<BibleDashboard />);
    expect(screen.getByTestId('pending-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('choferes-list')).toBeInTheDocument();
  });
});

describe('BibleDashboard — drag & drop', () => {
  it('handleDragStart guarda la prep arrastrada y sus códigos de despacho (descartando los null), handleDragEnd limpia todo', () => {
    render(<BibleDashboard />);
    expect(screen.getByTestId('dragged-prep-id').textContent).toBe('none');

    fireEvent.click(screen.getByText('drag-start-42'));
    expect(screen.getByTestId('dragged-prep-id').textContent).toBe('42');
    // El pedido con codigo_despacho: null se descarta (filter(Boolean)).
    expect(screen.getByTestId('dragged-codigos').textContent).toBe('BIG');

    fireEvent.click(screen.getByText('drag-end'));
    expect(screen.getByTestId('dragged-prep-id').textContent).toBe('none');
    expect(screen.getByTestId('dragged-codigos').textContent).toBe('none');
  });

  it('handleDesasignarViaDrop desasigna solo si la prep está efectivamente asignada a algún chofer', () => {
    const desasignarPreparacion = vi.fn();
    // Dos choferes, cada uno con una prep DISTINTA: distingue .some() de .every()
    // (con .every(), buscar el id=1 en una lista que también tiene el id=2 daría false).
    useBibliaDataMock.mockReturnValue(baseHook({
      preparacionesPorChofer: new Map([['CH1', [makePrep(1)]], ['CH2', [makePrep(2)]]]),
      desasignarPreparacion,
    }));
    render(<BibleDashboard />);
    fireEvent.click(screen.getByText('desasignar-via-drop-1')); // id 1 SÍ está asignado
    expect(desasignarPreparacion).toHaveBeenCalledWith(1);

    desasignarPreparacion.mockClear();
    fireEvent.click(screen.getByText('desasignar-via-drop-999')); // id 999 NO está asignado
    expect(desasignarPreparacion).not.toHaveBeenCalled();
  });

  it('handleReasignar delega en reasignarPreparacion con los mismos argumentos', async () => {
    const reasignarPreparacion = vi.fn().mockResolvedValue(undefined);
    useBibliaDataMock.mockReturnValue(baseHook({ reasignarPreparacion }));
    render(<BibleDashboard />);
    fireEvent.click(screen.getByText('reasignar'));
    await waitFor(() => expect(reasignarPreparacion).toHaveBeenCalledWith(1, 'CH1', 'BIG'));
  });
});

describe('BibleDashboard — botón Impactar en Sigma', () => {
  it('está deshabilitado sin pendientes ni fallidas, con el tooltip correspondiente', () => {
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    expect(btn).toBeDisabled();
    expect(btn.title).toBe('No hay cambios de reparto pendientes de impactar');
  });

  it('el tooltip usa singular con exactamente 1 fallida y ninguna pendiente', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'fallido' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    expect(btn.title).toBe('Reintentar 1 preparación que fallaron');
  });

  it('el tooltip usa plural con 2 fallidas y ninguna pendiente', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'fallido' as SigmaSyncEstado], [2, 'fallido' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2)],
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    expect(btn.title).toBe('Reintentar 2 preparaciónes que fallaron');
  });

  it('el tooltip cuenta pendientes + fallidas juntas cuando hay pendientes', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado], [2, 'fallido' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2)],
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    expect(btn.title).toBe('Impactar 2 preparaciónes en Sigma');
  });

  it('se habilita con pendientes y llama a impactarEnSigma', async () => {
    const impactar = vi.fn().mockResolvedValue({ ok: [1], fallido: [], error: [], total: 1 });
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
      impactarEnSigma: impactar,
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    expect(btn).toBeEnabled();
    expect(btn.title).toBe('Impactar 1 preparación en Sigma');
    fireEvent.click(btn);
    await waitFor(() => expect(impactar).toHaveBeenCalled());
  });

  it('muestra el aviso de error de Sigma cuando el resultado trae error', async () => {
    const impactar = vi.fn().mockResolvedValue({ ok: [], fallido: [], error: [1], total: 1 });
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1, 'ENV-99')],
      impactarEnSigma: impactar,
    }));
    const { container } = render(<BibleDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Impactar en Sigma/ }));
    expect(await screen.findByText(/fallaron al comunicarse con Sigma/)).toBeInTheDocument();
    expect(screen.getAllByText(/ENV-99/).length).toBeGreaterThan(0);
    await waitFor(() => expect(container.textContent).toContain('intentá nuevamente. (ENV-99)'));
  });
});

describe('BibleDashboard — banners de estado Sigma', () => {
  it('avisa preparaciones pendientes de impactar y permite cerrarlo', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado], [2, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2)],
    }));
    const { container } = render(<BibleDashboard />);
    // el plural se arma como "preparación"+"es" → "preparaciónes" (texto real de la UI)
    expect(container.textContent).toContain('2 preparaciónes con cambio de reparto pendiente de impactar en Sigma.');

    const banner = screen.getByText(/pendiente de impactar/).closest('div')!;
    fireEvent.click(banner.querySelector('button')!);
    expect(screen.queryByText(/pendiente de impactar/)).not.toBeInTheDocument();
  });

  it('avisa preparaciones bloqueadas', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'bloqueado' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    render(<BibleDashboard />);
    expect(screen.getByText(/no se puede reflejar en Sigma/)).toBeInTheDocument();
  });

  it('avisa preparaciones fallidas', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'fallido' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    render(<BibleDashboard />);
    expect(screen.getByText(/intentá nuevamente/)).toBeInTheDocument();
  });

  it('avisa preparaciones ok a la espera de la sincronización de Digip', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'ok' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    render(<BibleDashboard />);
    expect(screen.getByText(/actualizado en Sigma/)).toBeInTheDocument();
  });

  it('banners usan plural correctamente con 2+ items (bloqueadas, ok)', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'bloqueado' as SigmaSyncEstado], [2, 'bloqueado' as SigmaSyncEstado], [3, 'ok' as SigmaSyncEstado], [4, 'ok' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2), makePrep(3), makePrep(4)],
    }));
    const { container } = render(<BibleDashboard />);
    expect(container.textContent).toMatch(/2 preparaciónes con cambio de código de despacho que no se puede reflejar/);
    expect(container.textContent).toMatch(/2 preparaciónes con código de despacho actualizado/);
  });

  it('banners usan singular correctamente con 1 solo item (bloqueada)', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'bloqueado' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    const { container } = render(<BibleDashboard />);
    expect(container.textContent).toMatch(/1 preparación con cambio de código de despacho que no se puede reflejar/);
  });

  it('el aviso de error de impacto usa singular con exactamente 1', async () => {
    const impactar = vi.fn().mockResolvedValue({ ok: [], fallido: [], error: [1], total: 1 });
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
      impactarEnSigma: impactar,
    }));
    const { container } = render(<BibleDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Impactar en Sigma/ }));
    await waitFor(() => expect(container.textContent).toMatch(/1 preparación fallaron al comunicarse con Sigma/));
  });

  it('con exactamente 4 (el máximo), no agrega el sufijo "y N más"', () => {
    const estados = new Map<number, SigmaSyncEstado>();
    const preps: Preparacion[] = [];
    for (let i = 1; i <= 4; i++) {
      estados.set(i, 'pendiente');
      preps.push(makePrep(i, `ENV-${i}`));
    }
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: estados,
      preparacionesDisponibles: preps,
    }));
    const { container } = render(<BibleDashboard />);
    expect(container.textContent).toMatch(/ENV-1, ENV-2, ENV-3, ENV-4(?! y)/);
    expect(container.textContent).not.toMatch(/más/);
  });

  it('el aviso de bloqueadas tiene un espacio entre el texto y el paréntesis con la lista', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'bloqueado' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    const { container } = render(<BibleDashboard />);
    expect(container.textContent).toContain('El cambio solo existe en la biblia. (E-1)');
  });

  it('permite cerrar el aviso de bloqueadas y de fallidas', async () => {
    const impactar = vi.fn().mockResolvedValue({ ok: [], fallido: [], error: [1], total: 1 });
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'bloqueado' as SigmaSyncEstado], [2, 'fallido' as SigmaSyncEstado], [3, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2), makePrep(3)],
      impactarEnSigma: impactar,
    }));
    render(<BibleDashboard />);

    const bloqueadoBanner = screen.getByText(/no se puede reflejar en Sigma/).closest('div')!;
    fireEvent.click(bloqueadoBanner.querySelector('button')!);
    expect(screen.queryByText(/no se puede reflejar en Sigma/)).not.toBeInTheDocument();

    const fallidoBanner = screen.getByText(/intentá nuevamente/).closest('div')!;
    fireEvent.click(fallidoBanner.querySelector('button')!);
    expect(screen.queryByText(/intentá nuevamente/)).not.toBeInTheDocument();

    // handleImpactar resetea fallidoDismissed a false: como prepsFallidas sigue teniendo
    // la fallida (el mock del hook es estático), el aviso vuelve a aparecer al re-impactar.
    fireEvent.click(screen.getByRole('button', { name: /Impactar en Sigma/ }));
    expect(await screen.findByText(/intentá nuevamente/)).toBeInTheDocument();

    // Aviso de error de Sigma (post-impactar) también se puede cerrar.
    const errorBanner = await screen.findByText(/fallaron al comunicarse con Sigma/);
    fireEvent.click(errorBanner.closest('div')!.querySelector('button')!);
    expect(screen.queryByText(/fallaron al comunicarse con Sigma/)).not.toBeInTheDocument();
  });

  it('si el aviso de pendientes fue cerrado y luego aparece una NUEVA pendiente, vuelve a mostrarse', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    const { rerender } = render(<BibleDashboard />);
    const banner = screen.getByText(/pendiente de impactar/).closest('div')!;
    fireEvent.click(banner.querySelector('button')!);
    expect(screen.queryByText(/pendiente de impactar/)).not.toBeInTheDocument();

    // Sube el conteo de pendientes (2 en vez de 1): el efecto debe re-mostrar el aviso.
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado], [2, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2)],
    }));
    rerender(<BibleDashboard />);

    expect(screen.getByText(/pendiente de impactar/)).toBeInTheDocument();
  });

  it('si el aviso de bloqueadas fue cerrado y sube el conteo, vuelve a mostrarse', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'bloqueado' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    const { rerender } = render(<BibleDashboard />);
    const banner = screen.getByText(/no se puede reflejar en Sigma/).closest('div')!;
    fireEvent.click(banner.querySelector('button')!);
    expect(screen.queryByText(/no se puede reflejar en Sigma/)).not.toBeInTheDocument();

    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'bloqueado' as SigmaSyncEstado], [2, 'bloqueado' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2)],
    }));
    rerender(<BibleDashboard />);

    expect(screen.getByText(/no se puede reflejar en Sigma/)).toBeInTheDocument();
  });

  it('si no hay error tras impactar (result.error vacío), no muestra el aviso de error de Sigma', async () => {
    const impactar = vi.fn().mockResolvedValue({ ok: [1], fallido: [], error: [], total: 1 });
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
      impactarEnSigma: impactar,
    }));
    render(<BibleDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Impactar en Sigma/ }));
    await waitFor(() => expect(impactar).toHaveBeenCalled());

    expect(screen.queryByText(/fallaron al comunicarse con Sigma/)).not.toBeInTheDocument();
  });

  it('el botón "Impactar en Sigma" muestra estado de carga mientras la promesa está pendiente', async () => {
    let resolveImpactar!: (v: { ok: number[]; fallido: number[]; error: number[]; total: number }) => void;
    const impactar = vi.fn().mockReturnValue(new Promise(res => { resolveImpactar = res; }));
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
      impactarEnSigma: impactar,
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    fireEvent.click(btn);

    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn.textContent).toContain('Impactando…');

    resolveImpactar({ ok: [1], fallido: [], error: [], total: 1 });
    await waitFor(() => expect(btn).not.toBeDisabled());
    expect(btn.textContent).toContain('Impactar en Sigma');
  });

  it('título del botón Impactar: con pendientes Y fallidas juntas, usa "Impactar N" (no "Reintentar")', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado], [2, 'fallido' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2)],
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    expect(btn.title).toBe('Impactar 2 preparaciónes en Sigma');
    expect(btn).toBeEnabled();
  });

  it('título del botón Impactar: usa la SUMA de pendientes+fallidas, no la resta (3 pendientes + 2 fallidas = 5, plural)', () => {
    const estados = new Map<number, SigmaSyncEstado>();
    const preps: Preparacion[] = [];
    for (let i = 1; i <= 3; i++) { estados.set(i, 'pendiente'); preps.push(makePrep(i)); }
    for (let i = 4; i <= 5; i++) { estados.set(i, 'fallido'); preps.push(makePrep(i)); }
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: estados,
      preparacionesDisponibles: preps,
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    // suma=5 (plural "es"); si usara resta (3-2=1) sería singular sin "es".
    expect(btn.title).toBe('Impactar 5 preparaciónes en Sigma');
  });

  it('título del botón Impactar: solo fallidas (sin pendientes) usa "Reintentar N que fallaron"', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'fallido' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    expect(btn.title).toBe('Reintentar 1 preparación que fallaron');
    // Sin pendientes pero CON fallidas: no debe quedar deshabilitado.
    expect(btn).toBeEnabled();
  });

  it('título del botón Impactar: sin pendientes ni fallidas, deshabilitado con mensaje exacto', () => {
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Impactar en Sigma/ });
    expect(btn.title).toBe('No hay cambios de reparto pendientes de impactar');
    expect(btn).toBeDisabled();
  });

  it('el aviso de pendientes (banner) usa singular exacto con 1 sola preparación', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    const { container } = render(<BibleDashboard />);
    expect(container.textContent).toContain('1 preparación con cambio de reparto pendiente de impactar en Sigma.');
    // Hay un espacio literal entre el texto y el paréntesis con la lista de preps.
    expect(container.textContent).toContain('cuando estés listo. (E-1)');
  });

  it('el aviso de fallidas usa singular exacto ("no se pudo impactar", sin "ieron")', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'fallido' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    const { container } = render(<BibleDashboard />);
    expect(container.textContent).toContain('1 preparación no se pudo impactar en Sigma');
    expect(container.textContent).toContain('revisá el estado de los pedidos. (E-1)');
  });

  it('el aviso de fallidas usa plural exacto ("no se pudieron impactar") con 2+', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'fallido' as SigmaSyncEstado], [2, 'fallido' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2)],
    }));
    const { container } = render(<BibleDashboard />);
    expect(container.textContent).toContain('2 preparaciónes no se pudoieron impactar en Sigma');
  });

  it('el aviso de "ok sin sincronizar" usa singular exacto con 1 sola preparación', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'ok' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1)],
    }));
    const { container } = render(<BibleDashboard />);
    expect(container.textContent).toContain('1 preparación con código de despacho actualizado en Sigma');
    expect(container.textContent).toContain('sincronización con Digip. (E-1)');
  });

  it('sin preparaciones "ok sin sincronizar", no muestra ese aviso', () => {
    render(<BibleDashboard />);
    expect(screen.queryByText(/código de despacho actualizado en Sigma/)).not.toBeInTheDocument();
  });

  it('el aviso de error de impacto usa plural exacto con 2+', async () => {
    const impactar = vi.fn().mockResolvedValue({ ok: [], fallido: [], error: [1, 2], total: 2 });
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado], [2, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1), makePrep(2)],
      impactarEnSigma: impactar,
    }));
    const { container } = render(<BibleDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Impactar en Sigma/ }));
    await waitFor(() => expect(container.textContent).toContain('2 preparaciónes fallaron al comunicarse con Sigma'));
  });

  it('recalcula la etiqueta cuando cambia preparacionesDisponibles (useMemo/useCallback no quedan stale)', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1, 'ENV-VIEJO')],
    }));
    const { rerender } = render(<BibleDashboard />);
    expect(screen.getByText(/ENV-VIEJO/)).toBeInTheDocument();

    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[1, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [makePrep(1, 'ENV-NUEVO')],
    }));
    rerender(<BibleDashboard />);

    expect(screen.getByText(/ENV-NUEVO/)).toBeInTheDocument();
    expect(screen.queryByText(/ENV-VIEJO/)).not.toBeInTheDocument();
  });

  it('usa un id sin código de envío conocido como etiqueta ("#id")', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: new Map([[777, 'pendiente' as SigmaSyncEstado]]),
      preparacionesDisponibles: [], // 777 no está en preparacionById -> cae al fallback "#id"
    }));
    render(<BibleDashboard />);
    expect(screen.getByText(/#777/)).toBeInTheDocument();
  });

  it('usa el código de envío como etiqueta y resume la lista larga', () => {
    const estados = new Map<number, SigmaSyncEstado>();
    const preps: Preparacion[] = [];
    for (let i = 1; i <= 6; i++) {
      estados.set(i, 'pendiente');
      preps.push(makePrep(i, `ENV-${i}`));
    }
    useBibliaDataMock.mockReturnValue(baseHook({
      sigmaEstadoByPrepId: estados,
      preparacionesDisponibles: preps,
    }));
    render(<BibleDashboard />);
    expect(screen.getByText(/ENV-1, ENV-2, ENV-3, ENV-4 y 2 más/)).toBeInTheDocument();
  });
});

describe('BibleDashboard — resumen y limpiar', () => {
  it('el modal de resumen NO está abierto por defecto', () => {
    render(<BibleDashboard />);
    expect(screen.queryByTestId('resumen-modal')).not.toBeInTheDocument();
  });

  it('la confirmación de "Limpiar biblia" NO está abierta por defecto', () => {
    render(<BibleDashboard />);
    expect(screen.queryByText(/¿Borrar/)).not.toBeInTheDocument();
  });

  it('el botón de resumen se habilita con asignaciones y abre el modal', () => {
    useBibliaDataMock.mockReturnValue(baseHook({
      preparacionesPorChofer: new Map([['CH1', [makePrep(1)]]]),
    }));
    render(<BibleDashboard />);
    const btn = screen.getByRole('button', { name: /Resumen y mapa/ });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(screen.getByTestId('resumen-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('cerrar-resumen'));
    expect(screen.queryByTestId('resumen-modal')).not.toBeInTheDocument();
  });

  it('el botón de resumen está deshabilitado sin asignaciones', () => {
    render(<BibleDashboard />);
    expect(screen.getByRole('button', { name: /Resumen y mapa/ })).toBeDisabled();
  });

  it('Limpiar biblia pide confirmación y llama a limpiarBiblia al confirmar', async () => {
    const limpiar = vi.fn().mockResolvedValue(undefined);
    useBibliaDataMock.mockReturnValue(baseHook({ limpiarBiblia: limpiar }));
    render(<BibleDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Limpiar biblia/ }));
    expect(screen.getByText(/¿Borrar/)).toBeInTheDocument();
    // Formatea con día y mes en letras ("10 de julio"), con un espacio antes.
    expect(document.body.textContent).toContain('la biblia del 10 de julio?');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todo' }));
    await waitFor(() => expect(limpiar).toHaveBeenCalled());
  });

  it('Cancelar cierra la confirmación sin limpiar', async () => {
    const limpiar = vi.fn();
    useBibliaDataMock.mockReturnValue(baseHook({ limpiarBiblia: limpiar }));
    render(<BibleDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Limpiar biblia/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText(/¿Borrar/)).not.toBeInTheDocument());
    expect(limpiar).not.toHaveBeenCalled();
  });
});
