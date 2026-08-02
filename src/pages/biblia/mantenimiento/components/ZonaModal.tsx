import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { searchCodigosDespacho } from '@/services/bibliaApi'
import type { ZonaAdmin, CodigoDespachoAdmin } from '@/services/bibliaApi'
import type { CodigoDespacho } from '../../types/biblia'

interface Props {
  open: boolean
  zona: ZonaAdmin | null
  codigosDespacho: CodigoDespachoAdmin[]
  onClose: () => void
  onGuardar: (data: { id?: number; nombre: string }, editando: boolean) => Promise<void>
  onAsignar: (codigoDespachoId: string, zonaId: number) => Promise<void>
  onDesasignar: (codigoDespachoId: string, zonaId: number) => Promise<void>
}

export function ZonaModal({ open, zona, codigosDespacho, onClose, onGuardar, onAsignar, onDesasignar }: Props) {
  const editando = zona !== null
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [repartoResultados, setRepartoResultados] = useState<Pick<CodigoDespacho, 'id' | 'nombre' | 'zona_id'>[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busquedaSearchId = useRef(0)

  // El fallback "?? []" es inalcanzable en la práctica: ZonaAdmin.repartos es un array
  // obligatorio, así que solo dispara cuando zona es null — pero entonces la sección que
  // usa repartosAsignados ni se renderiza (está detrás de `{editando && ...}`). No se fuerza un test.
  const repartosAsignados = zona?.repartos ?? []

  const repartosFiltrados = repartoResultados.filter(r => !repartosAsignados.includes(String(r.id)))

  // Este efecto corre al montar (open arranca en true) y pisa nombre/busqueda/repartoResultados
  // sin importar su valor inicial de useState — por eso esos defaults ('', [], etc.) son
  // inobservables. El guard "if (open)" en sí no se puede ejercitar de forma directa: cuando
  // open pasa a false, Radix desmonta el contenido del diálogo, así que no hay forma de leer
  // el estado "sin resetear" mientras está cerrado. No se fuerza ningún test de relleno.
  useEffect(() => {
    if (open) {
      setNombre(zona?.nombre ?? '')
      setBusqueda('')
      setRepartoResultados([])
      setError(null)
    }
  }, [open, zona])

  useEffect(() => {
    // clearTimeout(undefined) es un no-op seguro, así que el guard "if (debounceRef.current)"
    // es inalcanzable en la práctica — mutarlo a true/false no cambia el comportamiento.
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!busqueda.trim()) { setRepartoResultados([]); return }
    debounceRef.current = setTimeout(async () => {
      // busquedaSearchId solo se compara con === (nunca con orden), así que es un token de
      // identidad, no un contador: invertir ++ a -- no cambia ningún resultado observable.
      const id = ++busquedaSearchId.current
      setLoadingSearch(true)
      try {
        const res = await searchCodigosDespacho(busqueda)
        if (id === busquedaSearchId.current) setRepartoResultados(res)
      } finally {
        if (id === busquedaSearchId.current) setLoadingSearch(false)
      }
    }, 300)
  }, [busqueda])

  const handleSubmit = async () => {
    // El guard "if (!nombre.trim())" es inalcanzable en la práctica: el botón Guardar usa la
    // misma condición (`disabled={loading || !nombre.trim()}`), así que un click real nunca
    // llega hasta acá con nombre vacío/solo espacios. No se fuerza un test.
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true); setError(null)
    try {
      await onGuardar({ id: zona?.id, nombre: nombre.trim() }, editando)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    // El guard "if (!v)" es inalcanzable en la práctica: Radix solo invoca onOpenChange para
    // pedir el cierre (Escape, click afuera), siempre con v=false — nunca con true, ya que
    // "open" está controlado externamente por el padre. No se fuerza un test para v=true.
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar zona' : 'Nueva zona'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input
              className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre de la zona"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button size="sm" onClick={handleSubmit} disabled={loading || !nombre.trim()}>
              {loading ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>

          {editando && (
            <div className="border-t pt-3 flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700">Códigos de despacho</p>

              {repartosAsignados.length === 0 ? (
                <p className="text-xs text-gray-400">Sin códigos de despacho asignados</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {repartosAsignados.map(rid => {
                    const r = codigosDespacho.find(x => x.id === rid)
                    return (
                      <span key={rid} className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                        <span className="font-mono">{rid}</span>
                        {r?.nombre && <span className="opacity-70">— {r.nombre}</span>}
                        <button
                          className="ml-0.5 hover:text-red-500 transition-colors"
                          onClick={() => onDesasignar(rid, zona.id)}
                          title="Desasignar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="relative">
                <input
                  ref={inputRef}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Buscar código de despacho para asignar…"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
                {loadingSearch && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
                {repartosFiltrados.length > 0 && (
                  <ul className="absolute left-0 right-0 z-10 bg-white border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
                    {repartosFiltrados.map(r => (
                      <li
                        key={r.id}
                        className="px-3 py-2 text-sm hover:bg-emerald-50 cursor-pointer flex items-center gap-2"
                        onClick={() => {
                          onAsignar(String(r.id), zona.id)
                          setBusqueda('')
                          // El "?." es inalcanzable en la práctica: este onClick solo se dispara con
                          // el input ya montado y con foco potencial (el <li> está dentro del mismo
                          // formulario visible), así que inputRef.current nunca es null acá. No se
                          // fuerza un test.
                          inputRef.current?.focus()
                        }}
                      >
                        <span className="font-mono text-xs text-gray-400">{r.id}</span>
                        <span>{r.nombre}</span>
                        {r.zona_id && r.zona_id !== zona.id && (
                          <span className="text-xs text-amber-600 ml-auto">zona: {r.zona_id}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
