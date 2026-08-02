import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TIPO_GRUPO_LABEL, type Grupo } from '../types';
import { GrupoFormDialog } from './GrupoFormDialog';

interface NuevoGrupoValues {
  nombre: string;
  tipo: Grupo['tipo'];
  editablePorOtros: boolean;
}

interface GroupsPanelProps {
  grupos: Grupo[];
  activeId: number | null;
  /** Si el usuario actual puede editar/borrar este grupo (dueño, admin, o grupo compartido). */
  puedeEditar: (grupo: Grupo) => boolean;
  onSwitch: (id: number) => void;
  onCreate: (values: NuevoGrupoValues) => void;
  onEdit: (id: number, values: NuevoGrupoValues) => void;
  onDelete: (id: number) => void;
}

const GROUP_COLORS = ['#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#fb7185', '#f97316', '#e879f9'];

export function GroupsPanel({ grupos, activeId, puedeEditar, onSwitch, onCreate, onEdit, onDelete }: GroupsPanelProps) {
  const [dialogGrupo, setDialogGrupo] = useState<Grupo | null | undefined>(undefined);
  const [listaAbierta, setListaAbierta] = useState(false);

  const grupoActivo = grupos.find((g) => g.id === activeId) ?? null;

  function handleSubmit(values: NuevoGrupoValues) {
    if (dialogGrupo) {
      onEdit(dialogGrupo.id, values);
    } else {
      onCreate(values);
    }
    setDialogGrupo(undefined);
  }

  return (
    <div className="flex flex-col gap-1 border-b p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600" title={grupoActivo?.nombre}>
          {grupoActivo ? grupoActivo.nombre : 'Sin grupo activo'}
        </span>
        <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setListaAbierta(true)}>
          Grupos{grupos.length > 0 && ` (${grupos.length})`}
        </Button>
      </div>

      {grupoActivo && (
        <div className="pl-0.5 text-[10px] text-slate-400">
          {grupoActivo.zonas.length} zona(s) · {TIPO_GRUPO_LABEL[grupoActivo.tipo]} · {grupoActivo.creadoPor.nombre || `usuario #${grupoActivo.creadoPor.id}`}
          {grupoActivo.editablePorOtros && ' · compartido'}
        </div>
      )}

      <Dialog open={listaAbierta} onOpenChange={setListaAbierta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle>Grupos</DialogTitle>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDialogGrupo(null)}>+ Nuevo</Button>
            </div>
          </DialogHeader>

          {grupos.length === 0 ? (
            <div className="py-1 text-xs italic text-slate-400">Sin grupos aún. Creá uno para empezar.</div>
          ) : (
            <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
              {grupos.map((g, i) => {
                const color = GROUP_COLORS[i % GROUP_COLORS.length];
                const active = g.id === activeId;
                const editable = puedeEditar(g);
                return (
                  <div
                    key={g.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    onClick={() => { if (!active) onSwitch(g.id); }}
                    onKeyDown={(e) => { if (!active && (e.key === 'Enter' || e.key === ' ')) onSwitch(g.id); }}
                    className={`flex cursor-pointer flex-col gap-1 rounded-md border-l-4 px-2 py-1.5 transition-colors ${
                      active ? 'border-2 border-violet-400 bg-violet-50' : 'border border-transparent bg-slate-50 hover:bg-slate-100'
                    }`}
                    style={{ borderLeftColor: color }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="flex-1 truncate text-xs font-medium" style={{ color }}>{g.nombre}</span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{g.zonas.length} zona(s)</span>
                      {active && (
                        <span className="text-[10px] font-bold text-violet-600 whitespace-nowrap">● activo</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-violet-600 hover:text-white"
                        title="Editar"
                        disabled={!editable}
                        onClick={(e) => { e.stopPropagation(); setDialogGrupo(g); }}
                      >
                        ✏
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500 hover:bg-red-600 hover:text-white"
                        title="Eliminar"
                        disabled={!editable}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Eliminar el grupo "${g.nombre}" y todas sus zonas?`)) onDelete(g.id);
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                    <div className="pl-0.5 text-[10px] text-slate-400">
                      {TIPO_GRUPO_LABEL[g.tipo]} · {g.creadoPor.nombre || `usuario #${g.creadoPor.id}`}
                      {g.editablePorOtros && ' · compartido'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <GrupoFormDialog
        open={dialogGrupo !== undefined}
        grupo={dialogGrupo ?? null}
        onSubmit={handleSubmit}
        onClose={() => setDialogGrupo(undefined)}
      />
    </div>
  );
}
