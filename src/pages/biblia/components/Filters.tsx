import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useClickAway } from "@/hooks/useClickAway";

const ESTADO_DOT: Record<string, string> = {
  pendiente: "bg-slate-500",
  "en preparacion": "bg-amber-500",
  completada: "bg-emerald-600",
  completo: "bg-emerald-600",
  remitido: "bg-sky-600",
  eliminado: "bg-red-500",
}

interface FiltersProps {
  estados: string[];
  estadosSeleccionados: string[];
  onToggleEstado: (estado: string) => void;
  zonas: { id: number; nombre: string }[];
  zonasSeleccionadas: number[];
  onToggleZona: (zonaId: number) => void;
  onSetZonas: (ids: number[]) => void;
  fechaDesde: string;
  fechaHasta: string;
  bibliaFecha: string;
  onFechaDesdeChange: (f: string) => void;
  onFechaHastaChange: (f: string) => void;
  onBibliaFechaChange: (f: string) => void;
}

const dateInput = 'h-7 w-[7.5rem] text-xs border border-border rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

const dropdownBtn = (active: boolean) =>
  `flex items-center gap-1 h-7 text-xs px-2.5 rounded-md border transition-colors ${
    active
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white text-muted-foreground border-border hover:border-blue-400'
  }`;

export function Filters({
  estados,
  estadosSeleccionados,
  onToggleEstado,
  zonas,
  zonasSeleccionadas,
  onToggleZona,
  onSetZonas,
  fechaDesde,
  fechaHasta,
  bibliaFecha,
  onFechaDesdeChange,
  onFechaHastaChange,
  onBibliaFechaChange,
}: FiltersProps) {
  const [zonaOpen, setZonaOpen] = useState(false);
  const [estadoOpen, setEstadoOpen] = useState(false);
  const [avisoClamp, setAvisoClamp] = useState(false);
  const zonaRef = useRef<HTMLDivElement>(null);
  const estadoRef = useRef<HTMLDivElement>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout>>();

  useClickAway(zonaRef, () => setZonaOpen(false));
  useClickAway(estadoRef, () => setEstadoOpen(false));

  useEffect(() => () => { if (avisoTimer.current) clearTimeout(avisoTimer.current); }, []);

  // Se recalcula en cada render (no a nivel de módulo) para no quedar desactualizado
  // si el usuario deja la pestaña abierta de un día para el otro.
  const today = new Date().toISOString().slice(0, 10);
  const maxPrep = bibliaFecha < today ? bibliaFecha : today;

  const avisarClamp = () => {
    setAvisoClamp(true);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAvisoClamp(false), 4000);
  };

  const handleDesdeChange = (v: string) => {
    if (!v) return;
    const clamped = v > maxPrep ? maxPrep : v;
    if (clamped !== v) avisarClamp();
    onFechaDesdeChange(clamped);
    if (clamped > fechaHasta) onFechaHastaChange(clamped);
  };

  const handleHastaChange = (v: string) => {
    if (!v) return;
    const clamped = v > maxPrep ? maxPrep : v;
    if (clamped !== v) avisarClamp();
    onFechaHastaChange(clamped);
    if (clamped < fechaDesde) onFechaDesdeChange(clamped);
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm px-3 py-2 flex items-center gap-2.5 flex-nowrap">

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Preps del</span>
        <input
          type="date"
          value={fechaDesde}
          max={maxPrep}
          onChange={e => handleDesdeChange(e.target.value)}
          className={dateInput}
        />
        <span className="text-xs text-muted-foreground">al</span>
        <input
          type="date"
          value={fechaHasta}
          max={maxPrep}
          onChange={e => handleHastaChange(e.target.value)}
          className={dateInput}
        />
        {avisoClamp && (
          <span className="text-xs text-amber-600 whitespace-nowrap">Ajustada a la fecha máxima permitida</span>
        )}
      </div>

      <div className="h-4 w-px bg-border shrink-0" />

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">Biblia del</span>
        {bibliaFecha && (
          <span className="text-xs font-medium text-blue-600 capitalize whitespace-nowrap -ml-0.5 mr-0.5">
            {new Date(bibliaFecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long' })}
          </span>
        )}
        <input
          type="date"
          value={bibliaFecha}
          onChange={e => e.target.value && onBibliaFechaChange(e.target.value)}
          className={dateInput}
        />
      </div>

      {zonas.length > 0 && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="relative shrink-0" ref={zonaRef}>
            <button
              type="button"
              onClick={() => setZonaOpen(v => !v)}
              className={dropdownBtn(zonasSeleccionadas.length > 0)}
            >
              <span className="whitespace-nowrap">
                {zonasSeleccionadas.length === 0
                  ? 'Zona'
                  : zonasSeleccionadas.length === zonas.length
                    ? 'Todas las zonas'
                    : zonasSeleccionadas.length === 1
                      ? zonas.find(z => z.id === zonasSeleccionadas[0])?.nombre ?? 'Zona'
                      : `${zonasSeleccionadas.length} zonas`}
              </span>
              <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
            </button>

            {zonaOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-border rounded-md shadow-md min-w-[140px] py-1">
                <label className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 cursor-pointer border-b border-border">
                  <input
                    type="checkbox"
                    checked={zonasSeleccionadas.length === zonas.length}
                    onChange={() =>
                      onSetZonas(zonasSeleccionadas.length === zonas.length ? [] : zonas.map(z => z.id))
                    }
                    className="w-3.5 h-3.5 accent-emerald-600"
                  />
                  Todo
                </label>
                {zonas.map(z => (
                  <label
                    key={z.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={zonasSeleccionadas.includes(z.id)}
                      onChange={() => onToggleZona(z.id)}
                      className="w-3.5 h-3.5 accent-emerald-600"
                    />
                    {z.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {estados.length > 0 && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="relative shrink-0" ref={estadoRef}>
            <button
              type="button"
              onClick={() => setEstadoOpen(v => !v)}
              className={dropdownBtn(estadosSeleccionados.length > 0)}
            >
              <span className="whitespace-nowrap">
                {estadosSeleccionados.length === 0
                  ? 'Estado'
                  : estadosSeleccionados.length === estados.length
                    ? 'Todos'
                    : estadosSeleccionados.length === 1
                      ? estadosSeleccionados[0]
                      : `${estadosSeleccionados.length} estados`}
              </span>
              <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
            </button>

            {estadoOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-border rounded-md shadow-md min-w-[160px] py-1">
                {estados.map(est => (
                  <label
                    key={est}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={estadosSeleccionados.includes(est)}
                      onChange={() => onToggleEstado(est)}
                      className="w-3.5 h-3.5"
                    />
                    <span className={`w-2 h-2 rounded-full shrink-0 ${ESTADO_DOT[est.toLowerCase()] ?? 'bg-slate-400'}`} />
                    {est}
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
