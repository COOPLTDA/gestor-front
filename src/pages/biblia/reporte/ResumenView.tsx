import { FileText, Loader2 } from 'lucide-react'
import { formatCurrency, ESTADO_DOT } from '@/pages/biblia/utils/bibliaUtils'
import type { ResumenChofer } from '@/services/bibliaApi'

interface Props {
  resumenLoading: boolean
  resumenEntries: ResumenChofer[]
}

export function ResumenView({ resumenLoading, resumenEntries }: Props) {
  if (resumenLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (resumenEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
        <FileText className="w-12 h-12" />
        <p className="text-sm font-medium">No hay choferes asignados a esta biblia</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', alignContent: 'start', gap: '10px' }}>
      {resumenEntries.map(e => {
        const pesoKg = e.total_peso
        const volM3 = e.total_volumen
        return (
          <div key={e.chofer_codigo} className="border rounded-lg p-3 flex flex-col gap-2 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-800 leading-tight truncate">{e.chofer_nombre}</p>
                <span className="text-xs font-mono text-slate-400">{e.chofer_codigo}</span>
              </div>
              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">{e.preps.length}p</span>
            </div>
            <p className="text-lg font-bold text-emerald-600 leading-none">{formatCurrency(e.total_importe)}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span><strong className="text-slate-700">{e.total_pedidos}</strong> pedidos</span>
              <span><strong className="text-slate-700">{e.total_clientes}</strong> clientes</span>
              {pesoKg > 0 && <span><strong className="text-slate-700">{pesoKg.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> kg</span>}
              {volM3 > 0 && <span><strong className="text-slate-700">{volM3.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</strong> m³</span>}
            </div>
            {e.codigos_despacho.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {e.codigos_despacho.map(cod => (
                  <span key={cod} className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded leading-none">{cod}</span>
                ))}
              </div>
            )}
            <div className="border-t pt-1.5 flex flex-col gap-1">
              {e.preps.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ESTADO_DOT[(p.estado ?? '').toLowerCase()] ?? 'bg-slate-300'}`} />
                  <span className="font-mono text-slate-500 truncate flex-1">{p.codigo_envio ?? `#${p.id}`}</span>
                  <span className="text-slate-700 font-medium whitespace-nowrap">{formatCurrency(p.importe_total)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
