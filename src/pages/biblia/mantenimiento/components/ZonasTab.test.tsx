import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZonasTab } from './ZonasTab';
import type { ZonaAdmin, CodigoDespachoAdmin } from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  searchCodigosDespacho: vi.fn().mockResolvedValue([]),
}));

const ZONAS: ZonaAdmin[] = [
  { id: 1, nombre: 'LOMAS', desactivado: 0, repartos: ['01'] },
  { id: 2, nombre: 'SUR', desactivado: 1, repartos: [] },
];

const CODIGOS: CodigoDespachoAdmin[] = [
  { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null },
];

function renderTab(over: Partial<Parameters<typeof ZonasTab>[0]> = {}) {
  const props = {
    zonas: ZONAS,
    codigosDespacho: CODIGOS,
    loading: false,
    onGuardar: vi.fn(),
    onToggle: vi.fn(),
    onAsignar: vi.fn(),
    onDesasignar: vi.fn(),
    ...over,
  };
  render(<ZonasTab {...props} />);
  return props;
}

beforeEach(() => vi.clearAllMocks());

describe('ZonasTab', () => {
  it('lista las zonas con sus repartos y estado', () => {
    renderTab();
    expect(screen.getByText('LOMAS')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('Inactiva')).toBeInTheDocument();
  });

  it('filtra por nombre', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText('Buscar por código o nombre…'), {
      target: { value: 'sur' },
    });
    expect(screen.getByText('SUR')).toBeInTheDocument();
    expect(screen.queryByText('LOMAS')).not.toBeInTheDocument();
  });

  it('muestra Cargando… mientras carga', () => {
    renderTab({ loading: true });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('el botón "+ Nueva" abre el modal de alta', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva' }));
    expect(screen.getByText('Nueva zona')).toBeInTheDocument();
  });

  it('el lápiz abre el modal de edición con la zona', () => {
    renderTab();
    fireEvent.click(screen.getAllByTitle('Editar')[0]);
    expect(screen.getByText('Editar zona')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LOMAS')).toBeInTheDocument();
  });

  it('cerrar el modal (Cancelar) lo oculta', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva' }));
    expect(screen.getByText('Nueva zona')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Nueva zona')).not.toBeInTheDocument();
  });

  it('onToggle recibe id numérico y estado actual', () => {
    const { onToggle } = renderTab();
    fireEvent.click(screen.getByTitle('Desactivar'));
    expect(onToggle).toHaveBeenCalledWith(1, 0);
    fireEvent.click(screen.getByTitle('Activar'));
    expect(onToggle).toHaveBeenCalledWith(2, 1);
  });

  it('sin resultados con la búsqueda muestra "Sin resultados"', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText('Buscar por código o nombre…'), {
      target: { value: 'zzz-no-existe' },
    });
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('el reparto muestra su nombre real como tooltip (no el id)', () => {
    renderTab();
    expect(screen.getByText('01')).toHaveAttribute('title', 'LANUS 2');
  });

  it('un código de despacho sin nombre propio usa su id como tooltip ("??" r.nombre)', () => {
    renderTab({
      zonas: [{ id: 3, nombre: 'NORTE', desactivado: 0, repartos: ['99'] }],
      codigosDespacho: [{ id: '99', nombre: null, desactivado: 0, direccion: null }],
    });
    expect(screen.getByText('99')).toHaveAttribute('title', '99');
  });

  it('una zona sin repartos muestra el guión "—"', () => {
    renderTab();
    // SUR (id 2) no tiene repartos
    const filaSur = screen.getByText('SUR').closest('tr')!;
    expect(filaSur.textContent).toContain('—');
  });

  it('las filas alternan color de fondo (par/impar, no i*2===0)', () => {
    renderTab({
      zonas: [
        { id: 1, nombre: 'LOMAS', desactivado: 0, repartos: [] },
        { id: 2, nombre: 'SUR', desactivado: 0, repartos: [] },
        { id: 3, nombre: 'NORTE', desactivado: 0, repartos: [] },
      ],
    });
    const filas = screen.getAllByRole('row').slice(1); // sin el header
    expect(filas[0].className).not.toContain('bg-slate-50/50'); // i=0
    expect(filas[1].className).toContain('bg-slate-50/50');     // i=1
    // i=2: par (i%2===0 → sin bg), pero i*2=4≠0 (con el mutante de * sí tendría bg) — distingue.
    expect(filas[2].className).not.toContain('bg-slate-50/50');
  });

  it('una zona desactivada tiene la clase de opacidad en la fila', () => {
    renderTab();
    const filaSur = screen.getByText('SUR').closest('tr')!; // SUR está desactivada
    expect(filaSur.className).toContain('opacity-50');
    const filaLomas = screen.getByText('LOMAS').closest('tr')!;
    expect(filaLomas.className).not.toContain('opacity-50');
  });

  it('el botón de power usa colores distintos según el estado', () => {
    renderTab();
    const btnActivar = screen.getByTitle('Activar'); // SUR (desactivada)
    expect(btnActivar.className).toContain('text-emerald-600');
    const btnDesactivar = screen.getByTitle('Desactivar'); // LOMAS (activa)
    expect(btnDesactivar.className).toContain('text-red-400');
  });

  it('recalcula el mapa de repartos cuando cambia codigosDespacho', () => {
    const { rerender } = render(<ZonasTab
      zonas={ZONAS}
      codigosDespacho={CODIGOS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);
    expect(screen.getByText('01')).toHaveAttribute('title', 'LANUS 2');

    rerender(<ZonasTab
      zonas={ZONAS}
      codigosDespacho={[{ id: '01', nombre: 'LANUS 2 RENOMBRADA', desactivado: 0, direccion: null }]}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);

    expect(screen.getByText('01')).toHaveAttribute('title', 'LANUS 2 RENOMBRADA');
  });

  it('al editar la SEGUNDA zona, usa la versión ACTUALIZADA de esa zona (no la primera del array)', () => {
    const zonasIniciales = [
      { id: 1, nombre: 'LOMAS', desactivado: 0, repartos: [] },
      { id: 2, nombre: 'SUR VIEJO', desactivado: 0, repartos: [] },
    ];
    const { rerender } = render(<ZonasTab
      zonas={zonasIniciales}
      codigosDespacho={CODIGOS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);
    fireEvent.click(screen.getAllByTitle('Editar')[1]); // edita SUR, no LOMAS
    expect(screen.getByDisplayValue('SUR VIEJO')).toBeInTheDocument();

    // SUR cambió de nombre "por afuera" (ej. otro usuario) mientras el modal seguía abierto.
    // Si el find() se rompe (siempre devuelve la primera zona), esto mostraría "LOMAS".
    rerender(<ZonasTab
      zonas={[
        { id: 1, nombre: 'LOMAS', desactivado: 0, repartos: [] },
        { id: 2, nombre: 'SUR NUEVO', desactivado: 0, repartos: [] },
      ]}
      codigosDespacho={CODIGOS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);

    expect(screen.getByDisplayValue('SUR NUEVO')).toBeInTheDocument();
  });
});
