import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import type { RangoVentas } from '@/services/zonificacionApi';
import type { ColorScheme, LatLng, Pdv, Zona } from '../types';
import { getPointColor, isValidHexColor } from '../lib/colors';
import { diaLabel } from '../lib/colors';
import { getZonePoints } from '../lib/geo';
import { formatRangoVentas } from '../lib/rangoVentas';

// Port imperativo de la lógica de mapa/dibujo/edición de mapa_universo_enro.html
// (líneas 224-332, 453-521, 556-628, 630-718). Igual que el único precedente real de
// mapas en DistriGestión (RutaMapModal.tsx), usa la API imperativa de Leaflet en vez de
// react-leaflet — más simple para Leaflet.draw, edición de una sola zona y z-index de panes.

export interface MapViewHandle {
  /** Habilita el editor de Leaflet.draw sobre la zona dada (por índice en el array `zonas`). */
  startEditingZone: (index: number) => void;
  /** Cierra el modo edición. Si save=true, devuelve los vértices nuevos; si no, los descarta. */
  stopEditingZone: (save: boolean) => LatLng[] | null;
  /** Centra y ajusta el zoom para que entren todos los puntos actualmente visibles (con los filtros aplicados). */
  fitToData: () => void;
}

interface MapViewProps {
  pdv: Pdv[];
  colorScheme: ColorScheme;
  zonas: Zona[];
  labelsVisible: boolean;
  polygonsVisible: boolean;
  /** Vendedores seleccionados en el filtro activo — solo se usa para resaltar en el cartelito. */
  filtroVendedor: string[];
  /** Rango de fechas de la facturación mostrada en el cartelito (ver FiltersBar). */
  rangoVentas: RangoVentas;
  onZonaCreada: (vertices: LatLng[]) => void;
  onExcluirPdv: (id: string) => void;
}

interface ZoneLayerEntry {
  layer: L.Polygon;
  index: number;
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { pdv, colorScheme, zonas, labelsVisible, polygonsVisible, filtroVendedor, rangoVentas, onZonaCreada, onExcluirPdv },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // FeatureGroup (no LayerGroup a secas): agrega getBounds(), que usa fitToData().
  const markerLayerRef = useRef<L.FeatureGroup | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const zoneLayersRef = useRef<ZoneLayerEntry[]>([]);
  const zoneLabelsRef = useRef<L.Marker[]>([]);
  const editHandlerRef = useRef<{ index: number; handler: L.EditToolbar.Edit } | null>(null);

  // Refs "espejo" de las últimas props, para leer datos frescos dentro de handlers
  // de Leaflet (mouseover, etc.) sin tener que reatar los listeners en cada render.
  const pdvRef = useRef(pdv);
  const polygonsVisibleRef = useRef(polygonsVisible);
  const onZonaCreadaRef = useRef(onZonaCreada);
  const filtroVendedorRef = useRef(filtroVendedor);
  const rangoVentasRef = useRef(rangoVentas);
  const onExcluirPdvRef = useRef(onExcluirPdv);
  useEffect(() => { pdvRef.current = pdv; }, [pdv]);
  useEffect(() => { polygonsVisibleRef.current = polygonsVisible; }, [polygonsVisible]);
  useEffect(() => { onZonaCreadaRef.current = onZonaCreada; }, [onZonaCreada]);
  useEffect(() => { filtroVendedorRef.current = filtroVendedor; }, [filtroVendedor]);
  useEffect(() => { rangoVentasRef.current = rangoVentas; }, [rangoVentas]);
  useEffect(() => { onExcluirPdvRef.current = onExcluirPdv; }, [onExcluirPdv]);

