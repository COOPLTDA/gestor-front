import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FiltersBar } from './FiltersBar';
import { FILTROS_VACIOS, type Filtros } from '../types';
import { SIN_DATO } from '../lib/filters';
import { diaLabel } from '../lib/colors';

// MultiSelect es un componente ui compartido (fuera del alcance de este módulo);
// se mockea para poder ejercitar la lógica propia de FiltersBar (armado de
// opciones, merge de filtros) sin lidiar con el Popover interno de verdad.
vi.mock('@/components/ui/multi-select', () => ({
  MultiSelect: ({ options, selected, onChange }: any) => (
    <div data-testid="multiselect" data-selected={JSON.stringify(selected)}>
      {options.map((o: any) => (
        <button key={o.value} data-testid={`opt-${o.value}`} onClick={() => onChange([...selected, o.value])}>
          {o.label}
        </button>
      ))}
    </div>
  ),
}));

function filtros(overrides: Partial<Filtros> = {}): Filtros {
  return { ...FILTROS_VACIOS, ...overrides };
}

function baseProps(overrides: Partial<Parameters<typeof FiltersBar>[0]> = {}) {
  return {
    filtros: filtros(),
    onChange: vi.fn(),
    rubros: [],
    partidos: [],
    frecuencias: [],
    vendedores: [],
    proveedores: [],
    divisiones: [],
    lineas: [],
    articulos: [],
    totalMostrado: 0,
    excluidos: [],
    onReincluir: vi.fn(),
    onRestaurarExcluidos: vi.fn(),
    rangoVentas: { desde: '2025-07-01', hasta: '2026-07-01' },
    onChangeRangoVentas: vi.fn(),
    ...overrides,
  };
}

