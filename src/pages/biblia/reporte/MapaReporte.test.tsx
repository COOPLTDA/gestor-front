import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapaReporte, type MapaPin } from './MapaReporte';

// react-leaflet no funciona en jsdom (usa medidas reales del DOM y canvas):
// se stubbea con componentes que exponen las props que nos interesan.
interface MarkerProps {
  center: [number, number];
  pathOptions: { color: string };
  eventHandlers?: { click: () => void };
  children?: React.ReactNode;
}
const mapMock = {
  getContainer: vi.fn(() => document.createElement('div')),
  invalidateSize: vi.fn(),
  setView: vi.fn(),
  getZoom: vi.fn(() => 11),
};
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, style }: { children: React.ReactNode; center: [number, number]; style?: React.CSSProperties }) => (
    <div data-testid="map" data-center={center.join(',')} style={style}>{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: ({ center, pathOptions, eventHandlers, children }: MarkerProps) => (
    <div
      data-testid="marker"
      data-center={center.join(',')}
      data-color={pathOptions.color}
      onClick={eventHandlers?.click}
    >
      {children}
    </div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  // objeto nuevo en cada llamada: así el efecto de Recentrar/AjusteTamano, que depende
  // de la identidad de `map`, se puede ejercitar re-renderizando sin cambiar props reales.
  useMap: () => ({ ...mapMock }),
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

function makePin(over: Partial<MapaPin> = {}): MapaPin {
  return {
    key: 'CL1',
    descripcion: 'Cliente Uno',
    lat: -34.7,
    lng: -58.4,
    zona: 'LOMAS',
    codigoDespacho: 'BIG',
    importe: 500,
    choferes: [{ codigo: 'CH1', nombre: 'López' }],
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('MapaReporte — estados', () => {
  it('muestra el loader mientras carga', () => {
    render(<MapaReporte pines={[]} loading={true} modo="zona" />);
    expect(screen.getByText('Cargando mapa…')).toBeInTheDocument();
  });

  it('muestra el vacío sin pines', () => {
    render(<MapaReporte pines={[]} loading={false} modo="zona" />);
    expect(screen.getByText('No hay clientes con coordenadas en este período')).toBeInTheDocument();
  });

  it('centra el mapa en el promedio de coordenadas', () => {
    render(<MapaReporte
      pines={[makePin({ key: 'A', lat: -34, lng: -58 }), makePin({ key: 'B', lat: -36, lng: -60 })]}
      loading={false}
      modo="zona"
    />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-center', '-35,-59');
  });
});

describe('MapaReporte — pines y tooltip', () => {
  it('renderiza un marker por pin con su tooltip', () => {
    render(<MapaReporte pines={[makePin({ lat: -34.7, lng: -58.4 })]} loading={false} modo="zona" />);
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.getByTestId('marker')).toHaveAttribute('data-center', '-34.7,-58.4');
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
    expect(screen.getByText('BIG · LOMAS')).toBeInTheDocument();
    expect(screen.getAllByText('López').length).toBeGreaterThan(0);
    expect(screen.getByText('$ 500')).toBeInTheDocument();
  });

  it('el tooltip une los nombres de varios choferes con coma', () => {
    render(<MapaReporte
      pines={[makePin({
        choferes: [
          { codigo: 'CH1', nombre: 'López' },
          { codigo: 'CH2', nombre: 'García' },
        ],
      })]}
      loading={false}
      modo="zona"
    />);
    expect(screen.getByText('López, García')).toBeInTheDocument();
  });

  it('el click en un marker notifica el pin', () => {
    const onPinClick = vi.fn();
    render(<MapaReporte pines={[makePin()]} loading={false} modo="zona" onPinClick={onPinClick} />);
    fireEvent.click(screen.getByTestId('marker'));
    expect(onPinClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'CL1' }));
  });

  it('pines de la misma zona comparten color y de distinta zona difieren', () => {
    render(<MapaReporte
      pines={[
        makePin({ key: 'A', zona: 'LOMAS' }),
        makePin({ key: 'B', zona: 'LOMAS' }),
        makePin({ key: 'C', zona: 'SUR' }),
      ]}
      loading={false}
      modo="zona"
    />);
    const colores = screen.getAllByTestId('marker').map(m => m.getAttribute('data-color'));
    expect(colores[0]).toBe(colores[1]);
    expect(colores[0]).not.toBe(colores[2]);
  });

  it('en modo chofer un pin con varios choferes usa el color mixto', () => {
    render(<MapaReporte
      pines={[makePin({
        choferes: [
          { codigo: 'CH1', nombre: 'López' },
          { codigo: 'CH2', nombre: 'García' },
        ],
      })]}
      loading={false}
      modo="chofer"
    />);
    expect(screen.getByTestId('marker')).toHaveAttribute('data-color', '#64748b');
  });
});

describe('MapaReporte — leyenda y filtros', () => {
  it('lista las opciones del modo actual ordenadas', () => {
    render(<MapaReporte
      pines={[makePin({ key: 'A', zona: 'SUR' }), makePin({ key: 'B', zona: 'LOMAS' })]}
      loading={false}
      modo="zona"
    />);
    const labels = screen.getAllByRole('checkbox').slice(1).map(cb => cb.closest('label')!.textContent);
    expect(labels).toEqual(['LOMAS', 'SUR']);
    expect(screen.getByText('2 clientes con coordenadas')).toBeInTheDocument();
  });

  it('destildar una zona oculta sus pines, actualiza el checkbox y el color de la etiqueta', () => {
    render(<MapaReporte
      pines={[makePin({ key: 'A', zona: 'LOMAS' }), makePin({ key: 'B', zona: 'SUR' })]}
      loading={false}
      modo="zona"
    />);
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
    const checkboxLomas = screen.getByLabelText('LOMAS') as HTMLInputElement;
    expect(checkboxLomas.checked).toBe(true);
    const labelLomas = checkboxLomas.closest('label') as HTMLElement;
    expect(labelLomas.style.color).toBe('#374151'); // visible

    fireEvent.click(checkboxLomas);
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    expect(screen.getByText('1 cliente con coordenadas')).toBeInTheDocument();
    expect(checkboxLomas.checked).toBe(false);
    expect(labelLomas.style.color).toBe('#9ca3af'); // oculta
  });

  it('en modo código, destildar un código oculta sus pines (no depende de la zona)', () => {
    render(<MapaReporte
      pines={[
        makePin({ key: 'A', zona: 'LOMAS', codigoDespacho: 'BIG' }),
        makePin({ key: 'B', zona: 'SUR', codigoDespacho: 'PERI 5' }),
      ]}
      loading={false}
      modo="codigo"
    />);
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('BIG'));
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });

  it('"Todos" oculta todo y vuelve a mostrar todo, reflejando su propio estado checked', () => {
    render(<MapaReporte
      pines={[makePin({ key: 'A', zona: 'LOMAS' }), makePin({ key: 'B', zona: 'SUR' })]}
      loading={false}
      modo="zona"
    />);
    const checkboxTodos = screen.getByLabelText('Todos') as HTMLInputElement;
    expect(checkboxTodos.checked).toBe(true);

    fireEvent.click(checkboxTodos);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(checkboxTodos.checked).toBe(false);

    fireEvent.click(checkboxTodos);
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
    expect(checkboxTodos.checked).toBe(true);
  });

  it('el checkbox de cada zona refleja si está visible (no oculta)', () => {
    render(<MapaReporte
      pines={[makePin({ key: 'A', zona: 'LOMAS' }), makePin({ key: 'B', zona: 'SUR' })]}
      loading={false}
      modo="zona"
    />);
    const checkboxLomas = screen.getByLabelText('LOMAS') as HTMLInputElement;
    fireEvent.click(checkboxLomas);
    expect(checkboxLomas.checked).toBe(false);
    expect((screen.getByLabelText('SUR') as HTMLInputElement).checked).toBe(true);
  });

  it('en modo chofer la leyenda usa los nombres', () => {
    render(<MapaReporte pines={[makePin()]} loading={false} modo="chofer" />);
    expect(screen.getByLabelText('López')).toBeInTheDocument();
  });

  it('un pin multi-chofer sigue visible si al menos un chofer está activo', () => {
    render(<MapaReporte
      pines={[makePin({
        choferes: [
          { codigo: 'CH1', nombre: 'López' },
          { codigo: 'CH2', nombre: 'García' },
        ],
      })]}
      loading={false}
      modo="chofer"
    />);
    fireEvent.click(screen.getByLabelText('García'));
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    fireEvent.click(screen.getByLabelText('López'));
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
  });

  it('los filtros ocultos se recuerdan por modo', () => {
    const pines = [makePin({ key: 'A', zona: 'LOMAS', codigoDespacho: 'BIG' })];
    const { rerender } = render(<MapaReporte pines={pines} loading={false} modo="zona" />);
    fireEvent.click(screen.getByLabelText('LOMAS'));
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);

    rerender(<MapaReporte pines={pines} loading={false} modo="codigo" />);
    expect(screen.getAllByTestId('marker')).toHaveLength(1); // el filtro de zona no afecta al modo código

    rerender(<MapaReporte pines={pines} loading={false} modo="zona" />);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0); // vuelve el filtro recordado
  });

  it('en modo código agrupa por código de despacho, no por zona', () => {
    render(<MapaReporte
      pines={[
        makePin({ key: 'A', zona: 'LOMAS', codigoDespacho: 'BIG' }),
        makePin({ key: 'B', zona: 'SUR', codigoDespacho: 'BIG' }),
        makePin({ key: 'C', zona: 'LOMAS', codigoDespacho: 'PERI 5' }),
      ]}
      loading={false}
      modo="codigo"
    />);
    const colores = screen.getAllByTestId('marker').map(m => m.getAttribute('data-color'));
    expect(colores[0]).toBe(colores[1]); // mismo código BIG, distinta zona
    expect(colores[0]).not.toBe(colores[2]); // misma zona LOMAS, distinto código
    const labels = screen.getAllByRole('checkbox').slice(1).map(cb => cb.closest('label')!.textContent);
    expect(labels).toEqual(['BIG', 'PERI 5']);
  });

  it('asigna colores de la paleta por posición en el universo ordenado, no por multiplicación de índices', () => {
    render(<MapaReporte
      pines={[makePin({ key: 'A', zona: 'LOMAS' }), makePin({ key: 'B', zona: 'SUR' })]}
      loading={false}
      modo="zona"
    />);
    const colores = screen.getAllByTestId('marker').map(m => m.getAttribute('data-color'));
    expect(colores[0]).toBe('#2563eb');
    expect(colores[1]).toBe('#dc2626');
  });

  it('en modo chofer, un pin con un solo chofer usa un color propio (no el mixto)', () => {
    render(<MapaReporte
      pines={[makePin({ choferes: [{ codigo: 'CH1', nombre: 'López' }] })]}
      loading={false}
      modo="chofer"
    />);
    expect(screen.getByTestId('marker')).not.toHaveAttribute('data-color', '#64748b');
  });

  it('el tooltip no muestra la línea de choferes si el pin no tiene ninguno asignado', () => {
    render(<MapaReporte pines={[makePin({ choferes: [] })]} loading={false} modo="zona" />);
    const marker = screen.getByTestId('marker');
    const fontSizeDiv = marker.firstElementChild!.firstElementChild as HTMLElement;
    expect(fontSizeDiv.children).toHaveLength(3); // nombre, código·zona, importe (sin línea de choferes)
  });

  it('tildar de nuevo una zona destildada la vuelve a mostrar (toggle individual)', () => {
    render(<MapaReporte
      pines={[makePin({ key: 'A', zona: 'LOMAS' }), makePin({ key: 'B', zona: 'SUR' })]}
      loading={false}
      modo="zona"
    />);
    fireEvent.click(screen.getByLabelText('LOMAS'));
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
    fireEvent.click(screen.getByLabelText('LOMAS'));
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
  });

  it('actualiza las opciones de leyenda y el universo de colores cuando cambian los pines', () => {
    const { rerender } = render(<MapaReporte pines={[makePin({ key: 'A', zona: 'LOMAS' })]} loading={false} modo="zona" />);
    expect(screen.getByLabelText('LOMAS')).toBeInTheDocument();

    rerender(<MapaReporte pines={[makePin({ key: 'B', zona: 'SUR' })]} loading={false} modo="zona" />);
    expect(screen.queryByLabelText('LOMAS')).not.toBeInTheDocument();
    expect(screen.getByLabelText('SUR')).toBeInTheDocument();
    expect(screen.getByTestId('marker')).toHaveAttribute('data-color', '#2563eb');
  });
});