  // ── init del mapa (una sola vez) ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // zoomControl:false + L.control.zoom propio abajo-a-la-derecha: junto con el control de
    // dibujo (más abajo), deja las esquinas de arriba libres para los botones propios de la
    // página (paneles laterales / filtros).
    const map = L.map(containerRef.current, { tap: false, zoomControl: false } as unknown as L.MapOptions).setView([-34.82, -58.43], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(map);

    map.createPane('markersPane');
    map.getPane('markersPane')!.style.zIndex = '450';

    // Renderer canvas compartido por todos los puntos de PDV: dibuja los ~4600 puntos
    // en un único <canvas> en vez de un <div> por punto (L.marker + divIcon), que con
    // este volumen generaba miles de nodos DOM y hacía el pan/zoom muy lento.
    const canvasRenderer = L.canvas({ padding: 0.5, pane: 'markersPane' });

    const markerLayer = L.featureGroup().addTo(map);
    const drawnItems = new L.FeatureGroup().addTo(map);

    const drawControl = new L.Control.Draw({
      position: 'bottomright',
      draw: {
        polygon: { shapeOptions: { color: '#7c3aed', fillOpacity: 0.12, weight: 2 } },
        rectangle: { shapeOptions: { color: '#7c3aed', fillOpacity: 0.12, weight: 2 } },
        circle: false,
        marker: false,
        polyline: false,
        circlemarker: false,
      },
      edit: false,
    } as unknown as L.Control.DrawConstructorOptions);
    map.addControl(drawControl);

    // El cartelito es HTML plano (bindPopup), no React — el botón "Excluir PDV" se cablea
    // acá, leyendo el id que dejó buildPopupHtml en data-excluir-id cada vez que se abre.
    map.on('popupopen', (e) => {
      const popupEl = e.popup.getElement();
      const btn = popupEl?.querySelector<HTMLButtonElement>('[data-excluir-id]');
      const id = btn?.getAttribute('data-excluir-id');
      if (!btn || !id) return;
      btn.addEventListener('click', () => {
        onExcluirPdvRef.current(id);
        map.closePopup();
      }, { once: true });
    });

    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = (e as L.DrawEvents.Created).layer as L.Polygon;
      drawnItems.addLayer(layer);
      let lls = layer.getLatLngs() as unknown as L.LatLng[] | L.LatLng[][];
      while (Array.isArray(lls[0])) lls = lls[0] as L.LatLng[];
      const vertices = (lls as L.LatLng[]).map((ll) => ({ lat: ll.lat, lng: ll.lng }));
      // El layer recién dibujado se descarta: la fuente de verdad son los `zonas` que
      // vuelven por props luego de persistir — se vuelve a dibujar en el próximo render.
      drawnItems.removeLayer(layer);
      onZonaCreadaRef.current(vertices);
    });

    mapRef.current = map;
    markerLayerRef.current = markerLayer;
    drawnItemsRef.current = drawnItems;
    canvasRendererRef.current = canvasRenderer;

    // Leaflet mide el tamaño del contenedor una sola vez, al crear el mapa. Si después
    // cambia (al ocultar/mostrar los paneles laterales, o al ajustarse el layout de la
    // página), Leaflet sigue creyendo que el área visible es la original y deja sin
    // cargar tiles la parte nueva — hay que avisarle explícitamente con invalidateSize().
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── markers de PDV ───────────────────────────────────────────────────────
  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    const renderer = canvasRendererRef.current;
    if (!markerLayer || !renderer) return;
    markerLayer.clearLayers();
    pdv.forEach((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
      const color = getPointColor(p, colorScheme);
      // circleMarker + renderer canvas en vez de marker + divIcon: un solo <canvas>
      // dibuja todos los puntos, en vez de un nodo DOM por punto.
      L.circleMarker([p.lat, p.lng], {
        renderer,
        radius: 4.5,
        weight: 1.5,
        color: 'rgba(0,0,0,.35)',
        fillColor: color,
        fillOpacity: 1,
      })
        // Contenido del popup generado al abrir, no por adelantado para los ~4600 puntos.
        // Lee filtroVendedorRef (no filtroVendedor directo) para no tener que reconstruir
        // los ~4600 popups cada vez que cambia el filtro de vendedor.
        .bindPopup(() => buildPopupHtml(p, filtroVendedorRef.current, rangoVentasRef.current), { maxWidth: 280 })
        .addTo(markerLayer);
    });
  }, [pdv, colorScheme]);

  // ── polígonos de zona (se reconstruyen cuando cambia el set de zonas) ───
  useEffect(() => {
    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!map || !drawnItems) return;

    zoneLayersRef.current.forEach(({ layer }) => drawnItems.removeLayer(layer));
    zoneLayersRef.current = [];

    zonas.forEach((z, index) => {
      if (z.vertices.length < 3) return;
      const layer = L.polygon(
        z.vertices.map((v) => L.latLng(v.lat, v.lng)),
        { color: z.color, fillColor: z.color, fillOpacity: polygonsVisible ? 0.12 : 0, opacity: polygonsVisible ? 1 : 0, weight: 2 }
      );
      drawnItems.addLayer(layer);
      bindZoneHover(layer, z);
      zoneLayersRef.current.push({ layer, index });
    });
    // polygonsVisible se aplica en su propio efecto liviano; no hace falta acá,
    // pero se usa el valor actual al momento de crear el layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonas]);

  function bindZoneHover(layer: L.Polygon, zona: Zona) {
    layer.off('mouseover mouseout mousemove');
    layer.on('mouseover', (e) => {
      const pts = getZonePoints(pdvRef.current, zona.vertices);
      const vendedores = new Set(pts.map((p) => p.vnd_cod).filter(Boolean)).size;
      layer.setStyle({ fillOpacity: 0.28, weight: 3 });
      layer
        .bindTooltip(
          `<div style="font-weight:700;color:${safeColor(zona.color)};margin-bottom:3px">${escapeHtml(zona.nombre)}</div>` +
            `<div style="font-size:11px;line-height:1.6">PDV: <b>${pts.length}</b><br>Vendedores distintos: <b>${vendedores}</b></div>`,
          { sticky: true, direction: 'top', offset: [0, -4] }
        )
        .openTooltip((e as L.LeafletMouseEvent).latlng);
    });
    layer.on('mouseout', () => {
      layer.setStyle({ fillOpacity: polygonsVisibleRef.current ? 0.12 : 0, weight: 2 });
      layer.unbindTooltip();
    });
    layer.on('mousemove', (e) => {
      const tooltip = layer.getTooltip();
      if (tooltip) tooltip.setLatLng((e as L.LeafletMouseEvent).latlng);
    });
  }

  // ── visibilidad de polígonos (liviano: no reconstruye nada) ─────────────
  useEffect(() => {
    zoneLayersRef.current.forEach(({ layer }) => {
      layer.setStyle(polygonsVisible ? { opacity: 1, fillOpacity: 0.12 } : { opacity: 0, fillOpacity: 0 });
    });
  }, [polygonsVisible]);

  // ── etiquetas de zona ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    zoneLabelsRef.current.forEach((m) => map.removeLayer(m));
    zoneLabelsRef.current = [];

    if (!labelsVisible) return;

    zoneLayersRef.current.forEach(({ layer, index }) => {
      const zona = zonas[index];
      if (!zona) return;
      const pts = getZonePoints(pdvRef.current, zona.vertices);
      const marker = L.marker(layer.getBounds().getCenter(), {
        // El contenido es de ancho variable (nombre de zona + cantidad de PDV), así que no
        // hay un iconAnchor fijo correcto: centrarlo con transform (mitad de su propio ancho/alto
        // renderizado) en vez de un iconAnchor fijo, que dejaba el label con la esquina
        // superior-izquierda pegada al centro de la zona en vez de centrado sobre él ("etiquetas rotas").
        icon: L.divIcon({
          html: `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);background:#fff;border:1.5px solid ${safeColor(zona.color)};color:${safeColor(zona.color)};font-weight:700;font-size:11px;padding:2px 6px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.15)">${escapeHtml(zona.nombre)}<span style="color:#6b7280;font-weight:400"> · ${pts.length} PDV</span></div>`,
          className: '',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
        zIndexOffset: 500,
      });
      marker.addTo(map);
      zoneLabelsRef.current.push(marker);
    });
  }, [labelsVisible, zonas, pdv]);

  // ── imperative handle: edición de una sola zona ──────────────────────────
  useImperativeHandle(ref, () => ({
    startEditingZone(index: number) {
      const map = mapRef.current;
      if (!map || editHandlerRef.current) return;
      const entry = zoneLayersRef.current.find((z) => z.index === index);
      if (!entry) return;

      map.getPane('markersPane')!.style.zIndex = '350';
      const handler = new L.EditToolbar.Edit(map as unknown as L.DrawMap, { featureGroup: L.featureGroup([entry.layer]) });
      handler.enable();
      editHandlerRef.current = { index, handler };
    },
    stopEditingZone(save: boolean) {
      const current = editHandlerRef.current;
      const map = mapRef.current;
      if (!current || !map) return null;

      let result: LatLng[] | null = null;
      if (save) {
        current.handler.save();
        const entry = zoneLayersRef.current.find((z) => z.index === current.index);
        if (entry) {
          let lls = entry.layer.getLatLngs() as unknown as L.LatLng[] | L.LatLng[][];
          while (Array.isArray(lls[0])) lls = lls[0] as L.LatLng[];
          result = (lls as L.LatLng[]).map((ll) => ({ lat: ll.lat, lng: ll.lng }));
        }
      } else {
        current.handler.revertLayers();
      }
      current.handler.disable();
      editHandlerRef.current = null;
      map.getPane('markersPane')!.style.zIndex = '450';
      return result;
    },
    fitToData() {
      const map = mapRef.current;
      const markerLayer = markerLayerRef.current;
      if (!map || !markerLayer) return;
      const bounds = markerLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    },
  }));

  return <div ref={containerRef} className="h-full w-full" />;
});

