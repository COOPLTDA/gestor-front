import { Button } from '@/components/ui/button';
import type { ColorScheme } from '../types';

const SCHEMES: { value: ColorScheme; label: string }[] = [
  { value: 'tipo', label: 'Tipo PDV' },
  { value: 'dia', label: 'Día visita' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'reparto', label: 'Reparto' },
];

interface ColorSchemeBarProps {
  scheme: ColorScheme;
  onChange: (scheme: ColorScheme) => void;
}

export function ColorSchemeBar({ scheme, onChange }: ColorSchemeBarProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {SCHEMES.map((s) => (
        <Button
          key={s.value}
          size="sm"
          variant={scheme === s.value ? 'default' : 'outline'}
          onClick={() => onChange(s.value)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}
