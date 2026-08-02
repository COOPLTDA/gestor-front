import React from "react";
import { X, AlertTriangle } from "lucide-react";
import { useModalEscClose } from "@/hooks/useModalEscClose";
import { useDraggable } from "@/hooks/useDraggable";

interface Props {
  open: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<Props> = ({
  open,
  title = "Confirmar acción",
  message,
  onConfirm,
  onCancel,
}) => {
  useModalEscClose(open, onCancel);
  const { style, handleProps } = useDraggable(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div style={style} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">

        {/* Botón cerrar */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div {...handleProps} className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600" />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>

        {/* Mensaje */}
        <p className="text-gray-700 mb-6">{message}</p>

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