class FakeResizeObserver {
  static instancias: FakeResizeObserver[] = [];
  cb: () => void;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(cb: () => void) {
    this.cb = cb;
    FakeResizeObserver.instancias.push(this);
  }
}

describe('MapaReporte — efectos sobre el mapa (useMap)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeResizeObserver.instancias = [];
  });

  it('centra el mapa vía map.setView con las coordenadas promedio y el zoom actual', () => {
    render(<MapaReporte pines={[makePin({ lat: -34, lng: -58 })]} loading={false} modo="zona" />);
    expect(mapMock.setView).toHaveBeenCalledWith([-34, -58], 11);
  });

  it('vuelve a centrar cuando cambian las coordenadas promedio', () => {
    const { rerender } = render(<MapaReporte pines={[makePin({ key: 'A', lat: -34, lng: -58 })]} loading={false} modo="zona" />);
    expect(mapMock.setView).toHaveBeenCalledWith([-34, -58], 11);
    rerender(<MapaReporte pines={[makePin({ key: 'A', lat: -40, lng: -60 })]} loading={false} modo="zona" />);
    expect(mapMock.setView).toHaveBeenCalledWith([-40, -60], 11);
  });

  it('observa el contenedor del mapa con ResizeObserver y lo desconecta al desmontar', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { unmount } = render(<MapaReporte pines={[makePin()]} loading={false} modo="zona" />);
    const instancia = FakeResizeObserver.instancias[0];
    expect(instancia.observe).toHaveBeenCalled();
    unmount();
    expect(instancia.disconnect).toHaveBeenCalled();
  });

  it('el callback del ResizeObserver invalida el tamaño del mapa cuando se dispara', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    render(<MapaReporte pines={[makePin()]} loading={false} modo="zona" />);
    const instancia = FakeResizeObserver.instancias[0];
    instancia.cb();
    expect(mapMock.invalidateSize).toHaveBeenCalled();
  });

  it('vuelve a observar el contenedor si cambia la instancia de mapa (deps del efecto)', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { rerender } = render(<MapaReporte pines={[makePin()]} loading={false} modo="zona" />);
    const instanciasTrasMontar = FakeResizeObserver.instancias.length;
    rerender(<MapaReporte pines={[makePin()]} loading={false} modo="zona" />);
    expect(FakeResizeObserver.instancias.length).toBeGreaterThan(instanciasTrasMontar);
  });
});

