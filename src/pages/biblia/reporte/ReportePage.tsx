import { useState, useEffect, useMemo, useRef } from 'react'
import { useClickAway } from '@/hooks/useClickAway'
import { useLocation } from 'react-router-dom'
import { FileText, Loader2, AlertCircle } from 'lucide-react'
import type { GrupoDireccion } from '@/pages/biblia/types/biblia'
import type { ResumenChofer, MapaCliente } from '@/services/bibliaApi'
import { MapaReporte, type MapaPin, type Modo } from './MapaReporte'
import { MODOS } from './mapaModos'
import {
  type Vista, type CasoFilter, CASO_LABELS,
  formatDisplayDate, today, nextBusinessDay,
  buildChoferGrupos, applyCodigoOverrides, filterByCaso, filterByBiblia,
  choferGrupoKeyPorCaso, choferGrupoKeyPorBiblia,
} from './reporteUtils'
import { printStyles, handlePrint, handlePrintBiblia, handlePrintResumen, handleExportExcel, handleExportExcelResumen } from './reportePrint'
import { RepartosTable } from './RepartosTable'
import { ReporteHeader } from './ReporteHeader'
import { ReporteFilterBar } from './ReporteFilterBar'
import { PersonalizadoView } from './PersonalizadoView'
import { ResumenView } from './ResumenView'
import {
  useRangoAsignacionesFetch, useDireccionGruposFetch, useRangoDirectoGruposFetch,
  useResumenFetch, useMapaFetch,
} from './reporteFetchHooks'

