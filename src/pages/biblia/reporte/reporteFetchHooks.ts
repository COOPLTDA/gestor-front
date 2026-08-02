import { useEffect, useRef } from 'react'
import { fetchRepartosPorDireccion, fetchRangoBiblia, fetchResumenBiblia, fetchMapaClientes } from '@/services/bibliaApi'
import type { GrupoDireccion } from '@/pages/biblia/types/biblia'
import type { ResumenChofer, MapaCliente } from '@/services/bibliaApi'
import type { Vista } from './reporteUtils'

export type RangoAsignaciones = { fecha_desde: string; fecha_hasta: string } | null | 'cargando'

// Trae el rango de preparaciones asignado a la biblia del día. Lo usan las vistas
// biblia, mapa y personalizado (todas cuelgan del mismo bibliaFecha).
export function useRangoAsignacionesFetch(
  bibliaFecha: string,
  vista: Vista,
  setRangoAsignaciones: (v: RangoAsignaciones) => void,
  setFetchError: (msg: string) => void,
) {
  const idRef = useRef(0)
  useEffect(() => {
    if (vista !== 'biblia' && vista !== 'mapa' && vista !== 'personalizado') return
    const id = ++idRef.current
    setRangoAsignaciones('cargando')
    fetchRangoBiblia(bibliaFecha)
      .then(r => { if (id === idRef.current) setRangoAsignaciones(r) })
      .catch(err => {
        if (id !== idRef.current) return
        setFetchError(err instanceof Error ? err.message : 'Error al cargar el rango de la biblia')
        setRangoAsignaciones(null)
      })
  }, [bibliaFecha, vista])
}

// Trae los repartos agrupados por dirección para las vistas biblia y personalizado,
// una vez que se conoce el rango de preparaciones asignado.
export function useDireccionGruposFetch(
  vista: Vista,
  bibliaFecha: string,
  rangoAsignaciones: RangoAsignaciones,
  setGrupos: (g: GrupoDireccion[]) => void,
  setLoading: (b: boolean) => void,
  setFetchError: (msg: string) => void,
  onSuccess: () => void,
) {
  const idRef = useRef(0)
  useEffect(() => {
    if (vista !== 'biblia' && vista !== 'personalizado') return
    if (rangoAsignaciones === 'cargando') return
    if (!rangoAsignaciones) { setGrupos([]); return }
    const id = ++idRef.current
    setLoading(true)
    fetchRepartosPorDireccion(rangoAsignaciones.fecha_desde, rangoAsignaciones.fecha_hasta, bibliaFecha)
      .then(g => { if (id === idRef.current) { setGrupos(g); onSuccess() } })
      .catch(err => { if (id === idRef.current) setFetchError(err instanceof Error ? err.message : 'Error al cargar los repartos por dirección') })
      .finally(() => { if (id === idRef.current) setLoading(false) })
  }, [rangoAsignaciones, bibliaFecha, vista])
}

// Trae los repartos agrupados por dirección para la vista rango, directamente por fechas
// (sin pasar por el rango asignado de una biblia).
export function useRangoDirectoGruposFetch(
  vista: Vista,
  fechaDesdeRango: string,
  fechaHastaRango: string,
  setGrupos: (g: GrupoDireccion[]) => void,
  setLoading: (b: boolean) => void,
  setFetchError: (msg: string) => void,
  onSuccess: () => void,
) {
  const idRef = useRef(0)
  useEffect(() => {
    if (vista !== 'rango') return
    const id = ++idRef.current
    setLoading(true)
    fetchRepartosPorDireccion(fechaDesdeRango, fechaHastaRango)
      .then(g => { if (id === idRef.current) { setGrupos(g); onSuccess() } })
      .catch(err => { if (id === idRef.current) setFetchError(err instanceof Error ? err.message : 'Error al cargar los repartos por dirección') })
      .finally(() => { if (id === idRef.current) setLoading(false) })
  }, [fechaDesdeRango, fechaHastaRango, vista])
}

// Trae el resumen por chofer para la vista resumen.
export function useResumenFetch(
  vista: Vista,
  bibliaFecha: string,
  setResumenEntries: (r: ResumenChofer[]) => void,
  setResumenLoading: (b: boolean) => void,
  setFetchError: (msg: string) => void,
) {
  const idRef = useRef(0)
  useEffect(() => {
    if (vista !== 'resumen') return
    const id = ++idRef.current
    setResumenLoading(true)
    fetchResumenBiblia(bibliaFecha)
      .then(r => { if (id === idRef.current) setResumenEntries(r) })
      .catch(err => { if (id === idRef.current) setFetchError(err instanceof Error ? err.message : 'Error al cargar el resumen de la biblia') })
      .finally(() => { if (id === idRef.current) setResumenLoading(false) })
  }, [bibliaFecha, vista])
}

// Trae los clientes a mostrar en el mapa, una vez que se conoce el rango de preparaciones asignado.
export function useMapaFetch(
  vista: Vista,
  rangoAsignaciones: RangoAsignaciones,
  bibliaFecha: string,
  setMapaClientes: (m: MapaCliente[]) => void,
  setMapaLoading: (b: boolean) => void,
  setFetchError: (msg: string) => void,
) {
  const idRef = useRef(0)
  useEffect(() => {
    if (vista !== 'mapa') return
    if (rangoAsignaciones === 'cargando') return
    if (!rangoAsignaciones) { setMapaClientes([]); return }
    const id = ++idRef.current
    setMapaLoading(true)
    fetchMapaClientes(rangoAsignaciones.fecha_desde, rangoAsignaciones.fecha_hasta, bibliaFecha)
      .then(r => { if (id === idRef.current) setMapaClientes(r) })
      .catch(err => { if (id === idRef.current) setFetchError(err instanceof Error ? err.message : 'Error al cargar el mapa de clientes') })
      .finally(() => { if (id === idRef.current) setMapaLoading(false) })
  }, [rangoAsignaciones, bibliaFecha, vista])
}
