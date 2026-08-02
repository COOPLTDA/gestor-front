import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export type SelectOption = { id: string; nombre: string };

type Props = {
  placeholder: string;
  options: SelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  icon?: React.ElementType;
  width?: string;
};

export function MultiSelectDropdown({
  placeholder,
  options,
  selected,
  onChange,
  icon: Icon,
  width = "min-w-[180px]",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const buttonLabel = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return options.find(o => o.id === selected[0])?.nombre ?? "1 seleccionado";
    }
    return `${selected.length} seleccionados`;
  };

  const hasActive = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white shadow-sm text-sm transition-all ${width} ${
          hasActive
            ? "border-blue-400 text-blue-700"
            : "border-gray-200 text-gray-700 hover:border-blue-300"
        }`}
      >
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${hasActive ? "text-blue-500" : "text-gray-400"}`} />}
        <span className="flex-1 text-left truncate">{buttonLabel()}</span>
        {hasActive ? (
          <X
            className="w-3.5 h-3.5 text-blue-400 hover:text-blue-600 shrink-0"
            onClick={e => { e.stopPropagation(); onChange([]); }}
          />
        ) : (
          <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
             style={{ minWidth: "100%", maxHeight: 260, overflowY: "auto" }}>

          {options.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-3 text-center">Sin opciones disponibles</p>
          ) : (
            <>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 border-b border-gray-100 font-medium"
                >
                  Limpiar selección ({selected.length})
                </button>
              )}
              {options.map(opt => {
                const checked = selected.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm transition-colors ${
                      checked ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <span className="truncate">{opt.nombre}</span>
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