export function ReportePage() {
  const location = useLocation()

  // Shared state
  const [grupos, setGrupos] = useState<GrupoDireccion[]>([])
  const [loading, setLoading] = useState(false)
  const [vista, setVista] = useState<Vista>(() => {
    const v = location.state?.view
    return v === 'resumen' || v === 'biblia' || v === 'rango' ? v : 'biblia'
  })
  const [filtroDireccion, setFiltroDireccion] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [excelOpen, setExcelOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  // Ediciones manuales del código de despacho (clave estable → texto). Se limpian al recargar datos.
  const [codigoOverrides, setCodigoOverrides] = useState<Record<string, string>>({})

  // Vista resumen
  const [resumenEntries, setResumenEntries] = useState<ResumenChofer[]>([])
  const [resumenLoading, setResumenLoading] = useState(false)

  // Vista personalizado
  const [personalTitulo, setPersonalTitulo] = useState('')
  const [personalChoferes, setPersonalChoferes] = useState<string[]>([])

  const [fetchError, setFetchError] = useState<string | null>(null)

  // Vista mapa
  const [mapaClientes, setMapaClientes] = useState<MapaCliente[]>([])
  const [mapaLoading, setMapaLoading] = useState(false)
  const [modoMapa, setModoMapa] = useState<Modo>('zona')
  const mapaPines = useMemo<MapaPin[]>(() => mapaClientes.map(c => ({
    key: c.codigo,
    descripcion: c.descripcion,
    lat: c.lat,
    lng: c.lng,
    zona: c.direccion,
    codigoDespacho: c.codigo_despacho,
    importe: c.importe,
    choferes: c.choferes,
  })), [mapaClientes])

  // Vista biblia
  const [bibliaFecha, setBibliaFecha] = useState(() => {
    const f = location.state?.bibliaFecha
    return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : nextBusinessDay(today)
  })
  const [rangoAsignaciones, setRangoAsignaciones] = useState<
    { fecha_desde: string; fecha_hasta: string } | null | 'cargando'
  >('cargando')
  const [filtroCaso, setFiltroCaso] = useState<CasoFilter[]>(['propia', 'sin_asignar'])
  const [casoOpen, setCasoOpen] = useState(false)
  const casoRef = useRef<HTMLDivElement>(null)

  // Vista rango
  const [fechaDesdeRango, setFechaDesdeRango] = useState(today)
  const [fechaHastaRango, setFechaHastaRango] = useState(today)
  const [filtroBiblias, setFiltroBiblias] = useState<string[]>([])
  const [bibliasOpen, setBibliasOpen] = useState(false)
  const bibliasRef = useRef<HTMLDivElement>(null)

  useClickAway(casoRef, () => setCasoOpen(false))
  useClickAway(bibliasRef, () => setBibliasOpen(false))

  // Fetch para vista biblia, mapa y personalizado (usan bibliaFecha + rangoAsignaciones)
  useRangoAsignacionesFetch(bibliaFecha, vista, setRangoAsignaciones, setFetchError)

  // Default del filtro de casos según la biblia cargada: en una biblia de un día el rojo
  // (sin asignar) alerta olvidos del día, pero en una de rango amplio lo ajeno al rango
  // (sin asignar / otras biblias) ahogaría a las propias.
  useEffect(() => {
    if (rangoAsignaciones === 'cargando' || !rangoAsignaciones) return
    setFiltroCaso(rangoAsignaciones.fecha_desde === rangoAsignaciones.fecha_hasta
      ? ['propia', 'sin_asignar']
      : ['propia'])
  }, [rangoAsignaciones])

  useDireccionGruposFetch(vista, bibliaFecha, rangoAsignaciones, setGrupos, setLoading, setFetchError,
    () => { setCodigoOverrides({}); setPersonalChoferes([]) })

  // Fetch para vista rango
  useRangoDirectoGruposFetch(vista, fechaDesdeRango, fechaHastaRango, setGrupos, setLoading, setFetchError,
    () => setCodigoOverrides({}))

  // Fetch para vista resumen
  useResumenFetch(vista, bibliaFecha, setResumenEntries, setResumenLoading, setFetchError)

  // Fetch para vista mapa
  useMapaFetch(vista, rangoAsignaciones, bibliaFecha, setMapaClientes, setMapaLoading, setFetchError)

  function cambiarVista(v: Vista) {
    if (v === vista) return
    setVista(v)
    setGrupos([])
    setFiltroDireccion('')
    setExpandidos(new Set())
    setFiltroCaso([])
    setFiltroBiblias([])
    setPersonalTitulo('')
    setPersonalChoferes([])
    setFetchError(null)
  }

  function toggleExpandir(key: string) {
    setExpandidos(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  function expandirTodo() {
    const isBiblia = vista === 'rango'
    const keys = new Set<string>()
    activeGruposMostrados.forEach(({ direccion, grupos: choferGrupos }) => {
      choferGrupos.forEach(g => {
        const grpKey = isBiblia
          ? `grp::${direccion}::${g.chofer_nombre}::${g.biblia_fecha_asignada ?? '_sin'}`
          : `grp::${direccion}::${g.chofer_nombre}::${g.caso}`
        if (g.codigos.length > 1) keys.add(grpKey)
        g.codigos.forEach(r => {
          if (r.detalle.length > 1) keys.add(`det::${direccion}::${r.nombre}::${grpKey}`)
        })
      })
    })
    setExpandidos(keys)
  }

  function contraerTodo() {
    setExpandidos(new Set())
  }

  const fechaDesde = rangoAsignaciones && rangoAsignaciones !== 'cargando' ? rangoAsignaciones.fecha_desde : null
  const fechaHasta = rangoAsignaciones && rangoAsignaciones !== 'cargando' ? rangoAsignaciones.fecha_hasta : null

  const direcciones = useMemo(() => grupos.map(g => g.direccion).sort(), [grupos])

  const bibliasFechasDisponibles = useMemo(() => {
    if (vista !== 'rango') return []
    const set = new Set<string>()
    for (const g of grupos) for (const r of g.repartos) if (r.biblia_fecha_asignada) set.add(r.biblia_fecha_asignada)
    return Array.from(set).sort()
  }, [grupos, vista])

  const gruposFiltrados = useMemo(() => {
    const r = filtroDireccion ? grupos.filter(g => g.direccion === filtroDireccion) : grupos
    if (vista === 'biblia') return filterByCaso(r, filtroCaso)
    if (vista === 'rango') return filterByBiblia(r, filtroBiblias)
    return r
  }, [grupos, filtroDireccion, vista, filtroCaso, filtroBiblias])

  const gruposExport = useMemo(() => applyCodigoOverrides(gruposFiltrados, codigoOverrides), [gruposFiltrados, codigoOverrides])

  const totalRepartos = useMemo(() => grupos.reduce((s, g) => s + g.repartos.length, 0), [grupos])

  const gruposMostrados = useMemo(() =>
    gruposFiltrados.map(({ direccion, repartos, total_clientes_unicos }) => ({
      direccion, total_clientes_unicos,
      grupos: buildChoferGrupos(repartos, vista === 'biblia' ? choferGrupoKeyPorCaso : choferGrupoKeyPorBiblia)
    }))
  , [gruposFiltrados, vista])

  // Choferes disponibles para seleccionar en personalizado (únicos de grupos cargados)
  const personalChoferesDisponibles = useMemo(() => {
    const seen = new Map<string, string>()
    for (const g of grupos) for (const r of g.repartos) {
      if (r.caso === 'sin_asignar' || !r.chofer_codigo) continue
      if (!seen.has(r.chofer_codigo)) seen.set(r.chofer_codigo, r.chofer_nombre)
    }
    return Array.from(seen.entries()).map(([codigo, nombre]) => ({ codigo, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [grupos])

  const personalGruposFiltrados = useMemo(() => {
    if (personalChoferes.length === 0) return []
    return grupos
      .map(g => ({ ...g, repartos: g.repartos.filter(r => personalChoferes.includes(r.chofer_codigo)) }))
      .filter(g => g.repartos.length > 0)
  }, [grupos, personalChoferes])

  const personalGruposExport = useMemo(() => applyCodigoOverrides(personalGruposFiltrados, codigoOverrides), [personalGruposFiltrados, codigoOverrides])

  const personalFlatMostrados = useMemo(() => {
    if (personalGruposFiltrados.length === 0) return []
    const allRepartos = personalGruposFiltrados.flatMap(g => g.repartos)
    return [{
      direccion: personalTitulo,
      grupos: buildChoferGrupos(allRepartos, choferGrupoKeyPorCaso)
    }]
  }, [personalGruposFiltrados, personalTitulo])

  const personalFlatExport = useMemo(() => {
    if (personalGruposExport.length === 0) return []
    return [{
      direccion: personalTitulo,
      repartos: personalGruposExport.flatMap(g => g.repartos),
      // total_clientes_unicos: GrupoDireccion lo requiere, pero ni handleExportExcel/handlePrintBiblia
      // lo leen para esta vista (RepartosTable recalcula los únicos directo de los repartos).
      total_clientes_unicos: 0,
    }]
  }, [personalGruposExport, personalTitulo])

  const casoLabel = filtroCaso.length === 0 || filtroCaso.length === 3 ? 'Todo'
    : filtroCaso.length === 1 ? CASO_LABELS[filtroCaso[0]] : `${filtroCaso.length} casos`

  const bibliaLabel = filtroBiblias.length === 0 ? 'Todo'
    : filtroBiblias.length === 1
      ? (filtroBiblias[0] === '_sin' ? 'Sin asignar' : formatDisplayDate(filtroBiblias[0]))
      : `${filtroBiblias.length} biblias`

  const showBiblia = vista === 'rango'
  const activeGruposMostrados = vista === 'personalizado' ? personalFlatMostrados : gruposMostrados

  return (
    <>
      <style>{printStyles}</style>
      <div className="-m-6 h-[calc(100%+3rem)] bg-gray-50 flex flex-col print:m-0 print:h-auto print:min-h-0">

        <ReporteHeader
          vista={vista}
          resumenEntries={resumenEntries}
          personalGruposFiltrados={personalGruposFiltrados}
          gruposFiltrados={gruposFiltrados}
          totalRepartos={totalRepartos}
          activeGruposMostradosLength={activeGruposMostrados.length}
          expandirTodo={expandirTodo}
          contraerTodo={contraerTodo}
          excelOpen={excelOpen}
          setExcelOpen={setExcelOpen}
          printOpen={printOpen}
          setPrintOpen={setPrintOpen}
          bibliaFecha={bibliaFecha}
          fechaDesdeRango={fechaDesdeRango}
          fechaHastaRango={fechaHastaRango}
          personalTitulo={personalTitulo}
          gruposExport={gruposExport}
          personalFlatExport={personalFlatExport}
          onExportExcel={handleExportExcel}
          onExportExcelResumen={handleExportExcelResumen}
          onPrint={handlePrint}
          onPrintBiblia={handlePrintBiblia}
          onPrintResumen={handlePrintResumen}
        />

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 print:hidden">
          {(['biblia', 'rango', 'personalizado', 'resumen', 'mapa'] as const).map(v => (
            <button
              key={v}
              onClick={() => cambiarVista(v)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                vista === v
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {v === 'biblia' ? 'Vista biblia' : v === 'rango' ? 'Vista rango de fechas' : v === 'resumen' ? 'Resumen' : v === 'mapa' ? 'Mapa' : 'Personalizado'}
            </button>
          ))}
          {vista === 'mapa' && (
            <div className="flex items-center gap-1.5 ml-auto py-1.5 print:hidden">
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

        {fetchError && (
          <div className="flex items-center justify-between gap-3 px-6 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm print:hidden">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              className="shrink-0 font-medium hover:text-red-900 underline underline-offset-2"
              onClick={() => setFetchError(null)}
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-3 px-6 py-2 bg-white border-b border-slate-200 print:hidden flex-wrap">
          <ReporteFilterBar
            vista={vista}
            bibliaFecha={bibliaFecha}
            setBibliaFecha={setBibliaFecha}
            rangoAsignaciones={rangoAsignaciones}
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
            filtroDireccion={filtroDireccion}
            setFiltroDireccion={setFiltroDireccion}
            direcciones={direcciones}
            filtroCaso={filtroCaso}
            setFiltroCaso={setFiltroCaso}
            casoOpen={casoOpen}
            setCasoOpen={setCasoOpen}
            casoRef={casoRef}
            casoLabel={casoLabel}
            personalTitulo={personalTitulo}
            setPersonalTitulo={setPersonalTitulo}
            fechaDesdeRango={fechaDesdeRango}
            setFechaDesdeRango={setFechaDesdeRango}
            fechaHastaRango={fechaHastaRango}
            setFechaHastaRango={setFechaHastaRango}
            filtroBiblias={filtroBiblias}
            setFiltroBiblias={setFiltroBiblias}
            bibliasOpen={bibliasOpen}
            setBibliasOpen={setBibliasOpen}
            bibliasRef={bibliasRef}
            bibliaLabel={bibliaLabel}
            bibliasFechasDisponibles={bibliasFechasDisponibles}
          />
        </div>

        {/* Content */}
        <div className={`flex-1 print:p-0 print:overflow-visible ${vista === 'mapa' ? 'overflow-hidden p-3' : vista === 'personalizado' ? 'overflow-hidden flex' : 'p-6 overflow-y-auto'}`}>
          {vista === 'personalizado' ? (
            <PersonalizadoView
              loading={loading}
              personalChoferes={personalChoferes}
              setPersonalChoferes={setPersonalChoferes}
              personalChoferesDisponibles={personalChoferesDisponibles}
              personalGruposFiltradosLength={personalGruposFiltrados.length}
              personalFlatMostrados={personalFlatMostrados}
              codigoOverrides={codigoOverrides}
              onChangeCodigo={(key, value) => setCodigoOverrides(prev => ({ ...prev, [key]: value }))}
              expandidos={expandidos}
              onToggleExpandir={toggleExpandir}
            />
          ) : vista === 'mapa' ? (
            <MapaReporte pines={mapaPines} loading={mapaLoading || rangoAsignaciones === 'cargando'} modo={modoMapa} />
          ) : vista === 'resumen' ? (
            <ResumenView resumenLoading={resumenLoading} resumenEntries={resumenEntries} />
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : gruposFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
              <FileText className="w-12 h-12" />
              <p className="text-sm font-medium">
                {vista === 'biblia' && rangoAsignaciones === null
                  ? 'No hay preparaciones asignadas a esta biblia'
                  : 'No hay repartos con dirección para este período'}
              </p>
            </div>
          ) : (
            <RepartosTable
              mostrados={gruposMostrados}
              showBiblia={showBiblia}
              codigoOverrides={codigoOverrides}
              onChangeCodigo={(key, value) => setCodigoOverrides(prev => ({ ...prev, [key]: value }))}
              expandidos={expandidos}
              onToggleExpandir={toggleExpandir}
            />
          )}
        </div>
      </div>
    </>
  )
}
