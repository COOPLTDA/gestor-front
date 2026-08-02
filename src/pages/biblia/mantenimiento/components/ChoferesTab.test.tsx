import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChoferesTab } from './ChoferesTab';
import type { ChoferAdmin, CodigoDespachoAdmin } from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  searchCodigosDespacho: vi.fn().mockResolvedValue([]),
}));

const CHOFERES: ChoferAdmin[] = [
  { codigo: 'CH2', descripcion: 'García', desactivado: 1, rutas: [] },
  { codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: ['BIG'] },
  { codigo: 'CH3', descripcion: 'Álvarez', desactivado: 0, rutas: [] },
];

const CODIGOS: CodigoDespachoAdmin[] = [
  { id: 'BIG', nombre: 'BIG LOMAS', desactivado: 0, direccion: null },
];

function renderTab(over: Partial<Parameters<typeof ChoferesTab>[0]> = {}) {
  const props = {
    choferes: CHOFERES,
    codigosDespacho: CODIGOS,
    loading: false,
    onGuardar: vi.fn(),
    onToggle: vi.fn(),
    onAsignar: vi.fn(),
    onDesasignar: vi.fn(),
    ...over,
  };
  render(<ChoferesTab {...props} />);
  return props;
}

beforeEach(() => vi.clearAllMocks());

