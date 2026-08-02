import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import type { RangoVentas } from '@/services/zonificacionApi';
import { usePdvData } from './hooks/usePdvData';
import { useGroups } from './hooks/useGroups';
import { nextZoneColor } from './lib/colors';
import { getZonePoints } from './lib/geo';
import { filterPdv, uniqueArticulos, uniqueSorted, uniqueSortedFromList, uniqueVendedores } from './lib/filters';
import { defaultRangoVentas } from './lib/rangoVentas';
import { FILTROS_VACIOS, type ColorScheme, type Criterios, type Filtros, type Grupo, type LatLng, type Zona } from './types';
import { ColorSchemeBar } from './components/ColorSchemeBar';
import { ExportExcelButton } from './components/ExportExcelButton';
import { FiltersBar } from './components/FiltersBar';
import { GroupsPanel } from './components/GroupsPanel';
import { Legend } from './components/Legend';
import MapView, { type MapViewHandle } from './components/MapView';
import { ZonesSidebar } from './components/ZonesSidebar';
import { ZoneConfirmDialog } from './components/ZoneConfirmDialog';

export function ZonificacionPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rangoVentas, setRangoVentas] = useState<RangoVentas>(defaultRangoVentas());
  const { data: pdv, loading: pdvLoading, error: pdvError } = usePdvData(rangoVentas);
  const {
    grupos,
    activeGroup,
    activeId,
    loading: gruposLoading,
    error: gruposError,
    guardarZonas,
    crear,
    editar,
    eliminar,
    setActiveId,
  } = useGroups();

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('tipo');
  const [labelsVisible, setLabelsVisible] = useState(false);
  const [polygonsVisible, setPolygonsVisible] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [zonaPendiente, setZonaPendiente] = useState<LatLng[] | null>(null);
  const [pdvExcluidos, setPdvExcluidos] = useState<Set<string>>(new Set());
  const mapRef = useRef<MapViewHandle>(null);

  const currentData = useMemo(() => filterPdv(pdv, filtros), [pdv, filtros]);
  // PDV que además de pasar los filtros, el usuario no excluyó a mano desde el cartelito.
  const visibleData = useMemo(
    () => (pdvExcluidos.size === 0 ? currentData : currentData.filter((p) => !pdvExcluidos.has(p.id))),
    [currentData, pdvExcluidos]
  );
  const pdvExcluidosInfo = useMemo(
    () => pdv.filter((p) => pdvExcluidos.has(p.id)),
    [pdv, pdvExcluidos]
  );
  const rubros = useMemo(() => uniqueSorted(pdv, 'com'), [pdv]);
  const partidos = useMemo(() => uniqueSorted(pdv, 'par'), [pdv]);
  const frecuencias = useMemo(() => uniqueSorted(pdv, 'frq'), [pdv]);
  const vendedores = useMemo(() => uniqueVendedores(pdv), [pdv]);
  const proveedores = useMemo(() => uniqueSortedFromList(pdv, 'proveedores'), [pdv]);
  const divisiones = useMemo(() => uniqueSortedFromList(pdv, 'divisiones'), [pdv]);
  const lineas = useMemo(() => uniqueSortedFromList(pdv, 'lineas'), [pdv]);
  const articulos = useMemo(() => uniqueArticulos(pdv), [pdv]);

  const zonas = activeGroup?.zonas ?? [];

  function puedeEditar(grupo: Grupo): boolean {
    if (!user) return false;
    return user.role === 'admin' || grupo.creadoPor.id === user.id || grupo.editablePorOtros;
  }

  const puedeEditarActivo = activeGroup ? puedeEditar(activeGroup) : false;

  function showError(message: string) {
    toast({ variant: 'destructive', title: 'Error', description: message });
  }

  // Un fallo al traer el universo de PDV no debería tumbar el resto de la herramienta
  // (grupos/zonas ya dibujadas siguen siendo útiles aunque el feed en vivo esté caído).
  useEffect(() => {
    if (pdvError) showError(`No se pudo cargar el universo de PDV: ${pdvError}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdvError]);

  function handleZonaDibujada(vertices: LatLng[]) {
    if (activeId == null) {
      showError('No hay grupo activo. Creá uno primero con "+ Nuevo".');
      return;
    }
    if (!puedeEditarActivo) {
      showError('No tenés permiso para agregar zonas a este grupo.');
      return;
    }
    setZonaPendiente(vertices);
  }

  function handleExcluirPdv(id: string) {
    setPdvExcluidos((prev) => new Set(prev).add(id));
    toast({ title: 'PDV excluido', description: 'Se puede restaurar desde la lista del panel izquierdo' });
  }

  function handleReincluirPdv(id: string) {
    setPdvExcluidos((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleRestaurarExcluidos() {
    setPdvExcluidos(new Set());
  }

  const puntosZonaPendiente = zonaPendiente ? getZonePoints(visibleData, zonaPendiente) : [];
  const facturacionZonaPendiente = puntosZonaPendiente.reduce((acc, p) => acc + p.facturacion, 0);
  const solapamientoZonaPendiente = zonaPendiente
    ? puntosZonaPendiente.filter((p) => zonas.some((z) => getZonePoints([p], z.vertices).length > 0)).length
    : 0;

  async function handleConfirmarZona(nombre: string) {
    if (!zonaPendiente) return;
    // Se guarda un snapshot de los filtros activos + PDV excluidos a mano al dibujar la
    // zona — trazabilidad de con qué criterio se armó, no solo la forma (ver ZoneItem >
    // "Ver con qué criterio se creó").
    const nuevaZona: Zona = {
      nombre,
      color: nextZoneColor(zonas.length),
      vertices: zonaPendiente,
      criterios: { filtros, excluidos: [...pdvExcluidos] },
    };
    setZonaPendiente(null);
    try {
      await guardarZonas([...zonas, nuevaZona]);
    } catch (e) {
      showError((e as Error).message);
    }
  }

  function handleCancelarZona() {
    setZonaPendiente(null);
  }

  function handleStartEdit(index: number) {
    setEditingIndex(index);
    mapRef.current?.startEditingZone(index);
  }

  async function handleSaveEdit() {
    if (editingIndex == null) return;
    const nuevosVertices = mapRef.current?.stopEditingZone(true) ?? null;
    const index = editingIndex;
    setEditingIndex(null);
    if (!nuevosVertices) return;
    const nuevasZonas = zonas.map((z, i) => (i === index ? { ...z, vertices: nuevosVertices } : z));
    try {
      await guardarZonas(nuevasZonas);
      toast({ title: 'Zona guardada' });
    } catch (e) {
      showError((e as Error).message);
    }
  }

  function handleCancelEdit() {
    mapRef.current?.stopEditingZone(false);
    setEditingIndex(null);
  }

  async function handleRename(index: number, nombre: string) {
    const nuevasZonas = zonas.map((z, i) => (i === index ? { ...z, nombre } : z));
    try {
      await guardarZonas(nuevasZonas);
    } catch (e) {
      showError((e as Error).message);
    }
  }

  function handleAplicarCriterios(criterios: Criterios) {
    setFiltros(criterios.filtros);
    setPdvExcluidos(new Set(criterios.excluidos));
    toast({ title: 'Filtros aplicados', description: 'Viendo la zona como la vio quien la creó' });
  }

  async function handleDeleteZona(index: number) {
    if (editingIndex === index) {
      mapRef.current?.stopEditingZone(false);
      setEditingIndex(null);
    }
    const nuevasZonas = zonas.filter((_, i) => i !== index);
    try {
      await guardarZonas(nuevasZonas);
    } catch (e) {
      showError((e as Error).message);
    }
  }

  async function handleLimpiarZonas() {
    if (!zonas.length) return;
    if (!confirm('¿Limpiar todas las zonas del grupo activo?')) return;
    try {
      await guardarZonas([]);
      toast({ title: 'Zonas del grupo limpiadas' });
    } catch (e) {
      showError((e as Error).message);
    }
  }

  async function handleCrearGrupo(values: { nombre: string; tipo: Grupo['tipo']; editablePorOtros: boolean }) {
    try {
      await crear({ ...values, zonas: [] });
    } catch (e) {
      showError((e as Error).message);
    }
  }

  async function handleEditarGrupo(id: number, values: { nombre: string; tipo: Grupo['tipo']; editablePorOtros: boolean }) {
    try {
      await editar(id, values);
    } catch (e) {
      showError((e as Error).message);
    }
  }

  async function handleEliminarGrupo(id: number) {
    try {
      await eliminar(id);
      toast({ title: 'Grupo eliminado' });
    } catch (e) {
      showError((e as Error).message);
    }
  }

  if (gruposError) {
    return (
      <div className="-m-6 h-[calc(100%+3rem)] flex items-center justify-center text-sm text-red-600">
        Error al cargar los grupos de zonas: {gruposError}
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-white">
      {filtersVisible && (
        <FiltersBar
          filtros={filtros}
          onChange={setFiltros}
          rubros={rubros}
          partidos={partidos}
          frecuencias={frecuencias}
          vendedores={vendedores}
          proveedores={proveedores}
          divisiones={divisiones}
          lineas={lineas}
          articulos={articulos}
          totalMostrado={visibleData.length}
          excluidos={pdvExcluidosInfo}
          onReincluir={handleReincluirPdv}
          onRestaurarExcluidos={handleRestaurarExcluidos}
          rangoVentas={rangoVentas}
          onChangeRangoVentas={setRangoVentas}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {leftPanelVisible && (
          <aside className="flex w-64 flex-col gap-3 overflow-y-auto overflow-x-hidden border-r bg-slate-50/50 p-3">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-1.5 text-xs font-semibold uppercase text-slate-500">Esquema de color</div>
              <ColorSchemeBar scheme={colorScheme} onChange={setColorScheme} />
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                <Legend scheme={colorScheme} currentData={visibleData} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t pt-3">
              <ExportExcelButton
                zonas={zonas}
                currentData={visibleData}
                allData={pdv}
                filtros={filtros}
                excluidos={pdvExcluidosInfo}
                rangoVentas={rangoVentas}
                onError={showError}
                onSuccess={(fname) => toast({ title: 'Excel exportado', description: fname })}
              />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => mapRef.current?.fitToData()}>
                <Maximize2 className="h-3.5 w-3.5" />
                Centrar mapa
              </Button>
              <Button size="sm" variant="outline" onClick={() => setLabelsVisible((v) => !v)}>
                {labelsVisible ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPolygonsVisible((v) => !v)}>
                {polygonsVisible ? 'Ocultar polígonos' : 'Mostrar polígonos'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!puedeEditarActivo}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleLimpiarZonas}
              >
                Limpiar zonas del grupo
              </Button>
            </div>

            <p className="border-t pt-2 text-[11px] text-slate-400">
              Dibujá un polígono o rectángulo sobre el mapa para crear una zona.
            </p>
          </aside>
        )}

        <main className="relative flex-1">
          {(pdvLoading || gruposLoading) && (
            <div className="absolute inset-0 z-[1050] flex items-center justify-center bg-white/60 text-sm text-slate-500">
              Cargando...
            </div>
          )}

          {/* Zoom y dibujo de Leaflet quedan abajo-a-la-derecha (ver MapView), así que las
              esquinas de arriba quedan libres. El toggle de filtros va pegado a la derecha
              del de panel izquierdo, en vez de en su propia esquina. */}
          <div className="absolute left-2 top-2 z-[1050] flex gap-1">
            <button
              type="button"
              title={leftPanelVisible ? 'Ocultar panel izquierdo' : 'Mostrar panel izquierdo'}
              onClick={() => setLeftPanelVisible((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-md border bg-white shadow-sm hover:bg-slate-50"
            >
              {leftPanelVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <button
              type="button"
              title={filtersVisible ? 'Ocultar filtros' : 'Mostrar filtros'}
              onClick={() => setFiltersVisible((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-md border bg-white shadow-sm hover:bg-slate-50"
            >
              {filtersVisible ? <PanelTopClose className="h-4 w-4" /> : <PanelTopOpen className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            title={rightPanelVisible ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}
            onClick={() => setRightPanelVisible((v) => !v)}
            className="absolute right-2 top-2 z-[1050] flex h-7 w-7 items-center justify-center rounded-md border bg-white shadow-sm hover:bg-slate-50"
          >
            {rightPanelVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>

          <MapView
            ref={mapRef}
            pdv={visibleData}
            colorScheme={colorScheme}
            zonas={zonas}
            labelsVisible={labelsVisible}
            polygonsVisible={polygonsVisible}
            filtroVendedor={filtros.vndCod}
            rangoVentas={rangoVentas}
            onZonaCreada={handleZonaDibujada}
            onExcluirPdv={handleExcluirPdv}
          />
        </main>

        {rightPanelVisible && (
          <aside className="flex w-72 flex-col border-l bg-white">
            <GroupsPanel
              grupos={grupos}
              activeId={activeId}
              puedeEditar={puedeEditar}
              onSwitch={setActiveId}
              onCreate={handleCrearGrupo}
              onEdit={handleEditarGrupo}
              onDelete={handleEliminarGrupo}
            />
            <ZonesSidebar
              zonas={zonas}
              pdv={visibleData}
              universoPdv={pdv}
              editingIndex={editingIndex}
              readOnly={!puedeEditarActivo}
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onRename={handleRename}
              onDelete={handleDeleteZona}
              onAplicarCriterios={handleAplicarCriterios}
            />
          </aside>
        )}
      </div>

      <ZoneConfirmDialog
        open={zonaPendiente != null}
        defaultNombre={`Zona ${zonas.length + 1}`}
        cantidadPdv={puntosZonaPendiente.length}
        facturacionTotal={facturacionZonaPendiente}
        rangoVentas={rangoVentas}
        solapamiento={solapamientoZonaPendiente}
        onConfirm={handleConfirmarZona}
        onCancel={handleCancelarZona}
      />
    </div>
  );
}
