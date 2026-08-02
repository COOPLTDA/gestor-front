import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { searchChoferes } from '@/services/bibliaApi'
import type { CodigoDespachoAdmin, ChoferAdmin, ZonaAdmin } from '@/services/bibliaApi'

interface Props {
  open: boolean
  reparto: CodigoDespachoAdmin | null
  zonas: ZonaAdmin[]
  onClose: () => void
  onGuardar: (data: Pick<CodigoDespachoAdmin, 'id' | 'zona_id'>, editando: boolean) => Promise<void>
  onAsignar: (codigoDespachoId: string, choferCodigo: string) => Promise<void>
  onDesasignar: (codigoDespachoId: string, choferCodigo: string) => Promise<void>
}

export function RutaModal({ open, reparto, zonas, onClose, onGuardar, onAsignar, onDesasignar }: Props) {
  const editando = reparto !== null
  const [id, setId] = useState('')
  const [zonaId, setZonaId] = useState<string | number>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Asignación de choferes
  const [choferQuery, setChoferQuery] = useState('')
  const [choferResultados, setChoferResultados] = useState<Pick<ChoferAdmin, 'codigo' | 'descripcion'>[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const choferesAsignados = reparto?.choferes ?? []

  useEffect(() => {
    if (open) {
      setId(reparto ? reparto.id : '')
      setZonaId(reparto?.zona_id ?? '')
      setChoferQuery('')
      setChoferResultados([])
      setError(null)
    }
  }, [open, reparto])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!choferQuery.trim()) { setChoferResultados([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true)
      try { setChoferResultados(await searchChoferes(choferQuery)) }
      finally { setLoadingSearch(false) }
    }, 300)
  }, [choferQuery])

  const handleSubmit = async () => {
    if (!id.trim()) { setError('El código de despacho es requerido'); return }
    setLoading(true); setError(null)
    try {
      await onGuardar({
        id: id.trim(),
        zona_id: zonaId !== '' ? Number(zonaId) : null,
      }, editando)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  const handleAsignarChofer = async (choferCodigo: string) => {
    if (!reparto) return
    await onAsignar(reparto.id, choferCodigo)
    setChoferQuery('')
    setChoferResultados([])
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar código de despacho' : 'Nuevo código de despacho'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 w-28">
              <label className="text-sm font-medium text-gray-700">Código de despacho</label>
              <input
                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                value={id}
                onChange={e => setId(e.target.value)}
                disabled={editando}
                placeholder="ej: R001"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium text-gray-700">Nombre</label>
              <p className="border rounded-md px-3 py-2 text-sm bg-gray-100 text-gray-600 truncate" title="Definido en Sigma — no se edita desde la Biblia">
                {reparto?.nombre ?? <span className="text-gray-400 italic">Sin descripción</span>}
              </p>
            </div>
          </div>

          <div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Zona</label>
              <select
                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={zonaId}
                onChange={e => setZonaId(e.target.value)}
              >
                <option value="">Sin zona</option>
                {zonas.filter(z => !z.desactivado).map(z => (
                  <option key={z.id} value={z.id}>{z.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button size="sm" onClick={handleSubmit} disabled={loading || !id.trim()}>
              {loading ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>

          {/* Sección choferes — solo visible al editar */}
          {editando && (
            <div className="border-t pt-3 flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700">Choferes asignados</p>

              {choferesAsignados.length === 0 ? (
                <p className="text-xs text-gray-400">Sin choferes asignados</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {choferesAsignados.map(cod => (
                    <span key={cod} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      <span className="font-mono">{cod}</span>
                      <button
                        className="ml-0.5 hover:text-red-500 transition-colors"
                        onClick={() => onDesasignar(reparto.id, cod)}
                        title="Desasignar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Buscar chofer para asignar…"
                  value={choferQuery}
                  onChange={e => setChoferQuery(e.target.value)}
                />
                {loadingSearch && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
                {choferResultados.length > 0 && (
                  <ul className="absolute left-0 right-0 z-10 bg-white border rounded-md shadow-md mt-1 max-h-36 overflow-y-auto">
                    {choferResultados
                      .filter(c => !choferesAsignados.includes(c.codigo))
                      .map(c => (
                        <li
                          key={c.codigo}
                          className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                          onClick={() => handleAsignarChofer(c.codigo)}
                        >
                          <span className="font-mono text-xs text-gray-400">{c.codigo}</span>
                          <span>{c.descripcion}</span>
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
