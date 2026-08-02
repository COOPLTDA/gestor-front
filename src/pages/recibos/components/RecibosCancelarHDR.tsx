// src/components/modals/RecibosCancelarHDR.tsx
import React, { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDraggable } from "@/hooks/useDraggable";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { fetchWithAuth } from "@/utils/fetchWithAuth";

interface Props {
  open: boolean;
  onClose: () => void;
  hojaRutas: string[];
  onTerminado: () => void;
}

const RecibosCancelarHDR: React.FC<Props> = ({
  open,
  onClose,
  hojaRutas,
  onTerminado,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { dialogStyle, handleProps } = useDraggable(open);

  const cancelarHDR = async () => {
    setLoading(true);

    try {
      let errores = 0;

      for (const hojaRuta of hojaRutas) {
        const res = await fetchWithAuth("/api/distrigestion/erp/cancelarHDR", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hojaRuta }),
        });
        const json = await res.json();
        if (!json.success) errores++;
      }

      if (errores === 0) {
        toast({
          title: hojaRutas.length > 1 ? "HDR cerradas" : "HDR cerrada",
          description:
            hojaRutas.length > 1
              ? `Se cerraron ${hojaRutas.length} hojas de ruta correctamente.`
              : `La hoja de ruta ${hojaRutas[0]} fue cerrada correctamente.`,
        });
        onTerminado();
      } else {
        toast({
          variant: "destructive",
          title: "Error parcial",
          description: `${errores} de ${hojaRutas.length} HDR no pudieron cerrarse.`,
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error inesperado",
        description: "No se pudo cerrar la Hoja de Ruta.",
      });
    }

    setLoading(false);
    onClose();
  };

  const listaHDR = hojaRutas.join(", ");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" style={dialogStyle}>
        <DialogHeader {...handleProps}>
          <DialogTitle>Cerrar Hoja{hojaRutas.length > 1 ? "s" : ""} de Ruta</DialogTitle>
        </DialogHeader>

        <p className="text-gray-700 text-sm mb-3">
          ¿Estás seguro que querés <b>cerrar</b>{" "}
          {hojaRutas.length > 1
            ? <><b>{hojaRutas.length} hojas de ruta</b>: {listaHDR}</>
            : <><b>la Hoja de Ruta {listaHDR}</b></>
          }?
        </p>

        <p className="text-sm text-red-600 mb-4">
          • Esta acción no elimina los recibos, solo marca la HDR como{" "}
          <b>cancelada, y ya no se pueden transmitir los recibos pendientes o en error</b>.
        </p>

        {loading && (
          <div className="flex flex-col items-center py-4">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            <p className="text-gray-600 mt-2">Cerrando...</p>
          </div>
        )}

        <DialogFooter>
          {!loading && (
            <>
              <Button variant="outline" onClick={onClose}>
                Volver
              </Button>

              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={cancelarHDR}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Cerrar HDR
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecibosCancelarHDR;
