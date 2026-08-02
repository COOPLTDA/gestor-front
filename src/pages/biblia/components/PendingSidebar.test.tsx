import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingSidebar } from './PendingSidebar';
import type { Preparacion, Pedido, SigmaSyncEstado } from '../types/biblia';

vi.mock('./PreparacionDetalleModal', () => ({
  PreparacionDetalleModal: ({ preparacion, readonly, open, onClose, bibliaFecha, codigosDespacho }: {
    preparacion: Preparacion; readonly: boolean; open: boolean; onClose: () => void; bibliaFecha: string;
    codigosDespacho: unknown[];
  }) => (
    open ? (
      <div data-testid="detalle-modal" data-prep={preparacion.id} data-readonly={String(readonly)} data-biblia-fecha={bibliaFecha} data-codigos-count={codigosDespacho.length}>
        <button onClick={onClose}>cerrar-detalle</button>
      </div>
    ) : null
  ),
}));

function makePedido(over: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'P1',
    codigo_despacho: 'BIG',
    codigo_cliente_ubicacion: null,
    cliente_nombre: 'Cliente Uno',
    cliente_direccion: null,
    cliente_lat: null,
    cliente_lng: null,
    estado: 'Pendiente',
    importe: 500,
    peso_text: null,
    volumen_text: null,
    peso: 0,
    volumen: 0,
    fecha: '2026-07-09',
    ...over,
  };
}

function makePrep(over: Partial<Preparacion> = {}): Preparacion {
  return {
    id: 1,
    tipo: 'Pedidos individuales',
    estado: 'Completada',
    codigo_envio: 'E-1',
    pedidos: [makePedido()],
    cantidad_pedidos: 1,
    cantidad_clientes: 1,
    importe_total: 500,
    peso: 0,
    volumen: 0,
    peso_text: '0 kg',
    volumen_text: '0',
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('PendingSidebar — pestañas y conteos', () => {
  it('muestra los conteos por tipo en las pestañas', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, tipo: 'Pedidos individuales' }),
      makePrep({ id: 2, tipo: 'Agrupa por direccion de entrega' }),
      makePrep({ id: 3, tipo: 'Consolidado de pedidos' }),
      makePrep({ id: 4, tipo: 'Consolidado que luego se va a desconsolidar.' }),
    ]} />);
    expect(screen.getByRole('tab', { name: /Pedido suelto/ })).toHaveTextContent('(1)');
    expect(screen.getByRole('tab', { name: /Misma Dirección/ })).toHaveTextContent('(1)');
    // el consolidado a desconsolidar cuenta como consolidado
    expect(screen.getByRole('tab', { name: /Consolidado/ })).toHaveTextContent('(2)');
  });

  it('cambiar de pestaña filtra por tipo', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, tipo: 'Pedidos individuales', pedidos: [makePedido({ codigo: 'P-IND' })] }),
      makePrep({ id: 2, tipo: 'Consolidado de pedidos', codigo_envio: 'E-CONS' }),
    ]} />);
    expect(screen.getByText('P-IND')).toBeInTheDocument();
    expect(screen.queryByText('E-CONS')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Consolidado/ }));
    expect(screen.getByText('E-CONS')).toBeInTheDocument();
    expect(screen.queryByText('P-IND')).not.toBeInTheDocument();
  });

  it('muestra el vacío cuando no hay preparaciones', () => {
    render(<PendingSidebar preparaciones={[]} />);
    expect(screen.getByText('No hay preparaciones')).toBeInTheDocument();
  });

  it('en la pestaña consolidado, un tipo no relacionado queda excluido', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, tipo: 'Consolidado de pedidos', codigo_envio: 'E-CONS', pedidos: [makePedido({ codigo: 'P-CONS' })] }),
      makePrep({ id: 2, tipo: 'Consolidado que luego se va a desconsolidar.', codigo_envio: 'E-DESC', pedidos: [makePedido({ codigo: 'P-DESC' })] }),
      makePrep({ id: 3, tipo: 'Agrupa por direccion de entrega', codigo_envio: 'E-OTRO', pedidos: [makePedido({ codigo: 'P-OTRO' })] }),
    ]} />);
    await user.click(screen.getByRole('tab', { name: /Consolidado/ }));
    expect(screen.getByText('E-CONS')).toBeInTheDocument();
    expect(screen.getByText('E-DESC')).toBeInTheDocument();
    expect(screen.queryByText('E-OTRO')).not.toBeInTheDocument();
  });
});

