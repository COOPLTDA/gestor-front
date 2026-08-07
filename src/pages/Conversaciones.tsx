import React, { useEffect, useState } from 'react';
import { MessageSquare, Search, Calendar, Phone, Clock } from 'lucide-react';
import { fetchWithAuth } from "@/utils/fetchWithAuth";

interface Conversacion {
  id: number;
  numero_celular_envio: string;
  mensaje_usuario: string;
  respuesta_ia: string;
  fecha_hora: string;
}

const Conversaciones: React.FC = () => {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    numero: '',
    desde: '',
    hasta: ''
  });

  const fetchConversaciones = async (page = 1) => {
    try {
      setLoading(true);
      
      console.log('💬 Loading conversaciones from real API...');
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (filters.numero) params.append('numero', filters.numero);
      if (filters.desde) params.append('desde', filters.desde);
      if (filters.hasta) params.append('hasta', filters.hasta);

      const response = await fetchWithAuth(`/api/gestor/conversations?${params}`);

      if (!response.ok) {
        throw new Error('Error cargando conversaciones');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Error cargando conversaciones');
      }
      
      console.log('✅ Conversaciones loaded successfully');
      setConversaciones(result.data);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setCurrentPage(result.pagination.page);
      
    } catch (err: any) {
      console.error('❌ Conversaciones error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversaciones(1);
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    };
  };

  const truncateMessage = (message: string, maxLength = 100) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-6 h-6 text-red-600" />
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="w-8 h-8 mr-3" />
            Módulo de Conversaciones WhatsApp
          </h1>
          <p className="text-gray-600 mt-1">
            {total > 0 ? `${total} conversaciones encontradas` : 'Cargando conversaciones...'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Search className="w-5 h-5 mr-2" />
          Filtros
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Celular
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={filters.numero}
                onChange={(e) => handleFilterChange('numero', e.target.value)}
                placeholder="Buscar por número..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Desde
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={filters.desde}
                onChange={(e) => handleFilterChange('desde', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Hasta
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={filters.hasta}
                onChange={(e) => handleFilterChange('hasta', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Conversaciones List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Lista de Conversaciones
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-lg text-gray-600">Cargando conversaciones...</span>
            </div>
          </div>
        ) : conversaciones.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron conversaciones
            </h3>
            <p className="text-gray-500">
              Ajusta los filtros para ver diferentes resultados.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {conversaciones.map((conversacion) => {
              const { date, time } = formatDateTime(conversacion.fecha_hora);
              
              return (
                <div
                  key={conversacion.id}
                  className="bg-gray-50 rounded-lg p-6 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Phone className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {conversacion.numero_celular_envio}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {date} - {time}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* User Message */}
                    <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
                      <div className="flex items-center mb-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                          <span className="text-xs font-bold text-blue-600">U</span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">Usuario</span>
                      </div>
                      <p className="text-gray-900">
                        {conversacion.mensaje_usuario || 'Sin mensaje'}
                      </p>
                    </div>

                    {/* AI Response */}
                    {conversacion.respuesta_ia && (
                      <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                        <div className="flex items-center mb-2">
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
                            <span className="text-xs font-bold text-green-600">IA</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Asistente</span>
                        </div>
                        <p className="text-gray-900">
                          {conversacion.respuesta_ia}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando página {currentPage} de {totalPages} ({total} total)
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => fetchConversaciones(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => fetchConversaciones(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversaciones;