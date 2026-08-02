import { describe, it, expect } from 'vitest';
import { getZoneStats, ptToRow, computeOverlaps } from './zoneStats';
import type { Pdv } from '../types';

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente Uno', dir: 'Calle 123', com: 'Almacén', loc: 'CABA', par: 'CABA',
    lat: -34.6, lng: -58.4, desactivado: false, vnd_cod: 'V1', vnd_nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A',
    vendedores: [{ cod: 'V1', nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A' }],
    facturacion: 1000, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

describe('getZoneStats', () => {
  it('cuenta el total de puntos y suma la facturación', () => {
    const pts = [pdv({ id: '1', facturacion: 1000 }), pdv({ id: '2', facturacion: 500 })];
    const stats = getZoneStats(pts, 'Zona Norte');
    expect(stats.Zona).toBe('Zona Norte');
    expect(stats.PDV_Total).toBe(2);
    expect(stats.Facturacion).toBe(1500);
  });

  it('cuenta vendedores distintos, no asignaciones repetidas', () => {
    const pts = [
      pdv({ id: '1', vendedores: [{ cod: 'V1', nombre: 'A', dia: 1, frq: 'SE', reparto: 'R' }] }),
      pdv({ id: '2', vendedores: [{ cod: 'V1', nombre: 'A', dia: 1, frq: 'SE', reparto: 'R' }, { cod: 'V2', nombre: 'B', dia: 1, frq: 'SE', reparto: 'R' }] }),
    ];
    expect(getZoneStats(pts, 'Z').Vendedores_Distintos).toBe(2);
  });

  it('distribuye por día de la semana, incluyendo sin día', () => {
    const pts = [
      pdv({ id: '1', dia: 1 }), pdv({ id: '2', dia: 1 }), pdv({ id: '3', dia: 7 }), pdv({ id: '4', dia: null }),
    ];
    const stats = getZoneStats(pts, 'Z');
    expect(stats.Lunes).toBe(2);
    expect(stats.Domingo).toBe(1);
    expect(stats.Sin_Dia).toBe(1);
    expect(stats.Martes).toBe(0);
  });

  it('con lista vacía, todos los contadores quedan en 0', () => {
    const stats = getZoneStats([], 'Vacía');
    expect(stats.PDV_Total).toBe(0);
    expect(stats.Facturacion).toBe(0);
    expect(stats.Vendedores_Distintos).toBe(0);
  });
});

describe('ptToRow', () => {
  it('arma una fila plana con vendedor predeterminado y todas las asignaciones', () => {
    const p = pdv({
      vendedores: [
        { cod: 'V1', nombre: 'Vendedor Uno', dia: 1, frq: 'SE', reparto: 'R' },
        { cod: 'V2', nombre: null, dia: 2, frq: 'QU', reparto: 'R2' },
      ],
      proveedores: ['Prov A'], divisiones: ['D1'], lineas: ['L1'], articulos: [{ id: 'A1', nombre: 'Art 1' }],
    });

    const row = ptToRow(p, 'Zona Norte');

    expect(row.Zona).toBe('Zona Norte');
    expect(row.Cuenta).toBe(p.id);
    expect(row.Vendedores).toBe('Vendedor Uno (V1) | V2 (V2)');
    expect(row.Proveedores).toBe('Prov A');
    expect(row.Divisiones).toBe('D1');
    expect(row.Lineas).toBe('L1');
    expect(row.Articulos).toBe('Art 1');
    expect(row.Dia_Visita).toBe('Lunes');
  });

  it('usa el código de vendedor como fallback si no tiene nombre', () => {
    const p = pdv({ vendedores: [{ cod: 'V9', nombre: null, dia: 1, frq: 'SE', reparto: 'R' }] });
    expect(ptToRow(p, 'Z').Vendedores).toBe('V9 (V9)');
  });
});

describe('computeOverlaps', () => {
  it('detecta un PDV que aparece en más de una zona', () => {
    const p = pdv({ id: '1' });
    const overlaps = computeOverlaps([
      { nombre: 'Zona A', pts: [p] },
      { nombre: 'Zona B', pts: [p] },
    ]);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toMatchObject({ Cuenta: '1', Cantidad_Zonas: 2, Zonas: 'Zona A | Zona B' });
  });

  it('no incluye PDV que están en una sola zona', () => {
    const overlaps = computeOverlaps([
      { nombre: 'Zona A', pts: [pdv({ id: '1' })] },
      { nombre: 'Zona B', pts: [pdv({ id: '2' })] },
    ]);

    expect(overlaps).toEqual([]);
  });

  it('usa vnd_nombre, con fallback a vnd_cod', () => {
    const overlaps = computeOverlaps([
      { nombre: 'A', pts: [pdv({ id: '1', vnd_nombre: null, vnd_cod: 'V1' })] },
      { nombre: 'B', pts: [pdv({ id: '1', vnd_nombre: null, vnd_cod: 'V1' })] },
    ]);

    expect(overlaps[0].Vendedor).toBe('V1');
  });
});
