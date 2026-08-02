import { useMemo, useState } from 'react'
import type { Chofer, CodigoDespacho, Pedido, Preparacion } from '../types/biblia'
import { formatCurrency } from '../utils/bibliaUtils'

export interface MapaPinItem {
  prep: Preparacion
  pedido: Pedido
  choferCodigo: string
}

interface Props {
  descripcion: string
  items: MapaPinItem[]
  choferes: Chofer[]
  codigosDespachoByChofer: Map<string, CodigoDespacho[]>
  reasignarPreparacion: (prep: Preparacion, choferCodigo: string, codigoDespacho: CodigoDespacho) => Promise<void>
  onClose: () => void
}

function codigoActualDe(prep: Preparacion): string | null {
  const codigos = new Set(prep.pedidos.map(p => p.codigo_despacho).filter(Boolean))
  return codigos.size === 1 ? [...codigos][0] as string : null
}

export function MapaReasignarPanel({ descripcion, items, choferes, codigosDespachoByChofer, reasignarPreparacion, onClose }: Props) {
  const [item, setItem] = useState<MapaPinItem | null>(items.length === 1 ? items[0] : null)
  const [choferElegido, setChoferElegido] = useState<string | null>(null)
  const [opcionesCodigo, setOpcionesCodigo] = useState<CodigoDespacho[] | null>(null)
  const [confirmCross, setConfirmCross] = useState<{ codigoDespacho: CodigoDespacho; codigoActual: string | null } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const choferMap = useMemo(() => new Map(choferes.map(c => [c.codigo, c])), [choferes])
  const codigoActual = item ? codigoActualDe(item.prep) : null

  async function aplicar(codigoDespacho: CodigoDespacho) {
    if (!item || !choferElegido) return
    setEnviando(true)
    try {
      await reasignarPreparacion(item.prep, choferElegido, codigoDespacho)
      onClose()
    } finally {
      setEnviando(false)
    }
  }

  function elegirChofer(codigo: string) {
    const opciones = codigosDespachoByChofer.get(codigo) || []
    if (opciones.length === 0) return
    setChoferElegido(codigo)
    if (opciones.length === 1) {
      const [unica] = opciones
      if (unica.nombre !== codigoActual) setConfirmCross({ codigoDespacho: unica, codigoActual })
      else aplicar(unica)
    } else {
      setOpcionesCodigo(opciones)
    }
  }

  function elegirCodigo(codigoDespacho: CodigoDespacho) {
    setOpcionesCodigo(null)
    if (codigoDespacho.nombre !== codigoActual) setConfirmCross({ codigoDespacho, codigoActual })
    else aplicar(codigoDespacho)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        {confirmCross ? (
          <>
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
              <button onClick={() => setConfirmCross(null)} disabled={enviando} className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => aplicar(confirmCross.codigoDespacho)} disabled={enviando} className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 font-medium disabled:opacity-60">
                Confirmar cambio
              </button>
            </div>
          </>
        ) : opcionesCodigo ? (
          <>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Elegí el código de despacho</h3>
            <div className="flex flex-col gap-1.5 mb-4">
              {opcionesCodigo.map(cod => (
                <button
                  key={cod.id}
                  onClick={() => elegirCodigo(cod)}
                  className="text-left px-3 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 font-mono"
                >
                  {cod.nombre}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => { setOpcionesCodigo(null); setChoferElegido(null) }} className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                Atrás
              </button>
            </div>
          </>
        ) : item ? (
          <>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Reasignar preparación</h3>
            <p className="text-xs text-slate-500 mb-3">
              {item.prep.codigo_envio ?? `#${item.prep.id}`} · {codigoActual ?? 'sin código'} · {formatCurrency(item.prep.importe_total)}
            </p>
            <div className="flex flex-col gap-1 mb-4 max-h-64 overflow-y-auto">
              {choferes.filter(c => c.codigo !== item.choferCodigo).map(c => (
                <button
                  key={c.codigo}
                  onClick={() => elegirChofer(c.codigo)}
                  disabled={enviando}
                  className="text-left px-3 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                >
                  {c.descripcion}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} disabled={enviando} className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">{descripcion}</h3>
            <p className="text-xs text-slate-500 mb-3">{items.length} preparaciones en este punto — elegí cuál reasignar</p>
            <div className="flex flex-col gap-1.5 mb-4 max-h-64 overflow-y-auto">
              {items.map((it, idx) => (
                <button
                  key={`${it.prep.id}-${idx}`}
                  onClick={() => setItem(it)}
                  className="text-left px-3 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50"
                >
                  <div className="font-medium text-slate-800">{choferMap.get(it.choferCodigo)?.descripcion ?? it.choferCodigo}</div>
                  <div className="text-xs text-slate-500 font-mono">{it.prep.codigo_envio ?? `#${it.prep.id}`} · {formatCurrency(it.prep.importe_total)}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
