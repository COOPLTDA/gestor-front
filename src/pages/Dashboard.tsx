import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import DashboardCalendar from './dashboard/components/DashboardCalendar';
import DashboardFavoritos from './dashboard/components/DashboardFavoritos';
import DashboardLinks from './dashboard/components/DashboardLinks';

interface KPIs {
  pedidos: { hoy: number; semana: number; mes: number };
  estados: { no_finalizados: number; no_reconfirmados: number; cancelados: number; reconfirmados: number };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    fetchWithAuth('/api/distrigestion/dashboard')
      .then(res => {
        if (res.success && (res.data as any)?.kpis) {
          setKpis((res.data as any).kpis);
        }
      })
      .catch(() => {});
  }, []);

  const greeting = getGreeting();
  const todayLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const miniKpis = kpis
    ? [
        { label: 'Pedidos hoy',      value: kpis.pedidos?.hoy ?? 0,                  Icon: ShoppingCart, color: 'text-blue-100' },
        { label: 'Esta semana',      value: kpis.pedidos?.semana ?? 0,               Icon: TrendingUp,   color: 'text-blue-100' },
        { label: 'Sin reconfirmar',  value: kpis.estados?.no_reconfirmados ?? 0,      Icon: Clock,        color: 'text-orange-200' },
        { label: 'Reconfirmados',    value: kpis.estados?.reconfirmados ?? 0,         Icon: CheckCircle,  color: 'text-green-200' },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Barra de bienvenida */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold leading-tight">
              {greeting}, {user?.nombre || user?.username}!
            </h1>
            <p className="text-blue-200 text-sm capitalize mt-0.5">{todayLabel}</p>
          </div>

          {miniKpis.length > 0 && (
            <div className="flex flex-wrap gap-5">
              {miniKpis.map(({ label, value, Icon, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <div>
                    <p className="text-xl font-bold leading-none">{value.toLocaleString()}</p>
                    <p className={`text-xs ${color} leading-tight`}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <DashboardFavoritos />

      {/* Calendario + Links */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7">
          <DashboardCalendar />
        </div>
        <div className="lg:col-span-5">
          <DashboardLinks />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
