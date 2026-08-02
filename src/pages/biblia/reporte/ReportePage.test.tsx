import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportePage } from './ReportePage';
import {
  fetchRepartosPorDireccion,
  fetchRangoBiblia,
  fetchResumenBiblia,
  fetchMapaClientes,
  type ResumenChofer,
  type MapaCliente,
} from '@/services/bibliaApi';
import type { GrupoDireccion, RepartoReporte } from '@/pages/biblia/types/biblia';
import * as XLSX from 'xlsx';

let locationState: Record<string, unknown> | null = null;
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useLocation: () => ({ state: locationState }),
  };
});

vi.mock('@/services/bibliaApi', () => ({
  fetchRepartosPorDireccion: vi.fn(),
  fetchRangoBiblia: vi.fn(),
  fetchResumenBiblia: vi.fn(),
  fetchMapaClientes: vi.fn(),
}));

vi.mock('./MapaReporte', () => ({
  MapaReporte: ({ pines, loading }: { pines: unknown[]; loading: boolean }) => (
    <div data-testid="mapa" data-pines={pines.length} data-loading={String(loading)} />
  ),
}));

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

const mockRango = vi.mocked(fetchRangoBiblia);
const mockDireccion = vi.mocked(fetchRepartosPorDireccion);
const mockResumen = vi.mocked(fetchResumenBiblia);
const mockMapa = vi.mocked(fetchMapaClientes);
const mockAoa = vi.mocked(XLSX.utils.aoa_to_sheet);
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
    detalle: [
      { preparacion_id: 11, tipo: 'Pedidos individuales', importe: 1000, pedidos: 3, clientes: 2 },
    ],
    caso: 'propia',
    biblia_fecha_asignada: '2026-07-10',
    ...over,
  };
}

const GRUPOS: GrupoDireccion[] = [
  {
    direccion: 'LOMAS',
    total_clientes_unicos: 3,
    repartos: [
      makeReparto(),
      makeReparto({
        codigo_numerico: 2,
        nombre: 'PERI 5',
        total_importe: 500,
        total_pedidos: 1,
        total_clientes: 1,
        clientes_unicos: ['CL3'],
        detalle: [
          { preparacion_id: 12, tipo: 'Consolidado de pedidos', importe: 300, pedidos: 1, clientes: 1 },
          { preparacion_id: 13, tipo: 'Pedidos individuales', importe: 200, pedidos: 1, clientes: 1 },
        ],
      }),
      makeReparto({
        codigo_numerico: 3,
        nombre: 'SUELTO',
        chofer_codigo: '',
        chofer_nombre: 'SIN ASIGNAR',
        caso: 'sin_asignar',
        biblia_fecha_asignada: null,
        total_importe: 99,
        clientes_unicos: ['CL9'],
      }),
    ],
  },
  {
    direccion: 'SUR',
    total_clientes_unicos: 1,
    repartos: [
      makeReparto({ codigo_numerico: 4, nombre: 'SUR 1', chofer_codigo: 'CH2', chofer_nombre: 'López', clientes_unicos: ['CL5'], total_importe: 700 }),
    ],
  },
];

const RESUMEN: ResumenChofer[] = [
  {
    chofer_codigo: 'CH1',
    chofer_nombre: 'García',
    preps: [{ id: 11, estado: 'Completada', codigo_envio: 'E-11', importe_total: 1000, cantidad_pedidos: 3, peso: 2, volumen: 0 }],
    total_importe: 1000,
    total_pedidos: 3,
    total_peso: 2,
    total_volumen: 0,
    total_clientes: 2,
    codigos_despacho: ['BIG'],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  locationState = null;
  mockRango.mockResolvedValue({ fecha_desde: '2026-07-09', fecha_hasta: '2026-07-09' });
  mockDireccion.mockResolvedValue(GRUPOS);
  mockResumen.mockResolvedValue(RESUMEN);
  mockMapa.mockResolvedValue([
    { codigo: 'CL1', descripcion: 'Cliente Uno', lat: -34.7, lng: -58.4, codigo_despacho: 'BIG', direccion: 'LOMAS', choferes: [{ codigo: 'CH1', nombre: 'García' }], importe: 500 },
  ]);
});

function renderPage() {
  return render(<MemoryRouter><ReportePage /></MemoryRouter>);
}

// "LOMAS"/"SUR" aparecen también como <option> del filtro de zonas: para las secciones
// de la tabla se busca el encabezado (un <div>).
function seccion(nombre: string) {
  return screen.queryByText(nombre, { selector: 'div' });
}

async function esperarTabla() {
  await waitFor(() => expect(seccion('LOMAS')).toBeInTheDocument());
}

