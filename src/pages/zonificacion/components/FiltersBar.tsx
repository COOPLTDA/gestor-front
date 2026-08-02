import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { diaLabel } from '../lib/colors';
import { SIN_DATO, SIN_DATO_LABEL } from '../lib/filters';
import { FILTROS_VACIOS, type Articulo, type Filtros } from '../types';
import type { RangoVentas } from '@/services/zonificacionApi';

// Port de los filtros del header (líneas 106-146, 335-393 del HTML original). A diferencia
// del original —donde Rubro/Partido/Frecuencia/Búsqueda requerían tocar "Filtrar" y sólo
// Día/Vendedor aplicaban al instante—, acá todos aplican al instante: es más consistente
// y no hay motivo de performance para no hacerlo con el volumen de datos de este módulo.
// Los selects son multi-selección con checkbox (en vez de un solo valor), para poder
// filtrar por ej. "Lunes y Jueves" o "dos proveedores" a la vez.
//
// Dos filas para no saturar una sola línea ahora que hay 9 filtros: la primera son los
// atributos del cliente/PDV (los que ya existían), la segunda los de producto comprado
// (proveedor/división/línea/artículo, en el rango de fechas elegido — ver pdvService). El colapso
// completo de esta barra lo maneja el padre (ZonificacionPage) sin montarla — el botón
// para mostrarla/ocultarla vive flotando sobre el mapa, igual que los de los paneles.

const DIAS = [1, 2, 3, 4, 5, 6, 7, 0].map((d) => ({ value: String(d), label: diaLabel(d) }));

interface Vendedor {
  cod: string;
  nombre: string | null;
}

export interface ExcluidoInfo {
  id: string;
  n: string;
}

interface FiltersBarProps {
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  rubros: string[];
  partidos: string[];
  frecuencias: string[];
  vendedores: Vendedor[];
  proveedores: string[];
  divisiones: string[];
  lineas: string[];
  articulos: Articulo[];
  totalMostrado: number;
  excluidos: ExcluidoInfo[];
  onReincluir: (id: string) => void;
  onRestaurarExcluidos: () => void;
  rangoVentas: RangoVentas;
  onChangeRangoVentas: (rango: RangoVentas) => void;
}

const ACTIVO_OPTIONS: { value: Filtros['activo']; label: string }[] = [
  { value: 'activos', label: 'Activos' },
  { value: 'desactivados', label: 'Desactivados' },
  { value: 'todos', label: 'Todos' },
];

