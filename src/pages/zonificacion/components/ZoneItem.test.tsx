import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoneItem } from './ZoneItem';
import type { Criterios, Pdv, Zona } from '../types';
import { FILTROS_VACIOS } from '../types';

function zona(overrides: Partial<Zona> = {}): Zona {
  return { nombre: 'Zona Norte', color: '#ff0000', vertices: [], criterios: null, ...overrides };
}

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente', dir: '', com: null, loc: '', par: '',
    lat: 0, lng: 0, desactivado: false, vnd_cod: 'V1', vnd_nombre: null, dia: null, frq: null, reparto: null,
    vendedores: [], facturacion: 0, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

function baseProps(overrides: Partial<Parameters<typeof ZoneItem>[0]> = {}) {
  return {
    zona: zona(),
    pts: [],
    universoPdv: [],
    isEditing: false,
    disabled: false,
    onStartEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onAplicarCriterios: vi.fn(),
    ...overrides,
  };
}

describe('ZoneItem', () => {
  it('muestra el nombre de la zona y la cantidad de PDV/vendedores distintos', () => {
    const pts = [pdv({ vnd_cod: 'V1' }), pdv({ vnd_cod: 'V1' }), pdv({ vnd_cod: 'V2' }), pdv({ vnd_cod: null })];
    render(<ZoneItem {...baseProps({ zona: zona({ nombre: 'Zona Norte' }), pts })} />);

    expect(screen.getByText('Zona Norte')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // PDV
    expect(screen.getByText('2')).toBeInTheDocument(); // vendedores distintos (V1, V2 — null no cuenta)
  });

  it('muestra la facturación sumada de los puntos que quedan adentro con los filtros actuales', () => {
    const pts = [pdv({ id: '1', facturacion: 1000 }), pdv({ id: '2', facturacion: 2500 })];
    render(<ZoneItem {...baseProps({ pts })} />);

    expect(screen.getByText(/Facturación \(filtros actuales\)/)).toBeInTheDocument();
    expect(screen.getByText(/3\.500/)).toBeInTheDocument();
  });

  it('muestra los botones de acción cuando no está en edición', () => {
    render(<ZoneItem {...baseProps({ isEditing: false })} />);
    expect(screen.getByRole('button', { name: 'Editar forma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renombrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
  });

  it('muestra guardar/cancelar cuando está en edición', () => {
    render(<ZoneItem {...baseProps({ isEditing: true })} />);
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar forma' })).not.toBeInTheDocument();
  });

  it('deshabilita las acciones si disabled=true (otra zona en edición)', () => {
    render(<ZoneItem {...baseProps({ disabled: true })} />);
    expect(screen.getByRole('button', { name: 'Editar forma' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Renombrar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  });

  it('onStartEdit/onSaveEdit/onCancelEdit/onDelete se llaman al clickear su botón', () => {
    const onStartEdit = vi.fn();
    const onDelete = vi.fn();
    render(<ZoneItem {...baseProps({ onStartEdit, onDelete })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar forma' }));
    expect(onStartEdit).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('renombrar: click en Renombrar muestra un input, Enter confirma con onRename', () => {
    const onRename = vi.fn();
    render(<ZoneItem {...baseProps({ zona: zona({ nombre: 'Original' }), onRename })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: 'Nuevo nombre' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('Nuevo nombre');
  });

  it('renombrar: Escape cancela sin llamar a onRename', () => {
    const onRename = vi.fn();
    render(<ZoneItem {...baseProps({ zona: zona({ nombre: 'Original' }), onRename })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: 'Cambio que no debería guardarse' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('renombrar: no llama a onRename si el nombre recortado queda vacío', () => {
    const onRename = vi.fn();
    render(<ZoneItem {...baseProps({ zona: zona({ nombre: 'Original' }), onRename })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('renombrar: no llama a onRename si el nombre recortado queda igual al original', () => {
    const onRename = vi.fn();
    render(<ZoneItem {...baseProps({ zona: zona({ nombre: 'Original' }), onRename })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: '  Original  ' } }); // recorta a lo mismo
    fireEvent.blur(input);

    expect(onRename).not.toHaveBeenCalled();
  });

  it('renombrar: una tecla que no es Enter ni Escape no confirma ni cancela', () => {
    const onRename = vi.fn();
    render(<ZoneItem {...baseProps({ zona: zona({ nombre: 'Original' }), onRename })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: 'Tipeando' } });
    fireEvent.keyDown(input, { key: 'a' });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Tipeando')).toBeInTheDocument(); // sigue en modo edición
  });

  it('renombrar: al entrar en modo edición, el input queda enfocado y seleccionado', () => {
    render(<ZoneItem {...baseProps({ zona: zona({ nombre: 'Original' }) })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));

    expect(document.activeElement).toBe(screen.getByDisplayValue('Original'));
  });

  it('usa el color de la zona para el borde de la card y el nombre', () => {
    render(<ZoneItem {...baseProps({ zona: zona({ nombre: 'Coloreada', color: '#123456' }) })} />);

    expect(screen.getByText('Coloreada').style.color).toBe('#123456');
  });

  it('no muestra la sección de PDV excluidos si la lista de excluidos está vacía', () => {
    const c: Criterios = { filtros: FILTROS_VACIOS, excluidos: [] };
    render(<ZoneItem {...baseProps({ zona: zona({ criterios: c }) })} />);

    fireEvent.click(screen.getByText('Ver con qué criterio se creó'));

    expect(screen.queryByText('PDV excluidos:')).not.toBeInTheDocument();
  });

  it('el botón de criterios alterna el texto y muestra/oculta el detalle', () => {
    const c: Criterios = { filtros: { ...FILTROS_VACIOS, comercio: ['Almacén'] }, excluidos: [] };
    render(<ZoneItem {...baseProps({ zona: zona({ criterios: c }) })} />);

    const toggle = screen.getByText('Ver con qué criterio se creó');
    expect(screen.queryByText('Tipo PDV:')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText('Ocultar criterios')).toBeInTheDocument();
    expect(screen.getByText('Tipo PDV:')).toBeInTheDocument();
    expect(screen.getByText('Almacén')).toBeInTheDocument();
  });

  it('muestra los PDV excluidos a mano si el criterio tiene alguno', () => {
    const universo = [pdv({ id: 'E1', n: 'Excluido Uno' })];
    const c: Criterios = { filtros: FILTROS_VACIOS, excluidos: ['E1'] };
    render(<ZoneItem {...baseProps({ zona: zona({ criterios: c }), universoPdv: universo })} />);

    fireEvent.click(screen.getByText('Ver con qué criterio se creó'));

    expect(screen.getByText('PDV excluidos:')).toBeInTheDocument();
    expect(screen.getByText('E1 - Excluido Uno')).toBeInTheDocument();
  });

  it('el botón "Aplicar estos filtros" solo aparece si hay criterios y llama a onAplicarCriterios', () => {
    const onAplicarCriterios = vi.fn();
    const c: Criterios = { filtros: FILTROS_VACIOS, excluidos: [] };
    render(<ZoneItem {...baseProps({ zona: zona({ criterios: c }), onAplicarCriterios })} />);

    fireEvent.click(screen.getByText('Ver con qué criterio se creó'));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar estos filtros' }));

    expect(onAplicarCriterios).toHaveBeenCalled();
  });

  it('sin criterios (zona vieja), no muestra el botón de aplicar filtros', () => {
    render(<ZoneItem {...baseProps({ zona: zona({ criterios: null }) })} />);

    fireEvent.click(screen.getByText('Ver con qué criterio se creó'));

    expect(screen.queryByRole('button', { name: 'Aplicar estos filtros' })).not.toBeInTheDocument();
    expect(screen.getByText('Sin datos de criterio (zona creada antes de esta función)')).toBeInTheDocument();
  });
});
