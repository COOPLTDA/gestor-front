import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BibliaResumenModal } from './BibliaResumenModal';
import type { MapaPin } from '@/pages/biblia/reporte/MapaReporte';
import type { Chofer, CodigoDespacho, Pedido, Preparacion } from '../types/biblia';
import { formatCurrency } from '../utils/bibliaUtils';

let capturedPines: MapaPin[] = [];
let capturedOnPinClick: ((pin: MapaPin) => void) | null = null;

let capturedLoading: boolean | null = null;

vi.mock('@/pages/biblia/reporte/MapaReporte', () => ({
  MapaReporte: ({ pines, onPinClick, loading }: { pines: MapaPin[]; onPinClick: (pin: MapaPin) => void; loading: boolean }) => {
    capturedPines = pines;
    capturedOnPinClick = onPinClick;
    capturedLoading = loading;
    return <div data-testid="mapa" data-pines={pines.length} />;
  },
}));

vi.mock('./MapaReasignarPanel', () => ({
  MapaReasignarPanel: ({ descripcion, items, onClose }: { descripcion: string; items: { pedido: { codigo: string } }[]; onClose: () => void }) => (
    <div data-testid="reasignar-panel" data-descripcion={descripcion} data-items={items.length} data-primer-pedido={items[0]?.pedido?.codigo}>
      <button onClick={onClose}>cerrar-panel</button>
    </div>
  ),
}));

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
    peso: 2,
    volumen: 0,
    peso_text: '2 kg',
    volumen_text: '0',
    ...over,
  };
}

const CHOFERES: Chofer[] = [
  { codigo: 'CH1', descripcion: 'López', desactivado: 0 },
  { codigo: 'CH2', descripcion: 'García', desactivado: 0 },
];

const CODIGOS: CodigoDespacho[] = [
  { id: 151, nombre: 'BIG', desactivado: 0, direccion: 'LOMAS' },
];

function renderModal(over: Partial<Parameters<typeof BibliaResumenModal>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    preparacionesPorChofer: new Map([
      ['CH1', [makePrep({ id: 1, importe_total: 1000 })]],
      ['CH2', [makePrep({ id: 2, importe_total: 5000, pedidos: [makePedido({ codigo: 'P2', codigo_cliente_ubicacion: 'CL2' })] })]],
    ]),
    choferes: CHOFERES,
    bibliaFecha: '2026-07-10',
    codigosDespacho: CODIGOS,
    codigosDespachoByChofer: new Map<string, CodigoDespacho[]>(),
    reasignarPreparacion: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  const utils = render(<BibliaResumenModal {...props} />);
  return { ...props, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedPines = [];
  capturedOnPinClick = null;
  capturedLoading = null;
});

