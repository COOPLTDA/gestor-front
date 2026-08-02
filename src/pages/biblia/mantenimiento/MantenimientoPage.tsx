import { useState, useMemo } from 'react'
import { Wrench, X, AlertTriangle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChoferesTab } from './components/ChoferesTab'
import { RutasTab } from './components/RutasTab'
import { ZonasTab } from './components/ZonasTab'
import { useMantenimiento } from './hooks/useMantenimiento'

export function MantenimientoPage() {
  const {
    choferes, codigosDespacho, zonas,
    loadingChoferes, loadingRepartos, loadingZonas,
    error,
    guardarChofer, toggleChofer,
    guardarCodigoDespacho, toggleCodigoDespacho,
    asignar, desasignar,
    guardarZona, toggleZona,
    asignarCodigoDespacho, desasignarCodigoDespacho,
  } = useMantenimiento()

  const [ocultarSinRepartos, setOcultarSinRepartos] = useState(false)
  const [ocultarSinChoferes, setOcultarSinChoferes] = useState(false)

  const choferesSinRepartos = useMemo(
    () => choferes.filter(c => !c.desactivado && (c.rutas ?? []).length === 0),
    [choferes]
  )

  const codigosSinChoferes = useMemo(
    () => codigosDespacho.filter(r => !r.desactivado && (r.choferes ?? []).length === 0),
    [codigosDespacho]
  )

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] bg-slate-50 flex flex-col">
      <div className="bg-gradient-to-r from-violet-600 to-violet-700 text-white px-6 py-4 flex items-center gap-4 shadow-md">
        <Wrench className="w-5 h-5 opacity-80" />
        <h1 className="text-lg font-semibold tracking-tight">Mantenimiento</h1>
      </div>

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
            {error}
          </div>
        )}

        {!ocultarSinRepartos && choferesSinRepartos.length > 0 && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-md text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <span className="flex-1">
              <strong>{choferesSinRepartos.length} chofer{choferesSinRepartos.length !== 1 ? 'es' : ''} sin ningún código de despacho asignado:</strong>{' '}
              {choferesSinRepartos.map(c => c.descripcion || c.codigo).join(', ')}
            </span>
            <button onClick={() => setOcultarSinRepartos(true)} className="shrink-0 hover:text-amber-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!ocultarSinChoferes && codigosSinChoferes.length > 0 && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-md text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <span className="flex-1">
              <strong>{codigosSinChoferes.length} código{codigosSinChoferes.length !== 1 ? 's' : ''} de despacho sin ningún chofer asignado:</strong>{' '}
              {codigosSinChoferes.map(r => r.nombre || r.id).join(', ')}
            </span>
            <button onClick={() => setOcultarSinChoferes(true)} className="shrink-0 hover:text-amber-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <Tabs defaultValue="choferes">
          <TabsList className="mb-6">
            <TabsTrigger value="choferes">
              Choferes
              <span className="ml-2 text-xs bg-white/30 px-1.5 py-0.5 rounded-full">{choferes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="rutas">
              Códigos de despacho
              <span className="ml-2 text-xs bg-white/30 px-1.5 py-0.5 rounded-full">{codigosDespacho.length}</span>
            </TabsTrigger>
            <TabsTrigger value="zonas">
              Zonas
              <span className="ml-2 text-xs bg-white/30 px-1.5 py-0.5 rounded-full">{zonas.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="choferes">
            <ChoferesTab
              choferes={choferes}
              codigosDespacho={codigosDespacho}
              loading={loadingChoferes}
              onGuardar={guardarChofer}
              onToggle={toggleChofer}
              onAsignar={asignar}
              onDesasignar={desasignar}
            />
          </TabsContent>

          <TabsContent value="rutas">
            <RutasTab
              codigosDespacho={codigosDespacho}
              choferes={choferes}
              zonas={zonas}
              loading={loadingRepartos}
              onGuardar={guardarCodigoDespacho}
              onToggle={toggleCodigoDespacho}
              onAsignar={asignar}
              onDesasignar={desasignar}
            />
          </TabsContent>

          <TabsContent value="zonas">
            <ZonasTab
              zonas={zonas}
              codigosDespacho={codigosDespacho}
              loading={loadingZonas}
              onGuardar={guardarZona}
              onToggle={toggleZona}
              onAsignar={asignarCodigoDespacho}
              onDesasignar={desasignarCodigoDespacho}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
