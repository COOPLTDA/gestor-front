import { useState, useCallback, useMemo, useRef, useLayoutEffect, type DragEvent } from 'react'
import type { Chofer, CodigoDespacho, Preparacion, SigmaSyncEstado } from '../types/biblia'
import type { PedidoCambioEstado } from '@/services/bibliaApi'
import { Truck, MapPin, X, Eye, Plus, GripVertical, Search } from 'lucide-react'
import { cn } from "@/lib/utils"
import { formatCurrency, ESTADO_BORDER, TIPO_BG } from "../utils/bibliaUtils"
import { RepartoExcepcionalModal } from './RepartoExcepcionalModal'
import { PreparacionDetalleModal } from './PreparacionDetalleModal'

// NOTA mutation testing (24/07/2026): este archivo quedó en ~89.4% de mutation score, por debajo
// del objetivo de 90% del módulo, tras varias rondas de trabajo (60.8% -> 89.4%). No se sigue
// forzando porque el resto de los sobrevivientes cae en categorías ya identificadas como de bajo
// valor o no observables en este entorno de test, no en huecos reales de cobertura:
// - Fórmulas de tamaño de fuente con `clamp()` en estilos inline (líneas ~430-471): jsdom no
//   soporta `clamp()` en CSSOM, así que el estilo queda vacío en los tests y esos mutantes no se
//   pueden verificar leyendo el DOM (mismo tipo de limitación que Leaflet/canvas en Zonificación).
// - Guards defensivos que en la práctica son inalcanzables: p.ej. `choferTieneCodigo` chequea
//   `!draggedCodigos` pero solo se invoca cuando `isDragging` (que ya implica `draggedCodigos`
//   no nulo) es true.
// - Asignaciones a `effectAllowed`/`dropEffect` de DataTransfer: no observables vía
//   fireEvent/testing-library, que copia las props del dataTransfer mockeado a un objeto nuevo
//   al despachar el evento (los métodos sí se ven, las reasignaciones de propiedades no).
// - Varios arrays de dependencias de `useCallback` sin un test de re-render dedicado (bajo
//   impacto, closures que rara vez cambian en la práctica).
// Si se retoma este archivo, arrancar por el reporte HTML de Stryker para priorizar por impacto.

interface ChoferesListProps {
  choferes: Chofer[]
  codigosDespacho: CodigoDespacho[]
  codigosDespachoByChofer: Map<string, CodigoDespacho[]>
  preparacionesPorChofer: Map<string, Preparacion[]>
  onReasignar: (prep: Preparacion, choferCodigo: string, codigoDespacho: CodigoDespacho) => Promise<void>
  onDesasignarPreparacion: (preparacionId: number) => Promise<void>
  onDragStart: (prep: Preparacion) => void
  onDragEnd: () => void
  draggedPrep: Preparacion | null
  draggedCodigos: Set<string> | null
  onRecargarExcepciones: () => Promise<void>
  onEliminarExcepcion: (excepcionId: number) => Promise<void>
  onModificado: () => void
  fecha: string
  sigmaEstadoByPrepId?: Map<number, SigmaSyncEstado>
  pedidoCambiosByPrepId?: Map<number, PedidoCambioEstado[]>
  asignacionCrossCodeByPrepId?: Map<number, { destino_nombre: string | null; destino_id: string | null; sigma_sync_estado: SigmaSyncEstado }>
}