describe('ReportePage — vista biblia (default)', () => {
  it('muestra el día de la semana de la biblia seleccionada', async () => {
    locationState = { bibliaFecha: '2026-07-09' };
    renderPage();
    await esperarTabla();
    expect(screen.getByText('jueves')).toBeInTheDocument();
  });

  it('pide el rango de la biblia y luego los repartos con ese rango', async () => {
    renderPage();
    await esperarTabla();
    expect(mockRango).toHaveBeenCalled();
    const bibliaFecha = mockRango.mock.calls[0][0];
    expect(mockDireccion).toHaveBeenCalledWith('2026-07-09', '2026-07-09', bibliaFecha);
  });

  it('agrupa por dirección y por chofer, con totales por sección (biblia de un día: rojo visible)', async () => {
    const { container } = renderPage();
    await esperarTabla();
    expect(seccion('SUR')).toBeInTheDocument();
    // García tiene 2 códigos → fila agrupada colapsada
    expect(screen.getByText('2 códigos de despacho')).toBeInTheDocument();
    // biblia de un solo día: el filtro arranca en propia + sin asignar
    expect(screen.getByText('SIN ASIGNAR')).toBeInTheDocument();
    // totales de LOMAS: 1000 + 500 + 99
    expect(screen.getByText('$ 1.599')).toBeInTheDocument();
    // clientes únicos en el pie: 4 (CL1, CL2, CL3, CL9)
    expect(screen.getByText(/\(4 únicos\)/)).toBeInTheDocument();
    // Contador del header: 4 repartos (plural) · 2 direcciones (plural)
    const header = container.querySelector('.text-blue-200.text-sm.hidden.sm\\:inline')!;
    expect(header.textContent).toContain('4 repartos · 2 direcciónes');
  });

  it('el color de fila depende del caso: sin_asignar rojo, otra_biblia ámbar, propia sin color', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 3,
      repartos: [
        makeReparto({ chofer_nombre: 'García', caso: 'propia' }),
        makeReparto({ chofer_nombre: 'SIN ASIGNAR', chofer_codigo: '', caso: 'sin_asignar', biblia_fecha_asignada: null, codigo_numerico: 2, nombre: 'OTRO' }),
        makeReparto({ chofer_nombre: 'OTRA', caso: 'otra_biblia', codigo_numerico: 3, nombre: 'TERCERO' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    // por defecto (biblia de 1 día) el filtro es propia+sin_asignar: hay que sumar "otra biblia"
    fireEvent.click(screen.getByRole('button', { name: /2 casos/ }));
    fireEvent.click(screen.getByLabelText('Otra biblia'));
    await waitFor(() => expect(screen.getByText('OTRA')).toBeInTheDocument());
    expect(screen.getByText('García').closest('tr')!.className).toContain('hover:bg-slate-50');
    expect(screen.getByText('SIN ASIGNAR').closest('tr')!.className).toContain('bg-red-200 print:bg-red-200');
    expect(screen.getByText('OTRA').closest('tr')!.className).toContain('bg-amber-100 print:bg-amber-100');
  });

  it('el botón de filtro de caso es azul con selección parcial y blanco con 0 o los 3 casos', async () => {
    renderPage();
    await esperarTabla();
    // default: 2 de 3 casos seleccionados → azul
    const boton = screen.getByRole('button', { name: /2 casos/ });
    expect(boton.className).toContain('bg-blue-600 text-white border-blue-600');

    fireEvent.click(boton);
    fireEvent.click(screen.getByLabelText('Otra biblia')); // ahora selecciona los 3 → "Todo"
    const botonTodo = screen.getByRole('button', { name: 'Todo' });
    expect(botonTodo.className).toContain('bg-white text-slate-500 border-slate-300');

    // el dropdown ya sigue abierto desde el paso anterior
    fireEvent.click(screen.getByLabelText('Esta biblia'));
    fireEvent.click(screen.getByLabelText('Sin asignar'));
    fireEvent.click(screen.getByLabelText('Otra biblia')); // ahora 0 seleccionados
    expect(screen.getByRole('button', { name: 'Todo' }).className).toContain('bg-white text-slate-500 border-slate-300');
  });

  it('el punto de color de cada opción del filtro de caso coincide con su clase esperada', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /2 casos/ }));
    const puntoPropia = screen.getByLabelText('Esta biblia').closest('label')!.querySelector('span > span')!;
    const puntoSinAsignar = screen.getByLabelText('Sin asignar').closest('label')!.querySelector('span > span')!;
    const puntoOtra = screen.getByLabelText('Otra biblia').closest('label')!.querySelector('span > span')!;
    expect(puntoPropia.className).toContain('bg-slate-300');
    expect(puntoSinAsignar.className).toContain('bg-red-300');
    expect(puntoOtra.className).toContain('bg-amber-300');
  });

  it('el footer de la tabla principal suma los totales de todos los repartos de la dirección', async () => {
    renderPage();
    await esperarTabla();
    // LOMAS: los 3 repartos (García/BIG, García/PERI 5, SIN ASIGNAR) tienen los valores
    // por defecto de makeReparto salvo lo explícitamente sobreescrito en el fixture GRUPOS.
    // agr: 1+1+1=3, cons: 0+0+0=0, ind: 2+2+2=6, imp: 1000+500+99=1599, ped: 3+1+3=7, cli: 2+1+2=5
    const filaTotal = screen.getAllByText('TOTAL')[0].closest('tr')!;
    const celdas = within(filaTotal).getAllByRole('cell');
    expect(celdas[4].textContent).toBe('3'); // AGRUP. DIR.
    expect(celdas[5].textContent).toBe('0'); // CONSOLIDADO
    expect(celdas[6].textContent).toBe('6'); // INDIVIDUAL
    expect(celdas[7].textContent).toContain('1.599'); // IMPORTE
    expect(celdas[8].textContent).toBe('7'); // CANT. PED.
    expect(celdas[9].textContent).toMatch(/^5\s/); // CANT. CLIENTES (2+1+2), no "-5"
  });

  it('el footer suma tipo_consolidado con valores no nulos', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [
        makeReparto({ tipo_consolidado: 3 }),
        makeReparto({ tipo_consolidado: 2, codigo_numerico: 2, nombre: 'OTRO' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    const filaTotal = screen.getAllByText('TOTAL')[0].closest('tr')!;
    const celdas = within(filaTotal).getAllByRole('cell');
    expect(celdas[5].textContent).toBe('5'); // 3+2, no 3-2=1
  });

  it('inyecta los estilos de impresión en un tag <style>', () => {
    const { container } = renderPage();
    const style = container.parentElement!.querySelector('style')!;
    expect(style.textContent).toContain('@page { size: landscape; margin: 8mm; }');
    expect(style.textContent).toContain('.print\\:break-inside-avoid { page-break-inside: avoid; }');
  });

  it('el contador del header usa singular con exactamente 1 reparto en 1 dirección', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'UNICA',
      total_clientes_unicos: 1,
      repartos: [makeReparto({ codigo_numerico: 9, nombre: 'SOLO', clientes_unicos: ['CLX'] })],
    }]);
    const { container } = renderPage();
    await waitFor(() => expect(seccion('UNICA')).toBeInTheDocument());
    const header = container.querySelector('.text-blue-200.text-sm.hidden.sm\\:inline')!;
    expect(header.textContent).toContain('1 reparto · 1 dirección');
  });

  it('biblia con rango de fechas: arranca mostrando solo esta biblia (sin asignar oculto)', async () => {
    mockRango.mockResolvedValue({ fecha_desde: '2026-07-06', fecha_hasta: '2026-07-09' });
    renderPage();
    await esperarTabla();
    expect(screen.getByRole('button', { name: /Esta biblia/ })).toBeInTheDocument();
    expect(screen.queryByText('SIN ASIGNAR')).not.toBeInTheDocument();
    // totales de LOMAS sin los 99 del sin asignar — fila de García y pie
    expect(screen.getAllByText('$ 1.500').length).toBe(2);
    expect(screen.getByText(/\(3 únicos\)/)).toBeInTheDocument();
    // rango de varios días: se muestra "desde al hasta"
    expect(screen.getByText('06/07/2026 al 09/07/2026')).toBeInTheDocument();
  });

  it('cambiar la fecha de biblia dispara un nuevo fetch del rango', async () => {
    locationState = { bibliaFecha: '2026-07-09' };
    renderPage();
    await esperarTabla();
    const input = screen.getByDisplayValue('2026-07-09') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-07-20' } });
    await waitFor(() => expect(mockRango).toHaveBeenLastCalledWith('2026-07-20'));
  });

  it('expande el grupo de un chofer multi-código al click', async () => {
    renderPage();
    await esperarTabla();
    expect(screen.queryByText('↳')).not.toBeInTheDocument();
    const grupoRow = screen.getByText('2 códigos de despacho').closest('tr')!;
    fireEvent.click(within(grupoRow).getByRole('button'));
    expect(screen.getAllByText('↳').length).toBe(2);
    // el sub-código PERI 5 tiene 2 preps → su detalle no se muestra hasta expandir
    expect(screen.queryByText(/Prep. #12/)).not.toBeInTheDocument();
    // el sub-código BIG tiene 1 sola prep → su detalle se muestra automáticamente
    expect(screen.getByText(/Prep. #11/)).toBeInTheDocument();
    // y al tener 1 sola prep, no tiene botón propio de expandir/contraer (no es "expandible")
    const filaBig = screen.getByDisplayValue('BIG').closest('tr')!;
    expect(within(filaBig).queryByRole('button')).not.toBeInTheDocument();

    // expandir el sub-código PERI 5 (2 preps) muestra su detalle
    const filaPeri = screen.getByDisplayValue('PERI 5').closest('tr')!;
    fireEvent.click(within(filaPeri).getByRole('button'));
    expect(screen.getByText(/Prep. #12/)).toBeInTheDocument();
    expect(screen.getByText(/Prep. #13/)).toBeInTheDocument();
  });

  it('expandir todo muestra grupos y detalles; contraer todo los cierra', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByTitle('Expandir todo'));
    expect(screen.getAllByText('↳').length).toBeGreaterThan(0);
    expect(screen.getByText(/Prep. #12/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Contraer todo'));
    expect(screen.queryByText('↳')).not.toBeInTheDocument();
  });

  it('un chofer de código único con varias preps expande su propio detalle al click', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 1,
      repartos: [makeReparto({
        detalle: [
          { preparacion_id: 21, tipo: 'Pedidos individuales', importe: 500, pedidos: 1, clientes: 1 },
          { preparacion_id: 22, tipo: 'Consolidado de pedidos', importe: 500, pedidos: 2, clientes: 1 },
        ],
      })],
    }]);
    renderPage();
    await esperarTabla();
    expect(screen.queryByText(/Prep. #21/)).not.toBeInTheDocument();
    const fila = screen.getByText('García').closest('tr')!;
    fireEvent.click(within(fila).getByRole('button'));
    expect(screen.getByText(/Prep. #21/)).toBeInTheDocument();
    expect(screen.getByText(/Prep. #22/)).toBeInTheDocument();
  });

  it('filtra por dirección con el selector de zonas', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.change(screen.getByDisplayValue('Todas las zonas'), { target: { value: 'SUR' } });
    expect(seccion('LOMAS')).not.toBeInTheDocument();
    expect(seccion('SUR')).toBeInTheDocument();
  });

  it('filtra por caso (sin asignar)', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /2 casos/ }));
    fireEvent.click(screen.getByLabelText('Esta biblia'));
    await waitFor(() => {
      expect(screen.getByText('SIN ASIGNAR')).toBeInTheDocument();
      expect(screen.queryByText('López')).not.toBeInTheDocument();
    });
  });

  it('muestra el vacío cuando la biblia no tiene asignaciones', async () => {
    mockRango.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText('No hay preparaciones asignadas a esta biblia')).toBeInTheDocument();
    expect(screen.getByText('Sin preparaciones asignadas')).toBeInTheDocument();
    expect(mockDireccion).not.toHaveBeenCalled();
  });

  it('muestra el banner de error si el fetch falla y se puede cerrar', async () => {
    mockDireccion.mockRejectedValue(new Error('backend caído'));
    renderPage();
    expect(await screen.findByText('backend caído')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText('backend caído')).not.toBeInTheDocument();
  });

  it('muestra un mensaje de error genérico si falla el rango de biblia con algo que no es Error', async () => {
    mockRango.mockRejectedValue('boom');
    renderPage();
    expect(await screen.findByText('Error al cargar el rango de la biblia')).toBeInTheDocument();
  });

  it('muestra un mensaje de error genérico si falla vista rango con algo que no es Error', async () => {
    renderPage();
    await esperarTabla();
    mockDireccion.mockRejectedValue('boom');
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    expect(await screen.findByText('Error al cargar los repartos por dirección')).toBeInTheDocument();
  });

  it('muestra el error si falla la carga del resumen', async () => {
    mockResumen.mockRejectedValue(new Error('resumen caído'));
    locationState = { view: 'resumen' };
    renderPage();
    expect(await screen.findByText('resumen caído')).toBeInTheDocument();
  });

  it('muestra un mensaje de error genérico si falla el resumen con algo que no es Error', async () => {
    mockResumen.mockRejectedValue('boom');
    locationState = { view: 'resumen' };
    renderPage();
    expect(await screen.findByText('Error al cargar el resumen de la biblia')).toBeInTheDocument();
  });

  it('muestra el error si falla la carga del mapa', async () => {
    mockMapa.mockRejectedValue(new Error('mapa caído'));
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    expect(await screen.findByText('mapa caído')).toBeInTheDocument();
  });

  it('muestra el loader mientras carga los repartos por dirección y lo oculta al terminar', async () => {
    let resolveFn!: (v: GrupoDireccion[]) => void;
    mockDireccion.mockReturnValue(new Promise(res => { resolveFn = res; }));
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelector('.animate-spin')).toBeInTheDocument());
    resolveFn(GRUPOS);
    await esperarTabla();
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('el código de despacho es editable y conserva el override', async () => {
    renderPage();
    await esperarTabla();
    const input = screen.getByDisplayValue('SUR 1');
    fireEvent.change(input, { target: { value: 'SUR 1 - CAMIÓN 2' } });
    expect(screen.getByDisplayValue('SUR 1 - CAMIÓN 2')).toBeInTheDocument();
  });

  it('López (código único, 1 sola prep) no muestra botón de expandir detalle', async () => {
    renderPage();
    await esperarTabla();
    const fila = screen.getByText('López').closest('tr')!;
    expect(within(fila).queryByRole('button')).not.toBeInTheDocument();
  });

  it('el input de código de despacho principal y el de sub-item usan clases de tamaño distintas', async () => {
    renderPage();
    await esperarTabla();
    const inputPrincipal = screen.getByDisplayValue('SUR 1') as HTMLInputElement;
    expect(inputPrincipal.className).toContain('text-slate-700');
    expect(inputPrincipal.className).not.toContain('text-xs');

    const grupoRow = screen.getByText('2 códigos de despacho').closest('tr')!;
    fireEvent.click(within(grupoRow).getByRole('button'));
    const inputSub = screen.getByDisplayValue('PERI 5') as HTMLInputElement;
    expect(inputSub.className).toContain('text-slate-600 text-xs');
  });

  it('el código de despacho de un sub-item dentro de un grupo multi-código también es editable', async () => {
    renderPage();
    await esperarTabla();
    const grupoRow = screen.getByText('2 códigos de despacho').closest('tr')!;
    fireEvent.click(within(grupoRow).getByRole('button'));
    const input = screen.getByDisplayValue('PERI 5');
    fireEvent.change(input, { target: { value: 'PERI 5 BIS' } });
    expect(screen.getByDisplayValue('PERI 5 BIS')).toBeInTheDocument();
  });

  it('respeta la vista y fecha inicial de location.state', async () => {
    locationState = { view: 'resumen', bibliaFecha: '2026-07-15' };
    renderPage();
    await waitFor(() => expect(mockResumen).toHaveBeenCalledWith('2026-07-15'));
    expect(screen.getByRole('button', { name: 'Resumen' }).className).toContain('border-blue-600 text-blue-600');
  });

  it('un view "rango" en location.state arranca directo en vista rango de fechas', async () => {
    locationState = { view: 'rango' };
    renderPage();
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Vista rango de fechas' }).className).toContain('border-blue-600 text-blue-600');
  });

  it('un view inválido en location.state cae a la vista biblia por defecto', async () => {
    locationState = { view: 'algo-invalido' };
    renderPage();
    await esperarTabla();
    expect(screen.getByRole('button', { name: 'Vista biblia' }).className).toContain('border-blue-600 text-blue-600');
  });

  it('una bibliaFecha con formato inválido en location.state se ignora (no se usa tal cual)', async () => {
    locationState = { bibliaFecha: '15-07-2026' };
    renderPage();
    await esperarTabla();
    expect(mockRango).toHaveBeenCalled();
    const fechaUsada = mockRango.mock.calls[0][0];
    expect(fechaUsada).not.toBe('15-07-2026');
    expect(fechaUsada).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('el selector de zonas lista las direcciones ordenadas alfabéticamente', async () => {
    mockDireccion.mockResolvedValue([
      { direccion: 'SUR', total_clientes_unicos: 1, repartos: [makeReparto()] },
      { direccion: 'LOMAS', total_clientes_unicos: 1, repartos: [makeReparto()] },
    ]);
    renderPage();
    await esperarTabla();
    const opciones = screen.getAllByRole('option').map(o => o.textContent);
    expect(opciones).toEqual(['Todas las zonas', 'LOMAS', 'SUR']);
  });

  it('des-tildar los 3 casos (0 filtros) muestra todo sin filtrar, y los 3 tildados también', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /2 casos/ }));
    // están tildados 'propia' y 'sin_asignar'; tildar 'otra_biblia' deja los 3 → "Todo"
    fireEvent.click(screen.getByLabelText('Otra biblia'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Todo' })).toBeInTheDocument());
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.getByText('SIN ASIGNAR')).toBeInTheDocument();

    // destildar los 3 (0 filtros) también debe mostrar todo, sin filtrar por caso
    // (el dropdown ya está abierto desde el paso anterior)
    fireEvent.click(screen.getByLabelText('Esta biblia'));
    fireEvent.click(screen.getByLabelText('Sin asignar'));
    fireEvent.click(screen.getByLabelText('Otra biblia'));
    await waitFor(() => {
      expect(screen.getByText('García')).toBeInTheDocument();
      expect(screen.getByText('SIN ASIGNAR')).toBeInTheDocument();
    });
  });
});

describe('ReportePage — vista rango', () => {
  it('cambiar fecha desde/hasta dispara un nuevo fetch de repartos', async () => {
    const { container } = renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));
    const llamadasPrevias = mockDireccion.mock.calls.length;

    // eslint-disable-next-line testing-library/no-node-access
    const [inputDesde, inputHasta] = container.querySelectorAll('input[type="date"]');
    fireEvent.change(inputDesde, { target: { value: '2026-07-01' } });
    await waitFor(() => expect(mockDireccion.mock.calls.length).toBeGreaterThan(llamadasPrevias));
    expect(mockDireccion).toHaveBeenLastCalledWith('2026-07-01', expect.any(String));

    const llamadasTrasDesde = mockDireccion.mock.calls.length;
    fireEvent.change(inputHasta, { target: { value: '2026-07-15' } });
    await waitFor(() => expect(mockDireccion.mock.calls.length).toBeGreaterThan(llamadasTrasDesde));
    expect(mockDireccion).toHaveBeenLastCalledWith('2026-07-01', '2026-07-15');
  });

  it('pide repartos sin biblia_fecha y muestra la columna BIBLIA', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => {
      expect(mockDireccion).toHaveBeenLastCalledWith(expect.any(String), expect.any(String));
    });
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));
    // García: propia con fecha de biblia → muestra la fecha; sin asignar → guión
    expect(screen.getAllByText('10/07/2026').length).toBeGreaterThan(0);
  });

  it('en vista rango la tabla tiene una columna BIBLIA extra en encabezado y pie respecto a vista biblia', async () => {
    const { container } = renderPage();
    await esperarTabla();
    const filaTotalBiblia = screen.getAllByText('TOTAL')[0].closest('tr')!;
    const celdasBiblia = within(filaTotalBiblia).getAllByRole('cell').length;
    const headerBiblia = container.querySelector('thead tr')!.children.length;

    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));
    const filaTotalRango = screen.getAllByText('TOTAL')[0].closest('tr')!;
    const celdasRango = within(filaTotalRango).getAllByRole('cell').length;
    const headerRango = container.querySelector('thead tr')!.children.length;

    expect(celdasRango).toBe(celdasBiblia + 1);
    expect(headerRango).toBe(headerBiblia + 1);
  });

  it('el color de fila depende de si tiene biblia asignada', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));
    // García: agrupado por chofer+biblia_fecha_asignada (2026-07-10) → tiene asignación
    expect(screen.getByText('García').closest('tr')!.className).toContain('hover:bg-slate-50');
    // SIN ASIGNAR: biblia_fecha_asignada null → guión y fila roja
    expect(screen.getByText('SIN ASIGNAR').closest('tr')!.className).toContain('bg-red-200 print:bg-red-200');
  });

  it('filtra por biblia asignada', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));

    const botonBiblias = screen.getByRole('button', { name: /Todo/ });
    expect(botonBiblias.className).toContain('bg-white text-slate-500 border-slate-300');
    fireEvent.click(botonBiblias);
    const checkboxSinAsignar = screen.getByLabelText('Sin asignar') as HTMLInputElement;
    expect(checkboxSinAsignar.checked).toBe(false);
    fireEvent.click(checkboxSinAsignar);
    await waitFor(() => {
      expect(screen.getByText('SIN ASIGNAR')).toBeInTheDocument();
      expect(screen.queryByText('López')).not.toBeInTheDocument();
    });
    expect(checkboxSinAsignar.checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Sin asignar' }).className).toContain('bg-blue-600 text-white border-blue-600');
  });

  it('filtra por una fecha de biblia específica (no "_sin")', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /Todo/ }));
    fireEvent.click(screen.getByLabelText('10/07/2026'));

    await waitFor(() => {
      // García y López tienen biblia_fecha_asignada 2026-07-10; SIN ASIGNAR (null) queda afuera.
      expect(screen.getByText('García')).toBeInTheDocument();
      expect(screen.queryByText('SIN ASIGNAR')).not.toBeInTheDocument();
    });
    // con una única fecha (no "_sin") seleccionada, el botón muestra la fecha formateada
    expect(screen.getByRole('button', { name: '10/07/2026' })).toBeInTheDocument();
  });

  it('con 2 fechas de biblia seleccionadas, el botón muestra "2 biblias" (no una fecha formateada)', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [
        makeReparto({ chofer_nombre: 'García', biblia_fecha_asignada: '2026-07-10' }),
        makeReparto({ chofer_nombre: 'López', chofer_codigo: 'CH2', codigo_numerico: 2, nombre: 'OTRO', biblia_fecha_asignada: '2026-07-11' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /Todo/ }));
    fireEvent.click(screen.getByLabelText('10/07/2026'));
    fireEvent.click(screen.getByLabelText('11/07/2026'));

    await waitFor(() => expect(screen.getByRole('button', { name: '2 biblias' })).toBeInTheDocument());
  });

  it('en vista rango sin resultados, muestra el mensaje genérico (no el de biblia sin asignar)', async () => {
    renderPage();
    await esperarTabla();
    mockDireccion.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    expect(await screen.findByText('No hay repartos con dirección para este período')).toBeInTheDocument();
  });

  it('viniendo de una biblia sin asignaciones (rangoAsignaciones null), vista rango sin resultados igual muestra el mensaje genérico', async () => {
    mockRango.mockResolvedValue(null);
    renderPage();
    await screen.findByText('No hay preparaciones asignadas a esta biblia');
    mockDireccion.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    expect(await screen.findByText('No hay repartos con dirección para este período')).toBeInTheDocument();
    expect(screen.queryByText('No hay preparaciones asignadas a esta biblia')).not.toBeInTheDocument();
  });
});