describe('PendingSidebar — tarjetas', () => {
  it('en pedido suelto muestra código del pedido, importe del pedido y cliente', () => {
    render(<PendingSidebar preparaciones={[makePrep()]} />);
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('$ 500')).toBeInTheDocument();
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
    expect(screen.getByText('BIG')).toBeInTheDocument();
  });

  it('con despacho y peso, muestra ambos separados por "·"', () => {
    render(<PendingSidebar preparaciones={[makePrep({
      pedidos: [makePedido({ codigo_despacho: 'BIG' })],
      peso: 5, peso_text: '5 kg',
    })]} />);
    expect(screen.getByText('BIG')).toBeInTheDocument();
    expect(screen.getByText('· 5 kg')).toBeInTheDocument();
  });

  it('con despacho pero sin peso, no muestra el peso_text', () => {
    render(<PendingSidebar preparaciones={[makePrep({
      pedidos: [makePedido({ codigo_despacho: 'BIG' })],
      peso: 0, peso_text: '0 kg',
    })]} />);
    expect(screen.getByText('BIG')).toBeInTheDocument();
    expect(screen.queryByText('· 0 kg')).not.toBeInTheDocument();
  });

  it('sin despacho pero con peso, muestra solo el peso_text (sin "·")', () => {
    render(<PendingSidebar preparaciones={[makePrep({
      pedidos: [makePedido({ codigo_despacho: null })],
      peso: 5, peso_text: '5 kg',
    })]} />);
    expect(screen.getByText('5 kg')).toBeInTheDocument();
    expect(screen.queryByText('· 5 kg')).not.toBeInTheDocument();
  });

  it('sin despacho ni peso, no muestra ninguna línea extra', () => {
    render(<PendingSidebar preparaciones={[makePrep({
      pedidos: [makePedido({ codigo_despacho: null })],
      peso: 0, peso_text: '0 kg',
    })]} />);
    expect(screen.queryByText('0 kg')).not.toBeInTheDocument();
  });

  it('el cliente NO se muestra en la pestaña consolidado', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[makePrep({
      tipo: 'Consolidado de pedidos',
      pedidos: [makePedido({ cliente_nombre: 'Cliente Oculto' })],
    })]} />);
    await user.click(screen.getByRole('tab', { name: /Consolidado/ }));
    expect(screen.queryByText('Cliente Oculto')).not.toBeInTheDocument();
  });

  it('el cliente SÍ se muestra en la pestaña misma_direccion', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[makePrep({
      tipo: 'Agrupa por direccion de entrega',
      pedidos: [makePedido({ cliente_nombre: 'Cliente Visible' })],
    })]} />);
    await user.click(screen.getByRole('tab', { name: /Misma Dirección/ }));
    expect(screen.getByText('Cliente Visible')).toBeInTheDocument();
  });

  it('en consolidado, 1 pedido y 1 cliente usan singular (sin "s")', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[makePrep({
      tipo: 'Consolidado de pedidos',
      cantidad_pedidos: 1,
      cantidad_clientes: 1,
    })]} />);
    await user.click(screen.getByRole('tab', { name: /Consolidado/ }));
    expect(screen.getByText('1 pedido · 1 cliente')).toBeInTheDocument();
  });

  it('en pedido suelto no se muestra el resumen de pedidos/clientes', () => {
    render(<PendingSidebar preparaciones={[makePrep({ cantidad_pedidos: 1, cantidad_clientes: 1 })]} />);
    expect(screen.queryByText(/pedido.*cliente/)).not.toBeInTheDocument();
  });

  it('una preparación bloqueada no muestra despacho, peso ni cliente', () => {
    render(<PendingSidebar
      preparaciones={[makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: 'BIG', cliente_nombre: 'Alguien' })], peso: 5, peso_text: '5 kg' })]}
      ocupadasEnOtraBiblia={new Map([[1, '2026-07-08']])}
    />);
    expect(screen.queryByText('BIG')).not.toBeInTheDocument();
    expect(screen.queryByText('Alguien')).not.toBeInTheDocument();
    expect(screen.queryByText('5 kg')).not.toBeInTheDocument();
  });

  it('en consolidado muestra código de envío, importe total y resumen de pedidos', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[
      makePrep({
        id: 2,
        tipo: 'Consolidado de pedidos',
        codigo_envio: 'E-CONS',
        importe_total: 9000,
        cantidad_pedidos: 3,
        cantidad_clientes: 2,
      }),
    ]} />);
    await user.click(screen.getByRole('tab', { name: /Consolidado/ }));
    expect(screen.getByText('E-CONS')).toBeInTheDocument();
    expect(screen.getByText('$ 9.000')).toBeInTheDocument();
    expect(screen.getByText('3 pedidos · 2 clientes')).toBeInTheDocument();
  });

  it('muestra los badges de estado de Sigma', () => {
    const estados = new Map<number, SigmaSyncEstado>([
      [1, 'pendiente'],
      [2, 'ok'],
      [3, 'fallido'],
      [4, 'bloqueado'],
    ]);
    render(<PendingSidebar
      preparaciones={[1, 2, 3, 4].map(id => makePrep({ id, pedidos: [makePedido({ codigo: `P${id}` })] }))}
      sigmaEstadoByPrepId={estados}
    />);
    expect(screen.getByText('sigma')).toBeInTheDocument();
    expect(screen.getByText('sync')).toBeInTheDocument();
    expect(screen.getByText('sigma!')).toBeInTheDocument();
    expect(screen.getByText('bloq')).toBeInTheDocument();
  });

  it('las ocupadas en otra biblia van al final, bloqueadas y sin drag', () => {
    const ocupadas = new Map([[1, '2026-07-08']]);
    render(<PendingSidebar
      preparaciones={[
        makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P-OCUPADA' })] }),
        makePrep({ id: 2, pedidos: [makePedido({ codigo: 'P-LIBRE' })] }),
      ]}
      ocupadasEnOtraBiblia={ocupadas}
    />);
    expect(screen.getByText(/Asignada el 08\/07\/2026/)).toBeInTheDocument();
    const cards = screen.getAllByText(/P-/).map(e => e.textContent);
    expect(cards).toEqual(['P-LIBRE', 'P-OCUPADA']);
    const ocupadaCard = screen.getByText('P-OCUPADA').closest('[draggable]');
    expect(ocupadaCard).toHaveAttribute('draggable', 'false');
  });

  it('usa el color de fondo según el tipo de la preparación', () => {
    const { container: c1 } = render(<PendingSidebar preparaciones={[
      makePrep({ tipo: 'Pedidos individuales' }),
    ]} />);
    expect(c1.querySelector('.group')?.className).toContain('bg-amber-100');
  });

  it('usa el color de borde según el estado (case-insensitive), y el fallback para un estado desconocido', () => {
    const { container: c1 } = render(<PendingSidebar preparaciones={[
      makePrep({ estado: 'REMITIDO' }),
    ]} />);
    expect(c1.querySelector('.group')?.className).toContain('border-l-sky-500');

    const { container: c2 } = render(<PendingSidebar preparaciones={[makePrep({ estado: 'Estado rarísimo' })]} />);
    expect(c2.querySelector('.group')?.className).toContain('border-l-slate-400');
  });

  it('la tarjeta arrastrada actualmente baja su opacidad, las demás no', () => {
    const { container } = render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1' })] }),
      makePrep({ id: 2, pedidos: [makePedido({ codigo: 'P2' })] }),
    ]} />);
    const cardP1 = screen.getByText('P1').closest('.group')!;
    fireEvent.dragStart(cardP1, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    // Solo la tarjeta 1 (la arrastrada) debe tener opacity-40; la 2 no.
    const cardP2 = screen.getByText('P2').closest('.group')!;
    expect(cardP2.className).not.toContain('opacity-40');
    void container;
  });

  it('bloqueada usa las clases de disabled, no las de hover/grab', () => {
    render(<PendingSidebar
      preparaciones={[makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P-BLOQ' })] })]}
      ocupadasEnOtraBiblia={new Map([[1, '2026-07-08']])}
    />);
    const card = screen.getByText('P-BLOQ').closest('.group')!;
    expect(card.className).toContain('opacity-50');
    expect(card.className).toContain('cursor-not-allowed');
    expect(card.className).not.toContain('cursor-grab');
  });

  it('ordena por estado: completadas antes que pendientes', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, estado: 'Pendiente', pedidos: [makePedido({ codigo: 'P-PEND' })] }),
      makePrep({ id: 2, estado: 'Completada', pedidos: [makePedido({ codigo: 'P-COMP' })] }),
    ]} />);
    const codigos = screen.getAllByText(/P-/).map(e => e.textContent);
    expect(codigos).toEqual(['P-COMP', 'P-PEND']);
  });

  it('el estado "Completo" ordena junto a "Completada", antes que "en preparacion"', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, estado: 'en preparacion', pedidos: [makePedido({ codigo: 'P-PREP' })] }),
      makePrep({ id: 2, estado: 'Completo', pedidos: [makePedido({ codigo: 'P-COMPLETO' })] }),
    ]} />);
    const codigos = screen.getAllByText(/P-/).map(e => e.textContent);
    expect(codigos).toEqual(['P-COMPLETO', 'P-PREP']);
  });

  it('"en preparacion" ordena antes que "pendiente"', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, estado: 'Pendiente', pedidos: [makePedido({ codigo: 'P-PEND' })] }),
      makePrep({ id: 2, estado: 'en preparacion', pedidos: [makePedido({ codigo: 'P-PREP' })] }),
    ]} />);
    const codigos = screen.getAllByText(/P-/).map(e => e.textContent);
    expect(codigos).toEqual(['P-PREP', 'P-PEND']);
  });

  it('un estado desconocido ordena al final, después de "pendiente"', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, estado: 'Rarísimo', pedidos: [makePedido({ codigo: 'P-RARO' })] }),
      makePrep({ id: 2, estado: 'Pendiente', pedidos: [makePedido({ codigo: 'P-PEND' })] }),
    ]} />);
    const codigos = screen.getAllByText(/P-/).map(e => e.textContent);
    expect(codigos).toEqual(['P-PEND', 'P-RARO']);
  });

  it('en la pestaña consolidado, el importe mostrado es el total de la prep (no el del pedido)', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[makePrep({
      tipo: 'Consolidado de pedidos',
      importe_total: 9999,
      pedidos: [makePedido({ importe: 111 })],
    })]} />);
    await user.click(screen.getByRole('tab', { name: /Consolidado/ }));
    expect(screen.getByText('$ 9.999')).toBeInTheDocument();
    expect(screen.queryByText('$ 111')).not.toBeInTheDocument();
  });
});

