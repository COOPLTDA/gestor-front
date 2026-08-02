import type { ColorScheme, Pdv } from '../types';

// Port de las paletas y funciones de color de mapa_universo_enro.html.

export const DIA_COLOR: Record<number, string> = {
  0: '#6b7280', 1: '#a78bfa', 2: '#f472b6', 3: '#fbbf24',
  4: '#34d399', 5: '#60a5fa', 6: '#c084fc', 7: '#fda4af',
};

export const DIA_LABEL: Record<number, string> = {
  0: 'Sin día', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
  4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
};

export function diaColor(dia: number | null): string {
  return DIA_COLOR[dia ?? 0] ?? '#6b7280';
}

export function diaLabel(dia: number | null): string {
  return DIA_LABEL[dia ?? 0] ?? 'Sin día';
}

const CATEGORICAL_PALETTE = [
  '#f97316', '#3b82f6', '#10b981', '#e879f9', '#fb7185', '#fbbf24', '#a78bfa',
  '#34d399', '#60a5fa', '#f472b6', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
];

const REPARTO_PALETTE = [
  '#3b82f6', '#f97316', '#10b981', '#e879f9', '#fb7185', '#fbbf24', '#a78bfa',
  '#34d399', '#60a5fa', '#f472b6', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
];

export const ZONE_COLORS = [
  '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#fb7185', '#f97316', '#e879f9',
];

function makeColorCycler(palette: string[]) {
  const assigned = new Map<string, string>();
  return (key: string | null): string => {
    if (!key) return '#6b7280';
    if (!assigned.has(key)) {
      assigned.set(key, palette[assigned.size % palette.length]);
    }
    return assigned.get(key)!;
  };
}

export const getVndCodColor = makeColorCycler(CATEGORICAL_PALETTE);
export const getRubroColor = makeColorCycler(CATEGORICAL_PALETTE);
export const getRepartoColor = makeColorCycler(REPARTO_PALETTE);

export function getPointColor(p: Pdv, scheme: ColorScheme): string {
  if (scheme === 'dia') return diaColor(p.dia);
  if (scheme === 'vendedor') return getVndCodColor(p.vnd_cod);
  if (scheme === 'reparto') return getRepartoColor(p.reparto);
  return getRubroColor(p.com);
}

export function nextZoneColor(index: number): string {
  return ZONE_COLORS[index % ZONE_COLORS.length];
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?$/;

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color);
}