describe('ReportePage — vista resumen', () => {
  it('la grilla de tarjetas del resumen tiene el estilo esperado y el dot usa el color por estado', async () => {
    const { container } = renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    const grid = container.querySelector('.border.rounded-lg.p-3')!.parentElement as HTMLElement;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(200px, 1fr))');
    expect(grid.style.alignContent).toBe('start');
    expect(grid.style.gap).toBe('10px');
    // RESUMEN[0].preps[0].estado = 'Completada' → dot con la clase de ESTADO_DOT
    // eslint-disable-next-line testing-library/no-node-access
    const dot = container.querySelector('.w-2.h-2.rounded-full')!;
    expect(dot.className).toContain('bg-emerald-500');
  });

  it('el dot de una prep sin estado usa el color por defecto', async () => {
    mockResumen.mockResolvedValue([{
      ...RESUMEN[0],
      preps: [{ id: 11, estado: null as unknown as string, codigo_envio: 'E-11', importe_total: 1000, cantidad_pedidos: 3, peso: 2, volumen: 0 }],
    }]);
    const { container } = renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    // eslint-disable-next-line testing-library/no-node-access
    const dot = container.querySelector('.w-2.h-2.rounded-full')!;
    expect(dot.className).toContain('bg-slate-300');
  });

  it('no muestra los botones expandir/contraer todo en vista resumen ni mapa', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    expect(screen.queryByTitle('Expandir todo')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Contraer todo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    await screen.findByTestId('mapa');
    expect(screen.queryByTitle('Expandir todo')).not.toBeInTheDocument();
  });

  it('cambiar la fecha en vista resumen dispara un nuevo fetch del resumen', async () => {
    locationState = { view: 'resumen', bibliaFecha: '2026-07-09' };
    renderPage();
    await screen.findByText('García');
    const input = screen.getByDisplayValue('2026-07-09') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-07-20' } });
    await waitFor(() => expect(mockResumen).toHaveBeenLastCalledWith('2026-07-20'));
  });

  it('muestra las tarjetas del resumen', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    expect(await screen.findByText('García')).toBeInTheDocument();
    // el importe aparece en la tarjeta (total) y en la fila de la prep
    expect(screen.getAllByText('$ 1.000').length).toBeGreaterThan(0);
    expect(screen.getByText('E-11')).toBeInTheDocument();
    expect(screen.getByText(/1 chofer ·/)).toBeInTheDocument();
  });

  it('el contador del header del resumen usa plural con 2+ choferes', async () => {
    mockResumen.mockResolvedValue([
      ...RESUMEN,
      { ...RESUMEN[0], chofer_codigo: 'CH2', chofer_nombre: 'López' },
    ]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    expect(await screen.findByText(/2 choferes ·/)).toBeInTheDocument();
  });

  it('muestra el vacío sin choferes', async () => {
    mockResumen.mockResolvedValue([]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    expect(await screen.findByText('No hay choferes asignados a esta biblia')).toBeInTheDocument();
  });

  it('tarjeta: sin peso/volumen/códigos, no muestra esas secciones', async () => {
    mockResumen.mockResolvedValue([{ ...RESUMEN[0], total_peso: 0, total_volumen: 0, codigos_despacho: [] }]);
    const { container } = renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    expect(screen.queryByText(/kg$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/m³$/)).not.toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access
    expect(container.querySelector('.flex-wrap.gap-1')).not.toBeInTheDocument();
  });

  it('tarjeta: con peso y volumen positivos, los muestra formateados con coma decimal', async () => {
    mockResumen.mockResolvedValue([{ ...RESUMEN[0], total_peso: 2, total_volumen: 1.5 }]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    expect(screen.getByText('2,00')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('BIG')).toBeInTheDocument();
  });

  it('exporta el resumen a excel', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');

    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(mockWriteFile).toHaveBeenCalled();
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data[0]).toEqual(['CHOFER', 'CÓDIGO', 'PREPS', 'IMPORTE', 'PEDIDOS', 'CLIENTES', 'PESO (kg)', 'VOLUMEN (m³)', 'CÓDIGOS DE DESPACHO']);
    expect(data[1]).toEqual(['García', 'CH1', 1, 1000, 3, 2, 2, 0, 'BIG']);
    const ws = lastSheet();
    expect(ws['!cols']).toEqual([{ wch: 26 }, { wch: 10 }, { wch: 7 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 13 }, { wch: 30 }]);
  });

  it('exporta el resumen a excel con el nombre de hoja "Resumen biblia <fecha>"', async () => {
    locationState = { view: 'resumen', bibliaFecha: '2026-07-09' };
    renderPage();
    await screen.findByText('García');
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    const bookAppend = vi.mocked(XLSX.utils.book_append_sheet);
    expect(bookAppend.mock.calls[0][2]).toBe('Resumen biblia 09/07/2026');
  });
});

