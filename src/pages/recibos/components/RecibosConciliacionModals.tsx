// src/components/modals/RecibosConciliacionModals.tsx

import React, { useState } from "react";
import { X, AlertTriangle, Check, Ban, Copy } from "lucide-react";
import { useModalEscClose } from "@/hooks/useModalEscClose";
import { useDraggable } from "@/hooks/useDraggable";

export interface MatchCandidate {
  id: number;
  operacion: string;
  documento: string;
  importe: number;
  fecha: string;
}

interface MultiProps {
  data: {
    recibo: {
      valorId: number;
      codigo: string;
      clienteId: string;
      documento: string;
      monto: number;
      observacion?: string | null;
      chofer?: string;
    };
    candidatos: MatchCandidate[];
  };

  // ✔ Se elimina "conciliado", ahora retorna un objeto plano
  onSelect: (value: {
    valorId: number;
    extractoId: number;
    operacion: string;
    documento: string;
    importe: number;
    tipoCobro: string;
  } | null) => void;

  onClose: () => void;
}

export const RecibosConciliacionModalMulti: React.FC<MultiProps> = ({
  data,
  onSelect,
  onClose,
}) => {
  useModalEscClose(!!data, onClose);
  const { style, handleProps } = useDraggable(!!data);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  if (!data) return null;

  const { recibo, candidatos } = data;

  const copiar = (campo: string, valor: string) => {
    navigator.clipboard.writeText(valor).then(() => {
      setCopiedField(campo);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div style={style} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div {...handleProps} className="mb-4">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <AlertTriangle className="text-yellow-500 w-5 h-5" />
            Múltiples coincidencias encontradas
          </h2>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {recibo.chofer && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-xs">Chofer:</span>
                <span className="font-medium text-slate-800">{recibo.chofer}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-xs">Documento:</span>
              <span className="font-medium text-slate-800">{recibo.documento}</span>
              <button
                type="button"
                title="Copiar"
                onClick={() => copiar("documento", recibo.documento)}
                className="text-slate-400 hover:text-blue-600 transition-colors"
              >
                {copiedField === "documento"
                  ? <Check className="w-3.5 h-3.5 text-green-500" />
                  : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {recibo.observacion && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-xs">Observación:</span>
                <span className="font-medium text-slate-800">{recibo.observacion}</span>
                <button
                  type="button"
                  title="Copiar"
                  onClick={() => copiar("observacion", recibo.observacion!)}
                  className="text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {copiedField === "observacion"
                    ? <Check className="w-3.5 h-3.5 text-green-500" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-xs">Monto:</span>
              <span className="font-semibold text-slate-900">
                {recibo.monto.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
              </span>
            </div>
          </div>
        </div>

        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="border px-2 py-1 text-left">Operación</th>
              <th className="border px-2 py-1 text-left">Documento</th>
              <th className="border px-2 py-1 text-right">Importe</th>
              <th className="border px-2 py-1 text-center">Elegir</th>
            </tr>
          </thead>
          <tbody>
            {candidatos.map((c) => (
              <tr key={c.id} className="hover:bg-blue-50">
                <td className="border px-2 py-1">{c.operacion}</td>
                <td className="border px-2 py-1">{c.documento}</td>
                <td className="border px-2 py-1 text-right">
                  {c.importe.toLocaleString("es-AR", {
                    style: "currency",
                    currency: "ARS",
                  })}
                </td>
                <td className="border px-2 py-1 text-center">
                  <button
                    onClick={() =>
                      onSelect({
                        valorId: recibo.valorId,
                        extractoId: c.id,
                        operacion: c.operacion,
                        documento: c.documento,
                        importe: c.importe,
                        tipoCobro: recibo.codigo,
                      })
                    }
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 text-right">
          <button
            onClick={() => onSelect(null)}
            className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm"
          >
            <Ban className="w-4 h-4" /> Ignorar coincidencia
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------

interface DesvincularProps {
  open: boolean;
  operacion?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const RecibosConciliacionModalDesvincular: React.FC<DesvincularProps> = ({
  open,
  operacion,
  onConfirm,
  onClose,
}) => {
  useModalEscClose(open, onClose);
  const { style, handleProps } = useDraggable(open);
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div style={style} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md text-center relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
        >
          <X className="w-5 h-5" />
        </button>

        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />

        <h3 {...handleProps} className="text-lg font-semibold mb-2">¿Desvincular conciliación?</h3>

        <p className="text-sm text-gray-600 mb-4">
          Esto eliminará la asociación con la operación{" "}
          <strong>{operacion || "sin nombre"}</strong>.
        </p>

        <div className="flex justify-center gap-3">
          <button
            onClick={onConfirm}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Desvincular
          </button>
          <button
            onClick={onClose}
            className="bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
