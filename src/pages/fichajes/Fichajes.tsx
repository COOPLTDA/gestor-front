import React, { useCallback, useEffect, useRef, useState } from "react";
import { LayoutList, LayoutGrid, RefreshCw, CalendarDays, BarChart2, CalendarCheck2, Download } from "lucide-react";
import { exportReporteDiario } from "./utils/exportReporteDiario";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";
import { useParametro } from "@/hooks/useParametro";
import { FichajesFiltros } from "./components/FichajesFiltros";
import { FichajesKpisGrid } from "./components/FichajesKpisGrid";
import { FichajesTabla } from "./components/FichajesTabla";
import { FichajesCards } from "./components/FichajesCards";
import { FichajesDashboard } from "./components/FichajesDashboard";
import { FichajesAsistencia } from "./components/FichajesAsistencia";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
export type Zona         = { id: string; nombre: string };
export type VendedorInfo = { id: string; nombre: string; zona: string; supervisorId: string };

export type FichajeRow = {
  codigoEmpleado: string;
  nombreVendedor: string;
  zona: string;
  supervisor: string | null;
  supervisorId: string | null;
  tieneRegistro: boolean;
  primerCheckinValidoHora: string | null;
  llegoATiempo: boolean;
  totalCheckins: number;
  totalCheckinsValidos: number;
  totalCheckinsInvalidos: number;
  carteraTotal: number;
  carteraVisitados: number;
  carteraPct: number;
};

export type KpisBasicos = {
  total_vendedores: number;
  a_tiempo: number;
  total_checkins: number;
  total_validos: number;
  total_invalidos: number;
  puntualidad_pct: number;
};

export type KpisAvanzados = {
  duracion_promedio: number;
  clientes_unicos: number;
  distribucion_hora: Record<string, number>;
  hora_pico: number | null;
  motivos: Array<{ motivo: string; cantidad: number }>;
  eficiencia: number;
  total_checkins_snap: number;
  total_validos_snap: number;
  primera_hora: string | null;
  ultima_hora: string | null;
};

export type DetalleRow = {
  codigoCliente: string;
  clienteNombre: string;
  clienteCalle: string;
  clienteAltura: string;
  clienteLocalidad: string;
  clienteLatitud: string | null;
  clienteLongitud: string | null;
  clienteRubro: string;
  asignado: boolean;
  visitado: boolean;
  tieneValido: boolean;
  repartoDescripcion: string | null;
  diaDeVisita: string | null;
  timestampCheckin: string | null;
  timestampCheckout: string | null;
  valido: number | null;
  motivo: string | null;
  duracion: number | null;
  cantCheckins: number;
  coordenadasCheckin: string | null;
  mapsUrl: string | null;
};

export type DetalleCobertura = {
  asignados: number;
  visitados: number;
  cobertura_pct: number;
  fuera_ruta: number;
  diaSemanaLabel: string;
  rows: DetalleRow[];
};

type Pagination = {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
};

const EMPTY_KPIS: KpisBasicos = {
  total_vendedores: 0,
  a_tiempo: 0,
  total_checkins: 0,
  total_validos: 0,
  total_invalidos: 0,
  puntualidad_pct: 0,
};

const EMPTY_KPIS_AVZ: KpisAvanzados = {
  duracion_promedio: 0,
  clientes_unicos: 0,
  distribucion_hora: {},
  hora_pico: null,
  motivos: [],
  eficiencia: 0,
  total_checkins_snap: 0,
  total_validos_snap: 0,
  primera_hora: null,
  ultima_hora: null,
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────
function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return isNaN(h) || isNaN(m) ? 525 : h * 60 + m;
}