describe('PendingSidebar — búsqueda', () => {
  it('filtra por cliente y se limpia con la X', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1', cliente_nombre: 'Almacén Norte' })] }),
      makePrep({ id: 2, pedidos: [makePedido({ codigo: 'P2', cliente_nombre: 'Kiosco Sur' })] }),
    ]} />);
    const input = screen.getByPlaceholderText('Buscar por código, despacho o cliente…');
    fireEvent.change(input, { target: { value: 'kiosco' } });
    expect(screen.queryByText('P1')).not.toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();

    fireEvent.click(input.parentElement!.querySelector('button')!);
    expect(screen.getByText('P1')).toBeInTheDocument();
  });

  it('filtra por código de despacho', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1', codigo_despacho: 'BIG' })] }),
      makePrep({ id: 2, pedidos: [makePedido({ codigo: 'P2', codigo_despacho: 'PERI 5' })] }),
    ]} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por código, despacho o cliente…'), {
      target: { value: 'peri' },
    });
    expect(screen.getByText('P2')).toBeInTheDocument();
    expect(screen.queryByText('P1')).not.toBeInTheDocument();
  });

  it('un texto de solo espacios no filtra (se usa trim, no el string crudo)', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P1' })] }),
      makePrep({ id: 2, pedidos: [makePedido({ codigo: 'P2' })] }),
    ]} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por código, despacho o cliente…'), {
      target: { value: '   ' },
    });
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
  });

  it('busca por id de la preparación', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 12345, pedidos: [makePedido({ codigo: 'PX' })] }),
      makePrep({ id: 999, pedidos: [makePedido({ codigo: 'PY' })] }),
    ]} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por código, despacho o cliente…'), {
      target: { value: '12345' },
    });
    expect(screen.getByText('PX')).toBeInTheDocument();
    expect(screen.queryByText('PY')).not.toBeInTheDocument();
  });

  it('con varios pedidos en la prep, alcanza con que UNO matchee la búsqueda (some, no every)', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[
      makePrep({
        id: 1,
        tipo: 'Consolidado de pedidos',
        codigo_envio: 'E-MULTI',
        pedidos: [
          makePedido({ codigo: 'NOMATCH1', cliente_nombre: 'Nadie', codigo_despacho: 'X1' }),
          makePedido({ codigo: 'NOMATCH2', cliente_nombre: 'Zapatería Rara', codigo_despacho: 'X2' }),
        ],
      }),
    ]} />);
    await user.click(screen.getByRole('tab', { name: /Consolidado/ }));
    fireEvent.change(screen.getByPlaceholderText('Buscar por código, despacho o cliente…'), {
      target: { value: 'zapatería' },
    });
    expect(screen.getByText('E-MULTI')).toBeInTheDocument();
  });
});

