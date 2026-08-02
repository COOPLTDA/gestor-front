import React from "react";
import { Info } from "lucide-react";

type Props = {
  text: string;
  position?: "top" | "left" | "right";
  width?: string;
};

export function InfoTooltip({ text, position = "top", width = "w-56" }: Props) {
  const posClass =
    position === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
      : position === "left"
      ? "right-full top-1/2 -translate-y-1/2 mr-2"
      : "left-full top-1/2 -translate-y-1/2 ml-2";

  const arrowClass =
    position === "top"
      ? "top-full left-1/2 -translate-x-1/2 border-t-gray-900"
      : position === "left"
      ? "top-1/2 -translate-y-1/2 left-full border-l-gray-900"
      : "top-1/2 -translate-y-1/2 right-full border-r-gray-900";

  return (
    <span className="relative group inline-flex items-center ml-1 align-middle">
      <Info className="w-3.5 h-3.5 text-gray-300 hover:text-blue-400 cursor-help transition-colors" />
      <span
        className={`absolute z-50 ${width} bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5
          opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
          shadow-xl leading-relaxed ${posClass}`}
      >
        {text}
        <span className={`absolute border-4 border-transparent ${arrowClass}`} />
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Definiciones centralizadas para reutilizar en toda la pantalla
// ─────────────────────────────────────────────────────────────
export const DEFINICIONES = {
  puntualidad:
    "Porcentaje de vendedores que realizaron su primer check-in válido antes del horario límite establecido. Refleja la disciplina de inicio de jornada.",
  eficiencia:
    "Relación entre check-ins válidos e inválidos. Un check-in es válido cuando el vendedor está dentro del radio del cliente y el GPS es auténtico (no simulado).",
  horaPromedio:
    "Promedio horario al que los vendedores realizan su primer check-in del día. Indica qué tan temprano arranca la fuerza de ventas en el campo.",
  totalCheckins:
    "Suma de todos los check-ins registrados en el período, incluyendo válidos e inválidos.",
  checkinValido:
    "Un check-in es válido cuando cumple tres condiciones: el vendedor está dentro del radio geográfico del cliente, el GPS es auténtico (sin mock location) y la señal GPS fue encontrada.",
  motivosInvalidez:
    "Causas por las que un check-in es rechazado: OUT_OF_PDV_ZONE (fuera del radio del cliente), MOCK_LOCATION (GPS simulado), GPS_NOT_FOUND (sin señal GPS), TIMEOUT (tiempo de espera excedido).",
  fueraDeRuta:
    "Check-ins realizados en clientes que NO estaban en la cartera asignada para ese día de la semana.",
  cobertura:
    "Porcentaje de clientes asignados para el día que fueron efectivamente visitados con al menos un check-in válido.",
  duracionPromedio:
    "Tiempo promedio en minutos que los vendedores permanecen en cada cliente, calculado entre el check-in y el check-out.",
  sinActividad:
    "El vendedor está activo en el sistema pero aún no registró ningún check-in para la fecha seleccionada.",
} as const;