export default MapView;

export function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

// Cartelito compacto: cada línea junta 2-3 datos relacionados en vez de una línea por
// campo, y la lista de vendedores va en una sola línea separada por "·" en vez de un
// <li> por vendedor — así el popup no crece demasiado en clientes con muchas asignaciones.
export function buildPopupHtml(p: Pdv, filtroVendedor: string[], rangoVentas: RangoVentas) {
  const dirCompleta = [p.dir, p.loc, p.par].filter(Boolean).join(', ');
  const vendedoresTexto = p.vendedores.length
    ? p.vendedores
        .map((v) => {
          const activo = filtroVendedor.length > 0 && filtroVendedor.includes(v.cod);
          const estilo = activo ? 'font-weight:700;color:#7c3aed' : '';
          return `<span style="${estilo}">${escapeHtml(v.nombre || v.cod)} (${diaLabel(v.dia)}${v.frq ? `, ${escapeHtml(v.frq)}` : ''})</span>`;
        })
        .join(' · ')
    : 'Sin vendedor asignado';

  return `<div class="text-sm font-semibold mb-0.5">${escapeHtml(p.id)} - ${escapeHtml(p.n)}</div>
    <div class="text-xs text-slate-600">${escapeHtml(dirCompleta || '–')}</div>
    <div class="text-xs text-slate-600">${escapeHtml(p.com || 'Sin rubro')} · Reparto: ${escapeHtml(p.reparto || '–')}</div>
    <div class="text-xs text-slate-600">Facturación (${formatRangoVentas(rangoVentas)}): ${formatMoney(p.facturacion)}</div>
    <div class="text-xs text-slate-600 mt-0.5"><b>Vendedores:</b> ${vendedoresTexto}</div>
    <button
      type="button"
      data-excluir-id="${escapeHtml(p.id)}"
      style="margin-top:6px;width:100%;border-radius:6px;border:1px solid #fca5a5;background:#fef2f2;color:#dc2626;font-size:11px;font-weight:600;padding:3px 8px;cursor:pointer"
    >Excluir PDV</button>`;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// zona.color se interpola dentro de atributos style="..."; escapeHtml no alcanza ahí
// (no escapa comillas, así que un color tipo `red" onmouseover="..."` seguiría rompiendo
// el atributo sin necesitar `<`/`>`). Validar contra el formato hex esperado en vez de
// intentar escapar ese contexto.
export function safeColor(color: string) {
  return isValidHexColor(color) ? color : '#6b7280';
}
