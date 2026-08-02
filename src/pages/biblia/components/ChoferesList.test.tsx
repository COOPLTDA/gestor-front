import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ChoferesList } from './ChoferesList';
import type { Chofer, CodigoDespacho, Preparacion, Pedido, SigmaSyncEstado } from '../types/biblia';

vi.mock('./PreparacionDetalleModal', () => ({
  PreparacionDetalleModal: ({ preparacion, isAsignada, open, onClose, onDesasignarAlEditar }: {
    preparacion: Preparacion; isAsignada?: boolean; open: boolean; onClose: () => void; onDesasignarAlEditar: () => void;
  }) => open ? (
    <div data-testid="detalle-modal" data-prep={preparacion.id} data-asignada={String(isAsignada ?? false)}>
      <button onClick={onClose}>cerrar-detalle</button>
      <button onClick={onDesasignarAlEditar}>desasignar-al-editar</button>
    </div>
  ) : null,
}));

vi.mock('./RepartoExcepcionalModal', () => ({
  RepartoExcepcionalModal: ({ open, onClose }: { open: boolean; onClose: () => void }) => (open ? (
    <div data-testid="excepcion-modal">
      <button onClick={onClose}>cerrar-excepcion</button>
    </div>
  ) : null),
}));

const dt = { dropEffect: '', effectAllowed: '', setData: vi.fn() };

function makePedido(over: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'P1',
    codigo_despacho: 'BIG',
    codigo_cliente_ubicacion: 'CL1',
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
    peso_text: '0',
    volumen_text: '0',
    ...over,
  };
}

const CHOFERES: Chofer[] = [
  { codigo: 'CH1', descripcion: 'López', desactivado: 0 },
  { codigo: 'CH2', descripcion: 'García', desactivado: 0 },
];

const BIG: CodigoDespacho = { id: 151, nombre: 'BIG', desactivado: 0, direccion: 'LOMAS' };
const PERI: CodigoDespacho = { id: 150, nombre: 'PERI 5', desactivado: 0, direccion: 'SUR' };

function renderList(over: Partial<Parameters<typeof ChoferesList>[0]> = {}) {
  const props = {
    choferes: CHOFERES,
    codigosDespacho: [BIG, PERI],
    codigosDespachoByChofer: new Map([
      ['CH1', [BIG]],
      ['CH2', [BIG, PERI]],
    ]),
    preparacionesPorChofer: new Map<string, Preparacion[]>(),
    onReasignar: vi.fn().mockResolvedValue(undefined),
    onDesasignarPreparacion: vi.fn().mockResolvedValue(undefined),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    draggedPrep: null as Preparacion | null,
    draggedCodigos: null as Set<string> | null,
    onRecargarExcepciones: vi.fn().mockResolvedValue(undefined),
    onEliminarExcepcion: vi.fn().mockResolvedValue(undefined),
    onModificado: vi.fn(),
    fecha: '2026-07-10',
    ...over,
  };
  const utils = render(<ChoferesList {...props} />);
  return { ...props, ...utils };
}

beforeEach(() => vi.clearAllMocks());

