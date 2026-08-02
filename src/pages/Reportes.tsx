import React, { useEffect, useState } from 'react';
import { TrendingUp, BarChart3, Users, Package, Calendar } from 'lucide-react';
import { fetchWithAuth } from "@/utils/fetchWithAuth";

interface ReportData {
  estados_por_dia: Array<{
    fecha: string;
    no_finalizados: number;
    no_reconfirmados: number;
    cancelados: number;
    reconfirmados: number;
  }>;
  pedidos_por_vendedor: Array<{
    vendedor: string;
    total_pedidos: number;
    reconfirmados: number;
  }>;
  productos_mas_pedidos: Array<{
    producto: string;
    categoria: string;
    cantidad_total: number;
    pedidos_count: number;
  }>;
}

interface ConversationReportData {
  volumen_diario: Array<{
    fecha: string;
    total_mensajes: number;
    usuarios_unicos: number;
  }>;
  horarios_actividad: Array<{
    hora: number;
    total_mensajes: number;
  }>;
  usuarios_activos: Array<{
    numero_celular_envio: string;
    total_mensajes: number;
    primera_interaccion: string;
    ultima_interaccion: string;
  }>;
}

const Reportes: React.FC = () => {
  const [pedidosData, setPedidosData] = useState<ReportData | null>(null);
  const [conversacionesData, setConversacionesData] = useState<ConversationReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pedidos' | 'conversaciones'>('pedidos');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [pedidosResponse, conversacionesResponse] = await Promise.all([
          fetchWithAuth('/api/distrigestion/reportes/pedidos'),
          fetchWithAuth('/api/distrigestion/reportes/conversaciones')
        ]);

        if (!pedidosResponse.ok || !conversacionesResponse.ok) {
          throw new Error('Error cargando reportes');
        }

        const pedidosResult = await pedidosResponse.json();
        const conversacionesResult = await conversacionesResponse.json();

        setPedidosData(pedidosResult.data);
        setConversacionesData(conversacionesResult.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg text-gray-600">Cargando reportes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <TrendingUp className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <TrendingUp className="w-8 h-8 mr-3" />
          Módulo de Reportes y Análisis
        </h1>
        <p className="text-gray-600 mt-1">
          Análisis integral de todas las áreas - Comenzando con pedidos y conversaciones
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'pedidos'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Análisis de Pedidos
          </button>
          <button
            onClick={() => setActiveTab('conversaciones')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'conversaciones'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Análisis de Conversaciones
          </button>
        </nav>
      </div>

      {/* Pedidos Tab */}
      {activeTab === 'pedidos' && pedidosData && (
        <div className="space-y-6">
          {/* Pedidos por Vendedor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Pedidos por Vendedor (Últimos 30 días)
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {pedidosData.pedidos_por_vendedor.map((vendedor, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Vendedor {vendedor.vendedor}
                        </p>
                        <p className="text-sm text-gray-500">
                          {vendedor.reconfirmados} de {vendedor.total_pedidos} reconfirmados
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {vendedor.total_pedidos}
                        </p>
                        <p className="text-sm text-gray-500">pedidos</p>
                      </div>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(vendedor.reconfirmados / vendedor.total_pedidos) * 100}%`
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {Math.round((vendedor.reconfirmados / vendedor.total_pedidos) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Productos Más Pedidos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Top Productos Más Pedidos
              </h2>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm font-medium text-gray-500">#</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Producto</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Categoría</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-500">Cantidad</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-500">Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosData.productos_mas_pedidos.map((producto, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="py-3 text-sm text-gray-900 max-w-xs truncate">
                          {producto.producto}
                        </td>
                        <td className="py-3 text-sm text-gray-500">
                          {producto.categoria}
                        </td>
                        <td className="py-3 text-sm text-gray-900 text-right font-medium">
                          {producto.cantidad_total.toLocaleString()}
                        </td>
                        <td className="py-3 text-sm text-gray-900 text-right">
                          {producto.pedidos_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversaciones Tab */}
      {activeTab === 'conversaciones' && conversacionesData && (
        <div className="space-y-6">
          {/* Volumen Diario */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Actividad Diaria (Últimos 30 días)
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-900">
                    {conversacionesData.volumen_diario.reduce((sum, day) => sum + day.total_mensajes, 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-600">Total Mensajes</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-900">
                    {Math.max(...conversacionesData.volumen_diario.map(day => day.usuarios_unicos))}
                  </div>
                  <div className="text-sm text-green-600">Usuarios Únicos (día)</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-900">
                    {Math.round(conversacionesData.volumen_diario.reduce((sum, day) => sum + day.total_mensajes, 0) / conversacionesData.volumen_diario.length)}
                  </div>
                  <div className="text-sm text-orange-600">Promedio Diario</div>
                </div>
              </div>
            </div>
          </div>

          {/* Horarios de Actividad */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Distribución por Horarios
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {conversacionesData.horarios_actividad.map((horario) => (
                  <div key={horario.hora} className="flex items-center">
                    <div className="w-12 text-sm text-gray-600 font-mono">
                      {String(horario.hora).padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-200 rounded-full h-4">
                        <div
                          className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                          style={{
                            width: `${(horario.total_mensajes / Math.max(...conversacionesData.horarios_actividad.map(h => h.total_mensajes))) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-gray-900 font-medium text-right">
                      {horario.total_mensajes}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Usuarios Más Activos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Usuarios Más Activos
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {conversacionesData.usuarios_activos.map((usuario, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-green-600">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {usuario.numero_celular_envio}
                        </p>
                        <p className="text-sm text-gray-500">
                          Activo: {new Date(usuario.primera_interaccion).toLocaleDateString()} - {new Date(usuario.ultima_interaccion).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {usuario.total_mensajes}
                      </p>
                      <p className="text-sm text-gray-500">mensajes</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reportes;