describe('FiltersBar', () => {
  it('muestra el total de puntos mostrados', () => {
    render(<FiltersBar {...baseProps({ totalMostrado: 1234 })} />);
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('el buscador refleja el valor de filtros.search y dispara onChange al escribir', () => {
    const onChange = vi.fn();
    render(<FiltersBar {...baseProps({ filtros: filtros({ search: 'algo' }), onChange })} />);

    const input = screen.getByPlaceholderText('Nombre / dirección...');
    expect(input).toHaveValue('algo');

    fireEvent.change(input, { target: { value: 'nuevo' } });
    expect(onChange).toHaveBeenCalledWith(filtros({ search: 'nuevo' }));
  });

  it('"Limpiar" llama a onChange con FILTROS_VACIOS y también restaura los excluidos', () => {
    const onChange = vi.fn();
    const onRestaurarExcluidos = vi.fn();
    render(<FiltersBar {...baseProps({
      filtros: filtros({ search: 'algo', comercio: ['Almacén'] }),
      onChange,
      onRestaurarExcluidos,
      excluidos: [{ id: '1', n: 'Cliente Uno' }],
    })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    expect(onChange).toHaveBeenCalledWith(FILTROS_VACIOS);
    expect(onRestaurarExcluidos).toHaveBeenCalled();
  });

  it('filtro Activo: clickear una opción llama a onChange con esa clave actualizada', () => {
    const onChange = vi.fn();
    render(<FiltersBar {...baseProps({ filtros: filtros({ activo: 'activos' }), onChange })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));

    expect(onChange).toHaveBeenCalledWith(filtros({ activo: 'todos' }));
  });

  it('filtro Facturación: escribir min/max llama a onChange con esos valores numéricos', () => {
    const onChange = vi.fn();
    render(<FiltersBar {...baseProps({ filtros: filtros(), onChange })} />);

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1000' } });
    expect(onChange).toHaveBeenLastCalledWith(filtros({ facturacionMin: 1000 }));

    fireEvent.change(screen.getByPlaceholderText('Sin tope'), { target: { value: '50000' } });
    expect(onChange).toHaveBeenLastCalledWith(filtros({ facturacionMax: 50000 }));
  });

  it('filtro Facturación: vaciar el campo vuelve el valor a null', () => {
    const onChange = vi.fn();
    render(<FiltersBar {...baseProps({ filtros: filtros({ facturacionMin: 1000 }), onChange })} />);

    fireEvent.change(screen.getByDisplayValue('1000'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(filtros({ facturacionMin: null }));
  });

  it('rango de ventas: cambiar "desde" u "hasta" llama a onChangeRangoVentas', () => {
    const onChangeRangoVentas = vi.fn();
    render(<FiltersBar {...baseProps({
      rangoVentas: { desde: '2025-07-01', hasta: '2026-07-01' },
      onChangeRangoVentas,
    })} />);

    const [desdeInput, hastaInput] = screen.getAllByDisplayValue(/2025-07-01|2026-07-01/);
    fireEvent.change(desdeInput, { target: { value: '2025-08-01' } });
    expect(onChangeRangoVentas).toHaveBeenCalledWith({ desde: '2025-08-01', hasta: '2026-07-01' });

    fireEvent.change(hastaInput, { target: { value: '2026-08-01' } });
    expect(onChangeRangoVentas).toHaveBeenCalledWith({ desde: '2025-07-01', hasta: '2026-08-01' });
  });

  it('traduce SIN_DATO a su label en las opciones de rubro/partido/frecuencia/proveedor/división/línea', () => {
    render(<FiltersBar {...baseProps({ rubros: [SIN_DATO, 'Almacén'] })} />);
    expect(screen.getByTestId(`opt-${SIN_DATO}`)).toHaveTextContent('Sin dato');
  });

  it('vendedor: arma el label como "cod - nombre" si tiene nombre', () => {
    render(<FiltersBar {...baseProps({ vendedores: [{ cod: 'V1', nombre: 'Vendedor Uno' }] })} />);
    expect(screen.getByTestId('opt-V1')).toHaveTextContent('V1 - Vendedor Uno');
  });

  it('vendedor: usa solo el código si no tiene nombre', () => {
    render(<FiltersBar {...baseProps({ vendedores: [{ cod: 'V2', nombre: null }] })} />);
    expect(screen.getByTestId('opt-V2')).toHaveTextContent('V2');
  });

  it('vendedor: SIN_DATO usa su label fijo en vez de "cod - nombre"', () => {
    render(<FiltersBar {...baseProps({ vendedores: [{ cod: SIN_DATO, nombre: 'no debería verse' }] })} />);
    expect(screen.getByTestId(`opt-${SIN_DATO}`)).toHaveTextContent('Sin dato');
  });

  it('artículo: usa el nombre del artículo como label, no traduce SIN_DATO', () => {
    render(<FiltersBar {...baseProps({ articulos: [{ id: SIN_DATO, nombre: 'Sin dato' }, { id: 'A1', nombre: 'Art 1' }] })} />);
    expect(screen.getByTestId(`opt-${SIN_DATO}`)).toHaveTextContent('Sin dato');
    expect(screen.getByTestId('opt-A1')).toHaveTextContent('Art 1');
  });

  it('cada MultiSelect actualiza solo su propia clave en el objeto de filtros', () => {
    const onChange = vi.fn();
    render(<FiltersBar {...baseProps({ filtros: filtros(), partidos: ['CABA'], onChange })} />);

    fireEvent.click(screen.getByTestId('opt-CABA'));

    expect(onChange).toHaveBeenCalledWith(filtros({ partido: ['CABA'] }));
  });

  it('cada uno de los 8 MultiSelect restantes actualiza su propia clave (dia/vendedor/tipo/frecuencia/proveedor/división/línea/artículo)', () => {
    const onChange = vi.fn();
    render(
      <FiltersBar
        {...baseProps({
          filtros: filtros(),
          onChange,
          rubros: ['OPT-COMERCIO'],
          frecuencias: ['OPT-FREQ'],
          vendedores: [{ cod: 'OPT-VND', nombre: 'Vendedor' }],
          proveedores: ['OPT-PROV'],
          divisiones: ['OPT-DIV'],
          lineas: ['OPT-LIN'],
          articulos: [{ id: 'OPT-ART', nombre: 'Artículo' }],
        })}
      />
    );

    fireEvent.click(screen.getByTestId('opt-1')); // primer día (DIAS[0] = 1, Lunes)
    expect(onChange).toHaveBeenLastCalledWith(filtros({ dia: ['1'] }));

    fireEvent.click(screen.getByTestId('opt-OPT-VND'));
    expect(onChange).toHaveBeenLastCalledWith(filtros({ vndCod: ['OPT-VND'] }));

    fireEvent.click(screen.getByTestId('opt-OPT-COMERCIO'));
    expect(onChange).toHaveBeenLastCalledWith(filtros({ comercio: ['OPT-COMERCIO'] }));

    fireEvent.click(screen.getByTestId('opt-OPT-FREQ'));
    expect(onChange).toHaveBeenLastCalledWith(filtros({ frecuencia: ['OPT-FREQ'] }));

    fireEvent.click(screen.getByTestId('opt-OPT-PROV'));
    expect(onChange).toHaveBeenLastCalledWith(filtros({ proveedor: ['OPT-PROV'] }));

    fireEvent.click(screen.getByTestId('opt-OPT-DIV'));
    expect(onChange).toHaveBeenLastCalledWith(filtros({ division: ['OPT-DIV'] }));

    fireEvent.click(screen.getByTestId('opt-OPT-LIN'));
    expect(onChange).toHaveBeenLastCalledWith(filtros({ linea: ['OPT-LIN'] }));

    fireEvent.click(screen.getByTestId('opt-OPT-ART'));
    expect(onChange).toHaveBeenLastCalledWith(filtros({ articulo: ['OPT-ART'] }));
  });

  it('DIAS lista los 8 días (1..7 y 0) en ese orden, con su label real', () => {
    render(<FiltersBar {...baseProps()} />);
    [1, 2, 3, 4, 5, 6, 7, 0].forEach((d) => {
      expect(screen.getByTestId(`opt-${d}`)).toHaveTextContent(diaLabel(d));
    });
  });

  it('traduce SIN_DATO en frecuencia/proveedor/división/línea, no solo en rubro', () => {
    render(<FiltersBar {...baseProps({
      frecuencias: [SIN_DATO],
      proveedores: [SIN_DATO],
      divisiones: [SIN_DATO],
      lineas: [SIN_DATO],
    })} />);

    screen.getAllByTestId(`opt-${SIN_DATO}`).forEach((el) => expect(el).toHaveTextContent('Sin dato'));
  });

  it('sin PDV excluidos, no muestra el control de excluidos', () => {
    render(<FiltersBar {...baseProps({ excluidos: [] })} />);
    expect(screen.queryByText(/Excluidos:/)).not.toBeInTheDocument();
  });

  it('con PDV excluidos, muestra la cantidad en el botón', () => {
    render(<FiltersBar {...baseProps({ excluidos: [{ id: '1', n: 'Cliente Uno' }, { id: '2', n: 'Cliente Dos' }] })} />);
    expect(screen.getByRole('button', { name: 'Excluidos: 2' })).toBeInTheDocument();
  });

  it('al abrir el popover de excluidos, lista cada uno y permite reincluirlos o restaurar todos', () => {
    const onReincluir = vi.fn();
    const onRestaurarExcluidos = vi.fn();
    render(<FiltersBar {...baseProps({
      excluidos: [{ id: '1', n: 'Cliente Uno' }],
      onReincluir,
      onRestaurarExcluidos,
    })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Excluidos: 1' }));

    expect(screen.getByText('1 - Cliente Uno')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Volver a incluir'));
    expect(onReincluir).toHaveBeenCalledWith('1');

    fireEvent.click(screen.getByText('Restaurar todos'));
    expect(onRestaurarExcluidos).toHaveBeenCalled();
  });
});