describe('ChoferesList — listado', () => {
  it('muestra los choferes con sus códigos de despacho', () => {
    renderList();
    expect(screen.getByText('Choferes (2)')).toBeInTheDocument();
    expect(screen.getByText('López')).toBeInTheDocument();
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.getByText('Códigos de despacho (2)')).toBeInTheDocument();
  });

  it('oculta choferes sin códigos ni preparaciones', () => {
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [BIG]]]),
    });
    expect(screen.getByText('López')).toBeInTheDocument();
    expect(screen.queryByText('García')).not.toBeInTheDocument();
  });

  it('muestra el vacío cuando no hay choferes', () => {
    renderList({ codigosDespachoByChofer: new Map(), choferes: [] });
    expect(screen.getByText('Sin choferes para esta fecha')).toBeInTheDocument();
  });

  it('filtra choferes por nombre (case-insensitive) con el input de filtro', () => {
    renderList();
    fireEvent.change(screen.getByPlaceholderText('Filtrar por nombre...'), { target: { value: 'gar' } });
    expect(screen.queryByText('López')).not.toBeInTheDocument();
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.getByText('Choferes (1)')).toBeInTheDocument();
  });

  it('filtro de nombre vacío no oculta a nadie', () => {
    renderList();
    fireEvent.change(screen.getByPlaceholderText('Filtrar por nombre...'), { target: { value: '  ' } });
    expect(screen.getByText('López')).toBeInTheDocument();
    expect(screen.getByText('García')).toBeInTheDocument();
  });

  it('los choferes inactivos van al final y se marcan', () => {
    renderList({
      choferes: [
        { codigo: 'CH1', descripcion: 'López', desactivado: 1 },
        { codigo: 'CH2', descripcion: 'García', desactivado: 0 },
      ],
    });
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    const nombres = screen.getAllByText(/^(García|López)$/).map(e => e.textContent);
    expect(nombres).toEqual(['García', 'López']);
  });

  it('usa singular ("cliente"/"pedido") cuando hay exactamente uno de cada', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 1, cantidad_pedidos: 1 })]]]),
    });
    expect(screen.getByText('1 cliente únicos')).toBeInTheDocument();
    expect(screen.getByText('1 pedido')).toBeInTheDocument();
  });

  it('cuenta como cliente único por nombre cuando falta codigo_cliente_ubicacion (else if)', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({
        id: 1,
        pedidos: [makePedido({ codigo_cliente_ubicacion: null, cliente_nombre: 'Solo Nombre' })],
      })]]]),
    });
    expect(screen.getByText('1 cliente únicos')).toBeInTheDocument();
  });

  it('muestra las preparaciones asignadas con totales', () => {
    renderList({
      preparacionesPorChofer: new Map([
        ['CH1', [
          makePrep({ id: 1, importe_total: 1000, cantidad_pedidos: 2 }),
          makePrep({ id: 2, importe_total: 500, cantidad_pedidos: 1, pedidos: [makePedido({ codigo_cliente_ubicacion: 'CL2' })] }),
        ]],
      ]),
    });
    expect(screen.getByText('Preparaciones (2)')).toBeInTheDocument();
    expect(screen.getByText('2 clientes únicos')).toBeInTheDocument();
    expect(screen.getByText('3 pedidos')).toBeInTheDocument();
    expect(screen.getByText('$ 1.500')).toBeInTheDocument();
  });

  it('muestra los badges de sigma en las preps asignadas', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 1 })]]]),
      sigmaEstadoByPrepId: new Map<number, SigmaSyncEstado>([[1, 'pendiente']]),
    });
    expect(screen.getByText('sigma')).toBeInTheDocument();
  });

  it('la X desasigna la preparación', () => {
    const { onDesasignarPreparacion } = renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 7 })]]]),
    });
    fireEvent.click(screen.getByTitle('Desasignar'));
    expect(onDesasignarPreparacion).toHaveBeenCalledWith(7);
  });

  it('Ver detalle abre el modal como asignada', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 7 })]]]),
    });
    fireEvent.click(screen.getByText('Ver detalle'));
    const modal = screen.getByTestId('detalle-modal');
    expect(modal).toHaveAttribute('data-prep', '7');
    expect(modal).toHaveAttribute('data-asignada', 'true');
  });

  it('cerrar el modal de detalle lo oculta', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 7 })]]]),
    });
    fireEvent.click(screen.getByText('Ver detalle'));
    expect(screen.getByTestId('detalle-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('cerrar-detalle'));

    expect(screen.queryByTestId('detalle-modal')).not.toBeInTheDocument();
  });

  it('desasignar desde el modal de detalle llama a onDesasignarPreparacion con el id', () => {
    const { onDesasignarPreparacion } = renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 7 })]]]),
    });
    fireEvent.click(screen.getByText('Ver detalle'));

    fireEvent.click(screen.getByText('desasignar-al-editar'));

    expect(onDesasignarPreparacion).toHaveBeenCalledWith(7);
  });

  it('muestra el nombre del cliente en preparaciones de tipo Pedidos individuales', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 1, tipo: 'Pedidos individuales' })]]]),
    });
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
  });

  it('muestra el nombre del cliente en preparaciones de tipo Agrupa por direccion de entrega', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 1, tipo: 'Agrupa por direccion de entrega' })]]]),
    });
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
  });

  it('no muestra el nombre del cliente en otros tipos de preparación', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 1, tipo: 'Consolidado de pedidos' })]]]),
    });
    expect(screen.queryByText('Cliente Uno')).not.toBeInTheDocument();
  });

  it('junta varios nombres de cliente distintos separados por coma (dedup con Set)', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({
        id: 1,
        tipo: 'Pedidos individuales',
        pedidos: [
          makePedido({ codigo: 'P1', cliente_nombre: 'Ana' }),
          makePedido({ codigo: 'P2', cliente_nombre: 'Beto' }),
          makePedido({ codigo: 'P3', cliente_nombre: 'Ana' }), // duplicado, no debe repetirse
        ],
      })]]]),
    });
    expect(screen.getByText('Ana, Beto')).toBeInTheDocument();
  });

  it('junta varios códigos de despacho distintos separados por coma en el tooltip de la mini-tarjeta', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({
        id: 1,
        pedidos: [
          makePedido({ codigo: 'P1', codigo_despacho: 'AAA' }),
          makePedido({ codigo: 'P2', codigo_despacho: 'BBB' }),
        ],
      })]]]),
    });
    expect(screen.getByText('AAA, BBB')).toBeInTheDocument();
  });

  it('no muestra la línea de códigos de la mini-tarjeta si todos los pedidos tienen codigo_despacho null', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({
        id: 1,
        pedidos: [makePedido({ codigo_despacho: null })],
      })]]]),
    });
    expect(screen.queryByTitle('BIG')).not.toBeInTheDocument();
  });

  it('filtra preparaciones asignadas por nombre de cliente', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, pedidos: [makePedido({ cliente_nombre: 'Juan Pérez' })] }),
        makePrep({ id: 2, pedidos: [makePedido({ cliente_nombre: 'María López' })] }),
      ]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('Cliente...'), { target: { value: 'maría' } });
    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
    expect(screen.getByText('María López')).toBeInTheDocument();
  });

  it('filtra preparaciones asignadas por código de despacho', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, codigo_envio: 'E-1', pedidos: [makePedido({ codigo_despacho: 'BIG' })] }),
        makePrep({ id: 2, codigo_envio: 'E-2', pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] }),
      ]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('Código despacho...'), { target: { value: 'peri' } });
    expect(screen.queryByText('E-1')).not.toBeInTheDocument();
    expect(screen.getByText('E-2')).toBeInTheDocument();
  });

  it('el filtro de cliente alcanza con que UN pedido matchee, no todos (some, no every)', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, codigo_envio: 'E-1', pedidos: [
          makePedido({ codigo: 'P1', cliente_nombre: 'Juan Pérez' }),
          makePedido({ codigo: 'P2', cliente_nombre: 'María López' }),
        ] }),
      ]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('Cliente...'), { target: { value: 'maría' } });
    expect(screen.getByText('E-1')).toBeInTheDocument(); // un solo pedido matchea, alcanza para no filtrar la prep
  });

  it('el filtro de cliente ignora espacios al inicio/fin del valor buscado (trim)', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, codigo_envio: 'E-1', pedidos: [makePedido({ cliente_nombre: 'María López' })] }),
      ]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('Cliente...'), { target: { value: '  maría  ' } });
    expect(screen.getByText('E-1')).toBeInTheDocument();
  });

  it('el filtro de código de despacho alcanza con que UN pedido matchee (some, no every)', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, codigo_envio: 'E-1', pedidos: [
          makePedido({ codigo: 'P1', codigo_despacho: 'BIG' }),
          makePedido({ codigo: 'P2', codigo_despacho: 'PERI 5' }),
        ] }),
      ]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('Código despacho...'), { target: { value: 'peri' } });
    expect(screen.getByText('E-1')).toBeInTheDocument();
  });

  it('filtra preparaciones asignadas por id de preparación', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 101, codigo_envio: null }),
        makePrep({ id: 205, codigo_envio: null }),
      ]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('ID preparación...'), { target: { value: '205' } });
    expect(screen.queryByText('#101')).not.toBeInTheDocument();
    expect(screen.getByText('#205')).toBeInTheDocument();
  });

  it('el filtro de cliente no rompe con cliente_nombre null (no matchea, no filtra por accidente al resto)', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, codigo_envio: 'E-1', pedidos: [makePedido({ cliente_nombre: null })] }),
      ]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('Cliente...'), { target: { value: 'maría' } });
    expect(screen.queryByText('E-1')).not.toBeInTheDocument();
  });

  it('el filtro de código de despacho no rompe con codigo_despacho null', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, codigo_envio: 'E-1', pedidos: [makePedido({ codigo_despacho: null })] }),
      ]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('Código despacho...'), { target: { value: 'peri' } });
    expect(screen.queryByText('E-1')).not.toBeInTheDocument();
  });

  it('el filtro de nombre de chofer no rompe con descripción null', () => {
    renderList({
      choferes: [{ codigo: 'CH1', descripcion: null as unknown as string, desactivado: 0 }],
    });
    fireEvent.change(screen.getByPlaceholderText('Filtrar por nombre...'), { target: { value: 'gar' } });
    expect(screen.getByText('Choferes (0)')).toBeInTheDocument();
  });

  it('el filtro de id de preparación ignora espacios al inicio/fin del valor buscado (trim)', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 205, codigo_envio: null })]]]),
    });
    fireEvent.change(screen.getByPlaceholderText('ID preparación...'), { target: { value: '  205  ' } });
    expect(screen.getByText('#205')).toBeInTheDocument();
  });

  it('el modal de reparto excepcional arranca cerrado', () => {
    renderList();
    expect(screen.queryByTestId('excepcion-modal')).not.toBeInTheDocument();
  });

  it('el botón excep. abre el modal de reparto excepcional, y su cierre lo oculta', () => {
    renderList();
    fireEvent.click(screen.getByTitle('Agregar reparto excepcional'));
    expect(screen.getByTestId('excepcion-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('cerrar-excepcion'));
    expect(screen.queryByTestId('excepcion-modal')).not.toBeInTheDocument();
  });

  it('las excepciones se listan con etiqueta y se pueden eliminar', () => {
    const excepcional: CodigoDespacho = {
      id: 'RUTA X', nombre: 'RUTA X', desactivado: 0, direccion: null,
      es_excepcion: true, excepcion_id: 42,
    };
    const { onEliminarExcepcion } = renderList({
      codigosDespachoByChofer: new Map([['CH1', [BIG, excepcional]]]),
    });
    expect(screen.getByText('excep.', { selector: 'span' })).toBeInTheDocument();
    const fila = screen.getByText('RUTA X').closest('div')!;
    fireEvent.click(fila.querySelector('button')!);
    expect(onEliminarExcepcion).toHaveBeenCalledWith(42);
  });

  it('una excepción sin excepcion_id deshabilita el botón de eliminar y muestra el título explicativo', () => {
    const excepcional: CodigoDespacho = {
      id: 'RUTA X', nombre: 'RUTA X', desactivado: 0, direccion: null,
      es_excepcion: true, excepcion_id: null,
    };
    const { onEliminarExcepcion } = renderList({
      codigosDespachoByChofer: new Map([['CH1', [BIG, excepcional]]]),
    });
    const fila = screen.getByText('RUTA X').closest('div')!;
    const btn = fila.querySelector('button')!;
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'No se puede eliminar: falta el id de la excepción');
    fireEvent.click(btn);
    expect(onEliminarExcepcion).not.toHaveBeenCalled();
  });

  it('una excepción con excepcion_id no tiene title y el botón está habilitado', () => {
    const excepcional: CodigoDespacho = {
      id: 'RUTA X', nombre: 'RUTA X', desactivado: 0, direccion: null,
      es_excepcion: true, excepcion_id: 42,
    };
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [BIG, excepcional]]]),
    });
    const fila = screen.getByText('RUTA X').closest('div')!;
    const btn = fila.querySelector('button')!;
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute('title');
  });

  it('muestra la dirección de un código normal (no excepción) que coincide con el arrastrado', () => {
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [BIG]]]), // BIG tiene dirección LOMAS
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    expect(screen.getByText('· LOMAS')).toBeInTheDocument();
    const fila = screen.getAllByText('BIG').filter(e => !e.hasAttribute('style'))[0].closest('div')!;
    const mapPin = fila.querySelector('svg')!;
    const nombre = screen.getAllByText('BIG').filter(e => !e.hasAttribute('style'))[0];
    expect(mapPin.getAttribute('class')).toContain('text-emerald-600');
    expect(nombre.className).toContain('text-emerald-700 font-semibold');
  });

  it('un código normal que no coincide (sin arrastre) usa los colores grises por defecto', () => {
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [BIG]]]),
    });
    const fila = screen.getAllByText('BIG').filter(e => !e.hasAttribute('style'))[0].closest('div')!;
    const mapPin = fila.querySelector('svg')!;
    const nombre = screen.getAllByText('BIG').filter(e => !e.hasAttribute('style'))[0];
    expect(mapPin.getAttribute('class')).toContain('text-slate-500');
    expect(nombre.className).toContain('text-slate-500');
  });

  it('una excepción usa los colores naranja tanto en el ícono como en el nombre', () => {
    const excepcional: CodigoDespacho = {
      id: 'RUTA X', nombre: 'RUTA X', desactivado: 0, direccion: null, es_excepcion: true, excepcion_id: 42,
    };
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [excepcional]]]),
    });
    const fila = screen.getByText('RUTA X').closest('div')!;
    const mapPin = fila.querySelector('svg')!;
    expect(mapPin.getAttribute('class')).toContain('text-orange-500');
    expect(screen.getByText('RUTA X').className).toContain('text-orange-700 font-medium');
  });
});

