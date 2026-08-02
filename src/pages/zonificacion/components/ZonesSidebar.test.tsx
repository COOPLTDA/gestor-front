import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZonesSidebar } from './ZonesSidebar';
import type { Criterios, Pdv, Zona } from '../types';
import { FILTROS_VACIOS } from '../types';

vi.mock('./ZoneItem', () => ({
  ZoneItem: (props: any) => (
    <div data-testid="zone-item" data-disabled={String(props.disabled)} data-editing={String(props.isEditing)}>
      {props.zona.nombre} ({props.pts.length} pts)
      <button onClick={props.onStartEdit}>start-edit</button>
      <button onClick={() => props.onRename('Renombrado')}>rename</button>
      <button onClick={props.onDelete}>delete</button>
      <button onClick={props.onAplicarCriterios}>aplicar</button>
    </div>
  ),
}));

function zona(overrides: Partial<Zona> = {}): Zona {
  return {
    nombre: 'Zona', color: '#000',
    vertices: [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }],
    criterios: null,
    ...overrides,
  };
}

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente', dir: '', com: null, loc: '', par: '',
    lat: 5, lng: 5, desactivado: false, vnd_cod: null, vnd_nombre: null, dia: null, frq: null, reparto: null,
    vendedores: [], facturacion: 0, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

function baseProps(overrides: Partial<Parameters<typeof ZonesSidebar>[0]> = {}) {
  return {
    zonas: [] as Zona[],
    pdv: [] as Pdv[],
    universoPdv: [] as Pdv[],
    editingIndex: null,
    readOnly: false,
    onStartEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onAplicarCriterios: vi.fn(),
    ...overrides,
  };
}

describe('ZonesSidebar', () => {
  it('muestra un mensaje si no hay zonas', () => {
    render(<ZonesSidebar {...baseProps({ zonas: [] })} />);
    expect(screen.getByText('Ninguna zona aún.')).toBeInTheDocument();
  });

  it('renderiza un ZoneItem por zona, con los puntos que caen adentro de cada una', () => {
    const dentro = pdv({ id: '1', lat: 5, lng: 5 });
    const fuera = pdv({ id: '2', lat: 50, lng: 50 });
    render(<ZonesSidebar {...baseProps({ zonas: [zona({ nombre: 'Zona A' })], pdv: [dentro, fuera] })} />);

    expect(screen.getByText('Zona A (1 pts)')).toBeInTheDocument();
  });

  it('pasa isEditing=true solo al índice que coincide con editingIndex', () => {
    render(<ZonesSidebar {...baseProps({ zonas: [zona({ nombre: 'A' }), zona({ nombre: 'B' })], editingIndex: 1 })} />);

    const items = screen.getAllByTestId('zone-item');
    expect(items[0].dataset.editing).toBe('false');
    expect(items[1].dataset.editing).toBe('true');
  });

  it('deshabilita todas las zonas que no están en edición mientras otra sí lo está', () => {
    render(<ZonesSidebar {...baseProps({ zonas: [zona({ nombre: 'A' }), zona({ nombre: 'B' })], editingIndex: 0 })} />);

    const items = screen.getAllByTestId('zone-item');
    expect(items[0].dataset.disabled).toBe('false');
    expect(items[1].dataset.disabled).toBe('true');
  });

  it('deshabilita todas las zonas si readOnly=true, incluso sin edición activa', () => {
    render(<ZonesSidebar {...baseProps({ zonas: [zona()], readOnly: true })} />);
    expect(screen.getByTestId('zone-item').dataset.disabled).toBe('true');
  });

  it('onStartEdit/onRename/onDelete se llaman con el índice correspondiente', () => {
    const onStartEdit = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(<ZonesSidebar {...baseProps({ zonas: [zona({ nombre: 'A' }), zona({ nombre: 'B' })], onStartEdit, onRename, onDelete })} />);

    const items = screen.getAllByTestId('zone-item');
    fireEvent.click(items[1].querySelector('button')!); // start-edit de la segunda
    expect(onStartEdit).toHaveBeenCalledWith(1);

    fireEvent.click(items[1].querySelectorAll('button')[1]); // rename
    expect(onRename).toHaveBeenCalledWith(1, 'Renombrado');

    fireEvent.click(items[1].querySelectorAll('button')[2]); // delete
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('onAplicarCriterios solo se llama si la zona tiene criterios', () => {
    const onAplicarCriterios = vi.fn();
    const c: Criterios = { filtros: FILTROS_VACIOS, excluidos: [] };
    render(<ZonesSidebar {...baseProps({ zonas: [zona({ criterios: null }), zona({ criterios: c })], onAplicarCriterios })} />);

    const items = screen.getAllByTestId('zone-item');
    fireEvent.click(items[0].querySelectorAll('button')[3]); // sin criterios
    expect(onAplicarCriterios).not.toHaveBeenCalled();

    fireEvent.click(items[1].querySelectorAll('button')[3]); // con criterios
    expect(onAplicarCriterios).toHaveBeenCalledWith(c);
  });
});
