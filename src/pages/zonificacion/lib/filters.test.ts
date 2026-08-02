import { describe, it, expect } from 'vitest';
import {
  filterPdv, uniqueSorted, uniqueSortedFromList, uniqueArticulos, uniqueVendedores,
  describeCriterios, describeExcluidos, SIN_DATO, SIN_DATO_LABEL,
} from './filters';
import type { Filtros, Pdv, Criterios } from '../types';
import { FILTROS_VACIOS } from '../types';

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente Uno', dir: 'Calle 123', com: 'Almacén', loc: 'CABA', par: 'CABA',
    lat: 0, lng: 0, desactivado: false, vnd_cod: 'V1', vnd_nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A',
    vendedores: [{ cod: 'V1', nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A' }],
    facturacion: 0, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

function filtros(overrides: Partial<Filtros> = {}): Filtros {
  return { ...FILTROS_VACIOS, ...overrides };
}

describe('filterPdv', () => {
  it('sin filtros, devuelve todo el universo', () => {
    const data = [pdv({ id: '1' }), pdv({ id: '2' })];
    expect(filterPdv(data, filtros())).toEqual(data);
  });

  it('filtra por comercio', () => {
    const data = [pdv({ id: '1', com: 'Almacén' }), pdv({ id: '2', com: 'Kiosco' })];
    expect(filterPdv(data, filtros({ comercio: ['Kiosco'] })).map((p) => p.id)).toEqual(['2']);
  });

  it('filtra por comercio null usando SIN_DATO', () => {
    const data = [pdv({ id: '1', com: null }), pdv({ id: '2', com: 'Kiosco' })];
    expect(filterPdv(data, filtros({ comercio: [SIN_DATO] })).map((p) => p.id)).toEqual(['1']);
  });

  it('filtra por partido', () => {
    const data = [pdv({ id: '1', par: 'CABA' }), pdv({ id: '2', par: 'La Plata' })];
    expect(filterPdv(data, filtros({ partido: ['La Plata'] })).map((p) => p.id)).toEqual(['2']);
  });

  it('filtra por frecuencia, incluyendo SIN_DATO cuando frq es null', () => {
    const data = [pdv({ id: '1', frq: null }), pdv({ id: '2', frq: 'Semanal' })];
    expect(filterPdv(data, filtros({ frecuencia: [SIN_DATO] })).map((p) => p.id)).toEqual(['1']);
  });

  it('busca por nombre o dirección, sin importar mayúsculas/minúsculas', () => {
    const data = [pdv({ id: '1', n: 'Kiosco Norte' }), pdv({ id: '2', n: 'Almacén Sur', dir: 'Norte 456' })];
    expect(filterPdv(data, filtros({ search: 'NORTE' })).map((p) => p.id)).toEqual(['1', '2']);
  });

  it('filtra por día', () => {
    const data = [pdv({ id: '1', dia: 1 }), pdv({ id: '2', dia: 2 })];
    expect(filterPdv(data, filtros({ dia: ['2'] })).map((p) => p.id)).toEqual(['2']);
  });

  it('filtra por dia null usando SIN_DATO ("0")', () => {
    const data = [pdv({ id: '1', dia: null }), pdv({ id: '2', dia: 2 })];
    expect(filterPdv(data, filtros({ dia: ['0'] })).map((p) => p.id)).toEqual(['1']);
  });

  it('filtra por vendedor: matchea si cualquiera de las asignaciones coincide', () => {
    const data = [
      pdv({ id: '1', vendedores: [{ cod: 'V1', nombre: 'A', dia: 1, frq: 'SE', reparto: 'R' }, { cod: 'V2', nombre: 'B', dia: 1, frq: 'SE', reparto: 'R' }] }),
      pdv({ id: '2', vendedores: [{ cod: 'V3', nombre: 'C', dia: 1, frq: 'SE', reparto: 'R' }] }),
    ];
    expect(filterPdv(data, filtros({ vndCod: ['V2'] })).map((p) => p.id)).toEqual(['1']);
  });

  it('filtra por vendedor SIN_DATO si el cliente no tiene ninguna asignación', () => {
    const data = [pdv({ id: '1', vendedores: [] }), pdv({ id: '2' })];
    expect(filterPdv(data, filtros({ vndCod: [SIN_DATO] })).map((p) => p.id)).toEqual(['1']);
  });

  it('filtra por proveedor/división/línea/artículo comprado', () => {
    const data = [
      pdv({ id: '1', proveedores: ['Proveedor A'], divisiones: ['D1'], lineas: ['L1'], articulos: [{ id: 'ART1', nombre: 'Art 1' }] }),
      pdv({ id: '2', proveedores: ['Proveedor B'], divisiones: [], lineas: [], articulos: [] }),
    ];
    expect(filterPdv(data, filtros({ proveedor: ['Proveedor A'] })).map((p) => p.id)).toEqual(['1']);
    expect(filterPdv(data, filtros({ division: ['D1'] })).map((p) => p.id)).toEqual(['1']);
    expect(filterPdv(data, filtros({ linea: ['L1'] })).map((p) => p.id)).toEqual(['1']);
    expect(filterPdv(data, filtros({ articulo: ['ART1'] })).map((p) => p.id)).toEqual(['1']);
  });

  it('proveedor SIN_DATO matchea clientes que no compraron a ningún proveedor', () => {
    const data = [pdv({ id: '1', proveedores: [] }), pdv({ id: '2', proveedores: ['Proveedor A'] })];
    expect(filterPdv(data, filtros({ proveedor: [SIN_DATO] })).map((p) => p.id)).toEqual(['1']);
  });

  it('combina filtros con AND: debe cumplir todos los criterios activos', () => {
    const data = [
      pdv({ id: '1', com: 'Almacén', par: 'CABA' }),
      pdv({ id: '2', com: 'Almacén', par: 'La Plata' }),
      pdv({ id: '3', com: 'Kiosco', par: 'CABA' }),
    ];
    expect(filterPdv(data, filtros({ comercio: ['Almacén'], partido: ['CABA'] })).map((p) => p.id)).toEqual(['1']);
  });

  it('filtra por facturación mínima', () => {
    const data = [pdv({ id: '1', facturacion: 500 }), pdv({ id: '2', facturacion: 1500 })];
    expect(filterPdv(data, filtros({ facturacionMin: 1000 })).map((p) => p.id)).toEqual(['2']);
  });

  it('filtra por facturación máxima', () => {
    const data = [pdv({ id: '1', facturacion: 500 }), pdv({ id: '2', facturacion: 1500 })];
    expect(filterPdv(data, filtros({ facturacionMax: 1000 })).map((p) => p.id)).toEqual(['1']);
  });

  it('filtra por rango de facturación (min y max juntos), incluyendo los bordes', () => {
    const data = [
      pdv({ id: '1', facturacion: 0 }),
      pdv({ id: '2', facturacion: 100000 }),
      pdv({ id: '3', facturacion: 100001 }),
    ];
    expect(filterPdv(data, filtros({ facturacionMin: 0, facturacionMax: 100000 })).map((p) => p.id)).toEqual(['1', '2']);
  });

  it('sin facturacionMin/Max (null), no filtra por facturación', () => {
    const data = [pdv({ id: '1', facturacion: 0 }), pdv({ id: '2', facturacion: 999999 })];
    expect(filterPdv(data, filtros()).map((p) => p.id)).toEqual(['1', '2']);
  });
});

describe('uniqueSorted', () => {
  it('devuelve valores únicos y ordenados', () => {
    const data = [pdv({ com: 'Kiosco' }), pdv({ com: 'Almacén' }), pdv({ com: 'Kiosco' })];
    expect(uniqueSorted(data, 'com')).toEqual(['Almacén', 'Kiosco']);
  });

  it('antepone SIN_DATO si algún cliente no tiene valor', () => {
    const data = [pdv({ com: 'Kiosco' }), pdv({ com: null })];
    expect(uniqueSorted(data, 'com')).toEqual([SIN_DATO, 'Kiosco']);
  });

  it('no agrega SIN_DATO si todos tienen valor', () => {
    const data = [pdv({ com: 'Kiosco' })];
    expect(uniqueSorted(data, 'com')).toEqual(['Kiosco']);
  });
});

describe('uniqueSortedFromList', () => {
  it('junta y ordena los valores de todas las listas', () => {
    const data = [pdv({ proveedores: ['B', 'A'] }), pdv({ proveedores: ['A', 'C'] })];
    expect(uniqueSortedFromList(data, 'proveedores')).toEqual(['A', 'B', 'C']);
  });

  it('antepone SIN_DATO si algún cliente no compró a nadie', () => {
    const data = [pdv({ proveedores: ['A'] }), pdv({ proveedores: [] })];
    expect(uniqueSortedFromList(data, 'proveedores')).toEqual([SIN_DATO, 'A']);
  });
});

describe('uniqueArticulos', () => {
  it('devuelve artículos únicos ordenados por nombre', () => {
    const data = [
      pdv({ articulos: [{ id: 'A2', nombre: 'Zeta' }] }),
      pdv({ articulos: [{ id: 'A1', nombre: 'Alfa' }, { id: 'A2', nombre: 'Zeta' }] }),
    ];
    expect(uniqueArticulos(data)).toEqual([{ id: 'A1', nombre: 'Alfa' }, { id: 'A2', nombre: 'Zeta' }]);
  });

  it('antepone SIN_DATO si algún cliente no compró ningún artículo', () => {
    const data = [pdv({ articulos: [] })];
    expect(uniqueArticulos(data)).toEqual([{ id: SIN_DATO, nombre: SIN_DATO_LABEL }]);
  });
});

describe('uniqueVendedores', () => {
  it('devuelve vendedores únicos ordenados por código', () => {
    const data = [
      pdv({ vendedores: [{ cod: 'V2', nombre: 'B', dia: 1, frq: 'SE', reparto: 'R' }] }),
      pdv({ vendedores: [{ cod: 'V1', nombre: 'A', dia: 1, frq: 'SE', reparto: 'R' }, { cod: 'V2', nombre: 'B', dia: 1, frq: 'SE', reparto: 'R' }] }),
    ];
    expect(uniqueVendedores(data)).toEqual([{ cod: 'V1', nombre: 'A' }, { cod: 'V2', nombre: 'B' }]);
  });

  it('antepone SIN_DATO si algún cliente no tiene vendedor asignado', () => {
    const data = [pdv({ vendedores: [] })];
    expect(uniqueVendedores(data)).toEqual([{ cod: SIN_DATO, nombre: SIN_DATO_LABEL }]);
  });
});

describe('describeCriterios', () => {
  it('avisa que no hay datos de criterio si viene null', () => {
    expect(describeCriterios(null)).toEqual([{ label: '', value: 'Sin datos de criterio (zona creada antes de esta función)' }]);
  });

  it('avisa "sin filtros" si no hay ningún filtro activo', () => {
    const c: Criterios = { filtros: filtros(), excluidos: [] };
    expect(describeCriterios(c)).toEqual([{ label: '', value: 'Sin filtros (todo el universo)' }]);
  });

  it('describe la búsqueda si viene con texto', () => {
    const c: Criterios = { filtros: filtros({ search: '  norte  ' }), excluidos: [] };
    expect(describeCriterios(c)).toEqual([{ label: 'Búsqueda', value: '"norte"' }]);
  });

  it('describe un filtro de día traduciendo el número a nombre de día', () => {
    const c: Criterios = { filtros: filtros({ dia: ['1', '2'] }), excluidos: [] };
    expect(describeCriterios(c)).toEqual([{ label: 'Día visita', value: 'Lunes, Martes' }]);
  });

  it('describe el rango de facturación cuando min y max están seteados', () => {
    const c: Criterios = { filtros: filtros({ facturacionMin: 0, facturacionMax: 100000 }), excluidos: [] };
    expect(describeCriterios(c)).toEqual([{ label: 'Facturación', value: '0 – 100.000' }]);
  });

  it('describe el rango de facturación con "sin tope" si solo hay mínimo', () => {
    const c: Criterios = { filtros: filtros({ facturacionMin: 500 }), excluidos: [] };
    expect(describeCriterios(c)).toEqual([{ label: 'Facturación', value: '500 – sin tope' }]);
  });

  it('describe un filtro con SIN_DATO como "Sin dato"', () => {
    const c: Criterios = { filtros: filtros({ comercio: [SIN_DATO] }), excluidos: [] };
    expect(describeCriterios(c)).toEqual([{ label: 'Tipo PDV', value: SIN_DATO_LABEL }]);
  });

  it('lista varios filtros activos, uno por línea', () => {
    const c: Criterios = { filtros: filtros({ comercio: ['Almacén'], partido: ['CABA'] }), excluidos: [] };
    expect(describeCriterios(c)).toEqual([
      { label: 'Tipo PDV', value: 'Almacén' },
      { label: 'Partido', value: 'CABA' },
    ]);
  });
});

describe('describeExcluidos', () => {
  it('devuelve id y nombre de cada excluido, separados por coma', () => {
    const universo = [pdv({ id: '1', n: 'Cliente Uno' }), pdv({ id: '2', n: 'Cliente Dos' })];
    expect(describeExcluidos(['1', '2'], universo)).toBe('1 - Cliente Uno, 2 - Cliente Dos');
  });

  it('usa solo el id si el excluido no está en el universo', () => {
    expect(describeExcluidos(['NO-EXISTE'], [])).toBe('NO-EXISTE');
  });

  it('devuelve string vacío si no hay excluidos', () => {
    expect(describeExcluidos([], [])).toBe('');
  });
});