describe('ChoferesList — drag & drop', () => {
  it('muestra la grilla overlay durante el drag', () => {
    renderList({
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    expect(screen.getByText('Soltá la preparación en un chofer')).toBeInTheDocument();
  });

  it('calcula la altura de fila del overlay según columnas, filas y alto disponible', () => {
    const innerWidthSpy = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800); // >=640, <1536 → 4 columnas
    try {
      const choferes4 = Array.from({ length: 4 }, (_, i) => ({ codigo: `CH${i}`, descripcion: `Chofer ${i}`, desactivado: 0 }));
      const byChofer = new Map(choferes4.map(c => [c.codigo, [BIG]]));
      const { rerender, container, ...props } = renderList({
        choferes: choferes4,
        codigosDespachoByChofer: byChofer,
        draggedPrep: makePrep(),
        draggedCodigos: new Set(['BIG']),
      });

      const overlay = container.querySelector('.z-30') as HTMLElement;
      Object.defineProperty(overlay, 'clientHeight', { value: 200, configurable: true });
      Object.defineProperty(overlay.firstElementChild as HTMLElement, 'offsetHeight', { value: 20, configurable: true });

      // agregar un 5to chofer para forzar que el efecto se vuelva a correr (dep choferesOrdenados.length cambia)
      // con los mocks de altura ya puestos sobre el nodo real del overlay.
      const choferes5 = [...choferes4, { codigo: 'CH4', descripcion: 'Chofer 4', desactivado: 0 }];
      const byChofer5 = new Map(choferes5.map(c => [c.codigo, [BIG]]));
      rerender(<ChoferesList {...props} choferes={choferes5} codigosDespachoByChofer={byChofer5} draggedPrep={makePrep()} draggedCodigos={new Set(['BIG'])} />);

      // numCols=4, numRows=ceil(5/4)=2, headerH=20 (no 0, para distinguir el signo del arithmetic),
      // availH=200-20-16=164, ideal=(164-8*1)/2=78
      const grid = container.querySelector('.grid-cols-3') as HTMLElement;
      expect(grid.style.gridAutoRows).toBe('78px');
    } finally {
      innerWidthSpy.mockRestore();
    }
  });

  function overlayRowHFor(innerWidth: number, numChoferes: number, clientHeight = 200, headerH = 20) {
    const innerWidthSpy = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(innerWidth);
    try {
      const choferesN = Array.from({ length: numChoferes }, (_, i) => ({ codigo: `CH${i}`, descripcion: `Chofer ${i}`, desactivado: 0 }));
      const byChofer = new Map(choferesN.map(c => [c.codigo, [BIG]]));
      const { rerender, container, ...props } = renderList({
        choferes: choferesN,
        codigosDespachoByChofer: byChofer,
        draggedPrep: makePrep(),
        draggedCodigos: new Set(['BIG']),
      });
      const overlay = container.querySelector('.z-30') as HTMLElement;
      Object.defineProperty(overlay, 'clientHeight', { value: clientHeight, configurable: true });
      Object.defineProperty(overlay.firstElementChild as HTMLElement, 'offsetHeight', { value: headerH, configurable: true });
      const choferesN1 = [...choferesN, { codigo: 'CHX', descripcion: 'ChoferX', desactivado: 0 }];
      const byChoferN1 = new Map(choferesN1.map(c => [c.codigo, [BIG]]));
      rerender(<ChoferesList {...props} choferes={choferesN1} codigosDespachoByChofer={byChoferN1} draggedPrep={makePrep()} draggedCodigos={new Set(['BIG'])} />);
      const grid = container.querySelector('.grid-cols-3') as HTMLElement;
      return grid.style.gridAutoRows;
    } finally {
      innerWidthSpy.mockRestore();
    }
  }

  it('usa 5 columnas cuando el ancho es >= 1536', () => {
    // numCols=5, choferes=10, numRows=ceil(10/5)=2, availH=164, ideal=(164-8*1)/2=78
    // (si cayera mal a 4 columnas: numRows=ceil(10/4)=3, ideal=(164-16)/3=49.33 -> clamp 60, distinto)
    expect(overlayRowHFor(1600, 9)).toBe('78px');
  });

  it('usa 3 columnas cuando el ancho es < 640', () => {
    // numCols=3, choferes=7, numRows=ceil(7/3)=3, availH=164, ideal=(164-16)/3=49.33 -> clamp a 60
    // (si cayera mal a 4 columnas: numRows=ceil(7/4)=2, ideal=(164-8)/2=78, distinto)
    expect(overlayRowHFor(500, 6)).toBe('60px');
  });

  it('exactamente 1536px de ancho usa 5 columnas (límite inclusive)', () => {
    // numCols=5 (>=1536), choferes=10, numRows=2, availH=164, ideal=78
    // (si el límite fuera exclusivo, caería a 4 columnas: numRows=3, ideal=49.33->clamp 60, distinto)
    expect(overlayRowHFor(1536, 9)).toBe('78px');
  });

  it('exactamente 640px de ancho usa 4 columnas (límite inclusive)', () => {
    // numCols=4 (>=640), choferes=7, numRows=ceil(7/4)=2, availH=164, ideal=(164-8)/2=78
    // (si el límite fuera exclusivo, caería a 3 columnas: numRows=3, ideal=49.33->clamp 60, distinto)
    expect(overlayRowHFor(640, 6)).toBe('78px');
  });

  it('el cálculo de "ideal" usa multiplicación por (numRows-1), no división (distingue con numRows=3 sin clamping)', () => {
    // numCols=3 (ancho 500), choferes=7, numRows=3, clientHeight=400, headerH=20
    // availH=400-20-16=364; ideal real=(364-8*2)/3=(364-16)/3=116
    // (si fuera división: ideal=(364-8/2)/3=(364-4)/3=120, distinto — ambos sin clamping)
    expect(overlayRowHFor(500, 6, 400, 20)).toBe('116px');
  });

  it('el drop sobre un chofer de un solo código reasigna directo (mismo código, sin confirmación)', async () => {
    const prep = makePrep(); // pedidos en BIG
    const { onReasignar, onDragEnd } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    // CH1 atiende solo BIG
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    await waitFor(() => expect(onReasignar).toHaveBeenCalledWith(prep, 'CH1', BIG));
    expect(onDragEnd).toHaveBeenCalled();
  });

  it('el drop sobre un chofer multi-código abre el selector', () => {
    const prep = makePrep();
    const { onReasignar } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García'); // CH2: BIG y PERI 5
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    expect(screen.getByText('Elegí el código de despacho')).toBeInTheDocument();
    expect(onReasignar).not.toHaveBeenCalled();

    // elegir el código que coincide → reasigna sin confirmación
    fireEvent.click(screen.getByRole('button', { name: /BIG/ }));
    expect(onReasignar).toHaveBeenCalledWith(prep, 'CH2', BIG);
  });

  it('elegir un código distinto pide confirmación de cross-code', () => {
    const prep = makePrep(); // pedidos en BIG
    const { onReasignar } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    fireEvent.click(screen.getByRole('button', { name: /PERI 5/ }));

    expect(screen.getByText('Cambiar código de despacho')).toBeInTheDocument();
    expect(screen.getByText(/se van a reasignar de/)).toBeInTheDocument();
    expect(onReasignar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
    expect(onReasignar).toHaveBeenCalledWith(prep, 'CH2', PERI);
  });

  it('cancelar la confirmación no reasigna', () => {
    const prep = makePrep();
    const { onReasignar } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    fireEvent.click(screen.getByRole('button', { name: /PERI 5/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Cambiar código de despacho')).not.toBeInTheDocument();
    expect(onReasignar).not.toHaveBeenCalled();
  });

  it('con cross-code ya impactado, volver al código de Digip también pide confirmación', () => {
    const prep = makePrep({ id: 5 }); // Digip muestra BIG
    const { onReasignar } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
      asignacionCrossCodeByPrepId: new Map([
        [5, { destino_nombre: 'PERI 5', destino_id: '150', sigma_sync_estado: 'ok' as SigmaSyncEstado }],
      ]),
    });
    // soltar en CH1 (solo BIG): como Sigma efectivo es PERI 5, mover a BIG es cross
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    expect(screen.getByText('Cambiar código de despacho')).toBeInTheDocument();
    expect(onReasignar).not.toHaveBeenCalled();
  });
});

describe('ChoferesList — refuerzos', () => {
  it('el selector se puede cancelar con el botón y con el fondo', () => {
    const prep = makePrep();
    const { onReasignar } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    let targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Elegí el código de despacho')).not.toBeInTheDocument();

    targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    fireEvent.click(screen.getByText('Elegí el código de despacho').closest('div')!.parentElement!);
    expect(screen.queryByText('Elegí el código de despacho')).not.toBeInTheDocument();
    expect(onReasignar).not.toHaveBeenCalled();
  });

  it('dragOver resalta la celda del chofer en la grilla overlay, dragLeave la limpia', () => {
    renderList({
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    const cell = targets[targets.length - 1];
    expect(cell.className).not.toContain('bg-blue-200');

    fireEvent.dragOver(cell, { dataTransfer: dt });
    expect(cell.className).toContain('bg-blue-200');

    fireEvent.dragLeave(cell);
    expect(cell.className).not.toContain('bg-blue-200');
  });

  it('startDragPrep configura el dataTransfer y avisa onDragStart', async () => {
    const prep = makePrep({ id: 42, codigo_envio: null })
    const { onDragStart } = renderList({
      preparacionesPorChofer: new Map([['CH1', [prep]]]),
    });
    const card = screen.getByText('#42').closest('[draggable]')!;
    fireEvent.dragStart(card, { dataTransfer: dt });
    expect(dt.setData).toHaveBeenCalledWith('text/plain', '42');
    // OJO: effectAllowed/dropEffect no son observables vía fireEvent — testing-library copia
    // las props del dataTransfer dado a un objeto nuevo, así que la reasignación que hace el
    // componente (`e.dataTransfer.effectAllowed = 'move'`) queda en esa copia, no en `dt`. Los
    // métodos (setData) sí se ven porque la referencia a la función es la misma.
    await waitFor(() => expect(onDragStart).toHaveBeenCalledWith(prep));
  });

  it('el drop en un chofer sin códigos no hace nada', () => {
    const prep = makePrep();
    const { onReasignar } = renderList({
      choferes: [...CHOFERES, { codigo: 'CH9', descripcion: 'Nuevo', desactivado: 0 }],
      preparacionesPorChofer: new Map([['CH9', [makePrep({ id: 5 })]]]),
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('Nuevo');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    expect(onReasignar).not.toHaveBeenCalled();
    expect(screen.queryByText('Elegí el código de despacho')).not.toBeInTheDocument();
  });

  it('el drop sin preparación arrastrada (draggedPrep null) no hace nada', () => {
    const { onReasignar } = renderList({
      draggedPrep: null,
      draggedCodigos: new Set(['BIG']), // isDragging true, pero sin prep asociada
    });
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    expect(onReasignar).not.toHaveBeenCalled();
    expect(screen.queryByText('Elegí el código de despacho')).not.toBeInTheDocument();
  });

  it('actualiza el resaltado si cambia codigosDespachoByChofer (deps del useCallback)', () => {
    const { rerender, ...props } = renderList({
      codigosDespachoByChofer: new Map([['CH1', [BIG]], ['CH2', [BIG]]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['PERI 5']),
    });
    let targets = screen.getAllByTitle('García');
    expect(targets[targets.length - 1].className).not.toContain('border-emerald-500');

    rerender(<ChoferesList {...props} codigosDespachoByChofer={new Map([['CH1', [BIG]], ['CH2', [BIG, PERI]]])} draggedPrep={makePrep()} draggedCodigos={new Set(['PERI 5'])} />);
    targets = screen.getAllByTitle('García');
    expect(targets[targets.length - 1].className).toContain('border-emerald-500');
  });

  it('resalta en la grilla los choferes que atienden el código arrastrado', () => {
    renderList({
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['PERI 5']), // solo CH2 lo atiende
    });
    const targets = screen.getAllByTitle('García');
    const cardGarcia = targets[targets.length - 1];
    expect(cardGarcia.className).toContain('border-emerald-500');
    const targetsLopez = screen.getAllByTitle('López');
    expect(targetsLopez[targetsLopez.length - 1].className).not.toContain('border-emerald-500');
  });

  it('muestra +N cuando el chofer tiene más de 6 códigos en la grilla', () => {
    const muchos = Array.from({ length: 8 }, (_, i) => ({
      id: 200 + i, nombre: `RUTA ${i}`, desactivado: 0, direccion: null,
    }));
    const { container } = renderList({
      codigosDespachoByChofer: new Map([['CH1', muchos]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const overlay = container.querySelector('.z-30') as HTMLElement;
    expect(within(overlay).getByText('+2')).toBeInTheDocument();
    // recorta a los primeros 6 (slice) dentro del overlay, aunque la lista normal (no overlay)
    // sí muestre todos los códigos sin recortar.
    expect(within(overlay).queryByText('RUTA 6')).not.toBeInTheDocument();
    expect(within(overlay).queryByText('RUTA 7')).not.toBeInTheDocument();
  });

  it('overlay: la celda del chofer tiene las clases base y el containerType de tamaño de contenedor', () => {
    renderList({
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('López');
    const cell = targets[targets.length - 1];
    expect(cell.className).toContain('rounded-lg border-2 px-2 py-1.5 flex flex-col justify-center');
    expect(cell.style.containerType).toBe('size');
  });

  it('overlay: un chofer inactivo muestra el ícono y el nombre en gris con tachado', () => {
    const { container } = renderList({
      choferes: [{ codigo: 'CH1', descripcion: 'Inactivo1', desactivado: 1 }],
      codigosDespachoByChofer: new Map([['CH1', [BIG]]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const overlay = container.querySelector('.z-30') as HTMLElement;
    const nombre = within(overlay).getByText('Inactivo1');
    expect(nombre.className).toContain('text-slate-400 line-through');
    const icon = nombre.previousElementSibling as HTMLElement;
    expect(icon.getAttribute('class')).toContain('text-slate-400');
  });

  it('overlay: un chofer activo muestra el ícono y el nombre en azul, sin tachado', () => {
    const { container } = renderList({
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const overlay = container.querySelector('.z-30') as HTMLElement;
    const nombre = within(overlay).getByText('López');
    expect(nombre.className).toContain('font-semibold leading-none whitespace-nowrap overflow-hidden text-ellipsis text-slate-800');
    expect(nombre.className).not.toContain('line-through');
    const icon = nombre.previousElementSibling as HTMLElement;
    expect(icon.getAttribute('class')).toContain('shrink-0 text-blue-600');
  });

  it('con descripción null en el overlay no rompe el cálculo de tamaño de fuente (nameLen cae a 1, no explota)', () => {
    renderList({
      choferes: [{ codigo: 'CH1', descripcion: null as unknown as string, desactivado: 0 }],
      codigosDespachoByChofer: new Map([['CH1', [BIG]]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    // Si no explotó, el overlay se renderizó igual (la grilla está presente).
    expect(screen.getByText('Soltá la preparación en un chofer')).toBeInTheDocument();
  });
});

describe('ChoferesList — orden de choferes (comparator)', () => {
  // OJO: usar screen.getAllByText(regex) para capturar el orden real del DOM — un array
  // armado a mano con getByText(x), getByText(y) siempre devuelve ese orden fijo sin
  // importar cómo quedó posicionado en el documento, y no detecta regresiones de sort.
  it('entre dos activos, uno con prep y otro sin prep: el que tiene prep va primero', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH2', [makePrep({ id: 9 })]]]),
    });
    const nombres = screen.getAllByText(/^(García|López)$/).map(e => e.textContent);
    expect(nombres).toEqual(['García', 'López']);
  });

  it('entre dos activos, si ninguno tiene prep, mantiene el orden original', () => {
    renderList();
    const nombres = screen.getAllByText(/^(García|López)$/).map(e => e.textContent);
    expect(nombres).toEqual(['López', 'García']);
  });

  it('entre dos activos, si ambos tienen prep, mantiene el orden original', () => {
    renderList({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ id: 1 })]],
        ['CH2', [makePrep({ id: 2 })]],
      ]),
    });
    const nombres = screen.getAllByText(/^(García|López)$/).map(e => e.textContent);
    expect(nombres).toEqual(['López', 'García']);
  });

  it('un chofer inactivo con prep queda igual al final, detrás de uno activo sin prep', () => {
    renderList({
      choferes: [
        { codigo: 'CH1', descripcion: 'InactivoConPrep', desactivado: 1 },
        { codigo: 'CH2', descripcion: 'ActivoSinPrep', desactivado: 0 },
      ],
      preparacionesPorChofer: new Map([['CH1', [makePrep()]]]),
    });
    const nombres = screen.getAllByText(/^(ActivoSinPrep|InactivoConPrep)$/).map(e => e.textContent);
    expect(nombres).toEqual(['ActivoSinPrep', 'InactivoConPrep']);
  });

  it('un chofer activo va antes que uno inactivo aunque el inactivo venga primero en la lista original', () => {
    renderList({
      choferes: [
        { codigo: 'CH1', descripcion: 'ChoferB', desactivado: 1 },
        { codigo: 'CH2', descripcion: 'ChoferA', desactivado: 0 },
      ],
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ id: 1 })]],
        ['CH2', [makePrep({ id: 2 })]],
      ]),
    });
    const nombres = screen.getAllByText(/^(ChoferA|ChoferB)$/).map(e => e.textContent);
    expect(nombres).toEqual(['ChoferA', 'ChoferB']);
  });
});

describe('ChoferesList — choferTieneCodigo / codigosDespachoDeChofer', () => {
  it('no resalta ningún chofer si draggedCodigos es un Set vacío', () => {
    renderList({
      draggedPrep: makePrep(),
      draggedCodigos: new Set(),
    });
    const targets = screen.getAllByTitle('López');
    expect(targets[targets.length - 1].className).not.toContain('border-emerald-500');
  });

  it('un chofer sin ningún código de despacho registrado no se resalta como compatible', () => {
    renderList({
      choferes: [...CHOFERES, { codigo: 'CH9', descripcion: 'SinCodigos', desactivado: 0 }],
      preparacionesPorChofer: new Map([['CH9', [makePrep({ id: 8 })]]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('SinCodigos');
    expect(targets[targets.length - 1].className).not.toContain('border-emerald-500');
  });

  it('un código de despacho con nombre null no compatibiliza aunque el Set incluya null-like', () => {
    const conNombreNull: CodigoDespacho = { id: 999, nombre: null, desactivado: 0, direccion: null };
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [conNombreNull]]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('López');
    expect(targets[targets.length - 1].className).not.toContain('border-emerald-500');
  });

  it('el selector solo lista códigos con nombre no nulo', () => {
    const conNombreNull: CodigoDespacho = { id: 999, nombre: null, desactivado: 0, direccion: null };
    const prep = makePrep();
    renderList({
      codigosDespachoByChofer: new Map([['CH2', [BIG, PERI, conNombreNull]]]),
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    // Deben listarse solo BIG y PERI 5 (2 opciones), no el de nombre null
    const dialog = screen.getByText('Elegí el código de despacho').closest('div')!.parentElement!;
    expect(dialog.querySelectorAll('button').length).toBe(3); // 2 opciones + Cancelar
  });

  it('si el chofer no atiende ningún código (todos con nombre null), el drop no hace nada', () => {
    const conNombreNull: CodigoDespacho = { id: 999, nombre: null, desactivado: 0, direccion: null };
    const prep = makePrep();
    const { onReasignar } = renderList({
      codigosDespachoByChofer: new Map([['CH1', [conNombreNull]]]),
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    expect(onReasignar).not.toHaveBeenCalled();
    expect(screen.queryByText('Elegí el código de despacho')).not.toBeInTheDocument();
  });
});

describe('ChoferesList — estilos activo/inactivo', () => {
  it('un chofer activo usa fondo blanco y no las clases de inactivo', () => {
    renderList({
      choferes: [{ codigo: 'CH1', descripcion: 'Activo', desactivado: 0 }],
    });
    const card = screen.getByText('Activo').closest('div')!.parentElement!;
    expect(card.className).toContain('bg-white');
    expect(card.className).not.toContain('opacity-80');
  });

  it('un chofer inactivo usa opacidad y fondo distinto', () => {
    renderList({
      choferes: [{ codigo: 'CH1', descripcion: 'ChoferInactivo', desactivado: 1 }],
    });
    const card = screen.getByText('ChoferInactivo').closest('div')!.parentElement!;
    expect(card.className).toContain('opacity-80');
    expect(card.className).toContain('bg-slate-50/60');
  });

  it('un chofer activo: ícono azul sobre fondo celeste, nombre sin tachar, sin badge "Inactivo"', () => {
    renderList({
      choferes: [{ codigo: 'CH1', descripcion: 'Activo', desactivado: 0 }],
    });
    const nombre = screen.getByText('Activo');
    expect(nombre.className).toContain('text-slate-800');
    expect(nombre.className).not.toContain('line-through');
    expect(nombre.className).toContain('text-sm font-semibold truncate flex-1');
    const iconWrap = nombre.previousElementSibling as HTMLElement;
    expect(iconWrap.className).toContain('bg-blue-100');
    expect(iconWrap.className).toContain('rounded-full p-2 shrink-0');
    const icon = iconWrap.querySelector('svg')!.getAttribute('class')!;
    expect(icon).toContain('text-blue-600');
    expect(icon).toContain('w-4 h-4');
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
    const badge = screen.getByText('#CH1');
    expect(badge.className).toContain('text-muted-foreground');
    expect(badge.className).toContain('bg-slate-200');
    expect(badge.className).toContain('text-sm shrink-0 px-2 py-0.5 rounded-full');
    const card = nombre.closest('.rounded-lg')!;
    expect(card.className).toContain('border-2 border-dashed min-h-[120px] flex flex-col');
  });

  it('un chofer inactivo: ícono gris sobre fondo gris, nombre tachado, badge "Inactivo" visible', () => {
    renderList({
      choferes: [{ codigo: 'CH1', descripcion: 'ChoferInactivo', desactivado: 1 }],
    });
    const nombre = screen.getByText('ChoferInactivo');
    expect(nombre.className).toContain('text-slate-400');
    expect(nombre.className).toContain('line-through');
    const iconWrap = nombre.previousElementSibling as HTMLElement;
    expect(iconWrap.className).toContain('bg-slate-200');
    expect(iconWrap.querySelector('svg')!.getAttribute('class')).toContain('text-slate-400');
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    const badge = screen.getByText('#CH1');
    expect(badge.className).toContain('text-slate-400');
    expect(badge.className).toContain('bg-slate-100');
  });
});

describe('ChoferesList — resumen de preparaciones (bordes)', () => {
  it('no muestra el resumen ni la sección "Preparaciones" si el chofer no tiene ninguna', () => {
    renderList();
    expect(screen.queryByText(/Preparaciones \(/)).not.toBeInTheDocument();
  });

  it('no muestra la sección "Códigos de despacho" si el chofer no atiende ninguno (solo tiene preps)', () => {
    renderList({
      codigosDespachoByChofer: new Map([['CH1', []]]),
      preparacionesPorChofer: new Map([['CH1', [makePrep()]]]),
    });
    expect(screen.queryByText(/Códigos de despacho \(/)).not.toBeInTheDocument();
  });

  it('un chofer sin entrada alguna en codigosDespachoByChofer (no [], directamente ausente) tampoco muestra la sección', () => {
    renderList({
      codigosDespachoByChofer: new Map(), // CH1 ni siquiera tiene key
      preparacionesPorChofer: new Map([['CH1', [makePrep()]]]),
    });
    expect(screen.queryByText(/Códigos de despacho \(/)).not.toBeInTheDocument();
  });

  it('no calcula ni muestra el resumen de clientes/pedidos si no hay preparaciones (guard real, no solo la sección)', () => {
    renderList();
    expect(screen.queryByText(/únicos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pedidos?$/)).not.toBeInTheDocument();
  });

  it('desconecta el ResizeObserver al desmontar mientras se arrastra', () => {
    const disconnectSpy = vi.fn();
    const observeSpy = vi.fn();
    const OriginalRO = globalThis.ResizeObserver;
    // @ts-expect-error mock mínimo
    globalThis.ResizeObserver = class { observe = observeSpy; disconnect = disconnectSpy; };
    try {
      const { unmount } = renderList({
        draggedPrep: makePrep(),
        draggedCodigos: new Set(['BIG']),
      });
      expect(observeSpy).toHaveBeenCalled();
      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
    } finally {
      globalThis.ResizeObserver = OriginalRO;
    }
  });

  it('cuenta un pedido con codigo_cliente_ubicacion vacío (falsy) como cliente único distinto', () => {
    const { container } = renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, pedidos: [makePedido({ codigo_cliente_ubicacion: '', cliente_nombre: null })] }),
      ]]]),
    });
    // codigo_cliente_ubicacion '' es falsy: cae al fallback cliente_nombre, que también es null -> no se agrega ninguno
    expect(container.textContent).toMatch(/0 clientes? únicos/);
  });
});

describe('ChoferesList — código de envío y tarjeta de preparación (detalle)', () => {
  it('el código de envío se muestra cuando está presente (no usa el fallback #id)', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 5, codigo_envio: 'E-XYZ' })]]]),
    });
    expect(screen.getByText('E-XYZ')).toBeInTheDocument();
    expect(screen.queryByText('#5')).not.toBeInTheDocument();
  });

  it('la clase de fondo por tipo y de borde por estado se combinan (tipo distinto de amber)', () => {
    const { container } = renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ tipo: 'Agrupa por direccion de entrega', estado: 'Pendiente' })]]]),
    });
    const card = container.querySelector('.group')!;
    expect(card.className).toContain('bg-teal-100');
    expect(card.className).toContain('border-l-slate-400');
  });

  it('un tipo no mapeado cae al fondo blanco por defecto', () => {
    const { container } = renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ tipo: 'Tipo inexistente' })]]]),
    });
    const card = container.querySelector('.group')!;
    expect(card.className).toContain('bg-white');
    expect(card.className).not.toContain('bg-amber-100');
    expect(card.className).not.toContain('bg-teal-100');
  });

  it('un estado no mapeado cae al borde gris por defecto (mismo valor que "pendiente", pero por la rama fallback)', () => {
    const { container } = renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ estado: 'Estado Desconocido' })]]]),
    });
    const card = container.querySelector('.group')!;
    expect(card.className).toContain('border-l-slate-400');
  });

  it('un estado null (defensivo) no rompe y cae al borde por defecto', () => {
    const { container } = renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ estado: null as unknown as string })]]]),
    });
    const card = container.querySelector('.group')!;
    expect(card.className).toContain('border-l-slate-400');
  });

  it('estado en mayúsculas también matchea el borde (case-insensitive)', () => {
    const { container } = renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ estado: 'REMITIDO' })]]]),
    });
    const card = container.querySelector('.group')!;
    expect(card.className).toContain('border-l-sky-500');
  });

  it('muestra los badges de sigma "ok", "fallido" y "bloqueado" (no solo "pendiente")', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1 }), makePrep({ id: 2 }), makePrep({ id: 3 }),
      ]]]),
      sigmaEstadoByPrepId: new Map<number, SigmaSyncEstado>([[1, 'ok'], [2, 'fallido'], [3, 'bloqueado']]),
    });
    expect(screen.getByText('sync')).toBeInTheDocument();
    expect(screen.getByText('sigma!')).toBeInTheDocument();
    expect(screen.getByText('bloq')).toBeInTheDocument();
  });

  it('no muestra ningún badge de sigma sin sigmaEstadoByPrepId', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ id: 1 })]]]),
    });
    expect(screen.queryByText('sigma')).not.toBeInTheDocument();
    expect(screen.queryByText('sync')).not.toBeInTheDocument();
  });

  it('no muestra la línea de códigos de despacho de la prep si todos los pedidos tienen codigo_despacho null', () => {
    renderList({
      preparacionesPorChofer: new Map([['CH1', [makePrep({
        pedidos: [makePedido({ codigo_despacho: null })],
      })]]]),
    });
    expect(screen.queryByTitle('BIG')).not.toBeInTheDocument();
  });
});

