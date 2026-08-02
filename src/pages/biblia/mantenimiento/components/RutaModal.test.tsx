import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RutaModal } from './RutaModal';
import { searchChoferes, type CodigoDespachoAdmin, type ZonaAdmin } from '@/services/bibliaApi';

vi.mock('@/services/bibliaApi', () => ({
  searchChoferes: vi.fn(),
}));

const searchMock = vi.mocked(searchChoferes);

const REPARTO: CodigoDespachoAdmin = {
  id: '01',
  nombre: 'LANUS 2',
  desactivado: 0,
  direccion: null,
  zona_id: 9,
  choferes: ['CH1'],
};

const ZONAS: ZonaAdmin[] = [
  { id: 9, nombre: 'LOMAS', desactivado: 0 },
  { id: 10, nombre: 'SUR', desactivado: 0 },
  { id: 11, nombre: 'VIEJA', desactivado: 1 },
];

function renderModal(over: Partial<Parameters<typeof RutaModal>[0]> = {}) {
  const props = {
    open: true,
    reparto: REPARTO as CodigoDespachoAdmin | null,
    zonas: ZONAS,
    onClose: vi.fn(),
    onGuardar: vi.fn().mockResolvedValue(undefined),
    onAsignar: vi.fn().mockResolvedValue(undefined),
    onDesasignar: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  const utils = render(<RutaModal {...props} />);
  return { ...props, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
  searchMock.mockResolvedValue([]);
});

describe('RutaModal', () => {
  it('el nombre es solo lectura: viene de Sigma', () => {
    renderModal();
    const nombre = screen.getByText('LANUS 2');
    expect(nombre.tagName).toBe('P');
    expect(nombre).toHaveAttribute('title', 'Definido en Sigma — no se edita desde la Biblia');
    // el único input editable del form principal es el código (deshabilitado al editar)
    expect(screen.getByDisplayValue('01')).toBeDisabled();
  });

  it('solo lista zonas activas en el select', () => {
    renderModal();
    const opciones = screen.getAllByRole('option').map(o => o.textContent);
    expect(opciones).toEqual(['Sin zona', 'LOMAS', 'SUR']);
  });

  it('guarda la zona elegida como número', async () => {
    const { onGuardar, onClose } = renderModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onGuardar).toHaveBeenCalledWith({ id: '01', zona_id: 10 }, true);
  });

  it('guarda zona null cuando se elige "Sin zona"', async () => {
    const { onGuardar } = renderModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ id: '01', zona_id: null }, true));
  });

  it('muestra el error si onGuardar rechaza', async () => {
    renderModal({ onGuardar: vi.fn().mockRejectedValue(new Error('zona inválida')) });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('zona inválida')).toBeInTheDocument();
  });

  it('lista choferes asignados y permite desasignar', () => {
    const { onDesasignar } = renderModal();
    expect(screen.getByText('CH1')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Desasignar'));
    expect(onDesasignar).toHaveBeenCalledWith('01', 'CH1');
  });

  it('busca choferes, oculta los asignados y asigna al click', async () => {
    searchMock.mockResolvedValue([
      { codigo: 'CH1', descripcion: 'López', desactivado: 0 },
      { codigo: 'CH2', descripcion: 'García', desactivado: 0 },
    ]);
    const { onAsignar } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), {
      target: { value: 'gar' },
    });
    const opcion = await screen.findByText('García');
    expect(screen.queryByText('López')).not.toBeInTheDocument();
    fireEvent.click(opcion);
    await waitFor(() => expect(onAsignar).toHaveBeenCalledWith('01', 'CH2'));
  });

  it('muestra "Sin descripción" si el reparto no tiene nombre', () => {
    renderModal({ reparto: { ...REPARTO, nombre: null } });
    expect(screen.getByText('Sin descripción')).toBeInTheDocument();
  });

  it('Cancelar llama a onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('permite escribir en el campo de código al crear uno nuevo', () => {
    renderModal({ reparto: null });
    const input = screen.getByPlaceholderText('ej: R001');
    fireEvent.change(input, { target: { value: 'R099' } });
    expect(input).toHaveValue('R099');
  });

  it('sin código, el botón Guardar queda deshabilitado (no se puede disparar el error)', () => {
    renderModal({ reparto: null });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('con solo espacios en el código, el botón Guardar sigue deshabilitado (usa .trim(), no truthiness)', () => {
    renderModal({ reparto: null });
    fireEvent.change(screen.getByPlaceholderText('ej: R001'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('al crear uno nuevo, el título es "Nuevo código de despacho"', () => {
    renderModal({ reparto: null });
    expect(screen.getByText('Nuevo código de despacho')).toBeInTheDocument();
  });

  it('sin error, no muestra ningún párrafo de error', () => {
    renderModal();
    expect(screen.queryByText(/requerido|Error al guardar/)).not.toBeInTheDocument();
  });

  it('un reparto con choferes: [] muestra "Sin choferes asignados"', () => {
    renderModal({ reparto: { ...REPARTO, choferes: [] } });
    expect(screen.getByText('Sin choferes asignados')).toBeInTheDocument();
  });

  it('recorta espacios del código antes de guardar', async () => {
    const { onGuardar } = renderModal({ reparto: null });
    fireEvent.change(screen.getByPlaceholderText('ej: R001'), { target: { value: '  R099  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ id: 'R099', zona_id: null }, false));
  });

  it('si onGuardar rechaza con algo que no es Error, usa el mensaje default', async () => {
    const onGuardar = vi.fn().mockRejectedValue('boom');
    renderModal({ onGuardar });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Error al guardar')).toBeInTheDocument();
  });

  it('reabrir el modal con OTRO reparto resetea id/zona/query al del nuevo reparto (no queda stale)', () => {
    const REPARTO_B: CodigoDespachoAdmin = { id: '02', nombre: 'PERI 5', desactivado: 0, direccion: null, zona_id: 10, choferes: ['CH9'] };
    const { rerender } = render(<RutaModal
      open={true}
      reparto={REPARTO}
      zonas={ZONAS}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);
    expect(screen.getByDisplayValue('01')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), { target: { value: 'algo' } });

    // Se cierra y se reabre con OTRO reparto (flujo típico: click en el lápiz de otra fila).
    rerender(<RutaModal
      open={false}
      reparto={REPARTO}
      zonas={ZONAS}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);
    rerender(<RutaModal
      open={true}
      reparto={REPARTO_B}
      zonas={ZONAS}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);

    expect(screen.getByDisplayValue('02')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar chofer para asignar…')).toHaveValue('');
    expect(screen.getByText('CH9')).toBeInTheDocument();
    expect(screen.queryByText('CH1')).not.toBeInTheDocument();
  });

  it('reabrir para CREAR uno nuevo (reparto null) limpia zona a "Sin zona"', () => {
    const { rerender } = render(<RutaModal
      open={true}
      reparto={REPARTO}
      zonas={ZONAS}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);
    expect(screen.getByRole('combobox')).toHaveValue('9');

    rerender(<RutaModal
      open={true}
      reparto={null}
      zonas={ZONAS}
      onClose={vi.fn()}
      onGuardar={vi.fn().mockResolvedValue(undefined)}
      onAsignar={vi.fn().mockResolvedValue(undefined)}
      onDesasignar={vi.fn().mockResolvedValue(undefined)}
    />);

    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('borrar la búsqueda de chofer vacía la lista de resultados', async () => {
    searchMock.mockResolvedValue([{ codigo: 'CH2', descripcion: 'García', desactivado: 0 }]);
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), { target: { value: 'gar' } });
    await screen.findByText('García');

    fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), { target: { value: '' } });

    expect(screen.queryByText('García')).not.toBeInTheDocument();
  });

  it('muestra "Buscando…" mientras la búsqueda de chofer está en curso', async () => {
    let resolveSearch!: (v: { codigo: string; descripcion: string }[]) => void;
    searchMock.mockReturnValue(new Promise(res => { resolveSearch = res; }));
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), { target: { value: 'gar' } });

    expect(await screen.findByText('Buscando…')).toBeInTheDocument();

    resolveSearch([]);
    await waitFor(() => expect(screen.queryByText('Buscando…')).not.toBeInTheDocument());
  });

  it('no muestra "Buscando…" antes de escribir nada en la búsqueda', () => {
    renderModal();
    expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
  });

  it('una búsqueda vacía tras resolver no muestra el dropdown', async () => {
    searchMock.mockResolvedValue([]);
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.queryByText('Buscando…')).not.toBeInTheDocument());
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('una búsqueda de solo espacios no dispara la búsqueda', async () => {
    vi.useFakeTimers();
    try {
      renderModal();
      fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), { target: { value: '   ' } });
      await vi.advanceTimersByTimeAsync(400);
      expect(searchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('escribir de nuevo antes de que venza el debounce cancela la búsqueda anterior (solo busca la última)', async () => {
    vi.useFakeTimers();
    try {
      renderModal();
      const input = screen.getByPlaceholderText('Buscar chofer para asignar…');
      fireEvent.change(input, { target: { value: 'ga' } });
      await vi.advanceTimersByTimeAsync(150);
      fireEvent.change(input, { target: { value: 'gar' } });
      await vi.advanceTimersByTimeAsync(300);
      expect(searchMock).toHaveBeenCalledTimes(1);
      expect(searchMock).toHaveBeenCalledWith('gar');
    } finally {
      vi.useRealTimers();
    }
  });

  it('un reparto con choferes undefined (no []) también muestra "Sin choferes asignados"', () => {
    renderModal({ reparto: { id: '01', nombre: 'LANUS 2', desactivado: 0, direccion: null, zona_id: 9 } });
    expect(screen.getByText('Sin choferes asignados')).toBeInTheDocument();
  });

  it('no renderiza ningún párrafo de error cuando error es null', () => {
    renderModal();
    expect(screen.queryAllByText('', { selector: 'p.text-red-600' })).toHaveLength(0);
  });

  it('al desmontar con un debounce de búsqueda pendiente, no rompe', () => {
    const { unmount } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), { target: { value: 'gar' } });
    expect(() => unmount()).not.toThrow();
  });

  it('elegir un chofer de la lista limpia la búsqueda tras asignarlo', async () => {
    searchMock.mockResolvedValue([{ codigo: 'CH2', descripcion: 'García', desactivado: 0 }]);
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Buscar chofer para asignar…'), { target: { value: 'gar' } });
    const opcion = await screen.findByText('García');
    fireEvent.click(opcion);

    await waitFor(() => expect(screen.getByPlaceholderText('Buscar chofer para asignar…')).toHaveValue(''));
    expect(screen.queryByText('García')).not.toBeInTheDocument();
  });

  it('mientras guarda, el botón Guardar y Cancelar quedan deshabilitados y dice "Guardando…"', async () => {
    let resolveGuardar!: () => void;
    const onGuardar = vi.fn().mockReturnValue(new Promise<void>(res => { resolveGuardar = res; }));
    renderModal({ onGuardar });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled());
    expect(screen.getByText('Guardando…')).toBeInTheDocument();

    resolveGuardar();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeDisabled());
  });
});
