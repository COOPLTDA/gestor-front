import type { Articulo, Criterios, Filtros, Pdv } from '../types';
import { diaLabel } from './colors';

// Sentinel para "este cliente no tiene valor para este filtro" (sin rubro, sin vendedor
// asignado, no compró nada de esa categoría, etc.). Se ofrece como una opción más ("Sin
// dato") en cada MultiSelect — así "Todos" (que ahora selecciona explícitamente cada
// opción, ver multi-select.tsx) también incluye a esos clientes en vez de excluirlos.
export const SIN_DATO = '__sin_dato__';
export const SIN_DATO_LABEL = 'Sin dato';

function matchesAny(selected: string[], values: string[]): boolean {
  if (selected.length === 0) return true;
  if (values.length === 0) return selected.includes(SIN_DATO);
  return values.some((v) => selected.includes(v));
}

// Port de getFilteredData() (líneas 361-374 del HTML original). Cada filtro es ahora una
// lista de valores seleccionables por checkbox: lista vacía = sin filtro ("Todos"), si no
// hace falta que el dato matchee alguno de los valores seleccionados (OR dentro del filtro,
// AND entre filtros distintos).
export function filterPdv(data: Pdv[], f: Filtros): Pdv[] {
  const search = f.search.toLowerCase().trim();
  const activo = f.activo ?? 'activos';
  return data.filter(
    (d) =>
      (activo === 'todos' || (activo === 'activos' ? !d.desactivado : d.desactivado)) &&
      (f.comercio.length === 0 || f.comercio.includes(d.com ?? SIN_DATO)) &&
      (f.partido.length === 0 || f.partido.includes(d.par)) &&
      (f.frecuencia.length === 0 || f.frecuencia.includes(d.frq ?? SIN_DATO)) &&
      (!search || d.n.toLowerCase().includes(search) || (d.dir || '').toLowerCase().includes(search)) &&
      (f.dia.length === 0 || f.dia.includes(String(d.dia ?? 0))) &&
      // Un cliente puede tener más de un vendedor asignado: matchea si CUALQUIERA coincide;
      // si no tiene ninguno, matchea contra SIN_DATO (ver matchesAny).
      (f.vndCod.length === 0 || (d.vendedores.length === 0 ? f.vndCod.includes(SIN_DATO) : d.vendedores.some((v) => f.vndCod.includes(v.cod)))) &&
      matchesAny(f.proveedor, d.proveedores) &&
      matchesAny(f.division, d.divisiones) &&
      matchesAny(f.linea, d.lineas) &&
      matchesAny(f.articulo, d.articulos.map((a) => a.id)) &&
      (f.facturacionMin == null || d.facturacion >= f.facturacionMin) &&
      (f.facturacionMax == null || d.facturacion <= f.facturacionMax)
  );
}

// Port de populateSelects() (líneas 335-359) — opciones derivadas del universo completo, no del filtrado.
// Antepone SIN_DATO si hay algún cliente sin valor para ese campo.
export function uniqueSorted(data: Pdv[], key: 'com' | 'par' | 'frq'): string[] {
  const values = [...new Set(data.map((p) => p[key]).filter((v): v is string => Boolean(v)))].sort();
  return data.some((p) => !p[key]) ? [SIN_DATO, ...values] : values;
}

// Variante de uniqueSorted para campos que son arrays por cliente (proveedores/divisiones/líneas).
export function uniqueSortedFromList(data: Pdv[], key: 'proveedores' | 'divisiones' | 'lineas'): string[] {
  const set = new Set<string>();
  data.forEach((p) => p[key].forEach((v) => set.add(v)));
  const values = [...set].sort();
  return data.some((p) => p[key].length === 0) ? [SIN_DATO, ...values] : values;
}