describe('ChoferesList — resaltado "coincide" en la lista de códigos del chofer (no overlay)', () => {
  it('resalta en verde el código que coincide con el arrastrado, mientras se arrastra', () => {
    renderList({
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const fila = screen.getAllByText('BIG').filter(e => !e.hasAttribute('style'))[0].closest('div')!;
    expect(fila.className).toContain('flex items-center gap-1.5 text-sm rounded px-1 -mx-1');
    expect(fila.className).toContain('bg-emerald-50');
  });

  it('no resalta un código que no coincide con el arrastrado', () => {
    renderList({
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const fila = screen.getAllByText('PERI 5').filter(e => !e.hasAttribute('style'))[0].closest('div')!;
    expect(fila.className).not.toContain('bg-emerald-50');
  });

  it('no resalta ningún código si no se está arrastrando', () => {
    renderList();
    const fila = screen.getAllByText('BIG').filter(e => !e.hasAttribute('style'))[0].closest('div')!;
    expect(fila.className).not.toContain('bg-emerald-50');
  });

  it('un código de excepción no se resalta como "coincide" aunque su nombre matchee', () => {
    const excepcional: CodigoDespacho = {
      id: 'RUTA X', nombre: 'BIG', desactivado: 0, direccion: null, es_excepcion: true, excepcion_id: 42,
    };
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [excepcional]]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const fila = screen.getByText('excep.', { selector: 'span' }).closest('div')!;
    expect(fila.className).not.toContain('bg-emerald-50');
  });

  it('un código de excepción no muestra la dirección aunque la tenga', () => {
    const excepcional: CodigoDespacho = {
      id: 'RUTA X', nombre: 'RUTA X', desactivado: 0, direccion: 'Alguna dirección', es_excepcion: true, excepcion_id: 42,
    };
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [excepcional]]]),
    });
    expect(screen.queryByText('· Alguna dirección')).not.toBeInTheDocument();
  });
});