describe('BibliaResumenModal — resumen', () => {
  it('muestra el título con la fecha, choferes y total general', () => {
    renderModal();
    expect(screen.getByText(/Resumen y mapa — viernes, 10 de julio/)).toBeInTheDocument();
    expect(screen.getByText(/2 choferes · \$ 6.000/)).toBeInTheDocument();
  });

  it('ordena las tarjetas por importe descendente', () => {
    renderModal();
    const nombres = screen.getAllByText(/^(López|García)$/).map(e => e.textContent);
    expect(nombres).toEqual(['García', 'López']);
  });

  it('muestra los totales por chofer', () => {
    renderModal();
    // el importe aparece en la tarjeta (total) y en la fila de la prep
    expect(screen.getAllByText('$ 1.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$ 5.000').length).toBeGreaterThan(0);
    // peso en kg
    expect(screen.getAllByText('2,00').length).toBeGreaterThan(0);
  });

  it('muestra el vacío sin asignaciones', () => {
    renderModal({ preparacionesPorChofer: new Map() });
    expect(screen.getByText('No hay choferes asignados en esta biblia.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled();
  });

  it('el contenido del dialog se organiza en columna flex', () => {
    renderModal();
    const content = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(content.style.display).toBe('flex');
    expect(content.style.flexDirection).toBe('column');
  });

  it('la grilla de tarjetas usa grid con auto-fill y gap de 10px', () => {
    renderModal();
    const grid = screen.getByText(/2 chofer/).closest('[role="dialog"]')!.querySelector('.overflow-y-auto') as HTMLElement;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toContain('minmax(200px, 1fr)');
    expect(grid.style.alignContent).toBe('start');
    expect(grid.style.gap).toBe('10px');
  });

  it('Cerrar cierra el modal', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape cierra el modal y resetea la pestaña a resumen (onOpenChange)', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    // el dialog sigue "open" (el mock no cambia esa prop), pero el tab interno debe haber
    // vuelto a 'resumen' — si volviera a "" (mutante), el botón Imprimir desaparecería.
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeInTheDocument();
  });

  it('muestra peso/volumen en la tarjeta solo si son mayores a 0', () => {
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ peso: 3, volumen: 0 })]],
        ['CH2', [makePrep({ id: 2, peso: 0, volumen: 4, importe_total: 2000 })]],
      ]),
    });
    expect(screen.getByText('3,00')).toBeInTheDocument();
    expect(screen.getByText('4,000')).toBeInTheDocument();
    expect(screen.queryByText('0,00')).not.toBeInTheDocument();
    expect(screen.queryByText('0,000')).not.toBeInTheDocument();
  });

  it('muestra el bloque de códigos en la tarjeta solo si hay códigos', () => {
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ pedidos: [makePedido({ codigo_despacho: 'BIG' })] })]],
      ]),
    });
    expect(document.querySelector('.bg-blue-50')).toBeInTheDocument();
  });

  it('no muestra el bloque de códigos si no hay códigos', () => {
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ pedidos: [makePedido({ codigo_despacho: null })] })]],
      ]),
    });
    expect(document.querySelector('.bg-blue-50')).not.toBeInTheDocument();
  });

  it('suma pedidos y volumen de todas las preparaciones de un chofer', () => {
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [
          makePrep({ id: 1, cantidad_pedidos: 2, volumen: 1.5, importe_total: 100 }),
          makePrep({ id: 2, cantidad_pedidos: 3, volumen: 2.5, importe_total: 200 }),
        ]],
      ]),
    });
    expect(screen.getByText('5')).toBeInTheDocument(); // 2+3 pedidos
    expect(screen.getByText('4,000')).toBeInTheDocument(); // 1.5+2.5 m3, 3 decimales
  });

  it('no cuenta clientes ni códigos si el pedido no trae esos datos', () => {
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({
          pedidos: [makePedido({ codigo_cliente_ubicacion: null, cliente_nombre: null, codigo_despacho: null })],
        })]],
      ]),
    });
    expect(screen.getByText('0')).toBeInTheDocument(); // 0 clientes
    expect(screen.queryByText(/codigos/)).not.toBeInTheDocument();
  });

  it('el punto de estado usa el color mapeado según ESTADO_DOT (case-insensitive)', () => {
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ estado: 'Completada' })]],
      ]),
    });
    const dot = document.querySelector('.w-2.h-2.rounded-full.shrink-0');
    expect(dot).toHaveClass('bg-emerald-500');
  });

  it('el punto de estado cae al color por defecto si el estado no está mapeado', () => {
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ estado: 'Estado Inexistente' })]],
      ]),
    });
    const dot = document.querySelector('.w-2.h-2.rounded-full.shrink-0');
    expect(dot).toHaveClass('bg-slate-300');
  });

  it('ordena los códigos de despacho alfabéticamente', () => {
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({
          pedidos: [
            makePedido({ codigo: 'P1', codigo_despacho: 'ZZZ', codigo_cliente_ubicacion: 'C1' }),
            makePedido({ codigo: 'P2', codigo_despacho: 'AAA', codigo_cliente_ubicacion: 'C2' }),
          ],
        })]],
      ]),
    });
    const codigos = screen.getAllByText(/^(ZZZ|AAA)$/).map(e => e.textContent);
    expect(codigos).toEqual(['AAA', 'ZZZ']);
  });
});

