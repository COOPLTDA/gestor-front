import React from "react";
import { FiltroPill } from "@/components/ui/FiltroPill";

const OPCIONES_CONCILIACION = ["conciliado", "no conciliado"];

interface Props {
  tipos: string[];
  empresas: string[];
  divisiones: string[];
  estados: string[];

  filtroTipo: Set<string>;
  filtroEmpresa: Set<string>;
  filtroDivision: Set<string>;
  filtroEstado: Set<string>;
  filtroConciliacion: Set<string>;

  setFiltroTipo: (s: Set<string>) => void;
  setFiltroEmpresa: (s: Set<string>) => void;
  setFiltroDivision: (s: Set<string>) => void;
  setFiltroEstado: (s: Set<string>) => void;
  setFiltroConciliacion: (s: Set<string>) => void;
}

export default function RecibosFiltros({
  tipos,
  empresas,
  divisiones,
  estados,
  filtroTipo,
  filtroEmpresa,
  filtroDivision,
  filtroEstado,
  filtroConciliacion,
  setFiltroTipo,
  setFiltroEmpresa,
  setFiltroDivision,
  setFiltroEstado,
  setFiltroConciliacion,
}: Props) {
  /**
   * 🔥 FUNCIÓN PRINCIPAL DE TOGGLE (REEMPLAZADA)
   * Ahora:
   *  - Si se toca "TODOS"/"TODAS": se seleccionan todas las opciones
   *  - Si se toca un valor individual: toggle normal
   */
  const toggle = (
    setFn: (s: Set<string>) => void,
    currentSet: Set<string>,
    key: string,
    allKey: string,
    allValues: string[]
  ) => {
    // Caso especial: seleccionar TODOS/TODAS
    if (key === allKey) {
      // Selecciona todas las opciones disponibles
      const newSet = new Set([allKey, ...allValues]);
      setFn(newSet);
      return;
    }

    // Toggle normal para valores individuales
    const next = new Set(currentSet);
    next.delete(allKey); // si tocás un valor, sacamos "TODOS"

    if (next.has(key)) next.delete(key);
    else next.add(key);

    if (next.size === 0) {
      // Si saca todo, vuelve a "TODOS"
      next.add(allKey);
    }

    setFn(next);
  };

  return (
    <div className="flex flex-col gap-3">

      {/* TIPO COBRO */}
      <div className="flex items-start gap-3">
        <h4 className="text-xs font-semibold text-gray-600 w-28 pt-1">
          Tipo cobro:
        </h4>

        <div className="flex flex-wrap gap-2">
          <FiltroPill
            label="TODOS"
            active={filtroTipo.has("TODOS")}
            onToggle={() =>
              toggle(setFiltroTipo, filtroTipo, "TODOS", "TODOS", tipos)
            }
          />

          {tipos.map((v) => (
            <FiltroPill
              key={v}
              label={v}
              active={filtroTipo.has(v)}
              onToggle={() =>
                toggle(setFiltroTipo, filtroTipo, v, "TODOS", tipos)
              }
            />
          ))}
        </div>
      </div>

      {/* EMPRESA */}
      <div className="flex items-start gap-3">
        <h4 className="text-xs font-semibold text-gray-600 w-28 pt-1">
          Empresa:
        </h4>

        <div className="flex flex-wrap gap-2">
          <FiltroPill
            label="TODAS"
            active={filtroEmpresa.has("TODAS")}
            onToggle={() =>
              toggle(setFiltroEmpresa, filtroEmpresa, "TODAS", "TODAS", empresas)
            }
          />

          {empresas.map((v) => (
            <FiltroPill
              key={v}
              label={v}
              active={filtroEmpresa.has(v)}
              onToggle={() =>
                toggle(setFiltroEmpresa, filtroEmpresa, v, "TODAS", empresas)
              }
            />
          ))}
        </div>
      </div>

      {/* DIVISIÓN */}
      <div className="flex items-start gap-3">
        <h4 className="text-xs font-semibold text-gray-600 w-28 pt-1">
          División:
        </h4>

        <div className="flex flex-wrap gap-2">
          <FiltroPill
            label="TODAS"
            active={filtroDivision.has("TODAS")}
            onToggle={() =>
              toggle(
                setFiltroDivision,
                filtroDivision,
                "TODAS",
                "TODAS",
                divisiones
              )
            }
          />

          {divisiones.map((v) => (
            <FiltroPill
              key={v}
              label={v}
              active={filtroDivision.has(v)}
              onToggle={() =>
                toggle(setFiltroDivision, filtroDivision, v, "TODAS", divisiones)
              }
            />
          ))}
        </div>
      </div>

      {/* ESTADO */}
      <div className="flex items-start gap-3">
        <h4 className="text-xs font-semibold text-gray-600 w-28 pt-1">
          Estado:
        </h4>

        <div className="flex flex-wrap gap-2">
          <FiltroPill
            label="TODOS"
            active={filtroEstado.has("TODOS")}
            onToggle={() =>
              toggle(setFiltroEstado, filtroEstado, "TODOS", "TODOS", estados)
            }
          />

          {estados.map((v) => (
            <FiltroPill
              key={v}
              label={v}
              active={filtroEstado.has(v)}
              colorClass={
                v === "pendiente"
                  ? "bg-yellow-300 text-black border-yellow-500"
                  : v === "enviado"
                  ? "bg-green-400 text-black border-green-600"
                  : "bg-red-400 text-white border-red-600"
              }
              onToggle={() =>
                toggle(setFiltroEstado, filtroEstado, v, "TODOS", estados)
              }
            />
          ))}
        </div>
      </div>

      {/* CONCILIACIÓN */}
      <div className="flex items-start gap-3">
        <h4 className="text-xs font-semibold text-gray-600 w-28 pt-1">
          Conciliación:
        </h4>

        <div className="flex flex-wrap gap-2">
          <FiltroPill
            label="TODOS"
            active={filtroConciliacion.has("TODOS")}
            onToggle={() =>
              toggle(setFiltroConciliacion, filtroConciliacion, "TODOS", "TODOS", OPCIONES_CONCILIACION)
            }
          />

          {OPCIONES_CONCILIACION.map((v) => (
            <FiltroPill
              key={v}
              label={v}
              active={filtroConciliacion.has(v)}
              colorClass={
                v === "conciliado"
                  ? "bg-blue-300 text-blue-900 border-blue-500"
                  : "bg-orange-200 text-orange-900 border-orange-400"
              }
              onToggle={() =>
                toggle(setFiltroConciliacion, filtroConciliacion, v, "TODOS", OPCIONES_CONCILIACION)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