describe('MapaReporte — estilos de layout', () => {
  it('aplica los estilos esperados al contenedor, el mapa y la barra lateral', () => {
    const { container } = render(<MapaReporte pines={[makePin()]} loading={false} modo="zona" />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.display).toBe('flex');
    expect(root.style.flexDirection).toBe('column');
    expect(root.style.height).toBe('100%');
    expect(root.style.gap).toBe('8px');

    const fila = root.firstElementChild as HTMLElement;
    expect(fila.style.display).toBe('flex');
    expect(fila.style.flex).toBe('1 1 0%');
    expect(fila.style.minHeight).toBe('0');
    expect(fila.style.gap).toBe('10px');

    const mapaWrapper = fila.firstElementChild as HTMLElement;
    expect(mapaWrapper.style.flex).toBe('1 1 0%');
    expect(mapaWrapper.style.minWidth).toBe('0');

    const mapa = screen.getByTestId('map');
    expect(mapa.style.height).toBe('100%');
    expect(mapa.style.width).toBe('100%');

    const sidebar = fila.lastElementChild as HTMLElement;
    expect(sidebar.style.width).toBe('230px');
    expect(sidebar.style.flexShrink).toBe('0');
    expect(sidebar.style.display).toBe('flex');
    expect(sidebar.style.flexDirection).toBe('column');
    expect(sidebar.style.borderLeft).toBe('1px solid #e5e7eb');
    expect(sidebar.style.paddingLeft).toBe('12px');
  });

  it('aplica los estilos esperados al contador de clientes y al checkbox "Todos"', () => {
    render(<MapaReporte pines={[makePin()]} loading={false} modo="zona" />);

    const contador = screen.getByText('1 cliente con coordenadas');
    expect(contador.style.fontSize).toBe('13px');
    expect(contador.style.marginBottom).toBe('8px');

    const checkboxTodos = screen.getByLabelText('Todos') as HTMLInputElement;
    expect(checkboxTodos.style.margin).toBe('0px');
    expect(checkboxTodos.style.width).toBe('15px');
    expect(checkboxTodos.style.height).toBe('15px');

    const labelTodos = checkboxTodos.closest('label') as HTMLElement;
    expect(labelTodos.style.display).toBe('flex');
    expect(labelTodos.style.alignItems).toBe('center');
    expect(labelTodos.style.gap).toBe('8px');
    expect(labelTodos.style.fontSize).toBe('15px');
    expect(labelTodos.style.fontWeight).toBe('600');
    expect(labelTodos.style.cursor).toBe('pointer');
    expect(labelTodos.style.borderBottom).toBe('1px solid #e5e7eb');

    const lista = labelTodos.nextElementSibling as HTMLElement;
    expect(lista.style.overflowY).toBe('auto');
    expect(lista.style.display).toBe('flex');
    expect(lista.style.flexDirection).toBe('column');
    expect(lista.style.gap).toBe('6px');
  });

  it('aplica los estilos esperados a cada ítem de la leyenda', () => {
    render(<MapaReporte pines={[makePin({ zona: 'LOMAS' })]} loading={false} modo="zona" />);

    const labelLomas = screen.getByLabelText('LOMAS').closest('label') as HTMLElement;
    expect(labelLomas.style.display).toBe('flex');
    expect(labelLomas.style.alignItems).toBe('center');
    expect(labelLomas.style.gap).toBe('8px');
    expect(labelLomas.style.fontSize).toBe('14px');
    expect(labelLomas.style.cursor).toBe('pointer');

    const punto = labelLomas.querySelector('span') as HTMLElement;
    expect(punto.style.display).toBe('inline-block');
    expect(punto.style.width).toBe('13px');
    expect(punto.style.height).toBe('13px');
    expect(punto.style.borderRadius).toBe('50%');
    expect(punto.style.flexShrink).toBe('0');
    expect(punto.style.opacity).toBe('1');

    const etiqueta = labelLomas.querySelector('span + span') as HTMLElement;
    expect(etiqueta.style.overflow).toBe('hidden');
    expect(etiqueta.style.textOverflow).toBe('ellipsis');
    expect(etiqueta.style.whiteSpace).toBe('nowrap');
  });

  it('asigna colores de la paleta por posición en el universo ordenado (hasta la posición 13)', () => {
    const zonas = Array.from({ length: 14 }, (_, i) => `Z${String(i).padStart(2, '0')}`);
    render(<MapaReporte
      pines={zonas.map((zona, i) => makePin({ key: `P${i}`, zona }))}
      loading={false}
      modo="zona"
    />);
    const colores = screen.getAllByTestId('marker').map(m => m.getAttribute('data-color'));
    expect(colores[3]).toBe('#d97706');
    expect(colores[6]).toBe('#be185d');
    expect(colores[13]).toBe('#b45309');
  });

  it('aplica los estilos esperados al contenido del tooltip', () => {
    render(<MapaReporte pines={[makePin()]} loading={false} modo="zona" />);
    const marker = screen.getByTestId('marker');
    const fontSizeDiv = marker.firstElementChild!.firstElementChild as HTMLElement;
    expect(fontSizeDiv.style.fontSize).toBe('13px');
    expect(fontSizeDiv.style.lineHeight).toBe('1.5');

    const nombreDiv = fontSizeDiv.children[0] as HTMLElement;
    expect(nombreDiv.style.fontWeight).toBe('600');

    const importeDiv = fontSizeDiv.children[fontSizeDiv.children.length - 1] as HTMLElement;
    expect(importeDiv.style.fontWeight).toBe('500');
    expect(importeDiv.style.color).toBe('#15803d');
  });
});
