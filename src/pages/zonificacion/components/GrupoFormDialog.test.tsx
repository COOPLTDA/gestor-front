import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrupoFormDialog } from './GrupoFormDialog';
import type { Grupo } from '../types';

function grupo(overrides: Partial<Grupo> = {}): Grupo {
  return {
    id: 1, nombre: 'Grupo 1', tipo: 'ruta_flete',
    creadoPor: { id: 7, nombre: 'Ana Owner' }, editablePorOtros: false, zonas: [],
    ...overrides,
  };
}

function baseProps(overrides: Partial<Parameters<typeof GrupoFormDialog>[0]> = {}) {
  return {
    open: true,
    grupo: null as Grupo | null,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('GrupoFormDialog', () => {
  it('no renderiza nada si open=false', () => {
    render(<GrupoFormDialog {...baseProps({ open: false })} />);
    expect(screen.queryByText('Nuevo grupo de zonas')).not.toBeInTheDocument();
  });

  it('modo creación: título "Nuevo grupo de zonas", campos vacíos, sin fila de dueño', () => {
    render(<GrupoFormDialog {...baseProps({ grupo: null })} />);

    expect(screen.getByText('Nuevo grupo de zonas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeInTheDocument();
    expect(screen.queryByText(/Dueño:/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('modo edición: título "Editar grupo", precarga los valores del grupo y muestra el dueño', () => {
    render(<GrupoFormDialog {...baseProps({ grupo: grupo({ nombre: 'Rutas CABA', editablePorOtros: true }) })} />);

    expect(screen.getByText('Editar grupo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rutas CABA')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Dueño: Ana Owner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it('dueño sin nombre cae al fallback "usuario #id"', () => {
    render(<GrupoFormDialog {...baseProps({ grupo: grupo({ creadoPor: { id: 42, nombre: null } }) })} />);
    expect(screen.getByText('Dueño: usuario #42')).toBeInTheDocument();
  });

  it('el botón de submit está deshabilitado si el nombre queda vacío', () => {
    render(<GrupoFormDialog {...baseProps({ grupo: grupo({ nombre: 'X' }) })} />);

    fireEvent.change(screen.getByDisplayValue('X'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('onSubmit recibe el nombre recortado y los demás valores tal cual', () => {
    const onSubmit = vi.fn();
    render(<GrupoFormDialog {...baseProps({ grupo: grupo({ nombre: 'X', tipo: 'ruta_vendedor', editablePorOtros: true }), onSubmit })} />);

    fireEvent.change(screen.getByDisplayValue('X'), { target: { value: '  Renombrado  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith({ nombre: 'Renombrado', tipo: 'ruta_vendedor', editablePorOtros: true });
  });

  it('Enter en el input de nombre confirma igual que el botón', () => {
    const onSubmit = vi.fn();
    render(<GrupoFormDialog {...baseProps({ grupo: grupo({ nombre: 'X' }), onSubmit })} />);

    fireEvent.keyDown(screen.getByDisplayValue('X'), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'X' }));
  });

  it('tildar/destildar el checkbox actualiza editablePorOtros', () => {
    const onSubmit = vi.fn();
    render(<GrupoFormDialog {...baseProps({ grupo: grupo({ nombre: 'X', editablePorOtros: false }), onSubmit })} />);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ editablePorOtros: true }));
  });

  it('cancela al clickear Cancelar', () => {
    const onClose = vi.fn();
    render(<GrupoFormDialog {...baseProps({ onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('cerrar el diálogo con Escape también llama a onClose', () => {
    const onClose = vi.fn();
    render(<GrupoFormDialog {...baseProps({ onClose })} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('crea con tipo por defecto "ruta_flete" cuando no se toca el selector', () => {
    const onSubmit = vi.fn();
    render(<GrupoFormDialog {...baseProps({ grupo: null, onSubmit })} />);

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }));

    expect(onSubmit).toHaveBeenCalledWith({ nombre: 'Nuevo', tipo: 'ruta_flete', editablePorOtros: false });
  });

  it('cambiar el tipo desde el selector real actualiza el valor enviado', async () => {
    const onSubmit = vi.fn();
    render(<GrupoFormDialog {...baseProps({ grupo: grupo({ nombre: 'X', tipo: 'ruta_flete' }), onSubmit })} />);

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Reestructuración'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'reestructuracion' }));
  });

  it('destildar el checkbox vuelve editablePorOtros a false', () => {
    const onSubmit = vi.fn();
    render(<GrupoFormDialog {...baseProps({ grupo: grupo({ nombre: 'X', editablePorOtros: true }), onSubmit })} />);

    fireEvent.click(screen.getByRole('checkbox')); // ya viene tildado, lo destilda
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ editablePorOtros: false }));
  });

  it('no resetea los valores mientras el diálogo permanece cerrado', () => {
    const { rerender } = render(<GrupoFormDialog {...baseProps({ open: true, grupo: grupo({ nombre: 'Grupo A' }) })} />);
    fireEvent.change(screen.getByDisplayValue('Grupo A'), { target: { value: 'Editado' } });

    // sigue cerrado -> abierto sin cambiar de grupo: los valores no se tocan hasta reabrir
    rerender(<GrupoFormDialog {...baseProps({ open: false, grupo: grupo({ nombre: 'Grupo A' }) })} />);
    rerender(<GrupoFormDialog {...baseProps({ open: false, grupo: grupo({ nombre: 'Grupo A' }) })} />);
    rerender(<GrupoFormDialog {...baseProps({ open: true, grupo: grupo({ nombre: 'Grupo A' }) })} />);

    expect(screen.getByDisplayValue('Grupo A')).toBeInTheDocument();
  });

  it('al reabrir con un grupo distinto, resetea los valores al nuevo grupo', () => {
    const { rerender } = render(<GrupoFormDialog {...baseProps({ open: true, grupo: grupo({ nombre: 'Grupo A' }) })} />);
    fireEvent.change(screen.getByDisplayValue('Grupo A'), { target: { value: 'Editado' } });

    rerender(<GrupoFormDialog {...baseProps({ open: false, grupo: grupo({ nombre: 'Grupo A' }) })} />);
    rerender(<GrupoFormDialog {...baseProps({ open: true, grupo: grupo({ nombre: 'Grupo B' }) })} />);

    expect(screen.getByDisplayValue('Grupo B')).toBeInTheDocument();
  });

  it('al reabrir en modo creación (sin grupo), vuelve a los valores vacíos', () => {
    const { rerender } = render(<GrupoFormDialog {...baseProps({ open: true, grupo: grupo({ nombre: 'Grupo A' }) })} />);

    rerender(<GrupoFormDialog {...baseProps({ open: false, grupo: null })} />);
    rerender(<GrupoFormDialog {...baseProps({ open: true, grupo: null })} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByText('Nuevo grupo de zonas')).toBeInTheDocument();
  });
});
