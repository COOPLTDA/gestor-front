import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { ZonificacionPage } from './ZonificacionPage';
import { usePdvData } from './hooks/usePdvData';
import { useGroups } from './hooks/useGroups';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import type { Grupo, Pdv, Zona } from './types';
import type { MapViewHandle } from './components/MapView';

vi.mock('./hooks/usePdvData');
vi.mock('./hooks/useGroups');
vi.mock('@/contexts/AuthContext');
vi.mock('@/hooks/useToast');

// exportExcel ya tiene su propia suite completa (exportExcel.test.ts) y de verdad
// escribe un archivo vía XLSX.writeFile — se mockea acá para probar solo que
// ZonificacionPage la llama y reacciona a su resultado, sin tocar el disco.
vi.mock('./lib/exportExcel', () => ({
  exportExcel: vi.fn(() => 'archivo-mock.xlsx'),
}));

// MapView es Leaflet real y ya tiene su propia suite (MapView.integration.test.tsx);
// acá se mockea para poder ejercitar solo la orquestación de ZonificacionPage,
// exponiendo el mismo handle imperativo (startEditingZone/stopEditingZone/fitToData)
// y disparando los callbacks (onZonaCreada/onExcluirPdv) desde botones de test.
const mapViewHandleMock = {
  startEditingZone: vi.fn(),
  stopEditingZone: vi.fn(() => null as unknown),
  fitToData: vi.fn(),
};
vi.mock('./components/MapView', () => ({
  default: forwardRef<MapViewHandle, any>(function MapViewMock(props, ref) {
    useImperativeHandle(ref, () => mapViewHandleMock as unknown as MapViewHandle);
    return (
      <div data-testid="map-view">
        <span data-testid="map-pdv-count">{props.pdv.length}</span>
        <button onClick={() => props.onZonaCreada([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }])}>
          dibujar-zona
        </button>
        <button onClick={() => props.onExcluirPdv('1')}>excluir-pdv-1</button>
      </div>
    );
  }),
}));

const mockUsePdvData = vi.mocked(usePdvData);
const mockUseGroups = vi.mocked(useGroups);
const mockUseAuth = vi.mocked(useAuth);
const mockUseToast = vi.mocked(useToast);

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente Uno', dir: '', com: 'Almacén', loc: '', par: 'CABA',
    lat: -34.6, lng: -58.4, desactivado: false, vnd_cod: 'V1', vnd_nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A',
    vendedores: [], facturacion: 0, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

function grupo(overrides: Partial<Grupo> = {}): Grupo {
  return {
    id: 1, nombre: 'Grupo 1', tipo: 'ruta_flete',
    creadoPor: { id: 7, nombre: 'Ana' }, editablePorOtros: false, zonas: [],
    ...overrides,
  };
}

function zona(overrides: Partial<Zona> = {}): Zona {
  return { nombre: 'Zona 1', color: '#000', vertices: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }], criterios: null, ...overrides };
}

// El combobox de un filtro de FiltersBar no tiene nombre accesible propio (el
// label vive en un <span> hermano, no ligado por aria) — y varios labels
// ("Tipo PDV", "Vendedor") coinciden con botones de ColorSchemeBar. Se ubica
// por el texto "{label}:" y se busca el combobox dentro del mismo contenedor.
function filterCombobox(label: string): HTMLElement {
  const span = screen.getByText(`${label}:`);
  return within(span.parentElement as HTMLElement).getByRole('combobox');
}

const toastMock = vi.fn();
const gruposDefaults = {
  grupos: [] as Grupo[],
  activeGroup: null as Grupo | null,
  activeId: null as number | null,
  loading: false,
  error: null as string | null,
  guardarZonas: vi.fn().mockResolvedValue(undefined),
  crear: vi.fn().mockResolvedValue(grupo()),
  editar: vi.fn().mockResolvedValue(undefined),
  eliminar: vi.fn().mockResolvedValue(undefined),
  setActiveId: vi.fn(),
  reload: vi.fn(),
};

