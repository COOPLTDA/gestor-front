import React from "react";
import { Calendar, Globe2, Users, Activity } from "lucide-react";
import type { Zona, VendedorInfo } from "../Fichajes";
import { MultiSelectDropdown } from "./MultiSelectDropdown";

const ESTADOS = [
  { id: "a_tiempo",      nombre: "A tiempo" },
  { id: "tarde",         nombre: "Tarde" },
  { id: "sin_actividad", nombre: "Sin actividad" },
];

type Props = {
  fecha: string;
  zona: string[];
  supervisor: string[];
  vendedor: string[];
  estado: string[];
  zonas: Zona[];
  supervisores: Zona[];
  vendedores: VendedorInfo[];
  loading: boolean;
  mostrarSupervisor?: boolean;
  onFechaChange:      (v: string)   => void;
  onZonaChange:       (v: string[]) => void;
  onSupervisorChange: (v: string[]) => void;
  onVendedorChange:   (v: string[]) => void;
  onEstadoChange:     (v: string[]) => void;
};

export function FichajesFiltros({
  fecha, zona, supervisor, vendedor, estado,
  zonas, supervisores, vendedores, loading,
  mostrarSupervisor = true,
  onFechaChange, onZonaChange, onSupervisorChange, onVendedorChange, onEstadoChange,
}: Props) {

  // Cascading: vendedores filtrados según zona y supervisor seleccionados
  // Supervisor no cascadea por zona (un supervisor puede tener vendedores en múltiples zonas)
  const vendedoresFiltrados = vendedores
    .filter(v =>
      (zona.length === 0 || zona.includes(v.zona)) &&
      (supervisor.length === 0 || supervisor.includes(v.supervisorId))
    )
    .map(v => ({ id: v.id, nombre: v.nombre || `${v.id} - ` }));

  return (
    <div className="flex flex-wrap gap-2 items-center">

      {/* Fecha */}
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="date"
          value={fecha}
          onChange={(e) => onFechaChange(e.target.value)}
          className="border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-gray-700 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
        />
      </div>

      {/* Zona */}
      <MultiSelectDropdown
        placeholder="Todas las zonas"
        options={zonas}
        selected={zona}
        onChange={onZonaChange}
        icon={Globe2}
        width="min-w-[155px]"
      />

      {/* Supervisor */}
      {mostrarSupervisor && (
        <MultiSelectDropdown
          placeholder="Todos los supervisores"
          options={supervisores}
          selected={supervisor}
          onChange={onSupervisorChange}
          icon={Users}
          width="min-w-[175px]"
        />
      )}

      {/* Vendedor — restringido por zona + supervisor */}
      <MultiSelectDropdown
        placeholder="Todos los vendedores"
        options={vendedoresFiltrados}
        selected={vendedor}
        onChange={onVendedorChange}
        icon={Users}
        width="min-w-[175px]"
      />

      {/* Estado */}
      <MultiSelectDropdown
        placeholder="Todos los estados"
        options={ESTADOS}
        selected={estado}
        onChange={onEstadoChange}
        icon={Activity}
        width="min-w-[155px]"
      />

      {/* Indicador de carga */}
      {loading && (
        <div className="flex items-center gap-1.5 text-blue-500 text-xs">
          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      )}
    </div>
  );
}