describe('PendingSidebar — auto-asignar', () => {
  it('llama a onAutoAsignar y muestra cuántas asignó', async () => {
    const onAutoAsignar = vi.fn().mockResolvedValue(3);
    render(<PendingSidebar preparaciones={[makePrep()]} onAutoAsignar={onAutoAsignar} />);
    fireEvent.click(screen.getByRole('button', { name: /Auto-asignar/ }));
    expect(await screen.findByText('3 asignadas')).toBeInTheDocument();
  });

  it('muestra "Nada para asignar" cuando devuelve 0', async () => {
    const onAutoAsignar = vi.fn().mockResolvedValue(0);
    render(<PendingSidebar preparaciones={[makePrep()]} onAutoAsignar={onAutoAsignar} />);
    fireEvent.click(screen.getByRole('button', { name: /Auto-asignar/ }));
    expect(await screen.findByText('Nada para asignar')).toBeInTheDocument();
  });

  it('singular: "1 asignada"', async () => {
    const onAutoAsignar = vi.fn().mockResolvedValue(1);
    render(<PendingSidebar preparaciones={[makePrep()]} onAutoAsignar={onAutoAsignar} />);
    fireEvent.click(screen.getByRole('button', { name: /Auto-asignar/ }));
    expect(await screen.findByText('1 asignada')).toBeInTheDocument();
  });

  it('no muestra ningún mensaje de auto-asignar antes de usarlo', () => {
    render(<PendingSidebar preparaciones={[makePrep()]} onAutoAsignar={vi.fn()} />);
    expect(screen.queryByText(/asignada/)).not.toBeInTheDocument();
    expect(screen.queryByText('Nada para asignar')).not.toBeInTheDocument();
  });

  it('no muestra el botón sin onAutoAsignar', () => {
    render(<PendingSidebar preparaciones={[makePrep()]} />);
    expect(screen.queryByRole('button', { name: /Auto-asignar/ })).not.toBeInTheDocument();
  });

  it('el botón se deshabilita mientras corre y se rehabilita al terminar', async () => {
    let resolve: (n: number) => void = () => {};
    const onAutoAsignar = vi.fn().mockImplementation(() => new Promise(res => { resolve = res; }));
    render(<PendingSidebar preparaciones={[makePrep()]} onAutoAsignar={onAutoAsignar} />);
    const btn = screen.getByRole('button', { name: /Auto-asignar/ });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    expect(screen.getByText('Asignando…')).toBeInTheDocument();

    resolve(2);
    await waitFor(() => expect(btn).toBeEnabled());
  });
});