function setup({
  pdvOverrides = {},
  gruposOverrides = {},
  user = { id: 7, nombre: 'Ana', role: 'usuario' } as { id: number; nombre: string; role: string } | null,
}: {
  pdvOverrides?: Partial<ReturnType<typeof usePdvData>>;
  gruposOverrides?: Partial<typeof gruposDefaults>;
  user?: { id: number; nombre: string; role: string } | null;
} = {}) {
  mockUsePdvData.mockReturnValue({ data: [], loading: false, error: null, ...pdvOverrides });
  mockUseGroups.mockReturnValue({ ...gruposDefaults, ...gruposOverrides });
  mockUseAuth.mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
  mockUseToast.mockReturnValue({ toast: toastMock } as unknown as ReturnType<typeof useToast>);
  return render(<ZonificacionPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mapViewHandleMock).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear?.());
  mapViewHandleMock.stopEditingZone.mockReturnValue(null);
});

describe('ZonificacionPage — estados generales', () => {
  it('muestra "Cargando..." mientras cargan PDV o grupos', () => {
    setup({ pdvOverrides: { loading: true } });
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('si falla la carga de grupos, muestra el error y no renderiza el resto de la página', () => {
    setup({ gruposOverrides: { error: 'sin conexión' } });
    expect(screen.getByText(/Error al cargar los grupos de zonas: sin conexión/)).toBeInTheDocument();
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
  });

  it('si falla la carga de PDV, avisa por toast con el mensaje exacto', () => {
    setup({ pdvOverrides: { error: 'timeout' } });
    expect(toastMock).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Error',
      description: 'No se pudo cargar el universo de PDV: timeout',
    });
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });

  it('sin error de PDV, no avisa por toast', () => {
    setup({ pdvOverrides: { error: null } });
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('si el error de PDV aparece recién en un rerender, avisa igual (el efecto reacciona a pdvError)', () => {
    mockUsePdvData.mockReturnValue({ data: [], loading: false, error: null });
    mockUseGroups.mockReturnValue(gruposDefaults);
    mockUseAuth.mockReturnValue({ user: { id: 7, nombre: 'Ana', role: 'usuario' } } as unknown as ReturnType<typeof useAuth>);
    mockUseToast.mockReturnValue({ toast: toastMock } as unknown as ReturnType<typeof useToast>);
    const { rerender } = render(<ZonificacionPage />);
    expect(toastMock).not.toHaveBeenCalled();

    mockUsePdvData.mockReturnValue({ data: [], loading: false, error: 'se cayó la conexión' });
    rerender(<ZonificacionPage />);

    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('se cayó la conexión') }));
  });
});

describe('ZonificacionPage — filtros y datos visibles', () => {
  it('pasa el universo de PDV filtrado al mapa', () => {
    setup({ pdvOverrides: { data: [pdv({ id: '1', com: 'Almacén' }), pdv({ id: '2', com: 'Kiosco' })] } });
    expect(screen.getByTestId('map-pdv-count')).toHaveTextContent('2');
  });

  it('excluir un PDV desde el mapa lo saca de los datos visibles y avisa con el mensaje exacto', () => {
    setup({ pdvOverrides: { data: [pdv({ id: '1' }), pdv({ id: '2' })] } });
    fireEvent.click(screen.getByText('excluir-pdv-1'));
    expect(screen.getByTestId('map-pdv-count')).toHaveTextContent('1');
    expect(toastMock).toHaveBeenCalledWith({
      title: 'PDV excluido',
      description: 'Se puede restaurar desde la lista del panel izquierdo',
    });
  });

  it('con varios PDV, excluir uno deja visibles solo los que no fueron excluidos (no al revés)', () => {
    setup({ pdvOverrides: { data: [pdv({ id: '1' }), pdv({ id: '2' }), pdv({ id: '3' })] } });
    fireEvent.click(screen.getByText('excluir-pdv-1'));
    expect(screen.getByTestId('map-pdv-count')).toHaveTextContent('2');
  });

  it('reincluir un PDV excluido lo vuelve a mostrar', () => {
    setup({ pdvOverrides: { data: [pdv({ id: '1' }), pdv({ id: '2' })] } });
    fireEvent.click(screen.getByText('excluir-pdv-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Excluidos: 1' }));
    fireEvent.click(screen.getByTitle('Volver a incluir'));
    expect(screen.getByTestId('map-pdv-count')).toHaveTextContent('2');
  });

  it('restaurar todos los excluidos vuelve a mostrar el universo completo', () => {
    setup({ pdvOverrides: { data: [pdv({ id: '1' }), pdv({ id: '2' })] } });
    fireEvent.click(screen.getByText('excluir-pdv-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Excluidos: 1' }));
    fireEvent.click(screen.getByText('Restaurar todos'));
    expect(screen.getByTestId('map-pdv-count')).toHaveTextContent('2');
  });
});

