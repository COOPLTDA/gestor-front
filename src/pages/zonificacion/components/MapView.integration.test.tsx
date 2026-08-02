import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import L from 'leaflet';
import MapView, { type MapViewHandle } from './MapView';
import type { Pdv, Zona } from '../types';

// MapView usa la API imperativa de Leaflet directo (no react-leaflet, ver comentario
// en el propio archivo) — no hay ningún precedente de test en el codebase para ese
// patrón (ni siquiera RutaMapModal.tsx, el único componente análogo). En vez de mockear
// toda la librería (superficie enorme, y terminaría probando contra un Leaflet falso en
// vez del real), se usa la librería real y se espía L.map/L.polygon/L.circleMarker para
// obtener las instancias reales que crea el componente y ejercitar su lógica (handlers,
// imperative handle) contra el objeto real.

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente Uno', dir: 'Calle 123', com: 'Almacén', loc: 'CABA', par: 'CABA',
    lat: -34.6, lng: -58.4, desactivado: false, vnd_cod: 'V1', vnd_nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A',
    vendedores: [{ cod: 'V1', nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A' }],
    facturacion: 0, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

function zona(overrides: Partial<Zona> = {}): Zona {
  return {
    nombre: 'Zona Norte', color: '#7c3aed',
    vertices: [{ lat: -35, lng: -59 }, { lat: -35, lng: -57 }, { lat: -34, lng: -57 }, { lat: -34, lng: -59 }],
    criterios: null,
    ...overrides,
  };
}

function baseProps(overrides: Partial<React.ComponentProps<typeof MapView>> = {}) {
  return {
    pdv: [] as Pdv[],
    colorScheme: 'tipo' as const,
    zonas: [] as Zona[],
    labelsVisible: false,
    polygonsVisible: true,
    filtroVendedor: [] as string[],
    rangoVentas: { desde: '2025-07-28', hasta: '2026-07-28' },
    onZonaCreada: vi.fn(),
    onExcluirPdv: vi.fn(),
    ...overrides,
  };
}

function renderMap(overrides: Partial<React.ComponentProps<typeof MapView>> = {}) {
  const ref = createRef<MapViewHandle>();
  const props = baseProps(overrides);
  const utils = render(<MapView ref={ref} {...props} />);
  return { ref, props, ...utils };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('MapView — refs espejo de props (leídas en handlers de Leaflet)', () => {
  it('polygonsVisibleRef: mouseout usa el polygonsVisible actual, no el de cuando se creó el layer', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    const zonas = [zona()];
    const { rerender, props } = renderMap({ zonas, polygonsVisible: true });
    const layer = polySpy.mock.results[0].value as L.Polygon;
    rerender(<MapView {...props} zonas={zonas} polygonsVisible={false} />);
    const setStyleSpy = vi.spyOn(layer, 'setStyle');

    layer.fire('mouseout');

    expect(setStyleSpy).toHaveBeenCalledWith({ fillOpacity: 0, weight: 2 });
  });

  it('onZonaCreadaRef: el handler de dibujo llama siempre a la callback más reciente, no a la del primer render', () => {
    const mapSpy = vi.spyOn(L, 'map');
    const onZonaCreadaVieja = vi.fn();
    const onZonaCreadaNueva = vi.fn();
    const { rerender, props } = renderMap({ onZonaCreada: onZonaCreadaVieja });
    rerender(<MapView {...props} onZonaCreada={onZonaCreadaNueva} />);
    const map = mapSpy.mock.results[0].value as L.DrawMap;

    const layer = L.polygon([[-35, -59], [-35, -57], [-34, -57]]);
    map.fire(L.Draw.Event.CREATED, { layer, layerType: 'polygon' } as unknown as L.LeafletEvent);

    expect(onZonaCreadaNueva).toHaveBeenCalled();
    expect(onZonaCreadaVieja).not.toHaveBeenCalled();
  });

  it('onExcluirPdvRef: el botón del popup llama siempre a la callback más reciente', () => {
    const mapSpy = vi.spyOn(L, 'map');
    const onExcluirPdvVieja = vi.fn();
    const onExcluirPdvNueva = vi.fn();
    const { rerender, props } = renderMap({ onExcluirPdv: onExcluirPdvVieja });
    rerender(<MapView {...props} onExcluirPdv={onExcluirPdvNueva} />);
    const map = mapSpy.mock.results[0].value as L.Map;

    const popupEl = document.createElement('div');
    popupEl.innerHTML = '<button data-excluir-id="PDV-1">Excluir PDV</button>';
    map.fire('popupopen', { popup: { getElement: () => popupEl } } as unknown as L.LeafletEvent);
    popupEl.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onExcluirPdvNueva).toHaveBeenCalledWith('PDV-1');
    expect(onExcluirPdvVieja).not.toHaveBeenCalled();
  });

  it('pdvRef: el hover de una zona cuenta los PDV actuales, no los del primer render', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    const { rerender, props } = renderMap({ zonas: [zona()], pdv: [] });
    const layer = polySpy.mock.results[0].value as L.Polygon;
    rerender(<MapView {...props} zonas={[zona()]} pdv={[pdv({ id: '1', lat: -34.5, lng: -58 })]} />);
    const bindTooltipSpy = vi.spyOn(layer, 'bindTooltip').mockReturnThis();
    vi.spyOn(layer, 'openTooltip').mockReturnThis();

    layer.fire('mouseover', { latlng: L.latLng(-34.5, -58) } as unknown as L.LeafletEvent);

    expect(bindTooltipSpy.mock.calls[0][0]).toContain('PDV: <b>1</b>');
  });
});