describe('ChoferesList — overlay: chips de códigos por chofer', () => {
  it('resalta en verde el chip del código arrastrado y en gris el que no coincide', () => {
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [BIG, PERI]]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const chipBig = screen.getAllByText('BIG').find(e => e.tagName === 'SPAN' && e.style.padding)!;
    const chipPeri = screen.getAllByText('PERI 5').find(e => e.tagName === 'SPAN' && e.style.padding)!;
    expect(chipBig.className).toContain('font-mono rounded leading-none shrink-0');
    expect(chipBig.className).toContain('bg-emerald-200');
    expect(chipPeri.className).not.toContain('bg-emerald-200');
    expect(chipPeri.className).toContain('bg-slate-200');
  });

  it('un chip de excepción usa el color naranja cuando no coincide', () => {
    const excepcional: CodigoDespacho = {
      id: 'RUTA X', nombre: 'RUTA X', desactivado: 0, direccion: null, es_excepcion: true, excepcion_id: 42,
    };
    renderList({
      codigosDespachoByChofer: new Map([['CH1', [excepcional]]]),
      draggedPrep: makePrep(),
      draggedCodigos: new Set(['BIG']),
    });
    const chip = screen.getAllByText('RUTA X').find(e => e.tagName === 'SPAN' && e.style.padding)!;
    expect(chip.className).toContain('bg-orange-100');
  });
});

