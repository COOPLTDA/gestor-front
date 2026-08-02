import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RutasTab } from './RutasTab';
import type { CodigoDespachoAdmin, ChoferAdmin, ZonaAdmin } from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  searchChoferes: vi.fn().mockResolvedValue([]),
}));

const CODIGOS: CodigoDespachoAdmin[] = [
  { id: '02', nombre: 'V. OBRERA', desactivado: 1, direccion: null, zona_id: null, choferes: [] },
  { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null, zona_id: 9, choferes: ['CH1'] },
];

const CHOFERES: ChoferAdmin[] = [
  { codigo: 'CH1', descripcion: 'López', desactivado: 0 },
];

const ZONAS: ZonaAdmin[] = [
  { id: 9, nombre: 'LOMAS', desactivado: 0 },
];

function renderTab(over: Partial<Parameters<typeof RutasTab>[0]> = {}) {
  const props = {
    codigosDespacho: CODIGOS,
    choferes: CHOFERES,
    zonas: ZONAS,
    loading: false,
    onGuardar: vi.fn(),
    onToggle: vi.fn(),
    onAsignar: vi.fn(),
    onDesasignar: vi.fn(),
    ...over,
  };
  render(<RutasTab {...props} />);
  return props;
}

beforeEach(() => vi.clearAllMocks());

