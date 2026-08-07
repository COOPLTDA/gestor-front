// src/components/modals/RecibosTransmitirHDR.tsx

import React, { useState, useMemo, useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import type { ReciboValor } from "./RecibosTabla";
import { useDraggable } from "@/hooks/useDraggable";

interface Props {
  open: boolean;
  onClose: () => void;
  hojaRuta: string;
  seleccionados: Set<number>;
  rows: ReciboValor[];
  onTerminado: (reset: boolean, transmittedValorIds?: number[]) => void;
}

const RecibosTransmitirHDR: React.FC<Props> = ({
  open,
  onClose,
  hojaRuta,
  seleccionados,
  rows,
  onTerminado,
}) => {
  const { toast } = useToast();
  const { dialogStyle, handleProps } = useDraggable(open);

  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<
    { recibo: string; ok: boolean; mensaje: string }[]
  >([]);

  // ---------------------------------------------------------------
  // ORDENAMIENTO PREVIEW (ANTES DE PREVIEW)
  // ---------------------------------------------------------------
  const [sortCol, setSortCol] = useState<keyof ReciboValor | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (col: keyof ReciboValor) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    }
  };

  // ---------------------------------------------------------------
  // RESET INTERNO CUANDO SE ABRE EL MODAL
  // ---------------------------------------------------------------
  useEffect(() => {
    if (open) {
      setResultado([]);
      setEnviando(false);
      setSortCol(null);
      setSortDir("asc");
    }
  }, [open]);

  // ---------------------------------------------------------------
  // PREVIEW ORDENADO
  // ---------------------------------------------------------------
  const preview = useMemo(() => {
    const datos = rows.filter((r) => seleccionados.has(r.valorId));
    if (!sortCol) return datos;

    return [...datos].sort((a, b) => {
      let x = a[sortCol];
      let y = b[sortCol];

      if (sortCol === "monto") {
        x = Number(x);
        y = Number(y);
      }

      if (x < y) return sortDir === "asc" ? -1 : 1;
      if (x > y) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, seleccionados, sortCol, sortDir]);

  // ---------------------------------------------------------------
  // EJECUTAR TRANSMISIÓN
  // ---------------------------------------------------------------
  const ejecutarTransmision = async () => {
    setEnviando(true);
    setResultado([]);
  
    const valoresSeleccionados = rows.filter(
      (r) =>
        seleccionados.has(r.valorId) &&
        (r.estado === "pendiente" || r.estado === "error")
    );
  
    if (!valoresSeleccionados.length) {
      toast({
        variant: "destructive",
        title: "Sin registros válidos",
        description: "No se pueden transmitir valores enviados.",
      });
      setEnviando(false);
      return;
    }
  
    const cobranzasIds = Array.from(
      new Set(valoresSeleccionados.map((v) => v.cobranzaId))
    );
  
    try {
      const res = await fetchWithAuth("/api/gestor/erp/transmitirHDR", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hojaRuta,
          cobranzas: cobranzasIds,
        }),
      });
  
      const json: {
        success: boolean;
        okCount: number;
        errorCount: number;
        estadoHDR: string;
        message?: string;
        detalles?: {
          cobranzaId: number;
          estado: "enviado" | "error";
          mensaje: string;
        }[];
      } = await res.json();
  
      // ================================
      // TIPADO CORRECTO
      // ================================
      const results: { recibo: string; ok: boolean; mensaje: string }[] = [];
  
      cobranzasIds.forEach((cid) => {
        const detalle = json.detalles?.find(
          (d: { cobranzaId: number }) => d.cobranzaId === cid
        );
  
        const filasAsociadas = valoresSeleccionados.filter(
          (x) => x.cobranzaId === cid
        );
  
        filasAsociadas.forEach((fila) => {
          results.push({
            recibo: fila.recibo,
            ok: detalle?.estado === "enviado",
            mensaje: detalle?.mensaje || json.message || "Sin detalle",
          });
        });
      });
  
      setResultado(results);
  
      toast({
        title: "Transmisión finalizada",
        description: `${json.okCount} enviados, ${json.errorCount} errores.`,
      });
  
      const transmittedValorIds = valoresSeleccionados.map((v) => v.valorId);
      onTerminado(json.estadoHDR === "procesada", transmittedValorIds);
    } catch (err) {
      const e = err as Error;

      const fallbackResults = rows
        .filter((r) => seleccionados.has(r.valorId))
        .map((p) => ({
          recibo: p.recibo,
          ok: false,
          mensaje: e.message || "Error inesperado",
        }));

      setResultado(fallbackResults);

      toast({
        variant: "destructive",
        title: "Error inesperado durante la transmisión",
      });

      const transmittedValorIds = valoresSeleccionados.map((v) => v.valorId);
      onTerminado(false, transmittedValorIds);
    }
  
    setEnviando(false);
  };

  // ---------------------------------------------------------------
  // RENDER DEL MODAL
  // ---------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl" style={dialogStyle}>
        <DialogHeader {...handleProps}>
          <DialogTitle>Transmitir recibos completos a ERP</DialogTitle>
        </DialogHeader>

        {/* ================= PREVIEW ANTES DE TRANSMITIR ================= */}
        {!resultado.length && !enviando && (
          <>
            <p className="text-gray-600 text-sm mb-3">
              Se transmitirán las <b>cobranzas completas</b> asociadas a:
            </p>

            <div className="border rounded-lg max-h-64 overflow-auto bg-gray-50">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 sticky top-0 text-gray-700">
                  <tr>
                    <th
                      className="px-3 py-2 border cursor-pointer"
                      onClick={() => toggleSort("empresa_nombre")}
                    >
                      Empresa{" "}
                      {sortCol === "empresa_nombre"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="px-3 py-2 border cursor-pointer"
                      onClick={() => toggleSort("empresa_division")}
                    >
                      División{" "}
                      {sortCol === "empresa_division"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="px-3 py-2 border cursor-pointer"
                      onClick={() => toggleSort("clienteId")}
                    >
                      Cliente{" "}
                      {sortCol === "clienteId"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="px-3 py-2 border cursor-pointer"
                      onClick={() => toggleSort("recibo")}
                    >
                      Recibo{" "}
                      {sortCol === "recibo"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="px-3 py-2 border cursor-pointer"
                      onClick={() => toggleSort("codigo")}
                    >
                      Tipo{" "}
                      {sortCol === "codigo"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="px-3 py-2 border text-right cursor-pointer"
                      onClick={() => toggleSort("monto")}
                    >
                      Importe{" "}
                      {sortCol === "monto"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {preview.map((p) => (
                    <tr key={p.valorId} className="hover:bg-gray-100">
                      <td className="px-3 py-2">{p.empresa_nombre}</td>
                      <td className="px-3 py-2">{p.empresa_division}</td>
                      <td className="px-3 py-2">{p.clienteId}</td>
                      <td className="px-3 py-2">{p.recibo}</td>
                      <td className="px-3 py-2">{p.codigo}</td>
                      <td className="px-3 py-2 text-right">
                        {p.monto.toLocaleString("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ================= ESTADO ENVIANDO ================= */}
        {enviando && (
          <div className="flex flex-col items-center py-6">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
            <p className="mt-3 text-gray-600">Transmitiendo…</p>
          </div>
        )}

        {/* ================= RESULTADO POST TRANSMISIÓN ================= */}
        {!enviando && resultado.length > 0 && (
          <div className="max-h-80 overflow-auto border rounded-lg p-3 bg-gray-50">
            {resultado.map((r, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1 border-b last:border-0"
              >
                <span className="text-sm text-gray-700">
                  Recibo <b>{r.recibo}</b>
                </span>

                {r.ok ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="w-4 h-4" /> {r.mensaje}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600">
                    <X className="w-4 h-4" /> {r.mensaje}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {!resultado.length ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>

              <Button onClick={ejecutarTransmision} disabled={enviando}>
                Transmitir
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                setResultado([]);
                onClose();
              }}
            >
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecibosTransmitirHDR;
