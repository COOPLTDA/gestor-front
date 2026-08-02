import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReporteHeader } from './ReporteHeader';
import type { GrupoDireccion } from '@/pages/biblia/types/biblia';
import type { ResumenChofer } from '@/services/bibliaApi';

function makeGrupo(over: Partial<GrupoDireccion> = {}): GrupoDireccion {
  return {
    direccion: 'LOMAS',
    total_clientes_unicos: 1,
    repartos: [],
    ...over,
  } as GrupoDireccion;
}

function makeResumen(over: Partial<ResumenChofer> = {}): ResumenChofer {
  return {
    chofer_codigo: 'CH1',
    chofer_nombre: 'García',
    total_importe: 1000,
    total_pedidos: 1,
    total_clientes: 1,
    total_peso: 0,
    total_volumen: 0,
    codigos_despacho: [],
    preps: [],
    ...over,
  } as ResumenChofer;
}

function baseProps(over: Partial<Parameters<typeof ReporteHeader>[0]> = {}) {
  return {
    vista: 'biblia' as const,
    resumenEntries: [],
    personalGruposFiltrados: [],
    gruposFiltrados: [],
    totalRepartos: 0,
    activeGruposMostradosLength: 0,
    expandirTodo: vi.fn(),
    contraerTodo: vi.fn(),
    excelOpen: false,
    setExcelOpen: vi.fn(),
    printOpen: false,
    setPrintOpen: vi.fn(),
    bibliaFecha: '2026-07-10',
    fechaDesdeRango: '2026-07-01',
    fechaHastaRango: '2026-07-05',
    personalTitulo: 'Mi reporte',
    gruposExport: [],
    personalFlatExport: [],
    onExportExcel: vi.fn(),
    onExportExcelResumen: vi.fn(),
    onPrint: vi.fn(),
    onPrintBiblia: vi.fn(),
    onPrintResumen: vi.fn(),
    ...over,
  };
}

describe('ReporteHeader — contador según vista', () => {
  it('vista resumen muestra cantidad de choferes y el total en pesos', () => {
    render(<ReporteHeader {...baseProps({
      vista: 'resumen',
      resumenEntries: [makeResumen({ total_importe: 500 }), makeResumen({ chofer_codigo: 'CH2', total_importe: 300 })],
    })} />);
    expect(screen.getByText(/2 choferes/)).toBeInTheDocument();
    expect(screen.getByText(/\$\s?800/)).toBeInTheDocument();
  });

  it('vista resumen con exactamente 1 chofer usa singular', () => {
    render(<ReporteHeader {...baseProps({ vista: 'resumen', resumenEntries: [makeResumen()] })} />);
    expect(screen.getByText(/1 chofer(?!es)/)).toBeInTheDocument();
  });

  it('vista personalizado muestra repartos y direcciones de los grupos personales filtrados', () => {
    render(<ReporteHeader {...baseProps({
      vista: 'personalizado',
      personalGruposFiltrados: [
        makeGrupo({ direccion: 'LOMAS', repartos: [{}, {}] as GrupoDireccion['repartos'] }),
        makeGrupo({ direccion: 'QUILMES', repartos: [{}] as GrupoDireccion['repartos'] }),
      ],
    })} />);
    expect(screen.getByText(/3 repartos/)).toBeInTheDocument();
    expect(screen.getByText(/2 direcci.nes/)).toBeInTheDocument();
  });

  it('vista personalizado con 1 reparto y 1 dirección usa singular', () => {
    render(<ReporteHeader {...baseProps({
      vista: 'personalizado',
      personalGruposFiltrados: [makeGrupo({ repartos: [{}] as GrupoDireccion['repartos'] })],
    })} />);
    expect(screen.getByText(/1 reparto(?!s)/)).toBeInTheDocument();
    expect(screen.getByText(/1 dirección(?!es)/)).toBeInTheDocument();
  });

  it('otras vistas (biblia/rango) muestran repartos y direcciones de gruposFiltrados, usando totalRepartos para el singular/plural', () => {
    render(<ReporteHeader {...baseProps({
      vista: 'biblia',
      gruposFiltrados: [makeGrupo({ direccion: 'LOMAS', repartos: [{}, {}] as GrupoDireccion['repartos'] })],
      totalRepartos: 1,
    })} />);
    expect(screen.getByText(/2 reparto(?!s)/)).toBeInTheDocument();
    expect(screen.getByText(/1 dirección(?!es)/)).toBeInTheDocument();
  });
});