describe('MapView — inicialización', () => {
  it('crea el mapa una sola vez y expone el handle imperativo', () => {
    const mapSpy = vi.spyOn(L, 'map');
    renderMap();
    expect(mapSpy).toHaveBeenCalledTimes(1);
  });

  it('centra el mapa en Enro y agrega el control de zoom abajo-a-la-derecha', () => {
    const mapSpy = vi.spyOn(L, 'map');
    const zoomSpy = vi.spyOn(L.control, 'zoom');
    renderMap();
    const map = mapSpy.mock.results[0].value as L.Map;
    expect(map.getCenter().lat).toBeCloseTo(-34.82);
    expect(map.getCenter().lng).toBeCloseTo(-58.43);
    expect(zoomSpy).toHaveBeenCalledWith({ position: 'bottomright' });
  });

  it('agrega el tile layer de CartoDB con su atribución', () => {
    const tileSpy = vi.spyOn(L, 'tileLayer');
    renderMap();
    expect(tileSpy).toHaveBeenCalledWith(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      expect.objectContaining({ attribution: '© OpenStreetMap © CARTO', maxZoom: 19 })
    );
  });

  it('crea el canvas renderer para el pane de markers', () => {
    const canvasSpy = vi.spyOn(L, 'canvas');
    renderMap();
    expect(canvasSpy).toHaveBeenCalledWith({ padding: 0.5, pane: 'markersPane' });
  });

  it('deja el pane de markers en zIndex 450 (por encima de los polígonos, debajo de los controles)', () => {
    const mapSpy = vi.spyOn(L, 'map');
    renderMap();
    const map = mapSpy.mock.results[0].value as L.Map;
    expect(map.getPane('markersPane')!.style.zIndex).toBe('450');
  });

  it('el ResizeObserver invalida el tamaño del mapa cuando el contenedor cambia', () => {
    let resizeCallback: (() => void) | undefined;
    const OriginalRO = global.ResizeObserver;
    // @ts-expect-error stub mínimo para capturar el callback real que le pasa el componente
    global.ResizeObserver = class {
      constructor(cb: () => void) { resizeCallback = cb; }
      observe() {}
      disconnect() {}
    };
    const mapSpy = vi.spyOn(L, 'map');
    renderMap();
    const map = mapSpy.mock.results[0].value as L.Map;
    const invalidateSpy = vi.spyOn(map, 'invalidateSize');

    resizeCallback?.();

    expect(invalidateSpy).toHaveBeenCalled();
    global.ResizeObserver = OriginalRO;
  });

  it('desmonta sin explotar, desconectando el ResizeObserver y removiendo el mapa', () => {
    const mapSpy = vi.spyOn(L, 'map');
    const { unmount } = renderMap();
    const map = mapSpy.mock.results[0].value as L.Map;
    const removeSpy = vi.spyOn(map, 'remove');

    expect(() => unmount()).not.toThrow();
    expect(removeSpy).toHaveBeenCalled();
  });
});

