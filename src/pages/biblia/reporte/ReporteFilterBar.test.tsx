import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReporteFilterBar } from './ReporteFilterBar';

function baseProps(over: Partial<Parameters<typeof ReporteFilterBar>[0]> = {}) {
  return {
    vista: 'biblia' as const,
    bibliaFecha: '2026-07-10',
    setBibliaFecha: vi.fn(),
    rangoAsignaciones: { fecha_desde: '2026-07-08', fecha_hasta: '2026-07-10' },
    fechaDesde: '2026-07-08',
    fechaHasta: '2026-07-10',
    filtroDireccion: '',
    setFiltroDireccion: vi.fn(),
    direcciones: ['LOMAS', 'QUILMES'],
    filtroCaso: ['propia', 'sin_asignar'] as ('propia' | 'sin_asignar' | 'otra_biblia')[],
    setFiltroCaso: vi.fn(),
    casoOpen: false,
    setCasoOpen: vi.fn(),
    casoRef: createRef<HTMLDivElement>(),
    casoLabel: '2 casos',
    personalTitulo: 'Mi reporte',
    setPersonalTitulo: vi.fn(),
    fechaDesdeRango: '2026-07-01',
    setFechaDesdeRango: vi.fn(),
    fechaHastaRango: '2026-07-05',
    setFechaHastaRango: vi.fn(),
    filtroBiblias: [] as string[],
    setFiltroBiblias: vi.fn(),
    bibliasOpen: false,
    setBibliasOpen: vi.fn(),
    bibliasRef: createRef<HTMLDivElement>(),
    bibliaLabel: 'Todo',
    bibliasFechasDisponibles: ['2026-07-08', '2026-07-09'],
    ...over,
  };
}

describe('ReporteFilterBar — vista mapa', () => {
  it('muestra el selector de fecha de biblia y el rango de preparaciones cargado', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'mapa' })} />);
    expect(screen.getByText('Biblia del día')).toBeInTheDocument();
    expect(screen.getByText('Preparaciones')).toBeInTheDocument();
    expect(screen.getByText('08/07/2026 al 10/07/2026')).toBeInTheDocument();
  });

  it('mismo día desde/hasta muestra una sola fecha, no un rango', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'mapa', fechaDesde: '2026-07-08', fechaHasta: '2026-07-08' })} />);
    expect(screen.getByText('08/07/2026')).toBeInTheDocument();
    expect(screen.queryByText(/al/)).not.toBeInTheDocument();
  });

  it('mientras carga muestra el spinner en vez del rango', () => {
    const { container } = render(<ReporteFilterBar {...baseProps({ vista: 'mapa', rangoAsignaciones: 'cargando' })} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('sin preparaciones asignadas muestra el mensaje de alerta', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'mapa', rangoAsignaciones: null })} />);
    expect(screen.getByText('Sin preparaciones asignadas')).toBeInTheDocument();
  });

  it('no muestra el input de fecha si bibliaFecha está vacío', () => {
    const { container } = render(<ReporteFilterBar {...baseProps({ vista: 'mapa', bibliaFecha: '' })} />);
    expect(container.querySelector('input[type=date]')?.getAttribute('value')).toBe('');
  });

  it('cambiar la fecha llama a setBibliaFecha con el nuevo valor', () => {
    const setBibliaFecha = vi.fn();
    const { container } = render(<ReporteFilterBar {...baseProps({ vista: 'mapa', setBibliaFecha })} />);
    const input = container.querySelector('input[type=date]')!;
    fireEvent.change(input, { target: { value: '2026-07-15' } });
    expect(setBibliaFecha).toHaveBeenCalledWith('2026-07-15');
  });

  it('no llama a setBibliaFecha si el nuevo valor es vacío', () => {
    const setBibliaFecha = vi.fn();
    const { container } = render(<ReporteFilterBar {...baseProps({ vista: 'mapa', setBibliaFecha })} />);
    const input = container.querySelector('input[type=date]')!;
    fireEvent.change(input, { target: { value: '' } });
    expect(setBibliaFecha).not.toHaveBeenCalled();
  });
});