describe('ReportePage — clases del contenedor de contenido según la vista', () => {
  it('vista biblia (default): scroll vertical con padding, sin overflow-hidden', async () => {
    const { container } = renderPage();
    await esperarTabla();
    const content = container.querySelector('div[class*="flex-1 print:p-0"]')!;
    expect(content.className).toContain('p-6 overflow-y-auto');
    expect(content.className).not.toContain('overflow-hidden');
  });

  it('vista mapa: overflow-hidden con padding chico, sin scroll ni flex', async () => {
    const { container } = renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    await screen.findByTestId('mapa');
    const content = container.querySelector('div[class*="flex-1 print:p-0"]')!;
    expect(content.className).toContain('overflow-hidden p-3');
    expect(content.className).not.toContain('overflow-y-auto');
    expect(content.className).not.toContain('overflow-hidden flex');
  });

  it('vista personalizado: overflow-hidden flex, sin scroll ni padding de biblia', async () => {
    const { container } = renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(mockDireccion).toHaveBeenCalledTimes(2));
    const content = container.querySelector('div[class*="flex-1 print:p-0"]')!;
    expect(content.className).toContain('overflow-hidden flex');
    expect(content.className).not.toContain('p-6 overflow-y-auto');
    expect(content.className).not.toContain('overflow-hidden p-3');
  });
});

