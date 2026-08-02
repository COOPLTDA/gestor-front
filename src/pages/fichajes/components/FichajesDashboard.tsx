import React, { useEffect, useRef, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Label } from "recharts";
import {
  Users, Clock, BarChart2, Calendar, RefreshCw, TrendingUp, X, Globe2, Activity,
} from "lucide-react";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import type { Zona, VendedorInfo } from "../Fichajes";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";
import { InfoTooltip, DEFINICIONES } from "./InfoTooltip";
import { FichajesVendedorFechasDetalle } from "./FichajesVendedorFechasDetalle";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type KpisPeriodo = {
  puntualidad_promedio: number; eficiencia_promedio: number;
  hora_promedio: string | null; total_checkins: number;
  dias: number; vendedores_unicos: number;
};
type TardeVendedor = {
  codigoEmpleado: string;
  nombreVendedor: string;
  primerCheckinValidoHora: string | null;
};

type EvolucionDia = {
  fecha: string; puntualidad_pct: number; eficiencia_pct: number;
  hora_promedio: string | null; total_checkins: number; vendedores_activos: number;
  a_tiempo: number; tarde: number; total_validos: number; total_invalidos: number;
};
type ZonaStat = {
  zona: string; puntualidad_pct: number; eficiencia_pct: number;
  vendedores: number; total_checkins: number;
};
type VendedorRanking = {
  codigoEmpleado: string; nombreVendedor: string; zona: string;
  puntualidad_pct: number; eficiencia_pct: number;
  dias_trabajados: number; total_checkins: number; hora_promedio: string | null;
};
type MotivoStat = { motivo: string; label: string; cantidad: number; pct: number };
type Filtro = { id: string; nombre: string };

type AnalyticsData = {
  fechaDesde: string; fechaHasta: string; kpisPeriodo: KpisPeriodo;
  evolucionDiaria: EvolucionDia[]; porZona: ZonaStat[];
  ranking: VendedorRanking[]; motivos: MotivoStat[];
  totalVendedores: number;
  carteraPorDia: Record<string, number>;
  supervisores: Filtro[];
};
type VendedorDiaEvolucion = {
  fecha: string;
  llego_a_tiempo: boolean;
  totalCheckins: number;
  primer_checkin: string | null;
  primer_checkin_minutos: number | null;
  cartera: number;
  cartera_validos: number;
  cartera_invalidos: number;
  sin_visitar: number;
  fuera_validos: number;
  fuera_invalidos: number;
  ultimo_checkin: string | null;
  total_duracion_minutos: number;
  promedio_duracion_minutos: number | null;
};