describe('ChoferesList — selector: estilos de "coincide"', () => {
  it('la opción que coincide usa borde y fondo verde; la que no, gris', () => {
    const prep = makePrep({ pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] });
    renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    const btnPeri = screen.getByRole('button', { name: /PERI 5/ });
    const btnBig = screen.getByRole('button', { name: /^BIG/ });
    expect(btnPeri.className).toContain('border-emerald-400');
    expect(btnBig.className).not.toContain('border-emerald-400');
    expect(btnBig.className).toContain('border-slate-200');
  });

  it('no muestra la etiqueta "coincide" en la opción que no matchea', () => {
    const prep = makePrep({ pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] });
    renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    const btnBig = screen.getByRole('button', { name: /^BIG/ });
    expect(btnBig.textContent).not.toContain('coincide');
  });

  it('muestra la etiqueta "coincide" en la opción cuyo nombre coincide con el código de la preparación', () => {
    const prep = makePrep({ pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] });
    renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    const btnPeri = screen.getByRole('button', { name: /PERI 5/ });
    expect(btnPeri.textContent).toContain('coincide');
  });

  it('click dentro del selector no lo cierra (stopPropagation)', () => {
    const prep = makePrep({ pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] });
    renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    fireEvent.click(screen.getByText('Elegí el código de despacho'));
    expect(screen.getByText('Elegí el código de despacho')).toBeInTheDocument();
  });

  it('la opción que coincide tiene el ícono y el texto en verde; la que no, en gris', () => {
    const prep = makePrep({ pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] });
    renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    const btnPeri = screen.getByRole('button', { name: /PERI 5/ });
    expect(btnPeri.querySelector('svg')!.getAttribute('class')).toContain('w-3.5 h-3.5 shrink-0 text-emerald-600');
    expect(btnPeri.querySelector('span')!.className).toContain('font-medium text-emerald-800');
    const btnBig = screen.getByRole('button', { name: /^BIG/ });
    expect(btnBig.querySelector('svg')!.getAttribute('class')).toContain('w-3.5 h-3.5 shrink-0 text-slate-500');
    expect(btnBig.querySelector('span')!.className).toContain('font-medium text-slate-700');
  });

  it('un pedido sin codigo_despacho no rompe el cálculo de coincidencia del selector', () => {
    const prep = makePrep({ pedidos: [
      makePedido({ codigo: 'P1', codigo_despacho: null }),
      makePedido({ codigo: 'P2', codigo_despacho: 'PERI 5' }),
    ] });
    renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    const btnPeri = screen.getByRole('button', { name: /PERI 5/ });
    expect(btnPeri.textContent).toContain('coincide');
  });

  it('no muestra dirección en la opción si no la tiene', () => {
    const sinDireccion: CodigoDespacho = { id: 999, nombre: 'SIN DIR', desactivado: 0, direccion: null };
    const prep = makePrep();
    renderList({
      codigosDespachoByChofer: new Map([['CH2', [BIG, sinDireccion]]]), // 2 opciones para que abra el selector
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    const btn = screen.getByRole('button', { name: /SIN DIR/ });
    expect(btn.querySelectorAll('span').length).toBe(1); // solo el nombre, sin span de dirección
  });

  it('el botón de la opción del selector tiene las clases base esperadas', () => {
    const prep = makePrep();
    renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    const btnBig = screen.getByRole('button', { name: /^BIG/ });
    expect(btnBig.className).toContain('flex items-center gap-2 px-3 py-2 text-sm rounded-md border text-left');
  });

  it('muestra la dirección de la opción si la tiene', () => {
    const prep = makePrep();
    renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('García');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    expect(screen.getByText('LOMAS')).toBeInTheDocument();
    expect(screen.getByText('SUR')).toBeInTheDocument();
  });
});

