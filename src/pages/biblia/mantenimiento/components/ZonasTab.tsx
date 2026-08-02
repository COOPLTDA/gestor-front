import { useState, useMemo } from 'react'
import { Pencil, PowerOff, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ZonaModal } from './ZonaModal'
import type { ZonaAdmin, CodigoDespachoAdmin } from '@/services/bibliaApi'

interface Props {
  zonas: ZonaAdmin[]
  codigosDespacho: CodigoDespachoAdmin[]
  loading: boolean
  onGuardar: (data: { id?: number; nombre: string }, editando: boolean) => Promise<void>
  onToggle: (id: number, desactivado: number) => Promise<void>
  onAsignar: (codigoDespachoId: string, zonaId: number) => Promise<void>
  onDesasignar: (codigoDespachoId: string, zonaId: number) => Promise<void>
}

export function ZonasTab({ zonas, codigosDespacho, loading, onGuardar, onToggle, onAsignar, onDesasignar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ZonaAdmin | null>(null)

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase()
    return zonas.filter(z =>
      z.nombre.toLowerCase().includes(q)
    )
  }, [zonas, busqueda])

  const zonaActual = editando ? (zonas.find(z => z.id === editando.id) ?? editando) : null

  const repartoMap = useMemo(() =>
    new Map(codigosDespacho.map(r => [r.id, r.nombre ?? r.id])),
    [codigosDespacho]
  )

  const abrirNuevo = () => { setEditando(null); setModalOpen(true) }
  const abrirEditar = (z: ZonaAdmin) => { setEditando(z); setModalOpen(true) }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar por código o nombre…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <Button size="sm" onClick={abrirNuevo}>+ Nueva</Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Códigos de despacho</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Estado</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400">Cargando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400">Sin resultados</td></tr>
            ) : filtradas.map((z, i) => (
              <tr key={z.id} className={`border-b last:border-b-0 ${i % 2 === 0 ? '' : 'bg-slate-50/50'} ${z.desactivado ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium">{z.nombre}</td>
                <td className="px-4 py-3">
                  {(z.repartos ?? []).length === 0 ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(z.repartos ?? []).map(rid => (
                        <span key={rid} className="inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-mono" title={repartoMap.get(rid)}>
                          {rid}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {z.desactivado ? (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactiva</span>
                  ) : (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Activa</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => abrirEditar(z)} title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${z.desactivado ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-400 hover:text-red-600'}`}
                      onClick={() => onToggle(z.id, z.desactivado)}
                      title={z.desactivado ? 'Activar' : 'Desactivar'}
                    >
                      {z.desactivado ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ZonaModal
        open={modalOpen}
        zona={zonaActual}
        codigosDespacho={codigosDespacho}
        onClose={() => setModalOpen(false)}
        onGuardar={onGuardar}
        onAsignar={onAsignar}
        onDesasignar={onDesasignar}
      />
    </div>
  )
}