type AnalyticsVendedor = {
  empleado: string; nombre: string; zona: string;
  fechaDesde: string; fechaHasta: string;
  kpis: { puntualidad_pct: number; eficiencia_pct: number; dias_presentes: number; total_checkins: number; hora_promedio: string | null };
  evolucion: VendedorDiaEvolucion[];
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const pctColor = (v: number) => v >= 70 ? "text-green-600" : v >= 50 ? "text-amber-600" : "text-red-600";

function getDiaSemanaLabel(fechaStr: string): string {
  const date = new Date(fechaStr + 'T12:00:00');
  const names = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return names[date.getDay()];
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getIsoDia(fechaStr: string): number {
  const d = new Date(fechaStr + 'T12:00:00');
  const day = d.getDay();
  return day === 0 ? 7 : day;
}
const barFill   = (v: number, selected: boolean) =>
  selected ? "#1d4ed8" : v >= 70 ? "#3b82f6" : v >= 50 ? "#f59e0b" : "#ef4444";

const COLORS = { puntualidad: "#3b82f6", eficiencia: "#10b981", invalido: "#f87171" };

function todayStr()  { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n: number) { return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10); }

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color, tooltip }: {
  icon: React.ElementType; label: string; value: React.ReactNode;
  sub?: string; color: string; tooltip?: string;
}) {
  return (
    <div className="relative bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-4 border border-gray-100">
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${color} opacity-10`} />
      </div>
      <div className="relative">
        <div className="flex items-center gap-1 text-xs text-gray-500 font-medium mb-1">
          <Icon className="w-3.5 h-3.5" />
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
      <TrendingUp className="w-4 h-4 text-blue-500" />
      {children}
    </h3>
  );
}

function DayTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{String(label).slice(5)}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}%</span>
        </p>
      ))}
      {payload[0]?.payload && (
        <p className="text-gray-400 mt-1">
          {payload[0].payload.vendedores_activos} vendedores · {payload[0].payload.total_checkins} checkins
        </p>
      )}
      <p className="text-blue-500 mt-1 font-medium">Click para ver detalle del día</p>
    </div>
  );
}

function ClickHint({ label }: { label: string }) {
  return <p className="text-xs text-gray-400 mt-1 text-right">{label}</p>;
}

function VendedorTooltip({ active, payload, label, umbralMinutos }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const lbl = String(label ?? '');
  const dayMonth = lbl.length >= 10 ? `${lbl.slice(8)}-${lbl.slice(5, 7)}` : lbl;
  const aTiempo = d.primer_checkin_minutos !== null && d.primer_checkin_minutos <= umbralMinutos;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-1.5">{dayMonth} · {getDiaSemanaLabel(lbl)}</p>
      <p className={`font-medium mb-2 ${aTiempo ? 'text-green-600' : 'text-red-600'}`}>
        {aTiempo ? '✓ A tiempo' : '✗ Tarde'}
        {d.primer_checkin && <span className="ml-1 font-mono">{d.primer_checkin}</span>}
      </p>
      {/* Cartera */}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-1 mb-0.5">Cartera</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-6">
          <span className="text-gray-400">Total asignada</span>
          <span className="font-semibold text-gray-700">{d.cartera}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-green-600">Válidos</span>
          <span className="font-semibold text-green-600">{d.cartera_validos}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-amber-600">Inválidos</span>
          <span className="font-semibold text-amber-600">{d.cartera_invalidos}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-gray-400">Sin visitar</span>
          <span className="font-semibold text-gray-500">{d.sin_visitar}</span>
        </div>
      </div>
      {/* Fuera de cartera */}
      {(d.fuera_validos + d.fuera_invalidos) > 0 && (<>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-2 mb-0.5">Fuera de cartera</p>
        <div className="space-y-0.5">
          <div className="flex justify-between gap-6">
            <span className="text-blue-500">Válidos</span>
            <span className="font-semibold text-blue-500">{d.fuera_validos}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-red-500">Inválidos</span>
            <span className="font-semibold text-red-500">{d.fuera_invalidos}</span>
          </div>
        </div>
      </>)}
    </div>
  );
}

function EvolucionXTick({ x, y, payload }: any) {
  const fecha = String(payload?.value ?? "");
  if (fecha.length < 10) return null;
  const dayMonth = `${fecha.slice(8)}-${fecha.slice(5, 7)}`;
  const dayName  = getDiaSemanaLabel(fecha).slice(0, 3);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#6b7280" fontSize={11}>
        {dayMonth}
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fill="#9ca3af" fontSize={9}>
        {dayName}
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
type Props = {
  zonas:            Zona[];
  supervisoresAll:  Zona[];
  vendedoresAll:    VendedorInfo[];
  mostrarSupervisor?: boolean;
  umbralMinutos?: number;
};

export function FichajesDashboard({ zonas, supervisoresAll, vendedoresAll, mostrarSupervisor = true, umbralMinutos = 525 }: Props) {
  const umbralStr = `${String(Math.floor(umbralMinutos / 60)).padStart(2, "0")}:${String(umbralMinutos % 60).padStart(2, "0")}`;

  const [fechaDesde,     setFechaDesde]     = useState(daysAgoStr(6));
  const [fechaHasta,     setFechaHasta]     = useState(todayStr());
  const [zona,           setZona]           = useState<string[]>([]);
  const [supervisor,     setSupervisor]     = useState<string[]>([]);
  const [vendedorFiltro, setVendedorFiltro] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [data, setData]               = useState<AnalyticsData | null>(null);
  const [dataVend, setDataVend]       = useState<AnalyticsVendedor | null>(null);
  const [vendedorSel, setVendedorSel] = useState<VendedorRanking | null>(null);
  const [loading, setLoading]         = useState(false);
  const [loadingVend, setLoadingVend] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Interactividad
  const [clickedDay,        setClickedDay]        = useState<EvolucionDia | null>(null);
  const [filterZonaRanking, setFilterZonaRanking] = useState<string | null>(null);
  const [tardeVendedores,   setTardeVendedores]   = useState<TardeVendedor[]>([]);
  const [loadingTarde,      setLoadingTarde]      = useState(false);

  const abortRef         = useRef<AbortController | null>(null);
  const rankingRef       = useRef<HTMLDivElement | null>(null);
  const rankingScrollRef = useRef<HTMLDivElement | null>(null);
  const vendedorDetRef   = useRef<HTMLDivElement | null>(null);

  async function fetchAnalytics(fd: string, fh: string, z: string[], sup: string[]) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true); setError(null);
    setClickedDay(null); setFilterZonaRanking(null);
    try {
      const params = new URLSearchParams({ fechaDesde: fd, fechaHasta: fh, umbral: umbralStr });
      if (z.length)   params.set("zona",      z.join(","));
      if (sup.length) params.set("supervisor", sup.join(","));
      const res  = await fetchWithAuth(`${API.FICHAJES.ANALYTICS}?${params}`, { signal: abortRef.current.signal });
      const json = (await res.json()) as any;
      if (!json.success) throw new Error(json.message ?? "Error del servidor");
      setData(json.data);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Error desconocido");
    } finally { setLoading(false); }
  }

  async function fetchVendedor(v: VendedorRanking) {
    setVendedorSel(v); setLoadingVend(true); setDataVend(null);
    try {
      const params = new URLSearchParams({ fechaDesde, fechaHasta, umbral: umbralStr });
      const res  = await fetchWithAuth(`${API.FICHAJES.ANALYTICS_VENDEDOR(v.codigoEmpleado)}?${params}`);
      const json = (await res.json()) as any;
      if (!json.success) throw new Error(json.message);
      setDataVend(json.data);
    } catch { setDataVend(null); }
    finally { setLoadingVend(false); }
  }

  // Auto-execute con debounce cuando cambian fecha o filtros de API
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setVendedorSel(null); setDataVend(null);
      fetchAnalytics(fechaDesde, fechaHasta, zona, supervisor);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, zona.join(","), supervisor.join(","), umbralStr]);

  // Cascading: limpiar vendedor cuando cambia zona
  useEffect(() => {
    if (zona.length > 0) {
      setVendedorFiltro(prev => prev.filter(v => vendedoresAll.find(x => x.id === v && zona.includes(x.zona))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona.join(",")]);

  // Cascading: limpiar vendedor cuando cambia supervisor
  useEffect(() => {
    if (supervisor.length > 0) {
      setVendedorFiltro(prev => prev.filter(v => vendedoresAll.find(x => x.id === v && supervisor.includes(x.supervisorId))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supervisor.join(",")]);

  // Fetch vendedores tarde al hacer click en un día
  useEffect(() => {
    if (!clickedDay) { setTardeVendedores([]); return; }
    let cancelled = false;
    setLoadingTarde(true);
    const params = new URLSearchParams({ fecha: clickedDay.fecha, estado: 'tarde', page: '1', umbral: umbralStr });
    if (zona.length)       params.set('zona',       zona.join(','));
    if (supervisor.length) params.set('supervisor',  supervisor.join(','));
    fetchWithAuth(`${API.FICHAJES.BASE}?${params}`)
      .then(r => r.json())
      .then((json: any) => {
        if (cancelled) return;
        setTardeVendedores(
          (json.data?.items ?? []).map((v: any) => ({
            codigoEmpleado:          v.codigoEmpleado,
            nombreVendedor:          v.nombreVendedor,
            primerCheckinValidoHora: v.primerCheckinValidoHora,
          }))
        );
      })
      .catch(() => { if (!cancelled) setTardeVendedores([]); })
      .finally(() => { if (!cancelled) setLoadingTarde(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedDay?.fecha]);

  // Auto-carga detalle cuando se selecciona exactamente 1 vendedor
  useEffect(() => {
    if (vendedorFiltro.length !== 1 || !data) return;
    const v = data.ranking.find(r => r.codigoEmpleado === vendedorFiltro[0]);
    if (v) fetchVendedor(v);
  }, [vendedorFiltro.join(",")]); // eslint-disable-line

  const handleClickDay = (chartState: any) => {
    // activeLabel siempre está presente (es el valor del XAxis = fecha)
    const fecha = chartState?.activeLabel as string | undefined;
    if (!fecha) return;
    const day = data?.evolucionDiaria.find(d => d.fecha === fecha);
    if (!day) return;
    setClickedDay(prev => prev?.fecha === day.fecha ? null : day);
  };

  const handleActiveDotClick = (dotData: any) => {
    const day = dotData?.payload as EvolucionDia | undefined;
    if (!day) return;
    setClickedDay(prev => prev?.fecha === day.fecha ? null : day);
  };

  const handleClickZona = (chartState: any) => {
    // activeLabel = valor del eje categórico (YAxis) = nombre de la zona
    const z = (chartState?.activeLabel as string | undefined)?.trim();
    if (!z) return;
    setFilterZonaRanking(prev => prev === z ? null : z);
  };

  const handleClickVendedor = (v: VendedorRanking) => {
    if (vendedorSel?.codigoEmpleado === v.codigoEmpleado) {
      setVendedorSel(null); setDataVend(null);
    } else {
      fetchVendedor(v);
    }
  };

  // Scroll al ranking cuando se selecciona una zona + resetea el scroll interno del gráfico
  useEffect(() => {
    if (rankingScrollRef.current) {
      rankingScrollRef.current.scrollTop = 0;
    }
    if (filterZonaRanking && rankingRef.current) {
      rankingRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [filterZonaRanking]);

  // Scroll al detalle del vendedor cuando se selecciona uno
  useEffect(() => {
    if (vendedorSel && vendedorDetRef.current) {
      vendedorDetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [vendedorSel?.codigoEmpleado]);

  const rankingFiltrado = (data?.ranking ?? []).filter(v => {
    if (filterZonaRanking && v.zona?.trim() !== filterZonaRanking.trim()) return false;
    if (vendedorFiltro.length > 0 && !vendedorFiltro.includes(v.codigoEmpleado)) return false;
    return true;
  });

  // ── Render ──
  return (
    <div className="space-y-6">

      {/* Filtros — auto-ejecutan con debounce */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm text-sm text-gray-700">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
            className="outline-none bg-transparent text-sm" />
          <span className="text-gray-400 mx-1">→</span>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
            className="outline-none bg-transparent text-sm" />
        </div>

        <MultiSelectDropdown placeholder="Todas las zonas" options={zonas}
          selected={zona} onChange={setZona} icon={Globe2} width="min-w-[155px]" />

        {mostrarSupervisor && (
          <MultiSelectDropdown
            placeholder="Todos los supervisores"
            options={supervisoresAll}
            selected={supervisor} onChange={setSupervisor} icon={Users} width="min-w-[175px]"
          />
        )}

        <MultiSelectDropdown
          placeholder="Todos los vendedores"
          options={vendedoresAll.filter(v =>
            (zona.length === 0 || zona.includes(v.zona)) &&
            (supervisor.length === 0 || supervisor.includes(v.supervisorId))
          )}
          selected={vendedorFiltro} onChange={setVendedorFiltro} icon={Users} width="min-w-[175px]"
        />

        {loading && (
          <div className="flex items-center gap-1.5 text-blue-500 text-xs">
            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Cargando...
          </div>
        )}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

      {data && (<>

        {/* ── Sección 2: Evolución diaria ── */}
        {data.evolucionDiaria.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100">
            <SectionTitle>Evolución diaria — click en un día para ver su detalle</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.evolucionDiaria} onClick={handleClickDay}
                margin={{ top: 5, right: 10, left: -20, bottom: 10 }}
                style={{ cursor: "pointer" }}>
                <defs>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.puntualidad} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={COLORS.puntualidad} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.eficiencia} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={COLORS.eficiencia} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" tick={<EvolucionXTick />} height={42} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<DayTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="puntualidad_pct" name="% de Puntualidad"
                  stroke={COLORS.puntualidad} fill="url(#gP)" strokeWidth={2}
                  dot={{ r: 4, fill: COLORS.puntualidad, stroke: "white", strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: "#1d4ed8", stroke: "white", strokeWidth: 2,
                    style: { cursor: "pointer" }, onClick: (_: any, p: any) => handleActiveDotClick(p) }} />
                <Area type="monotone" dataKey="eficiencia_pct" name="% Checkins Válidos"
                  stroke={COLORS.eficiencia} fill="url(#gE)" strokeWidth={2}
                  dot={{ r: 4, fill: COLORS.eficiencia, stroke: "white", strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: "#065f46", stroke: "white", strokeWidth: 2,
                    style: { cursor: "pointer" }, onClick: (_: any, p: any) => handleActiveDotClick(p) }} />
              </AreaChart>
            </ResponsiveContainer>

            {/* Callout del día clickeado */}
            {clickedDay && (() => {
              const dia     = getIsoDia(clickedDay.fecha);
              const cartera = data.carteraPorDia[String(dia)] ?? 0;
              const sinActividad = Math.max(0, data.totalVendedores - clickedDay.vendedores_activos);
              return (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-blue-800 text-sm">
                      Detalle del {clickedDay.fecha}
                    </h4>
                    <button onClick={() => setClickedDay(null)} className="text-blue-400 hover:text-blue-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                    {/* Card 1: % de Puntualidad */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                      <div className="text-xs text-gray-500 font-medium mb-1">% de Puntualidad</div>
                      <div className={`text-2xl font-bold mb-2 ${pctColor(clickedDay.puntualidad_pct)}`}>
                        {clickedDay.puntualidad_pct}%
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-green-700">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />A tiempo
                          </span>
                          <span className="font-bold text-green-700">{clickedDay.a_tiempo}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-red-600">
                            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Tarde
                          </span>
                          <span className="font-bold text-red-600">{clickedDay.tarde}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: % de Checkins Válidos */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                      <div className="text-xs text-gray-500 font-medium mb-1">% Checkins Válidos</div>
                      <div className={`text-2xl font-bold mb-2 ${pctColor(clickedDay.eficiencia_pct)}`}>
                        {clickedDay.eficiencia_pct}%
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-green-700">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Válidos
                          </span>
                          <span className="font-bold text-green-700">{clickedDay.total_validos}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-red-600">
                            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Inválidos
                          </span>
                          <span className="font-bold text-red-600">{clickedDay.total_invalidos}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Checkins */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                      <div className="text-xs text-gray-500 font-medium mb-1">Checkins</div>
                      <div className="text-2xl font-bold text-amber-700 mb-2">{clickedDay.total_checkins}</div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Cartera del día</span>
                          <span className="font-semibold text-gray-700">{cartera}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Válidos</span>
                          <span className="font-semibold text-green-700">{clickedDay.total_validos}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Vendedores — valor principal = totalVendedores para que el desglose cierre */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                      <div className="text-xs text-gray-500 font-medium mb-1">Vendedores</div>
                      <div className="text-2xl font-bold text-blue-700 mb-2">{data.totalVendedores}</div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />A tiempo
                          </span>
                          <span className="font-bold text-green-700">{clickedDay.a_tiempo}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-amber-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />Tarde
                          </span>
                          <span className="font-bold text-amber-600">{clickedDay.tarde}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />Sin actividad
                          </span>
                          <span className="font-bold text-gray-400">{sinActividad}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Lista de vendedores que llegaron tarde */}
                  {loadingTarde ? (
                    <div className="mt-4 flex items-center gap-2 text-amber-600 text-xs">
                      <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      Cargando vendedores tarde...
                    </div>
                  ) : tardeVendedores.length > 0 ? (
                    <div className="mt-4">
                      <h5 className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Llegaron tarde — {tardeVendedores.length} vendedor{tardeVendedores.length !== 1 ? "es" : ""}
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
                        {tardeVendedores.map(v => (
                          <div key={v.codigoEmpleado}
                            className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 text-xs">
                            <span className="text-gray-700 truncate mr-2">{v.nombreVendedor}</span>
                            <span className="font-mono font-semibold text-amber-700 shrink-0">
                              {v.primerCheckinValidoHora ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-green-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      Todos los vendedores llegaron a tiempo.
                    </p>
                  )}

                </div>
              );
            })()}
          </div>
        )}

        {/* ── Sección 3: Zona (izq) + Ranking chart (der) ── */}
        {(data.porZona.length > 0 || data.ranking.length > 0) && (
          <div ref={rankingRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Gráfico por zona */}
            {data.porZona.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100">
                <div className="flex items-start justify-between">
                  <SectionTitle>
                    Puntualidad por zona
                    <InfoTooltip text={DEFINICIONES.puntualidad} position="right" />
                  </SectionTitle>
                  {filterZonaRanking && (
                    <button onClick={() => setFilterZonaRanking(null)}
                      className="text-xs text-blue-600 flex items-center gap-1 hover:underline shrink-0">
                      <X className="w-3 h-3" /> Limpiar
                    </button>
                  )}
                </div>
                <ClickHint label="Click en una barra para filtrar el ranking" />
                <ResponsiveContainer width="100%" height={Math.max(data.porZona.length * 42, 200)}>
                  <BarChart data={data.porZona} layout="vertical"
                    onClick={handleClickZona}
                    style={{ cursor: "pointer" }}
                    margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <YAxis type="category" dataKey="zona" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={(v: any, _: any, p: any) =>
                      [`${v}% — ${p.payload.vendedores} vendedores`]} />
                    <Bar dataKey="puntualidad_pct" name="% de Puntualidad" radius={[0, 4, 4, 0]}>
                      {data.porZona.map(z => (
                        <Cell key={z.zona}
                          fill={barFill(z.puntualidad_pct, filterZonaRanking?.trim() === z.zona?.trim())} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Gráfico ranking vendedores */}
            {data.ranking.length > 0 && (() => {
              // Tick clickeable para el YAxis — cubre tanto nombre como barra con 0%
              const rankingTick = ({ x, y, payload }: any) => {
                const name    = String(payload?.value ?? "");
                const display = name.length > 16 ? name.slice(0, 16) + "…" : name;
                const vend    = rankingFiltrado.find(v => v.nombreVendedor === name);
                const sel     = vendedorSel?.codigoEmpleado === vend?.codigoEmpleado;
                return (
                  <g transform={`translate(${x},${y})`}
                    onClick={() => vend && handleClickVendedor(vend)}
                    style={{ cursor: "pointer" }}>
                    {/* área transparente ampliada para facilitar el click */}
                    <rect x={-115} y={-11} width={115} height={22} fill="transparent" />
                    <text dy={4} textAnchor="end"
                      fill={sel ? "#1d4ed8" : "#6b7280"}
                      fontSize={10}
                      fontWeight={sel ? "700" : "normal"}
                      textDecoration={sel ? "underline" : "none"}>
                      {display}
                    </text>
                  </g>
                );
              };

              return (
                <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <SectionTitle>Ranking de vendedores</SectionTitle>
                    {filterZonaRanking && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full shrink-0">
                        Zona: {filterZonaRanking}
                      </span>
                    )}
                  </div>
                  <ClickHint label="Click en la barra o el nombre para ver la evolución individual" />
                  <div ref={rankingScrollRef} style={{ maxHeight: 360, overflowY: "auto" }}>
                    <div style={{ height: Math.max(rankingFiltrado.length * 32 + 20, 200) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rankingFiltrado} layout="vertical"
                          margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                          <YAxis type="category" dataKey="nombreVendedor" width={120} tick={rankingTick} />
                          <Tooltip formatter={(v: any, _: any, p: any) =>
                            [`${v}% — ${p.payload.dias_trabajados}d trabajados`]} />
                          <Bar dataKey="puntualidad_pct" name="% de Puntualidad"
                            radius={[0, 4, 4, 0]} minPointSize={4}
                            onClick={(entry: any) => handleClickVendedor(entry as VendedorRanking)}
                            style={{ cursor: "pointer" }}>
                            {rankingFiltrado.map(v => (
                              <Cell key={v.codigoEmpleado}
                                fill={vendedorSel?.codigoEmpleado === v.codigoEmpleado
                                  ? "#1d4ed8"
                                  : barFill(v.puntualidad_pct, false)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Sección 4: Detalle vendedor individual (entre gráficos y tabla) ── */}
        {vendedorSel && (
          <div ref={vendedorDetRef} className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800 text-base">{vendedorSel.nombreVendedor}</h3>
                <p className="text-xs text-gray-400">{vendedorSel.zona} · Cód: {vendedorSel.codigoEmpleado}</p>
              </div>
              <button onClick={() => { setVendedorSel(null); setDataVend(null); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingVend && (
              <div className="flex justify-center py-8 text-blue-600">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            )}

            {!loadingVend && dataVend && (<>
              {/* KPI cards  */}
              <div className="flex flex-wrap gap-3 mb-5">
                {[
                  { label: "% Puntualidad",  value: `${dataVend.kpis.puntualidad_pct}%`, color: pctColor(dataVend.kpis.puntualidad_pct), tip: DEFINICIONES.puntualidad },
                  { label: "% Checkins Vál.", value: `${dataVend.kpis.eficiencia_pct}%`,  color: pctColor(dataVend.kpis.eficiencia_pct),  tip: DEFINICIONES.eficiencia },
                  { label: "Días presentes",  value: String(dataVend.kpis.dias_presentes), color: "text-gray-700", tip: undefined },
                  { label: "Total checkins",  value: String(dataVend.kpis.total_checkins), color: "text-amber-700", tip: DEFINICIONES.totalCheckins },
                  { label: "1er check-in avg", value: dataVend.kpis.hora_promedio ?? "—", color: "text-purple-600", tip: DEFINICIONES.horaPromedio },
                ].map(k => (
                  <div key={k.label} className="text-center bg-gray-50 rounded-xl px-4 py-2.5 min-w-[90px]">
                    <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
                    <div className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5">
                      {k.label}{k.tip && <InfoTooltip text={k.tip} />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Gráfico único: cartera (stack c) + fuera de cartera (stack f) + línea 1er check-in */}
              {dataVend.evolucion.length > 0 && (() => {
                const timeVals = dataVend.evolucion
                  .map(d => d.primer_checkin_minutos)
                  .filter((v): v is number => v !== null);
                const tMin = timeVals.length ? Math.min(...timeVals, umbralMinutos) : 420;
                const tMax = timeVals.length ? Math.max(...timeVals, umbralMinutos) : 720;
                const tDomain: [number, number] = [
                  Math.floor((tMin - 30) / 30) * 30,
                  Math.ceil((tMax + 30) / 30) * 30,
                ];
                return (
                  <div>
                    {/* Leyenda */}
                    <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-gray-500">
                      <span className="font-medium text-gray-600 mr-1">Cartera:</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Válidos</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Inválidos</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block" />Sin visitar</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="font-medium text-gray-600 mr-1">Fuera de cartera:</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />Válidos</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Inválidos</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="flex items-center gap-1"><span className="w-5 h-0.5 bg-purple-500 inline-block" />1er Check-in</span>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={dataVend.evolucion} margin={{ top: 10, right: 65, left: -10, bottom: 15 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="fecha" tick={<EvolucionXTick />} height={42} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={28} allowDecimals={false} />
                        <YAxis yAxisId="right" orientation="right" domain={tDomain}
                          tick={{ fontSize: 10 }} width={42} tickFormatter={minutesToTime} />
                        <Tooltip content={(props: any) => <VendedorTooltip {...props} umbralMinutos={umbralMinutos} />} />
                        {/* Cartera (stackId="c") */}
                        <Bar yAxisId="left" dataKey="cartera_validos"   name="Cartera válidos"   stackId="c" fill="#10b981" />
                        <Bar yAxisId="left" dataKey="cartera_invalidos" name="Cartera inválidos" stackId="c" fill="#f59e0b" />
                        <Bar yAxisId="left" dataKey="sin_visitar"       name="Sin visitar"       stackId="c" fill="#e5e7eb" radius={[2,2,0,0]} />
                        {/* Fuera de cartera (stackId="f") */}
                        <Bar yAxisId="left" dataKey="fuera_validos"   name="Fuera válidos"   stackId="f" fill="#60a5fa" />
                        <Bar yAxisId="left" dataKey="fuera_invalidos" name="Fuera inválidos" stackId="f" fill="#f87171" radius={[2,2,0,0]} />
                        {/* Línea 1er check-in */}
                        <Line yAxisId="right" type="monotone" dataKey="primer_checkin_minutos"
                          name="1er Check-in" stroke="#8b5cf6" strokeWidth={2}
                          dot={(p: any) => (
                            <circle key={p.key} cx={p.cx} cy={p.cy} r={4}
                              fill={p.payload.primer_checkin_minutos !== null && p.payload.primer_checkin_minutos <= umbralMinutos ? "#8b5cf6" : "#ef4444"}
                              stroke="white" strokeWidth={1.5} />
                          )}
                          activeDot={{ r: 6 }} connectNulls={false} />
                        <ReferenceLine yAxisId="right" y={umbralMinutos} stroke="#ef4444"
                          strokeDasharray="5 3" strokeWidth={1.5}>
                          <Label value={`Límite ${umbralStr}`} position="insideTopRight"
                            fontSize={9} fill="#ef4444" offset={4} />
                        </ReferenceLine>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* Detalle por fecha */}
              <FichajesVendedorFechasDetalle
                evolucion={dataVend.evolucion}
                empleado={vendedorSel.codigoEmpleado}
                umbralMinutos={umbralMinutos}
              />
            </>)}
          </div>
        )}


      </>)}
    </div>
  );
}
