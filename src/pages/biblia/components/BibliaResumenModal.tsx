import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MapaReporte, type MapaPin, type Modo } from '@/pages/biblia/reporte/MapaReporte'
import { MODOS } from '@/pages/biblia/reporte/mapaModos'
import { MapaReasignarPanel, type MapaPinItem } from './MapaReasignarPanel'
import type { Chofer, CodigoDespacho, Preparacion } from '../types/biblia'
import { formatCurrency, ESTADO_DOT } from '../utils/bibliaUtils'

interface Props {
  open: boolean
  onClose: () => void
  preparacionesPorChofer: Map<string, Preparacion[]>
  choferes: Chofer[]
  bibliaFecha: string
  codigosDespacho: CodigoDespacho[]
  codigosDespachoByChofer: Map<string, CodigoDespacho[]>
  reasignarPreparacion: (prep: Preparacion, choferCodigo: string, codigoDespacho: CodigoDespacho) => Promise<void>
}

export function BibliaResumenModal({ open, onClose, preparacionesPorChofer, choferes, bibliaFecha, codigosDespacho, codigosDespachoByChofer, reasignarPreparacion }: Props) {
  const [tab, setTab] = useState<'resumen' | 'mapa'>('resumen')
  const [modoMapa, setModoMapa] = useState<Modo>('zona')
  const [pinSeleccionado, setPinSeleccionado] = useState<MapaPin | null>(null)

  const choferMap = new Map(choferes.map(c => [c.codigo, c]))

  const { pines, itemsByKey } = useMemo(() => {
    const nombreChofer = new Map(choferes.map(c => [c.codigo, c.descripcion]))
    // Igual que el backend (reporte.service.js): la zona de un código de despacho es su
    // propia "dirección" en BIBLIA_codigo_despacho; si no tiene, cae al nombre del código.
    const zonaPorCodigo = new Map(codigosDespacho.map(cd => [cd.nombre, cd.direccion || cd.nombre]))
    const grupos = new Map<string, { pin: MapaPin; choferesMap: Map<string, string>; itemsPorPrep: Map<number, MapaPinItem> }>()
    for (const [choferCodigo, preps] of preparacionesPorChofer) {
      for (const prep of preps) {
        for (const pedido of prep.pedidos) {
          if (pedido.cliente_lat == null || pedido.cliente_lng == null) continue
          const key = pedido.codigo_cliente_ubicacion ?? pedido.cliente_nombre ?? `${pedido.cliente_lat},${pedido.cliente_lng}`
          let grupo = grupos.get(key)
          if (!grupo) {
            const codigoDespacho = pedido.codigo_despacho ?? '—'
            grupo = {
              pin: {
                key,
                descripcion: pedido.cliente_nombre ?? key,
                lat: pedido.cliente_lat,
                lng: pedido.cliente_lng,
                codigoDespacho,
                zona: zonaPorCodigo.get(codigoDespacho) ?? codigoDespacho,
                importe: 0,
                choferes: [],
              },
              choferesMap: new Map(),
              itemsPorPrep: new Map(),
            }
            grupos.set(key, grupo)
          }
          grupo.pin.importe += pedido.importe
          grupo.choferesMap.set(choferCodigo, nombreChofer.get(choferCodigo) ?? choferCodigo)
          // Varios pedidos de la misma preparación pueden caer en el mismo punto (mismo
          // cliente/ubicación); reasignar es por preparación, así que se deduplica por prep.id
          // para no ofrecer la misma preparación repetida en el selector.
          if (!grupo.itemsPorPrep.has(prep.id)) grupo.itemsPorPrep.set(prep.id, { prep, pedido, choferCodigo })
        }
      }
    }
    const pines: MapaPin[] = []
    const itemsByKey = new Map<string, MapaPinItem[]>()
    for (const { pin, choferesMap, itemsPorPrep } of grupos.values()) {
      pines.push({ ...pin, choferes: [...choferesMap.entries()].map(([codigo, nombre]) => ({ codigo, nombre })) })
      itemsByKey.set(pin.key, [...itemsPorPrep.values()])
    }
    return { pines, itemsByKey }
  }, [preparacionesPorChofer, choferes, codigosDespacho])

  const entries = [...preparacionesPorChofer.entries()]
    .map(([codigo, preps]) => {
      const chofer = choferMap.get(codigo)
      const totalImporte = preps.reduce((s, p) => s + p.importe_total, 0)
      const totalPedidos = preps.reduce((s, p) => s + p.cantidad_pedidos, 0)
      const totalPeso = preps.reduce((s, p) => s + p.peso, 0)
      const totalVolumen = preps.reduce((s, p) => s + p.volumen, 0)
      const clientes = new Set<string>()
      const codigos = new Set<string>()
      for (const p of preps) {
        for (const ped of p.pedidos) {
          if (ped.codigo_cliente_ubicacion) clientes.add(ped.codigo_cliente_ubicacion)
          else if (ped.cliente_nombre) clientes.add(ped.cliente_nombre)
          if (ped.codigo_despacho) codigos.add(ped.codigo_despacho)
        }
      }
      return { codigo, chofer, preps, totalImporte, totalPedidos, totalPeso, totalVolumen, clientes: clientes.size, codigos: [...codigos].sort() }
    })
    .sort((a, b) => b.totalImporte - a.totalImporte)

  const fechaLabel = new Date(bibliaFecha + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const grandTotal = entries.reduce((s, e) => s + e.totalImporte, 0)

  function handlePrint() {
    const w = window.open('', '_blank')
    if (!w) return
    let cardsHtml = ''
    for (const e of entries) {
      const stats = [
        `<span><b>${e.totalPedidos}</b> ped</span>`,
        `<span><b>${e.clientes}</b> cli</span>`,
        e.totalPeso > 0 ? `<span><b>${e.totalPeso.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> kg</span>` : '',
        e.totalVolumen > 0 ? `<span><b>${e.totalVolumen.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</b> m³</span>` : '',
      ].filter(Boolean).join('')
      const codigos = e.codigos.map(c => `<span class="cod">${c}</span>`).join('')
      const prepsHtml = e.preps.map(p =>
        `<div class="prep-row"><span class="dot estado-${(p.estado ?? '').replace(/ /g, '-')}"></span><span class="prep-cod">${p.codigo_envio ?? `#${p.id}`}</span><span class="prep-imp">${formatCurrency(p.importe_total)}</span></div>`
      ).join('')
      cardsHtml += `<div class="card">
        <div class="card-header"><div><div class="chofer-nombre">${e.chofer?.descripcion ?? e.codigo}</div><div class="chofer-codigo">${e.codigo}</div></div><span class="badge">${e.preps.length}p</span></div>
        <div class="importe">${formatCurrency(e.totalImporte)}</div>
        <div class="stats">${stats}</div>
        ${e.codigos.length > 0 ? `<div class="codigos">${codigos}</div>` : ''}
        <div class="preps">${prepsHtml}</div>
      </div>`
    }
    w.document.write(`<html><head><title>Resumen biblia — ${fechaLabel}</title><style>
      @page{size:landscape;margin:8mm}body{font-family:sans-serif;font-size:9pt;margin:0;padding:4mm}
      h2{margin:0 0 1mm;font-size:11pt}p{margin:0 0 3mm;font-size:9pt;color:#555}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px}
      .card{border:1px solid #ccc;border-radius:4px;padding:6px;break-inside:avoid}
      .card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px}
      .chofer-nombre{font-weight:bold;font-size:8.5pt}.chofer-codigo{font-size:7pt;color:#999;font-family:monospace}
      .badge{font-size:7pt;background:#f0f0f0;color:#666;padding:1px 4px;border-radius:8px}
      .importe{font-size:11pt;font-weight:bold;color:#16803b;margin:2px 0}
      .stats{display:flex;flex-wrap:wrap;gap:4px;font-size:7.5pt;color:#666;margin-bottom:3px}.stats b{color:#333}
      .codigos{display:flex;flex-wrap:wrap;gap:2px;margin-bottom:3px}
      .cod{font-family:monospace;font-size:7pt;background:#e8f0fe;color:#1a56db;padding:1px 3px;border-radius:2px}
      .preps{border-top:1px solid #eee;padding-top:3px}
      .prep-row{display:flex;align-items:center;gap:4px;font-size:7.5pt;margin-bottom:1px}
      .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#aaa}
      .estado-pendiente{background:#94a3b8}.estado-en-preparacion{background:#f59e0b}
      .estado-completada,.estado-completo{background:#10b981}.estado-remitido{background:#0ea5e9}.estado-eliminado{background:#ef4444}
      .prep-cod{font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .prep-imp{font-weight:500;white-space:nowrap}
    </style></head><body>
    <h2>Resumen biblia — ${fechaLabel.charAt(0).toUpperCase() + fechaLabel.slice(1)}</h2>
    <p>${entries.length} chofer${entries.length !== 1 ? 'es' : ''} · ${formatCurrency(grandTotal)}</p>
    <div class="grid">${cardsHtml}</div></body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  return (
    // NOTA mutation testing: el chequeo `if (!v)` solo se ejercita con v=false en este flujo —
    // Radix invoca onOpenChange únicamente al intentar cerrar (Escape, click afuera, botón X);
    // no hay disparador interno que lo llame con v=true ya que `open` está controlado 100% por
    // el padre. El mutante que fuerza `if (true)` es indistinguible en la práctica.
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setTab('resumen') } }}>
      <DialogContent
        className="w-[98vw] max-w-[98vw] h-[95vh] overflow-hidden gap-3 p-4"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="capitalize flex items-baseline gap-3">
            Resumen y mapa — {fechaLabel}
            <span className="text-sm font-normal text-slate-500">
              {entries.length} chofer{entries.length !== 1 ? 'es' : ''} · {formatCurrency(grandTotal)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as 'resumen' | 'mapa')} className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-3 shrink-0">
            <TabsList className="self-start shrink-0">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="mapa">Mapa</TabsTrigger>
            </TabsList>
            {tab === 'mapa' && (
              <div className="flex gap-1.5">
                {MODOS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setModoMapa(m.value)}
                    className={`text-sm font-medium px-3 py-1.5 rounded-md border ${modoMapa === m.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <TabsContent value="resumen" className="flex-1 min-h-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
            {entries.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No hay choferes asignados en esta biblia.</p>
            ) : (
              <div
                className="flex-1 min-h-0 overflow-y-auto"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  alignContent: 'start',
                  gap: '10px',
                }}
              >
                {entries.map(({ codigo, chofer, preps, totalImporte, totalPedidos, totalPeso, totalVolumen, clientes, codigos }) => (
                  <div key={codigo} className="border rounded-lg p-3 flex flex-col gap-2 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 leading-tight truncate">
                          {chofer?.descripcion ?? codigo}
                        </p>
                        <span className="text-xs font-mono text-slate-400">{codigo}</span>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                        {preps.length}p
                      </span>
                    </div>

                    <p className="text-lg font-bold text-emerald-600 leading-none">
                      {formatCurrency(totalImporte)}
                    </p>

                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span><strong className="text-slate-700">{totalPedidos}</strong> pedidos</span>
                      <span><strong className="text-slate-700">{clientes}</strong> clientes</span>
                      {totalPeso > 0 && <span><strong className="text-slate-700">{totalPeso.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> kg</span>}
                      {totalVolumen > 0 && <span><strong className="text-slate-700">{totalVolumen.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</strong> m³</span>}
                    </div>

                    {codigos.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {codigos.map(cod => (
                          <span key={cod} className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded leading-none">
                            {cod}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="border-t pt-1.5 flex flex-col gap-1">
                      {preps.map(p => (
                        <div key={p.id} className="flex items-center gap-1.5 text-xs">
                          {/* NOTA mutation testing: el fallback '' de (p.estado ?? '') es
                              inobservable frente a cualquier otro string que tampoco sea clave de
                              ESTADO_DOT — ambos casos caen igual al default 'bg-slate-300'. */}
                          <span className={`w-2 h-2 rounded-full shrink-0 ${ESTADO_DOT[(p.estado ?? '').toLowerCase()] ?? 'bg-slate-300'}`} />
                          <span className="font-mono text-slate-500 truncate flex-1">
                            {p.codigo_envio ?? `#${p.id}`}
                          </span>
                          <span className="text-slate-700 font-medium whitespace-nowrap">{formatCurrency(p.importe_total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mapa" className="flex-1 min-h-0 overflow-hidden data-[state=inactive]:hidden">
            <MapaReporte pines={pines} loading={false} modo={modoMapa} onPinClick={setPinSeleccionado} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-between shrink-0">
          {tab === 'resumen' ? (
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={entries.length === 0}>
              Imprimir
            </Button>
          ) : <span />}
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>

        {/* NOTA mutation testing: el fallback ?? [] de items (abajo) es inobservable —
            pinSeleccionado siempre viene de `pines`, y cada key de `pines` tiene su entrada
            correspondiente en itemsByKey (se construyen juntos en el mismo loop del useMemo),
            así que .get() nunca devuelve undefined en este flujo. */}
        {pinSeleccionado && (
          <MapaReasignarPanel
            descripcion={pinSeleccionado.descripcion}
            items={itemsByKey.get(pinSeleccionado.key) ?? []}
            choferes={choferes}
            codigosDespachoByChofer={codigosDespachoByChofer}
            reasignarPreparacion={reasignarPreparacion}
            onClose={() => setPinSeleccionado(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
