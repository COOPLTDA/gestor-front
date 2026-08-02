import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonalizadoView } from './PersonalizadoView';
import type { RepartosMostrado } from './RepartosTable';

function baseProps(over: Partial<Parameters<typeof PersonalizadoView>[0]> = {}) {
  return {
    loading: false,
    personalChoferes: [] as string[],
    setPersonalChoferes: vi.fn(),
    personalChoferesDisponibles: [
      { codigo: 'CH1', nombre: 'García' },
      { codigo: 'CH2', nombre: 'López' },
    ],
    personalGruposFiltradosLength: 0,
    personalFlatMostrados: [] as RepartosMostrado[],
    codigoOverrides: {},
    onChangeCodigo: vi.fn(),
    expandidos: new Set<string>(),
    onToggleExpandir: vi.fn(),
    ...over,
  };
}

describe('PersonalizadoView — sidebar de choferes', () => {
  it('muestra la cantidad de seleccionados, en singular cuando es 1', () => {
    render(<PersonalizadoView {...baseProps({ personalChoferes: ['CH1'] })} />);
    expect(screen.getByText(/1 seleccionado(?!s)/)).toBeInTheDocument();
  });

  it('muestra la cantidad de seleccionados, en plural cuando son 2', () => {
    render(<PersonalizadoView {...baseProps({ personalChoferes: ['CH1', 'CH2'] })} />);
    expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
  });

  it('mientras carga, muestra el spinner en el sidebar en vez de la lista', () => {
    const { container } = render(<PersonalizadoView {...baseProps({ loading: true })} />);
    expect(container.querySelector('.w-52 .animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('García')).not.toBeInTheDocument();
  });

  it('sin choferes disponibles, muestra el mensaje de "sin preparaciones"', () => {
    render(<PersonalizadoView {...baseProps({ personalChoferesDisponibles: [] })} />);
    expect(screen.getByText('Sin preparaciones asignadas')).toBeInTheDocument();
  });

  it('con choferes disponibles, lista cada uno y el checkbox "Todos"', () => {
    render(<PersonalizadoView {...baseProps()} />);
    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.getByText('López')).toBeInTheDocument();
  });

  it('"Todos" aparece tildado solo cuando están todos los choferes seleccionados', () => {
    render(<PersonalizadoView {...baseProps({ personalChoferes: ['CH1', 'CH2'] })} />);
    const todosCheckbox = screen.getByText('Todos').closest('label')!.querySelector('input')!;
    expect(todosCheckbox).toBeChecked();
  });

  it('"Todos" NO aparece tildado si falta seleccionar alguno', () => {
    render(<PersonalizadoView {...baseProps({ personalChoferes: ['CH1'] })} />);
    const todosCheckbox = screen.getByText('Todos').closest('label')!.querySelector('input')!;
    expect(todosCheckbox).not.toBeChecked();
  });

  it('tildar "Todos" selecciona los códigos de todos los disponibles', () => {
    const setPersonalChoferes = vi.fn();
    render(<PersonalizadoView {...baseProps({ setPersonalChoferes })} />);
    const todosCheckbox = screen.getByText('Todos').closest('label')!.querySelector('input')!;
    fireEvent.click(todosCheckbox);
    expect(setPersonalChoferes).toHaveBeenCalledWith(['CH1', 'CH2']);
  });

  it('destildar "Todos" vacía la selección', () => {
    const setPersonalChoferes = vi.fn();
    render(<PersonalizadoView {...baseProps({ personalChoferes: ['CH1', 'CH2'], setPersonalChoferes })} />);
    const todosCheckbox = screen.getByText('Todos').closest('label')!.querySelector('input')!;
    fireEvent.click(todosCheckbox);
    expect(setPersonalChoferes).toHaveBeenCalledWith([]);
  });

  it('tildar un chofer no seleccionado lo agrega a la lista', () => {
    const setPersonalChoferes = vi.fn();
    render(<PersonalizadoView {...baseProps({ personalChoferes: ['CH1'], setPersonalChoferes })} />);
    fireEvent.click(screen.getByText('López').closest('label')!.querySelector('input')!);
    expect(setPersonalChoferes.mock.calls[0][0](['CH1'])).toEqual(['CH1', 'CH2']);
  });

  it('destildar un chofer ya seleccionado lo quita de la lista', () => {
    const setPersonalChoferes = vi.fn();
    render(<PersonalizadoView {...baseProps({ personalChoferes: ['CH1', 'CH2'], setPersonalChoferes })} />);
    fireEvent.click(screen.getByText('García').closest('label')!.querySelector('input')!);
    expect(setPersonalChoferes.mock.calls[0][0](['CH1', 'CH2'])).toEqual(['CH2']);
  });
});

describe('PersonalizadoView — área de tabla', () => {
  it('mientras carga, muestra el spinner grande en vez del contenido', () => {
    const { container } = render(<PersonalizadoView {...baseProps({ loading: true })} />);
    expect(container.querySelector('.flex-1.overflow-y-auto.p-6 .animate-spin')).toBeInTheDocument();
  });

  it('sin choferes seleccionados, pide elegir en el panel izquierdo', () => {
    render(<PersonalizadoView {...baseProps({ personalChoferes: [] })} />);
    expect(screen.getByText('Seleccioná choferes en el panel izquierdo')).toBeInTheDocument();
  });

  it('con choferes seleccionados pero sin grupos filtrados, avisa que no hay preparaciones', () => {
    render(<PersonalizadoView {...baseProps({ personalChoferes: ['CH1'], personalGruposFiltradosLength: 0 })} />);
    expect(screen.getByText('Los choferes seleccionados no tienen preparaciones en esta biblia')).toBeInTheDocument();
  });

  it('con grupos filtrados, renderiza la tabla de repartos con los props pasados', () => {
    const mostrados: RepartosMostrado[] = [{ direccion: 'Mi reporte', grupos: [] }];
    render(<PersonalizadoView {...baseProps({
      personalChoferes: ['CH1'],
      personalGruposFiltradosLength: 1,
      personalFlatMostrados: mostrados,
    })} />);
    expect(screen.getByText('Mi reporte')).toBeInTheDocument();
  });
});
