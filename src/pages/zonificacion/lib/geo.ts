import type { LatLng } from '../types';

// Port de pointInPoly/getZonePoints de mapa_universo_enro.html, sobre vértices planos
// en vez de layers de Leaflet — así lo puede usar tanto el mapa como la sidebar y el export.

export function pointInPolygon(lat: number, lng: number, vertices: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].lat, yi = vertices[i].lng;
    const xj = vertices[j].lat, yj = vertices[j].lng;
    if (yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function getZonePoints<P extends { lat: number; lng: number }>(pts: P[], vertices: LatLng[]): P[] {
  return pts.filter((p) => pointInPolygon(p.lat, p.lng, vertices));
}
