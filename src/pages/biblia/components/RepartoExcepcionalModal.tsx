import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { Chofer, CodigoDespacho } from '../types/biblia'
import { searchChoferes, searchCodigosDespacho, crearRepartoExcepcional, asignarChoferCodigoDespacho } from '@/services/bibliaApi'
import { useDebouncedSearch } from '../hooks/useDebouncedSearch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Search, Loader2, X } from 'lucide-react'

interface RepartoExcepcionalModalProps {
  open: boolean
  onClose: () => void
  fecha: string
  onCreado: () => void
  codigosDespachoGlobales: CodigoDespacho[]
  codigosDespachoByChofer: Map<string, CodigoDespacho[]>
}

export function RepartoExcepcionalModal({ open, onClose, fecha, onCreado, codigosDespachoGlobales, codigosDespachoByChofer }: RepartoExcepcionalModalProps) {
  const choferSearch = useDebouncedSearch<Chofer>(searchChoferes)
  const repartoSearch = useDebouncedSearch<CodigoDespacho>(searchCodigosDespacho)
  const [selectedChofer, setSelectedChofer] = useState<Chofer | null>(null)
  const [codigosDespachoAgregados, setCodigosDespachoAgregados] = useState<CodigoDespacho[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [guardarPermanente, setGuardarPermanente] = useState(false)

  const repartoInputRef = useRef<HTMLInputElement>(null)

  const codigosPermanentesDelChofer = useMemo(() => {
    if (!selectedChofer) return new Set<string>()
    return new Set(
      codigosDespachoGlobales
        .filter(r => !r.desactivado && r.nombre && (r.choferes ?? []).includes(selectedChofer.codigo))
        .map(r => r.nombre!)
    )
  }, [selectedChofer, codigosDespachoGlobales])

  const codigosExcepcionalesDelChofer = useMemo(() => {
    if (!selectedChofer) return new Set<string>()
    return new Set(
      (codigosDespachoByChofer.get(selectedChofer.codigo) ?? [])
        .filter(r => r.es_excepcion && r.nombre)
        .map(r => r.nombre!)
    )
  }, [selectedChofer, codigosDespachoByChofer])

  useEffect(() => {
    if (!open) {
      choferSearch.clear()
      repartoSearch.clear()
      setSelectedChofer(null)
      setCodigosDespachoAgregados([])
      setError('')
      setGuardarPermanente(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleChoferInput = useCallback((value: string) => {
    setSelectedChofer(null)
    setCodigosDespachoAgregados([])
    choferSearch.search(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choferSearch.search])

  const agregarCodigoDespacho = useCallback((r: CodigoDespacho) => {
    if (codigosPermanentesDelChofer.has(r.nombre ?? '') || codigosExcepcionalesDelChofer.has(r.nombre ?? '')) return
    setCodigosDespachoAgregados(prev =>
      prev.some(x => x.id === r.id) ? prev : [...prev, r]
    )
    repartoSearch.clear()
    repartoInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigosPermanentesDelChofer, codigosExcepcionalesDelChofer])

  const quitarCodigoDespacho = useCallback((id: CodigoDespacho['id']) => {
    setCodigosDespachoAgregados(prev => prev.filter(r => r.id !== id))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!selectedChofer || codigosDespachoAgregados.length === 0) return
    setSubmitting(true)
    setError('')
    let fallo: CodigoDespacho | null = null
    let ultimoError: unknown = null
    for (const codigoDespacho of codigosDespachoAgregados) {
      try {
        if (guardarPermanente) {
          await asignarChoferCodigoDespacho(String(codigoDespacho.id), selectedChofer.codigo)
        } else {
          await crearRepartoExcepcional({
            chofer_codigo: selectedChofer.codigo,
            chofer_nombre: selectedChofer.descripcion,
            codigo_reparto: codigoDespacho.nombre ?? '',
            codigo_despacho_id: String(codigoDespacho.id),
            fecha,
          })
        }
      } catch (e) {
        fallo = codigoDespacho
        ultimoError = e
        break
      }
    }
    if (fallo) {
      // Los que ya se crearon con éxito quedan: se avisa al padre para que refresque la
      // lista, y se descartan de acá para poder reintentar solo los que faltan sin duplicar.
      onCreado()
      const idx = codigosDespachoAgregados.findIndex(r => r.id === fallo!.id)
      setCodigosDespachoAgregados(prev => prev.slice(idx))
      setError((ultimoError as Error)?.message || `Error al crear excepción para ${fallo.nombre}`)
      setSubmitting(false)
    } else {
      onCreado()
      onClose()
      setSubmitting(false)
    }
  }, [selectedChofer, codigosDespachoAgregados, fecha, guardarPermanente, onCreado, onClose])

  const idsAgregados = new Set(codigosDespachoAgregados.map(r => r.id))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Agregar reparto excepcional</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chofer */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Chofer</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Escribí nombre o código..."
                value={selectedChofer ? `${selectedChofer.descripcion} (#${selectedChofer.codigo})` : choferSearch.query}
                onChange={e => handleChoferInput(e.target.value)}
              />
              {choferSearch.loading && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-slate-400" />}
            </div>
            {choferSearch.results.length > 0 && !selectedChofer && (
              <div className="border rounded-md max-h-[160px] overflow-y-auto">
                {choferSearch.results.map(c => (
                  <button
                    key={c.codigo}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                    onClick={() => { setSelectedChofer(c); choferSearch.clear() }}
                  >
                    <span className="font-medium">{c.descripcion}</span>
                    <span className="text-muted-foreground ml-2">#{c.codigo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Repartos — búsqueda + lista acumulada */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Códigos de despacho</label>

            {codigosDespachoAgregados.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-slate-50">
                {codigosDespachoAgregados.map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                    {r.nombre}
                    <button onClick={() => quitarCodigoDespacho(r.id)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                ref={repartoInputRef}
                className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Buscar y agregar códigos..."
                value={repartoSearch.query}
                onChange={e => repartoSearch.search(e.target.value)}
              />
              {repartoSearch.loading && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-slate-400" />}
            </div>
            {repartoSearch.results.length > 0 && (
              <div className="border rounded-md max-h-[160px] overflow-y-auto">
                {repartoSearch.results.map(r => {
                  const yaAgregado = idsAgregados.has(r.id)
                  const esPermanente = codigosPermanentesDelChofer.has(r.nombre ?? '')
                  const esExcepcionExistente = codigosExcepcionalesDelChofer.has(r.nombre ?? '')
                  const deshabilitado = yaAgregado || esPermanente || esExcepcionExistente
                  return (
                    <button
                      key={r.id}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${deshabilitado ? 'bg-slate-100 text-slate-400 cursor-default' : 'hover:bg-slate-100'}`}
                      onClick={() => !deshabilitado && agregarCodigoDespacho(r)}
                      disabled={deshabilitado}
                    >
                      {r.nombre}
                      {yaAgregado && <span className="ml-2 text-xs">(ya agregado)</span>}
                      {esPermanente && <span className="ml-2 text-xs">(ya es permanente)</span>}
                      {esExcepcionExistente && <span className="ml-2 text-xs">(ya tiene excep.)</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 accent-violet-600"
              checked={guardarPermanente}
              onChange={e => setGuardarPermanente(e.target.checked)}
            />
            <span className="text-sm text-slate-700">Guardar como asignación permanente</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button
              size="sm"
              disabled={!selectedChofer || codigosDespachoAgregados.length === 0 || submitting}
              onClick={handleSubmit}
            >
              {submitting
                ? 'Agregando...'
                : codigosDespachoAgregados.length > 1
                  ? `Agregar ${codigosDespachoAgregados.length} repartos`
                  : 'Agregar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