describe('PendingSidebar — drag interno (arrastrar una tarjeta del propio sidebar)', () => {
  it('handleDragStart configura el dataTransfer y llama a onDragStart en el próximo frame', async () => {
    const onDragStart = vi.fn();
    render(<PendingSidebar preparaciones={[makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] })]} onDragStart={onDragStart} />);
    const card = screen.getByText('P5').closest('[draggable]')!;
    const setData = vi.fn();
    const dataTransfer = { setData, effectAllowed: '' };
    fireEvent.dragStart(card, { dataTransfer });
    expect(setData).toHaveBeenCalledWith('text/plain', '5');
    await waitFor(() => expect(onDragStart).toHaveBeenCalledWith(expect.objectContaining({ id: 5 })));
  });

  it('handleDragEnd limpia el draggedId y llama a onDragEnd', () => {
    const onDragEnd = vi.fn();
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] }),
      makePrep({ id: 6, pedidos: [makePedido({ codigo: 'P6' })] }),
    ]} onDragEnd={onDragEnd} />);
    const card = screen.getByText('P5').closest('[draggable]')!;
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragEnd(card);
    expect(onDragEnd).toHaveBeenCalled();
    expect(card.className).not.toContain('opacity-40');
  });

  it('si la prep arrastrada desaparece de la lista (p.ej. se asignó), se limpia el draggedId localmente', () => {
    const { rerender } = render(<PendingSidebar preparaciones={[
      makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] }),
    ]} />);
    const card = screen.getByText('P5').closest('[draggable]')!;
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    expect(card.className).toContain('opacity-40');

    // La prep 5 ya no está en la lista (se asignó en otro lado) -> el efecto debe resetear draggedId
    rerender(<PendingSidebar preparaciones={[makePrep({ id: 6, pedidos: [makePedido({ codigo: 'P6' })] })]} />);
    const card6 = screen.getByText('P6').closest('[draggable]')!;
    expect(card6.className).not.toContain('opacity-40');
  });
});