describe('ReporteFilterBar — vista resumen', () => {
  it('solo muestra el selector de fecha de biblia, sin filtros adicionales', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'resumen' })} />);
    expect(screen.getByText('Biblia del día')).toBeInTheDocument();
    expect(screen.queryByText('Preparaciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Título')).not.toBeInTheDocument();
  });
});

describe('ReporteFilterBar — vista biblia', () => {
  it('muestra selector de zona, y el botón de casos con su label', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia' })} />);
    expect(screen.getByText('Todas las zonas')).toBeInTheDocument();
    expect(screen.getByText('LOMAS')).toBeInTheDocument();
    expect(screen.getByText('QUILMES')).toBeInTheDocument();
    expect(screen.getByText('2 casos')).toBeInTheDocument();
  });

  it('cambiar la zona llama a setFiltroDireccion', () => {
    const setFiltroDireccion = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', setFiltroDireccion })} />);
    fireEvent.change(screen.getByDisplayValue('Todas las zonas'), { target: { value: 'LOMAS' } });
    expect(setFiltroDireccion).toHaveBeenCalledWith('LOMAS');
  });

  it('el botón de caso está resaltado en azul si el filtro es parcial (>0 y <3)', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', filtroCaso: ['propia'] })} />);
    expect(screen.getByText('2 casos').closest('button')).toHaveClass('bg-blue-600');
  });

  it('el botón de caso NO está resaltado si el filtro está vacío', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', filtroCaso: [] })} />);
    expect(screen.getByText('2 casos').closest('button')).not.toHaveClass('bg-blue-600');
  });

  it('el botón de caso NO está resaltado si el filtro incluye los 3 casos', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', filtroCaso: ['propia', 'sin_asignar', 'otra_biblia'] })} />);
    expect(screen.getByText('2 casos').closest('button')).not.toHaveClass('bg-blue-600');
  });

  it('clickear el botón de caso llama a setCasoOpen', () => {
    const setCasoOpen = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', setCasoOpen })} />);
    fireEvent.click(screen.getByText('2 casos'));
    expect(setCasoOpen).toHaveBeenCalled();
    expect(setCasoOpen.mock.calls[0][0](false)).toBe(true);
  });

  it('con casoOpen=true muestra las 3 opciones de caso con sus checkboxes', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', casoOpen: true, filtroCaso: ['propia'] })} />);
    expect(screen.getByText('Esta biblia')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
    expect(screen.getByText('Otra biblia')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
  });

  it('con casoOpen=false no muestra las opciones', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', casoOpen: false })} />);
    expect(screen.queryByText('Otra biblia')).not.toBeInTheDocument();
  });

  it('tildar un caso no seleccionado lo agrega a la lista', () => {
    const setFiltroCaso = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', casoOpen: true, filtroCaso: ['propia'], setFiltroCaso })} />);
    fireEvent.click(screen.getByText('Sin asignar'));
    expect(setFiltroCaso.mock.calls[0][0](['propia'])).toEqual(['propia', 'sin_asignar']);
  });

  it('destildar un caso ya seleccionado lo quita de la lista', () => {
    const setFiltroCaso = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'biblia', casoOpen: true, filtroCaso: ['propia', 'sin_asignar'], setFiltroCaso })} />);
    fireEvent.click(screen.getByText('Esta biblia'));
    expect(setFiltroCaso.mock.calls[0][0](['propia', 'sin_asignar'])).toEqual(['sin_asignar']);
  });
});

describe('ReporteFilterBar — vista personalizado', () => {
  it('muestra el input de título con el valor actual', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'personalizado', personalTitulo: 'Reparto especial' })} />);
    expect(screen.getByPlaceholderText('Título del reporte')).toHaveValue('Reparto especial');
  });

  it('escribir en el input de título llama a setPersonalTitulo', () => {
    const setPersonalTitulo = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'personalizado', setPersonalTitulo })} />);
    fireEvent.change(screen.getByPlaceholderText('Título del reporte'), { target: { value: 'Nuevo título' } });
    expect(setPersonalTitulo).toHaveBeenCalledWith('Nuevo título');
  });

  it('no muestra selector de zona ni de casos', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'personalizado' })} />);
    expect(screen.queryByText('Todas las zonas')).not.toBeInTheDocument();
  });
});

