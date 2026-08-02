import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantenimientoPage } from './MantenimientoPage';
import { useMantenimiento } from './hooks/useMantenimiento';

vi.mock('./hooks/useMantenimiento', () => ({
  useMantenimiento: vi.fn(),
}));

vi.mock('@/services/bibliaApi', () => ({
  searchChoferes: vi.fn().mockResolvedValue([]),
  searchCodigosDespacho: vi.fn().mockResolvedValue([]),
}));

const useMantenimientoMock = vi.mocked(useMantenimiento);

function baseHook(over: Partial<ReturnType<typeof useMantenimiento>> = {}): ReturnType<typeof useMantenimiento> {
  return {
    choferes: [
      { codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: ['01'] },
      { codigo: 'CH2', descripcion: 'García', desactivado: 0, rutas: [] },
    ],
    codigosDespacho: [
      { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null, choferes: ['CH1'] },
      { id: '02', nombre: 'V. OBRERA', desactivado: 0, direccion: null, choferes: [] },
    ],
    zonas: [{ id: 1, nombre: 'LOMAS', desactivado: 0 }],
    loadingChoferes: false,
    loadingRepartos: false,
    loadingZonas: false,
    error: null,
    guardarChofer: vi.fn(),
    toggleChofer: vi.fn(),
    guardarCodigoDespacho: vi.fn(),
    toggleCodigoDespacho: vi.fn(),
    asignar: vi.fn(),
    desasignar: vi.fn(),
    guardarZona: vi.fn(),
    toggleZona: vi.fn(),
    asignarCodigoDespacho: vi.fn(),
    desasignarCodigoDespacho: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useMantenimientoMock.mockReturnValue(baseHook());
});

function renderPage() {
  return render(<MemoryRouter><MantenimientoPage /></MemoryRouter>);
}

describe('MantenimientoPage', () => {
  it('muestra el título y los contadores de cada pestaña', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Mantenimiento' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Choferes/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /Códigos de despacho/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /Zonas/ })).toHaveTextContent('1');
  });

  it('muestra el banner de error del hook', () => {
    useMantenimientoMock.mockReturnValue(baseHook({ error: 'algo falló' }));
    renderPage();
    expect(screen.getByText('algo falló')).toBeInTheDocument();
  });

  it('sin error, no muestra ningún banner de error', () => {
    useMantenimientoMock.mockReturnValue(baseHook({ error: null }));
    renderPage();
    expect(screen.queryByText('algo falló')).not.toBeInTheDocument();
  });

  it('recalcula los avisos cuando cambian choferes/codigosDespacho (no queda stale)', () => {
    useMantenimientoMock.mockReturnValue(baseHook({
      choferes: [{ codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: [] }],
    }));
    const { rerender } = renderPage();
    expect(screen.getByText(/1 chofer sin ningún código/)).toBeInTheDocument();

    useMantenimientoMock.mockReturnValue(baseHook({
      choferes: [{ codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: ['01'] }],
    }));
    rerender(<MemoryRouter><MantenimientoPage /></MemoryRouter>);

    expect(screen.queryByText(/chofer sin ningún código/)).not.toBeInTheDocument();
  });

  it('advierte los choferes activos sin códigos de despacho y permite cerrarla', () => {
    const { container } = renderPage();
    const aviso = screen.getByText(/1 chofer sin ningún código de despacho asignado/);
    expect(aviso).toBeInTheDocument();
    const banner = aviso.closest('div')!;
    expect(banner.textContent).toContain('García');
    // Texto exacto: singular "chofer" (no "choferes") y espacio antes de la lista.
    expect(container.textContent).toContain('1 chofer sin ningún código de despacho asignado: García');

    fireEvent.click(banner.querySelector('button')!);
    expect(screen.queryByText(/chofer sin ningún código/)).not.toBeInTheDocument();
  });

  it('con 2+ choferes sin código de despacho, usa plural y une los nombres con ", "', () => {
    useMantenimientoMock.mockReturnValue(baseHook({
      choferes: [
        { codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: [] },
        { codigo: 'CH2', descripcion: 'García', desactivado: 0, rutas: [] },
      ],
    }));
    const { container } = renderPage();
    expect(container.textContent).toContain('2 choferes sin ningún código de despacho asignado: López, García');
  });

  it('un chofer sin descripción usa su código en la lista', () => {
    useMantenimientoMock.mockReturnValue(baseHook({
      choferes: [{ codigo: 'CH9', descripcion: null, desactivado: 0, rutas: [] }],
    }));
    const { container } = renderPage();
    expect(container.textContent).toContain('1 chofer sin ningún código de despacho asignado: CH9');
  });

  it('advierte los códigos activos sin choferes con plural correcto', () => {
    useMantenimientoMock.mockReturnValue(baseHook({
      codigosDespacho: [
        { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null, choferes: [] },
        { id: '02', nombre: 'V. OBRERA', desactivado: 0, direccion: null, choferes: [] },
      ],
    }));
    const { container } = renderPage();
    expect(screen.getByText(/2 códigos de despacho sin ningún chofer asignado/)).toBeInTheDocument();
    expect(container.textContent).toContain('2 códigos de despacho sin ningún chofer asignado: LANUS 2, V. OBRERA');
  });

  it('un código de despacho sin nombre usa su id en la lista', () => {
    useMantenimientoMock.mockReturnValue(baseHook({
      codigosDespacho: [{ id: '77', nombre: null, desactivado: 0, direccion: null, choferes: [] }],
    }));
    const { container } = renderPage();
    expect(container.textContent).toContain('1 código de despacho sin ningún chofer asignado: 77');
  });

  it('permite cerrar el aviso de códigos de despacho sin chofer', () => {
    useMantenimientoMock.mockReturnValue(baseHook({
      codigosDespacho: [{ id: '02', nombre: 'V. OBRERA', desactivado: 0, direccion: null, choferes: [] }],
    }));
    renderPage();
    const aviso = screen.getByText(/1 código de despacho sin ningún chofer asignado/);
    const banner = aviso.closest('div')!;

    fireEvent.click(banner.querySelector('button')!);

    expect(screen.queryByText(/sin ningún chofer/)).not.toBeInTheDocument();
  });

  it('no advierte por choferes o códigos desactivados', () => {
    useMantenimientoMock.mockReturnValue(baseHook({
      choferes: [{ codigo: 'CH2', descripcion: 'García', desactivado: 1, rutas: [] }],
      codigosDespacho: [{ id: '02', nombre: 'V. OBRERA', desactivado: 1, direccion: null, choferes: [] }],
    }));
    renderPage();
    expect(screen.queryByText(/sin ningún código de despacho/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin ningún chofer/)).not.toBeInTheDocument();
  });

  it('arranca en la pestaña de choferes', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Buscar por código o nombre…')).toBeInTheDocument();
  });
});