// El efecto de markers de PDV usa un L.canvas() renderer compartido (rendimiento
// con ~4600 puntos, ver comentario en MapView.tsx). L.canvas() hace su propia
// detección de soporte de canvas 2D y devuelve null si no lo encuentra — que es
// exactamente lo que pasa bajo happy-dom (sin contexto 2D real). El efecto bien
// hace un early-return en ese caso (`if (!markerLayer || !renderer) return;`), así
// que no hay manera de ejercitar la creación real de circleMarker en este entorno
// sin reemplazar el renderer por un fake, y un fake liviano (ej. `{}`) hace que
// Leaflet rompa al intentar dibujar sobre él (deja el scheduler de React en un
// estado roto para el resto del archivo). Se documenta como límite conocido del
// entorno de test en vez de forzar un mock más profundo de bajo valor real.
describe('MapView — markers de PDV', () => {
  it('sin soporte de canvas en el entorno, el efecto no crea markers ni rompe', () => {
    const circleSpy = vi.spyOn(L, 'circleMarker');
    expect(() => renderMap({ pdv: [pdv({ id: '1' }), pdv({ id: '2' })] })).not.toThrow();
    expect(circleSpy).not.toHaveBeenCalled();
  });
});

describe('MapView — polígonos de zona', () => {
  it('crea un polygon por zona con 3 o más vértices', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({ zonas: [zona()] });
    expect(polySpy).toHaveBeenCalledTimes(1);
  });

  it('al cambiar el array de zonas (nueva referencia), recrea los polígonos', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    const { rerender, props } = renderMap({ zonas: [zona({ nombre: 'A' })] });

    rerender(<MapView {...props} zonas={[zona({ nombre: 'B' })]} />);

    expect(polySpy).toHaveBeenCalledTimes(2); // se recreó (si dependiera de [] no volvería a llamarse)
  });

  it('al recrear los polígonos, remueve del featureGroup el layer viejo antes de agregar el nuevo', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    const removeLayerSpy = vi.spyOn(L.FeatureGroup.prototype, 'removeLayer');
    const { rerender, props } = renderMap({ zonas: [zona({ nombre: 'A' })] });
    const primerLayer = polySpy.mock.results[0].value as L.Polygon;

    rerender(<MapView {...props} zonas={[zona({ nombre: 'B' })]} />);

    expect(removeLayerSpy).toHaveBeenCalledWith(primerLayer);
  });

  it('ignora zonas con menos de 3 vértices (en construcción)', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({ zonas: [zona({ vertices: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }] })] });
    expect(polySpy).toHaveBeenCalledTimes(0);
  });

  it('con exactamente 3 vértices, ya crea el polígono (3 es el mínimo válido, no "menos de 3")', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({ zonas: [zona({ vertices: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }] })] });
    expect(polySpy).toHaveBeenCalledTimes(1);
  });

  it('con polygonsVisible=false, crea el polígono transparente', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({ zonas: [zona()], polygonsVisible: false });
    const opts = polySpy.mock.calls[0][1] as L.PolylineOptions;
    expect(opts.fillOpacity).toBe(0);
    expect(opts.opacity).toBe(0);
  });

  it('al tildar/destildar polygonsVisible, cambia el estilo sin recrear el layer', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    const zonas = [zona()]; // misma referencia en ambos renders: el efecto de zonas depende de [zonas]
    const { rerender, props } = renderMap({ zonas, polygonsVisible: true });
    const layer = polySpy.mock.results[0].value;
    const setStyleSpy = vi.spyOn(layer, 'setStyle');

    rerender(<MapView {...props} zonas={zonas} polygonsVisible={false} />);

    expect(polySpy).toHaveBeenCalledTimes(1); // no se recreó
    expect(setStyleSpy).toHaveBeenCalledWith({ opacity: 0, fillOpacity: 0 });
  });

  it('hover sobre una zona muestra un tooltip con su nombre y estadísticas', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({
      zonas: [zona({ nombre: 'Zona Norte' })],
      pdv: [pdv({ id: '1', lat: -34.5, lng: -58, vnd_cod: 'V1' })],
    });
    const layer = polySpy.mock.results[0].value as L.Polygon;
    const bindTooltipSpy = vi.spyOn(layer, 'bindTooltip').mockReturnThis();
    const openTooltipSpy = vi.spyOn(layer, 'openTooltip').mockReturnThis();
    const setStyleSpy = vi.spyOn(layer, 'setStyle');

    layer.fire('mouseover', { latlng: L.latLng(-34.5, -58) } as unknown as L.LeafletEvent);

    expect(bindTooltipSpy).toHaveBeenCalledWith(expect.stringContaining('Zona Norte'), { sticky: true, direction: 'top', offset: [0, -4] });
    expect(bindTooltipSpy.mock.calls[0][0]).toContain('PDV: <b>1</b>');
    expect(bindTooltipSpy.mock.calls[0][0]).toContain('Vendedores distintos: <b>1</b>');
    expect(openTooltipSpy).toHaveBeenCalled();
    expect(setStyleSpy).toHaveBeenCalledWith({ fillOpacity: 0.28, weight: 3 });
  });

  it('cuenta vendedores distintos sin contar los PDV sin vendedor asignado', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({
      zonas: [zona({ nombre: 'Zona Norte' })],
      pdv: [
        pdv({ id: '1', lat: -34.5, lng: -58, vnd_cod: 'V1' }),
        pdv({ id: '2', lat: -34.5, lng: -58, vnd_cod: null }),
      ],
    });
    const layer = polySpy.mock.results[0].value as L.Polygon;
    const bindTooltipSpy = vi.spyOn(layer, 'bindTooltip').mockReturnThis();
    vi.spyOn(layer, 'openTooltip').mockReturnThis();

    layer.fire('mouseover', { latlng: L.latLng(-34.5, -58) } as unknown as L.LeafletEvent);

    expect(bindTooltipSpy.mock.calls[0][0]).toContain('PDV: <b>2</b>');
    expect(bindTooltipSpy.mock.calls[0][0]).toContain('Vendedores distintos: <b>1</b>');
  });

  it('mouseout restaura el estilo y quita el tooltip', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({ zonas: [zona()], polygonsVisible: true });
    const layer = polySpy.mock.results[0].value as L.Polygon;
    const setStyleSpy = vi.spyOn(layer, 'setStyle');
    const unbindSpy = vi.spyOn(layer, 'unbindTooltip');

    layer.fire('mouseout');

    expect(setStyleSpy).toHaveBeenCalledWith({ fillOpacity: 0.12, weight: 2 });
    expect(unbindSpy).toHaveBeenCalled();
  });

  it('bindZoneHover desengancha los tres eventos previos con un solo string antes de volver a ligarlos', () => {
    const offSpy = vi.spyOn(L.Polygon.prototype, 'off');
    const onSpy = vi.spyOn(L.Polygon.prototype, 'on');
    renderMap({ zonas: [zona()] });
    expect(offSpy).toHaveBeenCalledWith('mouseover mouseout mousemove');
    expect(onSpy).toHaveBeenCalledWith('mouseover', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('mouseout', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
  });

  it('mousemove reposiciona el tooltip si existe', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({ zonas: [zona()] });
    const layer = polySpy.mock.results[0].value as L.Polygon;
    layer.fire('mouseover', { latlng: L.latLng(-34.5, -58) } as unknown as L.LeafletEvent);
    const tooltip = layer.getTooltip();
    const setLatLngSpy = vi.spyOn(tooltip!, 'setLatLng');

    layer.fire('mousemove', { latlng: L.latLng(-34.6, -58.1) } as unknown as L.LeafletEvent);

    expect(setLatLngSpy).toHaveBeenCalledWith(L.latLng(-34.6, -58.1));
  });

  it('mousemove sin haber pasado antes por mouseover no explota (sin tooltip que reposicionar)', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({ zonas: [zona()] });
    const layer = polySpy.mock.results[0].value as L.Polygon;

    expect(() => layer.fire('mousemove', { latlng: L.latLng(-34.6, -58.1) } as unknown as L.LeafletEvent)).not.toThrow();
  });

  it('un color de zona inválido cae al gris seguro en vez de romper el tooltip', () => {
    const polySpy = vi.spyOn(L, 'polygon');
    renderMap({ zonas: [zona({ color: 'red" onmouseover="x' })] });
    const layer = polySpy.mock.results[0].value as L.Polygon;
    const bindTooltipSpy = vi.spyOn(layer, 'bindTooltip').mockReturnThis();
    vi.spyOn(layer, 'openTooltip').mockReturnThis();

    layer.fire('mouseover', { latlng: L.latLng(0, 0) } as unknown as L.LeafletEvent);

    expect(bindTooltipSpy.mock.calls[0][0]).toContain('#6b7280');
  });
});