describe('BibliaResumenModal — mapa', () => {
  it('agrupa los pedidos por cliente en pines y muestra los modos', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-pines', '2');
    expect(screen.getByRole('button', { name: 'Zona' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Código de despacho' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chofer' })).toBeInTheDocument();

    const pin = capturedPines.find(p => p.key === 'CL1')!;
    expect(pin.importe).toBe(500);
    expect(pin.zona).toBe('LOMAS');
    expect(pin.choferes).toEqual([{ codigo: 'CH1', nombre: 'López' }]);
  });

  it('excluye pedidos sin coordenadas (lat o lng nulos por separado)', async () => {
    const user = userEvent.setup();
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ pedidos: [makePedido({ cliente_lat: null })] })]],
        ['CH2', [makePrep({ id: 2, pedidos: [makePedido({ codigo: 'P2', codigo_cliente_ubicacion: 'CL2', cliente_lng: null })] })]],
      ]),
    });
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-pines', '0');
  });

  it('el mapa nunca recibe loading=true (esta vista ya tiene los datos en memoria)', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(capturedLoading).toBe(false);
  });

  it('la zona por defecto es "Zona" (resaltado como activo)', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByRole('button', { name: 'Zona' })).toHaveClass('bg-slate-800');
    expect(screen.getByRole('button', { name: 'Chofer' })).not.toHaveClass('bg-slate-800');
  });

  it('recalcula los pines si cambian las preparaciones (memo con deps completas)', async () => {
    const user = userEvent.setup();
    const { rerender, ...props } = renderModal();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-pines', '2');

    rerender(<BibliaResumenModal {...props} preparacionesPorChofer={new Map([
      ['CH1', [makePrep({ pedidos: [makePedido({ codigo_cliente_ubicacion: 'NUEVO' })] })]],
    ])} />);
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-pines', '1');
    expect(capturedPines[0].key).toBe('NUEVO');
  });

  it('el click en un pin abre el panel de reasignación con sus preparaciones', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    fireEvent.click(screen.getByTestId('mapa')); // no-op, el click real va por el callback
    capturedOnPinClick!(capturedPines.find(p => p.key === 'CL1')!);
    const panel = await screen.findByTestId('reasignar-panel');
    expect(panel).toHaveAttribute('data-descripcion', 'Cliente Uno');
    expect(panel).toHaveAttribute('data-items', '1');
  });

  it('cerrar el panel de reasignación lo oculta', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    capturedOnPinClick!(capturedPines.find(p => p.key === 'CL1')!);
    await screen.findByTestId('reasignar-panel');

    fireEvent.click(screen.getByText('cerrar-panel'));

    expect(screen.queryByTestId('reasignar-panel')).not.toBeInTheDocument();
  });

  it('cambia el modo de agrupación del mapa al clickear los botones (resaltado activo se mueve)', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));

    await user.click(screen.getByRole('button', { name: 'Código de despacho' }));
    expect(screen.getByRole('button', { name: 'Código de despacho' })).toHaveClass('bg-slate-800');
    expect(screen.getByRole('button', { name: 'Zona' })).not.toHaveClass('bg-slate-800');

    await user.click(screen.getByRole('button', { name: 'Chofer' }));
    expect(screen.getByRole('button', { name: 'Chofer' })).toHaveClass('bg-slate-800');
    expect(screen.getByRole('button', { name: 'Código de despacho' })).not.toHaveClass('bg-slate-800');
  });

  it('los botones de modo del mapa solo aparecen en la pestaña Mapa', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.queryByRole('button', { name: 'Zona' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByRole('button', { name: 'Zona' })).toBeInTheDocument();
  });

  it('deduplica por preparación los pedidos del mismo punto, quedándose con el primer pedido', async () => {
    const user = userEvent.setup();
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({
          id: 9,
          pedidos: [
            makePedido({ codigo: 'P1', codigo_cliente_ubicacion: 'CL1', importe: 100 }),
            makePedido({ codigo: 'P2', codigo_cliente_ubicacion: 'CL1', importe: 200 }),
          ],
        })]],
      ]),
    });
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-pines', '1');
    expect(capturedPines[0].importe).toBe(300);
    capturedOnPinClick!(capturedPines[0]);
    const panel = await screen.findByTestId('reasignar-panel');
    expect(panel).toHaveAttribute('data-items', '1'); // una sola prep aunque haya dos pedidos
    expect(panel).toHaveAttribute('data-primer-pedido', 'P1'); // se queda con el primer pedido visto, no el último
  });
});

