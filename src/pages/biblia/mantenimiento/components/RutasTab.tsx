import { useState, useMemo } from 'react'
import { Pencil, PowerOff, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { normalizeForSearch } from '@/utils/normalization'
import { RutaModal } from './RutaModal'
import type { CodigoDespachoAdmin, ChoferAdmin, ZonaAdmin } from '@/services/bibliaApi'

interface Props {
  codigosDespacho: CodigoDespachoAdmin[]
  choferes: ChoferAdmin[]
  zonas: ZonaAdmin[]
  loading: boolean
  onGuardar: (data: Pick<CodigoDespachoAdmin, 'id' | 'zona_id'>, editando: boolean) => Promise<void>
  onToggle: (id: string, desactivado: number) => Promise<void>
  onAsignar: (codigoDespachoId: string, choferCodigo: string) => Promise<void>
  onDesasignar: (codigoDespachoId: string, choferCodigo: string) => Promise<void>
}

export function RutasTab({ codigosDespacho, choferes, zonas, loading, onGuardar, onToggle, onAsignar, onDesasignar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<CodigoDespachoAdmin | null>(null)

  const zonaMap = useMemo(() =>
    new Map(zonas.map(z => [z.id, z.nombre])),
    [zonas]
  )

  const choferMap = useMemo(() =>
    new Map(choferes.map(c => [c.codigo, c.descripcion ?? c.codigo])),
    [choferes]
  )

  const filtrados = useMemo(() => {
    const q = normalizeForSearch(busqueda)
    const lista = codigosDespacho.filter(r =>
      normalizeForSearch(r.id).includes(q) ||
      normalizeForSearch(r.nombre ?? '').includes(q) ||
      normalizeForSearch(zonaMap.get(r.zona_id ?? 0) ?? '').includes(q)
    )
    // Activos primero, luego inactivos; dentro de cada grupo orden original
    return [...lista].sort((a, b) =>
      (a.desactivado ?? 0) - (b.desactivado ?? 0) ||
      (a.nombre ?? '').localeCompare(b.nombre ?? '')
    )
  }, [codigosDespacho, busqueda, zonaMap])

  const abrirEditar = (r: CodigoDespachoAdmin) => { setEditando(r); setModalOpen(true) }

  const repartoActual = editando ? (codigosDespacho.find(r => r.id === editando.id) ?? editando) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar por código, descripción o zona…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">Cód. despacho</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Zona</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Choferes</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Estado</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Cargando…</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Sin resultados</td></tr>
            ) : filtrados.map((r, i) => (
              <tr key={r.id} className={`border-b last:border-b-0 ${i % 2 === 0 ? '' : 'bg-slate-50/50'} ${r.desactivado ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.id}</td>
                <td className="px-4 py-3 font-medium">{r.nombre ?? <span className="text-gray-400 italic">Sin descripción</span>}</td>
                <td className="px-4 py-3 text-gray-600">
                  {r.zona_id
                    ? <span className="inline-block bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full">{zonaMap.get(r.zona_id) ?? r.zona_id}</span>
                    : <span className="text-gray-400 text-xs">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {(r.choferes ?? []).length === 0 ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(r.choferes ?? []).map(cod => {
                        const nombre = choferMap.get(cod)
                        return (
                          <span key={cod} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-mono">
                            {cod}{nombre ? ` · ${nombre}` : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.desactivado
                    ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactivo</span>
                    : <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Activo</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => abrirEditar(r)} title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${r.desactivado ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-400 hover:text-red-600'}`}
                      onClick={() => onToggle(r.id, r.desactivado)}
                      title={r.desactivado ? 'Activar' : 'Desactivar'}
                    >
                      {r.desactivado ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RutaModal
        open={modalOpen}
        reparto={repartoActual}
        zonas={zonas}
        onClose={() => setModalOpen(false)}
        onGuardar={onGuardar}
        onAsignar={onAsignar}
        onDesasignar={onDesasignar}
      />
    </div>
  )
}