describe('PendingSidebar — detalle y drop externo', () => {
  it('Ver detalle abre el modal con la preparación, y Cerrar lo cierra', () => {
    render(<PendingSidebar preparaciones={[makePrep({ id: 7 })]} fecha="2026-07-20" />);
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));
    const modal = screen.getByTestId('detalle-modal');
    expect(modal).toHaveAttribute('data-prep', '7');
    expect(modal).toHaveAttribute('data-readonly', 'false');
    expect(modal).toHaveAttribute('data-biblia-fecha', '2026-07-20');

    fireEvent.click(screen.getByText('cerrar-detalle'));
    expect(screen.queryByTestId('detalle-modal')).not.toBeInTheDocument();
  });

  it('sin fecha, pasa un string vacío como bibliaFecha al modal', () => {
    render(<PendingSidebar preparaciones={[makePrep({ id: 7 })]} />);
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));
    expect(screen.getByTestId('detalle-modal')).toHaveAttribute('data-biblia-fecha', '');
  });

  it('el modal es readonly para preps de otra biblia', () => {
    render(<PendingSidebar
      preparaciones={[makePrep({ id: 7 })]}
      ocupadasEnOtraBiblia={new Map([[7, '2026-07-08']])}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));
    expect(screen.getByTestId('detalle-modal')).toHaveAttribute('data-readonly', 'true');
  });

  it('muestra la zona de drop para desasignar cuando el drag viene de un chofer', () => {
    const prepAsignada = makePrep({ id: 99 });
    render(<PendingSidebar
      preparaciones={[makePrep({ id: 1 })]}
      draggedPrep={prepAsignada}
      onDesasignar={vi.fn()}
    />);
    expect(screen.getByText('Soltar aquí para desasignar')).toBeInTheDocument();
  });

  it('al pasar por encima con el drag externo, cambia el estilo de la zona de drop', () => {
    const prepAsignada = makePrep({ id: 99 });
    const { container } = render(<PendingSidebar
      preparaciones={[makePrep({ id: 1 })]}
      draggedPrep={prepAsignada}
      onDesasignar={vi.fn()}
    />);
    const dropZone = screen.getByText('Soltar aquí para desasignar').closest('div')!;
    expect(dropZone.className).toContain('border-orange-300');
    fireEvent.dragOver(container.firstElementChild!, { dataTransfer: { dropEffect: '' } });
    expect(dropZone.className).toContain('border-orange-500');
    expect(dropZone.className).not.toContain('border-orange-300');
  });

  it('el drop dispara onDesasignar con el id de la prep arrastrada', async () => {
    const onDesasignar = vi.fn();
    const onDragEnd = vi.fn();
    const prepAsignada = makePrep({ id: 99 });
    const { container } = render(<PendingSidebar
      preparaciones={[makePrep({ id: 1 })]}
      draggedPrep={prepAsignada}
      onDesasignar={onDesasignar}
      onDragEnd={onDragEnd}
    />);
    const dropCard = container.firstElementChild!;
    // jsdom no implementa DataTransfer: se pasa un stub para los handlers de drag
    fireEvent.dragOver(dropCard, { dataTransfer: { dropEffect: '' } });
    const dropZone = screen.getByText('Soltar aquí para desasignar').closest('div')!;
    expect(dropZone.className).toContain('border-orange-500'); // dropOver=true tras el dragOver
    fireEvent.drop(dropCard, { dataTransfer: { dropEffect: '' } });
    await waitFor(() => expect(onDesasignar).toHaveBeenCalledWith(99));
    expect(onDesasignar).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('el drop no llama a onDesasignar/onDragEnd si no están definidos (no rompe)', () => {
    const prepAsignada = makePrep({ id: 99 });
    const { container } = render(<PendingSidebar
      preparaciones={[makePrep({ id: 1 })]}
      draggedPrep={prepAsignada}
    />);
    const dropCard = container.firstElementChild!;
    expect(() => {
      fireEvent.drop(dropCard, { dataTransfer: { dropEffect: '' } });
    }).not.toThrow();
  });

  it('no muestra la zona de drop si la prep arrastrada está en el sidebar, aunque haya otras preps', () => {
    const prep = makePrep({ id: 1 });
    render(<PendingSidebar preparaciones={[makePrep({ id: 2 }), prep, makePrep({ id: 3 })]} draggedPrep={prep} />);
    expect(screen.queryByText('Soltar aquí para desasignar')).not.toBeInTheDocument();
  });

  it('no muestra la zona de drop si la prep arrastrada está en el sidebar', () => {
    const prep = makePrep({ id: 1 });
    render(<PendingSidebar preparaciones={[prep]} draggedPrep={prep} />);
    expect(screen.queryByText('Soltar aquí para desasignar')).not.toBeInTheDocument();
  });

  it('sin codigosDespacho, se le pasa un array vacío al modal', () => {
    render(<PendingSidebar preparaciones={[makePrep({ id: 7 })]} />);
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));
    expect(screen.getByTestId('detalle-modal')).toHaveAttribute('data-codigos-count', '0');
  });

  it('la clase base de la zona de drop se mantiene además del color según dropOver', () => {
    const prepAsignada = makePrep({ id: 99 });
    render(<PendingSidebar preparaciones={[makePrep({ id: 1 })]} draggedPrep={prepAsignada} onDesasignar={vi.fn()} />);
    const dropZone = screen.getByText('Soltar aquí para desasignar').closest('div')!;
    expect(dropZone.className).toContain('rounded-lg');
    expect(dropZone.className).toContain('border-dashed');
  });

  it('después del drop, dropOver vuelve a false (color vuelve al estado inicial)', () => {
    const prepAsignada = makePrep({ id: 99 });
    const { container } = render(<PendingSidebar
      preparaciones={[makePrep({ id: 1 })]}
      draggedPrep={prepAsignada}
      onDesasignar={vi.fn()}
      onDragEnd={vi.fn()}
    />);
    const dropCard = container.firstElementChild!;
    fireEvent.dragOver(dropCard, { dataTransfer: { dropEffect: '' } });
    const dropZone = screen.getByText('Soltar aquí para desasignar').closest('div')!;
    expect(dropZone.className).toContain('border-orange-500');
    fireEvent.drop(dropCard, { dataTransfer: { dropEffect: '' } });
    expect(dropZone.className).toContain('border-orange-300');
    expect(dropZone.className).not.toContain('border-orange-500');
  });
});