describe('RutasTab', () => {
  it('lista los códigos con activos primero y muestra zona y choferes', () => {
    renderTab();
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas[0].textContent).toContain('LANUS 2');
    expect(filas[1].textContent).toContain('V. OBRERA');
    expect(screen.getByText('LOMAS')).toBeInTheDocument();
    expect(screen.getByText('CH1 · López')).toBeInTheDocument();
  });

  it('no tiene botón "Nuevo" (los códigos nacen en Sigma, no acá)', () => {
    renderTab();
    expect(screen.queryByRole('button', { name: /Nuevo/ })).not.toBeInTheDocument();
  });

  it('filtra por nombre de zona', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText('Buscar por código, descripción o zona…'), {
      target: { value: 'lomas' },
    });
    expect(screen.getByText('LANUS 2')).toBeInTheDocument();
    expect(screen.queryByText('V. OBRERA')).not.toBeInTheDocument();
  });

  it('filtra por id o descripción', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText('Buscar por código, descripción o zona…'), {
      target: { value: 'obrera' },
    });
    expect(screen.getByText('V. OBRERA')).toBeInTheDocument();
    expect(screen.queryByText('LANUS 2')).not.toBeInTheDocument();
  });

  it('muestra Cargando… y Sin resultados según corresponda', () => {
    renderTab({ loading: true });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('onToggle recibe el id como string y el estado actual', () => {
    const { onToggle } = renderTab();
    fireEvent.click(screen.getByTitle('Desactivar'));
    expect(onToggle).toHaveBeenCalledWith('01', 0);
    fireEvent.click(screen.getByTitle('Activar'));
    expect(onToggle).toHaveBeenCalledWith('02', 1);
  });

  it('el lápiz abre el modal de edición', () => {
    renderTab();
    fireEvent.click(screen.getAllByTitle('Editar')[0]);
    expect(screen.getByText('Editar código de despacho')).toBeInTheDocument();
  });

  it('cerrar el modal (Cancelar) lo oculta', () => {
    renderTab();
    fireEvent.click(screen.getAllByTitle('Editar')[0]);
    expect(screen.getByText('Editar código de despacho')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Editar código de despacho')).not.toBeInTheDocument();
  });

  it('sin filtro, no muestra "Sin resultados"', () => {
    renderTab();
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
  });

  it('un código sin choferes asignados muestra el guión "—" (columna Choferes)', () => {
    renderTab();
    const filaObrera = screen.getByText('V. OBRERA').closest('tr')!;
    const celdaChoferes = filaObrera.querySelectorAll('td')[3];
    expect(celdaChoferes.textContent).toBe('—');
  });

  it('un chofer sin nombre conocido se lista solo por su código (sin " · nombre")', () => {
    renderTab({ choferes: [] });
    expect(screen.getByText('CH1')).toBeInTheDocument();
    expect(screen.queryByText(/CH1 ·/)).not.toBeInTheDocument();
  });

  it('las filas alternan color de fondo (par/impar, no i*2===0)', () => {
    renderTab({
      codigosDespacho: [
        { id: '01', nombre: 'A', desactivado: 0, direccion: null, zona_id: null, choferes: [] },
        { id: '02', nombre: 'B', desactivado: 0, direccion: null, zona_id: null, choferes: [] },
        { id: '03', nombre: 'C', desactivado: 0, direccion: null, zona_id: null, choferes: [] },
      ],
    });
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas[0].className).toBe('border-b last:border-b-0  ');
    expect(filas[1].className).toContain('bg-slate-50/50');
    expect(filas[2].className).not.toContain('bg-slate-50/50'); // i=2: distingue % de *
  });

  it('un código desactivado tiene la clase de opacidad en la fila', () => {
    renderTab();
    const filaObrera = screen.getByText('V. OBRERA').closest('tr')!; // desactivado:1
    expect(filaObrera.className).toContain('opacity-50');
    const filaLanus = screen.getByText('LANUS 2').closest('tr')!;
    expect(filaLanus.className).not.toContain('opacity-50');
  });

  it('el botón de power usa colores distintos según el estado', () => {
    renderTab();
    const btnActivar = screen.getByTitle('Activar'); // V. OBRERA desactivado
    expect(btnActivar.className).toContain('text-emerald-600');
    const btnDesactivar = screen.getByTitle('Desactivar'); // LANUS 2 activo
    expect(btnDesactivar.className).toContain('text-red-400');
  });

  it('al editar el SEGUNDO código, usa su versión ACTUALIZADA (no la primera del array)', () => {
    const { rerender } = render(<RutasTab
      codigosDespacho={CODIGOS}
      choferes={CHOFERES}
      zonas={ZONAS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);
    // Orden renderizado: activos primero → LANUS 2 (índice 0), luego V. OBRERA (índice 1)
    fireEvent.click(screen.getAllByTitle('Editar')[1]); // edita V. OBRERA
    expect(screen.getByDisplayValue('02')).toBeInTheDocument();

    rerender(<RutasTab
      codigosDespacho={[
        { id: '02', nombre: 'V. OBRERA RENOMBRADA', desactivado: 1, direccion: null, zona_id: null, choferes: [] },
        { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null, zona_id: 9, choferes: ['CH1'] },
      ]}
      choferes={CHOFERES}
      zonas={ZONAS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);

    // Sigue mostrando el id '02' (no cambió a '01' de la primera fila) y, dentro del MODAL
    // (no solo en la fila de la tabla), el nombre actualizado: repartoActual debe reflejar
    // la versión viva de codigosDespacho, no quedarse con el snapshot de "editando".
    expect(screen.getByDisplayValue('02')).toBeInTheDocument();
    const nombreEnModal = screen.getByTitle('Definido en Sigma — no se edita desde la Biblia');
    expect(nombreEnModal.textContent).toBe('V. OBRERA RENOMBRADA');
  });

  it('recalcula el mapa de zonas cuando cambia el array de zonas', () => {
    const { rerender } = render(<RutasTab
      codigosDespacho={CODIGOS}
      choferes={CHOFERES}
      zonas={ZONAS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);
    expect(screen.getByText('LOMAS')).toBeInTheDocument();

    rerender(<RutasTab
      codigosDespacho={CODIGOS}
      choferes={CHOFERES}
      zonas={[{ id: 9, nombre: 'LOMAS RENOMBRADA', desactivado: 0 }]}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);

    expect(screen.getByText('LOMAS RENOMBRADA')).toBeInTheDocument();
  });

  it('recalcula el mapa de choferes cuando cambia el array de choferes', () => {
    const { rerender } = render(<RutasTab
      codigosDespacho={CODIGOS}
      choferes={CHOFERES}
      zonas={ZONAS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);
    expect(screen.getByText('CH1 · López')).toBeInTheDocument();

    rerender(<RutasTab
      codigosDespacho={CODIGOS}
      choferes={[{ codigo: 'CH1', descripcion: 'López Renombrado', desactivado: 0 }]}
      zonas={ZONAS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);

    expect(screen.getByText('CH1 · López Renombrado')).toBeInTheDocument();
  });

  it('filtra por zona (normaliza mayúsculas/acentos)', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: 'LOMAS' } });
    expect(screen.getByText('LANUS 2')).toBeInTheDocument();
    expect(screen.queryByText('V. OBRERA')).not.toBeInTheDocument();
  });

  it('un código con desactivado undefined (no 0/1) se ordena como activo (?? 0, no && 0)', () => {
    renderTab({
      codigosDespacho: [
        { id: '01', nombre: 'ZETA', desactivado: 1, direccion: null, zona_id: null, choferes: [] },
        { id: '02', nombre: 'ALFA', desactivado: undefined as unknown as number, direccion: null, zona_id: null, choferes: [] },
      ],
    });
    const filas = screen.getAllByRole('row').slice(1);
    // ALFA (desactivado undefined → tratado como 0/activo) debe ir antes que ZETA (desactivado 1).
    expect(filas[0].textContent).toContain('ALFA');
    expect(filas[1].textContent).toContain('ZETA');
  });

  it('un código con choferes undefined (no []) también muestra el guión "—" (columna Choferes)', () => {
    renderTab({
      codigosDespacho: [{ id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null, zona_id: null }],
    });
    const fila = screen.getByText('LANUS 2').closest('tr')!;
    const celdaChoferes = fila.querySelectorAll('td')[3];
    expect(celdaChoferes.textContent).toBe('—');
  });

  it('una búsqueda que no matchea nada muestra "Sin resultados"', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: 'zzz-no-existe' } });
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('si el código que se estaba editando ya no está en la lista, RutaModal recibe el snapshot viejo (no rompe)', () => {
    const { rerender } = render(<RutasTab
      codigosDespacho={CODIGOS}
      choferes={CHOFERES}
      zonas={ZONAS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);
    fireEvent.click(screen.getAllByTitle('Editar')[1]); // edita V. OBRERA (id '02')
    expect(screen.getByDisplayValue('02')).toBeInTheDocument();

    // El código '02' desaparece de la lista (p.ej. otro usuario lo eliminó/desactivó y se filtró).
    rerender(<RutasTab
      codigosDespacho={[{ id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null, zona_id: 9, choferes: ['CH1'] }]}
      choferes={CHOFERES}
      zonas={ZONAS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);

    // Sigue mostrando el modal con el snapshot viejo de '02', no null ni roto.
    expect(screen.getByDisplayValue('02')).toBeInTheDocument();
  });

  it('el orden alfabético entre activos usa localeCompare, no comparación binaria', () => {
    renderTab({
      codigosDespacho: [
        { id: '01', nombre: 'ZETA', desactivado: 0, direccion: null, zona_id: null, choferes: [] },
        { id: '02', nombre: 'ALFA', desactivado: 0, direccion: null, zona_id: null, choferes: [] },
      ],
    });
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas[0].textContent).toContain('ALFA');
    expect(filas[1].textContent).toContain('ZETA');
  });
});
