import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepartoExcepcionalModal } from './RepartoExcepcionalModal';
import {
  searchChoferes,
  searchCodigosDespacho,
  crearRepartoExcepcional,
  asignarChoferCodigoDespacho,
} from '@/services/bibliaApi';
import type { CodigoDespacho } from '../types/biblia';

vi.mock('@/services/bibliaApi', () => ({
  searchChoferes: vi.fn(),
  searchCodigosDespacho: vi.fn(),
  crearRepartoExcepcional: vi.fn(),
  asignarChoferCodigoDespacho: vi.fn(),
}));

const mockSearchChoferes = vi.mocked(searchChoferes);
const mockSearchCodigos = vi.mocked(searchCodigosDespacho);
const mockCrear = vi.mocked(crearRepartoExcepcional);
const mockAsignar = vi.mocked(asignarChoferCodigoDespacho);

const LOPEZ = { codigo: 'CH1', descripcion: 'López', desactivado: 0 };
const RUTA_A: CodigoDespacho = { id: 10, nombre: 'RUTA A', desactivado: 0, direccion: null };
const RUTA_B: CodigoDespacho = { id: 11, nombre: 'RUTA B', desactivado: 0, direccion: null };

function renderModal(over: Partial<Parameters<typeof RepartoExcepcionalModal>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    fecha: '2026-07-10',
    onCreado: vi.fn(),
    codigosDespachoGlobales: [] as CodigoDespacho[],
    codigosDespachoByChofer: new Map<string, CodigoDespacho[]>(),
    ...over,
  };
  const utils = render(<RepartoExcepcionalModal {...props} />);
  return { ...props, ...utils };
}

async function elegirChofer() {
  fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), {
    target: { value: 'lop' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /López/ }));
}