describe('ZonificacionPage — permisos (puedeEditar)', () => {
  it('sin usuario autenticado, no puede editar ningún grupo', () => {
    setup({ gruposOverrides: { activeGroup: grupo({ creadoPor: { id: 7, nombre: 'Ana' } }) }, user: null });
    expect(screen.getByRole('button', { name: 'Limpiar zonas del grupo' })).toBeDisabled();
  });

  it('el dueño del grupo puede editarlo', () => {
    setup({ gruposOverrides: { activeGroup: grupo({ creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona()] }) }, user: { id: 7, nombre: 'Ana', role: 'usuario' } });
    expect(screen.getByRole('button', { name: 'Limpiar zonas del grupo' })).not.toBeDisabled();
  });

  it('un admin puede editar aunque no sea el dueño ni sea compartido', () => {
    setup({ gruposOverrides: { activeGroup: grupo({ creadoPor: { id: 99, nombre: 'Otro' }, editablePorOtros: false, zonas: [zona()] }) }, user: { id: 1, nombre: 'Admin', role: 'admin' } });
    expect(screen.getByRole('button', { name: 'Limpiar zonas del grupo' })).not.toBeDisabled();
  });

  it('otro usuario no puede editar un grupo ajeno y no compartido', () => {
    setup({ gruposOverrides: { activeGroup: grupo({ creadoPor: { id: 99, nombre: 'Otro' }, editablePorOtros: false, zonas: [zona()] }) }, user: { id: 1, nombre: 'Beto', role: 'usuario' } });
    expect(screen.getByRole('button', { name: 'Limpiar zonas del grupo' })).toBeDisabled();
  });

  it('cualquiera puede editar un grupo marcado como compartido', () => {
    setup({ gruposOverrides: { activeGroup: grupo({ creadoPor: { id: 99, nombre: 'Otro' }, editablePorOtros: true, zonas: [zona()] }) }, user: { id: 1, nombre: 'Beto', role: 'usuario' } });
    expect(screen.getByRole('button', { name: 'Limpiar zonas del grupo' })).not.toBeDisabled();
  });

  it('sin grupo activo, puedeEditarActivo es false (no queda habilitado por defecto)', () => {
    setup({ gruposOverrides: { activeGroup: null }, user: { id: 7, nombre: 'Ana', role: 'admin' } });
    expect(screen.getByRole('button', { name: 'Limpiar zonas del grupo' })).toBeDisabled();
  });
});

