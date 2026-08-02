import { FileText, Download, Printer, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/pages/biblia/utils/bibliaUtils'
import { formatDisplayDate, type Vista } from './reporteUtils'
import type { GrupoDireccion } from '@/pages/biblia/types/biblia'
import type { ResumenChofer } from '@/services/bibliaApi'

interface Props {
  vista: Vista
  resumenEntries: ResumenChofer[]
  personalGruposFiltrados: GrupoDireccion[]
  gruposFiltrados: GrupoDireccion[]
  totalRepartos: number
  activeGruposMostradosLength: number
  expandirTodo: () => void
  contraerTodo: () => void
  excelOpen: boolean
  setExcelOpen: (v: boolean) => void
  printOpen: boolean
  setPrintOpen: (v: boolean) => void
  bibliaFecha: string
  fechaDesdeRango: string
  fechaHastaRango: string
  personalTitulo: string
  gruposExport: GrupoDireccion[]
  personalFlatExport: GrupoDireccion[]
  onExportExcel: (grupos: GrupoDireccion[], fecha: string, formato: 'actual' | 'biblia', showDireccion?: boolean) => void
  onExportExcelResumen: (entries: ResumenChofer[], titulo: string, fecha: string) => void
  onPrint: () => void
  onPrintBiblia: (grupos: GrupoDireccion[], titulo: string, showDireccion?: boolean) => void
  onPrintResumen: (entries: ResumenChofer[], fecha: string) => void
}

export function ReporteHeader({
  vista, resumenEntries, personalGruposFiltrados, gruposFiltrados, totalRepartos,
  activeGruposMostradosLength, expandirTodo, contraerTodo,
  excelOpen, setExcelOpen, printOpen, setPrintOpen,
  bibliaFecha, fechaDesdeRango, fechaHastaRango, personalTitulo,
  gruposExport, personalFlatExport,
  onExportExcel, onExportExcelResumen, onPrint, onPrintBiblia, onPrintResumen,
}: Props) {
  const personalRepartosCount = personalGruposFiltrados.reduce((s, g) => s + g.repartos.length, 0)

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 print:hidden">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-white/20 rounded-full p-2">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-extrabold text-white leading-none">Reporte por Dirección</h1>
            <p className="text-blue-200 text-xs mt-0.5">Repartos agrupados por dirección</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vista === 'resumen' ? (
            <span className="text-blue-200 text-sm hidden sm:inline">
              {resumenEntries.length} chofer{resumenEntries.length !== 1 ? 'es' : ''} · {formatCurrency(resumenEntries.reduce((s, e) => s + e.total_importe, 0))}
            </span>
          ) : vista === 'personalizado' ? (
            <span className="text-blue-200 text-sm hidden sm:inline">
              {personalRepartosCount} reparto{personalRepartosCount !== 1 ? 's' : ''} · {personalGruposFiltrados.length} dirección{personalGruposFiltrados.length !== 1 ? 'es' : ''}
            </span>
          ) : (
            <span className="text-blue-200 text-sm hidden sm:inline">
              {gruposFiltrados.reduce((s, g) => s + g.repartos.length, 0)} reparto{totalRepartos !== 1 ? 's' : ''} · {gruposFiltrados.length} dirección{gruposFiltrados.length !== 1 ? 'es' : ''}
            </span>
          )}
          {vista !== 'resumen' && vista !== 'mapa' && activeGruposMostradosLength > 0 && (
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" onClick={expandirTodo} className="bg-white/20 text-white hover:bg-white/30 border-0" title="Expandir todo">
                <ChevronsUpDown className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={contraerTodo} className="bg-white/20 text-white hover:bg-white/30 border-0" title="Contraer todo">
                <ChevronsDownUp className="w-4 h-4" />
              </Button>
            </div>
          )}
          {vista !== 'mapa' && (
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setExcelOpen(!excelOpen)} className="bg-white/20 text-white hover:bg-white/30 border-0">
                <Download className="w-4 h-4" />Excel
              </Button>
              {excelOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExcelOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-md shadow-lg border border-slate-200 z-50 min-w-[180px]">
                    {vista === 'resumen' ? (
                      <button onClick={() => { onExportExcelResumen(resumenEntries, `Resumen biblia ${formatDisplayDate(bibliaFecha)}`, bibliaFecha); setExcelOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Exportar</button>
                    ) : vista === 'personalizado' ? (
                      <button onClick={() => { onExportExcel(personalFlatExport, bibliaFecha, 'biblia', false); setExcelOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Exportar</button>
                    ) : (
                      <>
                        <button onClick={() => { onExportExcel(gruposExport, bibliaFecha, 'actual'); setExcelOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Formato actual</button>
                        <button onClick={() => { onExportExcel(gruposExport, bibliaFecha, 'biblia'); setExcelOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Formato biblia</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setPrintOpen(!printOpen)} className="bg-white/20 text-white hover:bg-white/30 border-0">
              <Printer className="w-4 h-4" />Imprimir
            </Button>
            {printOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPrintOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-md shadow-lg border border-slate-200 z-50 min-w-[180px]">
                  {vista === 'resumen' ? (
                    <button onClick={() => { onPrintResumen(resumenEntries, bibliaFecha); setPrintOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Resumen</button>
                  ) : vista === 'personalizado' ? (
                    <>
                      <button onClick={() => { onPrint(); setPrintOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Formato actual</button>
                      <button onClick={() => { onPrintBiblia(personalFlatExport, personalTitulo, false); setPrintOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Formato biblia</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { onPrint(); setPrintOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Formato actual</button>
                      <button onClick={() => { onPrintBiblia(gruposExport, vista === 'biblia' ? `Biblia para el ${formatDisplayDate(bibliaFecha)}` : `Asignación de preparaciones para el período ${formatDisplayDate(fechaDesdeRango)} - ${formatDisplayDate(fechaHastaRango)}`); setPrintOpen(false) }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Formato biblia</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