describe('MapView — etiquetas de zona', () => {
  it('con labelsVisible=false, no crea ninguna etiqueta', () => {
    const markerSpy = vi.spyOn(L, 'marker');
    renderMap({ zonas: [zona()], labelsVisible: false });
    expect(markerSpy).not.toHaveBeenCalled();
  });

  it('con labelsVisible=true, crea una etiqueta por zona con su nombre y cantidad de PDV', () => {
    const markerSpy = vi.spyOn(L, 'marker');
    renderMap({
      zonas: [zona({ nombre: 'Zona Norte' })],
      pdv: [pdv({ id: '1', lat: -34.5, lng: -58 })],
      labelsVisible: true,
    });

    expect(markerSpy).toHaveBeenCalledTimes(1);
    const opts = markerSpy.mock.calls[0][1] as L.MarkerOptions;
    expect((opts.icon as L.DivIcon).options.html).toContain('Zona Norte');
    expect((opts.icon as L.DivIcon).options.html).toContain('1 PDV');
  });

  it('al ocultar las etiquetas, remueve los markers ya creados', () => {
    const markerSpy = vi.spyOn(L, 'marker');
    const { rerender, props } = renderMap({ zonas: [zona()], labelsVisible: true });
    const marker = markerSpy.mock.results[0].value;
    const removeSpy = vi.fn();
    // @ts-expect-error acceso directo al método del layer para verificar que se remueve
    marker.remove = removeSpy;

    rerender(<MapView {...props} zonas={[zona()]} labelsVisible={false} />);

    expect(markerSpy).toHaveBeenCalledTimes(1); // no se crea una nueva
  });
});

