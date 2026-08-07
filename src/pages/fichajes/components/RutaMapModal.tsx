import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Loader2, AlertTriangle, Clock, Timer, Download } from "lucide-react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";
import type { DetalleCobertura, DetalleRow } from "../Fichajes";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function parseCoords(str: string | null | undefined): [number, number] | null {
  if (!str || !String(str).includes(";")) return null;
  const [lat, lng] = String(str).split(";").map(Number);
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
}

function parseClienteCoords(lat?: string | null, lng?: string | null): [number, number] | null {
  if (!lat || !lng) return null;
  const la = Number(lat), lo = Number(lng);
  if (isNaN(la) || isNaN(lo)) return null;
  return [la, lo];
}

function hhmm(ts: string | null | undefined): string {
  if (!ts) return "—";
  return String(ts).slice(11, 16) || "—";
}

function formatMin(min: number | null | undefined): string {
  if (min == null || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

type RowConOrden = DetalleRow & { orden: number };

function buildTransitMap(rows: DetalleRow[]): Map<string, number> {
  const map = new Map<string, number>();
  const visitedSorted = [...rows]
    .filter(r => r.visitado && r.timestampCheckin)
    .sort((a, b) => (a.timestampCheckin ?? "").localeCompare(b.timestampCheckin ?? ""));
  visitedSorted.forEach((curr, i) => {
    if (i < visitedSorted.length - 1) {
      const next = visitedSorted[i + 1];
      if (curr.timestampCheckout && next.timestampCheckin) {
        const diff = Math.round(
          (new Date(next.timestampCheckin).getTime() - new Date(curr.timestampCheckout).getTime()) / 60000
        );
        if (diff > 0) map.set(curr.codigoCliente, diff);
      }
    }
  });
  return map;
}

function categorizarRows(rows: DetalleRow[]): {
  ruta: RowConOrden[];
  invalidos: RowConOrden[];
  noVisitados: DetalleRow[];
} {
  // Todos los visitados ordenados cronológicamente → número de orden global (válidos e inválidos juntos)
  const visitadosOrdenados: RowConOrden[] = rows
    .filter(r => r.visitado)
    .sort((a, b) => (a.timestampCheckin ?? "").localeCompare(b.timestampCheckin ?? ""))
    .map((r, i) => ({ ...r, orden: i + 1 }));

  const ruta      = visitadosOrdenados.filter(r => r.tieneValido && parseCoords(r.coordenadasCheckin) !== null);
  const invalidos = visitadosOrdenados.filter(r => !r.tieneValido);
  const noVisitados = rows.filter(r => !r.visitado);
  return { ruta, invalidos, noVisitados };
}

// ─────────────────────────────────────────────────────────────
// GENERADOR DE MAPA PARA EXPORT (canvas, sin html2canvas)
// ─────────────────────────────────────────────────────────────

async function exportMapToCanvas(rows: DetalleRow[], W = 960, H = 560): Promise<string> {
  const { ruta, invalidos, noVisitados } = categorizarRows(rows);

  type PtInfo = { coord: [number, number]; type: "valido" | "invalido" | "novisita"; label: string };
  const visitedOrdered = [...ruta, ...invalidos].sort((a, b) => a.orden - b.orden);
  const allPts: PtInfo[] = [];
  visitedOrdered.forEach(r => {
    const c = parseCoords(r.coordenadasCheckin) ?? parseClienteCoords(r.clienteLatitud, r.clienteLongitud);
    if (c) allPts.push({ coord: c, type: r.tieneValido ? "valido" : "invalido", label: String(r.orden) });
  });
  noVisitados.forEach(r => {
    const c = parseClienteCoords(r.clienteLatitud, r.clienteLongitud);
    if (c) allPts.push({ coord: c, type: "novisita", label: "×" });
  });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  if (allPts.length === 0) {
    ctx.fillStyle = "#e2e8f0"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#64748b"; ctx.font = "14px Arial"; ctx.textAlign = "center";
    ctx.fillText("Sin coordenadas disponibles", W / 2, H / 2);
    return canvas.toDataURL("image/png").split(",")[1];
  }

  // --- Tile math ---
  const lngToTX = (lng: number, z: number) => Math.floor((lng + 180) / 360 * (1 << z));
  const latToTY = (lat: number, z: number) => {
    const r = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z));
  };
  const txToLng = (x: number, z: number) => x / (1 << z) * 360 - 180;
  const tyToLat = (y: number, z: number) => {
    const n = Math.PI - 2 * Math.PI * y / (1 << z);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };

  const lats = allPts.map(p => p.coord[0]);
  const lngs = allPts.map(p => p.coord[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // Zoom: máximo que entre en 4×3 tiles
  let zoom = 16;
  while (zoom > 11) {
    if (lngToTX(maxLng, zoom) - lngToTX(minLng, zoom) <= 3 &&
        latToTY(minLat, zoom) - latToTY(maxLat, zoom) <= 2) break;
    zoom--;
  }

  const tx0 = lngToTX(minLng, zoom), tx1 = lngToTX(maxLng, zoom);
  const ty0 = latToTY(maxLat, zoom), ty1 = latToTY(minLat, zoom);
  const TILE = 256;
  const tilesW = tx1 - tx0 + 1, tilesH = ty1 - ty0 + 1;
  const mapW = tilesW * TILE, mapH = tilesH * TILE;
  const tlLng = txToLng(tx0, zoom), brLng = txToLng(tx1 + 1, zoom);
  const tlLat = tyToLat(ty0, zoom), brLat = tyToLat(ty1 + 1, zoom);

  function project(lat: number, lng: number): [number, number] {
    return [((lng - tlLng) / (brLng - tlLng)) * W, ((tlLat - lat) / (tlLat - brLat)) * H];
  }

  // Fetch tiles
  const tmpC = document.createElement("canvas"); tmpC.width = mapW; tmpC.height = mapH;
  const tc = tmpC.getContext("2d")!;
  const tileProm: Promise<void>[] = [];
  for (let ix = 0; ix < tilesW; ix++) {
    for (let iy = 0; iy < tilesH; iy++) {
      tileProm.push(new Promise<void>(res => {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => { tc.drawImage(img, ix * TILE, iy * TILE, TILE, TILE); res(); };
        img.onerror = () => res();
        img.src = `https://tile.openstreetmap.org/${zoom}/${tx0 + ix}/${ty0 + iy}.png`;
      }));
    }
  }
  await Promise.all(tileProm);
  ctx.drawImage(tmpC, 0, 0, W, H);

  // Línea punteada de ruta
  const routePts = visitedOrdered
    .map(r => parseCoords(r.coordenadasCheckin) ?? parseClienteCoords(r.clienteLatitud, r.clienteLongitud))
    .filter(Boolean) as [number, number][];
  if (routePts.length > 1) {
    ctx.save();
    ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 2.5;
    ctx.setLineDash([9, 6]); ctx.globalAlpha = 0.9; ctx.lineJoin = "round";
    ctx.beginPath();
    routePts.forEach((p, i) => { const [x, y] = project(p[0], p[1]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke(); ctx.restore();
  }

  // Pasada 1: dibujar todos los círculos en su posición real
  const R = 13;
  allPts.forEach(p => {
    const [x, y] = project(p.coord[0], p.coord[1]);
    const color = p.type === "valido" ? "#10b981" : p.type === "invalido" ? "#f59e0b" : "#ef4444";
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  });

  // Pasada 2: dibujar todos los números encima (siempre visibles)
  allPts.forEach(p => {
    const [x, y] = project(p.coord[0], p.coord[1]);
    ctx.save();
    ctx.font = `bold ${p.label.length > 2 ? 9 : 11}px Arial`;
    ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.label, x, y);
    ctx.restore();
  });

  return canvas.toDataURL("image/png").split(",")[1];
}

// ─────────────────────────────────────────────────────────────
// MAPA — recibe ref desde el padre para que el export pueda capturarlo
// ─────────────────────────────────────────────────────────────

interface LeafletMapProps {
  rows: DetalleRow[];
  containerRef: React.RefObject<HTMLDivElement>;
  onRegisterPanTo: (fn: (codigo: string) => void) => void;
}

function LeafletMap({ rows, containerRef, onRegisterPanTo }: LeafletMapProps) {
  useEffect(() => {
    if (!containerRef.current) return;
    const { ruta, invalidos, noVisitados } = categorizarRows(rows);

    // Polilínea: todos los visitados con GPS (para inválidos se usa fallback a coords de cliente)
    const routeCoords: [number, number][] = [...ruta, ...invalidos]
      .sort((a, b) => a.orden - b.orden)
      .map(r => parseCoords(r.coordenadasCheckin) ?? parseClienteCoords(r.clienteLatitud, r.clienteLongitud))
      .filter(Boolean) as [number, number][];

    const allPoints: [number, number][] = [
      ...routeCoords,
      ...noVisitados.map(r => parseClienteCoords(r.clienteLatitud, r.clienteLongitud)).filter(Boolean) as [number, number][],
    ];

    const center: L.LatLngTuple = allPoints.length > 0
      ? [allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length, allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length]
      : [-34.6, -58.4];

    const map = L.map(containerRef.current, { center, zoom: 13 });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      crossOrigin: true,
    }).addTo(map);

    if (routeCoords.length > 1)
      L.polyline(routeCoords, { color: "#6366f1", weight: 3, opacity: 0.85, dashArray: "7 5" }).addTo(map);

    // Registro de posición y marcador por codigoCliente para el foco desde el panel
    const posMap = new Map<string, [number, number]>();
    const markerMap = new Map<string, L.Marker>();

    ruta.forEach(r => {
      const pos = parseCoords(r.coordenadasCheckin)!;
      const icon = L.divIcon({
        className: "",
        html: `<div style="box-sizing:border-box;background:#10b981;color:white;width:26px;height:26px;border-radius:50%;line-height:22px;text-align:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)">${r.orden}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16],
      });
      const addr = [r.clienteCalle, r.clienteAltura, r.clienteLocalidad].filter(Boolean).join(" · ");
      const m = L.marker(pos, { icon }).addTo(map).bindPopup(`
        <div style="font-size:12px;min-width:150px;line-height:1.5">
          <div style="font-weight:700">${r.clienteNombre || r.codigoCliente}</div>
          ${r.clienteRubro ? `<div style="color:#6366f1;font-size:10px">${r.clienteRubro}</div>` : ""}
          <div style="color:#059669;font-weight:700;margin-top:3px">✓ ${hhmm(r.timestampCheckin)} → ${hhmm(r.timestampCheckout)}</div>
          ${r.duracion != null && r.duracion > 0 ? `<div style="color:#9ca3af;font-size:11px">${r.duracion} min</div>` : ""}
          ${addr ? `<div style="color:#9ca3af;font-size:10px;margin-top:2px">${addr}</div>` : ""}
        </div>`);
      posMap.set(r.codigoCliente, pos);
      markerMap.set(r.codigoCliente, m);
    });

    invalidos.forEach(r => {
      const pos = parseCoords(r.coordenadasCheckin) ?? parseClienteCoords(r.clienteLatitud, r.clienteLongitud);
      if (!pos) return;
      const icon = L.divIcon({
        className: "",
        html: `<div style="box-sizing:border-box;background:#f59e0b;color:white;width:26px;height:26px;border-radius:50%;line-height:22px;text-align:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)">${r.orden}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16],
      });
      const addr = [r.clienteCalle, r.clienteAltura, r.clienteLocalidad].filter(Boolean).join(" · ");
      const m = L.marker(pos, { icon }).addTo(map).bindPopup(`
        <div style="font-size:12px;min-width:150px;line-height:1.5">
          <div style="font-weight:700">${r.clienteNombre || r.codigoCliente}</div>
          ${r.clienteRubro ? `<div style="color:#6366f1;font-size:10px">${r.clienteRubro}</div>` : ""}
          <div style="color:#f59e0b;font-weight:700;margin-top:3px">⚠ ${hhmm(r.timestampCheckin)} · Inválido</div>
          ${addr ? `<div style="color:#9ca3af;font-size:10px;margin-top:2px">${addr}</div>` : ""}
        </div>`);
      posMap.set(r.codigoCliente, pos);
      markerMap.set(r.codigoCliente, m);
    });

    noVisitados.forEach(r => {
      const pos = parseClienteCoords(r.clienteLatitud, r.clienteLongitud);
      if (!pos) return;
      L.circleMarker(pos, { radius: 8, color: "#ef4444", fillColor: "#fca5a5", fillOpacity: 0.9, weight: 2 })
        .addTo(map).bindPopup(`<div style="font-size:12px"><b>${r.clienteNombre||r.codigoCliente}</b><br/><span style="color:#ef4444">✗ Sin visita</span></div>`);
      posMap.set(r.codigoCliente, pos);
    });

    if (allPoints.length === 1) map.setView(allPoints[0], 15);
    else if (allPoints.length > 1) map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: 16 });

    // Registrar función de foco para uso desde el panel lateral
    onRegisterPanTo((codigo: string) => {
      const pos = posMap.get(codigo);
      const marker = markerMap.get(codigo);
      if (!pos) return;
      map.flyTo(pos, Math.max(map.getZoom(), 16), { animate: true, duration: 0.6 });
      marker?.openPopup();
    });

    return () => { map.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}

// ─────────────────────────────────────────────────────────────
// PANEL LATERAL — listado completo
// ─────────────────────────────────────────────────────────────

function ClientesList({ rows, onFocusCliente }: { rows: DetalleRow[]; onFocusCliente?: (codigo: string) => void }) {
  const { ruta, invalidos, noVisitados } = categorizarRows(rows);
  const transitMap  = buildTransitMap(rows);
  const duraciones  = ruta.map(r => r.duracion ?? 0).filter(d => d > 0);
  const totalMin    = duraciones.reduce((s, d) => s + d, 0);
  const promedioMin = duraciones.length > 0 ? Math.round(totalMin / duraciones.length) : null;

  const transitVals   = [...transitMap.values()];
  const avgTransitMin = transitVals.length > 0 ? Math.round(transitVals.reduce((a, b) => a + b, 0) / transitVals.length) : null;

  const Section = ({ title, color, children }: { title: string; color: string; children: React.ReactNode }) => (
    <div>
      <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide sticky top-0 z-10 ${color}`}>
        {title}
      </div>
      {children}
    </div>
  );

  const ClientRow = ({ r, numero, estado }: { r: DetalleRow; numero?: number; estado: "valido" | "invalido" | "novisita" }) => {
    const transitMin = transitMap.get(r.codigoCliente) ?? 0;
    return (
      <div
        className="px-4 py-2.5 hover:bg-blue-50 active:bg-blue-100 transition-colors border-b border-gray-50 cursor-pointer"
        onClick={() => onFocusCliente?.(r.codigoCliente)}
      >
        <div className="flex items-start gap-2">
          {numero != null ? (
            <span className={`shrink-0 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5 ${estado === "valido" ? "bg-emerald-500" : "bg-amber-400"}`}>
              {numero}
            </span>
          ) : (
            <span className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-800 text-xs leading-tight truncate">{r.clienteNombre || r.codigoCliente}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="font-mono text-[10px] text-gray-400">{r.codigoCliente}</span>
              {r.clienteRubro && (
                <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded truncate max-w-[110px]">{r.clienteRubro}</span>
              )}
            </div>
            {estado === "valido" && (
              <>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-mono text-xs font-semibold text-emerald-700">{hhmm(r.timestampCheckin)}</span>
                  <span className="text-gray-300 text-xs">→</span>
                  <span className="font-mono text-xs text-gray-500">{hhmm(r.timestampCheckout)}</span>
                  {r.duracion != null && r.duracion > 0 && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-auto">{r.duracion} min en punto</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Timer className="w-3 h-3 text-violet-400 shrink-0" />
                  <span className="text-[10px] text-violet-600">{transitMin} min traslado prox. PDV</span>
                </div>
              </>
            )}
            {estado === "invalido" && (
              <>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="font-mono text-xs text-amber-600">{hhmm(r.timestampCheckin)}</span>
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Inválido</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Timer className="w-3 h-3 text-violet-400 shrink-0" />
                  <span className="text-[10px] text-violet-600">{transitMin} min traslado prox. PDV</span>
                </div>
              </>
            )}
            {estado === "novisita" && (
              <div className="mt-1">
                <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Sin visita</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full border-l border-gray-100">
      {/* KPIs */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
        <p className="text-xs font-semibold text-gray-700 mb-2">
          {ruta.length} válidos · {invalidos.length} inválidos · {noVisitados.length} sin visita
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-semibold">{formatMin(totalMin)}</span>
            <span className="text-gray-400">total en clientes</span>
          </div>
          {promedioMin != null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Timer className="w-3.5 h-3.5 text-purple-500" />
              <span className="font-semibold">{formatMin(promedioMin)}</span>
              <span className="text-gray-400">prom. visita</span>
            </div>
          )}
          {avgTransitMin != null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Timer className="w-3.5 h-3.5 text-violet-500" />
              <span className="font-semibold">{formatMin(avgTransitMin)}</span>
              <span className="text-gray-400">prom. traslado</span>
            </div>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {ruta.length > 0 && (
          <Section title={`✓ Visitados (${ruta.length})`} color="bg-emerald-50 text-emerald-700">
            {ruta.map((r, i) => <ClientRow key={r.codigoCliente + i} r={r} numero={r.orden} estado="valido" />)}
          </Section>
        )}
        {invalidos.length > 0 && (
          <Section title={`⚠ Checkin inválido (${invalidos.length})`} color="bg-amber-50 text-amber-700">
            {invalidos.map((r, i) => <ClientRow key={r.codigoCliente + i} r={r} numero={r.orden} estado="invalido" />)}
          </Section>
        )}
        {noVisitados.length > 0 && (
          <Section title={`✗ Sin visita (${noVisitados.length})`} color="bg-red-50 text-red-600">
            {noVisitados.map((r, i) => <ClientRow key={r.codigoCliente + i} r={r} estado="novisita" />)}
          </Section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────

interface Props {
  empleado: string;
  nombreVendedor: string;
  fecha: string;
  onClose: () => void;
}

export function RutaMapModal({ empleado, nombreVendedor, fecha, onClose }: Props) {
  const [rows, setRows]         = useState<DetalleRow[] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Ref al contenedor del mapa — compartido entre LeafletMap y la función de export
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // Función de foco registrada por LeafletMap: el panel la llama al tocar un cliente
  const panToRef = useRef<((codigo: string) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setRows(null);
    fetchWithAuth(`${API.FICHAJES.DETALLE(empleado)}?fecha=${encodeURIComponent(fecha)}`)
      .then(r => r.json())
      .then((data: any) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.msg ?? "Error del servidor");
        setRows((data as DetalleCobertura).rows ?? []);
      })
      .catch(e => { if (!cancelled) setError(e.message ?? "Error cargando ruta"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [empleado, fecha]);

  // ── Export: captura el mapa + genera Excel con 2 hojas ──
  async function handleExport() {
    if (!rows || !mapContainerRef.current) return;
    setExporting(true);
    try {
      const { ruta, invalidos, noVisitados } = categorizarRows(rows);
      const transitMap    = buildTransitMap(rows);
      const duraciones    = ruta.map(r => r.duracion ?? 0).filter(d => d > 0);
      const totalMin      = duraciones.reduce((s, d) => s + d, 0);
      const promedioMin   = duraciones.length > 0 ? Math.round(totalMin / duraciones.length) : null;
      const transitVals   = [...transitMap.values()];
      const avgTransitMin = transitVals.length > 0 ? Math.round(transitVals.reduce((a, b) => a + b, 0) / transitVals.length) : null;

      // 1. Generar imagen del mapa via canvas (tiles OSM + marcadores + polilínea)
      const mapBase64 = await exportMapToCanvas(rows);

      // 2. Crear workbook con ExcelJS
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "CoopGestion";

      // ── Hoja 1: Clientes ──────────────────────────────────
      const ws = wb.addWorksheet("Clientes");
      ws.columns = [
        { key: "n",        width: 4  },
        { key: "codigo",   width: 10 },
        { key: "nombre",   width: 30 },
        { key: "rubro",    width: 18 },
        { key: "dir",      width: 28 },
        { key: "estado",   width: 18 },
        { key: "checkin",  width: 10 },
        { key: "checkout", width: 10 },
        { key: "dur",      width: 16 },
        { key: "traslado", width: 18 },
      ];

      const hdrRow = ws.addRow(["#", "Código", "Nombre", "Rubro", "Dirección", "Estado", "Checkin", "Checkout", "Duración (min)", "Traslado prox. (min)"]);
      hdrRow.font = { bold: true, size: 9, color: { argb: "FF374151" } };
      hdrRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      hdrRow.eachCell(cell => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "thin", color: { argb: "FFD1D5DB" } } };
      });
      hdrRow.height = 20;

      const addRows = (items: (DetalleRow & { orden?: number })[], estado: string, fill: string, fg: string) => {
        items.forEach(r => {
          const addr = [r.clienteCalle, r.clienteAltura, r.clienteLocalidad].filter(Boolean).join(" ");
          const row = ws.addRow([
            estado === "Sin visita" ? "" : (r.orden ?? ""),
            r.codigoCliente,
            r.clienteNombre,
            r.clienteRubro,
            addr,
            estado,
            hhmm(r.timestampCheckin),
            hhmm(r.timestampCheckout),
            r.duracion ?? "",
            estado !== "Sin visita" ? (transitMap.get(r.codigoCliente) ?? 0) : "",
          ]);
          row.height = 16;
          row.eachCell(cell => {
            cell.font = { size: 9, color: { argb: fg } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
            cell.alignment = { vertical: "middle" };
          });
        });
      };

      addRows(ruta,        "Visitado",         "FFFFFFFF", "FF1F2937");
      addRows(invalidos,   "Checkin inválido", "FFFFFBEB", "FF92400E");
      addRows(noVisitados, "Sin visita",       "FFFEF2F2", "FF991B1B");

      // Filas de totales y promedios
      ws.addRow([]);
      const totRow = ws.addRow(["", "", "", "", "", "Tiempo total en clientes", "", "", totalMin || "", ""]);
      totRow.font = { bold: true, size: 9 };
      const avgRow = ws.addRow(["", "", "", "", "", "Promedio por visita (min)", "", "", promedioMin ?? "", ""]);
      avgRow.font = { bold: true, size: 9 };
      const avgTransitRow = ws.addRow(["", "", "", "", "", "Promedio traslado (min)", "", "", "", avgTransitMin ?? ""]);
      avgTransitRow.font = { bold: true, size: 9 };

      // ── Hoja 2: Mapa ──────────────────────────────────────
      const mapSheet = wb.addWorksheet("Mapa");
      mapSheet.addRow([`Ruta de ${nombreVendedor} — ${fecha}`]).font = { bold: true, size: 12 };
      mapSheet.addRow([
        `Visitados: ${ruta.length}  |  Inválidos: ${invalidos.length}  |  Sin visita: ${noVisitados.length}`,
      ]);
      mapSheet.addRow([]);

      const MAP_W = 960, MAP_H = 560;
      const imageId = wb.addImage({ base64: mapBase64, extension: "png" });
      mapSheet.addImage(imageId, {
        tl: { col: 0, row: 3 },
        ext: { width: MAP_W, height: MAP_H },
      });
      for (let i = 4; i < 4 + Math.ceil(MAP_H / 15); i++) {
        mapSheet.getRow(i).height = 15;
      }

      // 3. Descargar
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `ruta_${nombreVendedor.replace(/\s+/g, "_")}_${fecha}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exportando:", err);
    } finally {
      setExporting(false);
    }
  }

  const { ruta, invalidos, noVisitados } = rows ? categorizarRows(rows) : { ruta: [], invalidos: [], noVisitados: [] };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ height: "84vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">{nombreVendedor}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Ruta del {fecha}
              {rows && (
                <span className="ml-2 space-x-2">
                  <span className="text-emerald-600 font-medium">{ruta.length} válidos</span>
                  {invalidos.length > 0 && <span className="text-amber-500 font-medium">{invalidos.length} inválidos</span>}
                  {noVisitados.length > 0 && <span className="text-red-500 font-medium">{noVisitados.length} sin visita</span>}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Leyenda */}
            {rows && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Válido</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-300 border-2 border-amber-400 inline-block" />Inválido</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-300 border-2 border-red-500 inline-block" />Sin visita</span>
                <span className="flex items-center gap-1"><span className="inline-block w-6 border-t-2 border-dashed border-indigo-400" />Ruta</span>
              </div>
            )}

            {/* Botón export */}
            {rows && rows.length > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
              >
                {exporting
                  ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Generando...</>
                  : <><Download className="w-3.5 h-3.5" /> Excel + Mapa</>
                }
              </button>
            )}

            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="flex items-center gap-2 text-red-600 text-sm"><AlertTriangle className="w-5 h-5" />{error}</div>
            </div>
          )}
          {!loading && !error && rows && rows.length === 0 && (
            <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400 text-sm">Sin clientes para mostrar</div>
          )}
          {!loading && !error && rows && rows.length > 0 && (
            <div className="grid grid-cols-5 h-full">
              <div className="col-span-3 h-full">
                <LeafletMap
                  rows={rows}
                  containerRef={mapContainerRef}
                  onRegisterPanTo={fn => { panToRef.current = fn; }}
                />
              </div>
              <div className="col-span-2 h-full overflow-hidden">
                <ClientesList
                  rows={rows}
                  onFocusCliente={codigo => panToRef.current?.(codigo)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
