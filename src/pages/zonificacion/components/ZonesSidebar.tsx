import { getZonePoints } from '../lib/geo';
import type { Criterios, Pdv, Zona } from '../types';
import { ZoneItem } from './ZoneItem';

interface ZonesSidebarProps {
  zonas: Zona[];
  pdv: Pdv[];
  /** Universo completo (sin filtrar), para poder mostrar el nombre de los PDV excluidos en los criterios. */
  universoPdv: Pdv[];
  editingIndex: number | null;
  /** true si el usuario actual no puede editar el grupo activo (no es dueño/admin y no es compartido). */
  readOnly: boolean;
  onStartEdit: (index: number) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRename: (index: number, nombre: string) => void;
  onDelete: (index: number) => void;
  onAplicarCriterios: (criterios: Criterios) => void;
}

export function ZonesSidebar({ zonas, pdv, universoPdv, editingIndex, readOnly, onStartEdit, onSaveEdit, onCancelEdit, onRename, onDelete, onAplicarCriterios }: ZonesSidebarProps) {
  if (zonas.length === 0) {
    return <div className="p-3 text-xs italic text-slate-400">Ninguna zona aún.</div>;
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto p-3">
      {zonas.map((zona, index) => (
        <ZoneItem
          key={index}
          zona={zona}
          pts={getZonePoints(pdv, zona.vertices)}
          universoPdv={universoPdv}
          isEditing={editingIndex === index}
          disabled={readOnly || (editingIndex !== null && editingIndex !== index)}
          onStartEdit={() => onStartEdit(index)}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onRename={(nombre) => onRename(index, nombre)}
          onDelete={() => onDelete(index)}
          onAplicarCriterios={() => zona.criterios && onAplicarCriterios(zona.criterios)}
        />
      ))}
    </div>
  );
}