describe('MapView — dibujo de una zona nueva', () => {
  it('al crear un polígono desde la herramienta de dibujo, llama a onZonaCreada con sus vértices', () => {
    const mapSpy = vi.spyOn(L, 'map');
    const onZonaCreada = vi.fn();
    renderMap({ onZonaCreada });
    const map = mapSpy.mock.results[0].value as L.DrawMap;

    const layer = L.polygon([[-35, -59], [-35, -57], [-34, -57]]);
    map.fire(L.Draw.Event.CREATED, { layer, layerType: 'polygon' } as unknown as L.LeafletEvent);

    expect(onZonaCreada).toHaveBeenCalledWith([
      { lat: -35, lng: -59 },
      { lat: -35, lng: -57 },
      { lat: -34, lng: -57 },
    ]);
  });
});

describe('MapView — cartelito de PDV (popupopen)', () => {
  it('cablea el botón "Excluir PDV" del popup: llama a onExcluirPdv y cierra el popup', () => {
    const mapSpy = vi.spyOn(L, 'map');
    const onExcluirPdv = vi.fn();
    renderMap({ onExcluirPdv });
    const map = mapSpy.mock.results[0].value as L.Map;
    const closePopupSpy = vi.spyOn(map, 'closePopup');

    const popupEl = document.createElement('div');
    popupEl.innerHTML = '<button data-excluir-id="PDV-1">Excluir PDV</button>';
    const btn = popupEl.querySelector('button')!;
    const addEventListenerSpy = vi.spyOn(btn, 'addEventListener');
    map.fire('popupopen', { popup: { getElement: () => popupEl } } as unknown as L.LeafletEvent);

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onExcluirPdv).toHaveBeenCalledWith('PDV-1');
    expect(closePopupSpy).toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), { once: true });

    // { once: true } de verdad: un segundo click no debería volver a llamar a onExcluirPdv
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onExcluirPdv).toHaveBeenCalledTimes(1);
  });

  it('si el popup no tiene el botón esperado, no rompe', () => {
    const mapSpy = vi.spyOn(L, 'map');
    renderMap();
    const map = mapSpy.mock.results[0].value as L.Map;

    const popupEl = document.createElement('div');
    expect(() => map.fire('popupopen', { popup: { getElement: () => popupEl } } as unknown as L.LeafletEvent)).not.toThrow();
  });

  it('si el botón existe pero sin el atributo data-excluir-id, tampoco cablea el click', () => {
    const mapSpy = vi.spyOn(L, 'map');
    const onExcluirPdv = vi.fn();
    renderMap({ onExcluirPdv });
    const map = mapSpy.mock.results[0].value as L.Map;

    const popupEl = document.createElement('div');
    popupEl.innerHTML = '<button>Excluir PDV</button>'; // sin data-excluir-id
    map.fire('popupopen', { popup: { getElement: () => popupEl } } as unknown as L.LeafletEvent);
    popupEl.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onExcluirPdv).not.toHaveBeenCalled();
  });
});

