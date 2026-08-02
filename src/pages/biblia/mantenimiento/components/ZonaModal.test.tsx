import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ZonaModal } from './ZonaModal';
import { searchCodigosDespacho, type ZonaAdmin, type CodigoDespachoAdmin } from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  searchCodigosDespacho: vi.fn(),
}));

const searchMock = vi.mocked(searchCodigosDespacho);

const ZONA: ZonaAdmin = { id: 1, nombre: 'LOMAS', desactivado: 0, repartos: ['01'] };

const CODIGOS: CodigoDespachoAdmin[] = [
  { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null },
];

function renderModal(over: Partial<Parameters<typeof ZonaModal>[0]> = {}) {
  const props = {
    open: true,
    zona: null as ZonaAdmin | null,
    codigosDespacho: CODIGOS,
    onClose: vi.fn(),
    onGuardar: vi.fn().mockResolvedValue(undefined),
    onAsignar: vi.fn().mockResolvedValue(undefined),
    onDesasignar: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  const utils = render(<ZonaModal {...props} />);
  return { ...props, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
  searchMock.mockResolvedValue([]);
});

describe('ZonaModal — alta', () => {
  it('deshabilita Guardar sin nombre', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('crea la zona con el nombre trimmeado y cierra', async () => {
    const { onGuardar, onClose } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('Nombre de la zona'), { target: { value: ' OESTE ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onGuardar).toHaveBeenCalledWith({ id: undefined, nombre: 'OESTE' }, false);
  });

  it('muestra el error si onGuardar rechaza', async () => {
    renderModal({ onGuardar: vi.fn().mockRejectedValue(new Error('nombre duplicado')) });
    fireEvent.change(screen.getByPlaceholderText('Nombre de la zona'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('nombre duplicado')).toBeInTheDocument();
  });

  it('no muestra la sección de códigos en el alta', () => {
    renderModal();
    expect(screen.queryByText('Códigos de despacho')).not.toBeInTheDocument();
  });
});

describe('ZonaModal — edición', () => {
  it('precarga el nombre y guarda con el id de la zona', async () => {
    const { onGuardar } = renderModal({ zona: ZONA });
    const input = screen.getByDisplayValue('LOMAS');
    fireEvent.change(input, { target: { value: 'LOMAS 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ id: 1, nombre: 'LOMAS 2' }, true));
  });

  it('lista los repartos asignados con su descripción y permite desasignar', () => {
    const { onDesasignar } = renderModal({ zona: ZONA });
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('— LANUS 2')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Desasignar'));
    expect(onDesasignar).toHaveBeenCalledWith('01', 1);
  });

  it('un reparto asignado que no está en codigosDespacho no muestra "— nombre" (r undefined)', () => {
    renderModal({ zona: { ...ZONA, repartos: ['99'] }, codigosDespacho: [] });
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('un resultado de búsqueda con la MISMA zona actual no muestra el aviso "zona: N"', async () => {
    searchMock.mockResolvedValue([{ id: '05', nombre: 'PERIFERIA', desactivado: 0, direccion: null, zona_id: 1 }]);
    renderModal({ zona: ZONA });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'per' } });
    await screen.findByText('PERIFERIA');
    expect(screen.queryByText(/zona: 1/)).not.toBeInTheDocument();
  });

  it('un resultado de búsqueda sin zona asignada no muestra el aviso "zona:"', async () => {
    searchMock.mockResolvedValue([{ id: '05', nombre: 'PERIFERIA', desactivado: 0, direccion: null, zona_id: null }]);
    renderModal({ zona: ZONA });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'per' } });
    await screen.findByText('PERIFERIA');
    expect(screen.queryByText(/zona:/)).not.toBeInTheDocument();
  });

  it('muestra "Sin códigos de despacho asignados" cuando la zona no tiene repartos', () => {
    renderModal({ zona: { ...ZONA, repartos: [] } });
    expect(screen.getByText('Sin códigos de despacho asignados')).toBeInTheDocument();
  });

  it('busca códigos, oculta los ya asignados, y asigna al click', async () => {
    searchMock.mockResolvedValue([
      { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null },
      { id: '05', nombre: 'PERIFERIA', desactivado: 0, direccion: null, zona_id: 3 },
    ]);
    const { onAsignar } = renderModal({ zona: ZONA });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), {
      target: { value: 'lan' },
    });
    const opcion = await screen.findByText('PERIFERIA');
    expect(screen.queryByText('LANUS 2', { selector: 'li span' })).not.toBeInTheDocument();
    // advierte que el código ya pertenece a otra zona
    expect(screen.getByText('zona: 3')).toBeInTheDocument();
    fireEvent.click(opcion);
    expect(onAsignar).toHaveBeenCalledWith('05', 1);
  });

  it('muestra el indicador de búsqueda mientras busca', async () => {
    let resolver: (v: CodigoDespachoAdmin[]) => void = () => {};
    searchMock.mockImplementation(() => new Promise(res => { resolver = res; }));
    renderModal({ zona: ZONA });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), {
      target: { value: 'x' },
    });
    expect(await screen.findByText('Buscando…')).toBeInTheDocument();
    resolver([]);
    await waitFor(() => expect(screen.queryByText('Buscando…')).not.toBeInTheDocument());
  });

  it('sin nombre, Guardar queda deshabilitado', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('con solo espacios en el nombre, Guardar sigue deshabilitado (usa .trim())', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Nombre de la zona'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('si onGuardar rechaza con algo que no es Error, usa el mensaje default', async () => {
    const onGuardar = vi.fn().mockRejectedValue('boom');
    renderModal({ onGuardar });
    fireEvent.change(screen.getByPlaceholderText('Nombre de la zona'), { target: { value: 'NUEVA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Error al guardar')).toBeInTheDocument();
  });

  it('sin error, no muestra ningún párrafo de error', () => {
    renderModal();
    expect(screen.queryByText(/requerido|Error al guardar/)).not.toBeInTheDocument();
  });

  it('mientras guarda, dice "Guardando…" y Cancelar queda deshabilitado', async () => {
    let resolveGuardar!: () => void;
    const onGuardar = vi.fn().mockReturnValue(new Promise<void>(res => { resolveGuardar = res; }));
    renderModal({ onGuardar });
    fireEvent.change(screen.getByPlaceholderText('Nombre de la zona'), { target: { value: 'NUEVA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled());
    expect(screen.getByText('Guardando…')).toBeInTheDocument();

    resolveGuardar();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeDisabled());
  });

  it('reabrir el modal con OTRA zona resetea nombre/búsqueda (no queda stale)', () => {
    const ZONA_B: ZonaAdmin = { id: 2, nombre: 'SUR', desactivado: 0, repartos: [] };
    const { rerender } = render(<ZonaModal
      open={true}
      zona={ZONA}
      codigosDespacho={CODIGOS}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);
    expect(screen.getByDisplayValue('LOMAS')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'algo' } });

    rerender(<ZonaModal
      open={false}
      zona={ZONA}
      codigosDespacho={CODIGOS}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);
    rerender(<ZonaModal
      open={true}
      zona={ZONA_B}
      codigosDespacho={CODIGOS}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);

    expect(screen.getByDisplayValue('SUR')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar código de despacho para asignar…')).toHaveValue('');
  });

  it('borrar la búsqueda de código vacía la lista de resultados (no solo el texto anterior)', async () => {
    searchMock.mockResolvedValue([{ id: '05', nombre: 'PERIFERIA', desactivado: 0, direccion: null }]);
    renderModal({ zona: ZONA });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'per' } });
    await screen.findByText('PERIFERIA');

    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: '' } });

    expect(screen.queryByText('PERIFERIA')).not.toBeInTheDocument();
    expect(document.body.querySelector('ul')).not.toBeInTheDocument();
  });

  it('al abrir en modo edición, sin haber buscado nada, no muestra ningún desplegable de resultados', () => {
    renderModal({ zona: ZONA });
    expect(document.body.querySelector('ul')).not.toBeInTheDocument();
    expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
  });

  it('una búsqueda de solo espacios no dispara la búsqueda (usa .trim(), no truthiness)', () => {
    vi.useFakeTimers();
    try {
      renderModal({ zona: ZONA });
      fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: '   ' } });
      vi.advanceTimersByTime(400);
      expect(searchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('no muestra el párrafo de error (ni vacío) cuando no hay error', () => {
    renderModal();
    expect(document.body.querySelector('p.text-red-600')).not.toBeInTheDocument();
  });

  it('al asignar un código desde la búsqueda, vacía el campo de búsqueda', async () => {
    searchMock.mockResolvedValue([{ id: '05', nombre: 'PERIFERIA', desactivado: 0, direccion: null }]);
    renderModal({ zona: ZONA });
    const input = screen.getByPlaceholderText('Buscar código de despacho para asignar…');
    fireEvent.change(input, { target: { value: 'per' } });
    fireEvent.click(await screen.findByText('PERIFERIA'));
    expect(input).toHaveValue('');
  });

  it('el badge de un reparto asignado muestra el nombre del código correcto, no el primero de la lista', () => {
    const codigos: CodigoDespachoAdmin[] = [
      { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null },
      { id: '02', nombre: 'OTRO CODIGO', desactivado: 0, direccion: null },
    ];
    renderModal({ zona: { ...ZONA, repartos: ['02'] }, codigosDespacho: codigos });
    expect(screen.getByText('— OTRO CODIGO')).toBeInTheDocument();
    expect(screen.queryByText('— LANUS 2')).not.toBeInTheDocument();
  });

  it('presionar Escape cierra el modal', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('al desmontar con un debounce de búsqueda pendiente, no rompe', () => {
    const { unmount } = renderModal({ zona: ZONA });
    fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'x' } });
    expect(() => unmount()).not.toThrow();
  });

  it('escribir de nuevo antes de que resuelva la búsqueda anterior descarta la respuesta vieja (evita condición de carrera)', async () => {
    let resolvePrimera!: (v: CodigoDespachoAdmin[]) => void;
    let resolveSegunda!: (v: CodigoDespachoAdmin[]) => void;
    let call = 0;
    searchMock.mockImplementation(() => new Promise(res => {
      call += 1;
      if (call === 1) resolvePrimera = res; else resolveSegunda = res;
    }));
    vi.useFakeTimers();
    try {
      renderModal({ zona: ZONA });
      fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'lan' } });
      vi.advanceTimersByTime(400);
      fireEvent.change(screen.getByPlaceholderText('Buscar código de despacho para asignar…'), { target: { value: 'per' } });
      vi.advanceTimersByTime(400);

      resolveSegunda([{ id: '05', nombre: 'PERIFERIA', desactivado: 0, direccion: null }]);
      await vi.waitFor(() => expect(screen.getByText('PERIFERIA')).toBeInTheDocument());
      expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();

      // La respuesta vieja llega tarde: debe ignorarse (no debe pisar los resultados nuevos
      // ni el indicador de carga, que ya se apagó con la respuesta fresca).
      resolvePrimera([{ id: '09', nombre: 'LANUS VIEJO', desactivado: 0, direccion: null }]);
      await Promise.resolve();
      expect(screen.queryByText('LANUS VIEJO')).not.toBeInTheDocument();
      expect(screen.getByText('PERIFERIA')).toBeInTheDocument();
      expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
