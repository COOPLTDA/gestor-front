import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResumenView } from './ResumenView';
import type { ResumenChofer } from '@/services/bibliaApi';

function makeResumen(over: Partial<ResumenChofer> = {}): ResumenChofer {
  return {
    chofer_codigo: 'CH1',
    chofer_nombre: 'García',
    total_importe: 1500,
    total_pedidos: 3,
    total_clientes: 2,
    total_peso: 0,
    total_volumen: 0,
    codigos_despacho: [],
    preps: [],
    ...over,
  } as ResumenChofer;
}

describe('ResumenView', () => {
  it('mientras carga, muestra el spinner y no la grilla', () => {
    const { container } = render(<ResumenView resumenLoading={true} resumenEntries={[]} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('sin choferes, muestra el mensaje de vacío', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[]} />);
    expect(screen.getByText('No hay choferes asignados a esta biblia')).toBeInTheDocument();
  });

  it('con choferes, muestra nombre, código, importe formateado y cantidad de preparaciones', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({ preps: [{ id: 1 }, { id: 2 }] as never })]} />);
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.getByText('CH1')).toBeInTheDocument();
    expect(screen.getByText(/\$\s?1\.500/)).toBeInTheDocument();
    expect(screen.getByText('2p')).toBeInTheDocument();
  });

  it('muestra pedidos y clientes', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({ total_pedidos: 7, total_clientes: 4 })]} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('con peso > 0, muestra los kg con 2 decimales', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({ total_peso: 12.5 })]} />);
    expect(screen.getByText(/12,50/)).toBeInTheDocument();
    expect(screen.getByText(/kg/)).toBeInTheDocument();
  });

  it('con peso === 0, no muestra la fila de kg', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({ total_peso: 0 })]} />);
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
  });

  it('con volumen > 0, muestra los m³ con 3 decimales', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({ total_volumen: 3.4567 })]} />);
    expect(screen.getByText(/3,457/)).toBeInTheDocument();
  });

  it('con volumen === 0, no muestra la fila de m³', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({ total_volumen: 0 })]} />);
    expect(screen.queryByText(/m³/)).not.toBeInTheDocument();
  });

  it('con códigos de despacho, los lista', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({ codigos_despacho: ['COD1', 'COD2'] })]} />);
    expect(screen.getByText('COD1')).toBeInTheDocument();
    expect(screen.getByText('COD2')).toBeInTheDocument();
  });

  it('sin códigos de despacho, no renderiza esa sección', () => {
    const { container } = render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({ codigos_despacho: [] })]} />);
    expect(container.querySelector('.bg-blue-50')).not.toBeInTheDocument();
  });

  it('cada preparación muestra el código de envío formateado con importe', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({
      preps: [{ id: 42, codigo_envio: 'ENV-1', importe_total: 500, estado: 'entregado' }] as never,
    })]} />);
    expect(screen.getByText('ENV-1')).toBeInTheDocument();
    expect(screen.getByText(/\$\s?500/)).toBeInTheDocument();
  });

  it('si la preparación no tiene código de envío, usa "#id"', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({
      preps: [{ id: 42, codigo_envio: null, importe_total: 500, estado: null }] as never,
    })]} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  it('el punto de estado usa la clase de ESTADO_DOT correspondiente, sin importar mayúsculas/minúsculas', () => {
    const { container } = render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({
      preps: [{ id: 1, codigo_envio: 'E1', importe_total: 100, estado: 'COMPLETADA' }] as never,
    })]} />);
    const dot = container.querySelector('.w-2.h-2.rounded-full');
    expect(dot?.className).toContain('bg-emerald-500');
  });

  it('con estado desconocido/null, el punto usa el color por defecto', () => {
    const { container } = render(<ResumenView resumenLoading={false} resumenEntries={[makeResumen({
      preps: [{ id: 1, codigo_envio: 'E1', importe_total: 100, estado: null }] as never,
    })]} />);
    const dot = container.querySelector('.w-2.h-2.rounded-full');
    expect(dot?.className).toContain('bg-slate-300');
  });

  it('cada tarjeta usa el código de chofer como key (renderiza una por entrada)', () => {
    render(<ResumenView resumenLoading={false} resumenEntries={[
      makeResumen({ chofer_codigo: 'CH1', chofer_nombre: 'García' }),
      makeResumen({ chofer_codigo: 'CH2', chofer_nombre: 'López' }),
    ]} />);
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.getByText('López')).toBeInTheDocument();
  });
});
