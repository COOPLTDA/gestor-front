import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { describeCriterios, describeExcluidos } from '../lib/filters';
import type { Pdv, Zona } from '../types';

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

interface ZoneItemProps {
  zona: Zona;
  pts: Pdv[];
  /** Universo completo (sin filtrar), para poder mostrar el nombre de los PDV excluidos. */
  universoPdv: Pdv[];
  isEditing: boolean;
  /** true si OTRA zona está en edición — bloquea acciones acá para no desincronizar índices */
  disabled: boolean;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRename: (nombre: string) => void;
  onDelete: () => void;
  onAplicarCriterios: () => void;
}

export function ZoneItem({ zona, pts, universoPdv, isEditing, disabled, onStartEdit, onSaveEdit, onCancelEdit, onRename, onDelete, onAplicarCriterios }: ZoneItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(zona.nombre);
  const [mostrarCriterios, setMostrarCriterios] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  function commit() {
    setRenaming(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== zona.nombre) onRename(trimmed);
    else setDraft(zona.nombre);
  }

  function cancel() {
    setRenaming(false);
    setDraft(zona.nombre);
  }

  const vendedores = new Set(pts.map((p) => p.vnd_cod).filter(Boolean)).size;
  // Suma de facturación de los puntos que quedan adentro con los filtros ACTUALES (no el
  // snapshot de criterios con el que se creó la zona) — pts ya viene filtrado por eso.
  const facturacion = pts.reduce((acc, p) => acc + p.facturacion, 0);

  return (
    <Card className="border-l-4 p-3" style={{ borderLeftColor: zona.color }}>
      {renaming ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          className="h-7 text-sm font-semibold"
        />
      ) : (
        <div className="text-sm font-semibold" style={{ color: zona.color }}>
          {zona.nombre}
        </div>
      )}

      <div className="mt-1 text-xs text-slate-500">
        <b className="text-slate-700">{pts.length}</b> PDV &nbsp;|&nbsp; Vendedores distintos: <b className="text-slate-700">{vendedores}</b>
      </div>
      <div className="text-xs text-slate-500">
        Facturación (filtros actuales): <b className="text-slate-700">{formatMoney(facturacion)}</b>
      </div>

      <button
        type="button"
        className="mt-1 text-left text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-600"
        onClick={() => setMostrarCriterios((v) => !v)}
      >
        {mostrarCriterios ? 'Ocultar criterios' : 'Ver con qué criterio se creó'}
      </button>
      {mostrarCriterios && (
        <div className="mt-1 rounded bg-slate-50 p-1.5 text-[11px] text-slate-500">
          {describeCriterios(zona.criterios).map((linea, i) => (
            <div key={i}>
              {linea.label && <b className="text-slate-700">{linea.label}: </b>}
              {linea.value}
            </div>
          ))}
          {zona.criterios && zona.criterios.excluidos.length > 0 && (
            <div>
              <b className="text-slate-700">PDV excluidos: </b>
              {describeExcluidos(zona.criterios.excluidos, universoPdv)}
            </div>
          )}
          {zona.criterios && (
            <button
              type="button"
              title="Ver la zona como la vio quien la creó"
              className="mt-1 block font-medium text-violet-600 underline hover:text-violet-800"
              onClick={onAplicarCriterios}
            >
              Aplicar estos filtros
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {isEditing ? (
          <>
            <Button size="sm" onClick={onSaveEdit}>Guardar cambios</Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancelar</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={disabled} onClick={onStartEdit}>Editar forma</Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => setRenaming(true)}>Renombrar</Button>
            <Button size="sm" variant="outline" disabled={disabled} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onDelete}>
              Eliminar
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