describe('ReporteHeader — botones expandir/contraer', () => {
  it('se muestran cuando la vista no es resumen ni mapa y hay grupos mostrados', () => {
    render(<ReporteHeader {...baseProps({ vista: 'biblia', activeGruposMostradosLength: 1 })} />);
    expect(screen.getByTitle('Expandir todo')).toBeInTheDocument();
    expect(screen.getByTitle('Contraer todo')).toBeInTheDocument();
  });

  it('no se muestran si no hay grupos mostrados', () => {
    render(<ReporteHeader {...baseProps({ vista: 'biblia', activeGruposMostradosLength: 0 })} />);
    expect(screen.queryByTitle('Expandir todo')).not.toBeInTheDocument();
  });

  it('no se muestran en vista resumen', () => {
    render(<ReporteHeader {...baseProps({ vista: 'resumen', activeGruposMostradosLength: 5 })} />);
    expect(screen.queryByTitle('Expandir todo')).not.toBeInTheDocument();
  });

  it('no se muestran en vista mapa', () => {
    render(<ReporteHeader {...baseProps({ vista: 'mapa', activeGruposMostradosLength: 5 })} />);
    expect(screen.queryByTitle('Expandir todo')).not.toBeInTheDocument();
  });

  it('expandir y contraer todo llaman a sus callbacks', () => {
    const expandirTodo = vi.fn();
    const contraerTodo = vi.fn();
    render(<ReporteHeader {...baseProps({ vista: 'biblia', activeGruposMostradosLength: 1, expandirTodo, contraerTodo })} />);
    fireEvent.click(screen.getByTitle('Expandir todo'));
    fireEvent.click(screen.getByTitle('Contraer todo'));
    expect(expandirTodo).toHaveBeenCalledTimes(1);
    expect(contraerTodo).toHaveBeenCalledTimes(1);
  });
});