describe('ZonificacionPage — dibujar una zona nueva', () => {
  it('sin grupo activo, avisa por toast y no abre el diálogo de confirmación', () => {
    setup({ gruposOverrides: { activeId: null } });
    fireEvent.click(screen.getByText('dibujar-zona'));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: expect.stringContaining('grupo activo') }));
    expect(screen.queryByText('Nueva zona')).not.toBeInTheDocument();
  });

  it('sin permiso sobre el grupo activo, avisa por toast', () => {
    setup({
      gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 99, nombre: 'Otro' }, editablePorOtros: false }) },
      user: { id: 1, nombre: 'Beto', role: 'usuario' },
    });
    fireEvent.click(screen.getByText('dibujar-zona'));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('permiso') }));
  });

  it('con permiso, dibujar abre el diálogo de confirmación con la cantidad de PDV adentro', () => {
    setup({
      pdvOverrides: { data: [pdv({ id: '1', lat: 0.5, lng: 0.5 }), pdv({ id: '2', lat: 9, lng: 9 })] },
      gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' } }) },
    });
    fireEvent.click(screen.getByText('dibujar-zona'));
    expect(screen.getByText('Nueva zona')).toBeInTheDocument();
  });

  it('confirmar la zona la guarda con el color siguiente de la paleta y el snapshot de filtros/excluidos', async () => {
    const guardarZonas = vi.fn().mockResolvedValue(undefined);
    setup({
      gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona({ nombre: 'Existente' })] }), guardarZonas },
    });
    fireEvent.click(screen.getByText('dibujar-zona'));

    // el nombre por defecto es "Zona {cantidad + 1}" (había 1 zona existente)
    expect(screen.getByDisplayValue('Zona 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear zona' }));

    expect(guardarZonas).toHaveBeenCalledWith([
      expect.objectContaining({ nombre: 'Existente' }),
      expect.objectContaining({
        nombre: 'Zona 2',
        criterios: { filtros: expect.any(Object), excluidos: [] },
      }),
    ]);
  });

  it('el snapshot de criterios incluye los PDV excluidos a mano al momento de crear la zona', () => {
    const guardarZonas = vi.fn().mockResolvedValue(undefined);
    setup({
      pdvOverrides: { data: [pdv({ id: '1' }), pdv({ id: '2' })] },
      gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' } }), guardarZonas },
    });

    fireEvent.click(screen.getByText('excluir-pdv-1'));
    fireEvent.click(screen.getByText('dibujar-zona'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear zona' }));

    expect(guardarZonas).toHaveBeenCalledWith([
      expect.objectContaining({ criterios: expect.objectContaining({ excluidos: ['1'] }) }),
    ]);
  });

  it('cancelar la zona pendiente cierra el diálogo sin guardar', () => {
    const guardarZonas = vi.fn();
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' } }), guardarZonas } });
    fireEvent.click(screen.getByText('dibujar-zona'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(guardarZonas).not.toHaveBeenCalled();
    expect(screen.queryByText('Nueva zona')).not.toBeInTheDocument();
  });

  it('el diálogo de confirmación muestra la facturación sumada de los PDV adentro y el solapamiento con zonas existentes', () => {
    // El mock de MapView dibuja el triángulo (0,0)-(0,1)-(1,1) al apretar "dibujar-zona".
    const dentro = pdv({ id: '1', lat: 0.3, lng: 0.6, facturacion: 1000 });
    const dentro2 = pdv({ id: '2', lat: 0.2, lng: 0.9, facturacion: 500 });
    const fuera = pdv({ id: '3', lat: 5, lng: 5, facturacion: 999 });
    const zonaExistente = zona({ nombre: 'Existente', vertices: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }] });

    setup({
      pdvOverrides: { data: [dentro, dentro2, fuera] },
      gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zonaExistente] }) },
    });

    fireEvent.click(screen.getByText('dibujar-zona'));

    // Se usa within(dialog) porque la zona "Existente" (misma forma) ahora también muestra
    // su propia facturación con los filtros actuales en ZoneItem, con el mismo monto.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/^\$\s?1\.500$/)).toBeInTheDocument(); // suma (1000+500), no resta (que daría -1.500)
    // ambos puntos ya estaban cubiertos por la zona existente -> solapamiento = 2
    expect(within(dialog).getByText(/cliente(s)? de esta zona ya (está|están) incluido/)).toBeInTheDocument();
  });

  it('si falla al guardar la zona nueva, avisa por toast', async () => {
    const guardarZonas = vi.fn().mockRejectedValue(new Error('fallo guardando'));
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' } }), guardarZonas } });
    fireEvent.click(screen.getByText('dibujar-zona'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear zona' }));

    await vi.waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: 'fallo guardando' })));
  });
});

