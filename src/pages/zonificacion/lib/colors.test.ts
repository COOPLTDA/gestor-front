import { describe, it, expect } from 'vitest';
import {
  diaColor, diaLabel, getVndCodColor, getRubroColor, getRepartoColor,
  getPointColor, nextZoneColor, isValidHexColor, ZONE_COLORS,
} from './colors';
import type { Pdv } from '../types';

describe('diaColor / diaLabel', () => {
  it('devuelve el color/label de un día válido', () => {
    expect(diaColor(1)).toBe('#a78bfa');
    expect(diaLabel(1)).toBe('Lunes');
  });

  it('trata null como "sin día" (0)', () => {
    expect(diaColor(null)).toBe(diaColor(0));
    expect(diaLabel(null)).toBe('Sin día');
  });

  it('devuelve el default si el día no está en la tabla', () => {
    expect(diaColor(99)).toBe('#6b7280');
    expect(diaLabel(99)).toBe('Sin día');
  });
});

describe('getVndCodColor / getRubroColor / getRepartoColor', () => {
  it('devuelve gris por defecto si el valor es null o vacío', () => {
    expect(getVndCodColor(null)).toBe('#6b7280');
    expect(getRubroColor(null)).toBe('#6b7280');
    expect(getRepartoColor(null)).toBe('#6b7280');
  });

  it('es estable: el mismo código siempre devuelve el mismo color', () => {
    const a1 = getVndCodColor('VND-COLORS-TEST-A');
    const a2 = getVndCodColor('VND-COLORS-TEST-A');
    expect(a1).toBe(a2);
  });

  it('asigna colores distintos a códigos distintos', () => {
    const a = getVndCodColor('VND-COLORS-TEST-B1');
    const b = getVndCodColor('VND-COLORS-TEST-B2');
    expect(a).not.toBe(b);
  });

  it('cada función mantiene su propia asignación (namespaces separados)', () => {
    const vnd = getVndCodColor('MISMO-CODIGO-COLORS-TEST');
    const rubro = getRubroColor('MISMO-CODIGO-COLORS-TEST');
    const reparto = getRepartoColor('MISMO-CODIGO-COLORS-TEST');
    // No se pide que sean distintos entre sí (pueden coincidir por índice), solo que
    // cada llamada posterior con el mismo código en la misma función sea estable.
    expect(getVndCodColor('MISMO-CODIGO-COLORS-TEST')).toBe(vnd);
    expect(getRubroColor('MISMO-CODIGO-COLORS-TEST')).toBe(rubro);
    expect(getRepartoColor('MISMO-CODIGO-COLORS-TEST')).toBe(reparto);
  });
});

function pdvBase(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente', dir: '', com: 'Almacén', loc: '', par: '',
    lat: 0, lng: 0, desactivado: false, vnd_cod: 'V1', vnd_nombre: 'Vendedor Uno', dia: 2, frq: 'Semanal', reparto: 'Reparto A',
    vendedores: [], facturacion: 0, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

describe('getPointColor', () => {
  it('usa diaColor para el esquema "dia"', () => {
    expect(getPointColor(pdvBase({ dia: 1 }), 'dia')).toBe(diaColor(1));
  });

  it('usa getVndCodColor para el esquema "vendedor"', () => {
    expect(getPointColor(pdvBase({ vnd_cod: 'VND-COLORS-TEST-C' }), 'vendedor')).toBe(getVndCodColor('VND-COLORS-TEST-C'));
  });

  it('usa getRepartoColor para el esquema "reparto"', () => {
    expect(getPointColor(pdvBase({ reparto: 'REPARTO-COLORS-TEST-C' }), 'reparto')).toBe(getRepartoColor('REPARTO-COLORS-TEST-C'));
  });

  it('usa getRubroColor para cualquier otro esquema (ej. "tipo")', () => {
    expect(getPointColor(pdvBase({ com: 'RUBRO-COLORS-TEST-C' }), 'tipo')).toBe(getRubroColor('RUBRO-COLORS-TEST-C'));
  });
});

describe('nextZoneColor', () => {
  it('devuelve el color en la posición pedida', () => {
    expect(nextZoneColor(0)).toBe(ZONE_COLORS[0]);
    expect(nextZoneColor(1)).toBe(ZONE_COLORS[1]);
  });

  it('da la vuelta (módulo) al superar el largo de la paleta', () => {
    expect(nextZoneColor(ZONE_COLORS.length)).toBe(ZONE_COLORS[0]);
    expect(nextZoneColor(ZONE_COLORS.length + 2)).toBe(ZONE_COLORS[2]);
  });
});

describe('isValidHexColor', () => {
  it('acepta hex de 3 y 6 dígitos', () => {
    expect(isValidHexColor('#fff')).toBe(true);
    expect(isValidHexColor('#ffffff')).toBe(true);
  });

  it('acepta hex de 8 dígitos (con alpha)', () => {
    expect(isValidHexColor('#ffffffff')).toBe(true);
  });

  it('rechaza valores que no son hex válido', () => {
    expect(isValidHexColor('red')).toBe(false);
    expect(isValidHexColor('#ggg')).toBe(false);
    expect(isValidHexColor('#ff')).toBe(false);
    expect(isValidHexColor('fff')).toBe(false);
  });
});
