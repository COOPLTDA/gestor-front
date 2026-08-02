import { useState, useMemo } from 'react'
import { Pencil, PowerOff, Power, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChoferModal } from './ChoferModal'
import type { ChoferAdmin, CodigoDespachoAdmin } from '@/services/bibliaApi'

interface Props {
  choferes: ChoferAdmin[]
  codigosDespacho: CodigoDespachoAdmin[]
  loading: boolean
  onGuardar: (data: { codigo: string; descripcion: string; chofer_padre_codigo: string | null }, editando: boolean) => Promise<void>
  onToggle: (codigo: string, desactivado: number) => Promise<void>
  onAsignar: (codigoDespachoId: string, choferCodigo: string) => Promise<void>
  onDesasignar: (codigoDespachoId: string, choferCodigo: string) => Promise<void>
}

export function ChoferesTab({ choferes, codigosDespacho, loading, onGuardar, onToggle, onAsignar, onDesasignar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ChoferAdmin | null>(null)

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    const lista = choferes.filter(c =>
      c.codigo.toLowerCase().includes(q) ||
      (c.descripcion ?? '').toLowerCase().includes(q)
    )
    return [...lista].sort((a, b) =>
      a.desactivado - b.desactivado ||
      (a.descripcion ?? '').localeCompare(b.descripcion ?? '')
    )
  }, [choferes, busqueda])

  const abrirEditar = (c: ChoferAdmin) => { setEditando(c); setModalOpen(true) }
  const abrirNuevo = () => { setEditando(null); setModalOpen(true) }

  // Siempre pasar el chofer actualizado del array (no el snapshot stale)
  const choferActual = editando ? (choferes.find(c => c.codigo === editando.codigo) ?? editando) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar por código o nombre…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="w-4 h-4 mr-1" />
          Nuevo
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Código</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Códigos de despacho</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Estado</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Cargando…</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Sin resultados</td></tr>
            ) : filtrados.map((c, i) => (
              <tr key={c.codigo} className={`border-b last:border-b-0 ${i % 2 === 0 ? '' : 'bg-slate-50/50'} ${c.desactivado ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.codigo}</td>
                <td className="px-4 py-3 font-medium">
                  {c.descripcion ?? <span className="text-gray-400 italic">Sin nombre</span>}
                  {c.chofer_padre_codigo && (
                    <span className="ml-2 inline-block bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-normal">
                      desglose de {c.chofer_padre_codigo}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {(c.rutas ?? []).length === 0 ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(c.rutas ?? []).map(rid => {
                        const desc = codigosDespacho.find(r => r.id === rid)?.nombre
                        return (
                          <span key={rid} className="inline-block bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-mono">
                            {rid}{desc ? ` · ${desc}` : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.desactivado ? (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactivo</span>
                  ) : (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Activo</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => abrirEditar(c)} title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${c.desactivado ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-400 hover:text-red-600'}`}
                      onClick={() => onToggle(c.codigo, c.desactivado)}
                      title={c.desactivado ? 'Activar' : 'Desactivar'}
                    >
                      {c.desactivado ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ChoferModal
        open={modalOpen}
        chofer={choferActual}
        choferes={choferes}
        codigosDespacho={codigosDespacho}
        onClose={() => setModalOpen(false)}
        onGuardar={onGuardar}
        onAsignar={onAsignar}
        onDesasignar={onDesasignar}
      />
    </div>
  )
}