export default function Fichajes() {
  const mostrarFiltroSupervisor = useParametro("FICHAJES_FILTRO_SUPERVISOR", "S") !== "N";
  const umbralStr     = useParametro("FICHAJES_UMBRAL_PUNTUALIDAD", "08:45");
  const umbralMinutos = timeStringToMinutes(umbralStr);

  const [activeTab, setActiveTab] = useState<"detalle" | "dashboard" | "asistencia">("detalle");

  // Filters (auto-execute on change)
  const [fecha,      setFecha]      = useState(todayString());
  const [zona,       setZona]       = useState<string[]>([]);
  const [supervisor, setSupervisor] = useState<string[]>([]);
  const [vendedor,   setVendedor]   = useState<string[]>([]);
  const [estado,     setEstado]     = useState<string[]>([]);
  const [page,       setPage]       = useState(1);

  // Data
  const [items, setItems]                   = useState<FichajeRow[]>([]);
  const [kpis, setKpis]                     = useState<KpisBasicos>(EMPTY_KPIS);
  const [kpisAvanzados, setKpisAvanzados]   = useState<KpisAvanzados>(EMPTY_KPIS_AVZ);
  const [zonas, setZonas]                   = useState<Zona[]>([]);
  const [supervisores, setSupervisores]     = useState<Zona[]>([]);
  const [vendedores, setVendedores]         = useState<VendedorInfo[]>([]);
  const [diaSemanaLabel, setDiaSemanaLabel] = useState("");
  const [pagination, setPagination]         = useState<Pagination | null>(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  // UI
  const [viewMode,   setViewMode]   = useState<"table" | "cards">("table");
  const [exporting,  setExporting]  = useState(false);

  // Detail cache
  const [openEmpleado, setOpenEmpleado] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, DetalleCobertura>>({});
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [erroresDetalle, setErroresDetalle] = useState<Record<string, string>>({});

  const abortRef    = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (
    f: string, z: string[], sup: string[], vend: string[], est: string[], p: number, umbral: string
  ) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ fecha: f, page: String(p), umbral });
      if (z.length)    params.set("zona",       z.join(","));
      if (sup.length)  params.set("supervisor",  sup.join(","));
      if (vend.length) params.set("vendedor",    vend.join(","));
      if (est.length)  params.set("estado",      est.join(","));

      const res = await fetchWithAuth(`${API.FICHAJES.BASE}?${params}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Error cargando fichajes");

      const json = (await res.json()) as any;
      if (!json.success) throw new Error(json.message ?? "Error del servidor");

      const d = json.data;
      setItems(d.items ?? []);
      setKpis(d.kpis ?? EMPTY_KPIS);
      setKpisAvanzados(d.kpisAvanzados ?? EMPTY_KPIS_AVZ);
      setZonas(d.zonas ?? []);
      setSupervisores(d.supervisores ?? []);
      setVendedores(d.vendedores ?? []);
      setDiaSemanaLabel(d.diaSemanaLabel ?? "");
      setPagination(d.pagination ?? null);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-execute con debounce cuando cambian los filtros
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(fecha, zona, supervisor, vendedor, estado, 1, umbralStr);
      setPage(1);
      setOpenEmpleado(null);
      setDetalles({});
      setErroresDetalle({});
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, zona.join(","), supervisor.join(","), vendedor.join(","), estado.join(","), umbralStr]);

  // Cascading: cuando cambia zona, limpiar vendedores que ya no aplican
  useEffect(() => {
    if (zona.length > 0) {
      setVendedor(prev => prev.filter(v => vendedores.find(x => x.id === v && zona.includes(x.zona))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona.join(",")]);

  // Cascading: cuando cambia supervisor, limpiar vendedores que ya no aplican
  useEffect(() => {
    if (supervisor.length > 0) {
      setVendedor(prev => prev.filter(v => vendedores.find(x => x.id === v && supervisor.includes(x.supervisorId))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supervisor.join(",")]);

  const handlePageChange = (p: number) => {
    setPage(p);
    setOpenEmpleado(null);
    fetchData(fecha, zona, supervisor, vendedor, estado, p, umbralStr);
  };

  const handleToggle = async (emp: string) => {
    if (openEmpleado === emp) {
      setOpenEmpleado(null);
      return;
    }
    setOpenEmpleado(emp);

    if (detalles[emp] || erroresDetalle[emp]) return;

    setLoadingDetalle(true);
    try {
      const res = await fetchWithAuth(
        `${API.FICHAJES.DETALLE(emp)}?fecha=${encodeURIComponent(fecha)}`
      );
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      const data = (await res.json()) as any;
      if (data.error) throw new Error(data.msg ?? "Error del servidor");
      setDetalles((prev) => ({ ...prev, [emp]: data }));
    } catch (e: any) {
      setErroresDetalle((prev) => ({ ...prev, [emp]: e.message ?? "Error desconocido" }));
    } finally {
      setLoadingDetalle(false);
    }
  };

  return (
    <div className="px-6 py-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Seguimiento de Vendedores
            </span>
          </h1>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-5">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {([
            { id: "detalle",    icon: <CalendarDays className="w-4 h-4" />,    label: "Detalle Diario"   },
            { id: "dashboard",  icon: <BarChart2 className="w-4 h-4" />,       label: "Dashboard"        },
            { id: "asistencia", icon: <CalendarCheck2 className="w-4 h-4" />,  label: "Evolución Asist." },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Detalle Diario ── */}
      <div className={activeTab !== "detalle" ? "hidden" : ""}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          {diaSemanaLabel && (
            <p className="text-sm text-gray-400">
              {diaSemanaLabel} &middot; {fecha}
            </p>
          )}
        </div>
        <FichajesFiltros
          fecha={fecha}
          zona={zona}
          supervisor={supervisor}
          vendedor={vendedor}
          estado={estado}
          zonas={zonas}
          supervisores={supervisores}
          vendedores={vendedores}
          loading={loading}
          mostrarSupervisor={mostrarFiltroSupervisor}
          onFechaChange={setFecha}
          onZonaChange={setZona}
          onSupervisorChange={setSupervisor}
          onVendedorChange={setVendedor}
          onEstadoChange={setEstado}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading hint */}
      {loading && (
        <div className="mb-4 flex items-center gap-2 text-blue-600 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando...
        </div>
      )}

      {/* KPIs */}
      {!error && <FichajesKpisGrid kpis={kpis} kpisAvanzados={kpisAvanzados} />}

      {/* View toggle + export */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              viewMode === "table"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            Tabla
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              viewMode === "cards"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Cards
          </button>
        </div>
        <button
          disabled={exporting || items.length === 0}
          onClick={async () => {
            setExporting(true);
            try {
              await exportReporteDiario({
                fecha,
                zona,
                supervisor,
                vendedor,
                umbral: umbralStr,
              });
            } catch (e: any) {
              alert(e.message ?? "Error al exportar");
            } finally {
              setExporting(false);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          {exporting
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generando...</>
            : <><Download className="w-4 h-4" /> Reporte Excel</>
          }
        </button>
      </div>

      {/* Main content */}
      {!error && items.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <p className="text-lg">Sin datos para la fecha seleccionada</p>
        </div>
      ) : viewMode === "table" ? (
        <FichajesTabla
          items={items}
          openEmpleado={openEmpleado}
          detalles={detalles}
          loadingDetalle={loadingDetalle}
          erroresDetalle={erroresDetalle}
          diaSemanaLabel={diaSemanaLabel}
          umbralMinutos={umbralMinutos}
          fecha={fecha}
          onToggle={handleToggle}
        />
      ) : (
        <FichajesCards
          items={items}
          openEmpleado={openEmpleado}
          detalles={detalles}
          loadingDetalle={loadingDetalle}
          erroresDetalle={erroresDetalle}
          diaSemanaLabel={diaSemanaLabel}
          umbralMinutos={umbralMinutos}
          onToggle={handleToggle}
        />
      )}

      {/* Pagination */}
      {pagination && pagination.last_page > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.current_page - 1)}
            disabled={pagination.current_page === 1}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {pagination.current_page} de {pagination.last_page}
          </span>
          <button
            onClick={() => handlePageChange(pagination.current_page + 1)}
            disabled={pagination.current_page === pagination.last_page}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}
      </div>

      {/* ── Tab: Dashboard ── */}
      <div className={activeTab !== "dashboard" ? "hidden" : ""}>
        <FichajesDashboard zonas={zonas} supervisoresAll={supervisores} vendedoresAll={vendedores} mostrarSupervisor={mostrarFiltroSupervisor} umbralMinutos={umbralMinutos} />
      </div>

      {/* ── Tab: Asistencia diaria ── */}
      <div className={activeTab !== "asistencia" ? "hidden" : ""}>
        <FichajesAsistencia zonas={zonas} supervisoresAll={supervisores} mostrarSupervisor={mostrarFiltroSupervisor} umbralMinutos={umbralMinutos} />
      </div>
    </div>
  );
}
