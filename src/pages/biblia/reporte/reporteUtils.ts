import type { GrupoDireccion } from '@/pages/biblia/types/biblia'

export type Vista = 'biblia' | 'rango' | 'resumen' | 'mapa' | 'personalizado'

export type CasoFilter = 'propia' | 'sin_asignar' | 'otra_biblia'

export const CASO_LABELS: Record<CasoFilter, string> = {
  propia: 'Esta biblia',
  sin_asignar: 'Sin asignar',
  otra_biblia: 'Otra biblia',
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const today = formatDate(new Date())

export function nextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  do { d.setDate(d.getDate() + 1) } while (d.getDay() === 0 || d.getDay() === 6)
  return formatDate(d)
}

export function casoRowClass(caso: string): string {
  if (caso === 'sin_asignar') return 'bg-red-200 print:bg-red-200'
  if (caso === 'otra_biblia') return 'bg-amber-100 print:bg-amber-100'
  return 'hover:bg-slate-50'
}

export function rangoRowClass(biblia: string | null): string {
  return biblia ? 'hover:bg-slate-50' : 'bg-red-200 print:bg-red-200'
}

export type ChoferGrupo = {
  chofer_nombre: string
  caso: 'propia' | 'sin_asignar' | 'otra_biblia'
  biblia_fecha_asignada: string | null
  codigos: GrupoDireccion['repartos']
  total_importe: number; total_pedidos: number; total_clientes: number
  tipo_agrupa_direccion: number; tipo_consolidado: number; tipo_individual: number
}

export function buildChoferGrupos(repartos: GrupoDireccion['repartos'], keyFn: (r: GrupoDireccion['repartos'][0]) => string): ChoferGrupo[] {
  const result: ChoferGrupo[] = []
  const idx = new Map<string, number>()
  for (const r of repartos) {
    const k = keyFn(r)
    if (!idx.has(k)) {
      idx.set(k, result.length)
      result.push({ chofer_nombre: r.chofer_nombre, caso: r.caso, biblia_fecha_asignada: r.biblia_fecha_asignada, codigos: [], total_importe: 0, total_pedidos: 0, total_clientes: 0, tipo_agrupa_direccion: 0, tipo_consolidado: 0, tipo_individual: 0 })
    }
    const g = result[idx.get(k)!]
    g.codigos.push(r)
    g.total_importe += r.total_importe; g.total_pedidos += r.total_pedidos; g.total_clientes += r.total_clientes
    g.tipo_agrupa_direccion += r.tipo_agrupa_direccion; g.tipo_consolidado += r.tipo_consolidado; g.tipo_individual += r.tipo_individual
  }
  return result
}

// Key estable por instancia de código de despacho (no depende del texto editable).
export function codKey(direccion: string, r: GrupoDireccion['repartos'][number]): string {
  return `${direccion}|${r.codigo_numerico}|${r.chofer_nombre}|${r.caso}|${r.biblia_fecha_asignada ?? ''}`
}

// Key de agrupación por chofer para buildChoferGrupos: vista biblia agrupa por caso,
// vista rango agrupa por fecha de biblia asignada (o '_sin' si no tiene).
export function choferGrupoKeyPorCaso(r: GrupoDireccion['repartos'][number]): string {
  return `${r.chofer_nombre}||${r.caso}`
}

export function choferGrupoKeyPorBiblia(r: GrupoDireccion['repartos'][number]): string {
  return `${r.chofer_nombre}||${r.biblia_fecha_asignada ?? '_sin'}`
}

// Filtro de vista biblia: por caso (propia/sin_asignar/otra_biblia). Sin filtro activo
// (0 o los 3 casos tildados) devuelve los grupos tal cual.
export function filterByCaso(grupos: GrupoDireccion[], filtroCaso: CasoFilter[]): GrupoDireccion[] {
  if (filtroCaso.length === 0 || filtroCaso.length >= 3) return grupos
  return grupos
    .map(g => ({ ...g, repartos: g.repartos.filter(rep => filtroCaso.includes(rep.caso)) }))
    .filter(g => g.repartos.length > 0)
}

// Filtro de vista rango: por fecha de biblia asignada ('_sin' incluido como pseudo-fecha
// para "sin asignar"). Sin filtro activo devuelve los grupos tal cual.
export function filterByBiblia(grupos: GrupoDireccion[], filtroBiblias: string[]): GrupoDireccion[] {
  if (filtroBiblias.length === 0) return grupos
  const hasNull = filtroBiblias.includes('_sin')
  const fechas = filtroBiblias.filter(f => f !== '_sin')
  return grupos
    .map(g => ({
      ...g,
      repartos: g.repartos.filter(rep =>
        (hasNull && !rep.biblia_fecha_asignada) || (rep.biblia_fecha_asignada != null && fechas.includes(rep.biblia_fecha_asignada))
      ),
    }))
    .filter(g => g.repartos.length > 0)
}

// Aplica las ediciones manuales de código de despacho (codigoOverrides, clave codKey → texto)
// al nombre de cada reparto. Usado por las salidas que reconstruyen desde data (Excel e
// impresión formato biblia); la impresión "formato actual" imprime el DOM directamente, donde
// el input ya muestra lo editado.
export function applyCodigoOverrides(grupos: GrupoDireccion[], codigoOverrides: Record<string, string>): GrupoDireccion[] {
  return grupos.map(g => ({
    ...g,
    repartos: g.repartos.map(r => {
      const k = codKey(g.direccion, r)
      return k in codigoOverrides ? { ...r, nombre: codigoOverrides[k] } : r
    }),
  }))
}