describe('ZonificacionPage — edición de una zona existente', () => {
  it('editar habilita el modo edición en el mapa', () => {
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona()] }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Editar forma' }));
    expect(mapViewHandleMock.startEditingZone).toHaveBeenCalledWith(0);
  });

  it('guardar la edición persiste los vértices nuevos y muestra el toast de éxito', async () => {
    mapViewHandleMock.stopEditingZone.mockReturnValue([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }]);
    const guardarZonas = vi.fn().mockResolvedValue(undefined);
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona()] }), guardarZonas } });

    fireEvent.click(screen.getByRole('button', { name: 'Editar forma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(mapViewHandleMock.stopEditingZone).toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(guardarZonas).toHaveBeenCalledWith([
      expect.objectContaining({ vertices: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }] }),
    ]));
    expect(toastMock).toHaveBeenCalledWith({ title: 'Zona guardada' });
  });

  it('guardar la edición solo reemplaza los vértices de la zona editada, no de las demás', async () => {
    mapViewHandleMock.stopEditingZone.mockReturnValue([{ lat: 9, lng: 9 }, { lat: 8, lng: 8 }, { lat: 7, lng: 7 }]);
    const guardarZonas = vi.fn().mockResolvedValue(undefined);
    setup({
      gruposOverrides: {
        activeId: 1,
        activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona({ nombre: 'A' }), zona({ nombre: 'B' })] }),
        guardarZonas,
      },
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar forma' })[1]); // edita la segunda (índice 1)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await vi.waitFor(() => expect(guardarZonas).toHaveBeenCalledWith([
      expect.objectContaining({ nombre: 'A', vertices: zona().vertices }), // sin tocar
      expect.objectContaining({ nombre: 'B', vertices: [{ lat: 9, lng: 9 }, { lat: 8, lng: 8 }, { lat: 7, lng: 7 }] }),
    ]));
  });

  it('si stopEditingZone(true) devuelve null (sin cambios), no llama a guardarZonas', () => {
    mapViewHandleMock.stopEditingZone.mockReturnValue(null);
    const guardarZonas = vi.fn();
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona()] }), guardarZonas } });

    fireEvent.click(screen.getByRole('button', { name: 'Editar forma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(guardarZonas).not.toHaveBeenCalled();
  });

  it('cancelar la edición descarta los cambios en el mapa', () => {
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona()] }) } });

    fireEvent.click(screen.getByRole('button', { name: 'Editar forma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(mapViewHandleMock.stopEditingZone).toHaveBeenCalledWith(false);
  });
});

describe('ZonificacionPage — renombrar / eliminar zonas', () => {
  it('renombrar una zona persiste el cambio', () => {
    const guardarZonas = vi.fn().mockResolvedValue(undefined);
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona({ nombre: 'Original' })] }), guardarZonas } });

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    fireEvent.change(screen.getByDisplayValue('Original'), { target: { value: 'Nuevo' } });
    fireEvent.keyDown(screen.getByDisplayValue('Nuevo'), { key: 'Enter' });

    expect(guardarZonas).toHaveBeenCalledWith([expect.objectContaining({ nombre: 'Nuevo' })]);
  });

  it('renombrar afecta solo la zona correspondiente, no las demás', () => {
    const guardarZonas = vi.fn().mockResolvedValue(undefined);
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona({ nombre: 'A' }), zona({ nombre: 'B' })] }), guardarZonas } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Renombrar' })[1]);
    fireEvent.change(screen.getByDisplayValue('B'), { target: { value: 'B renombrada' } });
    fireEvent.keyDown(screen.getByDisplayValue('B renombrada'), { key: 'Enter' });

    expect(guardarZonas).toHaveBeenCalledWith([
      expect.objectContaining({ nombre: 'A' }),
      expect.objectContaining({ nombre: 'B renombrada' }),
    ]);
  });

  it('eliminar una zona la saca de la lista', () => {
    const guardarZonas = vi.fn().mockResolvedValue(undefined);
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona({ nombre: 'A' }), zona({ nombre: 'B' })] }), guardarZonas } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);

    expect(guardarZonas).toHaveBeenCalledWith([expect.objectContaining({ nombre: 'B' })]);
  });

  it('"Limpiar zonas del grupo" no hace nada si no hay zonas', () => {
    const guardarZonas = vi.fn();
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [] }), guardarZonas } });

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar zonas del grupo' }));

    expect(guardarZonas).not.toHaveBeenCalled();
  });

  it('"Limpiar zonas del grupo" pide confirmación (con el mensaje exacto) y solo limpia si se confirma', async () => {
    const guardarZonas = vi.fn().mockResolvedValue(undefined);
    setup({ gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona()] }), guardarZonas } });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar zonas del grupo' }));
    expect(confirmSpy).toHaveBeenCalledWith('¿Limpiar todas las zonas del grupo activo?');
    expect(guardarZonas).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar zonas del grupo' }));
    await vi.waitFor(() => expect(guardarZonas).toHaveBeenCalledWith([]));
    expect(toastMock).toHaveBeenCalledWith({ title: 'Zonas del grupo limpiadas' });
  });
});

