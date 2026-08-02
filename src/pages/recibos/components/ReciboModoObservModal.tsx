import React, { useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { useModalEscClose } from "@/hooks/useModalEscClose";
import { useDraggable } from "@/hooks/useDraggable";

export type ModoObservacion = "sin_cambios" | "sin_texto";

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: (modo: ModoObservacion) => void;
}

const ReciboModoObservModal: React.FC<Props> = ({ open, onCancel, onConfirm }) => {
  const [modo, setModo] = useState<ModoObservacion>("sin_cambios");

  useModalEscClose(open, onCancel);
  const { style, handleProps } = useDraggable(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div style={style} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">

        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div {...handleProps} className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold">Oper. conc. =&gt; Observ.</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">Seleccioná cómo copiar la operación conciliada:</p>

        <div className="flex flex-col gap-3 mb-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name="modoObserv"
              value="sin_cambios"
              checked={modo === "sin_cambios"}
              onChange={() => setModo("sin_cambios")}
              className="mt-0.5 accent-amber-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Copiar sin cambios</span>
              <p className="text-xs text-gray-500 mt-0.5">Copia la operación tal como está.</p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name="modoObserv"
              value="sin_texto"
              checked={modo === "sin_texto"}
              onChange={() => setModo("sin_texto")}
              className="mt-0.5 accent-amber-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Copiar sin texto</span>
              <p className="text-xs text-gray-500 mt-0.5">
                Solo conserva el valor numérico final.<br />
                <span className="text-gray-400">Ej: "TRANSF BCO 92398273892" → "92398273892"</span>
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(modo)}
            className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReciboModoObservModal;