async function agregarRuta(nombre: string) {
  fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), {
    target: { value: 'ruta' },
  });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${nombre}$`) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchChoferes.mockResolvedValue([LOPEZ]);
  mockSearchCodigos.mockResolvedValue([RUTA_A, RUTA_B]);
  mockCrear.mockResolvedValue({ id: 1, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'RUTA A', codigo_despacho_id: '10', fecha: '2026-07-10' });
  mockAsignar.mockResolvedValue(undefined);
});

describe('RepartoExcepcionalModal', () => {
  it('el botón Agregar está deshabilitado sin chofer y sin códigos', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('al abrir, no hay dropdown de choferes, ni de códigos, ni spinners, ni error, ni chips', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: /López/ })).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeNull();
    expect(screen.queryByText(/ya existe|boom|caída/)).not.toBeInTheDocument();
    expect(document.querySelector('.bg-orange-100')).toBeNull();
    expect((screen.getByLabelText('Guardar como asignación permanente') as HTMLInputElement).checked).toBe(false);
    // Sin resultados de búsqueda, ninguno de los dos contenedores de dropdown debe existir
    // en el DOM (no alcanza con que estén vacíos: no deben renderizarse).
    expect(document.querySelectorAll('.max-h-\\[160px\\]').length).toBe(0);
    // El contenedor de chips de códigos agregados tampoco debe renderizarse sin nada agregado.
    expect(document.querySelector('.bg-slate-50.p-2')).toBeNull();
  });

  it('mientras busca chofer (antes de resolver), muestra el spinner de carga', async () => {
    let resolveSearch!: (v: typeof LOPEZ[]) => void;
    mockSearchChoferes.mockReturnValue(new Promise(res => { resolveSearch = res; }));
    vi.useFakeTimers();
    try {
      renderModal();
      fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'lop' } });
      await vi.advanceTimersByTimeAsync(300);
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      resolveSearch([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mientras busca código de despacho (antes de resolver), muestra el spinner de carga', async () => {
    let resolveSearch!: (v: CodigoDespacho[]) => void;
    renderModal();
    await elegirChofer();
    mockSearchCodigos.mockReturnValue(new Promise(res => { resolveSearch = res; }));
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });
      await vi.advanceTimersByTimeAsync(300);
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      resolveSearch([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('una búsqueda de un solo carácter SÍ dispara la búsqueda de chofer (mínimo largo 1, no 2)', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'l' } });
    await waitFor(() => expect(mockSearchChoferes).toHaveBeenCalledWith('l'));
  });

  it('una búsqueda de un solo carácter SÍ dispara la búsqueda de código de despacho', async () => {
    renderModal();
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'r' } });
    await waitFor(() => expect(mockSearchCodigos).toHaveBeenCalledWith('r'));
  });

  it('crea la excepción con el chofer y código elegidos y cierra', async () => {
    const { onCreado, onClose } = renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockCrear).toHaveBeenCalledWith({
      chofer_codigo: 'CH1',
      chofer_nombre: 'López',
      codigo_reparto: 'RUTA A',
      codigo_despacho_id: '10',
      fecha: '2026-07-10',
    });
    expect(onCreado).toHaveBeenCalled();
    expect(mockAsignar).not.toHaveBeenCalled();
    // onClose es un mock (no desmonta de verdad en el test): tras el éxito, submitting
    // debe volver a false — si no, el botón seguiría en "Agregando..." para siempre.
    expect(screen.queryByText('Agregando...')).not.toBeInTheDocument();
  });

  it('crea varias excepciones y ajusta el texto del botón', async () => {
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    await agregarRuta('RUTA B');
    const btn = screen.getByRole('button', { name: 'Agregar 2 repartos' });
    fireEvent.click(btn);
    await waitFor(() => expect(mockCrear).toHaveBeenCalledTimes(2));
  });

  it('con "guardar permanente" asigna el chofer al código y NO crea la excepción', async () => {
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    fireEvent.click(screen.getByLabelText('Guardar como asignación permanente'));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(mockAsignar).toHaveBeenCalledWith('10', 'CH1'));
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('deshabilita códigos que ya son permanentes del chofer', async () => {
    renderModal({
      codigosDespachoGlobales: [{ ...RUTA_A, choferes: ['CH1'] }],
    });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), {
      target: { value: 'ruta' },
    });
    const opcion = await screen.findByRole('button', { name: /ya es permanente/ });
    expect(opcion).toBeDisabled();
  });

  it('un código desactivado con el chofer en su lista NO cuenta como permanente (no se deshabilita)', async () => {
    renderModal({
      codigosDespachoGlobales: [{ ...RUTA_A, choferes: ['CH1'], desactivado: 1 }],
    });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), {
      target: { value: 'ruta' },
    });
    const opcion = await screen.findByRole('button', { name: /^RUTA A$/ });
    expect(opcion).toBeEnabled();
  });

  it('un código activo pero sin el chofer en su lista NO cuenta como permanente', async () => {
    renderModal({
      codigosDespachoGlobales: [{ ...RUTA_A, choferes: ['OTRO'] }],
    });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), {
      target: { value: 'ruta' },
    });
    const opcion = await screen.findByRole('button', { name: /^RUTA A$/ });
    expect(opcion).toBeEnabled();
  });

  it('un código sin nombre no puede marcarse como permanente (queda afuera del set)', async () => {
    renderModal({
      codigosDespachoGlobales: [{ ...RUTA_A, nombre: null, choferes: ['CH1'] }],
    });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), {
      target: { value: 'ruta' },
    });
    // RUTA_A (nombre null) no puede aparecer como resultado de búsqueda por nombre;
    // esto solo confirma que no rompe con nombre null.
    await waitFor(() => expect(mockSearchCodigos).toHaveBeenCalled());
  });

  it('deshabilita códigos que ya tienen excepción para ese chofer', async () => {
    renderModal({
      codigosDespachoByChofer: new Map([
        ['CH1', [{ ...RUTA_A, es_excepcion: true }]],
      ]),
    });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), {
      target: { value: 'ruta' },
    });
    const opcion = await screen.findByRole('button', { name: /ya tiene excep/ });
    expect(opcion).toBeDisabled();
  });

  it('un código con es_excepcion pero sin nombre no cuenta como excepción existente', async () => {
    renderModal({
      codigosDespachoByChofer: new Map([
        ['CH1', [{ ...RUTA_A, nombre: null, es_excepcion: true }]],
      ]),
    });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), {
      target: { value: 'ruta' },
    });
    const opcion = await screen.findByRole('button', { name: /^RUTA A$/ });
    expect(opcion).toBeEnabled();
  });

  it('un código sin es_excepcion (aunque esté en la lista del chofer) no cuenta como excepción existente', async () => {
    renderModal({
      codigosDespachoByChofer: new Map([
        ['CH1', [{ ...RUTA_A, es_excepcion: false }]],
      ]),
    });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), {
      target: { value: 'ruta' },
    });
    const opcion = await screen.findByRole('button', { name: /^RUTA A$/ });
    expect(opcion).toBeEnabled();
  });

  it('los códigos agregados se pueden quitar antes de guardar', async () => {
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    const chip = screen.getByText('RUTA A', { selector: 'span' });
    fireEvent.click(chip.querySelector('button')!);
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('ante un fallo parcial conserva los que faltan y muestra el error', async () => {
    mockCrear
      .mockResolvedValueOnce({ id: 1, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'RUTA A', codigo_despacho_id: '10', fecha: '2026-07-10' })
      .mockRejectedValueOnce(new Error('ya existe'));
    const { onCreado, onClose } = renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    await agregarRuta('RUTA B');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar 2 repartos' }));
    expect(await screen.findByText('ya existe')).toBeInTheDocument();
    expect(onCreado).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // queda solo RUTA B (la que falló) para reintentar
    expect(screen.queryByText('RUTA A', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText('RUTA B', { selector: 'span' })).toBeInTheDocument();
  });

  it('al cerrar y reabrir, resetea todo el estado (chofer, query, códigos agregados, checkbox, error)', async () => {
    mockCrear.mockRejectedValueOnce(new Error('boom'));
    const { rerender } = renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    fireEvent.click(screen.getByLabelText('Guardar como asignación permanente'));
    // Guardar permanente con RUTA A ya agregada — no genera error acá, forcemos vía crear:
    fireEvent.click(screen.getByLabelText('Guardar como asignación permanente')); // vuelve a false
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText('boom');

    rerender(<RepartoExcepcionalModal
      open={false}
      onClose={vi.fn()}
      fecha="2026-07-10"
      onCreado={vi.fn()}
      codigosDespachoGlobales={[]}
      codigosDespachoByChofer={new Map()}
    />);
    rerender(<RepartoExcepcionalModal
      open={true}
      onClose={vi.fn()}
      fecha="2026-07-10"
      onCreado={vi.fn()}
      codigosDespachoGlobales={[]}
      codigosDespachoByChofer={new Map()}
    />);

    expect(screen.getByPlaceholderText('Escribí nombre o código...')).toHaveValue('');
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
    expect(document.querySelector('.bg-red-50.border-red-200')).toBeNull();
    expect(screen.queryByText('RUTA A', { selector: 'span' })).not.toBeInTheDocument();
    expect((screen.getByLabelText('Guardar como asignación permanente') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('un fallo a mitad de una lista de 3 conserva TODOS los que quedan por intentar (no solo el último)', async () => {
    const RUTA_C: CodigoDespacho = { id: 12, nombre: 'RUTA C', desactivado: 0, direccion: null };
    mockSearchCodigos
      .mockResolvedValueOnce([RUTA_A])
      .mockResolvedValueOnce([RUTA_B])
      .mockResolvedValueOnce([RUTA_C]);
    mockCrear
      .mockResolvedValueOnce({ id: 1, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'RUTA A', codigo_despacho_id: '10', fecha: '2026-07-10' })
      .mockRejectedValueOnce(new Error('ya existe'));
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    await agregarRuta('RUTA B');
    await agregarRuta('RUTA C');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar 3 repartos' }));
    expect(await screen.findByText('ya existe')).toBeInTheDocument();
    // RUTA_A ya se creó (se descarta); RUTA_B (la que falló) y RUTA_C (nunca se intentó) quedan las DOS para reintentar.
    expect(screen.queryByText('RUTA A', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText('RUTA B', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('RUTA C', { selector: 'span' })).toBeInTheDocument();
  });

  it('borrar el texto de búsqueda de chofer vacía la lista de resultados', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'lop' } });
    await screen.findByRole('button', { name: /López/ });

    fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: '' } });

    expect(screen.queryByRole('button', { name: /López/ })).not.toBeInTheDocument();
  });

  it('borrar el texto de búsqueda de reparto vacía la lista de resultados', async () => {
    renderModal();
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });
    await screen.findByRole('button', { name: /^RUTA A$/ });

    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: '' } });

    expect(screen.queryByRole('button', { name: /^RUTA A$/ })).not.toBeInTheDocument();
  });

  it('si falla la búsqueda de choferes, no rompe y deja la lista vacía', async () => {
    mockSearchChoferes.mockRejectedValueOnce(new Error('caída'));
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'lop' } });
    await waitFor(() => expect(mockSearchChoferes).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: /López/ })).not.toBeInTheDocument());
  });

  it('tras fallar la búsqueda de choferes, el spinner de carga desaparece', async () => {
    mockSearchChoferes.mockRejectedValueOnce(new Error('caída'));
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'lop' } });
    await waitFor(() => expect(mockSearchChoferes).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
  });

  it('si falla la búsqueda de códigos de despacho, no rompe y deja la lista vacía', async () => {
    mockSearchCodigos.mockRejectedValueOnce(new Error('caída'));
    renderModal();
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });
    await waitFor(() => expect(mockSearchCodigos).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: /^RUTA A$/ })).not.toBeInTheDocument());
  });

  it('tras fallar la búsqueda de códigos, el spinner de carga desaparece', async () => {
    mockSearchCodigos.mockRejectedValueOnce(new Error('caída'));
    renderModal();
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });
    await waitFor(() => expect(mockSearchCodigos).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());
  });

  it('agregar un código de despacho devuelve el foco al input de búsqueda de reparto', async () => {
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    expect(screen.getByPlaceholderText('Buscar y agregar códigos...')).toHaveFocus();
  });

  it('elegir un chofer nuevo descarta los códigos ya agregados', async () => {
    mockSearchChoferes.mockResolvedValue([LOPEZ, { codigo: 'CH2', descripcion: 'García', desactivado: 0 }]);
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    expect(screen.getByText('RUTA A', { selector: 'span' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'gar' } });
    fireEvent.click(await screen.findByRole('button', { name: /García/ }));

    expect(screen.queryByText('RUTA A', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('al desmontar con un debounce pendiente, limpia los timers sin romper', () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'lop' } });
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });

    expect(() => unmount()).not.toThrow();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('el checkbox "guardar permanente" alterna con cada click', () => {
    renderModal();
    const checkbox = screen.getByLabelText('Guardar como asignación permanente') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('un código ya agregado no se puede agregar de nuevo (no duplica el chip)', async () => {
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    // Buscar de nuevo y clickear la opción ya agregada (deshabilitada, marcada "ya agregado")
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });
    const opcionYaAgregada = await screen.findByRole('button', { name: /ya agregado/ });
    expect(opcionYaAgregada).toBeDisabled();
    fireEvent.click(opcionYaAgregada);
    expect(screen.getAllByText('RUTA A', { selector: 'span' })).toHaveLength(1);
  });

  it('el botón Agregar sigue deshabilitado con chofer elegido pero sin códigos agregados', async () => {
    renderModal();
    await elegirChofer();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('el botón Agregar sigue deshabilitado con códigos buscados pero sin chofer elegido', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });
    await screen.findByRole('button', { name: /^RUTA A$/ });
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('con exactamente 1 código agregado, el botón dice "Agregar" (no "Agregar 1 repartos")', async () => {
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agregar 1/ })).not.toBeInTheDocument();
  });

  it('Cancelar llama a onClose sin guardar nada', async () => {
    const { onClose } = renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('la lista de choferes no se muestra si ya hay uno seleccionado (aunque la búsqueda quedara con resultados)', async () => {
    renderModal();
    await elegirChofer();
    expect(screen.queryByRole('button', { name: /López \(#CH1\)/ })).not.toBeInTheDocument();
  });

  it('el placeholder de chofer muestra "descripción (#código)" una vez seleccionado', async () => {
    renderModal();
    await elegirChofer();
    expect(screen.getByPlaceholderText('Escribí nombre o código...')).toHaveValue('López (#CH1)');
  });

  it('escribir de nuevo antes de que dispare el debounce anterior lo cancela (una sola búsqueda)', async () => {
    vi.useFakeTimers();
    try {
      renderModal();
      fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'l' } });
      fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'lo' } });
      vi.advanceTimersByTime(400);
      await vi.waitFor(() => expect(mockSearchChoferes).toHaveBeenCalledTimes(1));
      expect(mockSearchChoferes).toHaveBeenCalledWith('lo');
    } finally {
      vi.useRealTimers();
    }
  });

  it('un chofer que no tiene entrada en codigosDespachoByChofer no cuenta ningún código como excepción existente', async () => {
    renderModal({
      codigosDespachoByChofer: new Map([['OTRO_CHOFER', [{ ...RUTA_A, es_excepcion: true }]]]),
    });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });
    const opcion = await screen.findByRole('button', { name: /^RUTA A$/ });
    expect(opcion).toBeEnabled();
  });

  it('sin códigos buscados, no se renderiza el dropdown de resultados', async () => {
    mockSearchCodigos.mockResolvedValue([]);
    renderModal();
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'zzz' } });
    await waitFor(() => expect(mockSearchCodigos).toHaveBeenCalled());
    expect(document.querySelector('.max-h-\\[160px\\]')).toBeNull();
  });

  it('una opción deshabilitada usa el estilo gris/cursor-default; una habilitada usa hover', async () => {
    renderModal({ codigosDespachoGlobales: [{ ...RUTA_A, choferes: ['CH1'] }] });
    await elegirChofer();
    fireEvent.change(screen.getByPlaceholderText('Buscar y agregar códigos...'), { target: { value: 'ruta' } });
    const opcionA = await screen.findByRole('button', { name: /ya es permanente/ });
    expect(opcionA.className).toContain('bg-slate-100');
    expect(opcionA.className).toContain('cursor-default');
    const opcionB = screen.getByRole('button', { name: /^RUTA B$/ });
    expect(opcionB.className).toContain('hover:bg-slate-100');
    expect(opcionB.className).not.toContain('cursor-default');
  });

  it('mientras se guarda, el botón dice "Agregando..."', async () => {
    let resolveCrear!: (v: Awaited<ReturnType<typeof crearRepartoExcepcional>>) => void;
    mockCrear.mockReturnValue(new Promise(res => { resolveCrear = res; }));
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText('Agregando...');
    resolveCrear({ id: 1, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'RUTA A', codigo_despacho_id: '10', fecha: '2026-07-10' });
  });

  it('sin error, no hay ningún div de banner de error en el DOM', () => {
    renderModal();
    expect(document.querySelector('.bg-red-50.border-red-200')).toBeNull();
  });

  it('si el fallo no es un Error (sin .message), usa el mensaje default con el nombre del código', async () => {
    mockCrear.mockRejectedValueOnce('boom-no-error');
    renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Error al crear excepción para RUTA A')).toBeInTheDocument();
  });

  it('cerrar y reabrir con OTRO chofer sin agregar códigos deja Agregar deshabilitado (no arrastra códigos stale)', async () => {
    mockSearchChoferes.mockResolvedValue([LOPEZ, { codigo: 'CH2', descripcion: 'García', desactivado: 0 }]);
    const { rerender } = renderModal();
    await elegirChofer();
    await agregarRuta('RUTA A');
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeEnabled();

    rerender(<RepartoExcepcionalModal
      open={false}
      onClose={vi.fn()}
      fecha="2026-07-10"
      onCreado={vi.fn()}
      codigosDespachoGlobales={[]}
      codigosDespachoByChofer={new Map()}
    />);
    rerender(<RepartoExcepcionalModal
      open={true}
      onClose={vi.fn()}
      fecha="2026-07-10"
      onCreado={vi.fn()}
      codigosDespachoGlobales={[]}
      codigosDespachoByChofer={new Map()}
    />);

    fireEvent.change(screen.getByPlaceholderText('Escribí nombre o código...'), { target: { value: 'gar' } });
    fireEvent.click(await screen.findByRole('button', { name: /García/ }));

    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });
});