describe('ChoferesTab', () => {
  it('lista los choferes con activos primero, ordenados por nombre', () => {
    renderTab();
    const filas = screen.getAllByRole('row').slice(1); // sin el header
    const nombres = filas.map(f => f.querySelectorAll('td')[1].textContent);
    expect(nombres).toEqual(['Álvarez', 'López', 'García']);
  });

  it('muestra el estado y las rutas de cada chofer', () => {
    renderTab();
    expect(screen.getAllByText('Activo')).toHaveLength(2);
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText('BIG · BIG LOMAS')).toBeInTheDocument();
  });

  it('filtra por nombre o código', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText('Buscar por código o nombre…'), {
      target: { value: 'gar' },
    });
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.queryByText('López')).not.toBeInTheDocument();
  });

  it('muestra "Sin resultados" si el filtro no matchea', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText('Buscar por código o nombre…'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('muestra "Cargando…" mientras carga', () => {
    renderTab({ loading: true });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('el botón Nuevo abre el modal de alta', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo/ }));
    expect(screen.getByText('Nuevo chofer')).toBeInTheDocument();
  });

  it('el lápiz abre el modal de edición con los datos del chofer', () => {
    renderTab();
    fireEvent.click(screen.getAllByTitle('Editar')[0]);
    expect(screen.getByText('Editar chofer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Álvarez')).toBeInTheDocument();
  });

  it('el botón de power llama a onToggle con código y estado actual', () => {
    const { onToggle } = renderTab();
    fireEvent.click(screen.getByTitle('Activar')); // García está inactivo
    expect(onToggle).toHaveBeenCalledWith('CH2', 1);
    fireEvent.click(screen.getAllByTitle('Desactivar')[0]);
    expect(onToggle).toHaveBeenCalledWith('CH3', 0);
  });

  it('cerrar el modal (Cancelar) lo oculta', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo/ }));
    expect(screen.getByText('Nuevo chofer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Nuevo chofer')).not.toBeInTheDocument();
  });

  it('muestra la insignia "desglose de X" cuando el chofer tiene chofer_padre_codigo', () => {
    renderTab({
      choferes: [
        { codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: [], chofer_padre_codigo: 'CH-PADRE' },
      ],
    });
    expect(screen.getByText(/desglose de CH-PADRE/)).toBeInTheDocument();
  });

  it('filtra por código en minúsculas aunque el código real esté en mayúsculas', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText('Buscar por código o nombre…'), { target: { value: 'ch1' } });
    expect(screen.getByText('López')).toBeInTheDocument();
    expect(screen.queryByText('García')).not.toBeInTheDocument();
  });

  it('un chofer con descripción null se ordena de forma consistente (fallback a "")', () => {
    renderTab({
      choferes: [
        { codigo: 'CH1', descripcion: null, desactivado: 0, rutas: [] },
        { codigo: 'CH2', descripcion: 'Ana', desactivado: 0, rutas: [] },
      ],
    });
    const filas = screen.getAllByRole('row').slice(1);
    // '' (null→'') va antes que 'Ana' alfabéticamente.
    expect(filas[0].querySelectorAll('td')[0].textContent).toBe('CH1');
    expect(filas[1].querySelectorAll('td')[0].textContent).toBe('CH2');
  });

  it('la ruta muestra el nombre del código correcto, no siempre el primero de la lista', () => {
    renderTab({
      choferes: [{ codigo: 'CH1', descripcion: 'López', desactivado: 0, rutas: ['SEG'] }],
      codigosDespacho: [
        { id: 'BIG', nombre: 'BIG LOMAS', desactivado: 0, direccion: null },
        { id: 'SEG', nombre: 'SEGUNDA RUTA', desactivado: 0, direccion: null },
      ],
    });
    expect(screen.getByText('SEG · SEGUNDA RUTA')).toBeInTheDocument();
    expect(screen.queryByText('SEG · BIG LOMAS')).not.toBeInTheDocument();
  });

  it('un chofer sin rutas muestra el guión "—"', () => {
    renderTab();
    const filaGarcia = screen.getByText('García').closest('tr')!;
    expect(filaGarcia.textContent).toContain('—');
  });

  it('una ruta sin nombre conocido se lista solo por su código (sin " · nombre")', () => {
    renderTab({ codigosDespacho: [] });
    expect(screen.getByText('BIG')).toBeInTheDocument();
    expect(screen.queryByText(/BIG ·/)).not.toBeInTheDocument();
  });

  it('las filas alternan color de fondo (par/impar, no i*2===0)', () => {
    renderTab({
      choferes: [
        { codigo: 'CH1', descripcion: 'A', desactivado: 0, rutas: [] },
        { codigo: 'CH2', descripcion: 'B', desactivado: 0, rutas: [] },
        { codigo: 'CH3', descripcion: 'C', desactivado: 0, rutas: [] },
      ],
    });
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas[0].className).toBe('border-b last:border-b-0  ');
    expect(filas[1].className).toContain('bg-slate-50/50');
    expect(filas[2].className).not.toContain('bg-slate-50/50');
  });

  it('un chofer desactivado tiene la clase de opacidad en la fila', () => {
    renderTab();
    const filaGarcia = screen.getByText('García').closest('tr')!; // desactivado
    expect(filaGarcia.className).toContain('opacity-50');
    const filaLopez = screen.getByText('López').closest('tr')!;
    expect(filaLopez.className).not.toContain('opacity-50');
  });

  it('el botón de power usa colores distintos según el estado', () => {
    renderTab();
    const btnActivar = screen.getByTitle('Activar'); // García inactivo
    expect(btnActivar.className).toContain('text-emerald-600');
    const btnDesactivar = screen.getAllByTitle('Desactivar')[0]; // López/Álvarez activos
    expect(btnDesactivar.className).toContain('text-red-400');
  });

  it('al editar el chofer correcto (no el primero), usa la versión ACTUALIZADA', () => {
    const { rerender } = render(<ChoferesTab
      choferes={CHOFERES}
      codigosDespacho={CODIGOS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);
    // Orden renderizado: activos alfabético primero → Álvarez(0), López(1), luego García(2, inactivo)
    fireEvent.click(screen.getAllByTitle('Editar')[1]); // López
    expect(screen.getByDisplayValue('López')).toBeInTheDocument();

    rerender(<ChoferesTab
      choferes={[
        { codigo: 'CH2', descripcion: 'García', desactivado: 1, rutas: [] },
        { codigo: 'CH1', descripcion: 'López Renombrado', desactivado: 0, rutas: ['BIG'] },
        { codigo: 'CH3', descripcion: 'Álvarez', desactivado: 0, rutas: [] },
      ]}
      codigosDespacho={CODIGOS}
      loading={false}
      onGuardar={vi.fn()}
      onToggle={vi.fn()}
      onAsignar={vi.fn()}
      onDesasignar={vi.fn()}
    />);

    expect(screen.getByDisplayValue('López Renombrado')).toBeInTheDocument();
  });
});
