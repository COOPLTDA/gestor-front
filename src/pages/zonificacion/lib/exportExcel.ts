import * as XLSX from 'xlsx';
import type { RangoVentas } from '@/services/zonificacionApi';
import type { Filtros, Pdv, Zona } from '../types';
import { describeCriterios } from './filters';
import { getZonePoints } from './geo';
import { formatRangoVentas } from './rangoVentas';
import { computeOverlaps, getZoneStats, ptToRow } from './zoneStats';

// Port de exportExcel() de mapa_universo_enro.html (líneas 753-966).
// autoWidth se porta porque sí se usa; styleHeader/styleDataRows NO se portan:
// estaban definidas en el original pero nunca se llamaban (código muerto) — la única
// hoja con estilo real aplicado es "Solapamientos", con estilos inline propios.

export function autoWidth(ws: XLSX.WorkSheet, data: object[], keys: string[]) {
  const rows = data as Record<string, unknown>[];
  const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)));
  ws['!cols'] = widths.map((w) => ({ wch: Math.min(w + 2, 40) }));
}

export function makeUniqueSheetNamer() {
  const used = new Set<string>();
  return function uniqueSheetName(base: string) {
    const sanitize = (s: string) => s.replace(/[\\/:*?[\]]/g, '');
    const name = sanitize(base).substring(0, 31);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    let i = 2;
    while (true) {
      const suffix = '_' + i;
      const candidate = sanitize(base).substring(0, 31 - suffix.length) + suffix;
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
      i++;
    }
  };
}

interface ExportExcelParams {
  zonas: Zona[];
  currentData: Pdv[];
  allData: Pdv[];
  filtros: Filtros;
  /** PDV sacados a mano desde el cartelito ("Excluir PDV") — no están en currentData; se documentan acá para que se entienda por qué el total no cierra. */
  excluidos: Pdv[];
  rangoVentas: RangoVentas;
}