describe('ReportePage — pestañas activas/inactivas y botones de modo', () => {
  it('solo la pestaña de la vista activa tiene el estilo activo; el resto usa el estilo inactivo', async () => {
    renderPage();
    await esperarTabla();
    const activa = screen.getByRole('button', { name: 'Vista biblia' });
    const inactivas = ['Vista rango de fechas', 'Personalizado', 'Resumen', 'Mapa'].map(n => screen.getByRole('button', { name: n }));
    expect(activa.className).toContain('border-blue-600 text-blue-600');
    for (const btn of inactivas) {
      expect(btn.className).not.toContain('border-blue-600 text-blue-600');
      expect(btn.className).toContain('border-transparent text-slate-500');
    }
  });

  it('los botones de modo de mapa (Zona/Chofer/Código de despacho) no aparecen fuera de vista mapa', async () => {
    renderPage();
    await esperarTabla();
    expect(screen.queryByRole('button', { name: 'Zona' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chofer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Código de despacho' })).not.toBeInTheDocument();
  });
});

describe('ReportePage — vista mapa', () => {
  it('cambiar la fecha en vista mapa dispara un nuevo fetch del mapa de clientes', async () => {
    locationState = { bibliaFecha: '2026-07-09' };
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    await screen.findByTestId('mapa');
    const input = screen.getByDisplayValue('2026-07-09') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-07-20' } });
    await waitFor(() => expect(mockMapa).toHaveBeenLastCalledWith('2026-07-09', '2026-07-09', '2026-07-20'));
  });

  it('carga los clientes y arma los pines', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    await waitFor(() => {
      expect(mockMapa).toHaveBeenCalledWith('2026-07-09', '2026-07-09', expect.any(String));
      expect(screen.getByTestId('mapa')).toHaveAttribute('data-pines', '1');
    });
    // botones de modo visibles
    expect(screen.getByRole('button', { name: 'Código de despacho' })).toBeInTheDocument();
  });

  it('cambia el modo de agrupación del mapa (Zona / Chofer)', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    await screen.findByTestId('mapa');

    const btnZona = screen.getByRole('button', { name: 'Zona' });
    const btnChofer = screen.getByRole('button', { name: 'Chofer' });
    expect(btnZona.className).toContain('bg-slate-800 text-white border-slate-800');
    expect(btnChofer.className).toContain('bg-white text-slate-600 border-slate-200');

    fireEvent.click(btnChofer);
    expect(btnChofer.className).toContain('bg-slate-800 text-white border-slate-800');
    expect(btnZona.className).toContain('bg-white text-slate-600 border-slate-200');

    fireEvent.click(screen.getByRole('button', { name: 'Código de despacho' }));

    expect(screen.getByTestId('mapa')).toBeInTheDocument();
  });

  it('muestra loading mientras se resuelve el rango de biblia, aunque el mapa ya haya cargado', async () => {
    let resolveMapa!: (v: MapaCliente[]) => void;
    mockMapa.mockReturnValue(new Promise(res => { resolveMapa = res; }));
    let resolveRango!: (v: { fecha_desde: string; fecha_hasta: string }) => void;
    mockRango.mockReturnValue(new Promise(res => { resolveRango = res; }));
    render(<MemoryRouter><ReportePage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    resolveMapa([]);
    await waitFor(() => expect(screen.getByTestId('mapa')).toHaveAttribute('data-loading', 'true'));
    resolveRango({ fecha_desde: '2026-07-09', fecha_hasta: '2026-07-09' });
    await waitFor(() => expect(screen.getByTestId('mapa')).toHaveAttribute('data-loading', 'false'));
  });
});

describe('ReportePage — vista personalizado', () => {
  it('cambiar la fecha en vista personalizado dispara un nuevo fetch de repartos', async () => {
    locationState = { bibliaFecha: '2026-07-09' };
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(mockDireccion).toHaveBeenCalledTimes(2));
    const input = screen.getByDisplayValue('2026-07-09') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-07-20' } });
    await waitFor(() => expect(mockRango).toHaveBeenLastCalledWith('2026-07-20'));
  });

  it('lista los choferes disponibles (excluye sin asignar) y arma el reporte al seleccionarlos', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    // Cambiar de vista dispara un re-fetch cuyo .then resetea la selección de choferes.
    // Esperar a que asiente antes de interactuar, o el click puede perderse en la carrera.
    await waitFor(() => expect(mockDireccion).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Seleccioná choferes en el panel izquierdo')).toBeInTheDocument());

    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());
    expect(screen.queryByLabelText('SIN ASIGNAR')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Título del reporte'), { target: { value: 'Reporte Camión 1' } });
    // Mismo patrón de click con reintento que en el test de "Todos" (ver abajo).
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('García'));
      // tabla plana con el título como sección
      expect(screen.getByText('Reporte Camión 1')).toBeInTheDocument();
      expect(screen.getByText('2 códigos de despacho')).toBeInTheDocument();
    }, { timeout: 10000 });
    expect(screen.queryByText('SIN ASIGNAR')).not.toBeInTheDocument();
  });

  it('excluye del panel de choferes a los repartos sin chofer_codigo aunque el caso no sea sin_asignar', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [
        makeReparto(),
        makeReparto({ chofer_nombre: 'Anónimo', chofer_codigo: '', caso: 'propia', codigo_numerico: 9, nombre: 'X' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());
    expect(screen.queryByLabelText('Anónimo')).not.toBeInTheDocument();
  });

  it('excluye del panel a un reparto con caso "sin_asignar" aunque SÍ tenga chofer_codigo', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [
        makeReparto(),
        makeReparto({ chofer_nombre: 'Temporal', chofer_codigo: 'CHX', caso: 'sin_asignar', codigo_numerico: 9, nombre: 'X' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());
    expect(screen.queryByLabelText('Temporal')).not.toBeInTheDocument();
  });

  it('con 2 repartos del mismo chofer_codigo, conserva el primer chofer_nombre visto (no lo pisa el segundo)', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [
        makeReparto({ chofer_codigo: 'CH1', chofer_nombre: 'García' }),
        makeReparto({ chofer_codigo: 'CH1', chofer_nombre: 'García (alias)', codigo_numerico: 2, nombre: 'OTRO' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());
    expect(screen.queryByLabelText('García (alias)')).not.toBeInTheDocument();
  });

  it('lista los choferes del panel ordenados alfabéticamente', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [
        makeReparto({ chofer_nombre: 'Zeta', chofer_codigo: 'CHZ', codigo_numerico: 5, nombre: 'Z' }),
        makeReparto({ chofer_nombre: 'Alfa', chofer_codigo: 'CHA', codigo_numerico: 6, nombre: 'A' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    // Ver comentario más arriba: el cambio de vista puede disparar recargas que
    // limpian momentáneamente la lista; reintentar hasta que asiente.
    await waitFor(() => {
      const labels = screen.getAllByRole('checkbox').slice(1).map(cb => cb.closest('label')!.textContent);
      expect(labels).toEqual(['Alfa', 'Zeta']);
    }, { timeout: 10000 });
  });

  it('destildar un chofer ya seleccionado lo saca de la selección', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());

    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('García'));
      expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    }, { timeout: 10000 });

    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('García'));
      expect(screen.getByText('Seleccioná choferes en el panel izquierdo')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('destildar "Todos" (con todos ya seleccionados) vacía la selección', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('Todos'));
      expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
    }, { timeout: 10000 });

    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('Todos'));
      expect(screen.getByText('Seleccioná choferes en el panel izquierdo')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('"Todos" selecciona todos los choferes', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    // Ver comentario en el test anterior: el cambio de vista puede disparar hasta dos
    // recargas (rango + repartos) que resetean la selección al resolver. Reintentar el
    // click dentro del waitFor converge: si una recarga limpió la selección, el checkbox
    // queda destildado y el próximo intento vuelve a seleccionar todo.
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('Todos'));
      expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
      // García y López presentes (sidebar y tabla)
      expect(screen.getAllByText('López').length).toBeGreaterThan(1);
    }, { timeout: 10000 });
  });

  it('el contador del header en vista personalizada usa singular/plural correcto', async () => {
    const { container } = renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(mockDireccion).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());

    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('García'));
      const header = container.querySelector('.text-blue-200.text-sm.hidden.sm\\:inline')!;
      // García (CH1) tiene 2 repartos (LANUS 2, ver GRUPOS) en 1 dirección (LOMAS).
      expect(header.textContent).toBe('2 repartos · 1 dirección');
    }, { timeout: 10000 });
  });

  it('el contador del header en vista personalizada usa plural de direcciones con 2+', async () => {
    mockDireccion.mockResolvedValue([
      { direccion: 'LOMAS', total_clientes_unicos: 1, repartos: [makeReparto({ chofer_codigo: 'CH1', chofer_nombre: 'García' })] },
      { direccion: 'SUR', total_clientes_unicos: 1, repartos: [makeReparto({ chofer_codigo: 'CH1', chofer_nombre: 'García', codigo_numerico: 2, nombre: 'S1' })] },
    ]);
    const { container } = renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('García'));
      const header = container.querySelector('.text-blue-200.text-sm.hidden.sm\\:inline')!;
      expect(header.textContent).toBe('2 repartos · 2 direcciónes');
    }, { timeout: 10000 });
  });

  it('sin ningún chofer seleccionado, "Expandir todo"/"Contraer todo" no se muestran (activeGruposMostrados usa personalFlatMostrados, no gruposMostrados)', async () => {
    renderPage();
    await esperarTabla();
    // en vista biblia (default), con datos cargados, el botón está visible
    expect(screen.getByTitle('Expandir todo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(mockDireccion).toHaveBeenCalledTimes(2));
    // sin choferes seleccionados, personalFlatMostrados queda vacío aunque gruposMostrados no lo esté
    expect(screen.queryByTitle('Expandir todo')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Contraer todo')).not.toBeInTheDocument();
  });

  it('editar el código de despacho en vista personalizado actualiza el input', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(mockDireccion).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());

    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('García'));
      expect(screen.getByText('2 códigos de despacho')).toBeInTheDocument();
    }, { timeout: 10000 });

    const grupoRow = screen.getByText('2 códigos de despacho').closest('tr')!;
    fireEvent.click(within(grupoRow).getByRole('button'));
    const input = screen.getByDisplayValue('PERI 5');
    fireEvent.change(input, { target: { value: 'PERI 5 BIS' } });
    expect(screen.getByDisplayValue('PERI 5 BIS')).toBeInTheDocument();
  });

  it('el footer suma los totales de todos los repartos seleccionados y expandir muestra el detalle', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(mockDireccion).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());

    await waitFor(() => {
      fireEvent.click(screen.getByLabelText('García'));
      expect(screen.getByText('2 códigos de despacho')).toBeInTheDocument();
    }, { timeout: 10000 });

    // García: BIG (agr=1,cons=0,ind=2,imp=1000,ped=3,cli=2) + PERI 5 (agr=0,cons=0,ind=0... valores default de makeReparto salvo los seteados)
    const filaTotal = screen.getByText('TOTAL').closest('tr')!;
    const celdas = within(filaTotal).getAllByRole('cell');
    // AGRUP. DIR. = 1(BIG) + 1(PERI 5, valor por defecto de makeReparto) = 2
    expect(celdas[4].textContent).toBe('2');
    // CONSOLIDADO = 0 + 0 = 0
    expect(celdas[5].textContent).toBe('0');
    // INDIVIDUAL = 2 + 2 = 4
    expect(celdas[6].textContent).toBe('4');
    // IMPORTE = 1000 + 500
    expect(celdas[7].textContent).toContain('1.500');
    // CANT. PED. = 3 + 1
    expect(celdas[8].textContent).toBe('4');
    // CANT. CLIENTES = 2 + 1 (3 únicos: CL1, CL2, CL3)
    expect(celdas[9].textContent).toMatch(/^3\s/);
    expect(celdas[9].textContent).toContain('(3 únicos)');

    // expandir el grupo multi-código muestra el detalle de cada código
    const grupoRow = screen.getByText('2 códigos de despacho').closest('tr')!;
    expect(grupoRow.className).toContain('hover:bg-slate-50');
    expect(grupoRow.className).toContain('font-medium');
    fireEvent.click(within(grupoRow).getByRole('button'));
    expect(screen.getByDisplayValue('PERI 5')).toBeInTheDocument();
    // BIG tiene 1 sola prep → su detalle se muestra automáticamente al expandir el grupo
    expect(screen.getByText(/Prep. #11/)).toBeInTheDocument();
    // PERI 5 tiene 2 preps → su detalle no se muestra hasta expandirlo aparte
    expect(screen.queryByText(/Prep. #12/)).not.toBeInTheDocument();
  });
});