export function FiltersBar({
  filtros, onChange, rubros, partidos, frecuencias, vendedores,
  proveedores, divisiones, lineas, articulos, totalMostrado,
  excluidos, onReincluir, onRestaurarExcluidos,
  rangoVentas, onChangeRangoVentas,
}: FiltersBarProps) {
  function set<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    onChange({ ...filtros, [key]: value });
  }

  function handleLimpiar() {
    onChange(FILTROS_VACIOS);
    onRestaurarExcluidos();
  }

  const vendedorOptions = vendedores.map((v) => ({
    value: v.cod,
    label: v.cod === SIN_DATO ? SIN_DATO_LABEL : v.nombre ? `${v.cod} - ${v.nombre}` : v.cod,
  }));
  const rubroOptions = rubros.map((r) => ({ value: r, label: r === SIN_DATO ? SIN_DATO_LABEL : r }));
  const partidoOptions = partidos.map((p) => ({ value: p, label: p }));
  const frecuenciaOptions = frecuencias.map((f) => ({ value: f, label: f === SIN_DATO ? SIN_DATO_LABEL : f }));
  const proveedorOptions = proveedores.map((p) => ({ value: p, label: p === SIN_DATO ? SIN_DATO_LABEL : p }));
  const divisionOptions = divisiones.map((d) => ({ value: d, label: d === SIN_DATO ? SIN_DATO_LABEL : d }));
  const lineaOptions = lineas.map((l) => ({ value: l, label: l === SIN_DATO ? SIN_DATO_LABEL : l }));
  const articuloOptions = articulos.map((a) => ({ value: a.id, label: a.nombre }));

  return (
    <div className="flex flex-col gap-2 border-b bg-white px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <FilterField label="Día visita">
          <MultiSelect options={DIAS} selected={filtros.dia} onChange={(v) => set('dia', v)} />
        </FilterField>

        <FilterField label="Vendedor">
          <MultiSelect options={vendedorOptions} selected={filtros.vndCod} onChange={(v) => set('vndCod', v)} />
        </FilterField>

        <FilterField label="Tipo PDV">
          <MultiSelect options={rubroOptions} selected={filtros.comercio} onChange={(v) => set('comercio', v)} />
        </FilterField>

        <FilterField label="Partido">
          <MultiSelect options={partidoOptions} selected={filtros.partido} onChange={(v) => set('partido', v)} />
        </FilterField>

        <FilterField label="Frecuencia">
          <MultiSelect options={frecuenciaOptions} selected={filtros.frecuencia} onChange={(v) => set('frecuencia', v)} />
        </FilterField>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500">Buscar:</span>
          <Input
            className="h-8 w-40"
            placeholder="Nombre / dirección..."
            value={filtros.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </div>

        <FilterField label="Activo">
          <div className="flex overflow-hidden rounded-md border">
            {ACTIVO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`px-2 py-1 text-xs ${filtros.activo === opt.value ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                onClick={() => set('activo', opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FilterField>

        <Button variant="ghost" size="sm" onClick={handleLimpiar}>
          Limpiar
        </Button>

        <ExcludedPdvControl excluidos={excluidos} onReincluir={onReincluir} onRestaurarTodos={onRestaurarExcluidos} />

        <span className="ml-auto text-xs text-slate-500">
          Mostrando: <b className="text-slate-700">{totalMostrado.toLocaleString('es-AR')}</b> puntos
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase text-slate-400 whitespace-nowrap">Ventas/Compras:</span>

        <FilterField label="Desde">
          <Input
            type="date"
            className="h-8 w-36"
            value={rangoVentas.desde}
            max={rangoVentas.hasta}
            onChange={(e) => onChangeRangoVentas({ ...rangoVentas, desde: e.target.value })}
          />
        </FilterField>

        <FilterField label="Hasta">
          <Input
            type="date"
            className="h-8 w-36"
            value={rangoVentas.hasta}
            min={rangoVentas.desde}
            onChange={(e) => onChangeRangoVentas({ ...rangoVentas, hasta: e.target.value })}
          />
        </FilterField>

        <FilterField label="Facturación">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              inputMode="decimal"
              className="h-8 w-24"
              placeholder="0"
              value={filtros.facturacionMin ?? ''}
              onChange={(e) => set('facturacionMin', e.target.value === '' ? null : Number(e.target.value))}
            />
            <span className="text-xs text-slate-400">–</span>
            <Input
              type="number"
              inputMode="decimal"
              className="h-8 w-24"
              placeholder="Sin tope"
              value={filtros.facturacionMax ?? ''}
              onChange={(e) => set('facturacionMax', e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
        </FilterField>

        <FilterField label="Proveedor">
          <MultiSelect options={proveedorOptions} selected={filtros.proveedor} onChange={(v) => set('proveedor', v)} />
        </FilterField>

        <FilterField label="División">
          <MultiSelect options={divisionOptions} selected={filtros.division} onChange={(v) => set('division', v)} />
        </FilterField>

        <FilterField label="Línea">
          <MultiSelect options={lineaOptions} selected={filtros.linea} onChange={(v) => set('linea', v)} />
        </FilterField>

        <FilterField label="Artículo">
          <MultiSelect options={articuloOptions} selected={filtros.articulo} onChange={(v) => set('articulo', v)} />
        </FilterField>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{label}:</span>
      {children}
    </div>
  );
}

interface ExcludedPdvControlProps {
  excluidos: ExcluidoInfo[];
  onReincluir: (id: string) => void;
  onRestaurarTodos: () => void;
}

// PDV que el usuario sacó a mano desde el cartelito ("Excluir PDV") — se muestra como un
// filtro más acá en vez de en el panel lateral, con la lista y la forma de deshacerlo.
function ExcludedPdvControl({ excluidos, onReincluir, onRestaurarTodos }: ExcludedPdvControlProps) {
  const [open, setOpen] = useState(false);

  if (excluidos.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-normal">
          Excluidos: {excluidos.length}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-slate-500">PDV excluidos</span>
          <button
            type="button"
            className="text-[11px] text-violet-600 underline hover:text-violet-800"
            onClick={onRestaurarTodos}
          >
            Restaurar todos
          </button>
        </div>
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {excluidos.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-1 rounded bg-slate-100 px-2 py-1 text-xs">
              <span className="truncate" title={p.n}>{p.id} - {p.n}</span>
              <button
                type="button"
                title="Volver a incluir"
                className="shrink-0 text-slate-400 hover:text-red-600"
                onClick={() => onReincluir(p.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
