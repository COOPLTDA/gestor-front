import React from "react";

// Modal de confirmación (paso 1)
export const ModalConfirmacion = ({
  open,
  message,
  onCancel,
  onConfirm,
  loading
}: {
  open: boolean,
  message: string,
  onCancel: () => void,
  onConfirm: () => void,
  loading?: boolean
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-2xl px-7 py-8 min-w-[320px] max-w-full flex flex-col items-center gap-7">
        <div className="text-lg font-bold text-center text-gray-900">{message}</div>
        <div className="flex gap-4 justify-center w-full">
          <button
            className="bg-gray-200 hover:bg-gray-300 px-5 py-2 rounded-lg font-medium"
            onClick={onCancel}
            disabled={loading}
          >Cancelar</button>
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium"
            onClick={onConfirm}
            disabled={loading}
          >{loading ? "Enviando..." : "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
};

// Modal de resultado (paso 2, éxito o error)
export const ModalResultado = ({
  open,
  success,
  enviados,
  errores,
  onClose
}: {
  open: boolean,
  success: boolean,
  enviados?: { clienteId: string | number, id_pedido: string | number }[],
  errores?: { clienteId: string | number, id_pedido: string | number, error: string }[],
  onClose: () => void
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-2xl px-7 py-8 min-w-[320px] max-w-[95vw] flex flex-col items-center gap-6">
        <div className={`text-xl font-bold text-center ${success ? "text-green-700" : "text-red-700"}`}>
          {success ? "¡Pedidos enviados correctamente!" : "Error al enviar pedidos"}
        </div>

        {success && enviados && enviados.length > 0 && (
          <div className="w-full text-center">
            <div className="font-semibold text-gray-900 mb-2">
              {`Se enviaron ${enviados.length} pedido(s) al ERP:`}
            </div>
            <ul className="max-h-44 overflow-y-auto text-sm text-gray-700">
              {enviados.map((p, i) => (
                <li key={i} className="py-1 border-b last:border-none">{`Pedido de Cliente: ${p.clienteId} (ID Pedido: ${p.id_pedido})`}</li>
              ))}
            </ul>
          </div>
        )}

        {!success && errores && errores.length > 0 && (
          <div className="w-full text-center">
            <div className="font-semibold text-gray-900 mb-2">
              {`Fallaron ${errores.length} pedido(s):`}
            </div>
            <ul className="max-h-44 overflow-y-auto text-sm text-red-700">
              {errores.map((e, i) => (
                <li key={i} className="py-1 border-b last:border-none">
                  {`El Pedido del Cliente: ${e.clienteId} (ID: ${e.id_pedido}) falló por "${e.error}"`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-3 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