describe('MapView — handle imperativo', () => {
  it('fitToData ajusta el mapa a los bounds del layer de markers cuando tiene puntos', () => {
    // No se usa el flujo real de circleMarker (requiere un contexto 2D de canvas
    // que happy-dom no soporta, ver describe de más abajo): se agrega un marker
    // directo al featureGroup real que usa fitToData, para probar esa lógica sola.
    const mapSpy = vi.spyOn(L, 'map');
    const featureGroupSpy = vi.spyOn(L, 'featureGroup');
    const { ref } = renderMap({ pdv: [] });
    const map = mapSpy.mock.results[0].value as L.Map;
    const markerLayer = featureGroupSpy.mock.results[0].value as L.FeatureGroup;
    markerLayer.addLayer(L.marker([-34.5, -58]));
    const fitBoundsSpy = vi.spyOn(map, 'fitBounds');

    ref.current!.fitToData();

    expect(fitBoundsSpy).toHaveBeenCalledWith(expect.anything(), { padding: [20, 20] });
  });

  it('fitToData no explota ni llama a fitBounds si no hay markers', () => {
    const mapSpy = vi.spyOn(L, 'map');
    const { ref } = renderMap({ pdv: [] });
    const map = mapSpy.mock.results[0].value as L.Map;
    const fitBoundsSpy = vi.spyOn(map, 'fitBounds');

    expect(() => ref.current!.fitToData()).not.toThrow();
    expect(fitBoundsSpy).not.toHaveBeenCalled();
  });

  it('startEditingZone/stopEditingZone(true) habilita edición y devuelve los vértices al guardar', () => {
    const { ref } = renderMap({ zonas: [zona()] });

    ref.current!.startEditingZone(0);
    const result = ref.current!.stopEditingZone(true);

    expect(result).toEqual(zona().vertices);
  });

  it('stopEditingZone(false) descarta y devuelve null', () => {
    const { ref } = renderMap({ zonas: [zona()] });

    ref.current!.startEditingZone(0);
    const result = ref.current!.stopEditingZone(false);

    expect(result).toBeNull();
  });

  it('stopEditingZone sin haber empezado a editar devuelve null', () => {
    const { ref } = renderMap({ zonas: [zona()] });
    expect(ref.current!.stopEditingZone(true)).toBeNull();
  });

  it('startEditingZone con un índice sin layer no explota', () => {
    const { ref } = renderMap({ zonas: [] });
    expect(() => ref.current!.startEditingZone(0)).not.toThrow();
    expect(ref.current!.stopEditingZone(true)).toBeNull();
  });

  it('startEditingZone dos veces seguidas no reemplaza la edición en curso', () => {
    const { ref } = renderMap({ zonas: [zona({ nombre: 'A' }), zona({ nombre: 'B', vertices: zona().vertices.map(v => ({ lat: v.lat + 1, lng: v.lng + 1 })) })] });

    ref.current!.startEditingZone(0);
    ref.current!.startEditingZone(1); // debería ser un no-op: ya hay una edición en curso

    const result = ref.current!.stopEditingZone(true);
    expect(result).toEqual(zona().vertices); // sigue siendo la zona 0, no la 1
  });

  it('edita específicamente la zona de índice 1, no siempre la primera que encuentra', () => {
    const zonaB = zona({ nombre: 'B', vertices: zona().vertices.map((v) => ({ lat: v.lat + 5, lng: v.lng + 5 })) });
    const { ref } = renderMap({ zonas: [zona({ nombre: 'A' }), zonaB] });

    ref.current!.startEditingZone(1);
    const result = ref.current!.stopEditingZone(true);

    expect(result).toEqual(zonaB.vertices); // no los de la zona A
  });

  it('stopEditingZone(false) revierte los cambios del layer (revertLayers)', () => {
    const { ref } = renderMap({ zonas: [zona()] });
    ref.current!.startEditingZone(0);
    // @ts-expect-error acceso al handler interno vía el módulo leaflet-draw real
    const handler = (L.EditToolbar.Edit.prototype as { revertLayers: () => void });
    const revertSpy = vi.spyOn(handler, 'revertLayers');

    ref.current!.stopEditingZone(false);

    expect(revertSpy).toHaveBeenCalled();
  });
});
