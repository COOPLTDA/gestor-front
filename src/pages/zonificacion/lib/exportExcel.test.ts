import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { exportExcel, autoWidth, makeUniqueSheetNamer } from './exportExcel';
import type { Pdv, Zona, Filtros } from '../types';
import { FILTROS_VACIOS } from '../types';

const RANGO = { desde: '2025-07-28', hasta: '2026-07-28' };

describe('autoWidth', () => {
  it('usa el ancho del valor más largo entre los datos y la propia clave', () => {
    const ws: XLSX.WorkSheet = {};
    autoWidth(ws, [{ nombre: 'Ana' }, { nombre: 'Un Nombre Muy Largo' }], ['nombre']);
    expect(ws['!cols']![0].wch).toBe('Un Nombre Muy Largo'.length + 2);
  });

  it('usa el largo de la clave si es más largo que todos los valores', () => {
    const ws: XLSX.WorkSheet = {};
    autoWidth(ws, [{ ab: 'x' }], ['ab']);
    expect(ws['!cols']![0].wch).toBe('ab'.length + 2);
  });

  it('trata null/undefined como string vacío al medir el ancho', () => {
    const ws: XLSX.WorkSheet = {};
    autoWidth(ws, [{ campo: null }], ['campo']);
    expect(ws['!cols']![0].wch).toBe('campo'.length + 2);
  });

  it('nunca supera 40 de ancho, aunque el valor sea más largo', () => {
    const ws: XLSX.WorkSheet = {};
    autoWidth(ws, [{ campo: 'x'.repeat(100) }], ['campo']);
    expect(ws['!cols']![0].wch).toBe(40);
  });

  it('calcula un ancho por cada clave, en el orden pedido', () => {
    const ws: XLSX.WorkSheet = {};
    autoWidth(ws, [{ a: 'xx', b: 'xxxxx' }], ['a', 'b']);
    expect(ws['!cols']!.map((c) => c.wch)).toEqual(['a'.length + 2 > 4 ? 'a'.length + 2 : 4, 'xxxxx'.length + 2]);
  });
});

describe('makeUniqueSheetNamer', () => {
  it('devuelve el nombre tal cual la primera vez', () => {
    const namer = makeUniqueSheetNamer();
    expect(namer('Zona Norte')).toBe('Zona Norte');
  });

  it('agrega sufijo _2 la segunda vez que se pide el mismo nombre', () => {
    const namer = makeUniqueSheetNamer();
    namer('Zona A');
    expect(namer('Zona A')).toBe('Zona A_2');
  });

  it('sigue incrementando el sufijo en repeticiones sucesivas', () => {
    const namer = makeUniqueSheetNamer();
    namer('Zona A');
    namer('Zona A');
    expect(namer('Zona A')).toBe('Zona A_3');
  });

  it('recorta a 31 caracteres (límite de Excel para nombres de hoja)', () => {
    const namer = makeUniqueSheetNamer();
    const nombreLargo = 'Zona con un nombre demasiado largo para Excel';
    expect(namer(nombreLargo).length).toBeLessThanOrEqual(31);
  });

  it('al truncar y colisionar, el sufijo se agrega dejando lugar (no supera 31)', () => {
    const namer = makeUniqueSheetNamer();
    const base = 'x'.repeat(31);
    namer(base); // ocupa 'xxxx...x' (31 x's)
    const segundo = namer(base);
    expect(segundo.length).toBeLessThanOrEqual(31);
    expect(segundo.endsWith('_2')).toBe(true);
  });

  it('elimina caracteres inválidos para nombres de hoja de Excel', () => {
    const namer = makeUniqueSheetNamer();
    expect(namer('Zona/Norte:Este*Oeste?[1]')).toBe('ZonaNorteEsteOeste1');
  });

  it('instancias distintas del namer no comparten estado', () => {
    const namer1 = makeUniqueSheetNamer();
    const namer2 = makeUniqueSheetNamer();
    namer1('Zona A');
    expect(namer2('Zona A')).toBe('Zona A');
  });
});

