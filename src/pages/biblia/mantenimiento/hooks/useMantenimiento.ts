import { useState, useEffect, useCallback } from 'react'
import {
  fetchAllChoferes,
  fetchAllCodigosDespacho,
  fetchAllZonas,
  createChofer,
  updateChofer,
  updateCodigoDespacho,
  createZona,
  updateZona,
  asignarChoferCodigoDespacho,
  desasignarChoferCodigoDespacho,
  asignarCodigoDespachoAZona,
  desasignarCodigoDespachoDeZona,
  type ChoferAdmin,
  type CodigoDespachoAdmin,
  type ZonaAdmin,
} from '@/services/bibliaApi'

// Nota sobre mutation testing (21/07/2026): este hook no recibe props, así que ningún
// useCallback de más abajo con deps [] (ni los que dependen de esos, como los efectos
// `[recargarX]`) puede cambiar de identidad entre renders — no hay ningún rerender con
// props distintas que lo dispare. Eso hace que los mutantes de Stryker que tocan esos
// arrays de dependencias sean estructuralmente equivalentes: no existe un test observable
// que los distinga sin inventar una forma de re-disparar el efecto que el hook real no
// tiene. Los `loading*` iniciales en `false` también son inobservables: el primer efecto
// de carga llama a `setLoadingX(true)` sincrónicamente antes de que cualquier test pueda
// leer el estado post-mount.
export function useMantenimiento() {
  const [choferes, setChoferes] = useState<ChoferAdmin[]>([])
  const [codigosDespacho, setCodigosDespacho] = useState<CodigoDespachoAdmin[]>([])
  const [zonas, setZonas] = useState<ZonaAdmin[]>([])
  const [loadingChoferes, setLoadingChoferes] = useState(false)
  const [loadingRepartos, setLoadingRepartos] = useState(false)
  const [loadingZonas, setLoadingZonas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargarChoferes = useCallback(async () => {
    setLoadingChoferes(true)
    try { setChoferes(await fetchAllChoferes()); setError(null) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al cargar choferes') }
    finally { setLoadingChoferes(false) }
  }, [])

  const recargarCodigosDespacho = useCallback(async () => {
    setLoadingRepartos(true)
    try { setCodigosDespacho(await fetchAllCodigosDespacho()); setError(null) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al cargar repartos') }
    finally { setLoadingRepartos(false) }
  }, [])

  const recargarZonas = useCallback(async () => {
    setLoadingZonas(true)
    try { setZonas(await fetchAllZonas()); setError(null) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al cargar zonas') }
    finally { setLoadingZonas(false) }
  }, [])

  useEffect(() => { recargarChoferes() }, [recargarChoferes])
  useEffect(() => { recargarCodigosDespacho() }, [recargarCodigosDespacho])
  useEffect(() => { recargarZonas() }, [recargarZonas])

  const guardarChofer = useCallback(async (
    data: { codigo: string; descripcion: string; chofer_padre_codigo: string | null },
    editando: boolean,
  ) => {
    if (editando) {
      await updateChofer(data.codigo, { descripcion: data.descripcion, chofer_padre_codigo: data.chofer_padre_codigo })
    } else {
      await createChofer(data.codigo, data.descripcion, data.chofer_padre_codigo)
    }
    await recargarChoferes()
  }, [recargarChoferes])

  const toggleChofer = useCallback(async (codigo: string, desactivado: number) => {
    setError(null)
    try {
      await updateChofer(codigo, { desactivado: desactivado === 0 ? 1 : 0 })
      setChoferes(prev =>
        prev.map(c => c.codigo === codigo ? { ...c, desactivado: desactivado === 0 ? 1 : 0 } : c)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar chofer')
    }
  }, [])

  const guardarCodigoDespacho = useCallback(async (
    data: Pick<CodigoDespachoAdmin, 'id' | 'zona_id'>,
    _editando: boolean,
  ) => {
    await updateCodigoDespacho(data.id, { zona_id: data.zona_id })
    await recargarCodigosDespacho()
  }, [recargarCodigosDespacho])

  const toggleCodigoDespacho = useCallback(async (id: string, desactivado: number) => {
    setError(null)
    try {
      await updateCodigoDespacho(id, { desactivado: desactivado === 0 ? 1 : 0 })
      setCodigosDespacho(prev =>
        prev.map(r => r.id === id ? { ...r, desactivado: desactivado === 0 ? 1 : 0 } : r)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar código de despacho')
    }
  }, [])

  const asignar = useCallback(async (codigoDespachoId: string, choferCodigo: string) => {
    setError(null)
    try {
      await asignarChoferCodigoDespacho(codigoDespachoId, choferCodigo)
      setCodigosDespacho(prev =>
        prev.map(r => r.id === codigoDespachoId
          ? { ...r, choferes: [...new Set([...(r.choferes ?? []), choferCodigo])] }
          : r
        )
      )
      setChoferes(prev =>
        prev.map(c => c.codigo === choferCodigo
          ? { ...c, rutas: [...new Set([...(c.rutas ?? []), codigoDespachoId])] }
          : c
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar chofer')
    }
  }, [])

  const desasignar = useCallback(async (codigoDespachoId: string, choferCodigo: string) => {
    setError(null)
    try {
      await desasignarChoferCodigoDespacho(codigoDespachoId, choferCodigo)
      setCodigosDespacho(prev =>
        prev.map(r => r.id === codigoDespachoId
          ? { ...r, choferes: (r.choferes ?? []).filter(c => c !== choferCodigo) }
          : r
        )
      )
      setChoferes(prev =>
        prev.map(c => c.codigo === choferCodigo
          ? { ...c, rutas: (c.rutas ?? []).filter(rid => rid !== codigoDespachoId) }
          : c
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al desasignar chofer')
    }
  }, [])

  const guardarZona = useCallback(async (
    data: { id?: number; nombre: string },
    editando: boolean,
  ) => {
    if (editando && data.id !== undefined) await updateZona(data.id, { nombre: data.nombre })
    else await createZona(data.nombre)
    await recargarZonas()
  }, [recargarZonas])

  const toggleZona = useCallback(async (id: number, desactivado: number) => {
    setError(null)
    try {
      await updateZona(id, { desactivado: desactivado === 0 ? 1 : 0 })
      setZonas(prev =>
        prev.map(z => z.id === id ? { ...z, desactivado: desactivado === 0 ? 1 : 0 } : z)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar zona')
    }
  }, [])

  const asignarCodigoDespachoAZonaLocal = useCallback(async (codigoDespachoId: string, zonaId: number) => {
    setError(null)
    try {
      await asignarCodigoDespachoAZona(codigoDespachoId, zonaId)
      setZonas(prev =>
        prev.map(z => z.id === zonaId
          ? { ...z, repartos: [...new Set([...(z.repartos ?? []), codigoDespachoId])] }
          : { ...z, repartos: (z.repartos ?? []).filter(r => r !== codigoDespachoId) }
        )
      )
      setCodigosDespacho(prev =>
        prev.map(r => r.id === codigoDespachoId ? { ...r, zona_id: zonaId } : r)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar a zona')
    }
  }, [])

  const desasignarCodigoDespachoDeZonaLocal = useCallback(async (codigoDespachoId: string, zonaId: number) => {
    setError(null)
    try {
      await desasignarCodigoDespachoDeZona(codigoDespachoId)
      setZonas(prev =>
        prev.map(z => z.id === zonaId
          ? { ...z, repartos: (z.repartos ?? []).filter(r => r !== codigoDespachoId) }
          : z
        )
      )
      setCodigosDespacho(prev =>
        prev.map(r => r.id === codigoDespachoId ? { ...r, zona_id: null } : r)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al desasignar de zona')
    }
  }, [])

  return {
    choferes, codigosDespacho, zonas,
    loadingChoferes, loadingRepartos, loadingZonas,
    error,
    guardarChofer, toggleChofer,
    guardarCodigoDespacho, toggleCodigoDespacho,
    asignar, desasignar,
    guardarZona, toggleZona,
    asignarCodigoDespacho: asignarCodigoDespachoAZonaLocal,
    desasignarCodigoDespacho: desasignarCodigoDespachoDeZonaLocal,
  }
}
