import { describe, it, expect } from 'vitest';
import { pointInPolygon, getZonePoints } from './geo';
import type { LatLng } from '../types';

const CUADRADO: LatLng[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 10 },
  { lat: 10, lng: 10 },
  { lat: 10, lng: 0 },
];

describe('pointInPolygon', () => {
  it('detecta un punto adentro del polígono', () => {
    expect(pointInPolygon(5, 5, CUADRADO)).toBe(true);
  });

  it('detecta un punto afuera del polígono', () => {
    expect(pointInPolygon(20, 20, CUADRADO)).toBe(false);
  });

  it('detecta un punto afuera aunque comparta una coordenada con el polígono', () => {
    expect(pointInPolygon(5, 50, CUADRADO)).toBe(false);
  });

  it('devuelve false para un polígono vacío', () => {
    expect(pointInPolygon(5, 5, [])).toBe(false);
  });

  // Triángulo rectángulo (no alineado a ejes en su hipotenusa: lat+lng=10) para
  // ejercitar de verdad la aritmética del cruce de rayos (no solo casos donde el
  // borde diagonal coincide con los ejes, como en un cuadrado).
  const TRIANGULO: LatLng[] = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
    { lat: 10, lng: 0 },
  ];

  it('detecta un punto adentro contra un borde diagonal', () => {
    expect(pointInPolygon(2, 2, TRIANGULO)).toBe(true);
  });

  it('detecta un punto afuera del lado diagonal, aunque esté dentro del bounding box', () => {
    expect(pointInPolygon(8, 8, TRIANGULO)).toBe(false);
  });

  it('un punto justo sobre la hipotenusa cuenta como afuera (comparación estricta)', () => {
    expect(pointInPolygon(5, 5, TRIANGULO)).toBe(false);
  });
});

describe('getZonePoints', () => {
  it('filtra solo los puntos que caen dentro del polígono', () => {
    const pts = [
      { id: 'a', lat: 5, lng: 5 },
      { id: 'b', lat: 50, lng: 50 },
    ];

    expect(getZonePoints(pts, CUADRADO)).toEqual([{ id: 'a', lat: 5, lng: 5 }]);
  });

  it('devuelve [] si ningún punto cae adentro', () => {
    const pts = [{ id: 'a', lat: 50, lng: 50 }];
    expect(getZonePoints(pts, CUADRADO)).toEqual([]);
  });
});
