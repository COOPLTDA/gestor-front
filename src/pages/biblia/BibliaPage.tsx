import { useState, useEffect, useRef, useCallback } from 'react'
import { ClipboardList, RefreshCw, CheckCircle2, AlertCircle, Calendar, Globe } from 'lucide-react'
import { subscribeSyncAll, subscribeSyncHoy, fetchSyncStatus, subscribeSyncEvents, type SyncEvent } from '@/services/bibliaApi'
import { BibleDashboard } from './components/BibleDashboard'
import { Button } from '@/components/ui/button'

type SyncMode = 'all' | 'hoy' | null

interface SyncState {
  active: boolean
  mode: SyncMode
  stage: string
  current: number
  total: number
  message: string
  error?: string
  warning?: string
  ultimaActualizacion?: string
}

const LS_LAST_SYNC_KEY = 'biblia_last_sync'

function formatSyncTime(date: Date = new Date()) {
  const dia = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  const hora = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} ${hora}`
}

function parseDataVersion(v: string) {
  try {
    const [prepPart, pedPart, pendStr] = v.split('|')
    const [prepCntStr] = prepPart.split(':')
    const [pedCntStr, sumEstadoStr] = pedPart.split(':')
    return {
      prepCnt: Number(prepCntStr) || 0,
      pedCnt: Number(pedCntStr) || 0,
      sumEstado: Number(sumEstadoStr) || 0,
      pendientesCnt: Number(pendStr) || 0,
    }
  } catch {
    // NOTA mutation testing: un mutante que vacía este catch (sin `return null`, cae a
    // `return undefined` implícito) es equivalente — el único caller (`describeCambios`)
    // chequea `!p || !c`, y `undefined` es tan falsy como `null`.
    return null
  }
}

function describeCambios(
  prev: string, curr: string,
  oldPedidos: Record<string, number>, newPedidos: Record<string, number>,
): string {
  const p = parseDataVersion(prev)
  const c = parseDataVersion(curr)
  if (!p || !c) return 'La sincronización detectó cambios.'

  const partes: string[] = []

  const diffPreps = c.prepCnt - p.prepCnt
  if (diffPreps > 0) partes.push(`${diffPreps} preparación${diffPreps !== 1 ? 'es nuevas' : ' nueva'}`)

  const diffPeds = c.pedCnt - p.pedCnt
  if (diffPeds > 0) partes.push(`${diffPeds} pedido${diffPeds !== 1 ? 's nuevos' : ' nuevo'}`)

  if (c.sumEstado !== p.sumEstado) {
    const changed = Object.keys(newPedidos).filter(cod => oldPedidos[cod] !== newPedidos[cod])
    if (changed.length > 0) {
      const MAX = 6
      const lista = changed.length <= MAX
        ? changed.join(', ')
        : `${changed.slice(0, MAX).join(', ')} y ${changed.length - MAX} más`
      partes.push(`cambio de estado en pedido${changed.length !== 1 ? 's' : ''}: ${lista}`)
    } else {
      partes.push('cambios en estados de pedidos')
    }
  }

  const diffPend = c.pendientesCnt - p.pendientesCnt
  if (diffPend > 0) partes.push(`${diffPend} pendiente${diffPend !== 1 ? 's nuevos' : ' nuevo'} en Sigma`)
  else if (diffPend < 0) partes.push(`${Math.abs(diffPend)} pedido${Math.abs(diffPend) !== 1 ? 's' : ''} menos pendiente${Math.abs(diffPend) !== 1 ? 's' : ''} en Sigma`)

  return partes.length > 0
    ? `Sincronización detectó: ${partes.join(' · ')}.`
    : 'La sincronización detectó cambios.'
}

// NOTA mutation testing: los defaults `stage: ''` y `message: ''` son inobservables mientras
// `active` sea false (el bloque de progreso que los muestra está condicionado a
// `sync.active`, que arranca en `false` acá). En cuanto un sync arranca, `handleSync`
// pisa ambos campos explícitamente ('starting'/'Iniciando...'), así que estos valores
// iniciales nunca llegan a renderizarse. No se fuerza ningún test de relleno.
const idleState: SyncState = {
  active: false,
  mode: null,
  stage: '',
  current: 0,
  total: 0,
  message: '',
}

export function BibliaPage() {
  const [sync, setSync] = useState<SyncState>(() => ({
    ...idleState,
    ultimaActualizacion: localStorage.getItem(LS_LAST_SYNC_KEY) ?? undefined,
  }))
  const [refreshKey, setRefreshKey] = useState(0)
  const [newDataAvailable, setNewDataAvailable] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const lastSeenSyncRef = useRef<string | null>(null)
  const lastSeenDataVersionRef = useRef<string | null>(null)
  const lastSeenPedidosRef = useRef<Record<string, number>>({})
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      cleanupRef.current?.()
    }
  }, [])

  // NOTA mutation testing: el parámetro `silencioso` nunca se invoca con `true` en ningún
  // caller actual (todas las llamadas a refreshSyncStatus() de más abajo van sin argumento).
  // Los mutantes de Stryker sobre `!silencioso` en el chequeo de abajo son código
  // genuinamente inalcanzable desde el comportamiento público del componente — no hay forma
  // de testearlo sin invocar refreshSyncStatus(true) directamente (no está expuesto). Queda
  // como parámetro reservado para un uso futuro; no se fuerza ningún test de relleno.
  const refreshSyncStatus = useCallback((silencioso = false) => {
    fetchSyncStatus()
      .then(({ lastSync, dataVersion, pedidosSnapshot }) => {
        if (!isMountedRef.current) return
        if (lastSync) {
          const ts = formatSyncTime(new Date(lastSync))
          localStorage.setItem(LS_LAST_SYNC_KEY, ts)
          setSync(prev => ({ ...prev, ultimaActualizacion: ts }))
          lastSeenSyncRef.current = lastSync
        }
        if (!silencioso && lastSeenDataVersionRef.current !== null && dataVersion !== lastSeenDataVersionRef.current) {
          setNewDataAvailable(describeCambios(
            lastSeenDataVersionRef.current, dataVersion,
            lastSeenPedidosRef.current, pedidosSnapshot,
          ))
        }
        lastSeenDataVersionRef.current = dataVersion
        lastSeenPedidosRef.current = pedidosSnapshot
      })
      .catch(() => { /* fallo silencioso: el estado de sync no es crítico */ })
  }, [])

  useEffect(() => {
    refreshSyncStatus()

    // SSE: actualiza al instante cuando termina una sincronización programada
    const unsubscribe = subscribeSyncEvents(() => refreshSyncStatus())

    // Fallback: por si el SSE se pierde o hay algún cambio externo
    const onVisible = () => { if (document.visibilityState === 'visible') refreshSyncStatus() }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refreshSyncStatus() }, 10 * 60 * 1000)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [refreshSyncStatus])

  const handleSync = useCallback((mode: SyncMode) => {
    cleanupRef.current?.()

    // NOTA mutation testing: el literal 'starting' es equivalente frente a cualquier otro
    // string — `stageLabel` de más abajo solo distingue 'preparaciones'/'pedidos' de
    // cualquier otro valor (incluida cadena vacía), así que mutar este literal no cambia
    // ningún output observable.
    setSync({ active: true, mode, stage: 'starting', current: 0, total: 0, message: 'Iniciando...' })

    const subscriber = mode === 'hoy' ? subscribeSyncHoy : subscribeSyncAll

    const cleanup = subscriber(
      (e: SyncEvent) => {
        if (!isMountedRef.current) return
        if (e.stage === 'done') {
          const ts = formatSyncTime()
          localStorage.setItem(LS_LAST_SYNC_KEY, ts)
          setSync(prev => ({ ...prev, active: false, ultimaActualizacion: ts }))
          refreshSyncStatus()
          return
        }
        if (e.stage === 'warning') {
          setSync(prev => ({ ...prev, warning: e.message }))
          return
        }
        setSync(prev => ({
          ...prev,
          stage: e.stage ?? prev.stage,
          current: e.current ?? prev.current,
          total: e.total ?? prev.total,
          message: e.message ?? prev.message,
        }))
      },
      (err: string) => {
        if (!isMountedRef.current) return
        setSync(prev => ({ ...prev, active: false, error: err }))
      },
    )

    cleanupRef.current = cleanup
  }, [])

  const progress = sync.total > 0 ? sync.current / sync.total : 0
  const stageLabel = sync.stage === 'preparaciones' ? 'Preparaciones'
    : sync.stage === 'pedidos' ? 'Pedidos'
    : ''

  return (
    <div className="-m-6 h-[calc(100%+3rem)] bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-white/20 rounded-full p-2">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-extrabold text-white leading-none">
                Biblia Digital
              </h1>
              <p className="text-blue-200 text-xs mt-0.5">Gestión de entregas y reparto</p>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {sync.active && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col items-end gap-0.5 min-w-0">
                  <span className="text-blue-200 text-xs whitespace-nowrap">
                    {sync.mode === 'hoy' ? '[Hoy] ' : '[Todo] '}
                    {stageLabel && `${stageLabel} `}{sync.total > 0 ? `${sync.current}/${sync.total}` : sync.message}
                  </span>
                  {sync.total > 0 && (
                    <div className="w-28 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <RefreshCw className="w-4 h-4 text-white animate-spin shrink-0" />
              </div>
            )}
            {sync.error && (
              <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-red-500/20 text-red-200">
                <AlertCircle className="w-3.5 h-3.5" />
                {sync.error}
                <button
                  className="font-medium underline underline-offset-2 hover:text-white"
                  onClick={() => handleSync(sync.mode ?? 'hoy')}
                >
                  Reintentar
                </button>
              </div>
            )}
            {sync.warning && !sync.active && !sync.error && (
              <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-200">
                <AlertCircle className="w-3.5 h-3.5" />
                {sync.warning}
              </div>
            )}
            {sync.ultimaActualizacion && !sync.active && (
              <div className="flex items-center gap-1.5 text-xs text-blue-200 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-300" />
                Última actualización: {sync.ultimaActualizacion}
              </div>
            )}
            {!sync.active && !sync.error && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSync('hoy')}
                  className="bg-white/20 text-white hover:bg-white/30 border-0"
                >
                  <Calendar className="w-4 h-4" />
                  Hoy
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  // NOTA mutation testing: mode se compara únicamente contra 'hoy' en todo el
                  // componente (elección de subscriber, prefijo "[Hoy]"/"[Todo]", retry). Cualquier
                  // valor que no sea 'hoy' (incluida cadena vacía) produce el mismo comportamiento
                  // que 'all' — mutar este literal a "" es equivalente, verificado por inspección.
                  onClick={() => handleSync('all')}
                  className="bg-white/20 text-white hover:bg-white/30 border-0"
                >
                  <Globe className="w-4 h-4" />
                  Sincronizar todo
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      {newDataAvailable && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-sm">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>{newDataAvailable}</span>
          </div>
          <button
            className="shrink-0 font-medium hover:text-blue-900 underline underline-offset-2"
            onClick={() => {
              setNewDataAvailable(null)
              setRefreshKey(k => k + 1)
            }}
          >
            Recargar
          </button>
        </div>
      )}
      <div className="flex-1 p-3 overflow-hidden">
        <BibleDashboard key={refreshKey} />
      </div>
    </div>
  )
}