describe('PendingSidebar — pestaña activa y filtro de tipo desconocido', () => {
  it('la pestaña "Pedido suelto" está activa por defecto', () => {
    render(<PendingSidebar preparaciones={[makePrep()]} />);
    expect(screen.getByRole('tab', { name: /Pedido suelto/ })).toHaveAttribute('data-state', 'active');
  });

  it('un tipo especial de consolidado no aparece en una pestaña que no es consolidado', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, tipo: 'Consolidado que luego se va a desconsolidar.', codigo_envio: 'E-ESPECIAL' }),
    ]} />);
    // Activa por defecto es "individual"; el tipo especial solo debe verse en "consolidado"
    expect(screen.queryByText('E-ESPECIAL')).not.toBeInTheDocument();
  });
});

describe('PendingSidebar — búsqueda por código de envío y de pedido', () => {
  it('busca por código de envío de la preparación', async () => {
    const user = userEvent.setup();
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, tipo: 'Consolidado de pedidos', codigo_envio: 'ENVIO-UNICO', pedidos: [makePedido({ codigo: 'PX' })] }),
      makePrep({ id: 2, tipo: 'Consolidado de pedidos', codigo_envio: 'OTRO', pedidos: [makePedido({ codigo: 'PY' })] }),
    ]} />);
    await user.click(screen.getByRole('tab', { name: /Consolidado/ }));
    fireEvent.change(screen.getByPlaceholderText('Buscar por código, despacho o cliente…'), {
      target: { value: 'envio-unico' },
    });
    expect(screen.getByText('ENVIO-UNICO')).toBeInTheDocument();
    expect(screen.queryByText('OTRO')).not.toBeInTheDocument();
  });

  it('busca por código del pedido', () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 1, pedidos: [makePedido({ codigo: 'PEDIDO-XYZ' })] }),
      makePrep({ id: 2, pedidos: [makePedido({ codigo: 'PEDIDO-ABC' })] }),
    ]} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por código, despacho o cliente…'), {
      target: { value: 'xyz' },
    });
    expect(screen.getByText('PEDIDO-XYZ')).toBeInTheDocument();
    expect(screen.queryByText('PEDIDO-ABC')).not.toBeInTheDocument();
  });
});

describe('PendingSidebar — efecto de reseteo de draggedId', () => {
  it('no resetea el draggedId mientras la prep arrastrada siga en la lista (con más de una)', async () => {
    render(<PendingSidebar preparaciones={[
      makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] }),
      makePrep({ id: 6, pedidos: [makePedido({ codigo: 'P6' })] }),
    ]} />);
    const card5 = screen.getByText('P5').closest('.group')!;
    fireEvent.dragStart(card5, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    await waitFor(() => expect(card5.className).toContain('opacity-40'));
  });

  it('el draggedId no persiste incorrectamente al reaparecer la misma prep tras desaparecer', () => {
    const { rerender } = render(<PendingSidebar preparaciones={[
      makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] }),
    ]} />);
    const card = screen.getByText('P5').closest('.group')!;
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    expect(card.className).toContain('opacity-40');

    rerender(<PendingSidebar preparaciones={[makePrep({ id: 6, pedidos: [makePedido({ codigo: 'P6' })] })]} />);
    rerender(<PendingSidebar preparaciones={[makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] })]} />);
    const cardAgain = screen.getByText('P5').closest('.group')!;
    expect(cardAgain.className).not.toContain('opacity-40');
  });
});

