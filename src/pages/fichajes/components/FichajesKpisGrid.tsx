import React from "react";
import {
  Users, CheckCircle2, Clock, MapPin, BarChart2,
  Timer, Building2, Activity, AlertTriangle,
} from "lucide-react";
import type { KpisBasicos, KpisAvanzados } from "../Fichajes";
import { InfoTooltip, DEFINICIONES } from "./InfoTooltip";

const MOTIVO_LABELS: Record<string, string> = {
  OUT_OF_PDV_ZONE: "Fuera de zona",
  MOCK_LOCATION: "Ubicación falsa",
  GPS_NOT_FOUND: "Sin GPS",
  TIMEOUT: "Timeout",
};

type Props = {
  kpis: KpisBasicos;
  kpisAvanzados: KpisAvanzados;
};

function KpiCard({
  icon: Icon, label, value, bgColor, sub, tooltip,
}: {
  icon: React.ElementType; label: string; value: React.ReactNode;
  bgColor: string; sub?: React.ReactNode; tooltip?: string;
}) {
  return (
    <div className="relative bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-4 border border-gray-100 hover:shadow-xl transition-all">
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${bgColor} opacity-10`} />
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

export function FichajesKpisGrid({ kpis, kpisAvanzados }: Props) {
  const pctColor = (v: number) =>
    v >= 70 ? "text-green-600" : v >= 50 ? "text-amber-600" : "text-red-600";
  const barColor = (v: number) =>
    v >= 70 ? "bg-green-500" : v >= 50 ? "bg-amber-500" : "bg-red-500";

  const horaEntries = Object.entries(kpisAvanzados.distribucion_hora).map(([h, c]) => ({
    hora: Number(h),
    cantidad: c,
  }));
  const maxHora = Math.max(...horaEntries.map((e) => e.cantidad), 1);
  const totalInv = kpisAvanzados.total_checkins_snap - kpisAvanzados.total_validos_snap;

  return (
    <>
      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard
          icon={Users}
          label="Vendedores"
          bgColor="bg-blue-500"
          value={kpis.total_vendedores}
        />
        <KpiCard
          icon={CheckCircle2}
          label="A Tiempo"
          bgColor="bg-green-500"
          tooltip={DEFINICIONES.puntualidad}
          value={<span className="text-green-600">{kpis.a_tiempo}</span>}
        />
        <KpiCard
          icon={Clock}
          label="% de Puntualidad"
          bgColor="bg-purple-500"
          tooltip={DEFINICIONES.puntualidad}
          value={
            <span className={pctColor(kpis.puntualidad_pct)}>{kpis.puntualidad_pct}%</span>
          }
        />
        <KpiCard
          icon={MapPin}
          label="Válidos"
          bgColor="bg-emerald-500"
          tooltip={DEFINICIONES.checkinValido}
          value={
            <span className="text-emerald-600">{kpisAvanzados.total_validos_snap}</span>
          }
          sub={`de ${kpisAvanzados.total_checkins_snap}`}
        />

        {/* Eficiencia (con barra) */}
        <div className="relative bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-4 border border-gray-100 hover:shadow-xl transition-all">
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-cyan-500 opacity-10" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-1 text-xs text-gray-500 font-medium mb-1">
              <BarChart2 className="w-3.5 h-3.5" />
              % de Checkins Válidos
              <InfoTooltip text={DEFINICIONES.eficiencia} />
            </div>
            <div className={`text-2xl font-bold ${pctColor(kpisAvanzados.eficiencia)}`}>
              {kpisAvanzados.eficiencia}%
            </div>
            <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(kpisAvanzados.eficiencia)}`}
                style={{ width: `${Math.min(kpisAvanzados.eficiencia, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <KpiCard
          icon={Timer}
          label="Duración"
          bgColor="bg-amber-500"
          value={
            <span className="text-amber-600">
              {kpisAvanzados.duracion_promedio}
              <span className="text-sm font-normal text-gray-400">min</span>
            </span>
          }
          sub="promedio"
        />
      </div>

      {/* KPIs avanzados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Cobertura */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Cobertura
              <InfoTooltip text={DEFINICIONES.cobertura} />
            </h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Hoy</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
              <div className="text-3xl font-bold text-blue-600">
                {kpisAvanzados.clientes_unicos}
              </div>
              <div className="text-xs text-gray-500 mt-1">Clientes únicos</div>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
              <div className="text-lg font-bold text-purple-600">
                {kpisAvanzados.primera_hora ?? "--"} &mdash; {kpisAvanzados.ultima_hora ?? "--"}
              </div>
              <div className="text-xs text-gray-500 mt-1">Rango horario</div>
            </div>
          </div>
        </div>

        {/* Actividad por hora */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Actividad por Hora
            </h3>
            {kpisAvanzados.hora_pico !== null && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                Pico: {kpisAvanzados.hora_pico}:00
              </span>
            )}
          </div>
          <div className="flex items-end justify-between gap-1" style={{ height: 80 }}>
            {Array.from({ length: 12 }, (_, i) => i + 7).map((h) => {
              const cantidad = kpisAvanzados.distribucion_hora[h] ?? 0;
              const alturaPx =
                cantidad > 0 ? Math.max(Math.round((cantidad / maxHora) * 60), 8) : 4;
              const esPico = h === kpisAvanzados.hora_pico;
              return (
                <div key={h} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      esPico
                        ? "bg-gradient-to-t from-amber-500 to-amber-400"
                        : cantidad > 0
                        ? "bg-gradient-to-t from-blue-500 to-blue-400"
                        : "bg-gray-200"
                    }`}
                    style={{ height: alturaPx }}
                    title={`${h}:00 — ${cantidad} checkins`}
                  />
                  <div className="text-[9px] text-gray-400 mt-1">{h}</div>
                  {cantidad > 0 && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {cantidad}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Motivos de rechazo */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Motivos de Rechazo
              <InfoTooltip text={DEFINICIONES.motivosInvalidez} />
            </h3>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
              {totalInv} inválidos
            </span>
          </div>
          <div className="space-y-2">
            {kpisAvanzados.motivos.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-4">Sin rechazos</div>
            ) : (
              kpisAvanzados.motivos.map((m) => {
                const pct = totalInv > 0 ? Math.round((m.cantidad / totalInv) * 100) : 0;
                return (
                  <div key={m.motivo} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">
                          {MOTIVO_LABELS[m.motivo] ?? m.motivo}
                        </span>
                        <span className="font-medium">{m.cantidad}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
