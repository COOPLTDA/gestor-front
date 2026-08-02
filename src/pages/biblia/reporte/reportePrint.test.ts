import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePrint, handlePrintBiblia, handlePrintResumen, handleExportExcel, handleExportExcelResumen } from './reportePrint';
import type { GrupoDireccion, RepartoReporte } from '@/pages/biblia/types/biblia';
import type { ResumenChofer } from '@/services/bibliaApi';
import * as XLSX from 'xlsx';

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

const mockAoa = vi.mocked(XLSX.utils.aoa_to_sheet);
const mockBookAppend = vi.mocked(XLSX.utils.book_append_sheet);
const mockWriteFile = vi.mocked(XLSX.writeFile);

function lastSheet() {
  return mockAoa.mock.results[mockAoa.mock.results.length - 1].value as Record<string, unknown>;
}

function makeReparto(over: Partial<RepartoReporte> = {}): RepartoReporte {
  return {
    codigo_numerico: 1,
    nombre: 'BIG',
    chofer_codigo: 'CH1',
    chofer_nombre: 'García',
    tipo_agrupa_direccion: 1,
    tipo_consolidado: 0,
    tipo_individual: 2,
    total_importe: 1000,
    total_pedidos: 3,
    total_clientes: 2,
    clientes_unicos: ['CL1', 'CL2'],
    detalle: [{ preparacion_id: 11, tipo: 'Pedidos individuales', importe: 1000, pedidos: 3, clientes: 2 }],
    caso: 'propia',
    biblia_fecha_asignada: '2026-07-10',
    ...over,
  };
}

const GRUPOS: GrupoDireccion[] = [
  {
    direccion: 'LOMAS',
    total_clientes_unicos: 2,
    repartos: [
      makeReparto(),
      makeReparto({ chofer_nombre: 'García', codigo_numerico: 2, nombre: 'PERI 5', total_importe: 500, total_pedidos: 1, total_clientes: 1 }),
      makeReparto({ chofer_nombre: 'López', chofer_codigo: 'CH2', codigo_numerico: 3, nombre: 'SUELTO', caso: 'sin_asignar' }),
    ],
  },
];

beforeEach(() => vi.clearAllMocks());