describe('ChoferesList — confirmación cross-code: texto exacto', () => {
  it('ignora pedidos con codigo_despacho null al calcular el código actual único', () => {
    const prep = makePrep({ pedidos: [
      makePedido({ codigo: 'P1', codigo_despacho: null }),
      makePedido({ codigo: 'P2', codigo_despacho: 'PERI 5' }),
    ] });
    const { container } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    // un solo código real (PERI 5) pese al pedido con null -> se detecta como código actual único
    expect(container.textContent).toContain('Los pedidos de esta preparación se van a reasignar de PERI 5');
  });

  it('el texto de confirmación menciona el código actual y el destino por separado', () => {
    const prep = makePrep({ pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] });
    const { container } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    // espacios reales entre "de"/"a" y los valores (JSX {' '})
    expect(container.textContent).toContain('Los pedidos de esta preparación se van a reasignar de PERI 5');
    expect(container.textContent).toContain('PERI 5 a BIG');
  });

  it('sin código actual único (pedidos con distintos códigos), el texto es "al código X" sin mencionar origen', () => {
    const prep = makePrep({ pedidos: [
      makePedido({ codigo: 'P1', codigo_despacho: 'PERI 5' }),
      makePedido({ codigo: 'P2', codigo_despacho: 'OTRO' }),
    ] });
    const { container } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    expect(container.textContent).toContain('Los pedidos de esta preparación se van a reasignar al código BIG'); // espacio real entre "código" y el valor
    expect(container.textContent).not.toContain('se van a reasignar de');
  });

  it('click dentro del modal de confirmación no lo cierra (stopPropagation); click afuera sí', () => {
    const prep = makePrep({ pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] });
    const { onReasignar } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    fireEvent.click(screen.getByText('Cambiar código de despacho'));
    expect(screen.getByText('Cambiar código de despacho')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cambiar código de despacho').closest('.bg-black\\/40')!);
    expect(screen.queryByText('Cambiar código de despacho')).not.toBeInTheDocument();
    expect(onReasignar).not.toHaveBeenCalled();
  });

  it('Confirmar cambio llama a onReasignar y cierra el modal', () => {
    const prep = makePrep({ pedidos: [makePedido({ codigo_despacho: 'PERI 5' })] });
    const { onReasignar } = renderList({
      draggedPrep: prep,
      draggedCodigos: new Set(['BIG']),
    });
    const targets = screen.getAllByTitle('López');
    fireEvent.drop(targets[targets.length - 1], { dataTransfer: dt });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
    expect(onReasignar).toHaveBeenCalledWith(prep, 'CH1', BIG);
    expect(screen.queryByText('Cambiar código de despacho')).not.toBeInTheDocument();
  });
});
