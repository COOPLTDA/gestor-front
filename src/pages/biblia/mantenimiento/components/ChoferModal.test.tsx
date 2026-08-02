import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoferModal } from './ChoferModal';
import { searchCodigosDespacho, type ChoferAdmin } from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  searchCodigosDespacho: vi.fn(),
}));

const searchMock = vi.mocked(searchCodigosDespacho);

const CHOFER: ChoferAdmin = { codigo: '071', descripcion: 'López', desactivado: 0, rutas: ['BIG'] };

function renderModal(over: Partial<Parameters<typeof ChoferModal>[0]> = {}) {
  const props = {
    open: true,
    chofer: null as ChoferAdmin | null,
    choferes: [CHOFER],
    codigosDespacho: [{ id: 'BIG', nombre: 'BIG LOMAS', desactivado: 0, direccion: null }],
    onClose: vi.fn(),
    onGuardar: vi.fn().mockResolvedValue(undefined),
    onAsignar: vi.fn().mockResolvedValue(undefined),
    onDesasignar: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  const utils = render(<ChoferModal {...props} />);
  return { ...props, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
  searchMock.mockResolvedValue([]);
});

describe('ChoferModal — alta', () => {
  it('deshabilita Guardar sin código y lo habilita al tipear', () => {
    renderModal();
    const guardar = screen.getByRole('button', { name: 'Guardar' });
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('ej: 071'), { target: { value: 'CH9' } });
    expect(guardar).toBeEnabled();
  });

  it('guarda un chofer nuevo con los campos trimmeados y cierra', async () => {
    const { onGuardar, onClose } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('ej: 071'), { target: { value: ' 079 ' } });
    fireEvent.change(screen.getByPlaceholderText('Nombre completo'), { target: { value: ' Nuevo ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onGuardar).toHaveBeenCalledWith({ codigo: '079', descripcion: 'Nuevo', chofer_padre_codigo: null }, false);
  });

  it('rechaza un código Sigma no numérico sin llamar a onGuardar', async () => {
    const { onGuardar, onClose } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('ej: 071'), { target: { value: 'CH9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El código Sigma debe ser numérico')).toBeInTheDocument();
    expect(onGuardar).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('muestra el error si onGuardar rechaza y no cierra', async () => {
    const { onClose } = renderModal({
      onGuardar: vi.fn().mockRejectedValue(new Error('código duplicado')),
    });
    fireEvent.change(screen.getByPlaceholderText('ej: 071'), { target: { value: '079' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('código duplicado')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('no muestra la sección de códigos de despacho en el alta', () => {
    renderModal();
    expect(screen.queryByText('Códigos de despacho asignados')).not.toBeInTheDocument();
  });

  it('Cancelar cierra el modal', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ChoferModal — chofer padre', () => {
  it('el label del código dice "Código Sigma" sin padre y "Código" con padre', () => {
    renderModal();
    expect(screen.getByText('Código Sigma')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '071' } });
    expect(screen.queryByText('Código Sigma')).not.toBeInTheDocument();
    expect(screen.getByText('Código')).toBeInTheDocument();
  });

  it('con padre seleccionado autogenera el código con el primer sufijo libre y deshabilita el input', async () => {
    const hijo: ChoferAdmin = { codigo: '071-2', descripcion: 'Camioneta 2', desactivado: 0, chofer_padre_codigo: '071' };
    const { onGuardar } = renderModal({ choferes: [CHOFER, hijo] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '071' } });
    const input = screen.getByPlaceholderText('ej: 071') as HTMLInputElement;
    expect(input.value).toBe('071-3'); // 071-2 ya existe
    expect(input).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(onGuardar).toHaveBeenCalledWith({ codigo: '071-3', descripcion: '', chofer_padre_codigo: '071' }, false)
    );
  });

  it('excluye del selector a los choferes que ya son hijos y al propio chofer', () => {
    const hijo: ChoferAdmin = { codigo: '071-2', descripcion: 'Camioneta 2', desactivado: 0, chofer_padre_codigo: '071' };
    renderModal({ chofer: CHOFER, choferes: [CHOFER, hijo] });
    const opciones = screen.getAllByRole('option').map(o => (o as HTMLOptionElement).value);
    expect(opciones).toEqual(['']); // ni 071 (él mismo) ni 071-2 (ya es hijo)
  });

  it('deshabilita el selector si el chofer ya tiene desgloses propios', () => {
    const hijo: ChoferAdmin = { codigo: '071-2', descripcion: 'Camioneta 2', desactivado: 0, chofer_padre_codigo: '071' };
    renderModal({ chofer: CHOFER, choferes: [CHOFER, hijo] });
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText('Este chofer tiene desgloses propios y no puede ser desglose de otro.')).toBeInTheDocument();
  });

  it('precarga el padre al editar un chofer hijo', () => {
    const hijo: ChoferAdmin = { codigo: '071-2', descripcion: 'Camioneta 2', desactivado: 0, chofer_padre_codigo: '071' };
    renderModal({ chofer: hijo, choferes: [CHOFER, hijo] });
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('071');
  });
});

describe('ChoferModal — edición', () => {
  it('precarga los datos y deshabilita el código', () => {
    renderModal({ chofer: CHOFER });
    expect(screen.getByText('Editar chofer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('071')).toBeDisabled();
    expect(screen.getByDisplayValue('López')).toBeEnabled();
  });

  it('guarda la edición con editando=true', async () => {
    const { onGuardar } = renderModal({ chofer: CHOFER });
    fireEvent.change(screen.getByDisplayValue('López'), { target: { value: 'López B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ codigo: '071', descripcion: 'López B', chofer_padre_codigo: null }, true));
  });

  it('lista las rutas asignadas y permite desasignar', () => {
    const { onDesasignar } = renderModal({ chofer: CHOFER });
    expect(screen.getByText('BIG')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Desasignar'));
    expect(onDesasignar).toHaveBeenCalledWith('BIG', '071');
  });

  it('busca códigos con debounce, oculta los ya asignados y asigna al click', async () => {
    searchMock.mockResolvedValue([
      { id: 'BIG', nombre: 'BIG LOMAS', desactivado: 0, direccion: null },
      { id: 'PERI 5', nombre: 'PERIFERIA', desactivado: 0, direccion: null },
    ]);
    const { onAsignar } = renderModal({ chofer: CHOFER });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), {
      target: { value: 'per' },
    });
    const opcion = await screen.findByText('PERIFERIA');
    // BIG ya está asignado → no aparece en el dropdown
    expect(screen.queryByText('BIG LOMAS')).not.toBeInTheDocument();
    fireEvent.click(opcion);
    await waitFor(() => expect(onAsignar).toHaveBeenCalledWith('PERI 5', '071'));
    expect(searchMock).toHaveBeenCalledWith('per');
  });

  it('una ruta sin nombre conocido se lista solo por su código', () => {
    renderModal({ chofer: CHOFER, codigosDespacho: [] });
    expect(screen.getByText('BIG')).toBeInTheDocument();
    expect(screen.queryByText(/BIG —/)).not.toBeInTheDocument();
  });

  it('un chofer sin rutas asignadas muestra "Sin rutas asignadas"', () => {
    renderModal({ chofer: { ...CHOFER, rutas: [] } });
    expect(screen.getByText('Sin códigos de despacho asignados')).toBeInTheDocument();
  });

  it('un chofer con rutas undefined (no []) también muestra "Sin códigos de despacho asignados"', () => {
    renderModal({ chofer: { codigo: '071', descripcion: 'López', desactivado: 0 } });
    expect(screen.getByText('Sin códigos de despacho asignados')).toBeInTheDocument();
  });

  it('con dos rutas asignadas, cada una muestra el nombre que le corresponde (no siempre el primero)', () => {
    renderModal({
      chofer: { codigo: '071', descripcion: 'López', desactivado: 0, rutas: ['BIG', 'SEG'] },
      codigosDespacho: [
        { id: 'BIG', nombre: 'BIG LOMAS', desactivado: 0, direccion: null },
        { id: 'SEG', nombre: 'SEGUNDA RUTA', desactivado: 0, direccion: null },
      ],
    });
    const spanBig = screen.getByText('BIG').parentElement!;
    const spanSeg = screen.getByText('SEG').parentElement!;
    expect(spanBig.textContent).toContain('BIG LOMAS');
    expect(spanBig.textContent).not.toContain('SEGUNDA');
    expect(spanSeg.textContent).toContain('SEGUNDA RUTA');
    expect(spanSeg.textContent).not.toContain('LOMAS');
  });

  it('una ruta asignada cuyo código no tiene nombre conocido no muestra el guión con nombre', () => {
    renderModal({
      chofer: { codigo: '071', descripcion: 'López', desactivado: 0, rutas: ['BIG'] },
      codigosDespacho: [{ id: 'BIG', nombre: null, desactivado: 0, direccion: null }],
    });
    expect(screen.getByText('BIG')).toBeInTheDocument();
    expect(screen.queryByText('— null')).not.toBeInTheDocument();
    expect(screen.queryByText('BIG').parentElement?.querySelector('.opacity-70')).toBeNull();
  });

  it('al asignar una ruta, limpia la búsqueda y cierra el dropdown', async () => {
    searchMock.mockResolvedValue([{ id: 'PERI 5', nombre: 'PERIFERIA', desactivado: 0, direccion: null }]);
    renderModal({ chofer: CHOFER });
    const input = screen.getByPlaceholderText('Buscar código de despacho para asignar…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'per' } });
    const opcion = await screen.findByText('PERIFERIA');
    fireEvent.click(opcion);
    await waitFor(() => expect(input.value).toBe(''));
    expect(screen.queryByText('PERIFERIA')).not.toBeInTheDocument();
  });

  it('una búsqueda de solo espacios no dispara la búsqueda (se trata como vacía)', async () => {
    vi.useFakeTimers();
    try {
      renderModal({ chofer: CHOFER });
      fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: '   ' } });
      await vi.advanceTimersByTimeAsync(400);
      expect(searchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('desmontar antes de que dispare el debounce evita la búsqueda (limpia el timer)', async () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderModal({ chofer: CHOFER });
      fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'per' } });
      unmount();
      await vi.advanceTimersByTimeAsync(400);
      expect(searchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('el selector de padre NO se deshabilita si otros choferes tienen padres distintos al propio', () => {
    const hijoDeOtro: ChoferAdmin = { codigo: '099-2', descripcion: 'Camioneta', desactivado: 0, chofer_padre_codigo: '099' };
    renderModal({ chofer: CHOFER, choferes: [CHOFER, hijoDeOtro] });
    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.getByText('Un chofer nuevo sin padre debe usar el código numérico con el que existe en Sigma.')).toBeInTheDocument();
  });

  it('con padre seleccionado (sin ser edición ni tener hijos) muestra el texto de desglose', () => {
    renderModal({ choferes: [CHOFER] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '071' } });
    expect(screen.getByText(/Desglose: camioneta adicional/)).toBeInTheDocument();
  });

  it('el input de código NO se deshabilita al dar de alta sin chofer padre', () => {
    renderModal();
    expect(screen.getByPlaceholderText('ej: 071')).toBeEnabled();
  });

  it('las opciones del selector de padre muestran " — descripción" solo si tiene descripción', () => {
    const sinDescripcion: ChoferAdmin = { codigo: '050', descripcion: null, desactivado: 0 };
    const conDescripcion: ChoferAdmin = { codigo: '060', descripcion: 'Juan', desactivado: 0 };
    renderModal({ chofer: CHOFER, choferes: [CHOFER, sinDescripcion, conDescripcion] });
    const opciones = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(opciones.find(o => o.value === '050')!.textContent).toBe('050');
    expect(opciones.find(o => o.value === '060')!.textContent).toBe('060 — Juan');
  });

  it('deshabilita Guardar si el código es solo espacios (no cuenta como código válido)', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('ej: 071'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('no renderiza ningún párrafo de error cuando error es null', () => {
    renderModal();
    const parrafos = screen.queryAllByText('', { selector: 'p.text-red-600' });
    expect(parrafos).toHaveLength(0);
  });

  it('si onGuardar rechaza con algo que no es Error, usa el mensaje default', async () => {
    const onGuardar = vi.fn().mockRejectedValue('boom');
    renderModal({ onGuardar });
    fireEvent.change(screen.getByPlaceholderText('ej: 071'), { target: { value: '079' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Error al guardar')).toBeInTheDocument();
  });

  it('sin error, no muestra ningún párrafo de error', () => {
    renderModal();
    expect(screen.queryByText(/El código es requerido|El código Sigma debe ser numérico|Error al guardar/)).not.toBeInTheDocument();
  });

  it('mientras guarda, dice "Guardando…" y Cancelar queda deshabilitado', async () => {
    let resolveGuardar!: () => void;
    const onGuardar = vi.fn().mockReturnValue(new Promise<void>(res => { resolveGuardar = res; }));
    renderModal({ onGuardar });
    fireEvent.change(screen.getByPlaceholderText('ej: 071'), { target: { value: '079' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled());
    expect(screen.getByText('Guardando…')).toBeInTheDocument();

    resolveGuardar();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeDisabled());
  });

  it('reabrir el modal con OTRO chofer resetea código/descripción/búsqueda (no queda stale)', () => {
    const CHOFER_B: ChoferAdmin = { codigo: '099', descripcion: 'García', desactivado: 0, rutas: [] };
    const { rerender } = render(<ChoferModal
      open={true}
      chofer={CHOFER}
      choferes={[CHOFER]}
      codigosDespacho={[{ id: 'BIG', nombre: 'BIG LOMAS', desactivado: 0, direccion: null }]}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);
    expect(screen.getByDisplayValue('López')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'algo' } });

    rerender(<ChoferModal
      open={false}
      chofer={CHOFER}
      choferes={[CHOFER]}
      codigosDespacho={[{ id: 'BIG', nombre: 'BIG LOMAS', desactivado: 0, direccion: null }]}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);
    rerender(<ChoferModal
      open={true}
      chofer={CHOFER_B}
      choferes={[CHOFER, CHOFER_B]}
      codigosDespacho={[{ id: 'BIG', nombre: 'BIG LOMAS', desactivado: 0, direccion: null }]}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);

    expect(screen.getByDisplayValue('García')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar código de despacho para asignar…')).toHaveValue('');
    expect(screen.getByText('Sin códigos de despacho asignados')).toBeInTheDocument();
  });

  it('borrar la búsqueda de ruta vacía la lista de resultados', async () => {
    searchMock.mockResolvedValue([{ id: 'PERI 5', nombre: 'PERIFERIA', desactivado: 0, direccion: null }]);
    renderModal({ chofer: CHOFER });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'per' } });
    await screen.findByText('PERIFERIA');

    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: '' } });

    expect(screen.queryByText('PERIFERIA')).not.toBeInTheDocument();
  });

  it('mientras busca códigos, muestra "Buscando…" y no el dropdown', async () => {
    let resolveSearch!: (v: { id: string; nombre: string; desactivado: number; direccion: null }[]) => void;
    searchMock.mockReturnValue(new Promise(res => { resolveSearch = res; }));
    vi.useFakeTimers();
    try {
      renderModal({ chofer: CHOFER });
      fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'per' } });
      await vi.advanceTimersByTimeAsync(300);
      expect(screen.getByText('Buscando…')).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();

      resolveSearch([]);
      await vi.waitFor(() => expect(screen.queryByText('Buscando…')).not.toBeInTheDocument());
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin resultados de búsqueda, no muestra el dropdown ni "Buscando…"', () => {
    renderModal({ chofer: CHOFER });
    expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('una búsqueda obsoleta que resuelve tarde no apaga "Buscando…" de la búsqueda vigente', async () => {
    let resolvePrimera!: (v: { id: string; nombre: string; desactivado: number; direccion: null }[]) => void;
    let call = 0;
    searchMock.mockImplementation(() => new Promise(res => {
      call += 1;
      if (call === 1) resolvePrimera = res;
      // La segunda búsqueda queda pendiente a propósito (no se resuelve en este test).
    }));
    vi.useFakeTimers();
    try {
      renderModal({ chofer: CHOFER });
      const input = screen.getByPlaceholderText('Buscar código de despacho para asignar…');
      fireEvent.change(input, { target: { value: 'x1' } });
      await vi.advanceTimersByTimeAsync(300);
      fireEvent.change(input, { target: { value: 'x2' } });
      await vi.advanceTimersByTimeAsync(300);
      expect(screen.getByText('Buscando…')).toBeInTheDocument();

      resolvePrimera([{ id: 'VIEJO', nombre: 'RUTA VIEJA', desactivado: 0, direccion: null }]);
      await Promise.resolve();
      // La búsqueda vigente (x2) todavía no resolvió: debe seguir mostrando "Buscando…".
      expect(screen.getByText('Buscando…')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('al desmontar con un debounce de búsqueda pendiente, no rompe', () => {
    const { unmount } = renderModal({ chofer: CHOFER });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'x' } });
    expect(() => unmount()).not.toThrow();
  });

  it('escribir de nuevo antes de que resuelva la búsqueda anterior descarta la respuesta vieja', async () => {
    let resolvePrimera!: (v: { id: string; nombre: string; desactivado: number; direccion: null }[]) => void;
    let resolveSegunda!: (v: { id: string; nombre: string; desactivado: number; direccion: null }[]) => void;
    let call = 0;
    searchMock.mockImplementation(() => new Promise(res => {
      call += 1;
      if (call === 1) resolvePrimera = res; else resolveSegunda = res;
    }));
    vi.useFakeTimers();
    try {
      renderModal({ chofer: CHOFER });
      fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'x1' } });
      vi.advanceTimersByTime(400);
      fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'x2' } });
      vi.advanceTimersByTime(400);

      resolveSegunda([{ id: 'PERI 5', nombre: 'PERIFERIA', desactivado: 0, direccion: null }]);
      await vi.waitFor(() => expect(screen.getByText('PERIFERIA')).toBeInTheDocument());

      resolvePrimera([{ id: 'VIEJO', nombre: 'RUTA VIEJA', desactivado: 0, direccion: null }]);
      await Promise.resolve();
      expect(screen.queryByText('RUTA VIEJA')).not.toBeInTheDocument();
      expect(screen.getByText('PERIFERIA')).toBeInTheDocument();
      // La resolución tardía y obsoleta tampoco debe tocar "loadingSearch".
      expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
