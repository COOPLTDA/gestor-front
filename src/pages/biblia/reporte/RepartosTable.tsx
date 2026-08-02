import React from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/pages/biblia/utils/bibliaUtils'
import { casoRowClass, rangoRowClass, codKey, formatDisplayDate, type ChoferGrupo } from './reporteUtils'

// Celda editable del código de despacho. El depósito puede agregarle un identificador
// (ej: "BIG 2") antes de imprimir; se imprime con el texto editado.
function CodigoEditable({ value, onChange, sub }: { value: string; onChange: (v: string) => void; sub?: boolean }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-transparent outline-none border-0 border-b border-dashed border-slate-300 focus:border-blue-500 print:border-0 ${sub ? 'text-slate-600 text-xs' : 'text-slate-700'}`}
      title="Editable — se imprime con lo que escribas"
    />
  )
}

export interface RepartosMostrado {
  direccion: string
  grupos: ChoferGrupo[]
}

interface Props {
  mostrados: RepartosMostrado[]
  showBiblia: boolean
  codigoOverrides: Record<string, string>
  onChangeCodigo: (key: string, value: string) => void
  expandidos: Set<string>
  onToggleExpandir: (key: string) => void
}

// Tabla de repartos agrupados por dirección y chofer. La comparten las vistas biblia,
// rango (showBiblia=true, agrega la columna/agrupación por biblia asignada) y
// personalizado (showBiblia=false, agrupa solo por caso).
export function RepartosTable({ mostrados, showBiblia, codigoOverrides, onChangeCodigo, expandidos, onToggleExpandir }: Props) {
  const detColSpan = showBiblia ? 10 : 9

  return (
    <div className="print:block">
      {mostrados.map(({ direccion, grupos: choferGrupos }) => {
        const allRepartos = choferGrupos.flatMap(g => g.codigos)
        return (
          <div key={direccion} className="mb-6 print:mb-4 print:break-inside-avoid">
            <div className="bg-slate-800 text-white px-4 py-2 rounded-t-lg text-sm font-bold uppercase tracking-wider print:bg-gray-900 print:text-xs">
              {direccion}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider print:bg-gray-100">
                    <th className="w-6 px-2 py-2 border border-slate-300"></th>
                    <th className="text-left px-4 py-2 border border-slate-300 font-semibold">NOMBRE FLETERO</th>
                    {showBiblia && <th className="text-left px-4 py-2 border border-slate-300 font-semibold">BIBLIA</th>}
                    <th className="text-right px-4 py-2 border border-slate-300 font-semibold">NRO</th>
                    <th className="text-left px-4 py-2 border border-slate-300 font-semibold">CÓDIGO DE DESPACHO</th>
                    <th className="text-right px-4 py-2 border border-slate-300 font-semibold">AGRUP. DIR.</th>
                    <th className="text-right px-4 py-2 border border-slate-300 font-semibold">CONSOLIDADO</th>
                    <th className="text-right px-4 py-2 border border-slate-300 font-semibold">INDIVIDUAL</th>
                    <th className="text-right px-4 py-2 border border-slate-300 font-semibold">IMPORTE</th>
                    <th className="text-right px-4 py-2 border border-slate-300 font-semibold">CANT. PED.</th>
                    <th className="text-right px-4 py-2 border border-slate-300 font-semibold">CANT. CLIENTES</th>
                  </tr>
                </thead>
                <tbody>
                  {choferGrupos.flatMap(g => {
                    const isSingle = g.codigos.length === 1
                    const r0 = g.codigos[0]
                    const grpKey = showBiblia
                      ? `grp::${direccion}::${g.chofer_nombre}::${g.biblia_fecha_asignada ?? '_sin'}`
                      : `grp::${direccion}::${g.chofer_nombre}::${g.caso}`
                    const grpExpanded = expandidos.has(grpKey)
                    const rowClass = showBiblia ? rangoRowClass(g.biblia_fecha_asignada) : casoRowClass(g.caso)
                    const bibliaCell = showBiblia
                      ? <td className="px-4 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium">{g.biblia_fecha_asignada ? formatDisplayDate(g.biblia_fecha_asignada) : '—'}</td>
                      : null
                    const filas: React.ReactNode[] = []

                    if (isSingle) {
                      const detKey = `det::${direccion}::${r0.nombre}::${grpKey}`
                      const detExpanded = expandidos.has(detKey)
                      const detExpandible = r0.detalle.length > 1
                      filas.push(
                        <tr key={grpKey} className={`${rowClass} print:break-inside-avoid`}>
                          <td className="px-2 py-1.5 border border-slate-300 text-center">
                            {detExpandible && (
                              <button onClick={() => onToggleExpandir(detKey)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                                {detExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-1.5 border border-slate-300 font-medium text-slate-800">{g.chofer_nombre}</td>
                          {bibliaCell}
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700 font-mono">{r0.codigo_numerico}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-slate-700">
                            <CodigoEditable
                              value={codigoOverrides[codKey(direccion, r0)] ?? r0.nombre}
                              onChange={v => onChangeCodigo(codKey(direccion, r0), v)}
                            />
                          </td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.tipo_agrupa_direccion}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.tipo_consolidado}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.tipo_individual}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-emerald-700 font-semibold">{formatCurrency(g.total_importe)}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.total_pedidos}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.total_clientes}</td>
                        </tr>
                      )
                      if (detExpanded && detExpandible) {
                        r0.detalle.forEach(d => filas.push(
                          <tr key={`${grpKey}-${d.preparacion_id}`} className="bg-slate-50 text-xs">
                            <td className="px-2 py-1 border border-slate-300"></td>
                            <td className="px-4 py-1 border border-slate-300 text-slate-500 italic" colSpan={detColSpan}>
                              Prep. #{d.preparacion_id} · {d.tipo} · <span className="font-semibold">{formatCurrency(d.importe)}</span> · {d.pedidos} ped / {d.clientes} cli
                            </td>
                          </tr>
                        ))
                      }
                    } else {
                      filas.push(
                        <tr key={grpKey} className={`${rowClass} print:break-inside-avoid font-medium`}>
                          <td className="px-2 py-1.5 border border-slate-300 text-center">
                            <button onClick={() => onToggleExpandir(grpKey)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                              {grpExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-1.5 border border-slate-300 text-slate-800">{g.chofer_nombre}</td>
                          {bibliaCell}
                          <td className="px-4 py-1.5 border border-slate-300"></td>
                          <td className="px-4 py-1.5 border border-slate-300 text-slate-500 text-xs italic">{g.codigos.length} códigos de despacho</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.tipo_agrupa_direccion}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.tipo_consolidado}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.tipo_individual}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-emerald-700 font-semibold">{formatCurrency(g.total_importe)}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.total_pedidos}</td>
                          <td className="px-4 py-1.5 border border-slate-300 text-right text-slate-700">{g.total_clientes}</td>
                        </tr>
                      )
                      if (grpExpanded) {
                        g.codigos.forEach(r => {
                          const detKey = `det::${direccion}::${r.nombre}::${grpKey}`
                          const detExpanded = expandidos.has(detKey)
                          const detExpandible = r.detalle.length > 1
                          const showDet = (detExpanded && detExpandible) || r.detalle.length === 1
                          const subBiblia = showBiblia
                            ? <td className="px-4 py-1 border border-slate-300 text-slate-400 text-xs">{r.biblia_fecha_asignada ? formatDisplayDate(r.biblia_fecha_asignada) : '—'}</td>
                            : null
                          filas.push(
                            <tr key={`${grpKey}::${r.nombre}`} className="bg-slate-50 text-xs print:break-inside-avoid">
                              <td className="px-2 py-1 border border-slate-300 text-center">
                                {detExpandible && (
                                  <button onClick={() => onToggleExpandir(detKey)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                                    {detExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </td>
                              <td className="pl-8 pr-4 py-1 border border-slate-300 text-slate-400">↳</td>
                              {subBiblia}
                              <td className="px-4 py-1 border border-slate-300 text-right text-slate-600 font-mono">{r.codigo_numerico}</td>
                              <td className="px-4 py-1 border border-slate-300 text-slate-600">
                                <CodigoEditable
                                  sub
                                  value={codigoOverrides[codKey(direccion, r)] ?? r.nombre}
                                  onChange={v => onChangeCodigo(codKey(direccion, r), v)}
                                />
                              </td>
                              <td className="px-4 py-1 border border-slate-300 text-right text-slate-500">{r.tipo_agrupa_direccion}</td>
                              <td className="px-4 py-1 border border-slate-300 text-right text-slate-500">{r.tipo_consolidado}</td>
                              <td className="px-4 py-1 border border-slate-300 text-right text-slate-500">{r.tipo_individual}</td>
                              <td className="px-4 py-1 border border-slate-300 text-right text-emerald-600 font-semibold">{formatCurrency(r.total_importe)}</td>
                              <td className="px-4 py-1 border border-slate-300 text-right text-slate-500">{r.total_pedidos}</td>
                              <td className="px-4 py-1 border border-slate-300 text-right text-slate-500">{r.total_clientes}</td>
                            </tr>
                          )
                          if (showDet) {
                            r.detalle.forEach(d => filas.push(
                              <tr key={`${detKey}-${d.preparacion_id}`} className="bg-slate-100 text-xs">
                                <td className="px-2 py-1 border border-slate-300"></td>
                                <td className="px-4 py-1 border border-slate-300 text-slate-400 italic" colSpan={detColSpan}>
                                  Prep. #{d.preparacion_id} · {d.tipo} · <span className="font-semibold">{formatCurrency(d.importe)}</span> · {d.pedidos} ped / {d.clientes} cli
                                </td>
                              </tr>
                            ))
                          }
                        })
                      }
                    }
                    return filas
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 print:bg-slate-200 font-semibold text-slate-900">
                    <td className="px-2 py-1.5 border border-slate-300"></td>
                    <td className="px-4 py-1.5 border border-slate-300">TOTAL</td>
                    {showBiblia && <td className="px-4 py-1.5 border border-slate-300"></td>}
                    <td className="px-4 py-1.5 border border-slate-300 text-right"></td>
                    <td className="px-4 py-1.5 border border-slate-300"></td>
                    <td className="px-4 py-1.5 border border-slate-300 text-right">{allRepartos.reduce((s, r) => s + r.tipo_agrupa_direccion, 0)}</td>
                    <td className="px-4 py-1.5 border border-slate-300 text-right">{allRepartos.reduce((s, r) => s + r.tipo_consolidado, 0)}</td>
                    <td className="px-4 py-1.5 border border-slate-300 text-right">{allRepartos.reduce((s, r) => s + r.tipo_individual, 0)}</td>
                    <td className="px-4 py-1.5 border border-slate-300 text-right text-emerald-800">{formatCurrency(allRepartos.reduce((s, r) => s + r.total_importe, 0))}</td>
                    <td className="px-4 py-1.5 border border-slate-300 text-right">{allRepartos.reduce((s, r) => s + r.total_pedidos, 0)}</td>
                    <td className="px-4 py-1.5 border border-slate-300 text-right">{allRepartos.reduce((s, r) => s + r.total_clientes, 0)} ({new Set(allRepartos.flatMap(r => r.clientes_unicos)).size} únicos)</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