const writeFileMock = vi.fn();

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return { ...actual, writeFile: (...args: unknown[]) => writeFileMock(...args) };
});

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente Uno', dir: 'Calle 123', com: 'Almacén', loc: 'CABA', par: 'CABA',
    lat: -34.6, lng: -58.4, desactivado: false, vnd_cod: 'V1', vnd_nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A',
    vendedores: [{ cod: 'V1', nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A' }],
    facturacion: 1000, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

function zona(overrides: Partial<Zona> = {}): Zona {
  return {
    nombre: 'Zona Norte', color: '#000',
    vertices: [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }],
    criterios: null,
    ...overrides,
  };
}

// header: 1 => filas crudas (array de arrays), evita depender de si la fila 1
// tiene los nombres de propiedad (json_to_sheet) o el encabezado legible
// pisado con sheet_add_aoa/aoa_to_sheet.
function rawRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 }) as unknown[][];
}

function namedRows(wb: XLSX.WorkBook, name: string) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name]) as Record<string, unknown>[];
}

describe('exportExcel', () => {
  let capturedWb: XLSX.WorkBook | null;

  beforeEach(() => {
    capturedWb = null;
    writeFileMock.mockReset().mockImplementation((wb: unknown) => {
      capturedWb = wb as XLSX.WorkBook;
    });
  });

  it('tira un error si no hay zonas dibujadas', () => {
    expect(() => exportExcel({ zonas: [], currentData: [], allData: [], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO })).toThrow('No hay zonas dibujadas.');
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('arma una hoja Resumen con los totales de PDV y facturación', () => {
    const dentro = pdv({ id: '1', lat: 5, lng: 5, facturacion: 1000, dia: 1 });
    const fuera = pdv({ id: '2', lat: 50, lng: 50 });
    const z = zona();

    const fname = exportExcel({ zonas: [z], currentData: [dentro, fuera], allData: [dentro, fuera], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    expect(fname).toMatch(/^UniversoEnro_Zonas_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(capturedWb).not.toBeNull();
    // fila 0: encabezado legible (pisado con sheet_add_aoa); filas 1 y 2: datos.
    const rows = rawRows(capturedWb!, 'Resumen');
    expect(rows[0]).toEqual(['Zona', 'PDV Total', 'Vendedores Distintos', 'Facturación (28/07/2025–28/07/2026)', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Sin día']);
    expect(rows[1][0]).toBe('Zona Norte');
    expect(rows[1][1]).toBe(1); // PDV_Total
    expect(rows[1][4]).toBe(1); // Lunes
    expect(rows[2][0]).toBe('TOTAL');
    expect(rows[2][1]).toBe(1); // PDV_Total
    expect(rows[2][3]).toBe(1000); // Facturacion
  });

  it('suma los totales de todas las zonas en la fila TOTAL, columna por columna', () => {
    // Un punto por cada día de la semana (+ sin día), repartidos en dos zonas, para
    // que la suma (en vez de la resta que probaría un mutante) sea la única lectura
    // consistente en las 8 columnas de día a la vez.
    const puntos = [
      pdv({ id: '1', lat: 5, lng: 5, facturacion: 100, dia: 1 }),
      pdv({ id: '2', lat: 5, lng: 5, facturacion: 200, dia: 4 }),
      pdv({ id: '3', lat: 5, lng: 5, facturacion: 50, dia: 5 }),
      pdv({ id: '4', lat: 5, lng: 5, facturacion: 25, dia: 6 }),
      pdv({ id: '5', lat: 25, lng: 25, facturacion: 300, dia: 2 }),
      pdv({ id: '6', lat: 25, lng: 25, facturacion: 10, dia: 7 }),
      pdv({ id: '7', lat: 25, lng: 25, facturacion: 5, dia: null }),
      pdv({ id: '8', lat: 5, lng: 5, facturacion: 1, dia: 3 }),
    ];
    const zonaA = zona({ nombre: 'A', vertices: [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }] });
    const zonaB = zona({ nombre: 'B', vertices: [{ lat: 20, lng: 20 }, { lat: 20, lng: 30 }, { lat: 30, lng: 30 }, { lat: 30, lng: 20 }] });

    exportExcel({ zonas: [zonaA, zonaB], currentData: puntos, allData: puntos, filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    const rows = rawRows(capturedWb!, 'Resumen');
    const total = rows[3]; // fila 0 header, 1 zona A, 2 zona B, 3 TOTAL
    expect(total[0]).toBe('TOTAL');
    expect(total[1]).toBe(8); // PDV_Total
    expect(total[2]).toBe(''); // Vendedores_Distintos no se totaliza
    expect(total[3]).toBe(691); // Facturacion
    expect(total[4]).toBe(1); // Lunes
    expect(total[5]).toBe(1); // Martes
    expect(total[6]).toBe(1); // Miercoles
    expect(total[7]).toBe(1); // Jueves
    expect(total[8]).toBe(1); // Viernes
    expect(total[9]).toBe(1); // Sabado
    expect(total[10]).toBe(1); // Domingo
    expect(total[11]).toBe(1); // Sin_Dia
  });

  it('crea una hoja por zona con los puntos que caen adentro', () => {
    const dentro = pdv({ id: '1', lat: 5, lng: 5 });
    const z = zona({ nombre: 'Zona Norte' });

    exportExcel({ zonas: [z], currentData: [dentro], allData: [dentro], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    expect(capturedWb!.SheetNames).toContain('Zona Norte');
    const rows = namedRows(capturedWb!, 'Zona Norte');
    expect(rows).toHaveLength(1);
    expect(rows[0].Cuenta).toBe('1');
  });

  it('avisa "sin puntos" en la hoja de una zona vacía en vez de omitirla', () => {
    const z = zona({ nombre: 'Zona Vacía' });

    exportExcel({ zonas: [z], currentData: [], allData: [], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    expect(capturedWb!.SheetNames).toContain('Zona Vacía');
    const rows = rawRows(capturedWb!, 'Zona Vacía');
    expect(rows).toEqual([['Sin puntos en esta zona con el filtro actual']]);
  });

  it('desambigua nombres de zona repetidos con sufijo _2', () => {
    const z1 = zona({ nombre: 'Zona A' });
    const z2 = zona({ nombre: 'Zona A' });

    exportExcel({ zonas: [z1, z2], currentData: [], allData: [], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    expect(capturedWb!.SheetNames).toEqual(expect.arrayContaining(['Zona A', 'Zona A_2']));
  });

  it('agrega una hoja "Sin Zona" con los PDV que no caen en ninguna zona dibujada', () => {
    const dentro = pdv({ id: '1', lat: 5, lng: 5 });
    const fuera = pdv({ id: '2', lat: 50, lng: 50 });
    const z = zona();

    exportExcel({ zonas: [z], currentData: [dentro, fuera], allData: [dentro, fuera], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    expect(capturedWb!.SheetNames).toContain('Sin Zona');
    const rows = namedRows(capturedWb!, 'Sin Zona');
    expect(rows.map((r) => r.Cuenta)).toEqual(['2']);
    expect(rows[0].Zona).toBe('(Sin zona)');
  });

  it('no agrega la hoja "Sin Zona" si todos los PDV están asignados', () => {
    const dentro = pdv({ id: '1', lat: 5, lng: 5 });
    const z = zona();

    exportExcel({ zonas: [z], currentData: [dentro], allData: [dentro], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    expect(capturedWb!.SheetNames).not.toContain('Sin Zona');
  });

  it('arma la hoja de Polígonos con el vértice de cierre repetido', () => {
    const z = zona({ vertices: [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }] });

    exportExcel({ zonas: [z], currentData: [], allData: [], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    const rows = rawRows(capturedWb!, 'Polígonos');
    // fila 0: encabezado; luego 3 vértices + cierre (repite el primero) + WKT + KML + separador = 7 filas de datos
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual(['Zona', 'Vértice', 'Nota', 'Latitud', 'Longitud', 'WKT / KML', 'Google Maps (lat,lng)']);
    expect(capturedWb!.Sheets['Polígonos']['!cols']).toEqual([{ wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 60 }, { wch: 22 }]);
    // columnas: Zona, Vertice, Cierre, Latitud, Longitud, WKT_Punto, Google_Maps
    expect(rows[1]).toEqual(['Zona Norte', 1, '', 0, 0, 'POINT(0 0)', '0,0']);
    expect(rows[2]).toEqual(['Zona Norte', 2, '', 0, 10, 'POINT(10 0)', '0,10']);
    expect(rows[3]).toEqual(['Zona Norte', 3, '', 10, 10, 'POINT(10 10)', '10,10']);
    expect(rows[4]).toEqual(['Zona Norte', 1, '(cierre)', 0, 0, 'POINT(0 0)', '0,0']);
    expect(rows[5]).toEqual(['Zona Norte', '', '', '', '', 'POLYGON((0 0, 10 0, 10 10, 0 0))', '← WKT completo del polígono']);
    expect(rows[6]).toEqual(['Zona Norte', '', '', '', '', '0,0,0 10,0,0 10,10,0 0,0,0', '← Coordenadas KML (lng,lat,0)']);
    expect(rows[7]).toEqual(['', '', '', '', '', '', '']);
  });

  it('reporta "sin solapamientos" si ningún PDV cae en más de una zona', () => {
    const z1 = zona({ nombre: 'Zona A' });

    exportExcel({ zonas: [z1], currentData: [], allData: [], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    expect(capturedWb!.SheetNames).toContain('Solapamientos');
    expect(rawRows(capturedWb!, 'Solapamientos')).toEqual([
      ['✅ Sin solapamientos'],
      ['Ningún cliente quedó incluido en más de una zona.'],
    ]);
    expect(capturedWb!.Sheets['Solapamientos']['!cols']).toEqual([{ wch: 55 }]);
  });

  it('reporta los solapamientos cuando un PDV cae en más de una zona', () => {
    const p = pdv({ id: '1', lat: 5, lng: 5 });
    const z1 = zona({ nombre: 'Zona A' });
    const z2 = zona({ nombre: 'Zona B' });

    exportExcel({ zonas: [z1, z2], currentData: [p], allData: [p], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    expect(capturedWb!.SheetNames).toContain('⚠ Solapamientos (1)');
    const rows = rawRows(capturedWb!, '⚠ Solapamientos (1)');
    expect(rows[0]).toEqual(['Cuenta', 'Nombre', 'Dirección', 'Localidad', 'Partido', 'Rubro', 'Vendedor', 'Facturación (28/07/2025–28/07/2026)', 'Cant. Zonas', 'Zonas que lo contienen', 'Latitud', 'Longitud']);
    // columnas: Cuenta, Nombre, Direccion, Localidad, Partido, Rubro, Vendedor, Facturacion, Cantidad_Zonas, Zonas, Latitud, Longitud
    expect(rows[1][8]).toBe(2);
  });

  it('la hoja Info documenta totales de universo, filtro activo y excluidos a mano', () => {
    const p1 = pdv({ id: '1' });
    const p2 = pdv({ id: '2' });
    const excluido = pdv({ id: '3', n: 'Excluido Uno' });
    const filtrosConAlgo: Filtros = { ...FILTROS_VACIOS, comercio: ['Almacén'] };

    exportExcel({ zonas: [zona()], currentData: [p1], allData: [p1, p2], filtros: filtrosConAlgo, excluidos: [excluido], rangoVentas: RANGO });

    const rows = rawRows(capturedWb!, 'Info') as [string, string][];
    // "PDV excluidos a mano" aparece dos veces: el total (primera fila) y el título
    // de la sección de detalle (fila vacía) — por eso se busca la primera ocurrencia.
    const find = (label: string) => rows.find((r) => r[0] === label)?.[1];
    expect(find('Archivo')).toBe('Universo Enro – Mapa de Zonas');
    expect(find('Exportado')).toMatch(/^\d{2}\/\d{2}\/\d{4},?\s\d{2}:\d{2}/);
    expect(find('Total PDV universo')).toBe('2');
    expect(find('PDV con filtro activo')).toBe('1');
    expect(find('Zonas definidas')).toBe('1');
    expect(find('PDV excluidos a mano')).toBe('1');
    expect(find('Tipo PDV')).toBe('Almacén'); // describeCriterios del filtro "comercio"
    expect(rows.some((r) => r[0] === '3' && r[1] === 'Excluido Uno')).toBe(true);

    // Filas exactas de separadores y títulos de sección (no solo su contenido "con algo").
    const idxFiltrosTitulo = rows.findIndex((r) => r[0] === 'Filtros aplicados');
    expect(rows[idxFiltrosTitulo - 1]).toEqual(['', '']);
    expect(rows[idxFiltrosTitulo]).toEqual(['Filtros aplicados', '']);
    const idxExcluidosTitulo = rows.findIndex((r, i) => r[0] === 'PDV excluidos a mano' && i > idxFiltrosTitulo);
    expect(rows[idxExcluidosTitulo - 1]).toEqual(['', '']);
    expect(rows[idxExcluidosTitulo]).toEqual(['PDV excluidos a mano', '']);
    expect(capturedWb!.Sheets['Info']['!cols']).toEqual([{ wch: 25 }, { wch: 40 }]);
  });

  it('sin filtros activos, la fila de filtros usa el label fijo "Filtros"', () => {
    const p1 = pdv({ id: '1' });
    exportExcel({ zonas: [zona()], currentData: [p1], allData: [p1], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    const rows = rawRows(capturedWb!, 'Info') as [string, string][];
    expect(rows.some((r) => r[0] === 'Filtros' && r[1] === 'Sin filtros (todo el universo)')).toBe(true);
  });

  it('la hoja Info no incluye la sección de detalle de excluidos si no hay ninguno', () => {
    const p1 = pdv({ id: '1' });
    exportExcel({ zonas: [zona()], currentData: [p1], allData: [p1], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    const rows = rawRows(capturedWb!, 'Info') as [string, string][];
    expect(rows.filter((r) => r[0] === 'PDV excluidos a mano')).toHaveLength(1); // solo el total, sin la sección de detalle
  });

  it('estiliza el encabezado y las filas de Solapamientos alternando color por paridad', () => {
    const p1 = pdv({ id: '1', lat: 5, lng: 5 });
    const p2 = pdv({ id: '2', lat: 5, lng: 5 });
    const z1 = zona({ nombre: 'A' });
    const z2 = zona({ nombre: 'B' });

    exportExcel({ zonas: [z1, z2], currentData: [p1, p2], allData: [p1, p2], filtros: FILTROS_VACIOS, excluidos: [], rangoVentas: RANGO });

    const ws = capturedWb!.Sheets['⚠ Solapamientos (2)'];
    // fila de encabezado (r=0): fondo rojo, texto blanco y en negrita
    const header = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
    expect(header.s).toEqual({
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'C62828' } },
      alignment: { horizontal: 'center' },
      border: { bottom: { style: 'medium', color: { rgb: 'FF8F00' } } },
    });
    // ninguna celda más allá de la última columna real (nCols=12) queda escrita
    expect(ws[XLSX.utils.encode_cell({ r: 0, c: 12 })]).toBeUndefined();

    // primera fila de datos (R=1, impar -> el otro color)
    const fila1 = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    expect(fila1.s.fill.fgColor.rgb).toBe('FFE082');
    expect(fila1.s.border).toEqual({ bottom: { style: 'thin', color: { rgb: 'E5E7EB' } } });
    // segunda fila de datos (R=2, par -> el otro color de la alternancia)
    const fila2 = ws[XLSX.utils.encode_cell({ r: 2, c: 0 })];
    expect(fila2.s.fill.fgColor.rgb).toBe('FFF3CD');
    // columna 8 (Cantidad_Zonas) se resalta en rojo y negrita y centrada, el resto no
    const colCantidad = ws[XLSX.utils.encode_cell({ r: 1, c: 8 })];
    const colOtra = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    expect(colCantidad.s.font.color.rgb).toBe('C62828');
    expect(colCantidad.s.font.bold).toBe(true);
    expect(colCantidad.s.alignment.horizontal).toBe('center');
    expect(colOtra.s.font.color.rgb).toBe('1A1A1A');
    expect(colOtra.s.font.bold).toBe(false);
    expect(colOtra.s.alignment.horizontal).toBe('left');
  });
});
