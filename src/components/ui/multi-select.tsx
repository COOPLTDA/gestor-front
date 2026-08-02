import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Todos', className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const allValues = options.map((o) => o.value);
  // "Todos" solo aparece tildado cuando está explícitamente la lista completa — no cuando
  // selected=[] (sin filtro). Así el checkbox admite las dos direcciones sin ambigüedad:
  // tildar "Todos" tilda todo (negativa: después destildás la que no te interesa) y
  // destildarlo vuelve a [] con todo destildado (positiva: tildás solo la que te interesa).
  const allChecked = options.length > 0 && selected.length === allValues.length;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  function toggleTodos(checked: boolean) {
    onChange(checked ? allValues : []);
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} seleccionados`;

  const filteredOptions = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-8 w-36 justify-between text-xs font-normal', className)}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="mb-1 h-7 text-xs"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-accent">
          <Checkbox checked={allChecked} onCheckedChange={(checked) => toggleTodos(checked === true)} />
          Todos
        </label>
        <div className="max-h-64 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-1.5 text-xs italic text-slate-400">Sin resultados</div>
          ) : (
            filteredOptions.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
              >
                <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
                {o.label}
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