export function ChoferesList({ choferes: allChoferes, codigosDespacho, codigosDespachoByChofer, preparacionesPorChofer, onReasignar, onDesasignarPreparacion, onDragStart, onDragEnd, draggedPrep, draggedCodigos, onRecargarExcepciones, onEliminarExcepcion, onModificado, fecha, sigmaEstadoByPrepId, pedidoCambiosByPrepId, asignacionCrossCodeByPrepId }: ChoferesListProps) {
  const [dragOverChofer, setDragOverChofer] = useState<string | null>(null)
  const [modalPreparacion, setModalPreparacion] = useState<Preparacion | null>(null)
  const [modalExcepcionAbierto, setModalExcepcionAbierto] = useState(false)
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroCodigoDespacho, setFiltroCodigoDespacho] = useState('')
  const [filtroPrepId, setFiltroPrepId] = useState('')
  // Selector de código de despacho cuando el chofer destino atiende más de uno.
  const [selector, setSelector] = useState<{ prep: Preparacion; choferCodigo: string; opciones: CodigoDespacho[] } | null>(null)
  const [confirmCross, setConfirmCross] = useState<{ prep: Preparacion; choferCodigo: string; codigoDespacho: CodigoDespacho; codigoActual: string | null } | null>(null)

  const isDragging = draggedCodigos != null

  // ¿el chofer atiende el código de despacho de la prep arrastrada? (para resaltar en la grilla)
  const choferTieneCodigo = useCallback((choferCodigo: string) => {
    if (!draggedCodigos || draggedCodigos.size === 0) return false
    const reps = codigosDespachoByChofer.get(choferCodigo) || []
    return reps.some(r => r.nombre !== null && draggedCodigos.has(r.nombre))
  }, [draggedCodigos, codigosDespachoByChofer])

  // Códigos de despacho que atiende un chofer (destinos posibles al reasignar).
  // Usa codigosDespachoByChofer para incluir también los repartos excepcionales.
  const codigosDespachoDeChofer = useCallback((choferCodigo: string) =>
    (codigosDespachoByChofer.get(choferCodigo) ?? []).filter(r => r.nombre !== null),
    [codigosDespachoByChofer]
  )

  // Filtro de preparaciones asignadas por cliente, código de despacho o id de preparación.
  const prepCoincideFiltro = useCallback((p: Preparacion) => {
    const cliente = filtroCliente.trim().toLowerCase()
    if (cliente && !p.pedidos.some(ped => (ped.cliente_nombre ?? '').toLowerCase().includes(cliente))) return false

    const codigo = filtroCodigoDespacho.trim().toLowerCase()
    if (codigo && !p.pedidos.some(ped => (ped.codigo_despacho ?? '').toLowerCase().includes(codigo))) return false

    const prepId = filtroPrepId.trim()
    if (prepId && !String(p.id).includes(prepId)) return false

    return true
  }, [filtroCliente, filtroCodigoDespacho, filtroPrepId])

  // Orden ESTABLE (no cambia al arrastrar, para no mover la card que se está agarrando).
  // Choferes inactivos siempre al final.
  const choferesOrdenados = useMemo(() => {
    const nombreBuscado = filtroNombre.trim().toLowerCase()
    const filtrados = allChoferes.filter(c =>
      (codigosDespachoByChofer.has(c.codigo) || preparacionesPorChofer.has(c.codigo)) &&
      (!nombreBuscado || (c.descripcion ?? '').toLowerCase().includes(nombreBuscado))
    )
    return [...filtrados].sort((a, b) => {
      if (a.desactivado !== b.desactivado) return a.desactivado ? 1 : -1;
      const aTienePrep = preparacionesPorChofer.has(a.codigo)
      const bTienePrep = preparacionesPorChofer.has(b.codigo)
      if (aTienePrep && !bTienePrep) return -1
      if (!aTienePrep && bTienePrep) return 1
      return 0
    })
  }, [allChoferes, codigosDespachoByChofer, preparacionesPorChofer, filtroNombre])

  const overlayRef = useRef<HTMLDivElement>(null)
  const [overlayRowH, setOverlayRowH] = useState(100)

  useLayoutEffect(() => {
    if (!isDragging) return
    const el = overlayRef.current
    if (!el) return
    const measure = () => {
      const numCols = window.innerWidth >= 1536 ? 5 : window.innerWidth >= 640 ? 4 : 3
      const numRows = Math.ceil(choferesOrdenados.length / numCols)
      const headerH = (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? 40
      const availH = el.clientHeight - headerH - 16
      const ideal = (availH - 8 * (numRows - 1)) / numRows
      setOverlayRowH(Math.max(60, Math.min(ideal, 120)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isDragging, choferesOrdenados.length])

  const intentarReasignar = useCallback((prep: Preparacion, choferCodigo: string, codigoDespacho: CodigoDespacho) => {
    const codigos = new Set(prep.pedidos.map(p => p.codigo_despacho).filter(Boolean))
    const codigoActual = codigos.size === 1 ? [...codigos][0] as string : null
    // Si ya se impactó un cross-code en Sigma, el código efectivo es el destino, no el que
    // todavía muestra Digip (puede no haber sincronizado). Volver al código de Digip también
    // es un cross-code en ese caso — ver la misma lógica en useBibliaData.reasignarPreparacion.
    const crossCodeOk = asignacionCrossCodeByPrepId?.get(prep.id)
    const codigoEfectivoSigma = (crossCodeOk?.sigma_sync_estado === 'ok' && crossCodeOk.destino_nombre)
      ? crossCodeOk.destino_nombre
      : codigoActual
    if (codigoDespacho.nombre !== codigoEfectivoSigma) {
      setConfirmCross({ prep, choferCodigo, codigoDespacho, codigoActual: codigoEfectivoSigma })
    } else {
      onReasignar(prep, choferCodigo, codigoDespacho)
    }
  }, [onReasignar, asignacionCrossCodeByPrepId])

  const iniciarReasignacion = useCallback((prep: Preparacion, choferCodigo: string) => {
    const opciones = codigosDespachoDeChofer(choferCodigo)
    if (opciones.length === 0) return
    if (opciones.length === 1) { intentarReasignar(prep, choferCodigo, opciones[0]); return }
    setSelector({ prep, choferCodigo, opciones })
  }, [codigosDespachoDeChofer, intentarReasignar])

  const startDragPrep = useCallback((e: DragEvent<HTMLDivElement>, prep: Preparacion) => {
    e.dataTransfer.setData('text/plain', String(prep.id))
    // NOTA mutation testing: el string 'move' de effectAllowed no es observable con
    // fireEvent/testing-library — RTL copia las props del dataTransfer mockeado a un objeto
    // nuevo al despachar el evento sintético, así que la reasignación queda en esa copia, no
    // en el objeto que inspecciona el test. Solo los métodos (como setData) son verificables,
    // porque la referencia a la función viaja igual. No se persigue este mutante.
    e.dataTransfer.effectAllowed = 'move'
    // Diferido: dejamos que el navegador "tome" el arrastre ANTES de comprimir la vista,
    // si no, el cambio de DOM durante el dragstart cancela el drag.
    requestAnimationFrame(() => onDragStart(prep))
  }, [onDragStart])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, choferCodigo: string) => {
    e.preventDefault()
    // NOTA mutation testing: mismo caso que effectAllowed en startDragPrep — no observable
    // vía fireEvent/testing-library.
    e.dataTransfer.dropEffect = 'move'
    if (dragOverChofer !== choferCodigo) setDragOverChofer(choferCodigo)
  }, [dragOverChofer])

  const handleDragLeave = useCallback(() => setDragOverChofer(null), [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, choferCodigo: string) => {
    e.preventDefault()
    setDragOverChofer(null)
    const prep = draggedPrep
    onDragEnd()
    if (prep) iniciarReasignacion(prep, choferCodigo)
  }, [draggedPrep, iniciarReasignacion, onDragEnd])

  return (
    <div className="relative flex-1 min-h-0">
      {/* Vista normal — filas de choferes. SIEMPRE montada (así la card que se arrastra no
          se desmonta y el drag nativo sobrevive aunque arriba aparezca la grilla). */}
      <div className="absolute inset-0 overflow-y-auto space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            Choferes ({choferesOrdenados.length})
          </h3>
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-400" />
              <input
                value={filtroNombre}
                onChange={e => setFiltroNombre(e.target.value)}
                placeholder="Filtrar por nombre..."
                className="h-6 w-40 pl-6 pr-2 text-xs rounded-md border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              onClick={() => setModalExcepcionAbierto(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 shrink-0"
              title="Agregar reparto excepcional"
            >
              <Plus className="w-3 h-3" />
              excep.
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-1 flex-wrap">
          <span className="text-[11px] text-slate-400 shrink-0">Filtrar preparaciones:</span>
          <input
            value={filtroCliente}
            onChange={e => setFiltroCliente(e.target.value)}
            placeholder="Cliente..."
            className="h-6 w-32 px-2 text-xs rounded-md border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={filtroCodigoDespacho}
            onChange={e => setFiltroCodigoDespacho(e.target.value)}
            placeholder="Código despacho..."
            className="h-6 w-32 px-2 text-xs rounded-md border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={filtroPrepId}
            onChange={e => setFiltroPrepId(e.target.value)}
            placeholder="ID preparación..."
            className="h-6 w-28 px-2 text-xs rounded-md border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {choferesOrdenados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <Truck className="w-8 h-8" />
            <p className="text-sm font-medium">Sin choferes para esta fecha</p>
            <p className="text-sm text-center">No hay preparaciones o ningún código de despacho coincide con los choferes configurados</p>
          </div>
        ) : choferesOrdenados.map((chofer) => {
          const reps = codigosDespachoByChofer.get(chofer.codigo) || []
          const preparaciones = (preparacionesPorChofer.get(chofer.codigo) || []).filter(prepCoincideFiltro)
          return (
            <div
              key={chofer.codigo}
              className={cn(
                "rounded-lg border-2 border-dashed min-h-[120px] flex flex-col",
                chofer.desactivado ? "bg-slate-50/60 border-slate-200 opacity-80" : "bg-white border-slate-300"
              )}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-dashed border-slate-200">
                <div className={cn("rounded-full p-2 shrink-0", chofer.desactivado ? "bg-slate-200" : "bg-blue-100")}>
                  <Truck className={cn("w-4 h-4", chofer.desactivado ? "text-slate-400" : "text-blue-600")} />
                </div>
                <span className={cn("text-sm font-semibold truncate flex-1", chofer.desactivado ? "text-slate-400 line-through" : "text-slate-800")}>
                  {chofer.descripcion}
                </span>
                {chofer.desactivado ? (
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">Inactivo</span>
                ) : null}
                <span className={cn("text-sm shrink-0 px-2 py-0.5 rounded-full", chofer.desactivado ? "text-slate-400 bg-slate-100" : "text-muted-foreground bg-slate-200")}>
                  #{chofer.codigo}
                </span>
              </div>

              {preparaciones.length > 0 && (() => {
                const uniqueClients = new Set<string>()
                let totalPedidos = 0
                let totalImporte = 0
                for (const p of preparaciones) {
                  totalPedidos += p.cantidad_pedidos
                  totalImporte += p.importe_total
                  for (const ped of p.pedidos) {
                    if (ped.codigo_cliente_ubicacion) uniqueClients.add(ped.codigo_cliente_ubicacion)
                    else if (ped.cliente_nombre) uniqueClients.add(ped.cliente_nombre)
                  }
                }
                return (
                  <div className="flex items-center gap-2 px-4 py-1.5 text-sm text-slate-500 border-b border-dashed border-slate-200">
                    <span>{uniqueClients.size} cliente{uniqueClients.size !== 1 ? "s" : ""} únicos</span>
                    <span className="text-slate-400">·</span>
                    <span>{totalPedidos} pedido{totalPedidos !== 1 ? "s" : ""}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(totalImporte)}</span>
                  </div>
                )
              })()}

              {preparaciones.length > 0 && (
                <div className="px-4 py-2">
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-1.5">
                    Preparaciones ({preparaciones.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {preparaciones.map(p => (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={e => startDragPrep(e, p)}
                        onDragEnd={onDragEnd}
                        className={cn("w-[160px] border-l-4 rounded-md p-2 text-sm space-y-1 group hover:bg-white transition-colors shadow cursor-grab active:cursor-grabbing", TIPO_BG[p.tipo] || "bg-white", ESTADO_BORDER[p.estado?.toLowerCase() || ""] || "border-l-slate-400")}
                      >
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-3 h-3 shrink-0 text-slate-300" />
                          <span className="font-semibold text-slate-800 truncate flex-1">{p.codigo_envio || `#${p.id}`}</span>
                          {sigmaEstadoByPrepId?.get(p.id) === 'pendiente' && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-300 px-1 py-0.5 rounded" title="Cambio de código pendiente de impactar en Sigma">
                              sigma
                            </span>
                          )}
                          {sigmaEstadoByPrepId?.get(p.id) === 'ok' && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-300 px-1 py-0.5 rounded" title="Impactado en Sigma — esperando sincronización con Digip">
                              sync
                            </span>
                          )}
                          {sigmaEstadoByPrepId?.get(p.id) === 'fallido' && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-red-700 bg-red-100 border border-red-300 px-1 py-0.5 rounded" title="No se pudo impactar en Sigma — los pedidos ya no estaban Pendiente al intentar">
                              sigma!
                            </span>
                          )}
                          {sigmaEstadoByPrepId?.get(p.id) === 'bloqueado' && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-red-700 bg-red-100 border border-red-300 px-1 py-0.5 rounded" title="No se puede impactar en Sigma — los pedidos ya no están en estado Pendiente">
                              bloq
                            </span>
                          )}
                          <button
                            onClick={() => onDesasignarPreparacion(p.id)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                            title="Desasignar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="font-semibold text-emerald-700">{formatCurrency(p.importe_total)}</p>
                        <div className="flex items-center gap-1 text-slate-400">
                          <span>{p.cantidad_clientes} cli</span>
                          <span>·</span>
                          <span>{p.cantidad_pedidos} ped</span>
                        </div>
                        {(s => s ? <p className="text-xs text-slate-500 font-mono truncate" title={s}>{s}</p> : null)(
                          [...new Set(p.pedidos.map(ped => ped.codigo_despacho).filter(Boolean))].join(', ')
                        )}
                        {(p.tipo === 'Pedidos individuales' || p.tipo === 'Agrupa por direccion de entrega') && (s => s ? (
                          <p className="text-xs text-slate-600 truncate" title={s}>{s}</p>
                        ) : null)(
                          [...new Set(p.pedidos.map(ped => ped.cliente_nombre).filter(Boolean))].join(', ')
                        )}
                        <button
                          onClick={() => setModalPreparacion(p)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          <Eye className="w-2.5 h-2.5" />
                          Ver detalle
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reps.length > 0 && (
                <div className="px-4 py-2 space-y-1">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Códigos de despacho ({reps.length})
                  </p>
                  {reps.map(r => {
                    const esExcepcion = r.es_excepcion
                    const exId = esExcepcion ? (r.excepcion_id ?? null) : null
                    const coincide = !esExcepcion && isDragging && draggedCodigos && r.nombre && draggedCodigos.has(r.nombre)
                    return (
                      <div key={r.id} className={cn("flex items-center gap-1.5 text-sm rounded px-1 -mx-1", coincide && "bg-emerald-50")}>
                        <MapPin className={`w-3 h-3 shrink-0 ${esExcepcion ? 'text-orange-500' : coincide ? 'text-emerald-600' : 'text-slate-500'}`} />
                        <span className={`truncate ${esExcepcion ? 'text-orange-700 font-medium' : coincide ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>{r.nombre}</span>
                        {r.direccion && !esExcepcion && <span className="text-slate-400">· {r.direccion}</span>}
                        {esExcepcion && (
                          <>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">excep.</span>
                            <button
                              onClick={() => exId !== null && onEliminarExcepcion(exId)}
                              disabled={exId === null}
                              title={exId === null ? 'No se puede eliminar: falta el id de la excepción' : undefined}
                              className="shrink-0 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex-1 p-2 min-h-0" />
            </div>
          )
        })}
      </div>

      {/* Al arrastrar: la vista se comprime a una grilla de cards (todos los choferes en
          pantalla). Va por encima de la lista, que sigue montada debajo. */}
      {isDragging && choferesOrdenados.length > 0 && (
        <div ref={overlayRef} className="absolute inset-0 z-30 bg-slate-900/55 backdrop-blur-sm flex flex-col rounded-lg">
          <div className="px-3 py-2 text-xs font-semibold text-slate-200 uppercase tracking-wider shrink-0 border-b border-white/10">
            Soltá la preparación en un chofer
          </div>
          <div className="flex-1 min-h-0 overflow-hidden p-2">
            <div
              className="grid grid-cols-3 sm:grid-cols-4 2xl:grid-cols-5 gap-2"
              style={{ gridAutoRows: `${overlayRowH}px` }}
            >
              {choferesOrdenados.map((chofer) => {
                const isOver = dragOverChofer === chofer.codigo
                const compatible = choferTieneCodigo(chofer.codigo)
                const codigos = codigosDespachoDeChofer(chofer.codigo)
                const inactivo = chofer.desactivado
                return (
                  <div
                    key={chofer.codigo}
                    onDragOver={e => handleDragOver(e, chofer.codigo)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, chofer.codigo)}
                    style={{ containerType: 'size' }}
                    className={cn(
                      "rounded-lg border-2 px-2 py-1.5 flex flex-col justify-center gap-[0.3cqh] transition-colors overflow-hidden min-h-0",
                      inactivo
                        ? "border-dashed border-slate-200 bg-slate-50"
                        : isOver
                          ? "border-solid border-blue-500 bg-blue-200"
                          : compatible
                            ? "border-solid border-emerald-500 bg-emerald-100 shadow-[0_0_0_3px_theme(colors.emerald.300)]"
                            : "border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50"
                    )}
                    title={chofer.descripcion ?? undefined}
                  >
                    {(() => {
                      // Font size del nombre: tan grande como quepa en una línea.
                      // 155cqi / nameLen da el % del ancho del contenedor que ocupa cada char.
                      // min(..., 30cqh) evita que supere el 30% del alto de la card.
                      // NOTA mutation testing: jsdom no soporta clamp() en estilos inline — el
                      // atributo/propiedad style queda vacío en tests, así que los mutantes que
                      // tocan esta fórmula (125/nameLen, el string completo, etc.) no se pueden
                      // verificar leyendo el DOM en este entorno (mismo tipo de limitación que
                      // Leaflet/canvas en Zonificación). No se fuerzan tests de relleno.
                      const nameLen = Math.max((chofer.descripcion ?? '').length, 1)
                      const nameFontSize = `clamp(10px, min(${Math.round(125 / nameLen)}cqi, 24cqh), 15px)`
                      const metaFontSize = `clamp(8px, min(10cqi, 18cqh), 11px)`
                      const iconSize = `clamp(10px, min(16cqi, 18cqh), 14px)`
                      return (
                        <>
                          <div className="flex items-center gap-[1.5cqi] min-w-0">
                            <Truck
                              style={{ width: iconSize, height: iconSize }}
                              className={cn("shrink-0", inactivo ? "text-slate-400" : "text-blue-600")}
                            />
                            <span
                              style={{ fontSize: nameFontSize }}
                              className={cn("font-semibold leading-none whitespace-nowrap overflow-hidden text-ellipsis", inactivo ? "text-slate-400 line-through" : "text-slate-800")}
                            >
                              {chofer.descripcion}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-[0.8cqi]">
                            <span style={{ fontSize: metaFontSize }} className="text-slate-400 shrink-0">
                              #{chofer.codigo}
                            </span>
                            {codigos.slice(0, 6).map(r => {
                              const coincide = r.nombre !== null && draggedCodigos?.has(r.nombre)
                              return (
                                <span
                                  key={r.id}
                                  style={{ fontSize: metaFontSize, padding: '0.1em 0.3em' }}
                                  className={cn(
                                    "font-mono rounded leading-none shrink-0",
                                    coincide
                                      ? "bg-emerald-200 text-emerald-800 font-semibold"
                                      : r.es_excepcion
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-slate-200 text-slate-500"
                                  )}
                                >
                                  {r.nombre}
                                </span>
                              )
                            })}
                            {codigos.length > 6 && (
                              <span style={{ fontSize: metaFontSize }} className="text-slate-400">
                                +{codigos.length - 6}
                              </span>
                            )}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Selector de código de despacho (cuando el chofer destino atiende más de uno) */}
      {selector && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelector(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Elegí el código de despacho</h3>
            <p className="text-xs text-slate-500 mb-3">El chofer atiende varios. ¿A cuál va la preparación?</p>
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {(() => {
                const prepCodigos = new Set(selector.prep.pedidos.map(ped => ped.codigo_despacho).filter(Boolean))
                return selector.opciones.map(r => {
                  const coincide = r.nombre !== null && prepCodigos.has(r.nombre)
                  return (
                    <button
                      key={r.id}
                      onClick={() => { intentarReasignar(selector.prep, selector.choferCodigo, r); setSelector(null) }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-md border text-left",
                        coincide
                          ? "border-emerald-400 bg-emerald-50 hover:bg-emerald-100"
                          : "border-slate-200 hover:bg-blue-50 hover:border-blue-300"
                      )}
                    >
                      <MapPin className={cn("w-3.5 h-3.5 shrink-0", coincide ? "text-emerald-600" : "text-slate-500")} />
                      <span className={cn("font-medium", coincide ? "text-emerald-800" : "text-slate-700")}>{r.nombre}</span>
                      {coincide && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded ml-1">coincide</span>}
                      {r.direccion && <span className="text-xs text-slate-400 ml-auto">{r.direccion}</span>}
                    </button>
                  )
                })
              })()}
            </div>
            <button
              onClick={() => setSelector(null)}
              className="mt-3 w-full text-sm text-slate-500 hover:text-slate-700 py-1.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {modalPreparacion && (
        <PreparacionDetalleModal
          preparacion={modalPreparacion}
          open={true}
          onClose={() => setModalPreparacion(null)}
          codigosDespacho={codigosDespacho}
          onModificado={onModificado}
          isAsignada={true}
          onDesasignarAlEditar={() => {
            onDesasignarPreparacion(modalPreparacion.id);
          }}
          bibliaFecha={fecha}
          pedidoCambios={pedidoCambiosByPrepId?.get(modalPreparacion.id)}
          asignacionCrossCode={asignacionCrossCodeByPrepId?.get(modalPreparacion.id)}
        />
      )}

      {confirmCross && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmCross(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Cambiar código de despacho</h3>
            <p className="text-sm text-slate-600 mb-1">
              {confirmCross.codigoActual
                ? <>Los pedidos de esta preparación se van a reasignar de{' '}
                    <span className="font-semibold text-slate-800">{confirmCross.codigoActual}</span>{' '}
                    a{' '}
                    <span className="font-semibold text-slate-800">{confirmCross.codigoDespacho.nombre}</span>.</>
                : <>Los pedidos de esta preparación se van a reasignar al código{' '}
                    <span className="font-semibold text-slate-800">{confirmCross.codigoDespacho.nombre}</span>.</>
              }
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
              El cambio queda pendiente de impactar en Sigma. Usá el botón <em>Impactar en Sigma</em> cuando estés listo.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmCross(null)}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => { onReasignar(confirmCross.prep, confirmCross.choferCodigo, confirmCross.codigoDespacho); setConfirmCross(null) }}
                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                Confirmar cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {modalExcepcionAbierto && (
        <RepartoExcepcionalModal
          open={modalExcepcionAbierto}
          onClose={() => setModalExcepcionAbierto(false)}
          fecha={fecha}
          codigosDespachoGlobales={codigosDespacho}
          codigosDespachoByChofer={codigosDespachoByChofer}
          onCreado={onRecargarExcepciones}
        />
      )}
    </div>
  )
}