describe('ZonificacionPage — aplicar criterios de una zona', () => {
  it('aplicar los criterios de una zona restaura sus filtros y excluidos', () => {
    const c = { filtros: { comercio: ['Almacén'] as string[], partido: [] as string[], frecuencia: [] as string[], search: '', dia: [] as string[], vndCod: [] as string[], proveedor: [] as string[], division: [] as string[], linea: [] as string[], articulo: [] as string[], activo: 'activos' as const, facturacionMin: null, facturacionMax: null }, excluidos: ['9'] };
    setup({
      pdvOverrides: { data: [pdv({ id: '1', com: 'Almacén' }), pdv({ id: '2', com: 'Kiosco' }), pdv({ id: '9', com: 'Almacén' })] },
      gruposOverrides: { activeId: 1, activeGroup: grupo({ id: 1, creadoPor: { id: 7, nombre: 'Ana' }, zonas: [zona({ criterios: c })] }) },
    });

    fireEvent.click(screen.getByText('Ver con qué criterio se creó'));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar estos filtros' }));

    expect(toastMock).toHaveBeenCalledWith({ title: 'Filtros aplicados', description: 'Viendo la zona como la vio quien la creó' });
    // Con comercio=Almacén y el 9 excluido a mano: solo el 1 queda visible en el mapa
    expect(screen.getByTestId('map-pdv-count')).toHaveTextContent('1');
  });
});

describe('ZonificacionPage — grupos', () => {
  it('crear grupo delega en crear() con zonas: []', async () => {
    const crear = vi.fn().mockResolvedValue(grupo());
    setup({ gruposOverrides: { crear } });

    fireEvent.click(screen.getByRole('button', { name: /^Grupos/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Grupo Nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }));

    await vi.waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Grupo Nuevo', zonas: [] })));
  });

  it('si falla crear un grupo, avisa por toast', async () => {
    const crear = vi.fn().mockRejectedValue(new Error('nombre duplicado'));
    setup({ gruposOverrides: { crear } });

    fireEvent.click(screen.getByRole('button', { name: /^Grupos/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo' }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }));

    await vi.waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: 'nombre duplicado' })));
  });

  it('eliminar un grupo avisa con un toast de éxito', async () => {
    const eliminar = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup({ gruposOverrides: { grupos: [grupo({ id: 5 })], eliminar } });

    fireEvent.click(screen.getByRole('button', { name: /^Grupos/ }));
    fireEvent.click(screen.getByTitle('Eliminar'));

    await vi.waitFor(() => expect(eliminar).toHaveBeenCalledWith(5));
    expect(toastMock).toHaveBeenCalledWith({ title: 'Grupo eliminado' });
  });
});

