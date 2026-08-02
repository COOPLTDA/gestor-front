import type { RefObject } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { inputClass } from '@/lib/styles'
import { type Vista, type CasoFilter, CASO_LABELS, formatDisplayDate } from './reporteUtils'

interface Props {
  vista: Vista
  bibliaFecha: string
  setBibliaFecha: (v: string) => void
  rangoAsignaciones: { fecha_desde: string; fecha_hasta: string } | null | 'cargando'
  fechaDesde: string | null
  fechaHasta: string | null
  filtroDireccion: string
  setFiltroDireccion: (v: string) => void
  direcciones: string[]
  filtroCaso: CasoFilter[]
  setFiltroCaso: (fn: (prev: CasoFilter[]) => CasoFilter[]) => void
  casoOpen: boolean
  setCasoOpen: (fn: (v: boolean) => boolean) => void
  casoRef: RefObject<HTMLDivElement>
  casoLabel: string
  personalTitulo: string
  setPersonalTitulo: (v: string) => void
  fechaDesdeRango: string
  setFechaDesdeRango: (v: string) => void
  fechaHastaRango: string
  setFechaHastaRango: (v: string) => void
  filtroBiblias: string[]
  setFiltroBiblias: (fn: (prev: string[]) => string[]) => void
  bibliasOpen: boolean
  setBibliasOpen: (fn: (v: boolean) => boolean) => void
  bibliasRef: RefObject<HTMLDivElement>
  bibliaLabel: string
  bibliasFechasDisponibles: string[]
}

function BibliaFechaSelector({ bibliaFecha, setBibliaFecha }: Pick<Props, 'bibliaFecha' | 'setBibliaFecha'>) {
  return (
    <>
      <span className="text-sm font-semibold text-blue-700">Biblia del día</span>
      {bibliaFecha && (
        <span className="text-sm font-medium text-blue-600 capitalize">
          {new Date(bibliaFecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long' })}
        </span>
      )}
      <input type="date" value={bibliaFecha} onChange={e => e.target.value && setBibliaFecha(e.target.value)} className={inputClass} />
    </>
  )
}

function PreparacionesRango({ rangoAsignaciones, fechaDesde, fechaHasta }: Pick<Props, 'rangoAsignaciones' | 'fechaDesde' | 'fechaHasta'>) {
  return (
    <>
      <span className="text-slate-300">|</span>
      <span className="text-sm text-slate-500">Preparaciones</span>
      {rangoAsignaciones === 'cargando' ? (
        <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
      ) : rangoAsignaciones === null ? (
        <span className="text-sm text-red-500 font-medium">Sin preparaciones asignadas</span>
      ) : (
        <span className="text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-2 py-1.5">
          {fechaDesde === fechaHasta ? formatDisplayDate(fechaDesde!) : `${formatDisplayDate(fechaDesde!)} al ${formatDisplayDate(fechaHasta!)}`}
        </span>
      )}
    </>
  )
}

export function ReporteFilterBar(props: Props) {
  const { vista } = props

  if (vista === 'mapa') {
    return (
      <>
        <BibliaFechaSelector bibliaFecha={props.bibliaFecha} setBibliaFecha={props.setBibliaFecha} />
        <PreparacionesRango rangoAsignaciones={props.rangoAsignaciones} fechaDesde={props.fechaDesde} fechaHasta={props.fechaHasta} />
      </>
    )
  }

  if (vista === 'resumen') {
    return <BibliaFechaSelector bibliaFecha={props.bibliaFecha} setBibliaFecha={props.setBibliaFecha} />
  }

  if (vista === 'biblia') {
    return (
      <>
        <BibliaFechaSelector bibliaFecha={props.bibliaFecha} setBibliaFecha={props.setBibliaFecha} />
        <PreparacionesRango rangoAsignaciones={props.rangoAsignaciones} fechaDesde={props.fechaDesde} fechaHasta={props.fechaHasta} />
        <span className="text-slate-300">|</span>
        <select value={props.filtroDireccion} onChange={e => props.setFiltroDireccion(e.target.value)} className={inputClass}>
          <option value="">Todas las zonas</option>
          {props.direcciones.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-slate-300">|</span>
        <div className="relative" ref={props.casoRef}>
          <button type="button" onClick={() => props.setCasoOpen(v => !v)}
            className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border transition-colors ${props.filtroCaso.length > 0 && props.filtroCaso.length < 3 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300 hover:border-blue-400'}`}>
            <span>{props.casoLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
          {props.casoOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-md shadow-md min-w-[160px] py-1">
              {(Object.entries(CASO_LABELS) as [CasoFilter, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={props.filtroCaso.includes(key)} onChange={() => props.setFiltroCaso(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])} className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0 ${key === 'propia' ? 'bg-slate-300' : key === 'sin_asignar' ? 'bg-red-300' : 'bg-amber-300'}`} />
                    {label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  if (vista === 'personalizado') {
    return (
      <>
        <BibliaFechaSelector bibliaFecha={props.bibliaFecha} setBibliaFecha={props.setBibliaFecha} />
        <span className="text-slate-300">|</span>
        <span className="text-sm text-slate-500">Título</span>
        <input
          type="text"
          value={props.personalTitulo}
          onChange={e => props.setPersonalTitulo(e.target.value)}
          placeholder="Título del reporte"
          className={`${inputClass} min-w-[180px]`}
        />
      </>
    )
  }

  // vista === 'rango'
  return (
    <>
      <span className="text-sm font-semibold text-slate-700">Preparaciones del</span>
      <input type="date" value={props.fechaDesdeRango} max={props.fechaHastaRango} onChange={e => e.target.value && props.setFechaDesdeRango(e.target.value)} className={inputClass} />
      <span className="text-sm text-slate-500">al</span>
      <input type="date" value={props.fechaHastaRango} min={props.fechaDesdeRango} onChange={e => e.target.value && props.setFechaHastaRango(e.target.value)} className={inputClass} />
      <span className="text-slate-300">|</span>
      <select value={props.filtroDireccion} onChange={e => props.setFiltroDireccion(e.target.value)} className={inputClass}>
        <option value="">Todas las zonas</option>
        {props.direcciones.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <span className="text-slate-300">|</span>
      <div className="relative" ref={props.bibliasRef}>
        <button type="button" onClick={() => props.setBibliasOpen(v => !v)}
          className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border transition-colors ${props.filtroBiblias.length > 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300 hover:border-blue-400'}`}>
          <span>{props.bibliaLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>
        {props.bibliasOpen && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-md shadow-md min-w-[170px] py-1">
            <label className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-100">
              <input type="checkbox" checked={props.filtroBiblias.includes('_sin')} onChange={() => props.setFiltroBiblias(prev => prev.includes('_sin') ? prev.filter(x => x !== '_sin') : [...prev, '_sin'])} className="w-3.5 h-3.5 accent-blue-600" />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0 bg-red-300" />
                Sin asignar
              </span>
            </label>
            {props.bibliasFechasDisponibles.map(f => (
              <label key={f} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={props.filtroBiblias.includes(f)} onChange={() => props.setFiltroBiblias(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])} className="w-3.5 h-3.5 accent-blue-600" />
                {formatDisplayDate(f)}
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
