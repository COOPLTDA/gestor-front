import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupsPanel } from './GroupsPanel';
import type { Grupo } from '../types';

vi.mock('./GrupoFormDialog', () => ({
  GrupoFormDialog: (props: any) => (
    props.open ? (
      <div data-testid="dialog" data-grupo-id={props.grupo?.id ?? 'null'}>
        <button onClick={() => props.onSubmit({ nombre: 'Enviado', tipo: 'ruta_flete', editablePorOtros: false })}>submit</button>
        <button onClick={props.onClose}>close</button>
      </div>
    ) : null
  ),
}));

function grupo(overrides: Partial<Grupo> = {}): Grupo {
  return {
    id: 1, nombre: 'Grupo 1', tipo: 'ruta_flete',
    creadoPor: { id: 7, nombre: 'Ana' }, editablePorOtros: false, zonas: [],
    ...overrides,
  };
}

function baseProps(overrides: Partial<Parameters<typeof GroupsPanel>[0]> = {}) {
  return {
    grupos: [] as Grupo[],
    activeId: null,
    puedeEditar: () => true,
    onSwitch: vi.fn(),
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

// El listado de grupos vive en un modal (para no ocupar espacio permanente en el
// panel lateral) — hay que abrirlo con el botón "Grupos" antes de ver sus items.
function abrirModal() {
  fireEvent.click(screen.getByRole('button', { name: /^Grupos/ }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('GroupsPanel', () => {
  it('muestra "Sin grupo activo" cuando no hay ninguno activo', () => {
    render(<GroupsPanel {...baseProps({ grupos: [], activeId: null })} />);
    expect(screen.getByText('Sin grupo activo')).toBeInTheDocument();
  });

  it('muestra el nombre del grupo activo fuera del modal', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 1, nombre: 'Rutas CABA' })], activeId: 1 })} />);
    expect(screen.getByText('Rutas CABA')).toBeInTheDocument();
    expect(screen.queryByText('Sin grupo activo')).not.toBeInTheDocument();
  });

  it('muestra tipo, dueño, cantidad de zonas y "compartido" del grupo activo fuera del modal', () => {
    render(<GroupsPanel {...baseProps({
      grupos: [grupo({
        id: 1,
        nombre: 'Rutas CABA',
        creadoPor: { id: 7, nombre: 'Ana' },
        editablePorOtros: true,
        zonas: [{ nombre: 'Z', color: '#000', vertices: [], criterios: null }],
      })],
      activeId: 1,
    })} />);

    expect(screen.getByText('1 zona(s) · Ruta Flete · Ana · compartido')).toBeInTheDocument();
  });

  it('no muestra la línea de detalle si no hay grupo activo', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 1 })], activeId: null })} />);
    expect(screen.queryByText(/zona\(s\)/)).not.toBeInTheDocument();
  });

  it('el botón "Grupos" indica la cantidad de grupos', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 1 }), grupo({ id: 2 })] })} />);
    expect(screen.getByRole('button', { name: 'Grupos (2)' })).toBeInTheDocument();
  });

  it('muestra un mensaje si no hay grupos', () => {
    render(<GroupsPanel {...baseProps({ grupos: [] })} />);
    abrirModal();
    expect(screen.getByText('Sin grupos aún. Creá uno para empezar.')).toBeInTheDocument();
  });

  it('lista los grupos con su tipo, dueño y cantidad de zonas', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ nombre: 'Rutas CABA', zonas: [{ nombre: 'Z', color: '#000', vertices: [], criterios: null }] })] })} />);
    abrirModal();

    expect(screen.getAllByText('Rutas CABA').length).toBeGreaterThan(0);
    expect(screen.getByText('1 zona(s)')).toBeInTheDocument();
    expect(screen.getByText(/Ruta Flete · Ana/)).toBeInTheDocument();
  });

  it('agrega "· compartido" si el grupo es editablePorOtros', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ editablePorOtros: true })] })} />);
    abrirModal();
    expect(screen.getByText(/· compartido/)).toBeInTheDocument();
  });

  it('no agrega "· compartido" si no lo es', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ editablePorOtros: false })] })} />);
    abrirModal();
    expect(screen.queryByText(/compartido/)).not.toBeInTheDocument();
  });

  it('dueño sin nombre cae al fallback "usuario #id"', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ creadoPor: { id: 42, nombre: null } })] })} />);
    abrirModal();
    expect(screen.getByText(/usuario #42/)).toBeInTheDocument();
  });

  it('marca el grupo activo con "activo" en vez del botón Activar', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 1 })], activeId: 1 })} />);
    abrirModal();
    expect(screen.getByText('● activo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });

  it('clickear la fila de un grupo no activo llama a onSwitch con su id', () => {
    const onSwitch = vi.fn();
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 5, nombre: 'Rutas Norte' })], activeId: null, onSwitch })} />);
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: /Rutas Norte/ }));

    expect(onSwitch).toHaveBeenCalledWith(5);
  });

  it('clickear la fila del grupo ya activo no vuelve a llamar a onSwitch', () => {
    const onSwitch = vi.fn();
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 5, nombre: 'Rutas Norte' })], activeId: 5, onSwitch })} />);
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: /Rutas Norte/ }));

    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('clickear Editar o Eliminar no dispara también el switch de grupo (stopPropagation)', () => {
    const onSwitch = vi.fn();
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 5 })], activeId: null, onSwitch })} />);
    abrirModal();

    fireEvent.click(screen.getByTitle('Editar'));

    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('deshabilita editar/eliminar si puedeEditar devuelve false', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo()], puedeEditar: () => false })} />);
    abrirModal();

    expect(screen.getByTitle('Editar')).toBeDisabled();
    expect(screen.getByTitle('Eliminar')).toBeDisabled();
  });

  it('eliminar pide confirmación y solo llama a onDelete si se confirma', () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 3, nombre: 'A borrar' })], onDelete })} />);
    abrirModal();

    fireEvent.click(screen.getByTitle('Eliminar'));
    expect(window.confirm).toHaveBeenCalledWith('¿Eliminar el grupo "A borrar" y todas sus zonas?');
    expect(onDelete).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByTitle('Eliminar'));
    expect(onDelete).toHaveBeenCalledWith(3);
  });

  it('"+ Nuevo" (dentro del modal) abre el diálogo en modo creación (grupo=null)', () => {
    render(<GroupsPanel {...baseProps({ grupos: [] })} />);
    abrirModal();

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));

    expect(screen.getByTestId('dialog').dataset.grupoId).toBe('null');
  });

  it('"Editar" abre el diálogo con el grupo correspondiente', () => {
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 9 })] })} />);
    abrirModal();

    fireEvent.click(screen.getByTitle('Editar'));

    expect(screen.getByTestId('dialog').dataset.grupoId).toBe('9');
  });

  it('confirmar el diálogo en modo edición llama a onEdit con el id del grupo, no a onCreate', () => {
    const onEdit = vi.fn();
    const onCreate = vi.fn();
    render(<GroupsPanel {...baseProps({ grupos: [grupo({ id: 9 })], onEdit, onCreate })} />);
    abrirModal();

    fireEvent.click(screen.getByTitle('Editar'));
    fireEvent.click(screen.getByText('submit'));

    expect(onEdit).toHaveBeenCalledWith(9, { nombre: 'Enviado', tipo: 'ruta_flete', editablePorOtros: false });
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('confirmar el diálogo en modo creación llama a onCreate, no a onEdit', () => {
    const onEdit = vi.fn();
    const onCreate = vi.fn();
    render(<GroupsPanel {...baseProps({ grupos: [], onEdit, onCreate })} />);
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));
    fireEvent.click(screen.getByText('submit'));

    expect(onCreate).toHaveBeenCalledWith({ nombre: 'Enviado', tipo: 'ruta_flete', editablePorOtros: false });
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('cerrar el diálogo sin confirmar no llama ni a onCreate ni a onEdit', () => {
    const onEdit = vi.fn();
    const onCreate = vi.fn();
    render(<GroupsPanel {...baseProps({ grupos: [], onEdit, onCreate })} />);
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));
    fireEvent.click(screen.getByText('close'));

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('asigna colores de grupo cíclicamente cada 8 grupos', () => {
    const grupos = Array.from({ length: 9 }, (_, i) => grupo({ id: i + 1, nombre: `G${i + 1}` }));
    render(<GroupsPanel {...baseProps({ grupos })} />);
    abrirModal();

    const primero = screen.getByText('G1').style.color;
    const noveno = screen.getByText('G9').style.color;
    expect(primero).toBe(noveno);
  });
});
