import type { Dispatch, SetStateAction } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { RepartosTable, type RepartosMostrado } from './RepartosTable'

interface ChoferDisponible {
  codigo: string
  nombre: string
}

interface Props {
  loading: boolean
  personalChoferes: string[]
  setPersonalChoferes: Dispatch<SetStateAction<string[]>>
  personalChoferesDisponibles: ChoferDisponible[]
  personalGruposFiltradosLength: number
  personalFlatMostrados: RepartosMostrado[]
  codigoOverrides: Record<string, string>
  onChangeCodigo: (key: string, value: string) => void
  expandidos: Set<string>
  onToggleExpandir: (key: string) => void
}

export function PersonalizadoView({
  loading, personalChoferes, setPersonalChoferes, personalChoferesDisponibles,
  personalGruposFiltradosLength, personalFlatMostrados,
  codigoOverrides, onChangeCodigo, expandidos, onToggleExpandir,
}: Props) {
  return (
    <>
      {/* Sidebar de choferes */}
      <div className="w-52 shrink-0 border-r border-slate-200 bg-white overflow-y-auto flex flex-col print:hidden">
        <div className="px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          <p className="text-sm font-semibold text-slate-700">Choferes</p>
          <p className="text-xs text-slate-400 mt-0.5">{personalChoferes.length} seleccionado{personalChoferes.length !== 1 ? 's' : ''}</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center flex-1 py-8">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
        ) : personalChoferesDisponibles.length === 0 ? (
          <p className="text-xs text-slate-400 px-4 py-3">Sin preparaciones asignadas</p>
        ) : (
          <>
            <label className="flex items-center gap-2 px-4 py-2 text-sm border-b border-slate-100 cursor-pointer hover:bg-slate-50 select-none">
              <input
                type="checkbox"
                checked={personalChoferes.length === personalChoferesDisponibles.length && personalChoferesDisponibles.length > 0}
                onChange={e => setPersonalChoferes(e.target.checked ? personalChoferesDisponibles.map(c => c.codigo) : [])}
                className="w-3.5 h-3.5 accent-blue-600"
              />
              <span className="font-medium text-slate-500 text-xs">Todos</span>
            </label>
            {personalChoferesDisponibles.map(c => (
              <label key={c.codigo} className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-slate-50 select-none">
                <input
                  type="checkbox"
                  checked={personalChoferes.includes(c.codigo)}
                  onChange={() => setPersonalChoferes(prev =>
                    prev.includes(c.codigo) ? prev.filter(x => x !== c.codigo) : [...prev, c.codigo]
                  )}
                  className="w-3.5 h-3.5 accent-blue-600 shrink-0"
                />
                <span className="text-slate-700 text-xs truncate">{c.nombre}</span>
              </label>
            ))}
          </>
        )}
      </div>
      {/* Área de tabla */}
      <div className="flex-1 overflow-y-auto p-6 print:p-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : personalChoferes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <FileText className="w-12 h-12" />
            <p className="text-sm font-medium">Seleccioná choferes en el panel izquierdo</p>
          </div>
        ) : personalGruposFiltradosLength === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <FileText className="w-12 h-12" />
            <p className="text-sm font-medium">Los choferes seleccionados no tienen preparaciones en esta biblia</p>
          </div>
        ) : (
          <RepartosTable
            mostrados={personalFlatMostrados}
            showBiblia={false}
            codigoOverrides={codigoOverrides}
            onChangeCodigo={onChangeCodigo}
            expandidos={expandidos}
            onToggleExpandir={onToggleExpandir}
          />
        )}
      </div>
    </>
  )
}
