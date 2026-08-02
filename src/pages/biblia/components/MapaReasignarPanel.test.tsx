import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MapaReasignarPanel, type MapaPinItem } from './MapaReasignarPanel';
import type { Chofer, CodigoDespacho, Pedido, Preparacion } from '../types/biblia';

function makePedido(over: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'P1',
    codigo_despacho: 'BIG',
    codigo_cliente_ubicacion: 'CL1',
    cliente_nombre: 'Cliente Uno',
    cliente_direccion: null,
    cliente_lat: -34.7,
    cliente_lng: -58.4,
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
  { codigo: 'CH3', descripcion: 'Álvarez', desactivado: 0 },
  { codigo: 'CH4', descripcion: 'Sin código asignado', desactivado: 0 },
];

const BIG: CodigoDespacho = { id: 151, nombre: 'BIG', desactivado: 0, direccion: null };
const PERI: CodigoDespacho = { id: 150, nombre: 'PERI 5', desactivado: 0, direccion: null };

function makeItem(over: Partial<MapaPinItem> = {}): MapaPinItem {
  return { prep: makePrep(), pedido: makePedido(), choferCodigo: 'CH1', ...over };
}

function renderPanel(over: Partial<Parameters<typeof MapaReasignarPanel>[0]> = {}) {
  const props = {
    descripcion: 'Cliente Uno',
    items: [makeItem()],
    choferes: CHOFERES,
    codigosDespachoByChofer: new Map([
      ['CH1', [BIG]],
      ['CH2', [PERI]],
      ['CH3', [BIG, PERI]],
    ]),
    reasignarPreparacion: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...over,
  };
  const utils = render(<MapaReasignarPanel {...props} />);
  return { ...props, ...utils };
}

beforeEach(() => vi.clearAllMocks());