describe('ReporteHeader — botón Excel', () => {
  it('no aparece en vista mapa', () => {
    render(<ReporteHeader {...baseProps({ vista: 'mapa' })} />);
    expect(screen.queryByText('Excel')).not.toBeInTheDocument();
  });

  it('aparece en el resto de las vistas y alterna el desplegable', () => {
    const setExcelOpen = vi.fn();
    render(<ReporteHeader {...baseProps({ vista: 'biblia', excelOpen: false, setExcelOpen })} />);
    fireEvent.click(screen.getByText('Excel'));
    expect(setExcelOpen).toHaveBeenCalledWith(true);
  });

  it('vista resumen: el desplegable solo ofrece "Exportar" y llama a onExportExcelResumen con el título formateado', () => {
    const onExportExcelResumen = vi.fn();
    render(<ReporteHeader {...baseProps({ vista: 'resumen', excelOpen: true, onExportExcelResumen, bibliaFecha: '2026-07-10', resumenEntries: [makeResumen()] })} />);
    expect(screen.queryByText('Formato actual')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Exportar'));
    expect(onExportExcelResumen).toHaveBeenCalledWith([expect.objectContaining({ chofer_codigo: 'CH1' })], 'Resumen biblia 10/07/2026', '2026-07-10');
  });

  it('vista personalizado: el desplegable ofrece "Exportar" (formato biblia, sin dirección) usando personalFlatExport', () => {
    const onExportExcel = vi.fn();
    const personalFlatExport = [makeGrupo({ direccion: 'Mi reporte' })];
    render(<ReporteHeader {...baseProps({ vista: 'personalizado', excelOpen: true, onExportExcel, personalFlatExport, bibliaFecha: '2026-07-10' })} />);
    fireEvent.click(screen.getByText('Exportar'));
    expect(onExportExcel).toHaveBeenCalledWith(personalFlatExport, '2026-07-10', 'biblia', false);
  });

  it('vistas biblia/rango: el desplegable ofrece "Formato actual" y "Formato biblia" usando gruposExport', () => {
    const onExportExcel = vi.fn();
    const gruposExport = [makeGrupo()];
    render(<ReporteHeader {...baseProps({ vista: 'biblia', excelOpen: true, onExportExcel, gruposExport, bibliaFecha: '2026-07-10' })} />);
    fireEvent.click(screen.getByText('Formato actual'));
    expect(onExportExcel).toHaveBeenCalledWith(gruposExport, '2026-07-10', 'actual');
    fireEvent.click(screen.getByText('Formato biblia'));
    expect(onExportExcel).toHaveBeenCalledWith(gruposExport, '2026-07-10', 'biblia');
  });

  it('clickear el overlay cierra el desplegable de Excel', () => {
    const setExcelOpen = vi.fn();
    const { container } = render(<ReporteHeader {...baseProps({ vista: 'biblia', excelOpen: true, setExcelOpen })} />);
    fireEvent.click(container.querySelector('.fixed.inset-0.z-40')!);
    expect(setExcelOpen).toHaveBeenCalledWith(false);
  });
});

describe('ReporteHeader — botón Imprimir', () => {
  it('siempre aparece, incluso en vista mapa, y alterna el desplegable', () => {
    const setPrintOpen = vi.fn();
    render(<ReporteHeader {...baseProps({ vista: 'mapa', printOpen: false, setPrintOpen })} />);
    fireEvent.click(screen.getByText('Imprimir'));
    expect(setPrintOpen).toHaveBeenCalledWith(true);
  });

  it('vista resumen: solo ofrece "Resumen" y llama a onPrintResumen', () => {
    const onPrintResumen = vi.fn();
    render(<ReporteHeader {...baseProps({ vista: 'resumen', printOpen: true, onPrintResumen, resumenEntries: [makeResumen()], bibliaFecha: '2026-07-10' })} />);
    expect(screen.queryByText('Formato actual')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Resumen'));
    expect(onPrintResumen).toHaveBeenCalledWith([expect.objectContaining({ chofer_codigo: 'CH1' })], '2026-07-10');
  });

  it('vista personalizado: "Formato actual" llama a onPrint y "Formato biblia" llama a onPrintBiblia con personalFlatExport/personalTitulo y showDireccion=false', () => {
    const onPrint = vi.fn();
    const onPrintBiblia = vi.fn();
    const personalFlatExport = [makeGrupo()];
    render(<ReporteHeader {...baseProps({ vista: 'personalizado', printOpen: true, onPrint, onPrintBiblia, personalFlatExport, personalTitulo: 'Título X' })} />);
    fireEvent.click(screen.getByText('Formato actual'));
    expect(onPrint).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Formato biblia'));
    expect(onPrintBiblia).toHaveBeenCalledWith(personalFlatExport, 'Título X', false);
  });

  it('vista biblia: "Formato biblia" arma el título con la fecha de biblia formateada', () => {
    const onPrintBiblia = vi.fn();
    const gruposExport = [makeGrupo()];
    render(<ReporteHeader {...baseProps({ vista: 'biblia', printOpen: true, onPrintBiblia, gruposExport, bibliaFecha: '2026-07-10' })} />);
    fireEvent.click(screen.getByText('Formato biblia'));
    expect(onPrintBiblia).toHaveBeenCalledWith(gruposExport, 'Biblia para el 10/07/2026');
  });

  it('vista rango: "Formato biblia" arma el título con el período desde/hasta formateado', () => {
    const onPrintBiblia = vi.fn();
    const gruposExport = [makeGrupo()];
    render(<ReporteHeader {...baseProps({
      vista: 'rango', printOpen: true, onPrintBiblia, gruposExport,
      fechaDesdeRango: '2026-07-01', fechaHastaRango: '2026-07-05',
    })} />);
    fireEvent.click(screen.getByText('Formato biblia'));
    expect(onPrintBiblia).toHaveBeenCalledWith(gruposExport, 'Asignación de preparaciones para el período 01/07/2026 - 05/07/2026');
  });

  it('vista rango: "Formato actual" llama a onPrint', () => {
    const onPrint = vi.fn();
    render(<ReporteHeader {...baseProps({ vista: 'rango', printOpen: true, onPrint })} />);
    fireEvent.click(screen.getByText('Formato actual'));
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it('clickear el overlay cierra el desplegable de Imprimir', () => {
    const setPrintOpen = vi.fn();
    const { container } = render(<ReporteHeader {...baseProps({ vista: 'biblia', printOpen: true, setPrintOpen })} />);
    const overlays = container.querySelectorAll('.fixed.inset-0.z-40');
    fireEvent.click(overlays[overlays.length - 1]);
    expect(setPrintOpen).toHaveBeenCalledWith(false);
  });
});