describe('ReportePage — dropdowns Excel/Imprimir', () => {
  it('clickear afuera del menú Excel lo cierra', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    expect(screen.getByRole('button', { name: 'Formato actual' })).toBeInTheDocument();

    // eslint-disable-next-line testing-library/no-node-access
    fireEvent.click(document.querySelector('.fixed.inset-0.z-40')!);

    expect(screen.queryByRole('button', { name: 'Formato actual' })).not.toBeInTheDocument();
  });

  it('clickear afuera del menú Imprimir lo cierra', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(screen.getByRole('button', { name: 'Formato biblia' })).toBeInTheDocument();

    // eslint-disable-next-line testing-library/no-node-access
    fireEvent.click(document.querySelector('.fixed.inset-0.z-40')!);

    expect(screen.queryByRole('button', { name: 'Formato biblia' })).not.toBeInTheDocument();
  });
});

describe('ReportePage — exportación excel de repartos', () => {
  it('formato biblia: headers, dirección y merge del chofer multi-fila', async () => {
    locationState = { bibliaFecha: '2026-07-09' };
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockWriteFile.mock.calls[0][1]).toBe('reporte-por-direccion-2026-07-09-biblia.xlsx');
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data[0]).toEqual(['NOMBRE FLETERO', 'CÓDIGO DE DESPACHO', 'N° PREP', 'IMPORTE', 'CANT. PED.', 'CANT. CLI.']);
    // fila de dirección presente
    expect(data.some(row => row[0] === 'LOMAS')).toBe(true);
    // García aparece una sola vez (las filas siguientes van vacías para el merge)
    const garciaRows = data.filter(row => row[0] === 'García');
    expect(garciaRows).toHaveLength(1);
  });

  it('formato actual: una fila por reparto con todos los campos', async () => {
    locationState = { bibliaFecha: '2026-07-09' };
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato actual' }));
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data[0]).toEqual(['NOMBRE FLETERO', 'NRO', 'CÓDIGO DE DESPACHO', 'AGRUP. DIR.', 'CONSOLIDADO', 'INDIVIDUAL', 'IMPORTE', 'CANT. PED.', 'CANT. CLIENTES']);
    expect(data.some(row => row[0] === 'García' && row[2] === 'BIG')).toBe(true);
    expect(mockWriteFile.mock.calls[0][1]).toBe('reporte-por-direccion-2026-07-09-actual.xlsx');
  });

  it('la exportación usa los códigos editados', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.change(screen.getByDisplayValue('SUR 1'), { target: { value: 'SUR 1 BIS' } });
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato actual' }));
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data.some(row => row[2] === 'SUR 1 BIS')).toBe(true);
  });

  it('formato biblia: fusiona la celda del chofer con 2 repartos y no fusiona la de 1 solo reparto', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    const ws = lastSheet();
    // header(0) + spacer(1) + LOMAS(2) + García(3,4 - 2 filas, orden alfabético) + SIN ASIGNAR(5)
    // + spacer(6) + SUR(7) + López(8)
    const garciaStart = data.findIndex(row => row[0] === 'García');
    expect(garciaStart).toBeGreaterThan(0);
    expect(ws['!merges']).toContainEqual({ s: { r: garciaStart, c: 0 }, e: { r: garciaStart + 1, c: 0 } });
    // López (SUR) tiene un solo reparto: no debe generar merge para su fila
    const lopezRow = data.findIndex(row => row[0] === 'López');
    expect(ws['!merges']).not.toContainEqual(expect.objectContaining({ s: { r: lopezRow, c: 0 } }));
  });

  it('formato biblia: agrega la fila espaciadora y la fila de dirección con el texto exacto esperado', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data[1]).toEqual([]);
    expect(data[2]).toEqual(['LOMAS', '', '', '', '', '']);
  });

  it('formato biblia: setea los anchos de columna esperados', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
    const ws = lastSheet();
    expect(ws['!cols']).toEqual([{ wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]);
  });

  it('formato actual: agrega la fila espaciadora y la fila de dirección con el texto exacto esperado', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato actual' }));
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    expect(data[1]).toEqual([]);
    expect(data[2]).toEqual(['', '', 'LOMAS', '', '', '', '', '', '']);
  });

  it('formato actual: setea los anchos de columna esperados', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato actual' }));
    const ws = lastSheet();
    expect(ws['!cols']).toEqual([{ wch: 22 }, { wch: 8 }, { wch: 26 }, { wch: 11 }, { wch: 13 }, { wch: 11 }, { wch: 14 }, { wch: 12 }, { wch: 15 }]);
  });

  it('formato actual: cada fila de reparto trae todos los campos numéricos exactos', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato actual' }));
    const data = mockAoa.mock.calls[0][0] as unknown[][];
    const fila = data.find(row => row[0] === 'García' && row[2] === 'BIG')!;
    expect(fila).toEqual(['García', 1, 'BIG', 1, 0, 2, 1000, 3, 2]);
  });
});