export function uniqueArticulos(data: Pdv[]): Articulo[] {
  const map = new Map<string, string>();
  data.forEach((p) => p.articulos.forEach((a) => { if (!map.has(a.id)) map.set(a.id, a.nombre); }));
  const articulos = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, nombre]) => ({ id, nombre }));
  return data.some((p) => p.articulos.length === 0) ? [{ id: SIN_DATO, nombre: SIN_DATO_LABEL }, ...articulos] : articulos;
}

export interface VendedorOption {
  cod: string;
  nombre: string | null;
}

export function uniqueVendedores(data: Pdv[]): VendedorOption[] {
  const map = new Map<string, string | null>();
  data.forEach((p) => {
    p.vendedores.forEach((v) => {
      if (!map.has(v.cod)) map.set(v.cod, v.nombre);
    });
  });
  const vendedores = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cod, nombre]) => ({ cod, nombre }));
  return data.some((p) => p.vendedores.length === 0) ? [{ cod: SIN_DATO, nombre: SIN_DATO_LABEL }, ...vendedores] : vendedores;
}

const FILTRO_LABELS: Record<keyof Omit<Filtros, 'search' | 'activo' | 'facturacionMin' | 'facturacionMax'>, string> = {
  dia: 'Día visita',
  vndCod: 'Vendedor',
  comercio: 'Tipo PDV',
  partido: 'Partido',
  frecuencia: 'Frecuencia',
  proveedor: 'Proveedor',
  division: 'División',
  linea: 'Línea',
  articulo: 'Artículo',
};

function describeValor(valor: string): string {
  return valor === SIN_DATO ? SIN_DATO_LABEL : valor;
}

export interface CriterioLinea {
  /** Vacío para líneas sin etiqueta (ej. "Sin filtros"). */
  label: string;
  value: string;
}

// Resumen legible de los filtros activos al momento de armar una zona — pedido de
// Marcos para que la zona quede trazable: no solo el polígono, sino con qué
// criterio se decidió qué puntos entraban. Devuelve una línea por filtro (en vez de
// un único string) para que la UI pueda poner la etiqueta en negrita y cada una en
// su propio renglón.
export function describeCriterios(c: Criterios | null): CriterioLinea[] {
  if (!c) return [{ label: '', value: 'Sin datos de criterio (zona creada antes de esta función)' }];

  const f = c.filtros;
  const lineas: CriterioLinea[] = [];
  if (f.search.trim()) lineas.push({ label: 'Búsqueda', value: `"${f.search.trim()}"` });
  const activo = f.activo ?? 'activos';
  if (activo !== 'activos') {
    lineas.push({ label: 'Activo', value: activo === 'todos' ? 'Activos y desactivados' : 'Solo desactivados' });
  }
  if (f.facturacionMin != null || f.facturacionMax != null) {
    const min = f.facturacionMin != null ? f.facturacionMin.toLocaleString('es-AR') : '0';
    const max = f.facturacionMax != null ? f.facturacionMax.toLocaleString('es-AR') : 'sin tope';
    lineas.push({ label: 'Facturación', value: `${min} – ${max}` });
  }

  (Object.keys(FILTRO_LABELS) as (keyof typeof FILTRO_LABELS)[]).forEach((key) => {
    const valores = f[key];
    if (!valores.length) return;
    const mostrados = key === 'dia' ? valores.map((v) => diaLabel(Number(v))) : valores.map(describeValor);
    lineas.push({ label: FILTRO_LABELS[key], value: mostrados.join(', ') });
  });

  return lineas.length ? lineas : [{ label: '', value: 'Sin filtros (todo el universo)' }];
}

// Nombres de los PDV excluidos a mano al momento de crear la zona (ver "Excluir PDV" en
// el cartelito) — se buscan en el universo completo porque, por definición, un PDV
// excluido ya no está en los datos filtrados/visibles.
export function describeExcluidos(excluidos: string[], universoPdv: Pdv[]): string {
  return excluidos
    .map((id) => {
      const p = universoPdv.find((x) => x.id === id);
      return p ? `${p.id} - ${p.n}` : id;
    })
    .join(', ');
}
