export const ESTADO_DOT: Record<string, string> = {
  pendiente: 'bg-slate-400',
  'en preparacion': 'bg-amber-400',
  completada: 'bg-emerald-500',
  completo: 'bg-emerald-500',
  remitido: 'bg-sky-500',
  eliminado: 'bg-red-400',
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(value);
}

export const ESTADO_BORDER: Record<string, string> = {
  pendiente: "border-l-slate-400",
  "en preparacion": "border-l-amber-400",
  completada: "border-l-emerald-500",
  completo: "border-l-emerald-500",
  remitido: "border-l-sky-500",
  eliminado: "border-l-red-400",
};

export const TIPO_BG: Record<string, string> = {
  "Pedidos individuales": "bg-amber-100",
  "Agrupa por direccion de entrega": "bg-teal-100",
  "Consolidado de pedidos": "bg-violet-100",
  "Consolidado que luego se va a desconsolidar.": "bg-violet-100",
};