describe('BibliaResumenModal — impresión y bordes', () => {
  function printAndCapture(over: Partial<Parameters<typeof BibliaResumenModal>[0]> = {}) {
    const w = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window);
    renderModal(over);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    openSpy.mockRestore();
    return { html, w, openSpy };
  }

  it('Imprimir arma la ventana con las tarjetas por chofer', () => {
    vi.useFakeTimers();
    try {
      const w = {
        document: { write: vi.fn(), close: vi.fn() },
        focus: vi.fn(),
        print: vi.fn(),
      };
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window);
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
      expect(openSpy).toHaveBeenCalledWith('', '_blank');
      const html = w.document.write.mock.calls.map(c => c[0]).join('');
      expect(html).toMatch(/^<html>/); // el string arranca limpio, sin basura previa a cardsHtml
      expect(html).toContain('<div class="grid"><div class="card">'); // cardsHtml arranca vacío, sin basura antes de la primera tarjeta
      expect(html).toContain('Resumen biblia');
      expect(html).toContain('García');
      expect(html).toContain('López');
      expect(html).toContain('E-1');
      expect(html).toContain('<h2>Resumen biblia — Viernes'); // charAt(0).toUpperCase(), no el label crudo en minúscula
      expect(html).toContain('2 choferes'); // plural con más de un chofer
      expect(w.document.close).toHaveBeenCalled();
      vi.advanceTimersByTime(500);
      expect(w.print).toHaveBeenCalled();
      openSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('usa singular ("chofer") cuando hay exactamente un chofer', () => {
    const { html } = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep()]]]),
    });
    expect(html).toContain('1 chofer ·');
    expect(html).not.toContain('1 choferes');
  });

  it('arma el bloque de stats exacto según haya peso y/o volumen', () => {
    const conPeso = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ peso: 3, volumen: 0 })]]]),
    }).html;
    expect(conPeso).toContain('<div class="stats"><span><b>1</b> ped</span><span><b>1</b> cli</span><span><b>3,00</b> kg</span></div>');

    const conVolumen = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ peso: 0, volumen: 4 })]]]),
    }).html;
    expect(conVolumen).toContain('<div class="stats"><span><b>1</b> ped</span><span><b>1</b> cli</span><span><b>4,000</b> m³</span></div>');

    const sinNinguno = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ peso: 0, volumen: 0 })]]]),
    }).html;
    expect(sinNinguno).toContain('<div class="stats"><span><b>1</b> ped</span><span><b>1</b> cli</span></div>'); // sin espacios/basura entre spans ni entradas extra por peso/volumen en 0
  });

  it('formatea peso y volumen con la cantidad exacta de decimales (2 y 3 respectivamente)', () => {
    const { html } = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ peso: 3, volumen: 4.5 })]]]),
    });
    expect(html).toContain('<b>3,00</b> kg');
    expect(html).toContain('<b>4,500</b> m³');
  });

  it('concatena las filas de preparaciones sin separador entre ellas', () => {
    const { html } = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [
        makePrep({ id: 1, codigo_envio: 'E-1' }),
        makePrep({ id: 2, codigo_envio: 'E-2' }),
      ]]]),
    });
    expect(html).toContain(`<span class="prep-imp">${formatCurrency(500)}</span></div><div class="prep-row">`);
  });

  it('reemplaza espacios por guiones en la clase del estado de la fila impresa', () => {
    const { html } = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ estado: 'En Preparacion' })]]]),
    });
    expect(html).toContain('class="dot estado-En-Preparacion"');
  });

  it('concatena los códigos de despacho impresos sin separador', () => {
    const { html } = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({
        pedidos: [
          makePedido({ codigo: 'P1', codigo_despacho: 'AAA', codigo_cliente_ubicacion: 'C1' }),
          makePedido({ codigo: 'P2', codigo_despacho: 'BBB', codigo_cliente_ubicacion: 'C2' }),
        ],
      })]]]),
    });
    expect(html).toContain('<span class="cod">AAA</span><span class="cod">BBB</span>');
  });

  it('muestra el bloque de códigos solo si hay códigos de despacho', () => {
    const conCodigos = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ pedidos: [makePedido({ codigo_despacho: 'BIG' })] })]]]),
    }).html;
    expect(conCodigos).toContain('class="codigos"');

    const sinCodigos = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ pedidos: [makePedido({ codigo_despacho: null })] })]]]),
    }).html;
    expect(sinCodigos).not.toContain('class="codigos"');
  });

  it('usa el código del chofer en el título de la tarjeta impresa si no hay chofer asociado', () => {
    const { html } = printAndCapture({
      choferes: [],
      preparacionesPorChofer: new Map([['CH9', [makePrep({ id: 77 })]]]),
    });
    expect(html).toContain('chofer-nombre">CH9<');
  });

  it('el estado vacío del pedido no rompe la clase del punto en la fila impresa', () => {
    const { html } = printAndCapture({
      preparacionesPorChofer: new Map([['CH1', [makePrep({ estado: null as unknown as string })]]]),
    });
    expect(html).toContain('class="dot estado-"');
  });

  it('no explota si el navegador bloquea el popup', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    openSpy.mockRestore();
  });

  it('usa el código del chofer cuando no está en la lista y #id sin código de envío', () => {
    renderModal({
      choferes: [],
      preparacionesPorChofer: new Map([
        ['CH9', [makePrep({ id: 77, codigo_envio: null })]],
      ]),
    });
    expect(screen.getAllByText('CH9').length).toBeGreaterThan(0);
    expect(screen.getByText('#77')).toBeInTheDocument();
  });

  it('agrupa por nombre de cliente cuando falta la ubicación', async () => {
    const user = userEvent.setup();
    renderModal({
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({
          pedidos: [
            makePedido({ codigo: 'P1', codigo_cliente_ubicacion: null, cliente_nombre: 'Sin Ubic' }),
            makePedido({ codigo: 'P2', codigo_cliente_ubicacion: null, cliente_nombre: 'Sin Ubic' }),
          ],
        })]],
      ]),
    });
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-pines', '1');
    expect(capturedPines[0].key).toBe('Sin Ubic');
  });

  it('la zona del pin cae al nombre del código si no hay dirección conocida', async () => {
    const user = userEvent.setup();
    renderModal({
      codigosDespacho: [],
      preparacionesPorChofer: new Map([
        ['CH1', [makePrep({ pedidos: [makePedido({ codigo_despacho: 'DESCONOCIDO' })] })]],
      ]),
    });
    await user.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(capturedPines[0].zona).toBe('DESCONOCIDO');
    expect(capturedPines[0].codigoDespacho).toBe('DESCONOCIDO');
  });
});