describe('ReportePage — impresión', () => {
  function mockPrintWindow() {
    const w = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window);
    return w;
  }

  it('formato actual imprime la página con window.print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato actual' }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('formato biblia arma una ventana con una sección por dirección', async () => {
    vi.useFakeTimers();
    try {
      const w = mockPrintWindow();
      renderPage();
      await vi.waitFor(() => expect(seccion('LOMAS')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
      const html = w.document.write.mock.calls.map(c => c[0]).join('');
      expect(html).toContain('Biblia para el');
      expect(html).toContain('LOMAS');
      expect(html).toContain('SUR');
      expect(html).toContain('García');
      expect(html).toContain('sin-asignar'); // fila marcada en rojo
      expect(w.document.close).toHaveBeenCalled();
      vi.advanceTimersByTime(500);
      expect(w.print).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it('formato biblia: cierra cada sección exactamente una vez por dirección y llama focus()', async () => {
    const w = mockPrintWindow();
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    // 2 direcciones (LOMAS, SUR) → 2 cierres de sección, ninguno de más
    expect(html.split('</table></div>').length - 1).toBe(2);
    expect(html).toContain('</body></html>');
    expect(w.focus).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('formato biblia: el rowspan de la celda del chofer coincide con su cantidad de repartos', async () => {
    const w = mockPrintWindow();
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    // García tiene 2 repartos en LOMAS
    expect(html).toContain('rowspan="2"');
    // López (SUR) tiene 1 solo reparto: rowspan="1"
    const lopezIdx = html.indexOf('López');
    expect(html.slice(lopezIdx - 60, lopezIdx)).toContain('rowspan="1"');
    vi.restoreAllMocks();
  });

  it('formato biblia: incluye el encabezado de tabla exacto', async () => {
    const w = mockPrintWindow();
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('<tr><th>NOMBRE FLETERO</th><th>CÓDIGO DE DESPACHO</th><th>N° PREP</th><th>IMPORTE</th><th>CANT. PED.</th><th>CANT. CLI.</th></tr>');
    vi.restoreAllMocks();
  });

  it('el resumen imprime las tarjetas por chofer', async () => {
    const w = mockPrintWindow();
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    // hay dos botones "Resumen": la pestaña y el ítem del menú de impresión (ítem = block w-full)
    const itemMenu = screen.getAllByRole('button', { name: 'Resumen' })
      .find(b => b.className.includes('w-full'))!;
    fireEvent.click(itemMenu);
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('Resumen biblia');
    expect(html).toContain('García');
    expect(html).toContain('E-11');
    vi.restoreAllMocks();
  });

  function abrirImprimirResumen() {
    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    const itemMenu = screen.getAllByRole('button', { name: 'Resumen' })
      .find(b => b.className.includes('w-full'))!;
    fireEvent.click(itemMenu);
  }

  it('resumen: usa el total sumado de todos los choferes y el singular con 1 chofer', async () => {
    locationState = { view: 'resumen', bibliaFecha: '2026-07-09' };
    const w = mockPrintWindow();
    renderPage();
    await screen.findByText('García');
    abrirImprimirResumen();
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('<p>1 chofer · $ 1.000</p>');
    vi.restoreAllMocks();
  });

  it('resumen: usa el plural con 2+ choferes y capitaliza el día de la semana', async () => {
    locationState = { view: 'resumen', bibliaFecha: '2026-07-09' };
    mockResumen.mockResolvedValue([
      RESUMEN[0],
      { ...RESUMEN[0], chofer_codigo: 'CH2', chofer_nombre: 'López', total_importe: 500 },
    ]);
    const w = mockPrintWindow();
    renderPage();
    await screen.findByText('García');
    abrirImprimirResumen();
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('<p>2 choferes · $ 1.500</p>');
    // 2026-07-09 es jueves: se capitaliza la primera letra del día
    expect(html).toMatch(/<h2>Resumen biblia — Jueves/);
    vi.restoreAllMocks();
  });

  it('resumen: sin peso/volumen ni códigos de despacho, no muestra esas secciones', async () => {
    mockResumen.mockResolvedValue([{
      ...RESUMEN[0],
      total_peso: 0,
      total_volumen: 0,
      codigos_despacho: [],
    }]);
    const w = mockPrintWindow();
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    abrirImprimirResumen();
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).not.toContain('kg</b>');
    expect(html).not.toContain('m³</b>');
    expect(html).not.toContain('class="codigos"');
    expect(html).toContain('<div class="preps">');
    vi.restoreAllMocks();
  });

  it('resumen: con estado y código de envío nulos, usa los fallbacks (dot sin estado, #id)', async () => {
    mockResumen.mockResolvedValue([{
      ...RESUMEN[0],
      preps: [{ id: 11, estado: null as unknown as string, codigo_envio: null, importe_total: 1000, cantidad_pedidos: 3, peso: 2, volumen: 0 }],
    }]);
    const w = mockPrintWindow();
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    abrirImprimirResumen();
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('class="dot estado-"');
    expect(html).toContain('class="prep-cod">#11<');
    vi.restoreAllMocks();
  });

  it('resumen: con peso y volumen positivos, los muestra formateados', async () => {
    mockResumen.mockResolvedValue([{ ...RESUMEN[0], total_volumen: 1.5 }]);
    const w = mockPrintWindow();
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));
    await screen.findByText('García');
    abrirImprimirResumen();
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('2,00</b> kg');
    expect(html).toContain('1,500</b> m³');
    expect(html).toContain('class="codigos"');
    expect(html).toContain('class="cod">BIG</span>');
    vi.restoreAllMocks();
  });

  it('personalizado imprime en formato biblia sin secciones por dirección', async () => {
    const w = mockPrintWindow();
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await waitFor(() => expect(screen.getByLabelText('García')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Título del reporte'), { target: { value: 'Mi título' } });
    fireEvent.click(screen.getByLabelText('García'));
    await screen.findByText('Mi título');

    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Formato biblia' }));
    const html = w.document.write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain('Reporte personalizado');
    expect(html).toContain('Mi título');
    vi.restoreAllMocks();
  });
});

describe('ReportePage — expansión en vista rango', () => {
  it('expande el grupo multi-código mostrando la fecha de biblia por sub-fila', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));

    const grupoRow = screen.getByText('2 códigos de despacho').closest('tr')!;
    fireEvent.click(within(grupoRow).getByRole('button'));
    expect(screen.getAllByText('↳').length).toBe(2);
    // el detalle de un código con una sola prep se muestra automáticamente
    expect(screen.getAllByText(/Prep. #11/).length).toBeGreaterThan(0);
  });

  it('"Expandir todo" en vista rango agrupa por fecha de biblia asignada (no por caso)', async () => {
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTitle('Expandir todo'));
    expect(screen.getAllByText('↳').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Prep. #12/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTitle('Contraer todo'));
    expect(screen.queryByText('↳')).not.toBeInTheDocument();
  });

  it('en vista rango, 2 repartos del mismo chofer y mismo caso pero distinta biblia asignada forman 2 grupos separados (agrupa por fecha, no por caso)', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [
        makeReparto({ chofer_nombre: 'García', caso: 'propia', biblia_fecha_asignada: '2026-07-10' }),
        makeReparto({ chofer_nombre: 'García', caso: 'propia', biblia_fecha_asignada: '2026-07-11', codigo_numerico: 2, nombre: 'OTRO' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));
    // si agrupara por caso (mismo chofer + misma caso "propia"), ambos repartos caerían en
    // 1 solo grupo con "2 códigos de despacho"; agrupando por fecha son 2 filas separadas,
    // cada una con un único código (sin el badge de multi-código).
    expect(screen.queryByText('2 códigos de despacho')).not.toBeInTheDocument();
    expect(screen.getAllByText('García').length).toBe(2);
  });

  it('en un grupo multi-código sin biblia asignada, cada sub-fila muestra el guión', async () => {
    mockDireccion.mockResolvedValue([{
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [
        makeReparto({ chofer_nombre: 'García', biblia_fecha_asignada: null }),
        makeReparto({ chofer_nombre: 'García', biblia_fecha_asignada: null, codigo_numerico: 2, nombre: 'OTRO' }),
      ],
    }]);
    renderPage();
    await esperarTabla();
    fireEvent.click(screen.getByRole('button', { name: 'Vista rango de fechas' }));
    await waitFor(() => expect(screen.getAllByText('BIBLIA').length).toBeGreaterThan(0));
    const grupoRow = screen.getByText('2 códigos de despacho').closest('tr')!;
    fireEvent.click(within(grupoRow).getByRole('button'));
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
