import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { searchCodigosDespacho } from '@/services/bibliaApi'
import type { ChoferAdmin, CodigoDespachoAdmin } from '@/services/bibliaApi'

interface Props {
  open: boolean
  chofer: ChoferAdmin | null
  choferes: ChoferAdmin[]
  codigosDespacho: CodigoDespachoAdmin[]
  onClose: () => void
  onGuardar: (data: { codigo: string; descripcion: string; chofer_padre_codigo: string | null }, editando: boolean) => Promise<void>
  onAsignar: (codigoDespachoId: string, choferCodigo: string) => Promise<void>
  onDesasignar: (codigoDespachoId: string, choferCodigo: string) => Promise<void>
}

export function ChoferModal({ open, chofer, choferes, codigosDespacho, onClose, onGuardar, onAsignar, onDesasignar }: Props) {
  const editando = chofer !== null
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [choferPadre, setChoferPadre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Solo un nivel de desglose: puede ser padre quien no es hijo de otro (ni el propio chofer)
  const padresPosibles = choferes.filter(c =>
    !c.chofer_padre_codigo && !c.desactivado && c.codigo !== chofer?.codigo
  )
  const tieneHijos = editando && choferes.some(c => c.chofer_padre_codigo === chofer.codigo)

  // El código de un desglose es interno y se autogenera: PADRE-2, PADRE-3, ...
  // (el padre es la camioneta 1). Se toma el primer sufijo libre.
  const codigoDesglose = (padreCodigo: string) => {
    const existentes = new Set(choferes.map(c => c.codigo))
    let n = 2
    while (existentes.has(`${padreCodigo}-${n}`)) n++
    return `${padreCodigo}-${n}`
  }
  const codigoEfectivo = !editando && choferPadre ? codigoDesglose(choferPadre) : codigo

  // Asignación de rutas
  const [rutaQuery, setRutaQuery] = useState('')
  const [rutaResultados, setRutaResultados] = useState<{ id: string | number; nombre: string | null }[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const rutasAsignadas = chofer?.rutas ?? []
  const rutaSearchId = useRef(0)

  useEffect(() => {
    if (open) {
      setCodigo(chofer?.codigo ?? '')
      setDescripcion(chofer?.descripcion ?? '')
      setChoferPadre(chofer?.chofer_padre_codigo ?? '')
      setRutaQuery('')
      setRutaResultados([])
      setError(null)
    }
  }, [open, chofer])

  useEffect(() => {
    if (!rutaQuery.trim()) { setRutaResultados([]); return }

    const timer = setTimeout(async () => {
      const id = ++rutaSearchId.current
      setLoadingSearch(true)
      try {
        const res = await searchCodigosDespacho(rutaQuery)
        if (id === rutaSearchId.current) setRutaResultados(res)
      } finally {
        if (id === rutaSearchId.current) setLoadingSearch(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [rutaQuery])

  const handleSubmit = async () => {
    if (!codigoEfectivo.trim()) { setError('El código es requerido'); return }
    if (!editando && !choferPadre && !/^\d+$/.test(codigoEfectivo.trim())) {
      setError('El código Sigma debe ser numérico')
      return
    }
    setLoading(true); setError(null)
    try {
      await onGuardar({ codigo: codigoEfectivo.trim(), descripcion: descripcion.trim(), chofer_padre_codigo: choferPadre || null }, editando)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setLoading(false) }
  }

  const handleAsignarRuta = async (repartoId: string) => {
    if (!chofer) return
    await onAsignar(repartoId, chofer.codigo)
    setRutaQuery('')
    setRutaResultados([])
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar chofer' : 'Nuevo chofer'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 w-28">
              <label className="text-sm font-medium text-gray-700">
                {choferPadre ? 'Código' : 'Código Sigma'}
              </label>
              <input
                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                value={codigoEfectivo}
                onChange={e => setCodigo(e.target.value)}
                disabled={editando || Boolean(choferPadre)}
                placeholder="ej: 071"
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium text-gray-700">Nombre</label>
              <input
                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Chofer padre</label>
            <select
              className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              value={choferPadre}
              onChange={e => setChoferPadre(e.target.value)}
              disabled={tieneHijos}
            >
              <option value="">— Ninguno (chofer de Sigma) —</option>
              {padresPosibles.map(c => (
                <option key={c.codigo} value={c.codigo}>
                  {c.codigo}{c.descripcion ? ` — ${c.descripcion}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400">
              {tieneHijos
                ? 'Este chofer tiene desgloses propios y no puede ser desglose de otro.'
                : choferPadre
                  ? 'Desglose: camioneta adicional de un chofer que en Sigma figura una sola vez. El código se genera solo.'
                  : 'Un chofer nuevo sin padre debe usar el código numérico con el que existe en Sigma.'}
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button size="sm" onClick={handleSubmit} disabled={loading || !codigoEfectivo.trim()}>
              {loading ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>

          {/* Sección códigos de despacho — solo visible al editar */}
          {editando && (
            <div className="border-t pt-3 flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700">Códigos de despacho asignados</p>

              {rutasAsignadas.length === 0 ? (
                <p className="text-xs text-gray-400">Sin códigos de despacho asignados</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {rutasAsignadas.map(rid => {
                    const r = codigosDespacho.find(x => x.id === rid)
                    return (
                      <span key={rid} className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full">
                        <span className="font-mono">{rid}</span>
                        {r?.nombre && <span className="opacity-70">— {r.nombre}</span>}
                        <button
                          className="ml-0.5 hover:text-red-500 transition-colors"
                          onClick={() => onDesasignar(rid, chofer.codigo)}
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
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Buscar código de despacho para asignar…"
                  value={rutaQuery}
                  onChange={e => setRutaQuery(e.target.value)}
                />
                {loadingSearch && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
                {rutaResultados.length > 0 && (
                  <ul className="absolute left-0 right-0 z-10 bg-white border rounded-md shadow-md mt-1 max-h-36 overflow-y-auto">
                    {rutaResultados
                      .filter(r => !rutasAsignadas.includes(String(r.id)))
                      .map(r => (
                        <li
                          key={r.id}
                          className="px-3 py-2 text-sm hover:bg-violet-50 cursor-pointer flex items-center gap-2"
                          onClick={() => handleAsignarRuta(String(r.id))}
                        >
                          <span className="font-mono text-xs text-gray-400">{r.id}</span>
                          <span>{r.nombre}</span>
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
