import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoneConfirmDialog } from './ZoneConfirmDialog';

function baseProps(overrides: Partial<Parameters<typeof ZoneConfirmDialog>[0]> = {}) {
  return {
    open: true,
    defaultNombre: 'Zona 1',
    cantidadPdv: 10,
    facturacionTotal: 150000,
    rangoVentas: { desde: '2025-07-28', hasta: '2026-07-28' },
    solapamiento: 0,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('ZoneConfirmDialog', () => {
  it('no renderiza nada si open=false', () => {
    render(<ZoneConfirmDialog {...baseProps({ open: false })} />);
    expect(screen.queryByText('Nueva zona')).not.toBeInTheDocument();
  });

  it('muestra el nombre por defecto, la cantidad de PDV y la facturación formateada', () => {
    render(<ZoneConfirmDialog {...baseProps({ defaultNombre: 'Zona Norte', cantidadPdv: 1234, facturacionTotal: 150000 })} />);

    expect(screen.getByDisplayValue('Zona Norte')).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
    expect(screen.getByText(/150.000/)).toBeInTheDocument();
  });

  it('el label de facturación muestra el rango de fechas filtrado, no un "(12m)" fijo', () => {
    render(<ZoneConfirmDialog {...baseProps({ rangoVentas: { desde: '2025-07-28', hasta: '2026-07-28' } })} />);
    expect(screen.getByText('Facturación (28/07/2025–28/07/2026)')).toBeInTheDocument();
  });

  it('no muestra la advertencia de solapamiento si es 0', () => {
    render(<ZoneConfirmDialog {...baseProps({ solapamiento: 0 })} />);
    expect(screen.queryByText(/incluido en otra zona/)).not.toBeInTheDocument();
  });

  it('muestra la advertencia en singular si solapamiento es 1', () => {
    render(<ZoneConfirmDialog {...baseProps({ solapamiento: 1 })} />);
    expect(screen.getByText(/cliente de esta zona ya está incluido/)).toBeInTheDocument();
  });

  it('muestra la advertencia en plural (clientes/están) si solapamiento es mayor a 1', () => {
    render(<ZoneConfirmDialog {...baseProps({ solapamiento: 3 })} />);
    expect(screen.getByText(/clientes de esta zona ya están incluido/)).toBeInTheDocument();
  });

  it('el botón Crear zona está deshabilitado si el nombre queda vacío', () => {
    render(<ZoneConfirmDialog {...baseProps({ defaultNombre: 'Zona 1' })} />);

    fireEvent.change(screen.getByDisplayValue('Zona 1'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'Crear zona' })).toBeDisabled();
  });

  it('confirma con el nombre recortado al clickear Crear zona', () => {
    const onConfirm = vi.fn();
    render(<ZoneConfirmDialog {...baseProps({ defaultNombre: 'Zona 1', onConfirm })} />);

    fireEvent.change(screen.getByDisplayValue('Zona 1'), { target: { value: '  Zona Renombrada  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear zona' }));

    expect(onConfirm).toHaveBeenCalledWith('Zona Renombrada');
  });

  it('confirma al presionar Enter en el input', () => {
    const onConfirm = vi.fn();
    render(<ZoneConfirmDialog {...baseProps({ defaultNombre: 'Zona 1', onConfirm })} />);

    const input = screen.getByDisplayValue('Zona 1');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onConfirm).toHaveBeenCalledWith('Zona 1');
  });

  it('cancela al clickear Cancelar', () => {
    const onCancel = vi.fn();
    render(<ZoneConfirmDialog {...baseProps({ onCancel })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('resetea el nombre al defaultNombre cuando se vuelve a abrir', () => {
    const { rerender } = render(<ZoneConfirmDialog {...baseProps({ open: true, defaultNombre: 'Zona A' })} />);
    fireEvent.change(screen.getByDisplayValue('Zona A'), { target: { value: 'Editado' } });

    rerender(<ZoneConfirmDialog {...baseProps({ open: false, defaultNombre: 'Zona A' })} />);
    rerender(<ZoneConfirmDialog {...baseProps({ open: true, defaultNombre: 'Zona B' })} />);

    expect(screen.getByDisplayValue('Zona B')).toBeInTheDocument();
  });
});
