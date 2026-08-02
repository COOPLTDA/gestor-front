import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIPO_GRUPO_LABEL, type Grupo, type TipoGrupo } from '../types';

interface GrupoFormValues {
  nombre: string;
  tipo: TipoGrupo;
  editablePorOtros: boolean;
}

interface GrupoFormDialogProps {
  open: boolean;
  /** Si viene un grupo, el diálogo edita ese grupo; si no, crea uno nuevo. */
  grupo: Grupo | null;
  onSubmit: (values: GrupoFormValues) => void;
  onClose: () => void;
}

const TIPOS: TipoGrupo[] = ['ruta_flete', 'ruta_vendedor', 'reestructuracion'];

const VALORES_VACIOS: GrupoFormValues = { nombre: '', tipo: 'ruta_flete', editablePorOtros: false };

// Alta/edición formal de un Grupo de Zonas — reemplaza el prompt() suelto que
// pedía solo el nombre. Ahora que DistriGestión tiene usuarios reales, un grupo
// tiene tipo (para qué se usa: armar rutas de flete/vendedor, o rediseñar zonas
// existentes) y puede marcarse editable por otros usuarios, no solo por su dueño.
export function GrupoFormDialog({ open, grupo, onSubmit, onClose }: GrupoFormDialogProps) {
  const [values, setValues] = useState<GrupoFormValues>(VALORES_VACIOS);

  useEffect(() => {
    if (!open) return;
    setValues(grupo ? { nombre: grupo.nombre, tipo: grupo.tipo, editablePorOtros: grupo.editablePorOtros } : VALORES_VACIOS);
  }, [open, grupo]);

  function handleSubmit() {
    const nombre = values.nombre.trim();
    if (!nombre) return;
    onSubmit({ ...values, nombre });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{grupo ? 'Editar grupo' : 'Nuevo grupo de zonas'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">Nombre</span>
            <Input
              autoFocus
              value={values.nombre}
              onChange={(e) => setValues((v) => ({ ...v, nombre: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">Tipo</span>
            <Select value={values.tipo} onValueChange={(tipo) => setValues((v) => ({ ...v, tipo: tipo as TipoGrupo }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_GRUPO_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={values.editablePorOtros}
              onCheckedChange={(checked) => setValues((v) => ({ ...v, editablePorOtros: checked === true }))}
            />
            Editable por otros usuarios
          </label>

          {grupo && (
            <p className="text-xs text-slate-400">Dueño: {grupo.creadoPor.nombre || `usuario #${grupo.creadoPor.id}`}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!values.nombre.trim()}>{grupo ? 'Guardar' : 'Crear grupo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
