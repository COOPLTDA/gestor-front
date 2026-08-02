import { DIA_COLOR, getRepartoColor, getRubroColor, getVndCodColor } from '../lib/colors';
import type { ColorScheme, Pdv } from '../types';

interface LegendProps {
  scheme: ColorScheme;
  currentData: Pdv[];
}

const DIA_LEGEND_ORDER: [number, string][] = [
  [1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'],
  [5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo'], [0, 'Sin día'],
];

export function Legend({ scheme, currentData }: LegendProps) {
  const entries = buildEntries(scheme, currentData);

  return (
    <div className="flex h-full flex-wrap content-start gap-x-3 gap-y-1 text-[11px]">
      {entries.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-slate-600">{label}</span>
        </span>
      ))}
    </div>
  );
}

function buildEntries(scheme: ColorScheme, currentData: Pdv[]): [string, string][] {
  if (scheme === 'dia') {
    const seen = new Set<number>();
    currentData.forEach((p) => seen.add(p.dia ?? 0));
    return DIA_LEGEND_ORDER.filter(([dia]) => seen.has(dia)).map(([dia, label]) => [DIA_COLOR[dia], label]);
  }
  if (scheme === 'vendedor') {
    const seen = new Set<string>();
    currentData.forEach((p) => { if (p.vnd_cod) seen.add(p.vnd_cod); });
    return [...seen].sort().map((cod) => [getVndCodColor(cod), cod]);
  }
  if (scheme === 'reparto') {
    const seen = new Set<string>();
    currentData.forEach((p) => { if (p.reparto) seen.add(p.reparto); });
    return [...seen].sort().map((reparto) => [getRepartoColor(reparto), reparto]);
  }
  const seen = new Set<string>();
  currentData.forEach((p) => { if (p.com) seen.add(p.com); });
  return [...seen].sort().map((com) => [getRubroColor(com), com]);
}