describe('ReporteFilterBar — vista rango', () => {
  it('muestra los dos inputs de fecha con sus límites cruzados y el selector de zona', () => {
    const { container } = render(<ReporteFilterBar {...baseProps({ vista: 'rango' })} />);
    const inputs = container.querySelectorAll('input[type=date]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveAttribute('max', '2026-07-05');
    expect(inputs[1]).toHaveAttribute('min', '2026-07-01');
    expect(screen.getByText('Todas las zonas')).toBeInTheDocument();
  });

  it('cambiar la fecha desde llama a setFechaDesdeRango, cambiar hasta llama a setFechaHastaRango', () => {
    const setFechaDesdeRango = vi.fn();
    const setFechaHastaRango = vi.fn();
    const { container } = render(<ReporteFilterBar {...baseProps({ vista: 'rango', setFechaDesdeRango, setFechaHastaRango })} />);
    const inputs = container.querySelectorAll('input[type=date]');
    fireEvent.change(inputs[0], { target: { value: '2026-07-02' } });
    fireEvent.change(inputs[1], { target: { value: '2026-07-06' } });
    expect(setFechaDesdeRango).toHaveBeenCalledWith('2026-07-02');
    expect(setFechaHastaRango).toHaveBeenCalledWith('2026-07-06');
  });

  it('el botón de biblias está resaltado en azul cuando hay algún filtro activo', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', filtroBiblias: ['_sin'], bibliaLabel: 'Sin asignar' })} />);
    expect(screen.getByText('Sin asignar').closest('button')).toHaveClass('bg-blue-600');
  });

  it('el botón de biblias NO está resaltado cuando no hay filtro', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', filtroBiblias: [], bibliaLabel: 'Todo' })} />);
    expect(screen.getByText('Todo').closest('button')).not.toHaveClass('bg-blue-600');
  });

  it('con bibliasOpen=true muestra "Sin asignar" y cada fecha disponible', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', bibliasOpen: true })} />);
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
    expect(screen.getByText('08/07/2026')).toBeInTheDocument();
    expect(screen.getByText('09/07/2026')).toBeInTheDocument();
  });

  it('con bibliasOpen=false no muestra las opciones', () => {
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', bibliasOpen: false })} />);
    expect(screen.queryByText('Sin asignar')).not.toBeInTheDocument();
  });

  it('tildar "Sin asignar" lo agrega; volver a tildarlo lo quita', () => {
    const setFiltroBiblias = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', bibliasOpen: true, filtroBiblias: [], setFiltroBiblias })} />);
    fireEvent.click(screen.getByText('Sin asignar'));
    expect(setFiltroBiblias.mock.calls[0][0]([])).toEqual(['_sin']);
  });

  it('destildar "Sin asignar" ya seleccionado lo quita de la lista', () => {
    const setFiltroBiblias = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', bibliasOpen: true, filtroBiblias: ['_sin', '2026-07-08'], setFiltroBiblias })} />);
    fireEvent.click(screen.getByText('Sin asignar'));
    expect(setFiltroBiblias.mock.calls[0][0](['_sin', '2026-07-08'])).toEqual(['2026-07-08']);
  });

  it('tildar una fecha de biblia disponible la agrega a la lista', () => {
    const setFiltroBiblias = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', bibliasOpen: true, filtroBiblias: [], setFiltroBiblias })} />);
    fireEvent.click(screen.getByText('08/07/2026'));
    expect(setFiltroBiblias.mock.calls[0][0]([])).toEqual(['2026-07-08']);
  });

  it('destildar una fecha ya seleccionada la quita de la lista', () => {
    const setFiltroBiblias = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', bibliasOpen: true, filtroBiblias: ['2026-07-08', '2026-07-09'], setFiltroBiblias })} />);
    fireEvent.click(screen.getByText('08/07/2026'));
    expect(setFiltroBiblias.mock.calls[0][0](['2026-07-08', '2026-07-09'])).toEqual(['2026-07-09']);
  });

  it('cambiar la zona llama a setFiltroDireccion', () => {
    const setFiltroDireccion = vi.fn();
    render(<ReporteFilterBar {...baseProps({ vista: 'rango', setFiltroDireccion })} />);
    fireEvent.change(screen.getByDisplayValue('Todas las zonas'), { target: { value: 'QUILMES' } });
    expect(setFiltroDireccion).toHaveBeenCalledWith('QUILMES');
  });
});
