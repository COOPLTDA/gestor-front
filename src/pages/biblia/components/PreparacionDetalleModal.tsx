import { useState } from "react";
import type { Preparacion, Pedido, CodigoDespacho, SigmaSyncEstado } from "../types/biblia";
import type { PedidoCambioEstado } from "../../../services/bibliaApi";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, Edit2, Loader2 } from "lucide-react";
import { formatCurrency } from "../utils/bibliaUtils";
import { modificarPedido } from "../../../services/bibliaApi";

interface Props {
  preparacion: Preparacion;
  open: boolean;
  onClose: () => void;
  codigosDespacho?: CodigoDespacho[];
  onModificado?: () => void;
  readonly?: boolean;
  isAsignada?: boolean;
  onDesasignarAlEditar?: () => void;
  bibliaFecha: string;
  pedidoCambios?: PedidoCambioEstado[];
  asignacionCrossCode?: { destino_nombre: string | null; sigma_sync_estado: SigmaSyncEstado };
}

export function PreparacionDetalleModal({ preparacion, open, onClose, codigosDespacho = [], onModificado, readonly, isAsignada, onDesasignarAlEditar, bibliaFecha, pedidoCambios, asignacionCrossCode }: Props) {
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<{
    pedidoId: string;
    repartoId?: string; // ID de CodigoDespacho; se llama repartoId porque así lo espera el endpoint de Sigma
    fechaReparto?: string;
    observacion?: string;
  } | null>(null);
  const [editingInitialRepartoId, setEditingInitialRepartoId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // codigo_despacho actualizado localmente (solo muestra el cambio pendiente en la UI de esta sesión)
  const [localCodigos, setLocalCodigos] = useState<Map<string, string | null>>(new Map())

  const handleEditClick = (pedido: Pedido) => {
    // Pre-llenar con el código efectivo: cambio individual > cross-code > original.
    const serverCambio = pedidoCambios?.find(c => c.pedido_codigo === pedido.codigo);
    const efectiveNombre = serverCambio?.nuevo_codigo_despacho
      ?? asignacionCrossCode?.destino_nombre
      ?? pedido.codigo_despacho;
    const repartoActual = codigosDespacho.find((r) => r.nombre === efectiveNombre);
    const repartoId = repartoActual ? String(repartoActual.id) : undefined;
    setEditingPedidoId(pedido.codigo);
    setEditingForm({ pedidoId: pedido.codigo, repartoId });
    setEditingInitialRepartoId(repartoId);
    setError(null);
  };

  const handleSaveModificacion = async () => {
    if (!editingForm) return;

    setLoading(true);
    setError(null);

    try {
      const nuevoNombre = editingForm.repartoId
        ? (codigosDespacho.find(r => String(r.id) === editingForm.repartoId)?.nombre ?? null)
        : null

      await modificarPedido(
        editingForm.pedidoId,
        {
          repartoId: editingForm.repartoId ? Number(editingForm.repartoId) : undefined,
          nuevoCodigo: nuevoNombre,
          fechaReparto: editingForm.fechaReparto,
          observacion: editingForm.observacion,
        },
        preparacion.id,
        bibliaFecha,
      );

      const codigoCambio = editingForm.repartoId !== editingInitialRepartoId;
      setLocalCodigos(prev => new Map(prev).set(editingForm.pedidoId, nuevoNombre))
      setEditingPedidoId(null);
      setEditingForm(null);
      setSuccess(isAsignada && codigoCambio ? 'Cambio guardado — la preparación fue desasignada' : 'Cambio guardado')
      if (isAsignada && codigoCambio) onDesasignarAlEditar?.();
      onModificado?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al modificar pedido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[480px] max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            {preparacion.codigo_envio || `#${preparacion.id}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {preparacion.cantidad_pedidos} pedido
              {preparacion.cantidad_pedidos !== 1 ? "s" : ""}
            </span>
            <span className="text-border">·</span>
            <span>
              {preparacion.cantidad_clientes} cliente
              {preparacion.cantidad_clientes !== 1 ? "s" : ""}
            </span>
            {preparacion.peso > 0 && (
              <>
                <span className="text-border">·</span>
                <span>
                  {preparacion.peso_text} / {preparacion.volumen_text}
                </span>
              </>
            )}
          </div>

          <p className="text-lg font-bold text-emerald-700">
            {formatCurrency(preparacion.importe_total)}
          </p>

          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Pedidos
            </p>
            {success && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 space-y-1">
                <p className="font-semibold">✓ {success}</p>
                <p className="text-xs leading-relaxed">
                  El cambio quedó <strong>pendiente de impactar en Sigma</strong>. Usá el botón <em>Impactar en Sigma</em> cuando estés listo.
                </p>
              </div>
            )}
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              {preparacion.pedidos.map((ped) => {
                // Determinar el código y estado efectivos para este pedido.
                // Prioridad: edición local > cambio individual persistido > cross-code de toda la prep > original
                // El cross-code sirve de base para todos los pedidos; el cambio individual lo pisa para ese
                // pedido en particular (puede haberse agregado DESPUÉS de que el cross-code fue impactado).
                let efectivoCode: string | null | undefined = ped.codigo_despacho;
                let efectivoEstado: SigmaSyncEstado | null = null;

                if (asignacionCrossCode) {
                  efectivoCode = asignacionCrossCode.destino_nombre ?? ped.codigo_despacho;
                  efectivoEstado = asignacionCrossCode.sigma_sync_estado;
                }
                const serverCambio = pedidoCambios?.find(c => c.pedido_codigo === ped.codigo);
                if (serverCambio) {
                  efectivoCode = serverCambio.nuevo_codigo_despacho ?? ped.codigo_despacho;
                  efectivoEstado = serverCambio.estado;
                }
                if (localCodigos.has(ped.codigo)) {
                  efectivoCode = localCodigos.get(ped.codigo) ?? ped.codigo_despacho;
                  efectivoEstado = 'pendiente';
                }

                const codigoDespacho = efectivoCode;
                const codigoCambio = efectivoCode !== ped.codigo_despacho;
                return (
                <Card key={ped.codigo} className="bg-muted/50">
                  <CardContent className="p-3 space-y-2">
                    {editingPedidoId === ped.codigo ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-800">
                            {ped.codigo}
                          </span>
                          <span className="text-sm font-semibold text-emerald-700">
                            {formatCurrency(ped.importe)}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase">
                            Reparto
                          </label>
                          <select
                            className="w-full h-8 text-xs rounded border border-input px-2"
                            value={editingForm?.repartoId ?? ""}
                            onChange={(e) => {
                              setEditingForm((f) =>
                                f ? { ...f, repartoId: e.target.value } : null
                              );
                            }}
                          >
                            <option value="">Seleccionar código de despacho</option>
                            {codigosDespacho.map((r) => (
                              <option key={r.id} value={String(r.id)}>
                                {r.nombre || r.id}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase">
                            Fecha Reparto (opcional)
                          </label>
                          <input
                            type="date"
                            className="w-full h-8 text-xs rounded border border-input px-2"
                            value={editingForm?.fechaReparto ?? ""}
                            onChange={(e) => {
                              setEditingForm((f) =>
                                f
                                  ? { ...f, fechaReparto: e.target.value }
                                  : null
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase">
                            Observación (opcional)
                          </label>
                          <input
                            type="text"
                            className="w-full h-8 text-xs rounded border border-input px-2"
                            placeholder="Agregar observación"
                            value={editingForm?.observacion ?? ""}
                            onChange={(e) => {
                              setEditingForm((f) =>
                                f ? { ...f, observacion: e.target.value } : null
                              );
                            }}
                          />
                        </div>
                        {isAsignada && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                            Guardar desasignará esta preparación de su chofer.
                          </p>
                        )}
                        {!ped.pendiente_sigma && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                            Este pedido podría no estar en estado Pendiente en Sigma. El cambio quedará en cola; podría fallar al impactar.
                          </p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            onClick={handleSaveModificacion}
                            disabled={loading}
                          >
                            {loading && (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            )}
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditingPedidoId(null);
                              setEditingForm(null);
                            }}
                            disabled={loading}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-800">
                            {ped.codigo}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-emerald-700">
                              {formatCurrency(ped.importe)}
                            </span>
                            {!readonly && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditClick(ped)}
                                title="Modificar reparto"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {ped.cliente_nombre && (
                          <p className="text-sm text-muted-foreground break-words">
                            {ped.cliente_nombre}
                          </p>
                        )}
                        {ped.cliente_direccion && (
                          <p className="text-sm text-muted-foreground break-words">
                            {ped.cliente_direccion}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {ped.estado && (
                            <span className="font-semibold">{ped.estado}</span>
                          )}
                          {ped.peso_text && <span>{ped.peso_text}</span>}
                          {ped.volumen_text && <span>{ped.volumen_text}</span>}
                          {codigoDespacho && (
                            <span className={
                              codigoCambio && (efectivoEstado === 'fallido' || efectivoEstado === 'bloqueado') ? "font-semibold text-red-700" :
                              codigoCambio && efectivoEstado ? "font-semibold text-amber-700" :
                              ""
                            }>
                              · {codigoDespacho}
                            </span>
                          )}
                          {efectivoEstado === 'pendiente' && (
                            <span className="font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded text-[10px] uppercase tracking-wide">
                              sigma
                            </span>
                          )}
                          {efectivoEstado === 'ok' && (
                            <span className="font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded text-[10px] uppercase tracking-wide">
                              sync
                            </span>
                          )}
                          {efectivoEstado === 'fallido' && (
                            <>
                              <span className="font-semibold text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded text-[10px] uppercase tracking-wide">
                                sigma!
                              </span>
                              {!readonly && serverCambio && (
                                <span className="text-red-600">· editá para reintentar</span>
                              )}
                            </>
                          )}
                          {efectivoEstado === 'bloqueado' && (
                            <span className="font-semibold text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded text-[10px] uppercase tracking-wide">
                              bloq
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
                )}
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
