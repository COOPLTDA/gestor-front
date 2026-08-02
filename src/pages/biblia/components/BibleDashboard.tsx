import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Preparacion } from '../types/biblia'
import { useBibliaData } from '../hooks/useBibliaData'
import { Filters } from './Filters'
import { PendingSidebar } from './PendingSidebar'
import { ChoferesList } from './ChoferesList'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trash2, LayoutGrid, AlertTriangle, Send } from 'lucide-react'
import { BibliaResumenModal } from './BibliaResumenModal'

export function BibleDashboard() {
  const {
    isLoading,
    error,
    clearError,
    recargarPreparaciones,
    estados,
    estadosSeleccionados,
    zonas,
    zonasSeleccionadas,
    preparacionesDisponibles,
    ocupadasEnOtraBiblia,
    preparacionesPorChofer,
    choferes,
    codigosDespacho,
    codigosDespachoByChofer,
    fechaDesde,
    fechaHasta,
    bibliaFecha,
    setFechaDesde,
    setFechaHasta,
    setBibliaFecha,
    toggleZona,
    setZonasSeleccionadas,
    toggleEstado,
    reasignarPreparacion,
    desasignarPreparacion,
    autoAsignarPendientes,
    impactarEnSigma,
    sigmaEstadoByPrepId,
    pedidoCambiosByPrepId,
    asignacionCrossCodeByPrepId,
    recargarExcepciones,
    eliminarExcepcion,
    limpiarBiblia,
  } = useBibliaData()

  const [impactarLoading, setImpactarLoading] = useState(false)
  const [fallidoDismissed, setFallidoDismissed] = useState(false)
  // NOTA mutation testing: el valor inicial de errorSigmaDismissed es inobservable — solo
  // importa junto con lastImpactError, que arranca en [] y por ende no muestra ese banner
  // hasta el primer handleImpactar, el cual ya resetea errorSigmaDismissed a false antes de
  // poblar lastImpactError. Mutar el default a `true` no cambia ningún comportamiento.
  const [errorSigmaDismissed, setErrorSigmaDismissed] = useState(false)
  const [lastImpactError, setLastImpactError] = useState<number[]>([])
  // NOTA mutation testing: bloqueadoDismissed y pendienteDismissed tienen cada uno un
  // useEffect (más abajo) que los resetea a `false` en cada mount/cambio si hay
  // preps bloqueadas/pendientes — así que su valor inicial nunca es observable: cualquier
  // test con preps presentes desde el arranque ve el mismo resultado sin importar el default.
  const [bloqueadoDismissed, setBloqueadoDismissed] = useState(false)
  const [pendienteDismissed, setPendienteDismissed] = useState(false)
  const [draggedCodigos, setDraggedCodigos] = useState<Set<string> | null>(null)
  const [draggedPrep, setDraggedPrep] = useState<Preparacion | null>(null)
  const [limpiarOpen, setLimpiarOpen] = useState(false)
  const [resumenOpen, setResumenOpen] = useState(false)

  const prepsPendientes = useMemo(
    () => [...sigmaEstadoByPrepId.entries()].filter(([, e]) => e === 'pendiente').map(([id]) => id),
    [sigmaEstadoByPrepId]
  )
  const prepsFallidas = useMemo(
    () => [...sigmaEstadoByPrepId.entries()].filter(([, e]) => e === 'fallido').map(([id]) => id),
    [sigmaEstadoByPrepId]
  )
  const prepsBloqueadas = useMemo(
    () => [...sigmaEstadoByPrepId.entries()].filter(([, e]) => e === 'bloqueado').map(([id]) => id),
    [sigmaEstadoByPrepId]
  )
  const prepsOkSinSincronizar = useMemo(
    () => [...sigmaEstadoByPrepId.entries()].filter(([, e]) => e === 'ok').map(([id]) => id),
    [sigmaEstadoByPrepId]
  )

  const preparacionById = useMemo(() => {
    const map = new Map<number, Preparacion>()
    for (const p of preparacionesDisponibles) map.set(p.id, p)
    for (const preps of preparacionesPorChofer.values()) for (const p of preps) map.set(p.id, p)
    return map
  }, [preparacionesDisponibles, preparacionesPorChofer])

  const prepLabel = useCallback((id: number) => {
    const p = preparacionById.get(id)
    return p?.codigo_envio ?? `#${id}`
  }, [preparacionById])

  const prepListLabel = useCallback((ids: number[]) => {
    const MAX = 4
    const labels = ids.slice(0, MAX).map(prepLabel)
    const resto = ids.length - MAX
    return labels.join(', ') + (resto > 0 ? ` y ${resto} más` : '')
  }, [prepLabel])

  // NOTA mutation testing: el guard "length > 0" de estos dos efectos es inobservable —
  // el banner correspondiente ya está condicionado por el mismo "length > 0" al renderizar
  // (más abajo), así que forzar el reset con length === 0 no cambia nada visible: el
  // banner sigue sin mostrarse porque no hay preps que listar.
  useEffect(() => {
    if (prepsPendientes.length > 0) setPendienteDismissed(false);
  }, [prepsPendientes.length])
  useEffect(() => {
    if (prepsBloqueadas.length > 0) setBloqueadoDismissed(false);
  }, [prepsBloqueadas.length])

  const handleImpactar = useCallback(async () => {
    setImpactarLoading(true)
    setFallidoDismissed(false)
    setErrorSigmaDismissed(false)
    try {
      const result = await impactarEnSigma()
      // NOTA mutation testing: el guard "length > 0" acá también es inobservable — si
      // result.error es [], llamar setLastImpactError([]) deja el estado igual de vacío
      // que no llamarlo, y el banner de error también está gateado por el mismo length > 0.
      if (result.error.length > 0) {
        setLastImpactError(result.error)
      }
    } finally {
      setImpactarLoading(false)
    }
  }, [impactarEnSigma])

  const handleDragStart = useCallback((prep: Preparacion) => {
    setDraggedPrep(prep)
    setDraggedCodigos(new Set(prep.pedidos.map(p => p.codigo_despacho).filter(Boolean) as string[]))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedPrep(null)
    setDraggedCodigos(null)
  }, [])

  const handleReasignar = useCallback(async (...args: Parameters<typeof reasignarPreparacion>) => {
    await reasignarPreparacion(...args);
  }, [reasignarPreparacion])

  const handleDesasignarViaDrop = useCallback((prepId: number) => {
    const isAssigned = [...preparacionesPorChofer.values()].flat().some(p => p.id === prepId)
    if (isAssigned) desasignarPreparacion(prepId)
  }, [preparacionesPorChofer, desasignarPreparacion])

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Filters
            estados={estados}
            estadosSeleccionados={estadosSeleccionados}
            onToggleEstado={toggleEstado}
            zonas={zonas}
            zonasSeleccionadas={zonasSeleccionadas}
            onToggleZona={toggleZona}
            onSetZonas={setZonasSeleccionadas}
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
            bibliaFecha={bibliaFecha}
            onFechaDesdeChange={setFechaDesde}
            onFechaHastaChange={setFechaHasta}
            onBibliaFechaChange={setBibliaFecha}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResumenOpen(true)}
          className="shrink-0"
          disabled={preparacionesPorChofer.size === 0}
        >
          <LayoutGrid className="w-4 h-4" />
          Resumen y mapa
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImpactar}
          className="shrink-0"
          disabled={impactarLoading || (prepsPendientes.length === 0 && prepsFallidas.length === 0)}
          title={
            prepsPendientes.length === 0 && prepsFallidas.length === 0
              ? 'No hay cambios de reparto pendientes de impactar'
              : prepsFallidas.length > 0 && prepsPendientes.length === 0
                ? `Reintentar ${prepsFallidas.length} preparación${prepsFallidas.length !== 1 ? 'es' : ''} que fallaron`
                : `Impactar ${prepsPendientes.length + prepsFallidas.length} preparación${prepsPendientes.length + prepsFallidas.length !== 1 ? 'es' : ''} en Sigma`
          }
        >
          <Send className="w-4 h-4" />
          {impactarLoading ? 'Impactando…' : 'Impactar en Sigma'}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setLimpiarOpen(true)}
          className="shrink-0"
        >
          <Trash2 className="w-4 h-4" />
          Limpiar biblia
        </Button>
      </div>

      {isLoading && (
        <div className="px-4 py-2 bg-blue-600/90 text-white text-sm">
          Cargando...
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="shrink-0 text-red-500 hover:text-red-700 font-medium"
          >
            Cerrar
          </button>
        </div>
      )}

      {prepsOkSinSincronizar.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>{prepsOkSinSincronizar.length} preparación{prepsOkSinSincronizar.length !== 1 ? 'es' : ''}</strong> con código de despacho actualizado en Sigma — los cambios se van a ver en la biblia después de la próxima sincronización con Digip.
            {' '}<span className="opacity-70">({prepListLabel(prepsOkSinSincronizar)})</span>
          </span>
        </div>
      )}

      {prepsBloqueadas.length > 0 && !bloqueadoDismissed && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">
            <strong>{prepsBloqueadas.length} preparación{prepsBloqueadas.length !== 1 ? 'es' : ''}</strong> con cambio de código de despacho que no se puede reflejar en Sigma porque sus pedidos ya no están en estado Pendiente. El cambio solo existe en la biblia.
            {' '}<span className="opacity-70">({prepListLabel(prepsBloqueadas)})</span>
          </span>
          <button onClick={() => setBloqueadoDismissed(true)} className="shrink-0 text-red-700 hover:text-red-900 font-medium">
            Cerrar
          </button>
        </div>
      )}

      {prepsFallidas.length > 0 && !fallidoDismissed && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">
            <strong>{prepsFallidas.length} preparación{prepsFallidas.length !== 1 ? 'es' : ''}</strong> no se pudo{prepsFallidas.length !== 1 ? 'ieron' : ''} impactar en Sigma — intentá nuevamente o revisá el estado de los pedidos.
            {' '}<span className="opacity-70">({prepListLabel(prepsFallidas)})</span>
          </span>
          <button onClick={() => setFallidoDismissed(true)} className="shrink-0 text-red-700 hover:text-red-900 font-medium">
            Cerrar
          </button>
        </div>
      )}

      {lastImpactError.length > 0 && !errorSigmaDismissed && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">
            <strong>{lastImpactError.length} preparación{lastImpactError.length !== 1 ? 'es' : ''}</strong> fallaron al comunicarse con Sigma — los pedidos estaban Pendiente pero la API rechazó el cambio. Revisá los datos e intentá nuevamente.
            {' '}<span className="opacity-70">({prepListLabel(lastImpactError)})</span>
          </span>
          <button onClick={() => setErrorSigmaDismissed(true)} className="shrink-0 text-red-700 hover:text-red-900 font-medium">
            Cerrar
          </button>
        </div>
      )}

      {prepsPendientes.length > 0 && !pendienteDismissed && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">
            <strong>{prepsPendientes.length} preparación{prepsPendientes.length !== 1 ? 'es' : ''}</strong> con cambio de reparto pendiente de impactar en Sigma. Usá el botón <em>Impactar en Sigma</em> cuando estés listo.
            {' '}<span className="opacity-70">({prepListLabel(prepsPendientes)})</span>
          </span>
          <button onClick={() => setPendienteDismissed(true)} className="shrink-0 text-amber-700 hover:text-amber-900 font-medium">
            Cerrar
          </button>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <PendingSidebar
          preparaciones={preparacionesDisponibles}
          codigosDespacho={codigosDespacho}
          ocupadasEnOtraBiblia={ocupadasEnOtraBiblia}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onModificado={recargarPreparaciones}
          onAutoAsignar={autoAsignarPendientes}
          draggedPrep={draggedPrep}
          onDesasignar={handleDesasignarViaDrop}
          sigmaEstadoByPrepId={sigmaEstadoByPrepId}
          pedidoCambiosByPrepId={pedidoCambiosByPrepId}
          asignacionCrossCodeByPrepId={asignacionCrossCodeByPrepId}
          fecha={bibliaFecha}
        />
        <ChoferesList
          choferes={choferes}
          codigosDespacho={codigosDespacho}
          codigosDespachoByChofer={codigosDespachoByChofer}
          preparacionesPorChofer={preparacionesPorChofer}
          onReasignar={handleReasignar}
          onDesasignarPreparacion={desasignarPreparacion}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          draggedPrep={draggedPrep}
          draggedCodigos={draggedCodigos}
          onRecargarExcepciones={recargarExcepciones}
          onEliminarExcepcion={eliminarExcepcion}
          onModificado={recargarPreparaciones}
          fecha={bibliaFecha}
          sigmaEstadoByPrepId={sigmaEstadoByPrepId}
          pedidoCambiosByPrepId={pedidoCambiosByPrepId}
          asignacionCrossCodeByPrepId={asignacionCrossCodeByPrepId}
        />
      </div>

      <BibliaResumenModal
        open={resumenOpen}
        onClose={() => setResumenOpen(false)}
        preparacionesPorChofer={preparacionesPorChofer}
        choferes={choferes}
        bibliaFecha={bibliaFecha}
        codigosDespacho={codigosDespacho}
        codigosDespachoByChofer={codigosDespachoByChofer}
        reasignarPreparacion={reasignarPreparacion}
      />

      <Dialog open={limpiarOpen} onOpenChange={setLimpiarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Limpiar biblia</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            ¿Borrar <strong>todas</strong> las asignaciones de la biblia del{' '}
            {new Date(bibliaFecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setLimpiarOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await limpiarBiblia();
                setLimpiarOpen(false);
              }}
            >
              Borrar todo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