export function exportExcel({ zonas, currentData, allData, filtros, excluidos, rangoVentas }: ExportExcelParams): string {
  if (!zonas.length) throw new Error('No hay zonas dibujadas.');

  const wb = XLSX.utils.book_new();
  const now = new Date();
  const dateStr = now.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const facturacionLabel = `Facturación (${formatRangoVentas(rangoVentas)})`;

  const zonasConPuntos = zonas.map((z) => ({ zona: z, pts: getZonePoints(currentData, z.vertices) }));

  // 1. Resumen
  const summaryRows = zonasConPuntos.map(({ zona, pts }) => getZoneStats(pts, zona.nombre));
  const totals = {
    Zona: 'TOTAL',
    PDV_Total: summaryRows.reduce((a, r) => a + r.PDV_Total, 0),
    Vendedores_Distintos: '',
    Facturacion: summaryRows.reduce((a, r) => a + r.Facturacion, 0),
    Lunes: summaryRows.reduce((a, r) => a + r.Lunes, 0),
    Martes: summaryRows.reduce((a, r) => a + r.Martes, 0),
    Miercoles: summaryRows.reduce((a, r) => a + r.Miercoles, 0),
    Jueves: summaryRows.reduce((a, r) => a + r.Jueves, 0),
    Viernes: summaryRows.reduce((a, r) => a + r.Viernes, 0),
    Sabado: summaryRows.reduce((a, r) => a + r.Sabado, 0),
    Domingo: summaryRows.reduce((a, r) => a + r.Domingo, 0),
    Sin_Dia: summaryRows.reduce((a, r) => a + r.Sin_Dia, 0),
  };
  const summaryData = [...summaryRows, totals];
  const wsRes = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.sheet_add_aoa(wsRes, [['Zona', 'PDV Total', 'Vendedores Distintos', facturacionLabel, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Sin día']], { origin: 'A1' });
  autoWidth(wsRes, summaryData, Object.keys(summaryData[0]));
  XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

  // 2. Una hoja por zona
  const assignedIds = new Set<string>();
  const uniqueSheetName = makeUniqueSheetNamer();
  zonasConPuntos.forEach(({ zona, pts }) => {
    pts.forEach((p) => assignedIds.add(p.id));
    const rows = pts.map((p) => ptToRow(p, zona.nombre));
    const sheetName = uniqueSheetName(zona.nombre);
    if (!rows.length) {
      const ws = XLSX.utils.aoa_to_sheet([['Sin puntos en esta zona con el filtro actual']]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    autoWidth(ws, rows, Object.keys(rows[0]));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // 3. PDV sin zona
  const unassigned = currentData.filter((p) => !assignedIds.has(p.id)).map((p) => ptToRow(p, '(Sin zona)'));
  if (unassigned.length) {
    const wsU = XLSX.utils.json_to_sheet(unassigned);
    autoWidth(wsU, unassigned, Object.keys(unassigned[0]));
    XLSX.utils.book_append_sheet(wb, wsU, 'Sin Zona');
  }

  // 4. Polígonos
  const polyRows: Record<string, string | number>[] = [];
  zonas.forEach((z) => {
    const ring = [...z.vertices, z.vertices[0]];
    ring.forEach((ll, i) => {
      const lat = parseFloat(ll.lat.toFixed(6));
      const lng = parseFloat(ll.lng.toFixed(6));
      polyRows.push({
        Zona: z.nombre,
        Vertice: i < z.vertices.length ? i + 1 : 1,
        Cierre: i < z.vertices.length ? '' : '(cierre)',
        Latitud: lat,
        Longitud: lng,
        WKT_Punto: `POINT(${lng} ${lat})`,
        Google_Maps: `${lat},${lng}`,
      });
    });
    const wktCoords = ring.map((ll) => `${parseFloat(ll.lng.toFixed(6))} ${parseFloat(ll.lat.toFixed(6))}`).join(', ');
    polyRows.push({ Zona: z.nombre, Vertice: '', Cierre: '', Latitud: '', Longitud: '', WKT_Punto: `POLYGON((${wktCoords}))`, Google_Maps: '← WKT completo del polígono' });
    const kmlCoords = ring.map((ll) => `${parseFloat(ll.lng.toFixed(6))},${parseFloat(ll.lat.toFixed(6))},0`).join(' ');
    polyRows.push({ Zona: z.nombre, Vertice: '', Cierre: '', Latitud: '', Longitud: '', WKT_Punto: kmlCoords, Google_Maps: '← Coordenadas KML (lng,lat,0)' });
    polyRows.push({ Zona: '', Vertice: '', Cierre: '', Latitud: '', Longitud: '', WKT_Punto: '', Google_Maps: '' });
  });
  const wsPolyKeys = ['Zona', 'Vertice', 'Cierre', 'Latitud', 'Longitud', 'WKT_Punto', 'Google_Maps'];
  const wsPoly = XLSX.utils.json_to_sheet(polyRows, { header: wsPolyKeys });
  XLSX.utils.sheet_add_aoa(wsPoly, [['Zona', 'Vértice', 'Nota', 'Latitud', 'Longitud', 'WKT / KML', 'Google Maps (lat,lng)']], { origin: 'A1' });
  wsPoly['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 60 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsPoly, 'Polígonos');

  // 5. Solapamientos
  const overlapping = computeOverlaps(zonasConPuntos.map(({ zona, pts }) => ({ nombre: zona.nombre, pts })));

  if (overlapping.length > 0) {
    const wsOvl = XLSX.utils.json_to_sheet(overlapping);
    XLSX.utils.sheet_add_aoa(wsOvl, [['Cuenta', 'Nombre', 'Dirección', 'Localidad', 'Partido', 'Rubro', 'Vendedor', facturacionLabel, 'Cant. Zonas', 'Zonas que lo contienen', 'Latitud', 'Longitud']], { origin: 'A1' });
    autoWidth(wsOvl, overlapping, Object.keys(overlapping[0]));

    const nRows = overlapping.length;
    const nCols = 12;
    for (let R = 1; R <= nRows; R++) {
      for (let C = 0; C < nCols; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!wsOvl[addr]) continue;
        wsOvl[addr].s = {
          fill: { fgColor: { rgb: R % 2 === 0 ? 'FFF3CD' : 'FFE082' } },
          font: { color: { rgb: C === 8 ? 'C62828' : '1A1A1A' }, bold: C === 8 },
          border: { bottom: { style: 'thin', color: { rgb: 'E5E7EB' } } },
          alignment: { horizontal: C >= 8 ? 'center' : 'left' },
        };
      }
    }
    for (let C = 0; C < nCols; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!wsOvl[addr]) continue;
      wsOvl[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'C62828' } },
        alignment: { horizontal: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: 'FF8F00' } } },
      };
    }
    XLSX.utils.book_append_sheet(wb, wsOvl, `⚠ Solapamientos (${overlapping.length})`);
  } else {
    const wsOk = XLSX.utils.aoa_to_sheet([['✅ Sin solapamientos'], ['Ningún cliente quedó incluido en más de una zona.']]);
    wsOk['!cols'] = [{ wch: 55 }];
    XLSX.utils.book_append_sheet(wb, wsOk, 'Solapamientos');
  }

  // 6. Info
  const metaRows = [
    ['Archivo', 'Universo Enro – Mapa de Zonas'],
    ['Exportado', dateStr],
    ['Total PDV universo', String(allData.length)],
    ['PDV con filtro activo', String(currentData.length)],
    ['PDV excluidos a mano', String(excluidos.length)],
    ['Zonas definidas', String(zonas.length)],
    ['', ''],
    ['Filtros aplicados', ''],
    // Los 9 filtros + búsqueda, con la misma descripción legible que "Ver con qué
    // criterio se creó" en cada zona — antes solo se listaban 4 de los 9 a mano.
    ...describeCriterios({ filtros, excluidos: [] }).map((linea): [string, string] => [linea.label || 'Filtros', linea.value]),
  ];
  if (excluidos.length) {
    metaRows.push(['', '']);
    metaRows.push(['PDV excluidos a mano', '']);
    excluidos.forEach((p) => metaRows.push([p.id, p.n]));
  }
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  wsMeta['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Info');

  const fname = `UniversoEnro_Zonas_${now.toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  return fname;
}
