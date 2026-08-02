import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { RangoVentas } from '@/services/zonificacionApi';
import { formatRangoVentas } from '../lib/rangoVentas';

interface ZoneConfirmDialogProps {
  open: boolean;
  defaultNombre: string;
  cantidadPdv: number;
  facturacionTotal: number;
  rangoVentas: RangoVentas;
  solapamiento: number;
  onConfirm: (nombre: string) => void;
  onCancel: () => void;
}

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

// Confirmación antes de crear una zona: hoy dibujar un polígono la creaba directo con nombre
// autogenerado. Pedimos el nombre y mostramos de una las estadísticas de lo que quedó adentro
// (PDV, facturación en el rango de fechas filtrado) más una advertencia si se solapa con zonas
// ya existentes del mismo grupo — evita descubrir el solapamiento recién al exportar.
export function ZoneConfirmDialog({ open, defaultNombre, cantidadPdv, facturacionTotal, rangoVentas, solapamiento, onConfirm, onCancel }: ZoneConfirmDialogProps) {
  const [nombre, setNombre] = useState(defaultNombre);

  useEffect(() => {
    if (open) setNombre(defaultNombre);
  }, [open, defaultNombre]);

  function handleConfirm() {
    const trimmed = nombre.trim();
    if (trimmed) onConfirm(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva zona</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">Nombre</span>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3 text-sm">
            <span className="text-slate-500">Cantidad de PDV</span>
            <span className="text-right font-semibold text-slate-700">{cantidadPdv.toLocaleString('es-AR')}</span>
            <span className="text-slate-500">Facturación ({formatRangoVentas(rangoVentas)})</span>
            <span className="text-right font-semibold text-slate-700">{formatMoney(facturacionTotal)}</span>
          </div>

          {solapamiento > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
              ⚠ <b>{solapamiento}</b> {solapamiento === 1 ? 'cliente' : 'clientes'} de esta zona ya {solapamiento === 1 ? 'está' : 'están'} incluido en otra zona del grupo.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!nombre.trim()}>Crear zona</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