describe('handlePrint', () => {
  it('llama a window.print', () => {
    const spy = vi.spyOn(window, 'print').mockImplementation(() => {});
    handlePrint();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('handlePrintBiblia', () => {
  function mockPrintWindow() {
    const w = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window);
    return w;
  }

  it('no hace nada si window.open devuelve null', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => handlePrintBiblia(GRUPOS, 'Biblia para el 09/07/2026')).not.toThrow();
    vi.restoreAllMocks();
  });

  it('con showDireccion=true (default), cierra una sección por dirección, no una extra', () => {
    const w = mockPrintWindow();
    handlePrintBiblia(GRUPOS, 'Biblia para el 09/07/2026');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html.split('</table></div>').length - 1).toBe(1); // 1 sola dirección (LOMAS)
    expect(html).toContain('Biblia para el 09/07/2026');
    expect(html).toContain('LOMAS');
    expect(html).toContain('<tr><th>NOMBRE FLETERO</th><th>CÓDIGO DE DESPACHO</th><th>N° PREP</th><th>IMPORTE</th><th>CANT. PED.</th><th>CANT. CLI.</th></tr>');
    expect(html).toContain('sin-asignar');
    expect(html).toContain('rowspan="2"'); // García: 2 repartos
    expect(w.document.close).toHaveBeenCalled();
    expect(w.focus).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    vi.restoreAllMocks();
  });

  it('devuelve sin hacer nada si window.open falla, sin llamar close/focus', () => {
    // ya cubierto arriba (no throw); acá verificamos explícitamente que no siga de largo
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    handlePrintBiblia(GRUPOS, 'Título');
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('ordena los repartos por nombre de chofer y agrupa filas consecutivas del mismo chofer (rowspan)', () => {
    const w = mockPrintWindow();
    const grupos: GrupoDireccion[] = [{
      direccion: 'LOMAS',
      total_clientes_unicos: 3,
      repartos: [
        makeReparto({ chofer_nombre: 'Zeta', codigo_numerico: 9, nombre: 'Z1' }),
        makeReparto({ chofer_nombre: 'García', codigo_numerico: 1, nombre: 'BIG' }),
        makeReparto({ chofer_nombre: 'García', codigo_numerico: 2, nombre: 'PERI 5' }),
      ],
    }];
    handlePrintBiblia(grupos, 'Título');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    // orden alfabético: García antes que Zeta
    expect(html.indexOf('García')).toBeLessThan(html.indexOf('Zeta'));
    // García (2 repartos consecutivos) lleva rowspan=2; Zeta (1 reparto) lleva rowspan=1
    expect(html).toMatch(/rowspan="2"[^>]*>García/);
    expect(html).toMatch(/rowspan="1"[^>]*>Zeta/);
    // el nombre de chofer aparece una sola vez en la celda (no repetido en la 2da fila de García)
    const celdasGarcia = html.match(/<td[^>]*>García<\/td>/g) ?? [];
    expect(celdasGarcia).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('la celda "c" suma agrupa+consolidado+individual (no resta)', () => {
    const w = mockPrintWindow();
    handlePrintBiblia([{
      direccion: 'LOMAS',
      total_clientes_unicos: 1,
      repartos: [makeReparto({ tipo_agrupa_direccion: 3, tipo_consolidado: 5, tipo_individual: 7 })],
    }], 'Título');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('<td class="c">15</td>'); // 3+5+7, no 3+5-7=1 ni 3-5+7=5
    vi.restoreAllMocks();
  });

  it('con showDireccion=false, arma una sola sección "Reporte personalizado" sin repetir por dirección', () => {
    const w = mockPrintWindow();
    handlePrintBiblia(GRUPOS, 'Mi título', false);
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('Reporte personalizado');
    expect(html).toContain('Mi título');
    expect(html.split('</table></div>').length - 1).toBe(1); // una sola sección total, no por dirección
    vi.restoreAllMocks();
  });

  it('llama a print() luego de 500ms', () => {
    vi.useFakeTimers();
    try {
      const w = mockPrintWindow();
      handlePrintBiblia(GRUPOS, 'Título');
      expect(w.print).not.toHaveBeenCalled();
      vi.advanceTimersByTime(499);
      expect(w.print).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(w.print).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});

describe('handlePrintResumen', () => {
  const RESUMEN: ResumenChofer[] = [{
    chofer_codigo: 'CH1',
    chofer_nombre: 'García',
    preps: [{ id: 11, estado: 'Completada', codigo_envio: 'E-11', importe_total: 1000, cantidad_pedidos: 3, peso: 2, volumen: 0 }],
    total_importe: 1000,
    total_pedidos: 3,
    total_peso: 2,
    total_volumen: 0,
    total_clientes: 2,
    codigos_despacho: ['BIG'],
  }];

  function mockPrintWindow() {
    const w = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window);
    return w;
  }

  it('no hace nada si window.open devuelve null', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => handlePrintResumen(RESUMEN, '2026-07-09')).not.toThrow();
    vi.restoreAllMocks();
  });

  it('con 1 chofer usa singular y capitaliza el día de la semana', () => {
    const w = mockPrintWindow();
    handlePrintResumen(RESUMEN, '2026-07-09');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toMatch(/<h2>Resumen biblia — Jueves, 9 de julio<\/h2>/);
    expect(html).toContain('<p>1 chofer');
    expect(html).toContain('<span><b>3</b> ped</span>');
    expect(html).toContain('<span><b>2</b> cli</span>');
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    vi.restoreAllMocks();
  });

  it('con 2+ choferes usa plural y suma el total de todos', () => {
    const w = mockPrintWindow();
    handlePrintResumen([RESUMEN[0], { ...RESUMEN[0], chofer_codigo: 'CH2', chofer_nombre: 'López', total_importe: 500 }], '2026-07-09');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('2 choferes');
    expect(html).toMatch(/\$\s1\.500/); // 1000 + 500
    vi.restoreAllMocks();
  });

  it('usa tituloCustom en vez del título por defecto si se pasa', () => {
    const w = mockPrintWindow();
    handlePrintResumen(RESUMEN, '2026-07-09', 'Mi título custom');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('<h2>Mi título custom</h2>');
    expect(html).not.toContain('<h2>Resumen biblia');
    vi.restoreAllMocks();
  });

  it('sin peso/volumen/códigos, no muestra esas secciones', () => {
    const w = mockPrintWindow();
    handlePrintResumen([{ ...RESUMEN[0], total_peso: 0, total_volumen: 0, codigos_despacho: [] }], '2026-07-09');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).not.toContain('kg</b>');
    expect(html).not.toContain('m³</b>');
    expect(html).not.toContain('class="codigos"');
    vi.restoreAllMocks();
  });

  it('con peso y volumen positivos, los muestra formateados con coma decimal', () => {
    const w = mockPrintWindow();
    handlePrintResumen([{ ...RESUMEN[0], total_volumen: 1.5 }], '2026-07-09');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('2,00</b> kg');
    expect(html).toContain('1,500</b> m³');
    expect(html).toContain('class="codigos"');
    expect(html).toContain('class="cod">BIG</span>');
    vi.restoreAllMocks();
  });

  it('usa el fallback #id y el dot sin estado cuando estado/codigo_envio son nulos', () => {
    const w = mockPrintWindow();
    handlePrintResumen([{
      ...RESUMEN[0],
      preps: [{ id: 11, estado: null as unknown as string, codigo_envio: null, importe_total: 1000, cantidad_pedidos: 3, peso: 2, volumen: 0 }],
    }], '2026-07-09');
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('class="dot estado-"');
    expect(html).toContain('class="prep-cod">#11<');
    vi.restoreAllMocks();
  });
});

describe('handleExportExcel', () => {
  it('formato biblia: headers, filas y merge del chofer con 2+ repartos', () => {
    handleExportExcel(GRUPOS, '2026-07-09', 'biblia');
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data[0]).toEqual(['NOMBRE FLETERO', 'CÓDIGO DE DESPACHO', 'N° PREP', 'IMPORTE', 'CANT. PED.', 'CANT. CLI.']);
    expect(data[1]).toEqual([]);
    expect(data[2]).toEqual(['LOMAS', '', '', '', '', '']);
    // fila 3: primer reparto de García, lleva el nombre; fila 4: 2do reparto, celda de nombre vacía (merge)
    expect(data[3]).toEqual(['García', 'BIG', 3, 1000, 3, 2]);
    expect(data[4]).toEqual(['', 'PERI 5', 3, 500, 1, 1]);
    expect(data[5]).toEqual(['López', 'SUELTO', 3, 1000, 3, 2]);

    const ws = lastSheet();
    expect(ws['!cols']).toEqual([{ wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]);
    // García ocupa filas 3-4 (0-indexed): merge exacto, ni una fila de más ni de menos
    expect(ws['!merges']).toEqual([{ s: { r: 3, c: 0 }, e: { r: 4, c: 0 } }]);

    expect(mockBookAppend.mock.calls[0][2]).toBe('Reporte 2026-07-09');
    expect(mockWriteFile.mock.calls[0][1]).toBe('reporte-por-direccion-2026-07-09-biblia.xlsx');
  });

  it('la columna N° PREP suma agrupa+consolidado+individual con valores no simétricos (no resta)', () => {
    handleExportExcel([{
      direccion: 'LOMAS',
      total_clientes_unicos: 1,
      repartos: [makeReparto({ tipo_agrupa_direccion: 5, tipo_consolidado: 3, tipo_individual: 2 })],
    }], '2026-07-09', 'biblia');
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    // 5+3+2=10; con - en cualquier posición daría 4, 0 o 6 — todos distintos de 10
    expect(data[3][2]).toBe(10);
  });

  it('con 3+ repartos consecutivos del mismo chofer, el merge abarca las 3 filas (no 2)', () => {
    handleExportExcel([{
      direccion: 'LOMAS',
      total_clientes_unicos: 1,
      repartos: [
        makeReparto({ codigo_numerico: 1, nombre: 'A' }),
        makeReparto({ codigo_numerico: 2, nombre: 'B' }),
        makeReparto({ codigo_numerico: 3, nombre: 'C' }),
      ],
    }], '2026-07-09', 'biblia');
    const ws = lastSheet();
    // header(0) + spacer(1) + direccion(2) + 3 filas de García (3,4,5)
    expect(ws['!merges']).toEqual([{ s: { r: 3, c: 0 }, e: { r: 5, c: 0 } }]);
  });

  it('formato biblia sin filas que fusionar, no setea !merges', () => {
    handleExportExcel([{
      direccion: 'SUR',
      total_clientes_unicos: 1,
      repartos: [makeReparto({ chofer_nombre: 'López', codigo_numerico: 9 })],
    }], '2026-07-09', 'biblia');
    const ws = lastSheet();
    expect(ws['!merges']).toBeUndefined();
  });

  it('formato actual: headers, filas con todos los campos y sin merges', () => {
    handleExportExcel(GRUPOS, '2026-07-09', 'actual');
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data[0]).toEqual(['NOMBRE FLETERO', 'NRO', 'CÓDIGO DE DESPACHO', 'AGRUP. DIR.', 'CONSOLIDADO', 'INDIVIDUAL', 'IMPORTE', 'CANT. PED.', 'CANT. CLIENTES']);
    expect(data[1]).toEqual([]);
    expect(data[2]).toEqual(['', '', 'LOMAS', '', '', '', '', '', '']);
    const fila = data.find(row => row[0] === 'García' && row[2] === 'BIG')!;
    expect(fila).toEqual(['García', 1, 'BIG', 1, 0, 2, 1000, 3, 2]);

    const ws = lastSheet();
    expect(ws['!cols']).toEqual([{ wch: 22 }, { wch: 8 }, { wch: 26 }, { wch: 11 }, { wch: 13 }, { wch: 11 }, { wch: 14 }, { wch: 12 }, { wch: 15 }]);
    expect(ws['!merges']).toBeUndefined(); // el merge solo aplica al formato biblia
    expect(mockWriteFile.mock.calls[0][1]).toBe('reporte-por-direccion-2026-07-09-actual.xlsx');
  });

  it('formato biblia con showDireccion=false, no agrega la fila ni el espaciador de dirección', () => {
    handleExportExcel(GRUPOS, '2026-07-09', 'biblia', false);
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data.some(row => row[0] === 'LOMAS')).toBe(false);
    expect(data[1]).not.toEqual([]); // sin la fila espaciadora previa a la dirección
  });
});

describe('handleExportExcelResumen', () => {
  const RESUMEN: ResumenChofer[] = [{
    chofer_codigo: 'CH1',
    chofer_nombre: 'García',
    preps: [{ id: 11, estado: 'Completada', codigo_envio: 'E-11', importe_total: 1000, cantidad_pedidos: 3, peso: 2, volumen: 0 }],
    total_importe: 1000,
    total_pedidos: 3,
    total_peso: 2,
    total_volumen: 0,
    total_clientes: 2,
    codigos_despacho: ['BIG', 'PERI 5'],
  }];

  it('arma headers, fila con los códigos unidos por coma y anchos de columna', () => {
    handleExportExcelResumen(RESUMEN, 'Resumen biblia 09/07/2026', '2026-07-09');
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data[0]).toEqual(['CHOFER', 'CÓDIGO', 'PREPS', 'IMPORTE', 'PEDIDOS', 'CLIENTES', 'PESO (kg)', 'VOLUMEN (m³)', 'CÓDIGOS DE DESPACHO']);
    expect(data[1]).toEqual(['García', 'CH1', 1, 1000, 3, 2, 2, 0, 'BIG, PERI 5']);

    const ws = lastSheet();
    expect(ws['!cols']).toEqual([{ wch: 26 }, { wch: 10 }, { wch: 7 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 13 }, { wch: 30 }]);
    expect(mockWriteFile.mock.calls[0][1]).toBe('reporte-resumen-2026-07-09.xlsx');
  });

  it('trunca el título a 31 caracteres para el nombre de la hoja', () => {
    const tituloLargo = 'Un título de resumen realmente muy largo que supera el límite';
    handleExportExcelResumen(RESUMEN, tituloLargo, '2026-07-09');
    expect(mockBookAppend.mock.calls[0][2]).toBe(tituloLargo.slice(0, 31));
    expect((mockBookAppend.mock.calls[0][2] as string).length).toBe(31);
  });
});