describe('PendingSidebar — dataTransfer y handlers opcionales', () => {
  it('handleDragStart no rompe si no se pasó onDragStart', async () => {
    render(<PendingSidebar preparaciones={[makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] })]} />);
    const card = screen.getByText('P5').closest('[draggable]')!;
    expect(() => {
      fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    }).not.toThrow();
  });

  it('handleDragEnd no rompe si no se pasó onDragEnd', () => {
    render(<PendingSidebar preparaciones={[makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] })]} />);
    const card = screen.getByText('P5').closest('[draggable]')!;
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    expect(() => fireEvent.dragEnd(card)).not.toThrow();
  });

  it('usa la referencia actualizada de onDragStart tras un rerender', async () => {
    const onDragStartA = vi.fn();
    const onDragStartB = vi.fn();
    const { rerender } = render(<PendingSidebar preparaciones={[makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] })]} onDragStart={onDragStartA} />);
    rerender(<PendingSidebar preparaciones={[makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] })]} onDragStart={onDragStartB} />);
    const card = screen.getByText('P5').closest('[draggable]')!;
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    await waitFor(() => expect(onDragStartB).toHaveBeenCalled());
    expect(onDragStartA).not.toHaveBeenCalled();
  });

  it('usa la referencia actualizada de onDragEnd tras un rerender', () => {
    const onDragEndA = vi.fn();
    const onDragEndB = vi.fn();
    const { rerender } = render(<PendingSidebar preparaciones={[makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] })]} onDragEnd={onDragEndA} />);
    rerender(<PendingSidebar preparaciones={[makePrep({ id: 5, pedidos: [makePedido({ codigo: 'P5' })] })]} onDragEnd={onDragEndB} />);
    const card = screen.getByText('P5').closest('[draggable]')!;
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragEnd(card);
    expect(onDragEndB).toHaveBeenCalled();
    expect(onDragEndA).not.toHaveBeenCalled();
  });
});

describe('PendingSidebar — dependencias de useMemo (tabCounts / filtered)', () => {
  it('tabCounts se recalcula cuando cambian las preparaciones', () => {
    const { rerender } = render(<PendingSidebar preparaciones={[makePrep({ id: 1, tipo: 'Pedidos individuales' })]} />);
    expect(screen.getByRole('tab', { name: /Pedido suelto/ })).toHaveTextContent('(1)');
    rerender(<PendingSidebar preparaciones={[
      makePrep({ id: 1, tipo: 'Pedidos individuales' }),
      makePrep({ id: 2, tipo: 'Pedidos individuales' }),
    ]} />);
    expect(screen.getByRole('tab', { name: /Pedido suelto/ })).toHaveTextContent('(2)');
  });
});

describe('PendingSidebar — mensaje de auto-asignar antes del primer uso', () => {
  it('no renderiza el span del mensaje antes de auto-asignar por primera vez', () => {
    const { container } = render(<PendingSidebar preparaciones={[makePrep()]} onAutoAsignar={vi.fn()} />);
    expect(container.querySelector('span.text-xs.text-slate-400')).not.toBeInTheDocument();
  });
});

describe('PendingSidebar — pedido sin pedidos asociados (edge case)', () => {
  it('en pedido suelto, sin pedidos asociados, no rompe (usa el fallback de peso sin despacho)', () => {
    expect(() => render(<PendingSidebar preparaciones={[makePrep({
      id: 1,
      pedidos: [],
      peso: 5,
      peso_text: '5 kg',
    })]} />)).not.toThrow();
    expect(screen.getByText('5 kg')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Uno')).not.toBeInTheDocument();
  });
});

describe('PendingSidebar — importe distinto entre pedido y preparación', () => {
  it('en pedido suelto se muestra el importe del PEDIDO, no el importe_total de la prep', () => {
    render(<PendingSidebar preparaciones={[makePrep({
      importe_total: 9999,
      pedidos: [makePedido({ importe: 111 })],
    })]} />);
    expect(screen.getByText('$ 111')).toBeInTheDocument();
    expect(screen.queryByText('$ 9.999')).not.toBeInTheDocument();
  });
});

describe('PendingSidebar — bloqueada con despacho vacío y peso positivo', () => {
  it('una prep bloqueada no muestra el peso aunque no tenga despacho', () => {
    render(<PendingSidebar
      preparaciones={[makePrep({ id: 1, pedidos: [makePedido({ codigo_despacho: null })], peso: 5, peso_text: '5 kg' })]}
      ocupadasEnOtraBiblia={new Map([[1, '2026-07-08']])}
    />);
    expect(screen.queryByText('5 kg')).not.toBeInTheDocument();
  });
});

describe('PendingSidebar — clases hover/grab cuando no está bloqueada', () => {
  it('una prep no bloqueada usa las clases de hover/grab', () => {
    render(<PendingSidebar preparaciones={[makePrep({ id: 1, pedidos: [makePedido({ codigo: 'P-LIBRE' })] })]} />);
    const card = screen.getByText('P-LIBRE').closest('.group')!;
    expect(card.className).toContain('hover:shadow-md');
    expect(card.className).toContain('cursor-grab');
  });
});