describe('MapaReasignarPanel', () => {
  it('con un solo item va directo al selector de chofer, excluyendo el actual', () => {
    renderPanel();
    expect(screen.getByText('Reasignar preparación')).toBeInTheDocument();
    expect(screen.getByText(/E-1 · BIG · \$ 500/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'López' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'García' })).toBeInTheDocument();
  });

  it('con varios items primero pide elegir la preparación', () => {
    renderPanel({
      items: [
        makeItem(),
        makeItem({ prep: makePrep({ id: 2, codigo_envio: 'E-2' }), choferCodigo: 'CH2' }),
      ],
    });
    expect(screen.getByText('2 preparaciones en este punto — elegí cuál reasignar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('García').closest('button')!);
    expect(screen.getByText('Reasignar preparación')).toBeInTheDocument();
  });

  it('elegir un chofer del mismo código requiere hoy un segundo click (bug conocido: choferElegido stale)', async () => {
    // BUG: elegirChofer() llama a aplicar() en el mismo handler que setChoferElegido(),
    // así que aplicar() ve choferElegido=null y retorna sin reasignar. El segundo click,
    // con el estado ya actualizado, sí aplica. Si se corrige el bug, este test debe
    // actualizarse para esperar la reasignación al primer click.
    const { reasignarPreparacion, onClose } = renderPanel({
      items: [makeItem({ choferCodigo: 'CH2' })], // actual: García (PERI)
    });
    fireEvent.click(screen.getByRole('button', { name: 'López' })); // CH1: solo BIG
    expect(reasignarPreparacion).not.toHaveBeenCalled(); // primer click: no pasa nada

    fireEvent.click(screen.getByRole('button', { name: 'López' })); // segundo click
    await waitFor(() => expect(reasignarPreparacion).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'CH1', BIG));
    expect(onClose).toHaveBeenCalled();
  });

  it('elegir un chofer de código distinto pide confirmación', async () => {
    const { reasignarPreparacion } = renderPanel(); // prep BIG, actual CH1
    fireEvent.click(screen.getByRole('button', { name: 'García' })); // CH2: PERI 5
    expect(screen.getByText('Cambiar código de despacho')).toBeInTheDocument();
    expect(reasignarPreparacion).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
    await waitFor(() => expect(reasignarPreparacion).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'CH2', PERI));
  });

  it('un chofer multi-código abre el selector de códigos', async () => {
    const { reasignarPreparacion } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Álvarez' })); // BIG y PERI
    expect(screen.getByText('Elegí el código de despacho')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BIG' })); // mismo código → directo
    await waitFor(() => expect(reasignarPreparacion).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'CH3', BIG));
  });

  it('elegir un código distinto desde el selector pide confirmación', () => {
    const { reasignarPreparacion } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Álvarez' }));
    fireEvent.click(screen.getByRole('button', { name: 'PERI 5' }));
    expect(screen.getByText('Cambiar código de despacho')).toBeInTheDocument();
    expect(reasignarPreparacion).not.toHaveBeenCalled();
  });

  it('Atrás en el selector de códigos vuelve a la lista de choferes', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Álvarez' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByText('Reasignar preparación')).toBeInTheDocument();
  });

  it('cancelar la confirmación vuelve sin reasignar', () => {
    const { reasignarPreparacion } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'García' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Cambiar código de despacho')).not.toBeInTheDocument();
    expect(reasignarPreparacion).not.toHaveBeenCalled();
  });

  it('el click en el fondo cierra el panel', () => {
    const { onClose, container } = renderPanel();
    fireEvent.click(container.firstElementChild!);
    expect(onClose).toHaveBeenCalled();
  });

  it('el click dentro del panel no lo cierra (stopPropagation)', () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByText('Reasignar preparación'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('un chofer sin códigos de despacho asociados no abre ningún selector', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Sin código asignado' }));
    expect(screen.queryByText('Cambiar código de despacho')).not.toBeInTheDocument();
    expect(screen.queryByText('Elegí el código de despacho')).not.toBeInTheDocument();
    expect(screen.getByText('Reasignar preparación')).toBeInTheDocument();
  });

  it('sin código de envío en el item único, muestra el fallback #id', () => {
    renderPanel({
      items: [makeItem({ prep: makePrep({ codigo_envio: null }) })],
    });
    expect(screen.getByText(/#1 · BIG ·/)).toBeInTheDocument();
  });

  it('con pedidos de más de un código de despacho, no hay código actual único', () => {
    renderPanel({
      items: [makeItem({
        prep: makePrep({ pedidos: [makePedido({ codigo_despacho: 'BIG' }), makePedido({ codigo_despacho: 'PERI 5' })] }),
      })],
    });
    expect(screen.getByText(/sin código/)).toBeInTheDocument();
  });

  it('ignora pedidos sin código de despacho al determinar el código actual', () => {
    renderPanel({
      items: [makeItem({
        prep: makePrep({ pedidos: [makePedido({ codigo_despacho: 'BIG' }), makePedido({ codigo_despacho: null })] }),
      })],
    });
    expect(screen.getByText(/E-1 · BIG ·/)).toBeInTheDocument();
  });

  it('mientras se envía deshabilita los botones, y los rehabilita al terminar', async () => {
    let resolveFn!: () => void;
    const promise = new Promise<void>((res) => { resolveFn = res; });
    const reasignarPreparacion = vi.fn().mockReturnValue(promise);
    const { onClose } = renderPanel({ reasignarPreparacion });

    fireEvent.click(screen.getByRole('button', { name: 'García' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
    expect(screen.getByRole('button', { name: 'Confirmar cambio' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    resolveFn();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar cambio' })).not.toBeDisabled());
  });

  it('el texto de confirmación de cambio de código respeta los espacios entre los tramos', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'García' }));
    const parrafo = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Los pedidos de esta preparación se van a reasignar de BIG a PERI 5.');
    expect(parrafo).toBeInTheDocument();
  });

  it('el texto de confirmación sin código actual respeta los espacios', () => {
    renderPanel({
      items: [makeItem({
        prep: makePrep({ pedidos: [makePedido({ codigo_despacho: 'BIG' }), makePedido({ codigo_despacho: 'PERI 5' })] }),
      })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'García' }));
    const parrafo = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Los pedidos de esta preparación se van a reasignar al código PERI 5.');
    expect(parrafo).toBeInTheDocument();
  });

  it('en la lista de varios items, muestra el chofer de cada uno o el código si no se conoce', () => {
    renderPanel({
      items: [
        makeItem({ choferCodigo: 'CH1' }),
        makeItem({ prep: makePrep({ id: 2, codigo_envio: null }), choferCodigo: 'CH-DESCONOCIDO' }),
      ],
    });
    expect(screen.getByText('López')).toBeInTheDocument();
    expect(screen.getByText('CH-DESCONOCIDO')).toBeInTheDocument();
    expect(screen.getByText('#2 · $ 500')).toBeInTheDocument();
  });
});