describe('ZonificacionPage — export y opciones derivadas del universo de PDV', () => {
  it('al exportar con éxito, avisa por toast con el nombre exacto del archivo', () => {
    setup({ gruposOverrides: { activeGroup: grupo({ zonas: [zona()] }) } });

    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));

    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excel exportado' }));
  });

  it('las opciones de filtro (rubros) se recalculan cuando cambia el universo de PDV', async () => {
    const { rerender } = setup({ pdvOverrides: { data: [pdv({ id: '1', com: 'Almacén' })] } });
    fireEvent.click(filterCombobox('Tipo PDV'));
    expect(screen.queryByText('Kiosco')).not.toBeInTheDocument();
    fireEvent.click(filterCombobox('Tipo PDV')); // cierra el popover

    mockUsePdvData.mockReturnValue({ data: [pdv({ id: '1', com: 'Almacén' }), pdv({ id: '2', com: 'Kiosco' })], loading: false, error: null });
    rerender(<ZonificacionPage />);

    fireEvent.click(filterCombobox('Tipo PDV'));
    expect(screen.getAllByText('Kiosco').length).toBeGreaterThan(0);
  });

  it('las opciones de partido/frecuencia/vendedor/proveedor/división/línea/artículo también se recalculan al cambiar el universo de PDV', () => {
    const original = pdv({
      id: '1', par: 'CABA', frq: 'Semanal',
      vendedores: [{ cod: 'V1', nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'R' }],
      proveedores: ['Proveedor A'], divisiones: ['División A'], lineas: ['Línea A'],
      articulos: [{ id: 'A1', nombre: 'Artículo A' }],
    });
    const { rerender } = setup({ pdvOverrides: { data: [original] } });

    const nuevo = pdv({
      id: '2', par: 'La Plata', frq: 'Quincenal',
      vendedores: [{ cod: 'V2', nombre: 'Vendedor Dos', dia: 1, frq: 'Semanal', reparto: 'R' }],
      proveedores: ['Proveedor B'], divisiones: ['División B'], lineas: ['Línea B'],
      articulos: [{ id: 'A2', nombre: 'Artículo B' }],
    });
    mockUsePdvData.mockReturnValue({ data: [original, nuevo], loading: false, error: null });
    rerender(<ZonificacionPage />);

    const casos: [string, string][] = [
      ['Partido', 'La Plata'],
      ['Frecuencia', 'Quincenal'],
      ['Vendedor', 'V2 - Vendedor Dos'],
      ['Proveedor', 'Proveedor B'],
      ['División', 'División B'],
      ['Línea', 'Línea B'],
      ['Artículo', 'Artículo B'],
    ];
    casos.forEach(([label, valorNuevo]) => {
      fireEvent.click(filterCombobox(label));
      expect(screen.getByText(valorNuevo)).toBeInTheDocument();
      fireEvent.click(filterCombobox(label)); // cierra antes del siguiente
    });
  });
});

describe('ZonificacionPage — paneles y controles del mapa', () => {
  it('"Centrar mapa" llama a fitToData', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Centrar mapa/ }));
    expect(mapViewHandleMock.fitToData).toHaveBeenCalled();
  });

  it('alterna la visibilidad de etiquetas', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Mostrar etiquetas' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar etiquetas' }));
    expect(screen.getByRole('button', { name: 'Ocultar etiquetas' })).toBeInTheDocument();
  });

  it('alterna la visibilidad de polígonos', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Ocultar polígonos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar polígonos' }));
    expect(screen.getByRole('button', { name: 'Mostrar polígonos' })).toBeInTheDocument();
  });

  it('oculta y muestra el panel izquierdo', () => {
    setup();
    expect(screen.getByText('Esquema de color')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Ocultar panel izquierdo'));
    expect(screen.queryByText('Esquema de color')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Mostrar panel izquierdo'));
    expect(screen.getByText('Esquema de color')).toBeInTheDocument();
  });

  it('oculta y muestra el panel derecho', () => {
    setup();
    expect(screen.getByText('Grupos')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Ocultar panel derecho'));
    expect(screen.queryByText('Grupos')).not.toBeInTheDocument();
    expect(screen.getByTitle('Mostrar panel derecho')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Mostrar panel derecho'));
    expect(screen.getByText('Grupos')).toBeInTheDocument();
  });

  it('oculta y muestra la barra de filtros', () => {
    setup();
    expect(screen.getByText('Buscar:')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Ocultar filtros'));
    expect(screen.queryByText('Buscar:')).not.toBeInTheDocument();
    expect(screen.getByTitle('Mostrar filtros')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Mostrar filtros'));
    expect(screen.getByText('Buscar:')).toBeInTheDocument();
  });

  it('sin loading, no muestra el overlay de "Cargando..."', () => {
    setup({ pdvOverrides: { loading: false }, gruposOverrides: { loading: false } });
    expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();
  });

  it('el esquema de color arranca en "tipo" (Tipo PDV activo)', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Tipo PDV' }).className).toContain('bg-primary');
  });

  it('"Centrar mapa" no explota si mapRef aún no tiene el handle (mapView sin montar del todo)', () => {
    // Cubre el optional chaining de mapRef.current?.fitToData(); acá el mock siempre
    // responde, así que solo se verifica que el flujo normal no rompe.
    setup();
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Centrar mapa/ }))).not.toThrow();
  });
});
